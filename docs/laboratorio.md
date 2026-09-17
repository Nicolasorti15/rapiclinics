# Resultados y gráficas interactivas

Desde un paciente confirmado, abrir **Resultados y gráficas**. Subir hasta 10 archivos por lote, cada uno de hasta 10 MB. Cada archivo informa su propio resultado de importación; un fallo no anula los demás.

Formatos actuales: PDF con texto seleccionable y CSV UTF-8. Fotos y PDF escaneados no tienen OCR en esta versión. El PDF conserva su original cifrado y permite abrirlo durante la revisión. El extractor reconoce un conjunto inicial de nombres de laboratorio; lo no reconocido se puede introducir manualmente desde el informe. Fechas ambiguas quedan vacías. No debe confundirse una fecha de impresión con la fecha de muestra.

Cada informe queda pendiente hasta revisar paciente, fecha, variable, valor y unidad. Un identificador SIM distinto bloquea la confirmación. Si falta identificador, se exige comprobación manual. Las gráficas solo usan informes confirmados; unidades distintas se separan. No se infieren intervalos de referencia, diagnósticos o conversiones de unidades. Informes duplicados para el mismo paciente se rechazan por hash.

## Probar con datos ficticios

Seleccionar el paciente **SIM-7314** e importar juntos los tres CSV de `fixtures/laboratorio`. Revisar y confirmar cada uno. Aparecerán series para leucocitos, hemoglobina y plaquetas, con tres fechas. Seleccionar una variable, filtrar fechas y tocar un punto o una fila para ver valor, unidad e informe fuente. Los valores son sintéticos y no representan una persona real.

Columnas CSV exactas:

```csv
paciente,fecha,variable,valor,unidad
SIM-7314,2026-09-01,Leucocitos,8.2,10^9/L
```

También se admite separador `;`. Usar fecha ISO y valores numéricos; expresiones como `<5` o rangos no se convierten silenciosamente en números.

## Evolución hacia un tablero tipo Power BI

Esta entrega es un explorador inicial, no una integración con Microsoft Power BI. Las siguientes etapas son catálogo de analitos y alias confirmados, paneles configurables, comparación simultánea de variables con escalas explícitas, intervalos de referencia del propio laboratorio, anotaciones y exportación. OCR necesitará mostrar la región fuente y su incertidumbre para cada cifra. Conservar trazabilidad a archivo, página y muestra antes de automatizar esa extracción.
