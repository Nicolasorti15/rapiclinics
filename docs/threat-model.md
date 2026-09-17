# Amenazas y límites de la demo

| Amenaza | Control implementado | Verificación / límite |
| --- | --- | --- |
| Mezcla de pacientes | Contexto confirmado, comprobación de episodio y claves foráneas compuestas | Pruebas de discrepancia y reanudación |
| Traslado / alta / etiqueta revocada | Revalidación de asignación en escrituras | Pruebas de traslado, alta y revocación |
| NFC clonado | Revocación y contexto con caducidad; identificador opaco | Un tag estático no evita clonación física; sin criptografía de tags |
| Acceso no autorizado | Argon2, hashes de tokens, revocación y autorización por rol/servicio | Pruebas de sesión y aislamiento |
| Fuerza bruta | Límite de login y resolución por IP, proceso único | Para varias réplicas requiere limitador compartido y proxy configurado |
| Cambio de patient_id | Campos extra rechazados, contexto derivado del servidor | Prueba de edición maliciosa |
| PDF incorrecto o duplicado | Identidad sintética, SHA-256 único, discrepancia bloqueante | Pruebas documentales |
| PDF activo / corrupto / enorme | MIME, extensión, cabecera, 10 MB, 100 páginas y rechazo de acciones | Filtros básicos, no antivirus; aislar parser antes de abrir cargas públicas |
| Path traversal | Nombres internos aleatorios, nombre original sin rutas | Prueba de nombre ../../evil.pdf |
| Modificación de original | Escritura exclusiva, cifrado autenticado, verificación SHA al servir | Protección API; no sustituye S3 Object Lock frente a un administrador |
| Robo de archivos | Cifrado de objetos; Keychain/Keystore para sesión | SQLite local de desarrollo no cifra campos clínicos; solo datos ficticios |
| Inyección documental | Proveedor determinista extractivo; texto tratado como datos | El documento nunca provoca acciones ni selecciona paciente |
| Alucinación | Copia literal con evidencia; revisión obligatoria | Dataset de 30 frases, números y negaciones |
| EHR equivocado o repetido | Solo PDF validado; referencias de paciente/episodio; respuesta estable | Simulación; idempotencia remota real requeriría protocolo adicional |
| EHR caído | Estado ERROR conservando PDF validado; reintento | Prueba de fallo y recuperación |
| Datos en logs | Sin cuerpos ni tokens en logs; auditoría de ids y acciones | Uvicorn iniciado sin access log |
| Dispositivo sin conexión | Error explícito; no confirmación silenciosa | Borrador en memoria hasta guardar; caché offline persistente pendiente |

No usar esta demo con datos clínicos reales. Para publicación pública del backend hacen falta aislamiento del parser, control global del tamaño de peticiones en el proxy, cuotas de objetos, copias de respaldo verificadas, políticas de conservación y supervisión. No se afirma cumplimiento normativo clínico ni certificación médica.
