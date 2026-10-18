//! Обновление самого лаунчера через GitHub Releases.
//!
//! Ядро спрашивает только api.github.com (описание релиза) и github.com
//! (файлы релиза; GitHub отдаёт их редиректом со своего CDN). Никаких
//! счётчиков и своих серверов.
//!
//! Целостность: установщик качается, только если для Copper-Setup.exe известна
//! sha256. Источников три, и все найденные должны совпасть:
//! 1. поле `digest` ассета — GitHub считает его сам при загрузке файла;
//! 2. файл SHA256SUMS в том же релизе (его пишет build.ps1);
//! 3. строка `<sha256>  Copper-Setup.exe` в описании релиза.
//! Без хеша или при расхождении обновление не ставится. Это защита от битой или
//! подменённой по дороге загрузки; подпись автора (minisign/Authenticode) —
//! отдельный шаг, пока сборки не подписаны.
//!
//! Установка — без окна: Copper-Setup.exe --silent-update обновляет файлы в
//! папке установленной копии (путь из записи в реестре) и перезапускает лаунчер.

use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

use super::http::{client, net_err, read_capped, sha256_hex, download_checked_progress, Sum, JSON_MAX_BYTES};

const REPO: &str = "CRIILET1221/CopperLauncher";
const SETUP_ASSET: &str = "Copper-Setup.exe";
const SUMS_ASSET: &str = "SHA256SUMS";
/// Установщик весит десятки мегабайт; всё, что больше, — не наш файл.
const SETUP_MAX_BYTES: u64 = 512 * 1024 * 1024;
const SUMS_MAX_BYTES: usize = 64 * 1024;
const CHECK_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LauncherUpdate {
    pub version: String,
    pub notes: String,
    /// Страница релиза: туда ведёт «скачать вручную», если поставить не вышло.
    pub page: String,
    pub url: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StagedUpdate {
    pub version: String,
    pub path: String,
}

/// Проверенный установщик: запускать можно только его, путь из интерфейса не берётся.
static STAGED: Mutex<Option<(PathBuf, String, String)>> = Mutex::new(None);

pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// «v2.0.1» → 2.0.1. Тег, который не читается как semver, обновлением не считается.
pub(crate) fn parse_tag(tag: &str) -> Option<semver::Version> {
    let t = tag.trim();
    let t = t.strip_prefix('v').or_else(|| t.strip_prefix('V')).unwrap_or(t);
    semver::Version::parse(t).ok()
}

pub(crate) fn is_newer(tag: &str, current: &str) -> bool {
    match (parse_tag(tag), parse_tag(current)) {
        (Some(remote), Some(local)) => remote > local,
        _ => false,
    }
}

/// Строки вида `<sha256>  Copper-Setup.exe` (формат sha256sum, звёздочка
/// бинарного режима и обратные кавычки markdown допускаются).
pub(crate) fn sha_from_sums(text: &str, name: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let line = line.trim().trim_matches('`');
        let mut parts = line.split_whitespace();
        let hash = parts.next()?.trim_matches('`');
        let file = parts.next()?.trim_matches('`').trim_start_matches('*');
        let file = file.rsplit(['/', '\\']).next().unwrap_or(file);
        let ok = hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit());
        (ok && file.eq_ignore_ascii_case(name)).then(|| hash.to_ascii_lowercase())
    })
}

fn digest_sha(asset: &Value) -> Option<String> {
    let d = asset.get("digest")?.as_str()?;
    let hex = d.strip_prefix("sha256:")?;
    (hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit())).then(|| hex.to_ascii_lowercase())
}

/// Все найденные хеши обязаны совпасть; ни одного — ставить нельзя.
pub(crate) fn agree(found: &[String]) -> Result<String, String> {
    let first = found.first().ok_or("в релизе нет контрольной суммы установщика (SHA256SUMS)")?;
    if found.iter().any(|h| h != first) {
        // Обычно это значит, что файлы релиза как раз перезаливают: SHA256SUMS ещё старый.
        return Err("контрольные суммы установщика в релизе не совпадают — возможно, релиз сейчас обновляют, попробуй через несколько минут".into());
    }
    Ok(first.clone())
}

fn find_asset<'a>(release: &'a Value, name: &str) -> Option<&'a Value> {
    release
        .get("assets")?
        .as_array()?
        .iter()
        .find(|a| a.get("name").and_then(Value::as_str).is_some_and(|n| n.eq_ignore_ascii_case(name)))
}

/// Скачивать разрешено только из релизов своего репозитория.
fn own_download(url: &str) -> bool {
    url.starts_with(&format!("https://github.com/{}/releases/download/", REPO))
}

