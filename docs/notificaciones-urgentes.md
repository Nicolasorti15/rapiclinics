# Notificaciones de pendientes urgentes

RAPICLINICS 1.5 permite que personal clínico del servicio marque o desmarque un pendiente abierto como urgente. Los urgentes aparecen primero en la lista y conservan su prioridad en la base de datos y en la auditoría.

Cada teléfono debe activar el permiso en **Mi cuenta → Activar notificaciones**. El servidor registra el token del dispositivo para la cuenta que inició sesión y lo desactiva al cerrar sesión. Cuando otra persona eleva la prioridad, se avisa a las cuentas activas que pueden consultar los pendientes de ese servicio y a los administradores de la clínica.

La notificación visible es deliberadamente genérica: no incluye nombre, cédula, habitación, descripción del pendiente ni identificadores clínicos. Al abrirla, la persona debe autenticarse y consultar RAPICLINICS. Los tokens se usan únicamente para estas alertas.

La entrega remota utiliza Expo Push Service. En Android productivo se deben cargar credenciales FCM v1 del proyecto Firebase en EAS; en iOS se requieren credenciales APNs asociadas a la membresía Apple Developer. Sin esas credenciales la prioridad y la interfaz funcionan, pero el proveedor no puede entregar una alerta con la app cerrada.

`expo-notifications` añade código nativo, por lo que esta versión requiere instalar el APK 1.5 una vez. Después, los cambios compatibles con el runtime 1.5 pueden llegar mediante EAS Update.
