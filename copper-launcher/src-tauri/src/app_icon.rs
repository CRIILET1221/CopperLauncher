use tauri::{AppHandle, Manager};
#[tauri::command]
pub fn set_app_icon(app: AppHandle, _id: String) -> Result<(), String> {
    let rgba = image::load_from_memory(include_bytes!("../icons/icon.png")).map_err(|e|e.to_string())?.into_rgba8();
    let (w,h)=rgba.dimensions();
    let icon=tauri::image::Image::new_owned(rgba.into_raw(),w,h);
    for window in app.webview_windows().values(){window.set_icon(icon.clone()).map_err(|e|e.to_string())?;}
    if let Some(tray)=app.tray_by_id("main"){tray.set_icon(Some(icon)).map_err(|e|e.to_string())?;}
    Ok(())
}
#[cfg(debug_assertions)]
pub fn apply_from_env(_app: &AppHandle) {}
