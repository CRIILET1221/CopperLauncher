use crate::{discord, engine};

/// Discord's socket lives on its own thread: a client that accepts the pipe and
/// then answers nothing used to freeze the window, because a synchronous
/// command runs on the main thread.
#[tauri::command]
pub async fn discord_presence(
    details: String,
    state: String,
    playing: bool,
    large_image: Option<String>,
    large_text: Option<String>,
    join_url: Option<String>,
    profile_slug: Option<String>,
) -> discord::DiscordStatus {
    discord::set_activity(discord::Presence {
        details,
        state,
        playing,
        large_image: large_image.unwrap_or_default(),
        large_text: large_text.unwrap_or_default(),
        join_url: join_url.unwrap_or_default(),
        profile_slug: profile_slug.unwrap_or_default(),
    })
    .await;
    discord::status()
}

#[tauri::command]
pub fn discord_status() -> discord::DiscordStatus { discord::status() }

#[tauri::command]
pub async fn discord_reconnect() -> discord::DiscordStatus {
    discord::reconnect().await;
    discord::status()
}

#[tauri::command]
pub async fn discord_clear() { discord::clear().await; }

#[tauri::command]
pub async fn ms_device_start() -> Result<serde_json::Value, String> { engine::ms_device_start().await }

#[tauri::command]
pub async fn ms_device_poll(device_code: String) -> Result<serde_json::Value, String> {
    engine::ms_login_poll(device_code).await
}

/// Binds the finished Microsoft login to the account row the frontend created.
#[tauri::command(async)]
pub fn ms_session_commit(device_code: String, account_id: String) -> Result<(), String> {
    engine::ms_login_commit(&device_code, &account_id)
}

#[tauri::command]
pub async fn ms_session_refresh(account_id: String) -> Result<serde_json::Value, String> {
    engine::ms_session_refresh(&account_id).await
}

#[tauri::command]
pub async fn ms_session_validate(account_id: String) -> Result<serde_json::Value, String> {
    engine::ms_session_validate(&account_id).await
}

#[tauri::command(async)]
pub fn ms_session_forget(account_id: String) -> Result<(), String> {
    engine::ms_forget(&account_id)
}

#[tauri::command]
pub async fn ely_device_start() -> Result<serde_json::Value, String> { engine::ely_device_start().await }

#[tauri::command]
pub async fn ely_device_poll(device_code: String) -> Result<serde_json::Value, String> {
    engine::ely_login_poll(device_code).await
}

/// Binds the finished Ely.by login to the account row the frontend created.
#[tauri::command(async)]
pub fn ely_session_commit(device_code: String, account_id: String) -> Result<(), String> {
    engine::ely_login_commit(&device_code, &account_id)
}

#[tauri::command]
pub async fn mc_textures(query: String) -> Result<serde_json::Value, String> { engine::mc_textures(query).await }

fn licensed_token(account_id: &str) -> Result<String, String> {
    engine::mc_token(account_id).ok_or_else(|| "вход по лицензии Microsoft устарел".to_string())
}

#[tauri::command]
pub async fn ms_profile(account_id: String) -> Result<serde_json::Value, String> {
    engine::ms_profile(licensed_token(&account_id)?).await
}

#[tauri::command]
pub async fn ms_set_cape(account_id: String, cape_id: String) -> Result<serde_json::Value, String> {
    engine::ms_set_cape(licensed_token(&account_id)?, cape_id).await
}

#[tauri::command]
pub async fn ms_upload_skin(account_id: String, png_base64: String, slim: bool) -> Result<serde_json::Value, String> {
    engine::ms_upload_skin_png(licensed_token(&account_id)?, png_base64, slim).await
}

#[tauri::command]
pub async fn ms_reset_skin(account_id: String) -> Result<serde_json::Value, String> {
    engine::ms_reset_skin(licensed_token(&account_id)?).await
}

#[derive(serde::Serialize)]
pub struct SessionStatus {
    pub copper: bool,
    pub accounts: std::collections::HashMap<String, bool>,
}

/// The only session fact the webview gets: which sessions are stored.
#[tauri::command(async)]
pub fn session_status(account_ids: Vec<String>) -> SessionStatus {
    let (copper, accounts) = engine::session_presence(&account_ids);
    SessionStatus { copper, accounts }
}

