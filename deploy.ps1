# Copies the HUD from this folder into the folder JTs Hud Manager reads (~/jthm-huds/newHud).
#   powershell -ExecutionPolicy Bypass -File deploy.ps1
#   ... -Dest <folder> -Clean   -> build a clean copy for the installer: no "Agents" section with the players
#                                  of this manager, no uploads (installer\build.ps1 uses it)
# The panel and the Hot keys window are deployed in English; the manager's EN / RU button translates them
# (with the rest of the manager) through manager-ru.json: panel\manager-ru.json + pairs built here from
# panel\en.json / panel\ru.json and panel\hotkeys.json. The manager reads panel.json only at startup.
param([string]$Dest = '', [switch]$Clean)

$src = $PSScriptRoot
$dst = if ($Dest) { $Dest } else { Join-Path $HOME 'jthm-huds\newHud' }
$utf8 = New-Object Text.UTF8Encoding $false
$readJson = { param($p) [IO.File]::ReadAllText((Join-Path $src $p), [Text.Encoding]::UTF8) | ConvertFrom-Json }

# new version stamp -> the open overlay reloads itself within ~3 s (js/main.js)
Set-Content -Path (Join-Path $src 'version.txt') -Value (Get-Date -Format 'yyyyMMddHHmmssfff') -Encoding ascii

# uploads = images added in the manager (sponsor logos) — never delete them
robocopy $src $dst /MIR /XD _test _unused _ref _publish _build installer uploads panel helper docs manager-patch /XF deploy.ps1 panel.json .gitignore README.md /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Error "robocopy failed ($LASTEXITCODE)"; exit 1 }
Copy-Item (Join-Path $src 'panel\en.json') (Join-Path $dst 'panel.json') -Force

# "Agents" section of the manager panel: for every player in the manager two selects (agent as CT / as T),
# values = official CS2 agents (icons\agents\agents.json). Stored in config.agents_panel as "<steamid>_CT" / "<steamid>_T"
# (the control page writes the same keys). Built from the manager's player list -> redeploy + restart after adding players.
$agentPairs = @()
if ($Clean) {
  # the agent names still get their Russian pairs (the control page's "Agents" tab is built by the HUD itself)
  foreach ($a in (& $readJson 'icons\agents\agents.json')) { $agentPairs += , @($a.en, $a.ru) }
} else { try {
  $agents = & $readJson 'icons\agents\agents.json'
  $players = Invoke-RestMethod 'http://localhost:1349/api/players' -TimeoutSec 3
  $teams = @{}; foreach ($t in (Invoke-RestMethod 'http://localhost:1349/api/teams' -TimeoutSec 3)) { $teams[$t._id] = $t.name }
  $vals = @{}
  foreach ($side in 'CT', 'T') {
    $vals[$side] = (@('{ "name": "", "label": "Automatic" }') + @($agents | Where-Object side -eq $side | ForEach-Object { '{ "name": ' + (ConvertTo-Json $_.id) + ', "label": ' + (ConvertTo-Json $_.en) + ' }' })) -join ', '
  }
  foreach ($a in $agents) { $agentPairs += , @($a.en, $a.ru) }
  $inputs = foreach ($p in ($players | Where-Object steamid | Sort-Object { $teams[$_.team] }, username)) {
    $who = $p.username + $(if ($teams[$p.team]) { " ($($teams[$p.team]))" } else { '' })
    foreach ($side in 'CT', 'T') {
      '      { "type": "select", "name": ' + (ConvertTo-Json "$($p.steamid)_$side") + ', "label": ' + (ConvertTo-Json "$who - $side") + ', "values": [' + $vals[$side] + '] }'
    }
  }
  if ($inputs) {
    $panelPath = Join-Path $dst 'panel.json'
    $panelText = [IO.File]::ReadAllText($panelPath, [Text.Encoding]::UTF8).TrimEnd()
    $section = "  {`n    `"label`": `"Agents`",`n    `"name`": `"agents_panel`",`n    `"inputs`": [`n" + ($inputs -join ",`n") + "`n    ]`n  }"
    $panelText = $panelText.Substring(0, $panelText.LastIndexOf(']')).TrimEnd() + ",`n" + $section + "`n]`n"
    [IO.File]::WriteAllText($panelPath, $panelText, $utf8)
  }
} catch { Write-Warning "Agents section skipped (manager not running?): $($_.Exception.Message)" } }

