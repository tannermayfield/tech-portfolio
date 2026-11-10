@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0companion\start.ps1" %*
pause
