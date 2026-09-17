# RAPICLINICS en Expo Go

Esta variante gratuita abre la demo dentro de Expo Go, sin firmar una app iOS propia. Usa SDK 57. Actualiza Expo Go a una versión compatible desde https://expo.dev/go.

1. Instalar Expo Go en el iPhone.
2. Conectar iPhone y computador a la misma red privada, evitando redes de invitados con aislamiento.
3. En este computador, ejecutar `INICIAR_EXPO_GO.bat`. Detecta la dirección de la red privada, inicia la API si no está escuchando en 8083 y muestra el QR de Expo en el puerto 8084.
4. Escanear el QR con Cámara y abrir en Expo Go. Permitir el acceso a la red local si iOS lo solicita. Si Windows solicita acceso de Node.js, permitir únicamente la red privada.
5. Entrar con `demo@rapiclinics.app` y `RapiDemo2026!`. Seleccionar una cama y confirmar la identidad ficticia.

El lanzador utiliza Node.js y no requiere habilitar scripts de PowerShell ni cambiar la política de ejecución de Windows. Para comprobar rutas y red sin iniciar servidores: `node scripts/start_expo_go.cjs --check`.

Pacientes, notas, pendientes, audio y laboratorio conservan sus flujos. NFC se oculta y su módulo nativo no se inicializa dentro de Expo Go; continúa disponible en una compilación propia. La prueba física en iPhone queda pendiente hasta abrir el QR. El servidor local debe permanecer encendido. No es una publicación permanente en Expo ni en App Store.

Para detener Metro, pulsar Ctrl+C en su ventana. La API puede continuar en segundo plano. Esta conexión HTTP de red local es exclusivamente para los datos ficticios de la demo.
