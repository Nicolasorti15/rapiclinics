# Prueba Android con tarjeta reutilizada

Esta variante permite leer la tarjeta UID `0FC401B6` y utilizar el token público
de la cama ficticia **302-B**, ya definido en `fixtures/etiquetas-nfc-demo.json`.
La asociación vive en el APK de prueba. No registra ni modifica una tarjeta en el
servidor y no escribe datos, formatea ni autentica sectores en la tarjeta.

## Compilación

Usar estas variables tanto al generar el proyecto Android como al compilar:

```text
APP_VARIANT=device
APP_IDENTIFIER=app.nicolasorti.rapiclinics.nfctest
NFC_UID_DEMO=1
EXPO_PUBLIC_API_URL=https://rapiclinics-api-test.onrender.com
```

Ejecutar `npm ci`, `npx expo prebuild --platform android --no-install` y,
desde `apps/mobile/android`, `gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a`.
La firma local de prueba permite instalar esta variante junto al APK original.
No se utiliza la firma del editor ni se cambia la aplicación original.

## Prueba en el Samsung

1. Cerrar la aplicación anterior «NFC solo lectura» y detener su receptor Python.
2. Instalar y abrir **RAPICLINICS NFC prueba**. Activar NFC.
3. Iniciar sesión en el servidor de demostración con una cuenta autorizada.
4. Entrar en **Iniciar ronda → Leer etiqueta NFC** y acercar la tarjeta `0FC401B6`.
5. El lector reconoce el UID y envía el token de demostración a `/nfc/resolve`.
6. Revisar la cama y la identidad ficticia que devuelva el servidor antes de confirmar.

No utilizar «Escribir etiqueta vacía» ni «Vincular NFC al paciente» para esta
tarjeta: esas pantallas conservan su flujo original de escritura NDEF.

El servidor debe contener la etiqueta demo 302-B, activa, y una asignación vigente
accesible a la cuenta. Si aparece «Etiqueta no registrada o revocada», la detección
puede haber funcionado: hay que revisar los datos del servidor. La app no inventa
un paciente ni evita la autorización para resolver ese error.

## Comportamiento

- Android solicita primero NDEF y acepta NFC-A como alternativa en esta variante.
- Un registro de texto NDEF válido tiene prioridad y conserva el comportamiento anterior.
- Si no hay registro de texto, solo el UID configurado se asocia a la cama demo.
- La segunda tarjeta `5C0B78B6` y otras tarjetas sin NDEF se rechazan.
- Un NDEF de texto malformado no queda oculto por la asociación UID.
- Se mantiene cancelación, límite de 25 segundos y cierre de la sesión NFC.
- El UID no es una contraseña ni prueba de identidad: el servidor sigue exigiendo
  sesión, permisos, asignación activa y confirmación del paciente.
- La función está desactivada por defecto, no se habilita en iOS, y la configuración
  rechaza `APP_VARIANT=production` junto a `NFC_UID_DEMO=1`.

Las pruebas automatizadas simulan el hardware. El funcionamiento NFC completo
debe comprobarse con este APK en el Samsung; las lecturas anteriores corresponden
a la aplicación auxiliar y no sustituyen esa prueba.
