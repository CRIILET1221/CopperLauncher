param([switch]$UseExistingLauncher,[switch]$PrepareOnly)
$ErrorActionPreference='Stop'
$project=$PSScriptRoot
$launcher=Join-Path (Split-Path $project) 'copper-launcher'
Copy-Item -LiteralPath "$launcher/src/styles/copper-controls.css" -Destination "$project/ui/copper-controls.css" -Force
Copy-Item -LiteralPath "$launcher/public/copper-controls.js" -Destination "$project/ui/copper-controls.js" -Force
& bun (Join-Path $launcher 'scripts/generate-pixel-buttons.ts')
if($LASTEXITCODE -ne 0){throw 'Pixel icon generation failed.'}
$cli=Join-Path $launcher 'node_modules/@tauri-apps/cli/tauri.js'
Copy-Item -LiteralPath "$launcher/public/fonts/OFL.txt" -Destination "$project/ui/OFL.txt" -Force
Copy-Item -LiteralPath "$launcher/public/copper-app-icon.png" -Destination "$project/ui/startup-logo.png" -Force
if(!(Test-Path -LiteralPath $cli)){throw 'Сначала выполните bun install в папке copper-launcher.'}
if(!$UseExistingLauncher -and !$PrepareOnly){
  Push-Location $launcher
  try { & node $cli build --no-bundle; if($LASTEXITCODE -ne 0){throw 'Сборка лаунчера завершилась ошибкой.'} } finally {Pop-Location}
}
$exe=Join-Path $launcher 'src-tauri/target/release/copper-launcher.exe'
if($UseExistingLauncher -and (Test-Path -LiteralPath $exe)){
  $latest=Get-ChildItem -LiteralPath (Join-Path $launcher 'src'),(Join-Path $launcher 'public'),(Join-Path $launcher 'src-tauri/src'),(Join-Path $launcher 'src-tauri/icons') -File -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if($latest.LastWriteTime -gt (Get-Item -LiteralPath $exe).LastWriteTime){throw 'Лаунчер устарел. Запустите build.ps1 без -UseExistingLauncher.'}
}
if(!(Test-Path -LiteralPath $exe)){throw 'Нет готового лаунчера. Соберите copper-launcher.'}
$ui=Join-Path $project 'ui'
New-Item -ItemType Directory -Force -Path "$ui/fonts","$project/src-tauri/icons" | Out-Null
Copy-Item -LiteralPath "$launcher/public/copper-logo.png","$launcher/public/copper-app-icon.png" -Destination $ui -Force
Copy-Item -LiteralPath "$launcher/public/fonts/Geist-Variable.woff2" -Destination "$ui/fonts" -Force
Copy-Item -LiteralPath "$launcher/src-tauri/icons/icon.ico","$launcher/src-tauri/icons/icon.png" -Destination "$project/src-tauri/icons" -Force
$uninstaller=Join-Path (Split-Path $project) 'copper-uninstaller'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $uninstaller 'build.ps1')
if($LASTEXITCODE -ne 0){throw 'Сборка деинсталлятора завершилась ошибкой.'}
$uninstallExe=Join-Path $uninstaller 'src-tauri/target/release/copper-uninstall.exe'
if(!(Test-Path -LiteralPath $uninstallExe)){throw 'Нет готового Uninstall.exe.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$payload=Join-Path $project 'payload.zip'
if(Test-Path -LiteralPath $payload){Remove-Item -LiteralPath $payload}
$z=[IO.Compression.ZipFile]::Open($payload,'Create')
try {
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,$exe,'Copper.exe') | Out-Null
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,(Join-Path $launcher 'src-tauri/icons/icon.ico'),'Copper-C.ico') | Out-Null
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,$uninstallExe,'Uninstall.exe') | Out-Null
  foreach($name in @('LICENSE','NOTICE','THIRD-PARTY.md','TRADEMARK.md','THIRD-PARTY-LICENSES.txt')){
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,(Join-Path $launcher $name),$name) | Out-Null
  }
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,(Join-Path $launcher 'public/fonts/OFL.txt'),'OFL.txt') | Out-Null
} finally {$z.Dispose()}
if($PrepareOnly){Write-Host 'Пакет и ресурсы подготовлены.';exit}
Push-Location $project
try { & node $cli build --no-bundle; if($LASTEXITCODE -ne 0){throw 'Сборка установщика завершилась ошибкой.'} } finally {Pop-Location}
Copy-Item -LiteralPath "$project/src-tauri/target/release/copper-setup.exe" -Destination (Join-Path (Split-Path $project) 'Copper-Setup.exe') -Force
Write-Host 'Готово: outputs/Copper-Setup.exe'
