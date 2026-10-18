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
        .env("COPPER_MENU", if menu {"1"} else {"0"}).env("COPPER_VERSION", env!("CARGO_PKG_VERSION"))
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
$icon=Join-Path $root 'Copper-C.ico'
$shell=New-Object -ComObject WScript.Shell
$script:shortcutPaths=@()
function Shortcut($folder) {
  $p=Join-Path $folder 'Copper Launcher.lnk'
  $i=2
  while(Test-Path -LiteralPath $p){
    if($shell.CreateShortcut($p).TargetPath -eq $exe){break}
    $p=Join-Path $folder "Copper Launcher ($i).lnk";$i++
  }
  $script:shortcutPaths+= $p
  ConvertTo-Json -InputObject @($script:shortcutPaths) | Set-Content -LiteralPath (Join-Path $root 'shortcuts.json') -Encoding UTF8
  $s=$shell.CreateShortcut($p);$s.TargetPath=$exe;$s.WorkingDirectory=$root;$s.IconLocation="$icon,0";$s.Save()
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
New-ItemProperty $key -Name DisplayVersion -Value $env:COPPER_VERSION -Force | Out-Null
New-ItemProperty $key -Name Publisher -Value 'Copper contributors' -Force | Out-Null
New-ItemProperty $key -Name InstallLocation -Value $root -Force | Out-Null
New-ItemProperty $key -Name DisplayIcon -Value $icon -Force | Out-Null
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
        if !path.join("Copper-C.ico").is_file(){return Err("В пакете отсутствует иконка Copper-C.ico. Пересоберите установщик.".into())}
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
    // Тихое обновление идёт без окна; окно покажется, только если оно не удалось.
    if SILENT.load(Ordering::SeqCst) { return Ok(()) }
    window.show().map_err(|e| e.to_string())?;
    let _ = window.set_focus();
    Ok(())
}

// ---------- Обновление поверх установленной копии ----------
// Путь берётся только из записи Copper в реестре, не из интерфейса. Файлы
// пакета заменяются по одному с запасной копией *.old; при любой ошибке всё
// возвращается как было. Ярлыки, shortcuts.json и данные игр не трогаются.

const UNINSTALL_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\CopperLauncher";
/// Версия лаунчера в пакете; build.ps1 передаёт её из Cargo.toml лаунчера.
const LAUNCHER_VERSION: &str = match option_env!("COPPER_LAUNCHER_VERSION") { Some(v) => v, None => env!("CARGO_PKG_VERSION") };

#[derive(serde::Serialize, Clone)]
struct Existing { path: String, version: String }
#[derive(serde::Serialize)]
struct SetupMode { existing: Option<Existing>, auto_update: bool, version: String, error: Option<String> }

/// --silent-update: лаунчер обновляется без окна установщика, затем сам запускается.
static SILENT: AtomicBool = AtomicBool::new(false);
static SILENT_ERROR: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

fn has_arg(flag: &str) -> bool { std::env::args().skip(1).any(|a| a.eq_ignore_ascii_case(flag)) }

fn start_silent_update(app: &tauri::AppHandle) {
    SILENT.store(true, Ordering::SeqCst);
    BUSY.store(true, Ordering::SeqCst);
    let app = app.clone();
    std::thread::spawn(move || {
        let result = update_inner(&app).and_then(|path| launch(path).map(|_| ()));
        BUSY.store(false, Ordering::SeqCst);
        match result {
            Ok(()) => app.exit(0),
            Err(e) => {
                *SILENT_ERROR.lock().unwrap_or_else(|p| p.into_inner()) = Some(e.clone());
                SILENT.store(false, Ordering::SeqCst);
                let _ = app.emit("update-failed", e);
                if let Some(w) = tauri::Manager::get_webview_window(&app, "main") { let _ = w.show(); let _ = w.set_focus(); }
            }
        }
    });
}

fn existing_install() -> Option<Existing> {
    let key = windows_registry::CURRENT_USER.open(UNINSTALL_KEY).ok()?;
    let raw = key.get_string("InstallLocation").ok()?;
    let path = PathBuf::from(raw.trim());
    let ok = path.is_absolute() && !path.to_string_lossy().starts_with("\\\\")
        && path.join("Copper.exe").is_file() && path.join("installed-files.json").is_file();
    ok.then(|| Existing { path: path.to_string_lossy().into(), version: key.get_string("DisplayVersion").unwrap_or_default() })
}

/// Лаунчер запускает установщик с --update: тогда обновление идёт само.
#[tauri::command]
fn setup_mode() -> SetupMode {
    let existing = existing_install();
    let error = SILENT_ERROR.lock().unwrap_or_else(|p| p.into_inner()).clone();
    let auto_update = existing.is_some() && error.is_none() && has_arg("--update");
    SetupMode { existing, auto_update, version: LAUNCHER_VERSION.into(), error }
}

