# Entrega móvil de RAPICLINICS

Todavía no se han generado APK/IPA firmados. La vista web no es un instalador móvil.

Estado del propietario al preparar esta entrega: cuenta gratuita de Apple creada; Expo aún pendiente. La cuenta gratuita no habilita la distribución ad hoc de EAS. [Requisitos oficiales](https://docs.expo.dev/build/internal-distribution/).

## Preparación del propietario

1. Crear una cuenta de [Expo](https://expo.dev/signup). EAS permite compilar en la nube desde Windows; revisar sus límites y condiciones antes de solicitar builds.
2. Para distribuir a iPhone mediante EAS, disponer de Apple Developer. La prueba puede distribuirse por dispositivos registrados o TestFlight. [Distribución interna](https://docs.expo.dev/build/internal-distribution/).
3. Preparar una API HTTPS alcanzable desde el teléfono, un identificador de app propio y el proyecto EAS. No publicar el servidor local de esta demo tal cual.
4. En `apps/mobile`, ejecutar `npx eas-cli login` y `npx eas-cli init`. Iniciar sesión personalmente; no compartir contraseñas por chat.
5. Configurar `EXPO_PUBLIC_API_URL`, `EAS_PROJECT_ID` y `APP_IDENTIFIER` en el entorno **preview** de EAS. El código exige estos valores para el perfil `device` y rechaza direcciones localhost/emulador.

## Android: APK instalable de prueba

```powershell
cd apps/mobile
npx eas-cli build --profile device --platform android
```

El perfil `device` genera un APK sin depender de Metro. Una vez que la compilación termine, descargar el APK desde el resultado de EAS e instalarlo en el Android de pruebas. Google Play Console no es necesaria para esta instalación directa; sí para la futura distribución por Play Store. Falta ejecutar y verificar el build.

## iPhone: dispositivo físico

La ruta preparada desde Windows es **Expo EAS + distribución interna ad hoc**. Requiere cuenta Expo, membresía de pago Apple Developer, registro del iPhone y una API accesible desde el teléfono. Safari, la vista web, Expo Go y el simulador no prueban el lector NFC de esta app. Sin esas cuentas aún no podemos entregar un IPA instalable. No se ha contratado ningún servicio ni iniciado un build de pago.

```powershell
cd apps/mobile
npx eas-cli device:create
npx eas-cli build --profile device --platform ios
```

Registrar el iPhone y configurar la firma con Apple Developer mediante los flujos de EAS. La instalación interna se limita a los dispositivos incluidos en el perfil. El perfil antiguo `preview` se mantiene para **simulador iOS** y no puede instalarse en un iPhone. [Guía oficial](https://docs.expo.dev/build/internal-distribution/).

Una vez instalado: iniciar sesión → identificar por NFC → acercar la parte superior del iPhone a una etiqueta NDEF de la demo → comprobar cama e identidad → confirmar. Programar el registro de texto con el token exacto de `fixtures/etiquetas-nfc-demo.json`, según [configurar NFC](configurar-nfc.md). La etiqueta lleva un identificador opaco, no historia clínica. Hay que comprobar físicamente permisos, cancelación, etiqueta inválida y lectura repetida antes de dar NFC por validado.

Para TestFlight se usa el perfil `production`, firma y envío a App Store Connect, seguido de la configuración de testers. No se ejecuta un envío hasta tener una compilación comprobada y la ficha necesaria. [TestFlight](https://docs.expo.dev/submit/testflight/).

## Comprobación en ambos teléfonos

Inicio de sesión → seleccionar cama → confirmar identidad → guardar y retomar borrador → confirmar visita → completar/reabrir pendiente → importar y visualizar PDF. Después verificar micrófono, denegación de permisos, interrupciones y NFC según [la guía NFC](configurar-nfc.md).

El equipo de desarrollo actual no tiene JDK/SDK Android ni macOS/Xcode; tampoco hay cuentas vinculadas. Estos pasos son la ruta de compilación preparada, no evidencia de instaladores ya disponibles.
