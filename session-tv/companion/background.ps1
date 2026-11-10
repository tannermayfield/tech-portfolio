$ErrorActionPreference = 'Stop'
$sessionTvLogDirectory = Join-Path $env:LOCALAPPDATA 'SessionTV-Companion'
New-Item -ItemType Directory -Force -Path $sessionTvLogDirectory | Out-Null
$sessionTvMutex = New-Object System.Threading.Mutex($false, 'Local\SessionTVCompanion')
if (!$sessionTvMutex.WaitOne(0)) { exit }
try {
    while ($true) {
        # An existing foreground companion can finish before this helper takes over.
        $sessionTvConnection = Get-NetTCPConnection -LocalPort 4319 -State Listen -ErrorAction SilentlyContinue
        if (!$sessionTvConnection) {
            try { & (Join-Path $PSScriptRoot 'start.ps1') -Background *> (Join-Path $sessionTvLogDirectory 'companion.log') }
            catch { 'Companion startup failed. Check saved settings and restart the helper.' | Set-Content (Join-Path $sessionTvLogDirectory 'companion.log') }
        }
        Start-Sleep -Seconds 15
    }
} finally { $sessionTvMutex.ReleaseMutex(); $sessionTvMutex.Dispose() }
