@echo off
rem newHud key helper: remove the autostart shortcut and stop the running helper
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'newHud key helper.lnk';" ^
  "if (Test-Path $lnk) { Remove-Item $lnk; Write-Host 'Autostart removed' } else { Write-Host 'No autostart shortcut' };" ^
  "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*newhud-key-helper.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('Stopped helper ' + $_.ProcessId) }"
pause
