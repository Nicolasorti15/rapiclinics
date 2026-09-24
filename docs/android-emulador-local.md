# Android local sin builds en la nube

Este flujo está pensado para desarrollar RAPICLINICS en dos o más PCs Windows usando GitHub como fuente de código y un Android virtual para las pruebas diarias.

## Qué ejecuta

- Backend FastAPI local en `127.0.0.1:8000`.
- Android Emulator de Android Studio.
- Expo Go dentro del emulador.
- Metro en `127.0.0.1:8081` con Fast Refresh.
- La app Android accede a la API del PC por `http://10.0.2.2:8000`.

No usa Render, EAS Build ni un APK nuevo para cada cambio. JavaScript/TypeScript se actualiza con Fast Refresh. NFC real no se puede validar en el emulador; para el desarrollo diario se usa la selección de cama de demostración. Una compilación nativa sigue siendo necesaria únicamente para probar NFC u otros cambios de código nativo en un teléfono real.

## Preparación única de cada PC

1. Clonar el repositorio con Git.
2. Instalar Node.js 24 y Python 3.13.
3. Instalar Android Studio. En `SDK Manager`, instalar Android SDK Platform y Android SDK Platform-Tools. En `Device Manager`, crear un AVD con Google Play, por ejemplo un Pixel reciente.
4. Iniciar ese AVD una vez y abrir Play Store. Instalar **Expo Go** dentro del emulador.
5. Cerrar el emulador. A partir de entonces el lanzador puede iniciarlo automáticamente.

Android Studio suele instalar el SDK en `%LOCALAPPDATA%\Android\Sdk`. El lanzador también respeta `ANDROID_HOME` y `ANDROID_SDK_ROOT`.

## Uso diario

Desde la raíz del repositorio, hacer doble clic en:

`INICIAR_ANDROID_EMULADOR_LOCAL.bat`

El lanzador:

1. Verifica Android SDK y AVD.
2. Crea el entorno virtual Python si falta.
3. Instala dependencias si cambiaron los lockfiles.
4. Aplica migraciones y seed local.
5. Inicia el primer AVD disponible, o reutiliza el que ya esté abierto.
6. Inicia la API local.
7. Inicia Metro y abre RAPICLINICS en Expo Go.

Credenciales demo locales:

- Usuario: `demo@rapiclinics.app`
- Clave: `RapiDemo2026!`

Para elegir un AVD concreto cuando haya varios:

```powershell
$env:RAPICLINICS_AVD = "Nombre_Del_AVD"
.\INICIAR_ANDROID_EMULADOR_LOCAL.bat
```

Para listar AVDs:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -list-avds
```

## Trabajo desde dos PCs

Cada PC tiene su propia API, SQLite y archivos de desarrollo. Los datos locales no se sincronizan entre computadores; el código sí se sincroniza por GitHub.

Antes de empezar una sesión:

```powershell
git switch main
git pull --ff-only
```

Para una tarea nueva, crear una rama propia:

```powershell
git switch -c feature/nombre-de-la-tarea
```

Al terminar, subirla y abrir un Pull Request. Evitar que dos personas editen directamente `main` al mismo tiempo. Cada cuenta de ChatGPT debe conectar su propia autorización de GitHub al mismo repositorio; no es necesario compartir contraseñas ni tokens.

## Límites del emulador

El flujo normal de login, pacientes, visitas, pendientes, documentos y laboratorios puede desarrollarse así. El micrófono del emulador depende de la configuración del AVD. NFC físico no se emula de forma equivalente al teléfono, por lo que la validación final de NFC seguirá haciéndose en un dispositivo real.

Si se modifica `app.config.ts`, se añade/elimina un módulo nativo o se cambia código nativo Android, Expo Go ya no basta para validar ese cambio. Para el trabajo habitual en TypeScript/React Native no hay que recompilar la app.
