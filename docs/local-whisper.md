# Transcripción local en Android

La app Android compilada usa `whisper.rn@0.7.4` con `ggml-tiny.bin` multilingüe (no `tiny.en`). La primera grabación descarga 77.691.713 bytes desde la revisión fija `5359861c739e955e79d9a303bcbc70fb988958b1` de `ggerganov/whisper.cpp`. Se descarga a un archivo temporal, se verifica estado HTTP y tamaño, y se mueve al almacenamiento privado. Una descarga fallida se puede reintentar. No se incluye el modelo en Git ni se descarga durante EAS.

El micrófono entrega PCM16 mono a 16 kHz mediante `@fugood/react-native-audio-pcm-stream@1.1.4`. Se convierte a float32 para `transcribeData`, con `language: es` y `translate: false`. El límite efectivo es de 180 segundos de muestras. El audio queda solo en memoria y desaparece al abandonar la pantalla; el modelo queda guardado para uso sin conexión. El texto se revisa y se envía por el endpoint existente `/draft`; no se llama a `/audio` ni `/transcribe` en el modo local. La transcripción local se conserva como texto editable; no se añade un campo de procedencia al servidor.

El botón de cambio a servidor descarta el audio local y requiere una nueva grabación. Solo el botón «Enviar audio y transcribir en servidor» sube esa grabación. No hay respaldo automático. Web, iOS y Expo Go conservan la ruta de servidor y no cargan módulos Whisper/PCM.

`buffer@6.0.3` se añade porque `safe-buffer`, usado internamente por Whisper, lo necesita al empaquetar con Metro. Las dos dependencias nativas quedan fijadas a las versiones inspeccionadas.

## Fuente de verdad de Android

`android/` continúa ignorado. `app.config.ts` registra `plugins/withPcmStop.cjs`, ejecutado en Expo prebuild/EAS. El plugin adapta el código de la dependencia 1.1.4: espera la liberación de AudioRecord antes de resolver stop, declara el indicador de grabación volatile y emite solo los bytes leídos. Es idempotente y falla explícitamente si cambia la versión o el código esperado. No se debe actualizar la dependencia sin revisar el plugin. No requiere cambios manuales en archivos nativos generados.

## Validación

Desde `apps/mobile`: `npm.cmd run typecheck`, `npm.cmd test` y `npx.cmd expo export --platform android --output-dir dist/whisper-check`. La exportación comprueba el bundle JavaScript; no compila Java/C++ ni verifica JSI o el micrófono real.

Antes de usar la función, generar un APK nuevo mediante Expo/EAS (pendiente; no ejecutado en esta tarea). Un APK anterior no contiene estas dependencias ni la corrección de stop. Verificar en teléfono:

1. Primera descarga con conexión; interrumpirla y reintentar. Denegar permiso del micrófono y comprobar que se puede escribir o cambiar a servidor.
2. Con modelo descargado, abrir una visita y desactivar red: grabar español, detener, transcribir y corregir. Restaurar conexión para guardar; comprobar en la API que solo llegan texto y solicitudes de visita.
3. Detener y volver a grabar repetidamente; salir al fondo durante grabación; alcanzar tres minutos. Comprobar que el micrófono se libera y la app no se bloquea.
4. Cambiar explícitamente a servidor, volver a grabar y verificar la ruta existente de subida. Revisar que un fallo local no suba audio.
5. Probar el NFC UID actual con el perfil `clinical-apk`, que conserva `NFC_UID_DEMO=1`.

Whisper tiny puede producir errores: revisar el texto antes de confirmar. La compatibilidad nativa con React Native 0.86 y el rendimiento en el dispositivo requieren el APK; los tests con dobles de módulos nativos no los demuestran.
