# RAPICLINICS — arquitectura

Demo de rondas con pacientes ficticios. La app es React Native/TypeScript con Expo SDK 57 y development builds; la vista web permite revisar el flujo, pero NFC requiere un binario nativo y un teléfono compatible.

## Componentes

- `apps/mobile`: React Navigation, componentes reutilizables, cliente API con renovación de sesión y Keychain/Keystore en dispositivos. No se guardan credenciales en almacenamiento web.
- `services/api`: FastAPI, SQLAlchemy 2, Alembic. SQLite permite ejecutar la demo en este Windows sin Docker; PostgreSQL es el destino de Compose.
- `ObjectStorage`: PDFs y audios cifrados con Fernet, en disco privado local o MinIO/S3. La clave debe conservarse y respaldarse por separado del objeto.
- `providers.py`: contratos independientes para STT, estructuración, extracción, resumen y EHR. STT devuelve explícitamente un ejemplo; estructuración y resumen son extractivos deterministas, sin llamadas a IA externa.
- Auditoría append-only desde la API: no se ofrecen operaciones para modificar o borrar eventos.

## Integridad

NFC resuelve etiqueta → asignación → episodio → paciente. La confirmación crea un contexto limitado a la persona y al profesional, con caducidad. Antes de escribir se verifican de nuevo la asignación, el estado del episodio y la revocación del tag. Las visitas toman el paciente del contexto del servidor, nunca de una propuesta de IA.

Un PDF conserva un paciente candidato mientras está en revisión. Su asociación definitiva permanece nula hasta validar. Las discrepancias bloquean la validación, también con confirmación manual. SHA-256 se calcula sobre el original y se verifica al descargar. La extracción es una entidad separada.

Restricciones SQL: una asignación activa por cama y episodio; relación consistente paciente/episodio; una visita confirmada exige revisor y fecha; un documento validado exige asociación y validación humana, sin discrepancia.

## Decisiones y límites

- Sesiones opacas aleatorias en vez de JWT: únicamente sus hashes se almacenan; permite revocación inmediata. Access 15 minutos, refresh rotatorio de 7 días.
- La demo incluye selección de cama sin NFC para revisión de tiendas y emuladores. Siempre requiere confirmar al paciente.
- Rol y servicio hospitalario se verifican en el backend. La API nunca ofrece búsqueda pública de pacientes.
- Los borradores se guardan en servidor y se retoman después de confirmar el mismo paciente/episodio. Sin sincronización offline persistente en esta versión; no hay caché clínica desprotegida.
- La detección de identidad documental reconoce identificadores sintéticos `SIM-0000`. No afirma validar cualquier formato de historia clínica.
- PDFs: tamaño máximo 10 MB y 100 páginas; se rechazan archivos corruptos, cifrados o con indicadores de contenido activo. No sustituye un escáner antivirus ni aislamiento del parser para despliegues expuestos.
- PDFs nativos se abren con el selector/visor del sistema; los temporales se eliminan al cerrar el diálogo. No es un visor PDF propio.
- OCR, QR, STT real, IA generativa, métricas completas, funcionamiento clínico productivo y sincronización offline quedan fuera de esta demo.
- NFC v4 beta es la variante que declara compatibilidad con la nueva arquitectura de React Native. Su integración debe aprobarse en Android e iPhone físicos antes de distribuir.

## Desarrollo por entregas

1. Base, configuración, modelos y migraciones.
2. Autenticación, autorización y contexto de paciente.
3. Visitas, revisión, pendientes y recuperación de borradores.
4. PDFs, integridad y EHR simulado.
5. Interfaz nativa, pruebas y configuración de distribución.

El documento adjunto se utilizó como referencia del producto. Sus prompts de ejemplo que limitaban la tarea al skeleton no reemplazan la petición actual de construir la demo completa.
