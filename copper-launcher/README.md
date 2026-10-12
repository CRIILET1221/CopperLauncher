# Copper Launcher

Independent modified fork of [Millida Launcher](https://github.com/millida/launcher), licensed GPL-3.0-only. Focus: local Minecraft instances, Microsoft/Ely/offline accounts and direct Modrinth catalog.

## Build

Requires Bun, Rust, Windows C++ Build Tools (x64/x86 MSVC + Windows SDK).

```powershell
bun install
bun run tauri build
```

For the custom Copper installer use the sibling copper-installer/build.ps1. Read COPPER-CHANGES.md for validation, compatibility notes and OAuth client configuration. Original notices remain in LICENSE, NOTICE, TRADEMARK.md and THIRD-PARTY.md.