#[tauri::command]
pub async fn copper_login_poll(device_code: String) -> Result<serde_json::Value, String> {
    engine::copper_login_poll(device_code).await
}

#[tauri::command(async)]
pub fn copper_logout() -> Result<(), String> {
    engine::copper_forget_session()
}

#[tauri::command]
pub async fn copper_api(path: String, method: String, body: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    if !engine::webview_path_allowed(&path) {
        return Err("bad path".into());
    }
    engine::copper_api_auth(path, method, body).await
}

#[tauri::command(async)]
pub fn set_local_skin(skin: Option<String>, cape: Option<String>, slim: bool) -> Result<(), String> {
    engine::set_local_skin(skin, cape, slim)
}

/// Why the applied skin is not in the game. The webview names the account it
/// shows, never a URL: the address of our own API is the core's to know.
#[tauri::command]
pub async fn skin_diagnose(nick: String, online: bool) -> serde_json::Value {
    engine::skin_diagnose(&nick, online).await
}

#[tauri::command(async)]
pub fn list_textures(kind: String) -> Result<Vec<engine::TextureEntry>, String> {
    engine::list_textures(&kind)
}

#[tauri::command(async)]
pub fn save_texture(kind: String, name: String, data: String, slim: bool) -> Result<Vec<engine::TextureEntry>, String> {
    engine::save_texture(&kind, &name, &data, slim)
}

#[tauri::command]
pub async fn fetch_texture(url: String) -> Result<String, String> {
    engine::fetch_texture(url).await
}

#[tauri::command]
pub async fn export_png(name: String, data: String) -> Result<Option<String>, String> {
    let bytes = engine::png_bytes(&data)?;
    let suggested = engine::file_stem(&name) + ".png";
    let dest = engine::save_file(engine::dialog().set_file_name(&suggested).set_title("Куда сохранить")).await;
    let Some(dest) = dest else { return Ok(None) };

    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    Ok(Some(dest.to_string_lossy().to_string()))
}

#[tauri::command(async)]
pub fn delete_texture(kind: String, file: String) -> Result<Vec<engine::TextureEntry>, String> {
    engine::delete_texture(&kind, &file)
}

#[tauri::command(async)]
pub fn set_texture_slim(kind: String, file: String, slim: bool, manual: bool) -> Result<Vec<engine::TextureEntry>, String> {
    engine::set_texture_slim(&kind, &file, slim, manual)
}

#[tauri::command(async)]
pub fn rename_texture(kind: String, file: String, name: String) -> Result<Vec<engine::TextureEntry>, String> {
    engine::rename_texture(&kind, &file, &name)
}

#[tauri::command]
pub async fn head_avatar(nick: String, size: Option<u32>) -> Result<String, String> {
    engine::head_avatar(nick, size).await
}

/// Read only a small PNG explicitly selected by the user through native file drop.
#[tauri::command(async)]
pub fn read_skin_png(path: String) -> Result<String, String> {
    use base64::Engine as _;
    use std::io::Read;
    let path = std::path::PathBuf::from(path);
    if !path.extension().map(|e|e.eq_ignore_ascii_case("png")).unwrap_or(false) { return Err("Нужен файл PNG.".into()); }
    let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    if file.metadata().map_err(|e|e.to_string())?.len() > 1_048_576 { return Err("PNG больше 1 МБ.".into()); }
    let mut bytes = Vec::new(); file.take(1_048_577).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
    if bytes.len() > 1_048_576 || !bytes.starts_with(&[137,80,78,71,13,10,26,10]) { return Err("Некорректный PNG.".into()); }
    if bytes.len() < 24 { return Err("Некорректный PNG.".into()); }
    let width = u32::from_be_bytes(bytes[16..20].try_into().unwrap());
    let height = u32::from_be_bytes(bytes[20..24].try_into().unwrap());
    if width != 64 || ![32,64].contains(&height) { return Err("Нужен PNG размером 64×64 или 64×32.".into()); }
    Ok(format!("data:image/png;base64,{}",base64::engine::general_purpose::STANDARD.encode(bytes)))
}
