# Audio y redacción clínica: estado y propuesta

## Implementado

En modo servidor, el audio se guarda cifrado en RAPICLINICS y se transcribe con faster-whisper `base`, CPU int8 y español fijo. En Android, el modo local usa Whisper base cuantizado y conserva el audio solo en memoria. Ninguna ruta envía el audio a una API externa de IA. El máximo es de 3 minutos; el procesamiento consume recursos, pero no genera cobros por petición.

La visita conserva por separado la transcripción original y el texto editable del médico. En Android, Qwen3 0.6B se prepara después de transcribir y solo genera una redacción opcional; la evolución, los pendientes, las incertidumbres y sus fragmentos fuente se construyen de forma determinista. La salida admite texto alrededor del JSON y, si el modelo tarda más de 2,5 segundos, falla o entrega contenido no fundamentado, se usa inmediatamente la propuesta conservadora. El servidor vuelve a comprobar que la redacción no introduzca vocabulario clínico ni cifras ausentes. Toda propuesta exige revisión antes de confirmar.

Prueba real con voz española sintética: el modelo transcribió el audio, pero convirtió «treinta y siete» en «30 y 7» y «revisar hemograma» en «revisaremos grama». Esto demuestra funcionamiento técnico, no precisión clínica. No se corrigen automáticamente estos errores suponiendo qué quiso decir el médico.

## Siguiente etapa propuesta: redactor local

1. Audio original → Whisper → transcripción original inmutable.
2. El médico corrige la transcripción y solicita «Proponer mejor redacción».
3. Un modelo de lenguaje en el servidor, mediante un servicio local como Ollama, recibe solo esa transcripción. Seleccionar el modelo después de medir memoria, latencia, licencia y calidad en español; no hay un modelo generativo instalado o elegido aún.
4. La respuesta estructurada contiene `suggested_text`, `source_spans` y `uncertainties`. La instrucción limita la tarea a orden, gramática y cohesión: no añadir diagnósticos, dosis, signos vitales, tratamientos ni causalidad.
5. Validadores cotejan números, unidades, fármacos, temporalidad y negaciones; las discrepancias bloquean la aceptación automática y señalan el fragmento. Estas comprobaciones reducen errores, pero no garantizan equivalencia semántica.
6. Pantalla con original, propuesta y diferencias. El médico puede editar, aceptar o rechazar. Solo una confirmación explícita guarda la versión final. Registrar modelo, versión, propuesta, correcciones, autor y fecha para auditoría.

No usar la propuesta como fuente de una gráfica de laboratorio. Los valores de laboratorio deben provenir del informe original y pasar su propia validación.

## Criterios antes de habilitar el modelo

- Conjunto de dictados ficticios con cifras, decimales, unidades, negaciones, dudas y autocorrecciones; evaluación por un revisor clínico.
- Ninguna adición factual aceptada silenciosamente; discrepancias visibles y conservando el original.
- Ensayos de silencio, ruido, desconexión, timeout y concurrencia; sin reintentos que dupliquen visitas.
- Medir latencia en el servidor real y comparar modelos de transcripción antes de aumentar su tamaño.
- Mantener el formateador conservador cuando el modelo no esté disponible.

Un servicio externo gratuito podría añadirse como proveedor opcional, pero sus cuotas, tratamiento de datos y condiciones deben verificarse al elegirlo. No hay un proveedor externo activado ni una garantía de gratuidad futura.
