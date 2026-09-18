# Alojamiento gratuito para pruebas

Estado al 18 de septiembre de 2026: servidor desplegado en Render con PostgreSQL.
La comprobación HTTPS `/health` devuelve `status: ok`, `mode: clinical`; `/patients`
sin autorización devuelve 401. El arranque completó la creación del administrador.
URL: https://rapiclinics-api-test.onrender.com
El APK 1.1 sigue apuntando a la red local; la versión 1.2 se prepara con esta URL HTTPS.
Inicio de sesión con las credenciales del titular y NFC físico: pendientes de prueba.

## Crear el entorno

1. Crea una cuenta en https://dashboard.render.com/register. Usa el espacio gratuito.
2. Conecta GitHub autorizando únicamente el repositorio privado `Nicolasorti15/rapiclinics`.
3. Selecciona **New > Blueprint**, ese repositorio y la rama `main`. El archivo es `render.yaml`.
4. Comprueba que **ambos recursos** (servidor y PostgreSQL) muestran el plan **Free**.
   No elijas mejoras, discos, réplicas ni un espacio de trabajo de pago.
5. Introduce tu correo en `INITIAL_ADMIN_EMAIL` y una contraseña nueva de 12 a 128
   caracteres en `INITIAL_ADMIN_PASSWORD`. Se introducen solo en Render, nunca en GitHub ni en el chat.
6. El arranque aplica migraciones y crea la clínica «RAPICLINICS Pruebas» con tu cuenta ADMIN.
   No carga usuarios ni pacientes de demostración. Los reinicios no cambian contraseñas.
7. Cuando el servicio esté activo, comprueba su URL HTTPS y `/health`, inicia sesión y
   prueba el registro de un paciente ficticio, una invitación médica y el aislamiento de permisos.
8. Elimina `INITIAL_ADMIN_PASSWORD` de las variables de Render después del primer arranque
   correcto. Guarda de manera privada `STORAGE_ENCRYPTION_KEY`: perderla impide leer los adjuntos.

El backend toma `PUBLIC_API_URL` de `RENDER_EXTERNAL_URL`, usa la conexión interna
de PostgreSQL y bloquea conexiones externas a la base por defecto. CORS está vacío:
este despliegue permite clientes móviles nativos; para un cliente web debe agregarse su origen exacto.
El cifrado de la aplicación protege los archivos adjuntos; no implica cifrado por columna
de todos los datos clínicos. Las contraseñas se guardan mediante hash Argon2.

## Conectar Android

Después de comprobar el servidor, configurar `EXPO_PUBLIC_API_URL` con su URL HTTPS
y generar un nuevo APK nativo con NFC. El APK antiguo no cambia automáticamente.
Verificar en un Android físico: inicio de sesión, ADMIN crea paciente y escribe etiqueta,
médico lee y atiende, reinicio del servidor conserva datos. Para Google Play se necesita
además el AAB con firma de publicación y la cuenta Play Console del titular.

## Límites del entorno

- Solo pruebas con datos ficticios. PostgreSQL Free tiene 1 GB y vence a los 30 días;
  no ofrece copias administradas. No usarlo como archivo de historias reales.
- El servidor se suspende después de 15 minutos sin tráfico y puede tardar cerca de un minuto
  en despertar. Su disco es temporal; por eso los adjuntos se guardan en PostgreSQL.
- La transcripción usa Whisper `tiny` con un hilo para reducir consumo. Su precisión,
  tiempo de respuesta y memoria en este plan aún necesitan prueba en el servidor.
  No hay envío de audio a una IA de pago ni garantía de capacidad para transcripción.
- No hay correo automático de invitaciones ni recuperación de contraseña por correo.
- Publicar en Play no queda resuelto por desplegar el backend: faltan cuenta, firma,
  política de privacidad definitiva, flujos de eliminación de cuenta y revisión de requisitos.

Documentación: https://render.com/docs/free y https://render.com/docs/blueprint-spec.
