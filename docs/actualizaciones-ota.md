# Actualizaciones sin reinstalar el APK

RAPICLINICS 1.4.0 usa EAS Update. El APK `clinical-apk` queda asociado al canal `production` y comprueba una actualización compatible cada vez que se abre desde cero. Si la encuentra, la descarga, la aplica y continúa con la versión nueva. Si no hay conexión, abre la versión instalada.

## Publicar un cambio

Desde `apps/mobile`, después de probar y subir el commit a GitHub:

```powershell
npx eas-cli update --channel production --platform android --message "Descripción del cambio"
```

Las actualizaciones OTA pueden cambiar JavaScript, TypeScript y recursos incluidos en el paquete. Un cambio de Expo SDK, permisos, plugins, identificador de aplicación o dependencias nativas requiere incrementar la versión de la app y generar un APK nuevo. La política `appVersion` impide que una actualización incompatible llegue a un APK antiguo.

El perfil `preview` permite validar primero con:

```powershell
npx eas-cli update --channel preview --platform android --message "Prueba del cambio"
```

No publicar directamente a `production` sin comprobar inicio de sesión, identificación del paciente, borradores, NFC y guardado de la evolución.
