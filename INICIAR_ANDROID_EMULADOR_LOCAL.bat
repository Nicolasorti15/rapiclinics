@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en PATH.
  echo Instala Node.js 24 y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

node "%~dp0scripts\start_android_emulator.cjs"
if errorlevel 1 (
  echo.
  echo El entorno no pudo iniciarse. Revisa el mensaje anterior.
  pause
  exit /b 1
)
endlocal
