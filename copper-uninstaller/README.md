# Copper Uninstall

Separate Windows EXE with the Copper interface: confirmation, progress, retry after errors and completion. Rust removes a strictly allowed list of application files; Minecraft instances, worlds and accounts are preserved. Uses the recorded installation folder and verifies it against the current-user Windows registration. Refuses junctions, links and unexpected files. No recursive deletion.

Build from `copper-launcher`:

```powershell
powershell -ExecutionPolicy Bypass -File ..\copper-uninstaller\build.ps1
```

To replace the broken uninstaller of an existing registered Copper installation, without rebuilding the launcher:

```powershell
powershell -ExecutionPolicy Bypass -File ..\copper-uninstaller\build.ps1 -RepairInstalled
```

Output: `outputs/Uninstall.exe`. It must be installed in the Copper installation folder; launching the exported copy from outputs alone does not delete Copper. `-RepairInstalled` copies it into the registered folder, updates its file manifest and Windows uninstall command. It retains the old script until the new uninstaller removes it.

The installer build automatically compiles and embeds this project as `Uninstall.exe`. Windows Apps launches this EXE, not a `.ps1` file. The executable runs from a temporary copy to release the installed copy; a hidden Windows PowerShell helper removes its temporary copy after exit. Registry/shortcut operations use Windows PowerShell internally; file deletion and manifest validation run in Rust. No PowerShell uninstall script is installed with new installations.

Requires Microsoft Edge WebView2 Runtime. Unsigned. Validation: Rust compilation, four actual deletion/manifest tests, UI flow mocks (success/error/retry/finish), PowerShell 5.1 Windows entry tests and browser layout preview. Full install/uninstall integration must still be tested with the user's compiled EXEs.
