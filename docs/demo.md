# Recorrido de demostración

1. Iniciar API y app siguiendo README. Ingresar con `demo@rapiclinics.app` / `RapiDemo2026!` (solo entorno local).
2. Inicio → Iniciar ronda → Elegir cama de demostración → María González, 302-B → Confirmar paciente.
3. Registrar visita. Escribir: `Paciente ficticio refiere mejoría y niega dolor. Pendiente: revisar hemograma mañana.`
4. Preparar nota para revisión. Revisar evolución y pendiente; confirmar y guardar. Ver la nota en Historial y la tarea en Pendientes.
5. Repetir con Guardar borrador; volver al paciente y seleccionar Retomar borrador.
6. Documentos → Usar un PDF de ejemplo → Abrir original → confirmar revisión → Confirmar asociación.
7. Preparar envío simulado → Confirmar envío. Se muestra aceptación simulada.
8. Para discrepancia: importar `fixtures/pdfs/paciente-2.pdf` mientras María sigue activa. El identificador SIM-7315 bloquea la asociación.
9. Importar el mismo archivo dos veces para probar el rechazo por duplicado.

## Voz

En Android/iOS, conceder micrófono al grabar. Detener y pulsar Transcribir audio real. El audio se sube cifrado y Whisper lo procesa en el servidor. Conservar y revisar la transcripción original, corregir errores y consultar la propuesta conservadora de redacción. La primera ejecución puede descargar los pesos del modelo. No grabar información real.

## NFC

`python scripts/generate_nfc_tokens.py` desde la raíz imprime tokens de fixtures por cama; grabarlos como registro NDEF Text con una herramienta de tags. No escribir nombres, identificadores personales ni datos clínicos en la etiqueta. Probar lectura en una development build, no Expo Go. Los tokens son solo de demostración.
