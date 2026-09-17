$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$privateNetwork = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Private' -and $_.IPv4Connectivity -ne 'Disconnected' } | Select-Object -First 1
if (-not $privateNetwork) { throw 'Conecta el computador a tu red privada de confianza antes de iniciar.' }
$phoneAddress = Get-NetIPAddress -InterfaceIndex $privateNetwork.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254*' } | Select-Object -ExpandProperty IPAddress -First 1
if (-not $phoneAddress) { throw 'No se pudo encontrar la direccion de la red privada.' }
$pythonPath = Join-Path $projectRoot 'services\api\.venv\Scripts\python.exe'
if (-not (Test-Path $pythonPath)) { throw 'Primero instala las dependencias de RAPICLINICS siguiendo README.md.' }
$env:EXPO_PUBLIC_API_URL = "http://${phoneAddress}:8083"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $phoneAddress
$apiListener = Get-NetTCPConnection -LocalPort 8083 -State Listen -ErrorAction SilentlyContinue
if (-not $apiListener) {
    Start-Process -FilePath $pythonPath -ArgumentList "-m uvicorn app.main:app --host $phoneAddress --port 8083 --no-access-log" -WorkingDirectory (Join-Path $projectRoot 'services\api') -WindowStyle Hidden
}
Write-Host "Conecta el iPhone a la misma red. Abre Expo Go con el QR que aparecera."
Write-Host "Direccion: exp://${phoneAddress}:8084"
Write-Host 'Si Windows solicita acceso de Node.js, permite solo redes privadas.'
Write-Host 'Mantiene este computador encendido y esta ventana abierta durante la prueba.'
Set-Location (Join-Path $projectRoot 'apps\mobile')
& node node_modules/expo/bin/cli start --go --lan --port 8084
if ($LASTEXITCODE -ne 0) { throw 'Expo no pudo iniciar. Revisa el mensaje anterior.' }
