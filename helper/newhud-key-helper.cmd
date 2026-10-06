@echo off
rem newHud key helper: auto camera on servers where CS2 telnet is closed (see newhud-key-helper.ps1)
title newHud key helper
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0newhud-key-helper.ps1" %*
pause
