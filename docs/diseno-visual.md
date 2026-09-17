# Dirección visual de RAPICLINICS

## Objetivo

Una app amigable, seria y profesional, inspirada en el área de la salud, con poca carga visual. Esta guía concreta la solicitud del usuario. La especificación adjunta aporta contexto sobre pacientes, rondas, voz, documentos y revisión humana; sus prompts de implementación no se ejecutan como parte de esta solicitud de diseño.

## Estética

- Fondo blanco cálido o gris muy claro; superficies limpias y amplios espacios entre bloques.
- Azul petróleo como color principal y verde suave como acompañamiento puntual.
- Texto oscuro, iconos de trazo sencillo con etiquetas y bordes discretos.
- Esquinas moderadamente redondeadas; sombras mínimas.
- Evitar gradientes decorativos, ilustraciones constantes, tarjetas anidadas y gráficos sin una función concreta.

## Paleta propuesta

| Uso | Color |
| --- | --- |
| Fondo | `#F6F8FA` |
| Superficie | `#FFFFFF` |
| Texto principal | `#172B3A` |
| Texto secundario | `#526575` |
| Acción principal | `#176B78` |
| Fondo de selección | `#EAF4F4` |
| Bordes decorativos | `#DCE5EA` |
| Confirmación | `#24664B` |
| Atención | `#805500` |
| Error | `#B42318` |

Los estados siempre incluyen texto e icono: el color por sí solo no comunica su significado. Verificar contraste de las combinaciones en la interfaz final; los bordes decorativos no sustituyen los contornos necesarios para reconocer controles.

## Tipografía y espacio

- Usar la fuente nativa del sistema, con un máximo de tres pesos.
- Texto de lectura de 16 unidades lógicas, títulos de pantalla de 24–28 y texto auxiliar de 14.
- Permitir escalado de texto y saltos de línea sin ocultar información clínica.
- Espaciado basado en 8 unidades, márgenes de pantalla de 20–24 y separación entre secciones de 24–32.
- Controles táctiles con área mínima propuesta de 48 × 48 unidades lógicas y foco visible.

## Organización de pantallas

- Inicio con acceso claro a «Escanear cama», rondas y pendientes relevantes; evitar un tablero de métricas.
- Navegación principal breve: Inicio, Pacientes y Pendientes. Perfil accesible desde la cabecera.
- Identidad del paciente visible durante la visita y la revisión documental: nombre, identificador y cama, sin depender exclusivamente de la cama.
- Ficha del paciente con resumen inicial breve y secciones de Visitas, Documentos y Pendientes para consultar detalles progresivamente.
- Una acción principal por paso. Las acciones secundarias utilizan menor énfasis visual.
- La grabación muestra controles claros, estado explícito y duración. La transcripción y la revisión se presentan en pasos posteriores.
- Las propuestas de IA se distinguen mediante «Pendiente de revisión», con opciones claras de editar y confirmar.
- La validación documental presenta juntos el paciente activo y los datos del documento, resaltando discrepancias concretas.
- Mostrar errores cerca del campo o acción afectada. Reservar avisos prominentes para situaciones que requieren atención inmediata.

## Tono

Español directo, respetuoso y breve: «Registrar visita», «Revisar transcripción», «Confirmar paciente» y «Guardar nota revisada». Evitar tecnicismos de infraestructura en el flujo clínico y mensajes decorativos repetitivos.

## Criterios de revisión visual

- La acción principal se identifica rápidamente.
- La pantalla inicial muestra solo la información necesaria para el siguiente paso.
- Los detalles adicionales se consultan sin perder el contexto del paciente.
- La identidad, las discrepancias y las confirmaciones conservan su visibilidad aunque el diseño sea minimalista.
- El texto es legible con tamaño ampliado y los controles se pueden utilizar con teclado o lector de pantalla cuando corresponda.
- Revisar los estados de carga, vacío, error y confirmación al implementar cada pantalla.

## Estado

Interfaz implementada en Expo/React Native: inicio, pacientes, confirmación de identidad, visitas, borradores, documentos, pendientes y cuenta. Vista previa web revisada; quedan pendientes pruebas de accesibilidad y uso en dispositivos Android e iOS físicos.
