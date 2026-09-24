const { execFileSync, spawn } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mobile = path.join(root, 'apps', 'mobile');
const apiDir = path.join(root, 'services', 'api');
const venvPython = path.join(apiDir, '.venv', 'Scripts', 'python.exe');
const expoCli = path.join(mobile, 'node_modules', 'expo', 'bin', 'cli');
const requirements = path.join(apiDir, 'requirements.lock.txt');
const packageLock = path.join(mobile, 'package-lock.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function stampChanged(source, stamp) {
  const hash = sha256(source);
  if (!existsSync(stamp) || readFileSync(stamp, 'utf8').trim() !== hash) return hash;
  return null;
}

function commandWorks(command, args = ['--version']) {
  try {
    execFileSync(command, args, { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function findAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  ].filter(Boolean);
  return candidates.find((candidate) =>
    existsSync(path.join(candidate, 'platform-tools', 'adb.exe')) &&
    existsSync(path.join(candidate, 'emulator', 'emulator.exe')),
  );
}

function adbDevices(adb) {
  const output = execFileSync(adb, ['devices'], { encoding: 'utf8', windowsHide: true });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^emulator-\d+\s+device$/.test(line))
    .map((line) => line.split(/\s+/)[0]);
}

async function waitForEmulator(adb, timeoutMs = 180000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const devices = adbDevices(adb);
    if (devices.length) return devices[0];
    await sleep(1500);
  }
  throw new Error('El emulador no aparecio en ADB dentro de 3 minutos. Abre Android Studio > Device Manager y revisa el AVD.');
}

async function waitForBoot(adb, serial, timeoutMs = 180000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const value = execFileSync(adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], {
        encoding: 'utf8', windowsHide: true, timeout: 5000,
      }).trim();
      if (value === '1') return;
    } catch {}
    await sleep(1500);
  }
  throw new Error('Android inicio, pero no termino de arrancar dentro de 3 minutos.');
}

async function urlHealthy(url, timeout = 1500) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    return response.ok;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', windowsHide: false, ...options });
}

function ensurePython() {
  if (existsSync(venvPython)) return;
  console.log('Creando entorno Python local...');
  if (commandWorks('py.exe', ['-3.13', '--version'])) {
    run('py.exe', ['-3.13', '-m', 'venv', path.join(apiDir, '.venv')], { cwd: root });
  } else if (commandWorks('python.exe')) {
    run('python.exe', ['-m', 'venv', path.join(apiDir, '.venv')], { cwd: root });
  } else {
    throw new Error('No se encontro Python. Instala Python 3.13 y vuelve a ejecutar.');
  }
}

function ensureApiDependencies() {
  ensurePython();
  const stamp = path.join(apiDir, '.venv', '.rapiclinics-requirements.sha256');
  const changed = stampChanged(requirements, stamp);
  if (changed) {
    console.log('Instalando/verificando dependencias de la API...');
    run(venvPython, ['-m', 'pip', 'install', '-r', requirements], { cwd: apiDir });
    writeFileSync(stamp, changed, 'utf8');
  }
  run(venvPython, ['-m', 'alembic', 'upgrade', 'head'], { cwd: apiDir });
  run(venvPython, ['-m', 'app.seed'], { cwd: apiDir });
}

function ensureMobileDependencies() {
  if (!commandWorks('npm.cmd')) throw new Error('No se encontro Node.js/npm. Instala Node.js 24 y vuelve a ejecutar.');
  const nodeModules = path.join(mobile, 'node_modules');
  const stamp = path.join(nodeModules, '.rapiclinics-package-lock.sha256');
  const changed = !existsSync(nodeModules) ? sha256(packageLock) : stampChanged(packageLock, stamp);
  if (changed || !existsSync(expoCli)) {
    console.log('Instalando dependencias de la app...');
    run('npm.cmd', ['ci'], { cwd: mobile });
    writeFileSync(stamp, changed || sha256(packageLock), 'utf8');
  }
}

