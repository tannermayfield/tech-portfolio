$ErrorActionPreference = 'Stop'
$sessionTvConfigFile = Join-Path $env:LOCALAPPDATA 'SessionTV-Companion\settings.json'
if (!(Test-Path -LiteralPath $sessionTvConfigFile)) { throw 'Run Start Session TV.cmd to save your settings first.' }
$sessionTvScript = Join-Path $PSScriptRoot 'background.ps1'
$sessionTvPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$sessionTvArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $sessionTvScript + '"'
New-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'SessionTVCompanion' -Value ('"' + $sessionTvPowerShell + '" ' + $sessionTvArguments) -PropertyType String -Force | Out-Null
Start-Process -FilePath $sessionTvPowerShell -ArgumentList $sessionTvArguments -WindowStyle Hidden
Write-Host 'Session TV companion now starts when you sign in to Windows.'
