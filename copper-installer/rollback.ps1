$ErrorActionPreference='Stop'
$root=$env:COPPER_INSTALL_DIR
$exe=Join-Path $root 'Copper.exe'
$shell=New-Object -ComObject WScript.Shell
$record=Join-Path $root 'shortcuts.json'
if(Test-Path -LiteralPath $record){$shortcutPaths=Get-Content -LiteralPath $record -Raw | ConvertFrom-Json;foreach($p in $shortcutPaths){
  if((Split-Path $p) -in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs')) -and [IO.Path]::GetExtension($p) -eq '.lnk'){
    if(Test-Path -LiteralPath $p){if($shell.CreateShortcut($p).TargetPath -eq $exe){Remove-Item -LiteralPath $p}}
  }
}}
$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CopperLauncher'
if(Test-Path $key){if((Get-ItemProperty $key).InstallLocation -eq $root){Remove-Item -LiteralPath $key}}
