use crate::engine::*;
use serde_json::Value;

const CSL_JAR: &str = "CustomSkinLoader.jar";
const CSL_OPTOUT: &str = ".copper-skip";

/// Records an opt-out so the mod is not reinstalled after it crashed the game.
pub fn drop_custom_skin_loader(profile: &str) -> bool {
    let jar = profile_dir(profile).join("mods").join(CSL_JAR);
    if !jar.exists() {
        return false;
    }
    let removed = std::fs::remove_file(&jar).is_ok();
    if removed {
        opt_out(profile, b"crash");
    }
    removed
}

/// The single place that turns the injected mod off: the file marker survives a
/// settings file rewritten by an older build, the setting is what the build
/// screen shows, and the install marker must go so a later launch does not read
/// "installed but missing" and opt out a second time.
fn opt_out(profile: &str, why: &[u8]) {
    let cfg = profile_dir(profile).join("CustomSkinLoader");
    let _ = std::fs::create_dir_all(&cfg);
    let _ = std::fs::write(cfg.join(CSL_OPTOUT), why);
    let mut patch = serde_json::Map::new();
    patch.insert("skinMod".into(), Value::String("off".into()));
    patch.insert("skinModInstalled".into(), Value::Bool(false));
    merge_settings(profile, patch);
}

pub(crate) fn profile_settings(profile: &str) -> Value {
    std::fs::read(profile_dir(profile).join("copper-settings.json")).ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or(Value::Null)
}

fn mark_installed(profile: &str, installed: bool) {
    let mut patch = serde_json::Map::new();
    patch.insert("skinModInstalled".into(), Value::Bool(installed));
    merge_settings(profile, patch);
}

/// The file name the launcher gives its own copy, so the mods list can tell
/// removing it apart from removing a mod the build brought itself.
pub fn is_injected_skin_mod(file: &str) -> bool { file.eq_ignore_ascii_case(CSL_JAR) }

/// Called when a pack install wipes `mods/`: the jar it removed was not taken
/// out by the player, so the next launch must not read that as an opt-out.
pub fn forget_skin_mod_install(profile: &str) {
    mark_installed(profile, false);
}

/// The player took our jar out of `mods/` through the launcher. Every earlier
/// version put it straight back on the next launch, which is how a build that
/// the mod does not fit kept crashing after the player had already fixed it.
pub fn note_skin_mod_removed(profile: &str) {
    opt_out(profile, b"removed");
}

/// Why the mod is off for this build, as the marker records it: `crash` and
/// `removed` are decisions the launcher made on its own, and a player reading
/// only "выключен" has no way to tell those from a switch they flipped
/// themselves.
pub fn skin_mod_off_reason(profile: &str) -> Option<String> {
    std::fs::read(profile_dir(profile).join("CustomSkinLoader").join(CSL_OPTOUT))
        .ok()
        .map(|b| String::from_utf8_lossy(&b).trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Retire the launcher-managed skin jar without deleting user files.
pub fn retire_launcher_skin_mod(profile: &str) -> Result<(), String> {
    if !profile_settings(profile)["skinModInstalled"].as_bool().unwrap_or(false) { return Ok(()) }
    let dir = profile_dir(profile);
    let jar = dir.join("mods").join(CSL_JAR);
    if jar.exists() {
        let backup = dir.join("launcher-removed-mods");
        std::fs::create_dir_all(&backup).map_err(|e| e.to_string())?;
        let mut target = backup.join(CSL_JAR);
        let mut index = 1u32;
        while target.exists() { target = backup.join(format!("CustomSkinLoader.{}.jar", index)); index += 1; }
        std::fs::rename(&jar, target).map_err(|e| format!("Не удалось убрать мод лаунчера: {}", e))?;
    }
    mark_installed(profile, false);
    Ok(())
}
