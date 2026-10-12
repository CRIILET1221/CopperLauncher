param([switch]$RepairInstalled)
$ErrorActionPreference='Stop'
$project=$PSScriptRoot
$launcher=Join-Path (Split-Path $project) 'copper-launcher'
$cli=Join-Path $launcher 'node_modules/@tauri-apps/cli/tauri.js'
if(!(Test-Path -LiteralPath $cli)){throw 'Сначала выполните bun install в папке copper-launcher.'}
Copy-Item -LiteralPath "$launcher/public/copper-app-icon.png" -Destination "$project/ui" -Force
Copy-Item -LiteralPath "$launcher/public/fonts/Geist-Variable.woff2" -Destination "$project/ui/fonts" -Force
Copy-Item -LiteralPath "$launcher/src-tauri/icons/icon.ico","$launcher/src-tauri/icons/icon.png" -Destination "$project/src-tauri/icons" -Force
Push-Location $project
try { & node $cli build --no-bundle; if($LASTEXITCODE -ne 0){throw 'Сборка деинсталлятора завершилась ошибкой.'} } finally {Pop-Location}
$exe=Join-Path $project 'src-tauri/target/release/copper-uninstall.exe'
if(!(Test-Path -LiteralPath $exe)){throw 'Нет готового Uninstall.exe.'}
Copy-Item -LiteralPath $exe -Destination (Join-Path (Split-Path $project) 'Uninstall.exe') -Force
if($RepairInstalled){
  $key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CopperLauncher'
  if(!(Test-Path -LiteralPath $key)){throw 'Copper не зарегистрирован в Windows.'}
  $registered=(Get-ItemProperty -LiteralPath $key).InstallLocation
  if([string]::IsNullOrWhiteSpace($registered) -or ![IO.Path]::IsPathRooted($registered)){throw 'Некорректная папка установки.'}
  $root=[IO.Path]::GetFullPath($registered).TrimEnd('\')
  if($root.StartsWith('\\') -or $root -eq [IO.Path]::GetPathRoot($root).TrimEnd('\')){throw 'Некорректная папка установки.'}
  $ancestor=$root
  while($ancestor){if((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Папка установки содержит ссылку или junction.'};$ancestor=[IO.Path]::GetDirectoryName($ancestor)}
  $manifest=Join-Path $root 'installed-files.json'
  if((Get-Item -LiteralPath $manifest -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Список файлов является ссылкой.'}
  $names=Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
  $allowed=@('Copper.exe','Uninstall.exe','LICENSE','NOTICE','THIRD-PARTY.md','TRADEMARK.md','uninstall.ps1','shortcuts.json','installed-files.json')
  foreach($name in $names){if($name -isnot [string] -or $name -notin $allowed){throw 'Некорректный список файлов.'}}
  if('Copper.exe' -notin $names){throw 'В списке файлов отсутствует Copper.exe.'}
  $target=Join-Path $root 'Uninstall.exe'
  if(Test-Path -LiteralPath $target){$item=Get-Item -LiteralPath $target -Force;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Вместо Uninstall.exe найдена папка или ссылка.'}}
  Copy-Item -LiteralPath $exe -Destination $target -Force
  $names=@($names | ForEach-Object {$_})
  if('Uninstall.exe' -notin $names){$names+='Uninstall.exe'}
  [IO.File]::WriteAllText($manifest,(ConvertTo-Json -InputObject $names),[Text.UTF8Encoding]::new($false))
  New-ItemProperty -LiteralPath $key -Name UninstallString -Value ('"'+$target+'"') -Force | Out-Null
  Write-Host "Деинсталлятор установлен: $target"
}
Write-Host 'Готово: outputs/Uninstall.exe. Запускайте его из установленной папки Copper.'
