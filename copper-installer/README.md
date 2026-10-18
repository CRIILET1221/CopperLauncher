# Copper Setup

Custom Windows installer with the Copper interface. Installs for the current user without elevation; embeds the compiled launcher and license notices. Requires Microsoft Edge WebView2 Runtime, as does Copper itself.

From this folder in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

This builds Copper, the separate native uninstaller, then the installer. Output: `outputs/Copper-Setup.exe`.
To package an already compiled launcher, use `-UseExistingLauncher`.
`-PrepareOnly` builds the uninstaller and prepares resources/payload, using an existing compiled launcher.

Features: folder picker, per-user desktop/Start menu shortcuts, real extraction progress, launch after installation, Windows Apps uninstall registration. A new installation needs an empty folder. If Copper is already installed (found through its Windows Apps entry), Setup offers "Обновить" instead: it waits for the launcher to close, replaces the packaged files in the same folder (each with a .old backup, rolled back on any error), keeps shortcuts and updates the version in Windows Apps. `--update` starts that right away; `--silent-update` does it without a window and then starts the new launcher — this is how the launcher updates itself from GitHub Releases. The window only appears if the silent update fails. Game data in `io.copper.launcher` is preserved by uninstall. No telemetry or network downloads in the installer.

Uninstall uses the separate Copper Uninstall EXE with a matching custom interface. New installations contain no uninstall.ps1. See ../copper-uninstaller/README.md for the command to replace an existing broken uninstaller. The binary is unsigned. The preview HTML in the launcher remains a separate simulation.

Fixes: welcome screen, pressed-button animation, larger close button; owned async folder picker creates a Copper subfolder; existing shortcuts get a unique name and are tracked for uninstall. Rust checks and read-only preflight pass. End-to-end installation still requires testing the rebuilt EXE.