function ensureEmulator(sdk) {
  const adb = path.join(sdk, 'platform-tools', 'adb.exe');
  const emulator = path.join(sdk, 'emulator', 'emulator.exe');
  const running = adbDevices(adb);
  if (running.length) return { adb, serialPromise: Promise.resolve(running[0]) };

  const avds = execFileSync(emulator, ['-list-avds'], { encoding: 'utf8', windowsHide: true })
    .split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (!avds.length) {
    throw new Error('No hay un Android Virtual Device. En Android Studio crea uno desde Device Manager (recomendado: Pixel con Google Play).');
  }
  const requested = process.env.RAPICLINICS_AVD;
  const avd = requested && avds.includes(requested) ? requested : avds[0];
  console.log(`Iniciando emulador Android: ${avd}`);
  const child = spawn(emulator, ['-avd', avd, '-netdelay', 'none', '-netspeed', 'full'], {
    detached: true, stdio: 'ignore', windowsHide: false,
  });
  child.unref();
  return { adb, serialPromise: waitForEmulator(adb) };
}

async function ensureApi(env) {
  if (await urlHealthy('http://127.0.0.1:8000/health')) return;
  const artifacts = path.join(root, 'artifacts');
  mkdirSync(artifacts, { recursive: true });
  const log = openSync(path.join(artifacts, 'android-emulator-api.log'), 'a');
  const server = spawn(venvPython, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--no-access-log'], {
    cwd: apiDir, env, detached: true, windowsHide: true, stdio: ['ignore', log, log],
  });
  server.on('error', (error) => console.error(`API: ${error.message}`));
  server.unref();
  closeSync(log);
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await urlHealthy('http://127.0.0.1:8000/health')) return;
    await sleep(500);
  }
  throw new Error('La API local no inicio. Revisa artifacts/android-emulator-api.log.');
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Este lanzador esta preparado para Windows.');
  const sdk = findAndroidSdk();
  if (!sdk) {
    throw new Error('No se encontro Android SDK/Emulator. Instala Android Studio y crea un AVD desde Device Manager.');
  }

  ensureApiDependencies();
  ensureMobileDependencies();

  const { adb, serialPromise } = ensureEmulator(sdk);
  const serial = await serialPromise;
  await waitForBoot(adb, serial);
  console.log(`Emulador listo: ${serial}`);

  execFileSync(adb, ['-s', serial, 'reverse', 'tcp:8081', 'tcp:8081'], { stdio: 'ignore', windowsHide: true });

  const expoPackage = execFileSync(adb, ['-s', serial, 'shell', 'pm', 'path', 'host.exp.exponent'], {
    encoding: 'utf8', windowsHide: true,
  }).trim();
  if (!expoPackage.startsWith('package:')) {
    try {
      execFileSync(adb, ['-s', serial, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'market://details?id=host.exp.exponent'], {
        stdio: 'ignore', windowsHide: true,
      });
    } catch {}
    throw new Error('Expo Go no esta instalado en el emulador. Se abrio Play Store: instalalo una sola vez y vuelve a ejecutar este lanzador.');
  }

  const env = {
    ...process.env,
    EXPO_PUBLIC_API_URL: 'http://10.0.2.2:8000',
  };
  await ensureApi(env);

  console.log('API local: http://127.0.0.1:8000');
  console.log('Android usa: http://10.0.2.2:8000');
  console.log('Usuario demo: demo@rapiclinics.app');
  console.log('Clave demo: RapiDemo2026!');
  console.log('Iniciando Metro/Expo Go. Los cambios de JavaScript/TypeScript usan Fast Refresh; no requieren recompilar APK.');

  const metro = spawn(process.execPath, [expoCli, 'start', '--go', '--localhost', '--port', '8081'], {
    cwd: mobile, env, stdio: 'inherit', windowsHide: false,
  });
  metro.on('error', (error) => console.error(`Metro: ${error.message}`));

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await urlHealthy('http://127.0.0.1:8081', 1000)) { ready = true; break; }
    await sleep(500);
  }
  if (!ready) {
    metro.kill();
    throw new Error('Metro no inicio en el puerto 8081.');
  }

  try {
    execFileSync(adb, ['-s', serial, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'exp://127.0.0.1:8081', '-p', 'host.exp.exponent'], {
      stdio: 'ignore', windowsHide: true,
    });
  } catch {
    console.log('Abre Expo Go manualmente en el emulador si no se abrio automaticamente.');
  }

  await new Promise((resolve) => metro.on('exit', resolve));
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
