@echo off
rem newHud key helper: start with Windows, without a window (a shortcut in the Startup folder), and start it now.
rem Remove: uninstall-autostart.cmd
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ps1 = Join-Path '%~dp0' 'newhud-key-helper.ps1';" ^
  "$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'newHud key helper.lnk';" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk);" ^
  "$s.TargetPath = (Get-Command powershell.exe).Source;" ^
  "$s.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"' + $ps1 + '\"';" ^
  "$s.WorkingDirectory = '%~dp0'; $s.Description = 'newHud key helper (auto camera)'; $s.Save();" ^
  "Start-Process (Get-Command powershell.exe).Source -WindowStyle Hidden -ArgumentList ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"' + $ps1 + '\"');" ^
  "Write-Host ('Autostart installed: ' + $lnk); Write-Host 'The key helper is running in the background.'"
pause
