# Copper Launcher source

The launcher frontend and Tauri backend for Copper. Read the [repository README](../README.md) for features, downloads and complete Windows build instructions.

From this folder:

```powershell
bun install
bun run tauri build
```

To build the custom installer after compiling the launcher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ..\copper-installer\build.ps1 -UseExistingLauncher
```

License: GPL-3.0-only. See [LICENSE](LICENSE), [NOTICE](NOTICE) and the repository [licensing summary](../LICENSING.md).
