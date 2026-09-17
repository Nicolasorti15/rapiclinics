# RAPICLINICS

Aplicación de rondas hospitalarias para **Android e iOS**, con una vista web para revisar el flujo. Versión de demostración con pacientes, documentos e historia clínica ficticios.

Incluye inicio de sesión, identificación NFC o selección de cama demo, confirmación del paciente, visitas por texto y grabación, propuesta extractiva revisable, pendientes, borradores recuperables, documentos PDF inmutables, validación de identidad, historial, auditoría y envío EHR simulado.

Los pendientes se pueden consultar por servicio o desde la ficha de cada paciente, buscar por texto y marcar como completados o reabrir. Las revisiones guardadas como borrador conservan sus correcciones al retomarlas.

**Estado:** demo funcional en desarrollo y configuración de distribución preparada. Todavía no hay AAB/IPA firmados ni publicación en las tiendas. La transcripción usa Whisper local en el servidor; la propuesta de redacción actual aplica reglas conservadoras, no un modelo generativo. NFC/grabación nativos requieren validación física. Consultar [publicación](docs/publicacion.md) antes de distribuir.

Laboratorio permite subir varios PDF con texto o CSV, revisar identidad y valores y confirmar su inclusión en gráficas interactivas por variable, unidad y fecha. Incluye datos sintéticos en `fixtures/laboratorio`. Consulta [laboratorio](docs/laboratorio.md) y [diseño del asistente de redacción](docs/ia-redaccion.md).

## Ejecutar en Windows sin Docker

Requisitos: Node.js 24 y Python 3.13. Desde la raíz:

```powershell
python -m venv services/api/.venv
services/api/.venv/Scripts/python.exe -m pip install -r services/api/requirements.lock.txt
cd services/api
.venv/Scripts/alembic.exe upgrade head
.venv/Scripts/python.exe -m app.seed
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

En otra terminal, desde la raíz:

```powershell
cd apps/mobile
npm.cmd ci
npm.cmd run web
```

Abrir `http://localhost:8081`. Usuario local: `demo@rapiclinics.app`. Contraseña local: `RapiDemo2026!`. Solo datos ficticios. Las otras cuentas y sus roles están definidos en `services/api/app/seed.py`.

La API usa SQLite local y objetos cifrados en `services/api/data`. Una clave de desarrollo se crea automáticamente allí; no subir esta carpeta al repositorio. El servidor y el navegador deben seguir ejecutándose para que funcione la vista previa.

## Android e iOS

Para probar gratis en iPhone con **Expo Go**, ejecutar `INICIAR_EXPO_GO.bat` en Windows y escanear el QR desde el teléfono conectado a la misma red. Esta variante usa selección de cama y no inicializa NFC. [Guía Expo Go](docs/expo-go.md).

Para probar **NFC real**, crear una development build con EAS o compilar en una máquina preparada:

```powershell
cd apps/mobile
npx eas-cli login
npx eas-cli project:info
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
```

Configurar `EXPO_PUBLIC_API_URL` con una API alcanzable desde el dispositivo. `localhost` apunta al propio teléfono; para emulador Android usar `http://10.0.2.2:8000`. En un teléfono físico se necesita la dirección de red del servidor o un entorno HTTPS. Para pruebas LAN, levantar Uvicorn en `0.0.0.0` de forma deliberada y configurar el firewall local.

Los builds EAS requieren una cuenta de Expo y, para distribución iOS, las credenciales y capacidades de Apple. Los builds locales de Android requieren JDK/SDK Android; iOS requiere macOS y Xcode. No se generaron binarios firmados en este Windows.

## Entorno Docker

```powershell
Copy-Item .env.example .env
# Cambiar las contraseñas locales del archivo .env.
docker compose up --build
```

Levanta PostgreSQL, MinIO, inicialización del bucket y API. La API ejecuta migraciones y seed idempotente. Docker no estaba instalado en el equipo de desarrollo: Compose está preparado, pero su arranque integrado debe validarse antes de desplegar.

Para un entorno alojado, establecer `APP_ENV=staging`, una `STORAGE_ENCRYPTION_KEY` fija, credenciales propias de almacenamiento, HTTPS, CORS preciso y límites del proxy. `APP_MODE=demo` es obligatorio. No desplegar la configuración local abierta con credenciales por defecto.

## Verificación

```powershell
cd services/api
.venv/Scripts/ruff.exe check .
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/alembic.exe check
cd ../../apps/mobile
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npx expo-doctor
npm.cmd run export:all
```

La exportación comprueba bundles web/Android/iOS; **no equivale a compilar o firmar un APK/AAB/IPA**. El informe de [pruebas](docs/testing.md) distingue lo ejecutado de lo pendiente.

## Documentación

- [Guía de demostración](docs/demo.md)
- [Arquitectura y decisiones](docs/architecture.md)
- [Diseño visual](docs/diseno-visual.md)
- [Modelo de amenazas](docs/threat-model.md)
- [Preparación para tiendas](docs/publicacion.md)
- [Instalación Android/iPhone](docs/instalar-en-movil.md)
- [Programar las etiquetas NFC](docs/configurar-nfc.md)
- [Ficha propuesta](store/listing.es.md)
- [Borrador de privacidad](store/privacy-policy.es.md)
- API interactiva: `http://localhost:8000/docs`, con autenticación para operaciones privadas.

No se incluyeron pacientes reales, diagnóstico automático, dosificación, integración EHR productiva, OCR, IA externa ni sincronización offline persistente.