/// Запущенный exe Windows не даёт открыть на запись — ждём, пока лаунчер закроется.
fn wait_unlocked(app: &tauri::AppHandle, exe: &Path) -> Result<(), String> {
    let start = std::time::Instant::now();
    loop {
        match fs::OpenOptions::new().write(true).open(exe) {
            Ok(_) => return Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(_) if start.elapsed() < std::time::Duration::from_secs(60) => {
                progress(app, 3, "Ждём, пока закроется Copper Launcher…");
                std::thread::sleep(std::time::Duration::from_millis(400));
            }
            Err(_) => return Err("Copper Launcher всё ещё открыт. Закрой его (и в трее) и нажми «Обновить» ещё раз.".into()),
        }
    }
}

fn side(path: &Path, ext: &str) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(ext);
    path.with_file_name(name)
}

fn update_inner(app: &tauri::AppHandle) -> Result<String, String> {
    let existing = existing_install().ok_or("Установленный Copper не найден. Выбери папку для новой установки.")?;
    let root = PathBuf::from(&existing.path);
    progress(app, 2, "Проверка установленной версии…");
    wait_unlocked(app, &root.join("Copper.exe"))?;
    let lock_path = root.join(".copper-install.lock");
    let _ = fs::remove_file(&lock_path);
    let lock = fs::OpenOptions::new().write(true).create_new(true).open(&lock_path).map_err(|e| format!("Папка занята другой установкой: {e}"))?;
    // (новый файл, заменённый файл или None, если раньше файла не было)
    let mut done: Vec<(PathBuf, Option<PathBuf>)> = Vec::new();
    let mut names: Vec<String> = Vec::new();
    let result = (|| -> Result<(), String> {
        let mut archive = zip::ZipArchive::new(Cursor::new(PAYLOAD)).map_err(|e| e.to_string())?;
        let count = archive.len();
        for i in 0..count {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = entry.enclosed_name().ok_or("Некорректный путь в пакете")?;
            if name.components().count() != 1 || entry.is_dir() { return Err("В пакете допускаются только файлы верхнего уровня".into()); }
            names.push(name.to_string_lossy().into());
            let out = root.join(&name);
            let fresh = side(&out, ".new");
            {
                let mut file = fs::File::create(&fresh).map_err(|e| format!("{}: {e}", fresh.display()))?;
                std::io::copy(&mut entry, &mut file).map_err(|e| e.to_string())?;
                file.flush().map_err(|e| e.to_string())?;
            }
            let backup = if out.exists() {
                let old = side(&out, ".old");
                let _ = fs::remove_file(&old);
                fs::rename(&out, &old).map_err(|e| format!("Не удалось заменить {}: {e}", out.display()))?;
                Some(old)
            } else { None };
            done.push((out.clone(), backup));
            fs::rename(&fresh, &out).map_err(|e| format!("Не удалось записать {}: {e}", out.display()))?;
            progress(app, (10 + 75 * (i + 1) / count.max(1)) as u8, "Замена файлов Copper Launcher…");
        }
        if !root.join("Copper.exe").is_file() { return Err("В пакете отсутствует Copper.exe".into()); }
        let manifest = root.join("installed-files.json");
        let mut listed: Vec<String> = fs::read(&manifest).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
        for n in &names { if !listed.iter().any(|x| x.eq_ignore_ascii_case(n)) { listed.push(n.clone()); } }
        fs::write(&manifest, serde_json::to_vec(&listed).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        progress(app, 92, "Обновление записи в Windows…");
        let key = windows_registry::CURRENT_USER.create(UNINSTALL_KEY).map_err(|e| e.to_string())?;
        key.set_string("DisplayVersion", LAUNCHER_VERSION).map_err(|e| e.to_string())?;
        Ok(())
    })();
    match &result {
        Ok(()) => { for (_, old) in &done { if let Some(old) = old { let _ = fs::remove_file(old); } } }
        Err(_) => {
            for (out, old) in done.iter().rev() {
                let _ = fs::remove_file(out);
                if let Some(old) = old { let _ = fs::rename(old, out); }
            }
            for n in &names { let _ = fs::remove_file(side(&root.join(n), ".new")); }
        }
    }
    drop(lock);
    let _ = fs::remove_file(&lock_path);
    result?;
    progress(app, 100, "Copper обновлён");
    Ok(existing.path)
}

#[tauri::command]
async fn update(app: tauri::AppHandle) -> Result<String, String> {
    if BUSY.swap(true, Ordering::SeqCst) { return Err("Установка уже выполняется".into()) }
    let result = tauri::async_runtime::spawn_blocking(move || update_inner(&app)).await.map_err(|e| e.to_string()).and_then(|r| r);
    BUSY.store(false, Ordering::SeqCst);
    result
}

fn main(){tauri::Builder::default().invoke_handler(tauri::generate_handler![startup_ready,default_path,choose_folder,close_setup,install,launch,setup_mode,update])
    .on_window_event(|_,event|{if let tauri::WindowEvent::CloseRequested{api,..}=event {if BUSY.load(Ordering::SeqCst){api.prevent_close();}}})
    .setup(|app|{if has_arg("--silent-update") && existing_install().is_some(){start_silent_update(app.handle());}Ok(())})
    .run(tauri::generate_context!()).expect("Copper Setup could not start");}
