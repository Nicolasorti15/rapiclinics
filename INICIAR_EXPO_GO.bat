@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\start_expo_go.ps1"
pause
