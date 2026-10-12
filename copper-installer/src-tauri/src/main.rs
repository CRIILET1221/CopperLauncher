#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, io::{Cursor, Write}, path::{Path, PathBuf}, process::Command, sync::atomic::{AtomicBool, Ordering}};
use tauri::Emitter;
static BUSY: AtomicBool = AtomicBool::new(false);
static PAYLOAD: &[u8] = include_bytes!("../../payload.zip");

#[derive(serde::Serialize, Clone)]
struct Progress { percent: u8, stage: String }
fn progress(app: &tauri::AppHandle, percent: u8, stage: &str) { let _ = app.emit("install-progress", Progress { percent, stage: stage.into() }); }
fn local() -> Result<PathBuf, String> { std::env::var_os("LOCALAPPDATA").map(PathBuf::from).ok_or("Не найдена папка LOCALAPPDATA".into()) }
#[tauri::command]
fn default_path() -> Result<String, String> { Ok(local()?.join("Programs/Copper").to_string_lossy().into()) }
#[tauri::command]
async fn choose_folder(window: tauri::WebviewWindow) -> Result<Option<String>, String> {
    let mut dialog=rfd::AsyncFileDialog::new().set_parent(&window).set_title("Где создать папку Copper?");
    if let Ok(path)=local(){dialog=dialog.set_directory(path);}
    Ok(dialog.pick_folder().await.map(|handle| {
        let parent=handle.path();
        let path=if parent.file_name().map(|n|n.to_string_lossy().eq_ignore_ascii_case("Copper")).unwrap_or(false){parent.to_path_buf()}else{parent.join("Copper")};
        path.to_string_lossy().into()
    }))
}
#[tauri::command]
fn close_setup(app: tauri::AppHandle) { if !BUSY.load(Ordering::SeqCst) { app.exit(0); } }

fn powershell(script: &str, target: &Path, desktop: bool, menu: bool) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let script=format!("[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); {}",script.trim_start_matches('\u{feff}'));
    let mut child = Command::new("powershell.exe").creation_flags(0x08000000)
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .env("COPPER_INSTALL_DIR", target).env("COPPER_DESKTOP", if desktop {"1"} else {"0"})
        .env("COPPER_MENU", if menu {"1"} else {"0"})
        .stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).spawn().map_err(|e| e.to_string())?;
    let start=std::time::Instant::now();
    loop {if child.try_wait().map_err(|e|e.to_string())?.is_some(){break} if start.elapsed()>std::time::Duration::from_secs(30){let _=child.kill();let _=child.wait();return Err("Windows не завершила настройку за 30 секунд. Повторите установку.".into())} std::thread::sleep(std::time::Duration::from_millis(100));}
    let out=child.wait_with_output().map_err(|e|e.to_string())?;
    if out.status.success() { Ok(()) } else { let msg=String::from_utf8_lossy(&out.stderr).trim().to_string();Err(if msg.is_empty(){"Ошибка настройки Windows".into()}else{msg}) }
}
const REGISTER: &str = r#"
$ErrorActionPreference='Stop'
$root=$env:COPPER_INSTALL_DIR
$exe=Join-Path $root 'Copper.exe'
$shell=New-Object -ComObject WScript.Shell
$script:shortcutPaths=@()
function Shortcut($folder) {
  $p=Join-Path $folder 'Copper Launcher.lnk'
  $i=2
  while(Test-Path -LiteralPath $p){$p=Join-Path $folder "Copper Launcher ($i).lnk";$i++}
  $script:shortcutPaths+= $p
  ConvertTo-Json -InputObject @($script:shortcutPaths) | Set-Content -LiteralPath (Join-Path $root 'shortcuts.json') -Encoding UTF8
  $s=$shell.CreateShortcut($p);$s.TargetPath=$exe;$s.WorkingDirectory=$root;$s.IconLocation="$exe,0";$s.Save()
}
if($env:COPPER_DESKTOP -eq '1'){Shortcut ([Environment]::GetFolderPath('Desktop'))}
if($env:COPPER_MENU -eq '1'){Shortcut ([Environment]::GetFolderPath('Programs'))}
$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CopperLauncher'
if(Test-Path $key){
  $previous=(Get-ItemProperty -LiteralPath $key).InstallLocation
  if([string]::IsNullOrWhiteSpace($previous)){throw 'Запись Copper в Windows не содержит пути установки. Удалите её через Параметры → Приложения.'}
  if(Test-Path -LiteralPath (Join-Path $previous 'Copper.exe') -PathType Leaf){throw "Copper уже установлен в $previous. Сначала удалите его через Параметры → Приложения."}
}
New-Item $key -Force | Out-Null
New-ItemProperty $key -Name DisplayName -Value 'Copper Launcher' -Force | Out-Null
New-ItemProperty $key -Name DisplayVersion -Value '2.0.0' -Force | Out-Null
New-ItemProperty $key -Name Publisher -Value 'Copper contributors' -Force | Out-Null
New-ItemProperty $key -Name InstallLocation -Value $root -Force | Out-Null
New-ItemProperty $key -Name DisplayIcon -Value $exe -Force | Out-Null
$uninstall=Join-Path $root 'Uninstall.exe'
New-ItemProperty $key -Name UninstallString -Value ('"'+$uninstall+'"') -Force | Out-Null
New-ItemProperty $key -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty $key -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null
"#;

