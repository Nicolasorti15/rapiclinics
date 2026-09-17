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

La firma de las compilaciones EAS se gestiona con EAS; no subir la clave de firma ni contraseñas al repositorio. Este perfil es para pruebas con datos ficticios y no para publicación en Google Play.

También existe el workflow `Android NFC demo APK` en GitHub Actions. Genera un APK con JavaScript incluido y firma de desarrollo para instalación directa; verifica la firma y el permiso NFC antes de guardar el artefacto `RAPICLINICS-Android-NFC-demo`. No utiliza la clave de EAS. Si se alternan APK de ambas procedencias, Android puede exigir desinstalar la versión anterior por diferencia de firma (se pierde la sesión local).

## Instalar y probar

1. Descarga el APK en el teléfono. Si viene de GitHub Actions, inicia sesión con una cuenta con acceso al repositorio privado y extrae el ZIP del artefacto.
2. Abre el archivo `.apk` y permite la instalación desde la aplicación que lo abre cuando Android lo solicite.
3. En este computador ejecuta `INICIAR_SERVIDOR_ANDROID.bat` y mantén el equipo encendido. Conecta el teléfono a la misma red local, sin aislamiento de invitados.
4. Abre RAPICLINICS y entra con `demo@rapiclinics.app` / `RapiDemo2026!` (cuenta pública de la demo con pacientes ficticios).
5. Activa NFC en Android y prepara la etiqueta de la cama 302-B con la guía enlazada abajo.
6. Entra en **Iniciar ronda → Leer etiqueta NFC**, acerca la etiqueta y comprueba **María González · SIM-7314 · 302-B** antes de confirmar.

Si no conecta, abre `http://192.168.1.4:8083/health` en el navegador del teléfono. Debe mostrar `status: ok`. Si tampoco abre, revisa la red local y que el servidor esté ejecutándose; reinstalar el APK no resuelve ese problema de conexión.

Al terminar el build, instalar el APK en el Android y entrar con la cuenta de demostración. Preparar una etiqueta NDEF de texto siguiendo [configurar NFC](configurar-nfc.md). Probar lectura, cancelación, NFC desactivado y confirmación de identidad antes de declarar validado el hardware.
