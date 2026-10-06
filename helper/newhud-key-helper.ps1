# newHud key helper: lets the auto camera switch players on servers where CS2 telnet (-netconport) is closed
# (VAC-secured servers / GOTV without -insecure). The HUD sends { action: 'obsKey', data: { slot } } through
# JTs Hud Manager; this helper presses the number key of that observer slot (1..9, 0) in CS2.
# It presses ONLY when CS2 is the active window and the game data shows spectator mode (all players visible),
# so it never fires a weapon-slot key while you play. Run it on the observer PC next to the manager:
#   newhud-key-helper.cmd        (or: powershell -ExecutionPolicy Bypass -File newhud-key-helper.ps1)
# Start with Windows (hidden): install-autostart.cmd; remove: uninstall-autostart.cmd.
# Obeys the setting "Key helper" of the auto camera (config.observer.helper; off = it presses nothing).
param([int]$Port = 1349)
$ErrorActionPreference = 'Stop'

# one copy only (autostart + a manual start would press every key twice)
$mutex = New-Object Threading.Mutex($false, 'Local\newHudKeyHelper')
if (-not $mutex.WaitOne(0)) { Write-Host 'newHud key helper is already running'; exit 0 }

Add-Type -Namespace NewHud -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
'@

function Test-Cs2Active {
  $h = [NewHud.Win]::GetForegroundWindow(); $procId = 0
  [void][NewHud.Win]::GetWindowThreadProcessId($h, [ref]$procId)
  try { (Get-Process -Id $procId).ProcessName -eq 'cs2' } catch { $false }
}

# number keys by scan code (games read scan codes): 1..9 = 0x02..0x0A, 0 = 0x0B
function Send-Slot([int]$slot) {
  $vk = [byte](0x30 + $slot); $scan = [byte]$(if ($slot -eq 0) { 0x0B } else { 0x01 + $slot })
  [NewHud.Win]::keybd_event($vk, $scan, 0x0008, [UIntPtr]::Zero)          # KEYEVENTF_SCANCODE
  Start-Sleep -Milliseconds 40
  [NewHud.Win]::keybd_event($vk, $scan, 0x0008 -bor 0x0002, [UIntPtr]::Zero) # + KEYEVENTF_KEYUP
}

function Post-Action($action, $json) {
  try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:$Port/api/huds/newHud/action" -ContentType 'application/json' `
      -Body ('{"action":"' + $action + '","data":' + $json + '}') -TimeoutSec 3 | Out-Null
  } catch {}
}

$say = { param($s) Write-Host ((Get-Date -Format 'HH:mm:ss') + ' ' + $s) }

# the setting "Key helper" (auto camera): re-read every 5 s; unknown = on
$script:enabled = $true
function Update-Enabled {
  try {
    $c = Invoke-RestMethod -Uri "http://localhost:$Port/api/huds/newHud/config" -TimeoutSec 3
    $script:enabled = -not ($c.observer -and $c.observer.helper -eq $false)
  } catch {}
}
function Send-Beat { Post-Action 'obsHelper' ('{"alive":true,"enabled":' + $(if ($script:enabled) { 'true' } else { 'false' }) + '}') }& $say "newHud key helper: connecting to the manager on port $Port (Ctrl+C to stop)"

while ($true) {
  try {
    $ws = New-Object Net.WebSockets.ClientWebSocket; $ct = [Threading.CancellationToken]::None
    $ws.ConnectAsync([Uri]"ws://localhost:$Port/socket.io/?EIO=4&transport=websocket", $ct).Wait()
    $send = { param($s) $b = [Text.Encoding]::UTF8.GetBytes($s); $ws.SendAsync((New-Object ArraySegment[byte] (, $b)), 'Text', $true, $ct).Wait() }
    $buf = New-Object byte[] 1048576; $ms = New-Object IO.MemoryStream
    $spectating = $false; $beat = [DateTime]::MinValue
    & $say 'connected'
    while ($ws.State -eq 'Open') {
      # heartbeat for the HUD / control page: "helper is running"
      if (((Get-Date) - $beat).TotalSeconds -ge 5) { Update-Enabled; Send-Beat; $beat = Get-Date }
      $ms.SetLength(0)
      $t = $null
      do {
        $t = $ws.ReceiveAsync((New-Object ArraySegment[byte] (, $buf)), $ct)
        while (-not $t.Wait(1000)) { if (((Get-Date) - $beat).TotalSeconds -ge 5) { Update-Enabled; Send-Beat; $beat = Get-Date } }
        $ms.Write($buf, 0, $t.Result.Count)
      } while (-not $t.Result.EndOfMessage)
      $msg = [Text.Encoding]::UTF8.GetString($ms.ToArray())
      if ($msg.StartsWith('0')) { & $send '40'; continue }
      if ($msg -eq '2') { & $send '3'; continue }
      if ($msg.StartsWith('42["update"')) { $spectating = $msg.Contains('"allplayers"'); continue }
      if ($msg.StartsWith('42["hud_action"') -and $msg.Contains('"obsKey"')) {
        $m = [regex]::Match($msg, '"slot"\s*:\s*(\d+)')
        if (-not $m.Success) { continue }
        $slot = [int]$m.Groups[1].Value
        if ($slot -lt 0 -or $slot -gt 9) { continue }
        if (-not $script:enabled) { & $say "slot $slot skipped: the key helper is off in the settings"; continue }
        if (-not $spectating) { & $say "slot $slot skipped: not spectating"; continue }
        if (-not (Test-Cs2Active)) { & $say "slot $slot skipped: CS2 is not the active window"; Post-Action 'obsHelper' '{"alive":true,"skipped":"focus"}'; continue }
        Send-Slot $slot
        & $say "pressed $slot"
      }
    }
  } catch { & $say "connection lost: $($_.Exception.Message)" }
  & $say 'reconnecting in 3 s...'
  Start-Sleep 3
}
