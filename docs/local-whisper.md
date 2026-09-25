# Transcripción local en Android

La app Android compilada usa `whisper.rn@0.7.4` con `ggml-base-q5_1.bin` multilingüe. La primera grabación descarga 59.707.625 bytes desde la revisión fija `5359861c739e955e79d9a303bcbc70fb988958b1` de `ggerganov/whisper.cpp`. Se descarga a un archivo temporal, se verifica estado HTTP y tamaño, y se mueve al almacenamiento privado. Una descarga fallida se puede reintentar. No se incluye el modelo en Git ni se descarga durante EAS. Al instalarlo se eliminan los modelos `tiny`, `base` completo y `small` anteriores para recuperar espacio.

El micrófono entrega PCM16 mono a 16 kHz mediante `@fugood/react-native-audio-pcm-stream@1.1.4`. La app empieza a cargar Whisper mientras el médico dicta, conserva el contexto durante la visita y recorta únicamente el silencio claro del inicio y del final. La primera pasada usa Whisper base Q5 (60 MB), español fijo, haz 2 y contexto de exploración física, signos vitales, abreviaturas, medicamentos y laboratorios frecuentes. Si el médico detecta errores, «Reintentar con mayor precisión» procesa el mismo audio con Whisper small Q5 (190 MB) y haz 4; ambos modelos se descargan una sola vez y funcionan sin conexión. El límite efectivo es de 180 segundos. Antes de transcribir se calcula duración, RMS, pico y proporción de muestras recortadas; una grabación menor de un segundo, prácticamente silenciosa o saturada se rechaza con una indicación concreta. El audio queda solo en memoria y desaparece al abandonar la pantalla. El texto se revisa y se envía por `/draft`; no se llama a `/audio` ni `/transcribe` en el modo local. El servidor conserva por separado la primera transcripción automática y la corrección del médico.

El botón de cambio a servidor descarta el audio local y requiere una nueva grabación. Solo el botón «Enviar audio y transcribir en servidor» sube esa grabación. No hay respaldo automático. Web, iOS y Expo Go conservan la ruta de servidor y no cargan módulos Whisper/PCM.

`buffer@6.0.3` se añade porque `safe-buffer`, usado internamente por Whisper, lo necesita al empaquetar con Metro. Las dos dependencias nativas quedan fijadas a las versiones inspeccionadas.

## Fuente de verdad de Android

`android/` continúa ignorado. `app.config.ts` registra `plugins/withPcmStop.cjs`, ejecutado en Expo prebuild/EAS. El plugin adapta el código de la dependencia 1.1.4: espera la liberación de AudioRecord antes de resolver stop, declara el indicador de grabación volatile y emite solo los bytes leídos. Es idempotente y falla explícitamente si cambia la versión o el código esperado. No se debe actualizar la dependencia sin revisar el plugin. No requiere cambios manuales en archivos nativos generados.

## Validación

Desde `apps/mobile`: `npm.cmd run typecheck`, `npm.cmd test` y `npx.cmd expo export --platform android --output-dir dist/whisper-check`. La exportación comprueba el bundle JavaScript; no compila Java/C++ ni verifica JSI o el micrófono real.

El APK clínico 1.4.0 ya contiene las dependencias nativas; los cambios de modelo, parámetros y control de calidad se distribuyen por EAS Update. Verificar en teléfono:

1. Primera descarga con conexión; interrumpirla y reintentar. Denegar permiso del micrófono y comprobar que se puede escribir o cambiar a servidor.
2. Con modelo descargado, abrir una visita y desactivar red: grabar español, detener, transcribir y corregir. Restaurar conexión para guardar; comprobar en la API que solo llegan texto y solicitudes de visita.
3. Detener y volver a grabar repetidamente; salir al fondo durante grabación; alcanzar tres minutos. Comprobar que el micrófono se libera y la app no se bloquea.
4. Cambiar explícitamente a servidor, volver a grabar y verificar la ruta existente de subida. Revisar que un fallo local no suba audio.
5. Probar NFC físico con el perfil `clinical-apk`; el modo UID simulado permanece desactivado.

Whisper puede producir errores incluso con el modelo mejorado: revisar nombres, medicamentos, dosis, cifras y negaciones antes de confirmar. La compatibilidad nativa y el rendimiento real requieren validación en teléfonos representativos; los tests con dobles de módulos nativos no lo demuestran.
