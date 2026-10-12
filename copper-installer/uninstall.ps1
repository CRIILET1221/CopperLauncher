$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework
try {
  $root=[IO.Path]::GetFullPath($PSScriptRoot)
  $key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CopperLauncher'
  if(!(Test-Path $key) -or (Get-ItemProperty $key).InstallLocation -ne $root){throw 'Папка не совпадает с зарегистрированной установкой Copper.'}
  $manifest=Join-Path $root 'installed-files.json'
  $files=Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
  foreach($name in $files){if($name -notin @('Copper.exe','LICENSE','NOTICE','THIRD-PARTY.md','TRADEMARK.md','uninstall.ps1','shortcuts.json')){throw 'Некорректный список файлов.'}}
  $shortcuts=@()
  $record=Join-Path $root 'shortcuts.json'
  if(Test-Path -LiteralPath $record){$shortcuts=Get-Content -LiteralPath $record -Raw | ConvertFrom-Json}
  $exe=Join-Path $root 'Copper.exe'
  foreach($p in (Get-Process -ErrorAction SilentlyContinue)){try{if($p.Path -eq $exe){throw 'Copper открыт. Закройте лаунчер и повторите удаление.'}}catch{if($_.Exception.Message -like 'Copper открыт*'){throw}}}
  $answer=[System.Windows.MessageBox]::Show('Удалить Copper Launcher? Сборки Minecraft и аккаунты останутся на диске.','Copper Launcher','YesNo','Question')
  if($answer -ne 'Yes'){exit}
  foreach($name in $files){if($name -eq 'uninstall.ps1'){continue};$p=Join-Path $root $name;if(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p -Force}}
  $shell=New-Object -ComObject WScript.Shell
  foreach($p in $shortcuts){if((Split-Path $p) -in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs')) -and [IO.Path]::GetExtension($p) -eq '.lnk'){if(Test-Path -LiteralPath $p){if($shell.CreateShortcut($p).TargetPath -eq $exe){Remove-Item -LiteralPath $p}}}}
  if(Test-Path -LiteralPath $manifest){Remove-Item -LiteralPath $manifest}
  Remove-Item -LiteralPath $key
  $self=Join-Path $root 'uninstall.ps1'
  if(Test-Path -LiteralPath $self){Remove-Item -LiteralPath $self -Force}
  if(Test-Path -LiteralPath $root){if(!(Get-ChildItem -LiteralPath $root -Force)){Remove-Item -LiteralPath $root}}
  [System.Windows.MessageBox]::Show('Copper удалён. Игровые данные сохранены.','Copper Launcher') | Out-Null
} catch { [System.Windows.MessageBox]::Show($_.Exception.Message,'Не удалось удалить Copper','OK','Error') | Out-Null; exit 1 }
