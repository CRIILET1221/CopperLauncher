# Copper — current changes

The supplied copper block is used on the home screen and settings. The rounded graphite-green variant is used in the titlebar, executable, shortcuts and tray. The old SVG is removed; the home asset uses a versioned URL. Verified visually in the browser.

Removed: promotional/shop/Plus/wardrobe entry points, launcher music/sounds, notifications/cards, overlay chat, clip recording, cloud settings, FPS mod switches, mandatory upstream sign-in and automatic cosmetic mod installation. More than 400 unreachable frontend source/test files were removed; relevant tests for retained modules were preserved. Native overlay, voice client, obsolete hosting/AI command modules, self-healing updater and original update channel were removed.

The Rust package/library and internal identifiers are now Copper. Downloads from Mojang, Java vendors, loaders and Modrinth use direct routes. The old service API is disabled in both frontend and native URL resolution; original service addresses were removed from runtime code and CSP. Some dormant compatibility modules remain, with disabled service calls. This is not a claim of a complete security audit of every dependency.

Historical strings intentionally retained: encrypted vault derivation salt, fallback reader for millida-content.json, injected-jar filename detection, copyright/license notices. Removing these would lose saved-token compatibility or prevent retiring old injected jars. Microsoft and Ely OAuth application registrations also cannot be renamed as display text: configure COPPER_MS_CLIENT_ID and COPPER_ELY_CLIENT_ID with your own registrations before publishing. Their authentication uses the providers directly.

Checks: TypeScript, Vite production build, frontend_ready/Safari 13 gate, cargo check --release and cargo check --release --tests. The latter checks test compilation, not test execution. Native game launch, sign-in and a full installation have not been exercised after this pass.

Build the installer from copper-launcher:

```powershell
powershell -ExecutionPolicy Bypass -File ..\copper-installer\build.ps1
```

This rebuilds the launcher as copper-launcher.exe and packages it into outputs/Copper-Setup.exe. Do not reuse the previous millida-launcher.exe. -UseExistingLauncher rejects executables older than launcher source/assets.
