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

## Conectar desde Windows sin instalar otro programa

Se encontró PostgreSQL 18 en `C:\Program Files\PostgreSQL\18`.
En PowerShell, ejecuta lo siguiente y escribe los valores de **External** cuando
se soliciten. Usa el nombre completo del host, no su IP ni el hostname interno.

```powershell
$dbHost = Read-Host 'Host externo que muestra Render'
$dbUser = Read-Host 'Usuario de PostgreSQL que muestra Render'
$env:PGSSLMODE = 'require'
$env:PGOPTIONS = '-c default_transaction_read_only=on'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h $dbHost -p 5432 -U $dbUser -d rapiclinics -W
```

`psql` pedirá la contraseña sin mostrarla. No la incluyas en el comando ni en el chat.
Estas opciones requieren TLS y ponen la sesión en modo de solo lectura por defecto.
No sustituyen los permisos de un rol dedicado de solo lectura.

Dentro de `psql`:

```sql
\dt
\d patients
SELECT name, active FROM clinics;
SELECT role, count(*) FROM users GROUP BY role;
SELECT count(*) AS pacientes FROM patients;
\q
```

Al cerrar, limpia las opciones de esta ventana:

```powershell
Remove-Item Env:PGSSLMODE, Env:PGOPTIONS
```

Tablas principales: `clinics` (clínicas), `users` (cuentas y roles), `patients`
(pacientes), `encounters` (atenciones), `visits` (historias), `tags` (vínculos NFC),
`lab_reports` (resultados) y `stored_objects` (adjuntos cifrados).
No edites contraseñas, relaciones ni etiquetas directamente: utiliza la app.

El plan gratuito vence el 18 de octubre de 2026. Usa datos ficticios.
Documentación oficial: https://render.com/docs/postgresql-creating-connecting
