#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, path::{Path, PathBuf}, process::{Command, Stdio}, sync::atomic::{AtomicBool, Ordering}, time::{Duration, Instant}};
use std::os::windows::process::CommandExt;
mod core;
use core::{validate_root,parse_manifest,removable,delete_file};
use tauri::{Emitter, Manager};
static BUSY: AtomicBool = AtomicBool::new(false);
struct Installation(Result<PathBuf, String>);
#[derive(serde::Serialize, Clone)]
struct Progress { percent: u8, stage: String }
fn report(app: &tauri::AppHandle, percent: u8, stage: &str) { let _ = app.emit("uninstall-progress", Progress { percent, stage: stage.into() }); }
fn powershell(script: &str, root: &Path) -> Result<(), String> {
    let script = format!("[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); {script}");
    let mut child = Command::new("powershell.exe").creation_flags(0x08000000)
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .env("COPPER_UNINSTALL_ROOT", root).stdout(Stdio::null()).stderr(Stdio::piped())
        .spawn().map_err(|e| format!("Не удалось обратиться к Windows: {e}"))?;
    let start = Instant::now();
    loop {
        if child.try_wait().map_err(|e|e.to_string())?.is_some() { break; }
        if start.elapsed() > Duration::from_secs(30) { let _=child.kill();let _=child.wait();return Err("Windows не завершила операцию за 30 секунд. Повторите удаление.".into()); }
        std::thread::sleep(Duration::from_millis(100));
    }
    let out=child.wait_with_output().map_err(|e|e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).trim().to_string()) }
}
const VERIFY: &str = r#"
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($env:COPPER_UNINSTALL_ROOT).TrimEnd('\')
$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CopperLauncher'
if(!(Test-Path -LiteralPath $key)){throw 'Copper не зарегистрирован в Windows.'}
$registered=(Get-ItemProperty -LiteralPath $key).InstallLocation
if([string]::IsNullOrWhiteSpace($registered) -or [IO.Path]::GetFullPath($registered).TrimEnd('\') -ne $root){throw 'Папка не совпадает с зарегистрированной установкой Copper.'}
$exe=Join-Path $root 'Copper.exe'
foreach($process in (Get-Process -ErrorAction SilentlyContinue)){
  $processPath=$null
  try{$processPath=$process.Path}catch{}
  if($processPath -eq $exe){throw 'Copper открыт. Закройте лаунчер, в том числе в трее, и повторите удаление.'}
}
"#;
const REMOVE_WINDOWS_ENTRIES: &str = r#"
$ErrorActionPreference='Stop'
$root=$env:COPPER_UNINSTALL_ROOT
$exe=Join-Path $root 'Copper.exe'
$record=Join-Path $root 'shortcuts.json'
if(Test-Path -LiteralPath $record){
  $links=Get-Content -LiteralPath $record -Raw | ConvertFrom-Json
  $shell=New-Object -ComObject WScript.Shell
  foreach($link in $links){
    if(([IO.Path]::GetDirectoryName($link)) -in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs')) -and [IO.Path]::GetExtension($link) -eq '.lnk'){
      if(Test-Path -LiteralPath $link){if($shell.CreateShortcut($link).TargetPath -eq $exe){Remove-Item -LiteralPath $link -Force}}
    }
  }
}
$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CopperLauncher'
if(Test-Path -LiteralPath $key){
  if((Get-ItemProperty -LiteralPath $key).InstallLocation -eq $root){Remove-Item -LiteralPath $key}
  else{throw 'Запись установки изменилась. Повторите удаление.'}
}
"#;
fn remove_installation(app: &tauri::AppHandle, root: &Path) -> Result<(), String> {
    validate_root(root)?;
    report(app, 5, "Проверка установки…");
    let manifest=root.join("installed-files.json");
    if !removable(&manifest)? { return Err("Список установленных файлов не найден.".into()); }
    let names=parse_manifest(&fs::read(&manifest).map_err(|e|e.to_string())?)?;
    for name in &names { removable(&root.join(name))?; }
    let records=root.join("shortcuts.json");
    if removable(&records)? { let _:Vec<String>=serde_json::from_slice(&fs::read(&records).map_err(|e|e.to_string())?.into_iter().skip_while(|b|matches!(*b,0xef|0xbb|0xbf)).collect::<Vec<_>>()).map_err(|e|format!("Не удалось прочитать список ярлыков: {e}"))?; }
    powershell(VERIFY,root)?;
    report(app, 15, "Удаление файлов лаунчера…");
    // Keep the manifest and uninstall program until Windows cleanup succeeds so a failed attempt can be retried.
    let files:Vec<_>=names.iter().filter(|n|!matches!(n.as_str(),"Uninstall.exe"|"uninstall.ps1"|"shortcuts.json"|"installed-files.json")).collect();
    for (i,name) in files.iter().enumerate() {
        delete_file(&root.join(name))?;
        report(app, (15+55*(i+1)/files.len().max(1)) as u8,"Удаление файлов лаунчера…");
    }
    report(app, 80, "Удаление ярлыков и записи Windows…");
    powershell(&format!("{VERIFY}\n{REMOVE_WINDOWS_ENTRIES}"),root)?;
    for name in ["shortcuts.json","uninstall.ps1","Uninstall.exe","installed-files.json"] { delete_file(&root.join(name))?; }
    // Only remove an empty installation directory. Never recurse into game data or user files.
    if fs::read_dir(root).map_err(|e|e.to_string())?.next().is_none() { fs::remove_dir(root).map_err(|e|e.to_string())?; }
    report(app,100,"Copper удалён. Игровые данные сохранены.");
    Ok(())
}
#[tauri::command]
fn installation_path(state: tauri::State<Installation>) -> Result<String,String> { state.0.as_ref().map(|p|p.to_string_lossy().into_owned()).map_err(Clone::clone) }
#[tauri::command]
fn close_uninstaller(app:tauri::AppHandle) { if !BUSY.load(Ordering::SeqCst) { app.exit(0); } }
#[tauri::command]
async fn uninstall(app:tauri::AppHandle) -> Result<(),String> {
    if BUSY.swap(true,Ordering::SeqCst) { return Err("Удаление уже выполняется.".into()); }
    let root=app.state::<Installation>().0.clone();
    let result=match root {
        Ok(root)=>tauri::async_runtime::spawn_blocking(move||remove_installation(&app,&root)).await.map_err(|e|e.to_string()).and_then(|r|r),
        Err(e)=>Err(e),
    };
    BUSY.store(false,Ordering::SeqCst);result
}
fn temporary_copy() -> Result<(PathBuf,Option<PathBuf>),String> {
    let own=std::env::current_exe().map_err(|e|e.to_string())?;
    let args:Vec<_>=std::env::args_os().collect();
    if args.len()==3 && args[1]=="--installed-root" {
        let parent=own.parent().ok_or("Не найдена временная папка.")?;
        let temp=std::env::temp_dir();
        let is_temp=parent.parent().map(|p|p.to_string_lossy().trim_end_matches('\\').eq_ignore_ascii_case(temp.to_string_lossy().trim_end_matches('\\'))).unwrap_or(false);
        let is_ours=parent.file_name().map(|n|n.to_string_lossy().starts_with("Copper-Uninstall-")).unwrap_or(false);
        if !is_temp || !is_ours { return Err("Временный режим доступен только копии деинсталлятора.".into()); }
        return Ok((PathBuf::from(&args[2]),Some(own)));
    }
    let root=own.parent().ok_or("Не найдена папка установки.")?.to_path_buf();
    validate_root(&root)?;
    if !root.join("installed-files.json").is_file() { return Err("Запусти Uninstall.exe из установленной папки Copper.".into()); }
    // Run the UI from a private temporary copy so Windows permits removal of the installed executable.
    let folder=std::env::temp_dir().join(format!("Copper-Uninstall-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos()));
    fs::create_dir(&folder).map_err(|e|e.to_string())?;
    let copy=folder.join("Uninstall.exe");fs::copy(&own,&copy).map_err(|e|e.to_string())?;
    Command::new(&copy).args([std::ffi::OsStr::new("--installed-root"),root.as_os_str()]).current_dir(&folder).spawn().map_err(|e|e.to_string())?;
    std::process::exit(0);
}
fn cleanup_temp(path:&Path) {
    // Exact file deletion after this process exits; no recursive deletion and no scripts left on disk.
    let script=r#"$ErrorActionPreference='SilentlyContinue'; Wait-Process -Id ([int]$env:COPPER_CLEANUP_PID) -ErrorAction SilentlyContinue; $p=$env:COPPER_CLEANUP_FILE; Remove-Item -LiteralPath $p -Force; $folder=[IO.Path]::GetDirectoryName($p); if((Test-Path -LiteralPath $folder) -and !(Get-ChildItem -LiteralPath $folder -Force)){Remove-Item -LiteralPath $folder}"#;
    let _=Command::new("powershell.exe").creation_flags(0x08000000).args(["-NoProfile","-NonInteractive","-Command",script])
        .current_dir(std::env::temp_dir()).env("COPPER_CLEANUP_FILE",path).env("COPPER_CLEANUP_PID",std::process::id().to_string()).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn();
}
fn main() {
    let (root,temp)=match temporary_copy() { Ok((root,temp))=>(Ok(root),temp),Err(e)=>(Err(e),None) };
    let app=tauri::Builder::default().manage(Installation(root)).invoke_handler(tauri::generate_handler![installation_path,uninstall,close_uninstaller])
        .on_window_event(|_,event|{if let tauri::WindowEvent::CloseRequested{api,..}=event {if BUSY.load(Ordering::SeqCst){api.prevent_close();}}})
        .build(tauri::generate_context!()).expect("Copper Uninstall could not start");
    app.run(move|_,event|{if let tauri::RunEvent::Exit=event { if let Some(path)=&temp {cleanup_temp(path);} }});
}