fn install_inner(app: &tauri::AppHandle, raw: String, desktop: bool, menu: bool) -> Result<String, String> {
    let path=PathBuf::from(raw.trim());
    if !path.is_absolute() || path.parent().is_none() || path.to_string_lossy().starts_with("\\\\") { return Err("Выбери локальную абсолютную папку, например C:\\Users\\…\\Copper".into()); }
    if path.exists() && fs::read_dir(&path).map_err(|e| e.to_string())?.next().is_some() { return Err("Папка должна быть пустой. Выбери новую папку Copper.".into()); }
    let mut ancestor=path.as_path();
    use std::os::windows::fs::MetadataExt;
    loop { if ancestor.exists() && fs::symlink_metadata(ancestor).map_err(|e|e.to_string())?.file_attributes() & 0x400 != 0 { return Err("Папка не должна содержать ссылки или junction".into()); } if let Some(p)=ancestor.parent(){ancestor=p}else{break} }
    progress(app, 2, "Проверка папки и ярлыков…");
    powershell(r#"
$ErrorActionPreference='Stop'
$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CopperLauncher'
if(Test-Path $key){
  $previous=(Get-ItemProperty -LiteralPath $key).InstallLocation
  if([string]::IsNullOrWhiteSpace($previous)){throw 'Запись Copper в Windows не содержит пути установки. Удалите её через Параметры → Приложения.'}
  if(Test-Path -LiteralPath (Join-Path $previous 'Copper.exe') -PathType Leaf){throw "Copper уже установлен в $previous. Сначала удалите его через Параметры → Приложения."}
}
"#,&path,desktop,menu)?;
    progress(app, 5, "Подготовка файлов…");
    fs::create_dir_all(&path).map_err(|e|e.to_string())?;
    let canonical=fs::canonicalize(path).map_err(|e|e.to_string())?;
    let path=PathBuf::from(canonical.to_string_lossy().trim_start_matches("\\\\?\\"));
    let lock_path=path.join(".copper-install.lock");
    let lock=fs::OpenOptions::new().write(true).create_new(true).open(&lock_path).map_err(|e|format!("Папка занята другой установкой: {e}"))?;
    let mut created: Vec<PathBuf>=Vec::new();
    let result=(|| {
        let mut archive=zip::ZipArchive::new(Cursor::new(PAYLOAD)).map_err(|e|e.to_string())?;
        let count=archive.len();
        for i in 0..count {
            let mut entry=archive.by_index(i).map_err(|e|e.to_string())?;
            let name=entry.enclosed_name().ok_or("Некорректный путь в пакете")?;
            if name.components().count()!=1 || entry.is_dir() { return Err("В пакете допускаются только файлы верхнего уровня".into()); }
            let out=path.join(name);
            let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&out).map_err(|e|e.to_string())?;
            created.push(out);
            std::io::copy(&mut entry,&mut file).map_err(|e|e.to_string())?;
            file.flush().map_err(|e|e.to_string())?;
            progress(app, (10+70*(i+1)/count.max(1)) as u8, "Распаковка Copper Launcher…");
        }
        if !path.join("Copper.exe").is_file(){return Err("В пакете отсутствует Copper.exe".into())}
        if !path.join("Uninstall.exe").is_file(){return Err("В пакете отсутствует Uninstall.exe".into())}
        let shortcuts=path.join("shortcuts.json");fs::write(&shortcuts,b"[]").map_err(|e|e.to_string())?;created.push(shortcuts);
        let names:Vec<String>=created.iter().map(|p|p.file_name().unwrap().to_string_lossy().into()).collect();
        let manifest=path.join("installed-files.json");fs::write(&manifest,serde_json::to_vec(&names).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;created.push(manifest);
        progress(app,90,"Создание ярлыков…");
        powershell(REGISTER,&path,desktop,menu)?;
        progress(app,100,"Copper установлен");
        Ok(path.to_string_lossy().into())
    })();
    if result.is_err() {
        // Only remove files this attempt created, never user data or the target recursively.
        let _=powershell(include_str!("../../rollback.ps1"),&path,desktop,menu);
        for file in created.into_iter().rev(){let _=fs::remove_file(file);}
    }
    drop(lock);
    let _=fs::remove_file(lock_path);
    if result.is_err(){let _=fs::remove_dir(&path);}
    result
}
#[tauri::command]
async fn install(app:tauri::AppHandle,path:String,desktop:bool,menu:bool)->Result<String,String>{
    if BUSY.swap(true,Ordering::SeqCst){return Err("Установка уже выполняется".into())}
    let result=tauri::async_runtime::spawn_blocking(move||install_inner(&app,path,desktop,menu)).await.map_err(|e|e.to_string()).and_then(|r|r);
    BUSY.store(false,Ordering::SeqCst);result
}
#[tauri::command]
fn launch(path:String)->Result<(),String>{
    let root=PathBuf::from(path);
    if !root.join("installed-files.json").is_file(){return Err("Установка не найдена".into())}
    Command::new(root.join("Copper.exe")).current_dir(root).spawn().map_err(|e|e.to_string())?;Ok(())
}
#[tauri::command]
fn startup_ready(window: tauri::WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    let _ = window.set_focus();
    Ok(())
}
fn main(){tauri::Builder::default().invoke_handler(tauri::generate_handler![startup_ready,default_path,choose_folder,close_setup,install,launch])
    .on_window_event(|_,event|{if let tauri::WindowEvent::CloseRequested{api,..}=event {if BUSY.load(Ordering::SeqCst){api.prevent_close();}}})
    .run(tauri::generate_context!()).expect("Copper Setup could not start");}
