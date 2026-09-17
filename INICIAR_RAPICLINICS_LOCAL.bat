@echo off
setlocal
cd /d "%~dp0"

if not exist "services\api\app\main.py" (
  echo ERROR: Este archivo debe estar dentro de la carpeta raiz de HACKATON IBIO.
  echo Copialo junto a README.md, docker-compose.yml, apps y services.
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python no esta instalado o no esta en PATH.
  echo Instala Python 3.13 y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js/npm no esta instalado o no esta en PATH.
  echo Instala Node.js y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist "services\api\.venv\Scripts\python.exe" (
  echo Creando entorno Python...
  python -m venv "services\api\.venv"
  if errorlevel 1 goto :fail
)

echo Instalando/verificando dependencias de API...
"services\api\.venv\Scripts\python.exe" -m pip install -r "services\api\requirements.lock.txt"
if errorlevel 1 goto :fail

pushd "services\api"
".venv\Scripts\python.exe" -m alembic upgrade head
if errorlevel 1 (popd & goto :fail)
".venv\Scripts\python.exe" -m app.seed
if errorlevel 1 (popd & goto :fail)
popd

if not exist "apps\mobile\node_modules" (
  echo Instalando dependencias de la app...
  pushd "apps\mobile"
  call npm.cmd ci
  if errorlevel 1 (popd & goto :fail)
  popd
)

echo Iniciando API en http://localhost:8000 ...
start "RAPICLINICS API" /D "%~dp0services\api" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log"

timeout /t 3 /nobreak >nul

echo Iniciando app web en http://localhost:8081 ...
start "RAPICLINICS WEB" /D "%~dp0apps\mobile" cmd /k "npm.cmd run web"

timeout /t 7 /nobreak >nul
start "" "http://localhost:8081"

echo.
echo RAPICLINICS iniciado.
echo Web: http://localhost:8081
echo API: http://localhost:8000/docs
echo Usuario: demo@rapiclinics.app
echo Clave: RapiDemo2026!
echo.
echo Mantenga abiertas las dos ventanas de consola mientras usa la app.
pause
exit /b 0

:fail
echo.
echo ERROR: No se pudo completar el arranque. Revisa el mensaje anterior.
pause
exit /b 1
