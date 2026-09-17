// Run with Node: no .ps1 execution or execution-policy changes are needed.
const { execFileSync, spawn } = require('node:child_process');
const { existsSync, mkdirSync, openSync, closeSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mobile = path.join(root, 'apps', 'mobile');
const python = path.join(root, 'services', 'api', '.venv', 'Scripts', 'python.exe');
const cli = path.join(mobile, 'node_modules', 'expo', 'bin', 'cli');

async function main() {
  if (!existsSync(python) || !existsSync(cli)) {
    throw new Error('Faltan dependencias. Sigue la instalacion del README antes de iniciar.');
  }
  // Read network configuration only. This does not execute a PowerShell script file.
  const query = "$ErrorActionPreference='Stop'; $net=Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Private' -and $_.IPv4Connectivity -ne 'Disconnected' } | Select-Object -First 1; if ($net) { Get-NetIPAddress -InterfaceIndex $net.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254*' } | Select-Object -ExpandProperty IPAddress -First 1 }";
  const ip = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', query], {
    encoding: 'utf8', windowsHide: true, timeout: 15000,
  }).trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    throw new Error('Conecta el computador a una red privada de confianza. No se encontro su direccion.');
  }
  const api = `http://${ip}:8083`;
  const env = { ...process.env, EXPO_PUBLIC_API_URL: api, REACT_NATIVE_PACKAGER_HOSTNAME: ip };
  if (process.argv.includes('--check')) {
    console.log(`Configuracion correcta. API: ${api}. Expo Go: exp://${ip}:8084`);
    console.log('No se han iniciado servidores ni modificado ajustes de Windows.');
    return;
  }
  const healthy = async () => {
    try {
      const response = await fetch(`${api}/health`, { signal: AbortSignal.timeout(1500) });
      return response.ok;
    } catch { return false; }
  };
  if (!(await healthy())) {
    const artifacts = path.join(root, 'artifacts');
    mkdirSync(artifacts, { recursive: true });
    const log = openSync(path.join(artifacts, 'expo-go-api.log'), 'a');
    const server = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', ip, '--port', '8083', '--no-access-log'], {
      cwd: path.join(root, 'services', 'api'), env, detached: true, windowsHide: true,
      stdio: ['ignore', log, log],
    });
    server.on('error', (error) => console.error(`API: ${error.message}`));
    server.unref();
    closeSync(log);
    let ready = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      if (await healthy()) { ready = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('La API no inicio. Consulta artifacts/expo-go-api.log.');
  }
  if (process.argv.includes('--api-only')) {
    console.log(`Servidor listo: ${api}`);
    console.log('Abre RAPICLINICS en el Android conectado a la misma red. Mantiene el computador encendido.');
    return;
  }
  console.log(`Conecta el iPhone a la misma red y escanea el QR. Direccion: exp://${ip}:8084`);
  console.log('Si Windows solicita acceso de Node.js, permite solo redes privadas.');
  console.log('Mantiene el computador encendido y esta ventana abierta.');
  const metro = spawn(process.execPath, [cli, 'start', '--go', '--lan', '--port', '8084'], {
    cwd: mobile, env, stdio: 'inherit',
  });
  metro.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  metro.on('exit', (code) => { process.exitCode = code ?? 1; });
}

main().catch((error) => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
