# RAPICLINICS — borrador de política de privacidad

**No publicar este borrador sin completar responsable, contacto, hosting y conservación.**

RAPICLINICS es una demostración de rondas hospitalarias con datos sintéticos. No debe utilizarse para almacenar información de pacientes reales.

## Responsable y contacto

Pendiente: nombre legal del responsable y correo de privacidad/soporte.

## Información procesada

La app procesa credenciales de cuentas de prueba, notas escritas, pendientes, audios grabados voluntariamente, PDFs seleccionados y registros de acciones. Aunque la app solicita utilizar contenido ficticio, un archivo o audio podría contener datos personales si el usuario los introduce. No se debe declarar que la app «no recopila datos» mientras envíe contenido a un servidor.

La grabación solicita permiso de micrófono. La identificación por cama usa NFC. La app no solicita ubicación, contactos ni acceso general a la biblioteca de fotos.

## Finalidad

Demostrar identificación, revisión humana, notas, tareas, validación documental y trazabilidad. La transcripción se procesa con un modelo local en el servidor; el envío a historia clínica es simulado. No se envía el audio a una API externa de IA. No se ofrece diagnóstico ni tratamiento.

## Almacenamiento y destinatarios

Las notas y los metadatos se almacenan en el backend configurado. PDFs y audios se almacenan cifrados. Las credenciales de sesión se guardan mediante Keychain/Keystore en el teléfono. No hay publicidad ni SDK de analítica; el contenido no se envía a proveedores externos de IA.

Pendiente: identificar proveedor de infraestructura, país/región del servidor, medidas de transporte y destinatarios del entorno finalmente desplegado.

## Conservación y eliminación

Pendiente: definir un plazo concreto de conservación, procedimiento operativo de borrado y canal de solicitudes. La demo no crea cuentas personales desde la app. Cerrar sesión elimina las credenciales locales; no borra automáticamente los documentos y notas del servidor.

## Publicación

Publicar la política final en una URL HTTPS accesible y mantenerla coherente con las declaraciones de las tiendas y la pantalla de privacidad. Actualizarla cuando cambien proveedores, permisos, finalidades o conservación.
