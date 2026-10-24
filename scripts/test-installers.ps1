param([ValidateSet('x64','x86')][string]$Architecture)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$version=(Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$existing=@(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -like 'Untrace*')
if($existing.Count){throw 'An Untrace installation already exists. Run installer verification in a clean Windows account.'}
$installer=Join-Path $root "release/$Architecture/Untrace-Desktop-$version-setup-$Architecture.exe"
$target=Join-Path ([IO.Path]::GetTempPath()) ('Untrace-install-check-'+$Architecture+'-'+[guid]::NewGuid().ToString('N'))
$profile=Join-Path $env:APPDATA 'Untrace Desktop'
New-Item -ItemType Directory -Path $profile -Force | Out-Null
$sentinel=Join-Path $profile ('.install-check-'+[guid]::NewGuid().ToString('N'))
Set-Content -LiteralPath $sentinel -Value 'preserve-settings'
Push-Location $root
try {
  $process=Start-Process -FilePath $installer -ArgumentList "/S /currentuser /D=$target" -PassThru -Wait -WindowStyle Hidden
  if($process.ExitCode -ne 0){throw "Installer failed: $($process.ExitCode)"}
  $exe=Join-Path $target 'Untrace Desktop.exe'
  if(-not (Test-Path -LiteralPath $exe)){throw 'Installed executable is missing'}
  $arch=if($Architecture -eq 'x86'){'ia32'}else{'x64'}
  node scripts/smoke-installed.mjs $exe $arch
  if($LASTEXITCODE -ne 0){throw 'Installed smoke test failed'}
  $uninstaller=Get-ChildItem -LiteralPath $target -Filter 'Uninstall*.exe' | Select-Object -First 1
  if(-not $uninstaller){throw 'Uninstaller is missing'}
  $process=Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S /currentuser' -PassThru -Wait -WindowStyle Hidden
  if($process.ExitCode -ne 0){throw "Uninstaller failed: $($process.ExitCode)"}
  for($attempt=0;$attempt -lt 30 -and (Test-Path -LiteralPath $exe);$attempt++){Start-Sleep -Milliseconds 500}
  if(Test-Path -LiteralPath $exe){throw 'Uninstall did not remove the installed executable'}
  if((Get-Content -LiteralPath $sentinel -Raw).Trim() -ne 'preserve-settings'){throw 'Uninstall removed settings'}
  $left=@(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -like 'Untrace*')
  if($left.Count){throw 'Uninstall registration remains'}
  Write-Output "PASS: $Architecture install, installed startup, uninstall, and settings preservation."
} finally {
  Pop-Location
  if(Test-Path -LiteralPath $sentinel){Remove-Item -LiteralPath $sentinel}
}
