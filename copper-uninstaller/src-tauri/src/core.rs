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
    let allowed=["Copper.exe","Copper-C.ico","Uninstall.exe","LICENSE","NOTICE","THIRD-PARTY.md","TRADEMARK.md","OFL.txt","THIRD-PARTY-LICENSES.txt","uninstall.ps1","shortcuts.json","installed-files.json"];
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
/// Only explicitly owned settings/cache entries are cleaned. Never delete the
/// app-data root, profile catalogue, game-root pointer, exports or game folders.
pub(crate) fn clean_launcher_data(roaming: &Path, local: &Path) -> Result<usize, String> {
    let mut games = vec![roaming.join("minecraft")];
    let pointer = roaming.join("game-root.txt");
    if pointer.exists() {
        validate_root(roaming)?;
        if !removable(&pointer)? { return Err("Некорректный путь к игровым данным.".into()); }
        let configured = fs::read_to_string(&pointer).map_err(|e|e.to_string())?;
        if !configured.trim().is_empty() {
            let path = std::path::PathBuf::from(configured.trim());
            if !path.is_absolute() { return Err("Путь к игровым данным должен быть абсолютным.".into()); }
            games.push(path);
        }
    }
    let mut targets = Vec::new();
    for (root, names) in [
        (roaming, &["ui-prefs.json", "secrets.bin", "vault.key", "secrets.key", "cache", "crashes", "logs", "tmp", "wallpaper", "textures", "localskin", "agents", "installers"][..]),
        (local, &["EBWebView", "WebView2", "cache"][..]),
    ] {
        if !root.exists() { continue; }
        validate_root(root)?;
        for name in names {
            let target = root.join(name);
            if !target.exists() { continue; }
            validate_root(&target)?;
            let canonical = fs::canonicalize(&target).map_err(|e|e.to_string())?;
            for game in &games {
                let game = if game.exists() { fs::canonicalize(game).map_err(|e|e.to_string())? } else { game.clone() };
                if canonical.starts_with(&game) || game.starts_with(&canonical) {
                    return Err("Кэш пересекается с игровой папкой. Удалите Copper без очистки данных — инстансы останутся целыми.".into());
                }
            }
            targets.push(target);
        }
    }
    // Preflight every entry before deleting anything; reject links/junctions.
    fn collect(path: &Path, files: &mut Vec<std::path::PathBuf>, dirs: &mut Vec<std::path::PathBuf>) -> Result<(), String> {
        let metadata = fs::symlink_metadata(path).map_err(|e|e.to_string())?;
        if metadata.file_attributes() & 0x400 != 0 { return Err("В кэше найдена ссылка или junction. Очистка отменена.".into()); }
        if metadata.is_dir() {
            for entry in fs::read_dir(path).map_err(|e|e.to_string())? { collect(&entry.map_err(|e|e.to_string())?.path(), files, dirs)?; }
            dirs.push(path.to_path_buf());
        } else if metadata.is_file() { files.push(path.to_path_buf()); }
        else { return Err("Посторонний тип файла в кэше.".into()); }
        Ok(())
    }
    let mut files = Vec::new();
    let mut dirs = Vec::new();
    for target in targets { collect(&target, &mut files, &mut dirs)?; }
    for file in &files { delete_file(file)?; }
    for dir in dirs { fs::remove_dir(&dir).map_err(|e|format!("Не удалось очистить {}: {e}",dir.display()))?; }
    Ok(files.len())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn manifest_accepts_installer_files() { assert_eq!(parse_manifest(br#"["Copper.exe","Copper-C.ico","Uninstall.exe","LICENSE","shortcuts.json","OFL.txt","THIRD-PARTY-LICENSES.txt"]"#).unwrap().len(),7); }
    #[test] fn manifest_rejects_foreign_paths_and_nested_arrays() { for data in [br#"["Copper.exe","../world"]"#.as_slice(),br#"[["Copper.exe"]]"#.as_slice(),br#"["Copper.exe","world"]"#.as_slice()] { assert!(parse_manifest(data).is_err()); } }
    #[test] fn manifest_requires_launcher() { assert!(parse_manifest(br#"["LICENSE"]"#).is_err()); }
}

#[cfg(test)]
mod filesystem_tests {
    use super::*;
    #[test]
    fn cleanup_preserves_instances_and_custom_game_pointer() {
        let root=std::env::temp_dir().join(format!("Copper-clean-test-{}",std::process::id()));
        let roaming=root.join("roaming"); let local=root.join("local"); let games=root.join("custom-games");
        fs::create_dir_all(roaming.join("cache/heads")).unwrap();
        fs::create_dir_all(local.join("EBWebView/Default")).unwrap();
        fs::create_dir_all(games.join("profiles/world/saves")).unwrap();
        fs::write(games.join("profiles/world/saves/level.dat"),b"keep").unwrap();
        fs::write(roaming.join("game-root.txt"),games.to_str().unwrap()).unwrap();
        for name in ["profiles.json","profile-groups.json","personal-notes.txt"] { fs::write(roaming.join(name),b"keep").unwrap(); }
        fs::write(roaming.join("ui-prefs.json"),b"clear").unwrap();
        fs::write(roaming.join("secrets.bin"),b"clear").unwrap();
        fs::write(roaming.join("cache/heads/face.png"),b"clear").unwrap();
        fs::write(local.join("EBWebView/Default/preferences"),b"clear").unwrap();
        assert_eq!(clean_launcher_data(&roaming,&local).unwrap(),4);
        assert!(games.join("profiles/world/saves/level.dat").is_file());
        for name in ["game-root.txt","profiles.json","profile-groups.json","personal-notes.txt"] { assert!(roaming.join(name).is_file()); }
        assert!(!roaming.join("cache").exists());
        assert!(!local.join("EBWebView").exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn cleanup_refuses_game_folder_inside_cache_before_deleting_settings() {
        let root=std::env::temp_dir().join(format!("Copper-clean-overlap-test-{}",std::process::id()));
        let roaming=root.join("roaming"); let games=roaming.join("cache/game");
        fs::create_dir_all(&games).unwrap();
        fs::write(roaming.join("game-root.txt"),games.to_str().unwrap()).unwrap();
        fs::write(roaming.join("ui-prefs.json"),b"keep").unwrap();
        fs::write(games.join("world.dat"),b"keep").unwrap();
        assert!(clean_launcher_data(&roaming,&root.join("local")).is_err());
        assert!(roaming.join("ui-prefs.json").is_file()); assert!(games.join("world.dat").is_file());
        fs::remove_dir_all(root).unwrap();
    }
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
