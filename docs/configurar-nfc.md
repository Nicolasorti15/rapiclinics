# Configurar NFC para la demo RAPICLINICS

## Qué necesitas

- Un teléfono con NFC y la app nativa instalada. El navegador y Expo Go no ejecutan este lector.
- Una etiqueta NDEF regrabable NFC Forum Type 2, por ejemplo NTAG213, NTAG215 o NTAG216. NTAG213 tiene espacio suficiente para el identificador de esta demo. [Especificaciones de NXP](https://www.nxp.com/products/NTAG213_215_216).
- Una herramienta de escritura, por ejemplo NFC Tools de Wakdev, que admite registros de texto. [NFC Tools](https://www.wakdev.com/en/apps/nfc-tools-android.html).
- Acceso desde el teléfono a la API con la base de datos de demostración inicializada.

## Programar la primera cama

1. En NFC Tools, entra en **Escribir → Añadir un registro → Texto** (los nombres pueden variar según el idioma).
2. Crea un único registro de texto NDEF con este valor exacto, sin comillas ni espacios:

   `demo_b9bfb5b5ba90bc35d7b742f70982fec3`

3. Pulsa **Escribir** y acerca una etiqueta vacía/reutilizable. Este valor corresponde a la cama ficticia **302-B**.
4. Lee la etiqueta de nuevo en NFC Tools y verifica que el registro es de tipo texto y coincide carácter por carácter.
5. Identifica físicamente la etiqueta como **302-B · DEMO**. Déjala regrabable durante las pruebas.
6. En RAPICLINICS inicia sesión, pulsa **Iniciar ronda → Leer etiqueta NFC** y acerca la antena del teléfono a la etiqueta. En Android, activa NFC en los ajustes si estaba desactivado; en iPhone inicia la lectura desde la app.
7. La app debe mostrar **María González · SIM-7314 · 302-B**. Confirma esos datos antes de continuar.

No se escribe el nombre del paciente, la cama en texto libre ni una URL: el lector actual espera el identificador anterior en un registro NDEF de texto. No abre automáticamente la app al acercar el teléfono. La etiqueta identifica la cama; el servidor resuelve su asignación vigente y exige confirmación humana.

## Las otras camas

Los diez códigos están en [etiquetas-nfc-demo.json](../fixtures/etiquetas-nfc-demo.json). Se regeneran desde la raíz con:

```powershell
python scripts/generate_nfc_tokens.py
```

Son valores públicos y predecibles exclusivamente para esta demostración. No sirven como credenciales ni deben reutilizarse con pacientes reales. El servidor requiere sesión, permisos y contexto vigente además de la etiqueta.

## Si no funciona

- **En navegador:** usa «Elegir cama de demostración». NFC requiere la compilación nativa.
- **Sin respuesta:** mueve lentamente el teléfono hasta localizar su antena; evita colocar una etiqueta corriente directamente sobre metal. Comprueba primero que NFC Tools puede leerla.
- **Formato no compatible:** reescribe un registro NDEF Texto; una URL o el UID de fábrica no sustituye el token.
- **Etiqueta desconocida:** comprueba el texto y que la API tenga el seed de esta demo.
- **No conecta:** `localhost` en el teléfono es el propio teléfono, no este computador. El build necesita una API accesible en red o HTTPS.
- **Paciente diferente:** no confirmes. Verifica la etiqueta y la asignación de cama en el servidor.
- **Lectura cancelada o agotada:** vuelve a pulsar «Leer etiqueta NFC». La app permite cancelar y limita la espera de detección a 25 segundos.

## Estado de validación

La integración y los casos simulados se comprueban por software. Falta probar etiquetas físicas en Android e iPhone; no se certifica compatibilidad de un teléfono o etiqueta concreta hasta completar esa prueba.
