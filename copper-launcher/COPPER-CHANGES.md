# Copper — current changes

The supplied copper block is used on the home screen and settings. The rounded graphite-green variant is used in the titlebar, executable, shortcuts and tray. The old SVG is removed; the home asset uses a versioned URL. Verified visually in the browser.

Removed: promotional/shop/Plus/wardrobe entry points, launcher music/sounds, notifications/cards, overlay chat, clip recording, cloud settings, FPS mod switches, mandatory upstream sign-in and automatic cosmetic mod installation. More than 400 unreachable frontend source/test files were removed; relevant tests for retained modules were preserved. Native overlay, voice client, obsolete hosting/AI command modules, self-healing updater and original update channel were removed.

The Rust package/library and internal identifiers are now Copper. Downloads from Mojang, Java vendors, loaders and Modrinth use direct routes. The old service API is disabled in both frontend and native URL resolution; original service addresses were removed from runtime code and CSP. Some dormant compatibility modules remain, with disabled service calls. This is not a claim of a complete security audit of every dependency.

Historical strings intentionally retained: encrypted vault derivation salt, fallback reader for millida-content.json, injected-jar filename detection, copyright/license notices. Removing these would lose saved-token compatibility or prevent retiring old injected jars. Microsoft and Ely.by authentication require the maintainer to configure their own COPPER_MS_CLIENT_ID and COPPER_ELY_CLIENT_ID registrations. There are no legacy ID fallbacks. Authentication uses the providers directly when configured.

Checks: TypeScript, Vite production build, frontend_ready/Safari 13 gate, cargo check --release and cargo check --release --tests. The latter checks test compilation, not test execution. Native game launch, sign-in and a full installation have not been exercised after this pass.

Build the installer from copper-launcher:

```powershell
powershell -ExecutionPolicy Bypass -File ..\copper-installer\build.ps1
```

This rebuilds the launcher as copper-launcher.exe and packages it into outputs/Copper-Setup.exe. Do not reuse the previous millida-launcher.exe. -UseExistingLauncher rejects executables older than launcher source/assets.

## Distribution cleanup — 13 October 2026

Excluded upstream wallpapers/videos and 54 block PNGs were removed and replaced with original editable Copper SVG artwork. Legacy saved block paths migrate to the new symbols. Bundled music remains disabled.

Microsoft and Ely.by no longer have upstream OAuth client-ID fallbacks. New sign-in and token renewal require the maintainer to configure their own registrations. Without them, a clear error is returned before any OAuth request is sent. Existing release binaries are not changed by updating source files.

Font notices and collected third-party license texts are included in the distribution, and the uninstaller allows only the newly added license filenames as well as its existing manifest whitelist. This cleanup is not a blanket legal certification of all third-party material.

The copied instance-icon pack and additional legacy promotional/game/version imagery were also removed; existing instance paths resolve to original Copper symbols. Discord Rich Presence has no upstream application-ID fallback and stays disconnected unless COPPER_DISCORD_APP_ID is supplied at runtime. Its project link now points to Copper.

Validation for this cleanup: TypeScript + Vite production build and Safari 13/frontend-ready gate; Rust release checks for launcher, installer and uninstaller; 10 icon/editor tests, 4 real manifest/filesystem tests, and 4 checks of the actual OAuth-ID guard functions with absent and test configuration. Existing EXEs are not automatically rebuilt by these checks. Earlier releases were moved to drafts with assets retained. No support email is published at the maintainer's request.
