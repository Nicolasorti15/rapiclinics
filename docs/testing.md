# Verificación de RAPICLINICS

## Ejecutado en el entorno de desarrollo

El primer commit `744ea36` también pasó los trabajos API y mobile en GitHub Actions sobre Ubuntu: [ejecución verificada](https://github.com/Nicolasorti15/rapiclinics/actions/runs/35186838376). Esto incluye instalación desde los archivos de dependencias y exportación de los tres bundles.

- Backend: 71 pruebas pytest; 30 casos extractivos comprueban evidencia literal, números, negaciones y ausencia de hechos inventados. Se verifica también la conservación de revisiones como borrador, transcripción original y el filtrado de pendientes por paciente. Laboratorio cubre importación CSV/PDF, integridad del original, duplicados, identidad incompatible, revisión obligatoria, valores inválidos, fechas y acceso por rol/unidad.
- Cliente móvil: 12 pruebas Vitest correctas: 6 sobre autenticación, refresh, sesión caducada, red, errores y multipart, y 6 con hardware NFC simulado sobre lectura, falta de soporte, NFC desactivado, formato incorrecto, cancelación y tiempo de espera. No sustituyen pruebas de radio NFC real.
- TypeScript y ESLint sin errores; Ruff sin errores.
- Migraciones SQLite hasta `9a003` aplicadas; `alembic check` no detecta diferencias con los modelos.
- Exportación Metro/Hermes completada para Android, iOS y web. Esto verifica los bundles, no la compilación nativa.
- Prebuild Android completado; target/compile SDK 36 comprobados en la configuración generada.
- Inspección de configuración iOS: permiso de micrófono, NFC y entitlements generados.
- `npm audit`: 0 vulnerabilidades después de fijar `xcode > uuid` a 11.1.1. Xcode utiliza `uuid.v4`, cuya interfaz se conserva.
- Expo Doctor: 20/21 comprobaciones; advertencia restante sobre NFC y nueva arquitectura registrada en `publicacion.md`.

## Prueba manual en navegador

Se revisó el flujo real contra la API local, con ancho de teléfono de 390 px: inicio de sesión, selección de cama, confirmación de identidad, nota escrita, propuesta, confirmación de guardado e importación del PDF de ejemplo. Los resultados de esta prueba no sustituyen la validación física de módulos nativos.

También se comprobó el visor web PDF.js con el original visible, la asociación documental con una nueva confirmación del paciente, la aceptación del envío al EHR simulado y el aviso al salir con cambios de revisión. La recuperación de correcciones se verifica en la prueba automatizada de borradores.

En la revisión posterior se comprobó en navegador la lista de pendientes exclusiva del paciente, su búsqueda por texto y la conservación de una evolución corregida después de guardar, salir y retomar el borrador.

El visor web utiliza recursos PDF.js locales, copiados por `npm ci`/`npm install`; no envía los PDF a un visor externo. Incluye navegación por páginas, ampliación y texto accesible.

Laboratorio: carga conjunta de tres CSV ficticios, revisión y confirmación individual, gráfica de leucocitos, filtro por fechas, rechazo visual de una fecha inexistente y consulta del informe fuente desde una fila. Whisper local procesó un WAV sintético real; se observaron errores de transcripción en una cifra y un término, documentados en `ia-redaccion.md`. La prueba no acredita precisión clínica.

## Pendiente antes de release

- Arranque integrado de Docker/PostgreSQL/MinIO (Docker no instalado aquí).
- Build Android AAB/APK y build iOS IPA firmados.
- NFC, grabación, visor/compartición de PDF, permisos y accesibilidad en dispositivos físicos.
- Revisión de capturas y ficha con datos finales del responsable.
- Validación del entorno HTTPS de pruebas y controles de carga pública.
- TestFlight, prueba interna/cerrada y revisión de las tiendas.

Las advertencias de deprecación del cliente de pruebas de Starlette/httpx no afectan los resultados funcionales, pero deben actualizarse al revisar la cadena de herramientas.
