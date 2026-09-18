# Consultar PostgreSQL de RAPICLINICS

Panel de la base alojada:
https://dashboard.render.com/d/dpg-damcnj942hec738ivdp0-a

Es la base PostgreSQL de Render, distinta del archivo SQLite de las pruebas locales.
El panel muestra estado, almacenamiento y conexiones; para consultar filas se usa un
cliente PostgreSQL. El acceso externo permanece bloqueado.

## Habilitar acceso desde tu equipo

1. En el panel, entra en **Info → Networking → PostgreSQL Inbound IP Rules**.
2. Pulsa **Add source** y autoriza únicamente la IP pública de tu conexión, con `/32`
   si es IPv4. No uses `0.0.0.0/0`. Guarda. Si cambia tu IP, actualiza esta regla.
3. En **Connections** consulta la conexión **External**, no la interna de Render.
   Conserva sus datos en privado. La contraseña de PostgreSQL es distinta a la del
   administrador de RAPICLINICS.
4. Al terminar, retira esa regla si no necesitas seguir consultando desde el equipo.

Esta guía no cambia reglas de red ni copia credenciales. El archivo `render.yaml`
mantiene `ipAllowList: []`; una resincronización del Blueprint puede volver a bloquear
las conexiones externas, sin afectar la conexión interna de la app.

## Consultar las tablas con pgAdmin

Descarga pgAdmin para Windows desde https://www.pgadmin.org/download/pgadmin-4-windows/.
En las carpetas locales de PostgreSQL no se encontró un ejecutable de psql o pgAdmin.

1. En pgAdmin, selecciona **Servers → Register → Server** y usa el nombre RAPICLINICS.
2. En **Connection**, copia de la conexión externa de Render: host completo, puerto
   `5432`, base de mantenimiento `rapiclinics`, usuario y contraseña de PostgreSQL.
3. Configura **SSL mode: require** en los parámetros de conexión y conecta.
4. Abre **Databases → rapiclinics → Schemas → public → Tables**.
5. Para explorar una tabla, usa **View/Edit Data → First 100 Rows**. Consulta sin editar.
   No compartas capturas que muestren contraseñas, sesiones o información de pacientes.

También puedes abrir **Query Tool** y ejecutar consultas de solo lectura:

```sql
BEGIN READ ONLY;
SELECT name, active FROM clinics;
SELECT role, count(*) FROM users GROUP BY role;
SELECT count(*) AS pacientes FROM patients;
COMMIT;
```

El modo de solo lectura de esta transacción no cambia los permisos del usuario de conexión.

Tablas principales: `clinics` (clínicas), `users` (cuentas y roles), `patients`
(pacientes), `encounters` (atenciones), `visits` (historias), `tags` (vínculos NFC),
`lab_reports` (resultados) y `stored_objects` (adjuntos cifrados).
No edites contraseñas, relaciones ni etiquetas directamente: utiliza la app.

El plan gratuito vence el 18 de octubre de 2026. Usa datos ficticios.
Documentación oficial: https://render.com/docs/postgresql-creating-connecting
