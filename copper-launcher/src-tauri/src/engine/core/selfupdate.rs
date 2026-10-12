use serde::Serialize;
use std::path::PathBuf;
use tauri::AppHandle;
#[derive(Serialize, Clone)]
pub struct FallbackUpdate { pub version:String, pub notes:String, pub url:String, pub file:String, pub signature:String, pub source:String, pub mirror:Option<String> }
#[derive(Serialize, Clone)]
#[serde(rename_all="camelCase")]
pub struct FallbackInstall { pub version:String, pub path:String, pub started:bool }
pub(crate) fn beta_channel()->bool{false}
pub async fn fallback_check(_app:&AppHandle)->Result<Option<FallbackUpdate>,String>{Ok(None)}
pub async fn fallback_latest(_app:&AppHandle)->Result<Option<FallbackUpdate>,String>{Ok(None)}
pub async fn fallback_stage(_app:&AppHandle,_upd:&FallbackUpdate)->Result<PathBuf,String>{Err("Канал обновлений не настроен".into())}
pub async fn fallback_stage_latest(_app:&AppHandle)->Result<Option<FallbackInstall>,String>{Ok(None)}
pub fn fallback_run(_app:&AppHandle,_path:&str,_restart:bool)->Result<FallbackInstall,String>{Err("Канал обновлений не настроен".into())}
pub fn mark_frontend_ready(){}
