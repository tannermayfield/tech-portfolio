param([switch]$Configure, [switch]$Background)
$ErrorActionPreference = 'Stop'
$sessionTvConfigDirectory = Join-Path $env:LOCALAPPDATA 'SessionTV-Companion'
$sessionTvConfigFile = Join-Path $sessionTvConfigDirectory 'settings.json'
if ($Background -and !(Test-Path -LiteralPath $sessionTvConfigFile)) { throw 'Complete companion setup before enabling background startup.' }
if ($Configure -or !(Test-Path -LiteralPath $sessionTvConfigFile)) {
    New-Item -ItemType Directory -Path $sessionTvConfigDirectory -Force | Out-Null
    $sessionTvOwner = (Read-Host 'Paste your Supabase User UID, then press Enter').Trim()
    $sessionTvParsedOwner = [guid]::Empty
    if (![guid]::TryParse($sessionTvOwner, [ref]$sessionTvParsedOwner)) { throw 'Enter the User UID from Supabase Authentication > Users.' }
    $sessionTvFolders = @()
    Write-Host 'Enter one project folder at a time. Press Enter on an empty line when finished.'
    do {
        $sessionTvFolder = (Read-Host 'Project folder').Trim().Trim('"')
        if ($sessionTvFolder) {
            if (!(Test-Path -LiteralPath $sessionTvFolder -PathType Container)) { Write-Host 'Folder does not exist. Try again.'; continue }
            $sessionTvFolders += (Resolve-Path -LiteralPath $sessionTvFolder).Path
        }
    } while ($sessionTvFolder)
    if (!$sessionTvFolders.Count) { throw 'Add at least one project folder.' }
    @{ownerId=$sessionTvOwner;folders=@($sessionTvFolders | Select-Object -Unique)} | ConvertTo-Json | Set-Content -LiteralPath $sessionTvConfigFile -Encoding UTF8
}
$sessionTvConfig = Get-Content -LiteralPath $sessionTvConfigFile -Raw | ConvertFrom-Json
if (!$sessionTvConfig.deviceToken) {
    $sessionTvRandom = New-Object byte[] 32
    $sessionTvGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $sessionTvGenerator.GetBytes($sessionTvRandom)
    $sessionTvGenerator.Dispose()
    $sessionTvConfig | Add-Member -NotePropertyName deviceToken -NotePropertyValue ([Convert]::ToBase64String($sessionTvRandom))
    $sessionTvConfig | ConvertTo-Json | Set-Content -LiteralPath $sessionTvConfigFile -Encoding UTF8
}
$env:SESSIONTV_DEVICE_TOKEN = $sessionTvConfig.deviceToken
$env:SESSIONTV_OWNER_ID = $sessionTvConfig.ownerId
$env:SESSIONTV_WORKSPACES = ConvertTo-Json -Compress -InputObject @($sessionTvConfig.folders)
$env:SESSIONTV_CODEX_HOME = Join-Path $env:LOCALAPPDATA 'SessionTV-Codex'
$env:SUPABASE_URL = 'https://tghzpzecxwerhwxoljkd.supabase.co'
$env:SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5Mhqzdy9P1ezF5TsVEQpuA_Za7Q-dkR'
$sessionTvCodex = Get-Command codex.exe -ErrorAction SilentlyContinue
if ($sessionTvCodex) { $env:SESSIONTV_CODEX_BINARY = $sessionTvCodex.Source }
else {
    $sessionTvInstalled = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin') -Filter codex.exe -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (!$sessionTvInstalled) { throw 'Install Codex CLI before starting the companion.' }
    $env:SESSIONTV_CODEX_BINARY = $sessionTvInstalled.FullName
}
Write-Host ('Saved settings: ' + $sessionTvConfigFile)
Write-Host 'Keep this window open while using project chats. Pair using the code below.'
& node (Join-Path $PSScriptRoot 'server.mjs')
