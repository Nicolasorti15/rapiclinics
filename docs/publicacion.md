# Preparación para distribución

## Estado comprobable

- Código compartido Android/iOS con Expo SDK 57, identificadores configurables y versión 1.0.0.
- Icono 1024 × 1024, icono adaptativo, textos de permisos, sesión segura y pantalla de privacidad.
- Perfil EAS de desarrollo, preview y producción con AAB para Google Play.
- Perfil `device` para APK Android e iPhone físico con distribución interna. Exige URL de API alcanzable e identificadores configurados; `preview` iOS sigue siendo solo para simulador.
- Build de producción bloqueado si faltan API HTTPS, EAS project ID e identificador propio.
- No hay certificados, claves de firma, servicios de pago ni cuentas de tiendas en el repositorio.

Todavía no es una release aprobada. Faltan entorno backend alojado, pruebas físicas, compilaciones nativas firmadas, datos públicos del responsable, URLs y el proceso de revisión de las tiendas.

## Información que aporta el propietario

1. Cuenta Expo/EAS y proyecto asociado.
2. Apple Developer / App Store Connect y Google Play Console.
3. Identificador de app bajo control del propietario (el provisional es `app.rapiclinics.demo`).
4. Nombre del responsable, correo de soporte, URL de soporte y URL pública de privacidad.
5. Hosting HTTPS de API y almacenamiento; política de conservación y eliminación de los datos de prueba.

No enviar claves privadas o contraseñas por el chat. Vincular las cuentas con el flujo de EAS y los portales oficiales.

## Configuración y builds

En `apps/mobile`, vincular EAS con `npx eas-cli init` y configurar variables de entorno:

```text
EXPO_PUBLIC_API_URL=https://API_REAL_DEL_PROPIETARIO
EAS_PROJECT_ID=UUID_DEL_PROYECTO
APP_IDENTIFIER=IDENTIFICADOR_PROPIO
APP_VARIANT=production
```

`EXPO_PUBLIC_*` no es secreto. Nunca guardar claves de servicios ahí.

```text
npx eas-cli build --profile production --platform android
npx eas-cli build --profile production --platform ios
```

Después de comprobar las versiones, distribuir primero por TestFlight y un track de pruebas de Google Play. `eas submit` y el envío final a revisión quedan para cuando existan binarios y fichas verificadas.

## Verificaciones antes de entregar a testers

- Compilar Android e iOS sin errores nativos ni permisos innecesarios.
- NFC real en ambos sistemas: éxito, etiqueta inválida, revocación, cancelación, sin NFC y traslado.
- Micrófono: conceder/denegar, grabar/detener, interrupción y eliminación de temporales.
- PDF: importar, abrir original, discrepancia, duplicado, documento sin texto, límite de tamaño.
- Retomar borrador tras cerrar sesión/reabrir; verificar que no cambia el paciente.
- Pérdida de conexión y recuperación, renovación de sesión y expiración de contexto.
- VoiceOver/TalkBack, teclado, texto ampliado, iPhone/iPad y Android pequeño.
- Backend disponible para el revisor; credenciales de demo correctas y datos sintéticos recuperables.
- Capturas reales de los binarios finales, ficha veraz y declaraciones de datos consistentes.

## Requisitos consultados el 16 de septiembre de 2026

- Google Play exige API objetivo 36 para nuevas apps y actualizaciones de móvil. La configuración usa 36. [Requisitos oficiales](https://support.google.com/googleplay/android-developer/answer/11926878).
- Los envíos iOS deben usar el SDK iOS 26 o posterior desde el 28 de abril de 2026. Seleccionar un entorno EAS/Xcode compatible con SDK 57 y comprobar la imagen usada en el build. [Apple](https://developer.apple.com/news/?id=ueeok6yw).
- Las cuentas personales nuevas de Google Play pueden necesitar una prueba cerrada de 12 testers durante 14 días consecutivos. No es una tarea que pueda darse por completada al generar código. [Google Play](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB).
- Completar la declaración de apps de salud y las declaraciones de privacidad/data safety según el comportamiento real. [Formulario de salud](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en).
- Apple distingue una app final de una demo/beta: la distribución inicial de este prototipo corresponde a TestFlight. Una publicación pública requiere definir y completar su utilidad final, por ejemplo una simulación educativa, y pasar revisión; no se garantiza aprobación. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

## Riesgos de release pendientes

`react-native-nfc-manager` v4 beta declara soporte para nueva arquitectura, pero React Native Directory todavía lo marca como no probado. No ocultar ese aviso ni considerar la exportación JS como verificación del módulo nativo. Si las pruebas físicas fallan, sustituir o estabilizar la integración antes del envío.

La configuración local no debe exponerse a Internet tal cual. Revisar los controles de cargas PDF y cuotas descritos en `threat-model.md` antes de alojar un backend accesible públicamente.