async fn get(url: &str, max: usize) -> Result<Vec<u8>, String> {
    let resp = client()
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .timeout(CHECK_TIMEOUT)
        .send()
        .await
        .map_err(|e| net_err(&e))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("GitHub ответил {}", status.as_u16()));
    }
    read_capped(resp, max).await
}

async fn get_json(url: &str) -> Result<Value, String> {
    let body = get(url, JSON_MAX_BYTES).await?;
    serde_json::from_slice(&body).map_err(|e| format!("непонятный ответ GitHub: {}", e))
}

/// Свежий релиз: обычный — /releases/latest; с тестовыми версиями — самый
/// новый из последних, включая prerelease.
async fn newest_release(beta: bool) -> Result<Option<Value>, String> {
    if !beta {
        return match get_json(&format!("https://api.github.com/repos/{}/releases/latest", REPO)).await {
            Ok(v) => Ok(Some(v)),
            Err(e) if e.contains(" 404") => Ok(None),
            Err(e) => Err(e),
        };
    }
    let list = get_json(&format!("https://api.github.com/repos/{}/releases?per_page=15", REPO)).await?;
    Ok(list
        .as_array()
        .into_iter()
        .flatten()
        .filter(|r| !r.get("draft").and_then(Value::as_bool).unwrap_or(false))
        .filter_map(|r| Some((parse_tag(r.get("tag_name")?.as_str()?)?, r)))
        .max_by(|a, b| a.0.cmp(&b.0))
        .map(|(_, r)| r.clone()))
}

/// None — новее нет (или релизов нет вовсе).
pub async fn update_check(beta: bool) -> Result<Option<LauncherUpdate>, String> {
    let Some(release) = newest_release(beta).await? else { return Ok(None) };
    let tag = release.get("tag_name").and_then(Value::as_str).unwrap_or_default();
    if !is_newer(tag, current_version()) {
        return Ok(None);
    }
    let version = parse_tag(tag).map(|v| v.to_string()).unwrap_or_default();
    let notes = release.get("body").and_then(Value::as_str).unwrap_or_default().to_string();
    let page = release.get("html_url").and_then(Value::as_str).unwrap_or_default().to_string();
    let page = if page.starts_with(&format!("https://github.com/{}/", REPO)) {
        page
    } else {
        format!("https://github.com/{}/releases/latest", REPO)
    };
    let asset = find_asset(&release, SETUP_ASSET).ok_or_else(|| format!("в релизе {} нет {}", version, SETUP_ASSET))?;
    let url = asset.get("browser_download_url").and_then(Value::as_str).unwrap_or_default().to_string();
    if !own_download(&url) {
        return Err("установщик лежит не в релизах Copper Launcher".into());
    }
    let size = asset.get("size").and_then(Value::as_u64).unwrap_or(0);
    if size == 0 || size > SETUP_MAX_BYTES {
        return Err("у установщика в релизе странный размер".into());
    }

    let mut found: Vec<String> = Vec::new();
    found.extend(digest_sha(asset));
    if let Some(sums) = find_asset(&release, SUMS_ASSET) {
        let sums_url = sums.get("browser_download_url").and_then(Value::as_str).unwrap_or_default();
        if own_download(sums_url) {
            let text = get(sums_url, SUMS_MAX_BYTES).await?;
            found.extend(sha_from_sums(&String::from_utf8_lossy(&text), SETUP_ASSET));
        }
    }
    found.extend(sha_from_sums(&notes, SETUP_ASSET));
    let sha256 = agree(&found)?;

    Ok(Some(LauncherUpdate { version, notes, page, url, size, sha256 }))
}

fn updates_dir() -> PathBuf {
    super::paths::data_dir().join("updates")
}

