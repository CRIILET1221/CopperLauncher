use std::{fs,path::Path};
use std::os::windows::fs::MetadataExt;
pub(crate) fn validate_root(root: &Path) -> Result<(), String> {
    if !root.is_absolute() || root.parent().is_none() || root.to_string_lossy().starts_with("\\\\") { return Err("Некорректная папка установки.".into()); }
    for ancestor in root.ancestors() {
        if fs::symlink_metadata(ancestor).map_err(|e|e.to_string())?.file_attributes() & 0x400 != 0 { return Err("Папка установки содержит ссылку или junction.".into()); }
    }
    Ok(())
}
pub(crate) fn parse_manifest(bytes: &[u8]) -> Result<Vec<String>, String> {
    let bytes=bytes.strip_prefix(&[0xef,0xbb,0xbf]).unwrap_or(bytes);
    let names: Vec<String>=serde_json::from_slice(bytes).map_err(|e|format!("Не удалось прочитать список файлов: {e}"))?;
    let allowed=["Copper.exe","Uninstall.exe","LICENSE","NOTICE","THIRD-PARTY.md","TRADEMARK.md","OFL.txt","THIRD-PARTY-LICENSES.txt","uninstall.ps1","shortcuts.json","installed-files.json"];
    for name in &names { if !allowed.contains(&name.as_str()) { return Err(format!("Посторонний файл в списке установки: {name}")); } }
    if !names.iter().any(|name|name=="Copper.exe") { return Err("В списке установки отсутствует Copper.exe.".into()); }
    Ok(names)
}
pub(crate) fn removable(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(m) if m.is_file() && m.file_attributes() & 0x400 == 0 => Ok(true),
        Ok(_) => Err(format!("Вместо файла найдена папка или ссылка: {}",path.display())),
        Err(e) if e.kind()==std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}
pub(crate) fn delete_file(path: &Path) -> Result<(), String> {
    if removable(path)? { fs::remove_file(path).map_err(|e|format!("Не удалось удалить {}: {e}",path.display()))?; }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn manifest_accepts_installer_files() { assert_eq!(parse_manifest(br#"["Copper.exe","Uninstall.exe","LICENSE","shortcuts.json","OFL.txt","THIRD-PARTY-LICENSES.txt"]"#).unwrap().len(),6); }
    #[test] fn manifest_rejects_foreign_paths_and_nested_arrays() { for data in [br#"["Copper.exe","../world"]"#.as_slice(),br#"[["Copper.exe"]]"#.as_slice(),br#"["Copper.exe","world"]"#.as_slice()] { assert!(parse_manifest(data).is_err()); } }
    #[test] fn manifest_requires_launcher() { assert!(parse_manifest(br#"["LICENSE"]"#).is_err()); }
}

#[cfg(test)]
mod filesystem_tests {
    use super::*;
    #[test]
    fn removes_only_manifest_files_and_preserves_user_data() {
        let root=std::env::temp_dir().join(format!("Copper-uninstall-test-{}",std::process::id()));
        fs::create_dir(&root).unwrap();
        fs::write(root.join("Copper.exe"),b"test").unwrap();
        fs::write(root.join("personal-notes.txt"),b"keep").unwrap();
        fs::create_dir(root.join("worlds")).unwrap();
        fs::write(root.join("worlds/level.dat"),b"keep").unwrap();
        validate_root(&root).unwrap();
        assert!(delete_file(&root.join("worlds")).is_err());
        for name in parse_manifest(br#"["Copper.exe"]"#).unwrap() {delete_file(&root.join(name)).unwrap();}
        assert!(!root.join("Copper.exe").exists());
        assert!(root.join("personal-notes.txt").is_file());
        assert!(root.join("worlds/level.dat").is_file());
        delete_file(&root.join("Copper.exe")).unwrap();
        fs::remove_file(root.join("personal-notes.txt")).unwrap();
        fs::remove_file(root.join("worlds/level.dat")).unwrap();
        fs::remove_dir(root.join("worlds")).unwrap();
        fs::remove_dir(root).unwrap();
    }
}
