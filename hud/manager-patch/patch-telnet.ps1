# Adds action "telnet" to POST /api/huds/:hudId/action in out/main/index.js inside app.asar:
# the HUD / control page send CS2 console commands, the manager passes them to CS2 (-netconport).
# Closed by default; who may send what is set in %APPDATA%\jts-hud\telnet-access.json
# (telnet-access.ps1 next to this script), read on every request:
#   access   "local" (default) = only pages of this PC opened from localhost:1349
#            "lan"   = also other PCs of the local network (OBS / control page on a second PC)
#            "any"   = from anywhere (only pages of the manager itself, no address checks)
#   commands "camera" (default) = spec_player / spec_mode / spec_lock_to_accountid / spec_goto / spec_lerpto / echo
#            "all"   = any console command
#   token    optional secret (12+ chars): a request with header X-Telnet-Token passes any check
# Same file size: the bytes are taken from line indentation outside template literals.
#   -DryRun: only build + syntax check (main-index.patched.js next to this script)
# Run (close the manager first): powershell -ExecutionPolicy Bypass -File patch-telnet.ps1 [-DryRun]
# Tested on JTs Hud Manager 7.13.26 (installed per user in %LOCALAPPDATA%\Programs\jts-hud).
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
$asar = "$env:LOCALAPPDATA\Programs\jts-hud\resources\app.asar"
$exe = "$env:LOCALAPPDATA\Programs\jts-hud\JTs Hud Manager.exe"
$latin = [Text.Encoding]::GetEncoding(28591)

$fs = [IO.File]::OpenRead($asar); $br = New-Object IO.BinaryReader $fs
$null = $br.ReadUInt32(); $hs = $br.ReadUInt32(); $null = $br.ReadUInt32(); $len = $br.ReadUInt32()
$hdr = [Text.Encoding]::UTF8.GetString($br.ReadBytes($len)) | ConvertFrom-Json
$entry = $hdr.files.out.files.main.files.'index.js'
$off = 8 + $hs + [int64]$entry.offset; $size = [int]$entry.size
$buf = New-Object byte[] $size; $fs.Position = $off; $null = $fs.Read($buf, 0, $size); $fs.Close()
$src = $latin.GetString($buf)

if ($src.Contains('telnet-access.json')) { Write-Host 'already patched'; exit 0 }
if ($src.Contains('action === "telnet"')) { throw 'an older telnet patch is applied: restore the backup first' }

$anchor = '    if (!action) return res.status(400).json({ error: "action is required" });' + "`n"
if (($src.Length - $src.Replace($anchor, '').Length) / $anchor.Length -ne 1) { throw 'anchor not found exactly once' }
# no backticks in the block: the indentation stripping below tracks template literals by them
$block = @'
if (action === "telnet") {
let c = {};
const cfgFile = path.join(userDataPath, "telnet-access.json");
try { c = JSON.parse(fs.readFileSync(cfgFile, "utf8")); } catch {}
const access = ["local", "lan", "any"].includes(c.access) ? c.access : "local";
const ip = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
const host = String(req.headers.host || "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
const isLocal = (h) => h === "127.0.0.1" || h === "::1" || h === "localhost";
const isLan = (h) => isLocal(h) || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|f[cd][0-9a-f]{2}:|fe80:)/i.test(h);
const sameOrigin = !req.headers.origin || req.headers.origin === "http://" + req.headers.host;
const token = typeof c.token === "string" && c.token.length >= 12 && req.headers["x-telnet-token"] === c.token;
const allowed = token || (sameOrigin && (access === "any" || (access === "lan" ? isLan(ip) && isLan(host) : isLocal(ip) && isLocal(host))));
if (!allowed) return res.status(403).json({ error: "telnet blocked (access: " + access + "), telnet-access.json" });
const camera = /^(spec_player "[^"\\;\r\n]{1,64}"|spec_player \d{1,2}|spec_mode \d|spec_lock_to_accountid \d{1,10}|spec_goto( -?\d+(\.\d+)?){5}|spec_lerpto( -?\d+(\.\d+)?){5,8}|echo [\w .-]{0,64})$/;
const lines = String(data?.cmd ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
const bad = c.commands === "all" ? undefined : lines.find((l) => !camera.test(l));
if (bad) return res.status(403).json({ error: "telnet: command not allowed (commands: camera): " + bad });
const port = Number(data?.port);
let out = "", done = 0;
const s = net.createConnection({ host: "127.0.0.1", port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : 2020 });
const fin = (e) => { if (done++) return; s.destroy(); e ? res.status(502).json({ error: e.message }) : res.json({ ok: true, out }); };
s.setTimeout(3e3, () => fin(new Error("Telnet timeout")));
s.on("error", fin);
s.on("data", (d) => { out += d; });
s.on("connect", () => { s.write(lines.join("\r\n") + "\r\n"); setTimeout(fin, 300); });
return;
}
'@
$block = ($block -replace "`r", '').TrimEnd("`n") + "`n"
if ($block.Contains('`')) { throw 'backtick in block' }
$new = $src.Replace($anchor, $anchor + $block)
$need = $new.Length - $src.Length

# free $need bytes: strip leading spaces of lines that are not inside a template literal
$lines = $new -split "`n"
$inTpl = $false
$freed = 0
for ($i = 0; $i -lt $lines.Count -and $freed -lt $need; $i++) {
  $l = $lines[$i]
  if (-not $inTpl) {
    $t = $l.TrimStart(' ')
    $cut = [Math]::Min($l.Length - $t.Length, $need - $freed)
    if ($cut -gt 0) { $lines[$i] = $l.Substring($cut); $freed += $cut }
  }
  $ticks = ([regex]::Matches($l, '(?<!\\)`')).Count
  if ($ticks % 2) { $inTpl = -not $inTpl }
}
if ($freed -lt $need) { throw "only $freed of $need bytes freed" }
$new = $lines -join "`n"
if ($new.Length -ne $src.Length) { throw "length mismatch $($new.Length) vs $($src.Length)" }

$out = $latin.GetBytes($new)
$patched = Join-Path $PSScriptRoot 'main-index.patched.js'
[IO.File]::WriteAllBytes($patched, $out)
# syntax check with the manager's own Node (Electron as Node). Through cmd: PowerShell does not wait for
# a GUI-subsystem exe like Electron, so $LASTEXITCODE of a direct call is not its exit code
$env:ELECTRON_RUN_AS_NODE = '1'
$check = cmd /c "`"$exe`" --check `"$patched`" 2>&1"
$ok = $LASTEXITCODE -eq 0
Remove-Item Env:ELECTRON_RUN_AS_NODE
if (-not $ok) { $check | Select-Object -First 10 | ForEach-Object { Write-Host $_ }; throw 'syntax check failed' }
Write-Host "patch ok: +$need bytes, $freed bytes of indentation removed, syntax ok"
if ($DryRun) { exit 0 }

if (Get-Process 'JTs Hud Manager' -ErrorAction SilentlyContinue) { throw 'close JTs Hud Manager first' }
$bak = "$asar.before-telnet" # backup next to the original, to undo: close the manager and copy it back over app.asar
if (-not (Test-Path $bak)) { Copy-Item $asar $bak }
$w = [IO.File]::Open($asar, 'Open', 'Write', 'None')
$w.Position = $off; $w.Write($out, 0, $out.Length); $w.Close()
Write-Host "written to $asar (backup: $bak)"
