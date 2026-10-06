# Who may send CS2 console commands through JTs Hud Manager (action "telnet", see patch-telnet.ps1).
# Writes %APPDATA%\jts-hud\telnet-access.json; the manager reads it on every request (no restart).
#   telnet-access.ps1                     show the current settings
#   telnet-access.ps1 -Access lan         also other PCs of the local network
#   telnet-access.ps1 -Commands all       any console command, not only the camera ones
#   telnet-access.ps1 -NewToken           secret for outside tools (header X-Telnet-Token)
#   telnet-access.ps1 -Reset              back to the safe defaults (local + camera, no token)
param(
  [ValidateSet('local', 'lan', 'any')][string]$Access,
  [ValidateSet('camera', 'all')][string]$Commands,
  [switch]$NewToken,
  [switch]$NoToken,
  [switch]$Reset
)
$file = Join-Path $env:APPDATA 'jts-hud\telnet-access.json'
$cfg = [ordered]@{ access = 'local'; commands = 'camera'; token = '' }
if (-not $Reset -and (Test-Path $file)) {
  try {
    $old = Get-Content $file -Raw | ConvertFrom-Json
    foreach ($k in 'access', 'commands', 'token') { if ($old.$k) { $cfg[$k] = [string]$old.$k } }
  } catch { Write-Warning "$file is not valid JSON, starting from the defaults" }
}
$changed = $Reset -or $Access -or $Commands -or $NewToken -or $NoToken
if ($Access) { $cfg.access = $Access }
if ($Commands) { $cfg.commands = $Commands }
if ($NoToken) { $cfg.token = '' }
if ($NewToken) {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $cfg.token = [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
}
if ($changed) {
  New-Item -ItemType Directory -Force (Split-Path $file) | Out-Null
  [IO.File]::WriteAllText($file, ($cfg | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
}

Write-Host "File:     $file"
Write-Host "access:   $($cfg.access)   (local = this PC only, lan = + local network, any = from anywhere)"
Write-Host "commands: $($cfg.commands)   (camera = spectator commands only, all = any console command)"
Write-Host "token:    $(if ($cfg.token) { $cfg.token } else { '(none)' })"
if ($cfg.access -ne 'local') { Write-Warning 'Others can switch your CS2 camera. Do not open port 1349 (and the CS2 -netconport port) to the internet in the firewall/router.' }
if ($cfg.commands -eq 'all') { Write-Warning 'Allowed pages can run ANY CS2 console command (bind, exec, connect, quit...).' }
if ($cfg.access -eq 'any' -and $cfg.commands -eq 'all' -and -not $cfg.token) { Write-Warning 'Fully open: consider -NewToken and access local/lan instead.' }
