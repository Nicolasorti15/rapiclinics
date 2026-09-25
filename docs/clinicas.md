# Clínicas, equipo asistencial, pacientes y NFC

La versión 1.1 incorpora cuentas por clínica, invitaciones para médicos, pacientes identificados por cédula de ciudadanía y administración de NFC. El APK local sigue conectado al entorno de pruebas. La instalación clínica necesita un servidor configurado y los datos del primer administrador; todavía no están definidos por el propietario.

## Acceso

- **ADMIN:** registra pacientes, escribe/activa/revoca etiquetas, invita al equipo y desactiva cuentas. No se obtiene este rol por escribir un correo específico. El primer administrador se crea desde la consola del servidor.
- **PHYSICIAN y NURSE:** consultan los pacientes activos de su clínica por nombre, cédula, habitación o NFC. Pueden abrir la ficha de cualquier servicio; la escritura clínica continúa limitada al servicio principal asignado.
- **RECORDS_ADMIN:** consulta e identifica pacientes de toda la clínica y gestiona documentación, pero la app no le muestra la acción de crear evoluciones.
- Las invitaciones caducan en 24 horas y sirven una sola vez para el correo y rol indicados. Solo se almacena su hash. La persona establece una contraseña de al menos 8 caracteres, sin exigir símbolos ni mayúsculas en «Tengo una invitación». ADMIN comparte el código personalmente por un canal laboral; la app no envía correo ni afirma haber verificado automáticamente la titularidad del buzón.
- Se puede exigir un dominio laboral exacto por clínica. En esta versión un correo pertenece a una única cuenta/clínica; membresías de un mismo médico en varias clínicas necesitan una ampliación del modelo.
- Las contraseñas se guardan con Argon2. Desactivar a un integrante revoca sus sesiones y conserva los registros clínicos.

## Pacientes y etiquetas

ADMIN abre «Administrar clínica → Registrar paciente». Introduce nombre, CC sin puntos, nacimiento, sexo, servicio y cama. Revisa la identidad antes de confirmar. La combinación clínica/CC es única: una clínica no puede consultar el registro de otra, aunque ambas hayan ingresado a la misma persona. Esta validación evita duplicados; no verifica la cédula contra la Registraduría.

El alta hospitalaria cierra el episodio y la asignación de cama con una misma fecha y hora, y revoca la etiqueta NFC del ingreso. No elimina al paciente ni sus evoluciones, documentos, resultados o pendientes. Si regresa, ADMIN busca la cédula y crea un nuevo ingreso indicando únicamente el nuevo servicio y cama; la identidad y la historia continúan en el mismo registro. Solo puede existir un ingreso activo por paciente.

Después puede escribir una etiqueta **NDEF vacía** desde el teléfono. Se guarda un token aleatorio, nunca la cédula ni la historia. La app rechaza etiquetas que ya contienen otros datos. Primero escribe, después solicita retirar y volver a acercar la etiqueta; solo al verificar el token se activa el vínculo en el servidor. La etiqueta queda ligada al paciente, no al correo del teléfono. La lectura sigue requiriendo iniciar sesión, tener acceso al episodio y confirmar la identidad.

Desde la ficha del paciente, ADMIN puede volver a «Administrar etiqueta NFC». Activar una sustituta revoca las anteriores. Revocar una etiqueta invalida también los contextos NFC abiertos. Una etiqueta NDEF puede copiarse: su posesión nunca concede acceso por sí sola.

## Base de datos y despliegue

La migración `9a004` conserva los datos existentes dentro de la clínica aislada `demo`. En `APP_MODE=clinical`, sus cuentas, PDF de ejemplo, identificación demo y envío EHR simulado están bloqueados. No se ejecuta el seed de demostración.

En modo clínico se almacenan registros y archivos cifrados en la base de datos (`stored_objects`). Conserva una copia independiente de `STORAGE_ENCRYPTION_KEY`: perderla impide recuperar audio y documentos. La base de datos completa y su volumen necesitan protección de acceso, cifrado en reposo y copias de seguridad verificadas en el servidor.

1. Preparar un servidor con Docker y un dominio con HTTPS mediante proxy inverso. Definir `POSTGRES_PASSWORD`, `STORAGE_ENCRYPTION_KEY`, `PUBLIC_API_URL` y `CORS_ORIGINS` en un archivo `.env` privado. No reutilizar las claves de ejemplo. Codificar caracteres reservados de la contraseña cuando se utilice dentro de una URL de conexión.
2. Ejecutar `docker compose -f docker-compose.clinical.yml up -d --build`. Solo el puerto local 8000 se expone al proxy. El dominio HTTPS debe llegar a ese puerto. Este archivo no crea por sí mismo certificados ni un dominio.
3. Ejecutar `docker compose -f docker-compose.clinical.yml exec api python -m app.create_clinic`. Introducir clínica, dominio laboral opcional, correo/nombre de ADMIN y contraseña en el prompt oculto. No hay un endpoint público que permita hacerse administrador.
4. Configurar `EXPO_PUBLIC_API_URL` con la URL HTTPS y `APP_IDENTIFIER` con el identificador definitivo, y compilar el perfil EAS `clinical-apk` para instalación interna, o `production` para AAB. El APK local previo no apunta automáticamente al nuevo servidor.
5. Probar con cuentas de dos clínicas y datos sintéticos: registro, invitación, inicio/cierre de sesión, alta, duplicados de CC, escritura/lectura/revocación NFC, notas y documentos; restaurar una copia de seguridad antes de la puesta en servicio.

El código incorpora controles y pruebas, pero aún no se ha desplegado en una institución ni validado con NFC físico. Faltan el servidor/dominio, la clínica y administrador reales, validación de operación y recuperación y las políticas de tratamiento/conservación definidas por la institución. No hay conexión a un EHR real ni envío automático de correos. La recuperación de contraseñas requiere intervención operativa; no existe todavía un flujo de recuperación por correo.