# hotkeys.json for the "Hot keys" button patched into the manager's HUDs page: built from keybinds.json
# (texts: panel\hotkeys.json), so the list always matches the real bindings; each row runs its action
$hk = & $readJson 'panel\hotkeys.json'
$binds = & $readJson 'keybinds.json'
$q = { param($s) '"' + ($s -replace '\\', '\\' -replace '"', '\"') + '"' }
$items = foreach ($b in $binds) {
  $desc = $hk.en.($b.action); if (-not $desc) { $desc = $b.action }
  '{"key":' + (& $q $b.bind) + ',"text":' + (& $q $desc) + ',"action":' + (& $q $b.action) + '}'
}
$popup = '{"title":' + (& $q $hk.en.section) + ',"hint":' + (& $q $hk.en.popupHint) + ',"items":[' + ($items -join ',') + ']}'
[IO.File]::WriteAllText((Join-Path $dst 'hotkeys.json'), $popup, $utf8)

# manager-ru.json: hand-written manager strings + English -> Russian pairs of the panel and the hotkeys
# (case-sensitive parser: ConvertFrom-Json treats "Live Game Data" and "Live Game data" as one key)
Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer; $ser.MaxJsonLength = [int]::MaxValue
$dict = $ser.DeserializeObject([IO.File]::ReadAllText((Join-Path $src 'panel\manager-ru.json'), [Text.Encoding]::UTF8))
if (-not $dict) { Write-Error 'panel\manager-ru.json is not valid JSON'; exit 1 }
$exact = New-Object 'System.Collections.Generic.Dictionary[string,string]'
foreach ($k in $dict['exact'].Keys) { $exact[$k] = [string]$dict['exact'][$k] }
$pair = { param($en, $ru) if ($en -and $ru -and $en -cne $ru -and -not $exact.ContainsKey($en.Trim())) { $exact[([string]$en).Trim()] = ([string]$ru).Trim() } }
$panelEn = & $readJson 'panel\en.json'; $panelRu = & $readJson 'panel\ru.json'
foreach ($sEn in $panelEn) {
  $sRu = $panelRu | Where-Object { $_.name -eq $sEn.name } | Select-Object -First 1; if (-not $sRu) { continue }
  & $pair $sEn.label $sRu.label
  foreach ($iEn in $sEn.inputs) {
    $iRu = $sRu.inputs | Where-Object { $_.name -eq $iEn.name } | Select-Object -First 1; if (-not $iRu) { continue }
    & $pair $iEn.label $iRu.label
    foreach ($vEn in @($iEn.values)) {
      if (-not $vEn) { continue }
      $vRu = @($iRu.values) | Where-Object { $_.name -eq $vEn.name } | Select-Object -First 1
      if ($vRu) { & $pair $vEn.label $vRu.label }
    }
  }
}
foreach ($p in $hk.en.PSObject.Properties) { & $pair $p.Value $hk.ru.($p.Name) }
foreach ($ap in $agentPairs) { & $pair $ap[0] $ap[1] }
$json = '{"exact":' + $ser.Serialize($exact) + ',"prefix":' + $ser.Serialize($dict['prefix']) + ',"suffix":' + $ser.Serialize($dict['suffix']) + '}'
[IO.File]::WriteAllText((Join-Path $dst 'manager-ru.json'), $json, $utf8)
Write-Host "Deployed to $dst (manager-ru.json: $($exact.Count) strings)"
