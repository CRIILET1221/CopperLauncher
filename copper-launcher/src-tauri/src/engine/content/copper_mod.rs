// Historical filenames are retained only to retire injected upstream jars.
use crate::engine::{profile_dir, load_profiles};
#[derive(serde::Serialize, Default, Clone)]
pub struct CopperModState {
    pub installed:String, pub available:String, pub version:String, pub loader:String,
    pub game_version:String, pub reason:String, pub enabled:bool, pub sha256:String,
}
pub(crate) fn is_copper_mod_file(name:&str)->bool {name.starts_with("millida-mod-") && (name.ends_with(".jar") || name.ends_with(".jar.disabled"))}
pub fn remove_copper_mod(profile:&str)->Result<(),String>{
    let mods=profile_dir(profile).join("mods");if !mods.is_dir(){return Ok(())}
    for entry in std::fs::read_dir(&mods).map_err(|e|e.to_string())? {
        let entry=entry.map_err(|e|e.to_string())?;
        if is_copper_mod_file(&entry.file_name().to_string_lossy()) && entry.file_type().map_err(|e|e.to_string())?.is_file(){
            std::fs::remove_file(entry.path()).map_err(|e|format!("Не удалось удалить устаревший мод: {e}. Закрой игру."))?;
        }
    }Ok(())
}
pub fn copper_mod_enabled()->bool{false}
pub fn set_copper_mod_enabled(on:bool)->Result<(),String>{if on{return Err("Автоматический мод лаунчера удалён".into())}for p in load_profiles(){remove_copper_mod(&p.name)?}Ok(())}
pub async fn copper_mod_state(_profile:String)->Result<CopperModState,String>{Ok(CopperModState{reason:"Мод лаунчера удалён".into(),..Default::default()})}
pub async fn copper_mod_install(_app:tauri::AppHandle,_profile:String)->Result<CopperModState,String>{Err("Автоматическая установка мода удалена".into())}
pub fn quarantine_copper_mod(_profile:&str,_jar:&str)->bool{false}
pub fn pvp_hud_default()->bool{false}
pub fn set_pvp_hud_default(_on:bool)->Result<(),String>{Err("Мод лаунчера удалён".into())}
