# Publicidad de RAPICLINICS

La versión 1.3.0 incorpora un banner de Google AdMob al final del inicio de Android. Se desmonta al abandonar esa pantalla o pasar la app a segundo plano. No hay anuncios en consultas, NFC, historias, audio ni resultados. Web y Expo Go no cargan el SDK. iOS aún no activa anuncios.

## Estado actual

Por defecto se usan exclusivamente los identificadores de demostración oficiales de Google, incluso en APK release. Los anuncios de prueba no generan ingresos. Falta comprobar el banner en un Android físico y vincular la cuenta del propietario para monetizar.

Las solicitudes son no personalizadas, con clasificación máxima G y personalización del editor desactivada. El componente no recibe pacientes, usuarios, clínicas, correos ni documentos. Esto no impide que Google procese datos técnicos del dispositivo y la conexión. No se instalan mediadores ni analítica publicitaria adicional.

En modo real se consulta UMP antes de inicializar publicidad; si falla o no permite solicitudes, no se muestran anuncios. Cuando Google exige opciones de privacidad, el inicio ofrece su formulario. La medición automática del SDK se retrasa. El modo de prueba con la app de ejemplo de Google no ejecuta el formulario UMP; debe probarse con la app propia antes de activar ingresos.

## Configuración del propietario

1. Crear una cuenta en https://admob.google.com/ con el país y datos de pagos correctos. No compartir contraseñas por chat.
2. Agregar RAPICLINICS para Android. Mientras no esté publicada, indicarlo. El paquete del APK de pruebas actual es `app.nicolasorti.rapiclinics.demo`; confirmar el identificador definitivo antes de publicar en una tienda.
3. Crear un bloque de anuncios de tipo **Banner**, llamado por ejemplo `Inicio`.
4. Copiar el **ID de aplicación** (`ca-app-pub-…~…`) y el **ID del bloque** (`ca-app-pub-…/…`). Son identificadores de configuración, no contraseñas.
5. Configurar Privacidad y mensajes en AdMob y revisar los controles de bloqueo de categorías para una app profesional de salud. Publicar y vincular una política de privacidad pública que explique el uso de AdMob y sus datos técnicos.
6. Publicar `app-ads.txt` con la línea exacta de la cuenta en la raíz del sitio web del desarrollador. Vincular ese sitio en la ficha de una tienda compatible. No usar un ID de editor inventado.
7. Completar la verificación y revisión de preparación de AdMob. Publicar un APK por sí solo no garantiza anuncios reales ni ingresos.

## Compilación

Variables disponibles en el entorno que compila el APK (no en el servidor Render):

| Variable | Valor |
| --- | --- |
| `ADMOB_MODE` | `test` por defecto; `live` solo después de configurar la cuenta |
| `ADMOB_ANDROID_APP_ID` | ID de aplicación propio con `~` |
| `ADMOB_ANDROID_BANNER_ID` | ID del banner propio con `/` |

El modo live rechaza IDs ausentes, mal formados o de muestra. Cambiar IDs exige recompilar e instalar el nuevo APK. El workflow Android usa anuncios de prueba por defecto.

Antes de distribuir con anuncios reales: probar consentimiento y revocación con dispositivos de prueba de UMP, volver al inicio tras revocar, falta de red, error de carga, cierre de sesión y navegación hacia pantallas clínicas. Confirmar en Play Console que contiene anuncios y actualizar Seguridad de los datos con el comportamiento real del SDK. No hacer clic en anuncios reales propios para probar o aumentar ingresos.

Referencias: https://support.google.com/admob/answer/14538460 y https://support.google.com/admob/answer/10564477.
