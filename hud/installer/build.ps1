# Builds the installer: HUD-Manager-mo_ORT-Setup-<version>.exe (NSIS, per user, no admin rights).
# Contents: the patched JTs Hud Manager installed on this PC (Russian UI, Hot keys, CS2 console for the auto camera,
# updates from github.com/moOrt-dev/hud-manager) + the New HUD + the key helper.
# No personal data: the manager keeps matches / teams / players / logos / settings in %APPDATA%\jts-hud and
# the HUD config in its database - none of that is copied; the HUD is built with deploy.ps1 -Clean.
#   powershell -ExecutionPolicy Bypass -File installer\build.ps1 [-Version 7.13.27]
param([string]$Version = '7.13.27')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$build = Join-Path $root '_build'
$stage = Join-Path $build 'stage'
$app = "$env:LOCALAPPDATA\Programs\jts-hud"
$makensis = Join-Path $build 'tools\nsis-3.13\makensis.exe'
if (-not (Test-Path $makensis)) { throw "NSIS not found: $makensis (portable zip from nsis.sourceforge.io into _build\tools)" }
if (Get-Process 'JTs Hud Manager' -ErrorAction SilentlyContinue) { Write-Warning 'The manager is running: its files are copied as they are on disk' }

# fresh stage (robocopy /MIR into empty folders also clears old content)
foreach ($d in 'app', 'hud\newHud', 'helper') { New-Item -ItemType Directory -Force (Join-Path $stage $d) | Out-Null }

# 1. the manager program (without JT's own uninstaller: the installer writes its own)
robocopy $app (Join-Path $stage 'app') /MIR /XF 'Uninstall JTs Hud Manager.exe' '*.before-*' /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy app failed ($LASTEXITCODE)" }

# 2. version in package.json inside app.asar (same length: the update banner compares it with the release tag)
$asar = Join-Path $stage 'app\resources\app.asar'
$latin = [Text.Encoding]::GetEncoding(28591)
$fs = [IO.File]::OpenRead($asar); $br = New-Object IO.BinaryReader $fs
$null = $br.ReadUInt32(); $hs = $br.ReadUInt32(); $null = $br.ReadUInt32(); $len = $br.ReadUInt32()
$hdr = [Text.Encoding]::UTF8.GetString($br.ReadBytes($len)) | ConvertFrom-Json
$e = $hdr.files.'package.json'; $off = 8 + $hs + [int64]$e.offset
$buf = New-Object byte[] ([int]$e.size); $fs.Position = $off; $null = $fs.Read($buf, 0, $buf.Length); $fs.Close()
$pkg = $latin.GetString($buf)
$m = [regex]::Match($pkg, '"version":\s*"([^"]+)"')
if (-not $m.Success) { throw 'version not found in package.json' }
if ($m.Groups[1].Value.Length -ne $Version.Length) { throw "version must keep the length of $($m.Groups[1].Value)" }
$pkg = $pkg.Substring(0, $m.Groups[1].Index) + $Version + $pkg.Substring($m.Groups[1].Index + $Version.Length)
$w = [IO.File]::Open($asar, 'Open', 'Write', 'None'); $w.Position = $off; $b = $latin.GetBytes($pkg); $w.Write($b, 0, $b.Length); $w.Close()
# electron-builder leftover (not used by the manager): point it at this build's repository too
Set-Content (Join-Path $stage 'app\resources\app-update.yml') "owner: moOrt-dev`nrepo: hud-manager`nprovider: github`nupdaterCacheDirName: jts-hud-updater" -Encoding ascii

# 3. the HUD, clean
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'deploy.ps1') -Dest (Join-Path $stage 'hud\newHud') -Clean
if ($LASTEXITCODE) { throw 'deploy.ps1 failed' }
Remove-Item (Join-Path $stage 'hud\newHud\uploads') -Recurse -Force -ErrorAction SilentlyContinue

# 4. the key helper
robocopy (Join-Path $root 'helper') (Join-Path $stage 'helper') /MIR /NFL /NDL /NJH /NJS /NP | Out-Null

# 5. no personal data in anything that goes into the installer
# the Windows user name of the PC that builds it, its user folder, local project / Steam paths, real Steam IDs
$me = [regex]::Escape($env:USERNAME)
$bad = "$me|C:\\Users\\[^\\]+\\|[A-Z]:\\newHud|[A-Z]:\\Steam|7656119[0-9]{10}"
$hits = Get-ChildItem (Join-Path $stage 'hud'), (Join-Path $stage 'helper') -Recurse -File |
  Where-Object { $_.Extension -match 'js|css|html|json|ps1|cmd|txt|svg|md' } |
  Select-String -Pattern $bad | Where-Object { $_.Line -notmatch '76561190000000|STEAM64_BASE' }
$asarText = [IO.File]::ReadAllText($asar, $latin)
$asarHits = [regex]::Matches($asarText, "$me|C:\\\\Users\\\\|[A-Z]:\\\\steam", 'IgnoreCase').Count
if ($hits -or $asarHits) { $hits | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber): $($_.Line)" }; throw "personal data found (asar: $asarHits)" }

# icon of the setup = icon of the manager
Add-Type -AssemblyName System.Drawing
$ico = Join-Path $build 'app.ico'
$icon = [Drawing.Icon]::ExtractAssociatedIcon((Join-Path $stage 'app\JTs Hud Manager.exe'))
$f = [IO.File]::Create($ico); $icon.Save($f); $f.Close()

New-Item -ItemType Directory -Force (Join-Path $build 'out') | Out-Null
& $makensis /V2 "/DVERSION=$Version" "/DSTAGE=$stage" "/DICON=$ico" "/DOUT=$(Join-Path $build 'out')" (Join-Path $PSScriptRoot 'installer.nsi')
if ($LASTEXITCODE) { throw "makensis failed ($LASTEXITCODE)" }
Get-ChildItem (Join-Path $build 'out') -Filter "*$Version*.exe" | ForEach-Object { '{0}  {1:N1} MB' -f $_.FullName, ($_.Length / 1MB) }
