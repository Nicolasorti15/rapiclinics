# RAPICLINICS Android 1.2: pruebas por internet

El APK 1.2 usa https://rapiclinics-api-test.onrender.com y contiene NFC nativo.
No necesita Expo Go, Metro ni que el computador esté encendido.
El servidor y PostgreSQL están en Render Free; usar solo pacientes ficticios.

## Acceso y NFC

1. Instala el APK descargado. Android puede solicitar permiso para instalar desde el navegador.
2. Inicia sesión con el correo y contraseña que configuraste en Render.
   Las cuentas de demostración anteriores no funcionan en este servidor.
3. En Administración, registra un paciente ficticio con su número de documento de prueba,
   servicio y cama. Comprueba los datos antes de guardar.
4. Selecciona vincular NFC, activa NFC en Android y acerca una etiqueta NDEF vacía y escribible.
   Mantén la etiqueta en su sitio mientras se escribe y verifica. La etiqueta guarda un token,
   no el nombre, documento ni historia clínica del paciente.
5. Invita a un médico desde Administración. Comparte manualmente el código con quien
   probará la app: no hay envío automático por correo. El médico se registra por invitación.
6. Con la cuenta médica, lee la etiqueta, comprueba la identidad y confirma antes de atender.
   Solo ADMIN puede registrar pacientes y vincular etiquetas.

La firma del workflow es de desarrollo para instalación directa, no para Play Store.
Si Android indica conflicto de firma con una versión anterior, no borres la app sin
comprobar primero que no quedan borradores locales por conservar.

## Comprobaciones pendientes en dispositivo

- Inicio de sesión con la cuenta del administrador.
- Escritura, lectura, cancelación y revocación de NFC en Android físico.
- Prueba del médico invitado, guardado de historia y consulta tras cerrar sesión.
- Transcripción en Render Free: capacidad y precisión aún sin verificar.

El primer acceso después de inactividad puede tardar alrededor de un minuto.
Puedes comprobar el servicio en https://rapiclinics-api-test.onrender.com/health.
La base gratuita vence a los 30 días y no incluye copias administradas.
