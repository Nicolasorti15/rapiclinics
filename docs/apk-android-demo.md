# APK Android para probar NFC

El perfil `android-demo` genera un APK instalable independiente de Expo Go. Incluye el lector NFC y el código JavaScript dentro del paquete; no necesita Metro.

Configuración de esta demo: paquete `app.nicolasorti.rapiclinics.demo`, servidor `http://192.168.1.4:8083`. Es una dirección de red local, no un servicio público. El teléfono debe estar en la misma red que este computador. Si cambia la dirección del computador, este APK necesitará una nueva configuración/compilación.

Para mantener disponible el servidor, ejecutar `INICIAR_SERVIDOR_ANDROID.bat`. El computador debe seguir encendido. No se ejecuta Expo Go para esta variante.

Compilación (cuenta Expo con acceso al proyecto y cuota disponible):

```powershell
cd apps/mobile
npx eas-cli login --browser
npx eas-cli build --platform android --profile android-demo
```

La firma Android se gestiona con EAS; no subir la clave de firma ni contraseñas al repositorio. Este perfil es para pruebas con datos ficticios y no para publicación en Google Play.

Al terminar el build, instalar el APK en el Android y entrar con la cuenta de demostración. Preparar una etiqueta NDEF de texto siguiendo [configurar NFC](configurar-nfc.md). Probar lectura, cancelación, NFC desactivado y confirmación de identidad antes de declarar validado el hardware.