/// Качает установщик в папку данных и сверяет размер и sha256. Ход загрузки —
/// событием `launcher-update-progress` (0..100).
pub async fn update_stage(app: &AppHandle, beta: bool) -> Result<StagedUpdate, String> {
    if !cfg!(windows) {
        return Err("автообновление пока есть только для Windows — скачай новую версию со страницы релиза".into());
    }
    let upd = update_check(beta).await?.ok_or("новой версии нет")?;
    let dir = updates_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("папка обновлений: {}", e))?;
    let dest = dir.join(format!("Copper-Setup-{}.exe", upd.version));
    // Старые установщики больше не нужны.
    if let Ok(rd) = std::fs::read_dir(&dir) {
        for e in rd.flatten() {
            if e.path() != dest {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
    let last = std::sync::atomic::AtomicU64::new(u64::MAX);
    let on = |got: u64, total: Option<u64>| {
        let total = total.unwrap_or(upd.size).max(1);
        let pct = (got.saturating_mul(100) / total).min(100);
        if last.swap(pct, std::sync::atomic::Ordering::Relaxed) != pct {
            let _ = app.emit("launcher-update-progress", pct);
        }
    };
    download_checked_progress(&upd.url, &dest, Some(Sum::Sha256(&upd.sha256)), Some(upd.size), None, &on).await?;
    *STAGED.lock().unwrap_or_else(|e| e.into_inner()) = Some((dest.clone(), upd.sha256.clone(), upd.version.clone()));
    Ok(StagedUpdate { version: upd.version, path: dest.to_string_lossy().into_owned() })
}

/// Перед запуском хеш сверяется ещё раз: файл лежит в папке пользователя.
/// Лаунчер после этого сразу закрывается, чтобы установщик мог заменить Copper.exe.
pub fn update_run() -> Result<StagedUpdate, String> {
    let (path, sha, version) = STAGED
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .ok_or("установщик ещё не скачан")?;
    let bytes = std::fs::read(&path).map_err(|e| format!("установщик пропал: {}", e))?;
    if sha256_hex(&bytes) != sha {
        let _ = std::fs::remove_file(&path);
        return Err("установщик изменился после проверки — скачай обновление заново".into());
    }
    // --silent-update: установщик без окна ждёт выхода лаунчера, заменяет файлы
    // в той же папке и сам запускает новую версию. Окно он покажет, только если
    // обновить не вышло.
    std::process::Command::new(&path)
        .arg("--silent-update")
        .current_dir(updates_dir())
        .spawn()
        .map_err(|e| format!("установщик не запустился: {}", e))?;
    Ok(StagedUpdate { version, path: path.to_string_lossy().into_owned() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_tags_win_and_equal_or_older_do_not() {
        assert!(is_newer("v2.0.1", "2.0.0"));
        assert!(is_newer("2.1.0", "2.0.9"));
        assert!(is_newer("v10.0.0", "9.9.9"));
        assert!(is_newer("V3.0.0", "2.99.99"));
        assert!(!is_newer("v2.0.0", "2.0.0"));
        assert!(!is_newer("v1.9.9", "2.0.0"));
    }

    #[test]
    fn prerelease_sorts_below_its_release() {
        assert!(is_newer("v2.1.0-beta.1", "2.0.0"));
        assert!(!is_newer("v2.0.0-beta.1", "2.0.0"));
        assert!(is_newer("v2.0.0", "2.0.0-beta.2"));
        assert!(is_newer("v2.0.0-beta.10", "2.0.0-beta.2"));
    }

    #[test]
    fn unreadable_tags_are_never_updates() {
        assert!(!is_newer("latest", "2.0.0"));
        assert!(!is_newer("v2.0", "2.0.0"));
        assert!(!is_newer("", "2.0.0"));
        assert!(!is_newer("v2.0.1", "garbage"));
    }

    #[test]
    fn running_version_parses() {
        assert!(parse_tag(current_version()).is_some());
    }

    const H: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    #[test]
    fn sums_file_lines_are_read() {
        let text = format!("{}  Other.zip\n{}  Copper-Setup.exe\n", "f".repeat(64), H.to_uppercase());
        assert_eq!(sha_from_sums(&text, SETUP_ASSET).as_deref(), Some(H));
        assert_eq!(sha_from_sums(&format!("{} *outputs/Copper-Setup.exe", H), SETUP_ASSET).as_deref(), Some(H));
        assert_eq!(sha_from_sums(&format!("`{}  Copper-Setup.exe`", H), SETUP_ASSET).as_deref(), Some(H));
        assert_eq!(sha_from_sums("abc  Copper-Setup.exe", SETUP_ASSET), None);
        assert_eq!(sha_from_sums(&format!("{}  Copper-Setup.exe.old", H), SETUP_ASSET), None);
    }

    #[test]
    fn hashes_must_exist_and_agree() {
        assert!(agree(&[]).is_err());
        assert_eq!(agree(&[H.into(), H.into()]).unwrap(), H);
        assert!(agree(&[H.into(), "f".repeat(64)]).is_err());
    }

    #[test]
    fn asset_digest_is_read() {
        let a = serde_json::json!({ "digest": format!("sha256:{}", H) });
        assert_eq!(digest_sha(&a).as_deref(), Some(H));
        assert_eq!(digest_sha(&serde_json::json!({ "digest": null })), None);
    }

    #[test]
    fn only_own_release_files_are_downloaded() {
        assert!(own_download("https://github.com/CRIILET1221/CopperLauncher/releases/download/v2.0.1/Copper-Setup.exe"));
        assert!(!own_download("https://github.com/someone/else/releases/download/v2.0.1/Copper-Setup.exe"));
        assert!(!own_download("http://github.com/CRIILET1221/CopperLauncher/releases/download/v2.0.1/Copper-Setup.exe"));
    }
}
