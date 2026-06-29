# Guía de Operaciones — Sistema de Control de Calidad
## MI Technologies

**Versión:** 1.0  
**Fecha:** 2026-06-29  
**Audiencia:** Técnicos de sistemas / Administradores de IT

---

## Tabla de Contenidos

1. [Requisitos del Servidor](#1-requisitos-del-servidor)
2. [Instalación desde Cero](#2-instalación-desde-cero)
3. [Configuración del Entorno](#3-configuración-del-entorno)
4. [Arranque y Parada del Servidor](#4-arranque-y-parada-del-servidor)
5. [Modo Producción vs Desarrollo](#5-modo-producción-vs-desarrollo)
6. [Backup de Base de Datos](#6-backup-de-base-de-datos)
7. [Restauración de Backup](#7-restauración-de-backup)
8. [Gestión de Logs](#8-gestión-de-logs)
9. [Gestión de Uploads](#9-gestión-de-uploads)
10. [Actualización del Sistema](#10-actualización-del-sistema)
11. [Verificación de Salud](#11-verificación-de-salud)
12. [Recomendaciones de Seguridad](#12-recomendaciones-de-seguridad)

---

## 1. Requisitos del Servidor

### Software obligatorio

| Componente | Versión mínima | Notas |
|---|---|---|
| Node.js | 18.x LTS o superior | Se recomienda la versión LTS más reciente |
| npm | 9.x o superior | Se instala junto con Node.js |
| PostgreSQL | 14 o superior | Versión 15 o 16 recomendada |
| Git | 2.x | Para descargar y actualizar el código |
| Chromium / Chrome | Cualquiera reciente | Puppeteer lo descarga automáticamente en `npm install` |

### Recursos mínimos recomendados

| Recurso | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 núcleos | 4 núcleos |
| RAM | 2 GB | 4 GB |
| Disco | 20 GB libres | 50 GB libres |
| Sistema operativo | Windows Server 2016 | Windows Server 2019/2022 |

> **Nota sobre Chromium:** Puppeteer descarga su propio Chromium durante `npm install`. Este proceso puede tardar varios minutos y requiere acceso a internet. Si el servidor no tiene internet, revise la sección de instalación offline de Puppeteer en su documentación oficial.

---

## 2. Instalación desde Cero

### 2.1 Instalar Node.js

1. Descargue el instalador LTS desde [https://nodejs.org](https://nodejs.org).
2. Ejecute el instalador con las opciones por defecto.
3. Verifique la instalación:

```powershell
node --version
npm --version
```

### 2.2 Instalar PostgreSQL

1. Descargue el instalador desde [https://www.postgresql.org/download/windows](https://www.postgresql.org/download/windows).
2. Durante la instalación, defina una contraseña para el usuario `postgres`. **Anótela — la necesitará después.**
3. Deje el puerto por defecto (`5432`).
4. Verifique que el servicio esté corriendo:

```powershell
Get-Service -Name postgresql*
```

### 2.3 Crear la base de datos

Abra una terminal como administrador y conéctese a PostgreSQL:

```powershell
psql -U postgres
```

Dentro del prompt de psql, ejecute:

```sql
CREATE DATABASE control_calidad;
\q
```

### 2.4 Clonar el repositorio

```powershell
cd C:\Proyectos
git clone <URL-del-repositorio> ControlCalidad
cd ControlCalidad
```

### 2.5 Instalar dependencias

```powershell
npm install
```

> Este paso puede tardar varios minutos porque Puppeteer descarga Chromium (~170 MB).

### 2.6 Crear el archivo de configuración

Copie el archivo de ejemplo y edítelo:

```powershell
copy .env.example .env
notepad .env
```

Rellene los valores según su entorno (ver sección [3. Configuración del Entorno](#3-configuración-del-entorno)).

### 2.7 Inicializar la base de datos

El sistema crea todas las tablas automáticamente al arrancar por primera vez. Simplemente inicie el servidor:

```powershell
npm start
```

Al arrancar, la función `initDB()` ejecuta todos los `CREATE TABLE IF NOT EXISTS` necesarios. Revise la consola para confirmar que no hay errores de conexión a la base de datos.

### 2.8 Crear carpetas de uploads

Si no existen, créelas manualmente:

```powershell
mkdir public\uploads\aql
mkdir public\uploads\organigrama
mkdir public\uploads\rechazos
mkdir public\uploads\rechazos-internos
mkdir public\uploads\shipping
```

---

## 3. Configuración del Entorno

El archivo `.env` en la raíz del proyecto contiene todas las variables de configuración. **Este archivo nunca debe subirse al repositorio git.**

### Variables disponibles

```ini
# Conexión a PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=control_calidad
DB_USER=postgres
DB_PASSWORD=<contraseña del usuario postgres>

# Sesiones HTTP
SESSION_SECRET=<cadena aleatoria larga y segura>

# Puerto del servidor web
PORT=3001
```

### Generar un SESSION_SECRET seguro

El `SESSION_SECRET` protege las cookies de sesión. Debe ser una cadena aleatoria larga. Para generarla desde PowerShell:

```powershell
# Genera una cadena de 64 caracteres hexadecimales
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Copie el resultado y úselo como valor de `SESSION_SECRET` en `.env`. Ejemplo del formato esperado:

```ini
SESSION_SECRET=xK9mP2vL8nQ4rT6yW1zA3bC5dE7fG0hJ2kM4nP6qR8sT0uV2wX4yZ6
```

> **Importante:** Si cambia el `SESSION_SECRET` en producción, todas las sesiones activas quedarán invalidadas y los usuarios tendrán que iniciar sesión de nuevo.

### Verificar la configuración

Después de editar `.env`, pruebe la conexión a la base de datos iniciando el servidor y observando los mensajes de arranque en la consola.

---

## 4. Arranque y Parada del Servidor

### Iniciar el servidor

**Modo consola (para pruebas):**
```powershell
cd C:\Proyectos\ControlCalidad
npm start
```

**Modo producción (con logs a archivo):**
```powershell
npm run start:prod
```

### Verificar que el servidor está corriendo

```powershell
# Opción 1: verificar el proceso de Node
Get-Process node

# Opción 2: verificar que el puerto está en uso
netstat -ano | findstr :3001

# Opción 3: hacer una petición HTTP de prueba
Invoke-WebRequest -Uri http://localhost:3001 -UseBasicParsing
```

Si el servidor responde con código 200, está funcionando correctamente.

### Detener el servidor

**Si está en primer plano (consola abierta):**
```
Ctrl + C
```

**Si está en segundo plano (modo producción):**
```powershell
# Encontrar el PID del proceso
Get-Process node | Select-Object Id, ProcessName, StartTime

# Detener por PID
Stop-Process -Id <PID>
```

### Reiniciar el servidor

```powershell
# Detener el proceso actual
Get-Process node | Stop-Process

# Esperar 2 segundos y volver a iniciar
Start-Sleep -Seconds 2
npm run start:prod
```

---

## 5. Modo Producción vs Desarrollo

### Modo desarrollo

```powershell
npm run dev
```

- Usa `node --watch`, que reinicia el servidor automáticamente al detectar cambios en los archivos.
- El output se muestra directamente en la consola.
- Útil para desarrollo local, **no usar en producción**.

### Modo producción

```powershell
npm run start:prod
```

- El servidor corre en segundo plano.
- El output estándar (stdout) se redirige a `logs/server.log`.
- Los errores (stderr) se redirigen a `logs/server.err`.
- El proceso no se reinicia automáticamente si falla.

### Diferencias clave

| Característica | Desarrollo | Producción |
|---|---|---|
| Hot-reload | Sí (node --watch) | No |
| Output | Consola | Archivos de log |
| Recuperación ante fallos | Manual | Manual (ver nota) |
| Velocidad de arranque | Normal | Normal |

> **Nota:** Para recuperación automática ante fallos en producción en Windows, se recomienda configurar el proceso como un **Servicio de Windows** usando herramientas como `node-windows` o la tarea programada del Administrador de tareas. Esto está fuera del alcance de esta guía pero es altamente recomendado para entornos críticos.

---

## 6. Backup de Base de Datos

### Herramienta utilizada

PostgreSQL incluye `pg_dump`, la herramienta estándar para hacer respaldos. Asegúrese de que la carpeta de PostgreSQL esté en el PATH del sistema, o use la ruta completa:

```
C:\Program Files\PostgreSQL\16\bin\pg_dump.exe
```

### Backup completo (recomendado)

```powershell
# Crear carpeta de backups si no existe
mkdir C:\Backups\ControlCalidad

# Generar backup con fecha en el nombre
$fecha = Get-Date -Format "yyyy-MM-dd"
pg_dump -U postgres -h localhost -d control_calidad -F c -f "C:\Backups\ControlCalidad\backup_$fecha.dump"
```

- `-F c` genera un archivo en formato "custom" de PostgreSQL, que es comprimido y permite restauración selectiva.
- Se pedirá la contraseña del usuario `postgres`.

### Backup solo del esquema (sin datos)

```powershell
pg_dump -U postgres -h localhost -d control_calidad --schema-only -f "C:\Backups\ControlCalidad\esquema_$fecha.sql"
```

### Backup solo de los datos (sin DDL)

```powershell
pg_dump -U postgres -h localhost -d control_calidad --data-only -F c -f "C:\Backups\ControlCalidad\datos_$fecha.dump"
```

### Frecuencia recomendada

| Tipo | Frecuencia | Retención |
|---|---|---|
| Backup completo | Diario (noche) | 30 días |
| Backup semanal | Viernes por la noche | 6 meses |
| Backup mensual | Último día del mes | 1 año |

### Automatización con Tarea Programada de Windows

1. Abra el **Programador de tareas** de Windows.
2. Cree una nueva tarea básica con el siguiente script PowerShell como acción:

```powershell
$fecha = Get-Date -Format "yyyy-MM-dd_HH-mm"
$env:PGPASSWORD = "contraseña_aqui"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -h localhost -d control_calidad -F c -f "C:\Backups\ControlCalidad\backup_$fecha.dump"
# Borrar backups de más de 30 días
Get-ChildItem "C:\Backups\ControlCalidad\*.dump" | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

3. Configure la frecuencia como "Diariamente" a las 02:00 AM.

> **Importante:** Los backups deben almacenarse en una ubicación distinta al servidor de aplicación, como una unidad de red, NAS o servicio de almacenamiento en la nube.

---

## 7. Restauración de Backup

### Restaurar un backup completo (formato custom)

> **Advertencia:** La restauración sobreescribe los datos existentes. Asegúrese de tener un backup reciente antes de proceder.

```powershell
# Paso 1: Desconectar sesiones activas y recrear la base de datos
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'control_calidad' AND pid <> pg_backend_pid();"
psql -U postgres -c "DROP DATABASE IF EXISTS control_calidad;"
psql -U postgres -c "CREATE DATABASE control_calidad;"

# Paso 2: Restaurar desde el archivo de backup
pg_restore -U postgres -h localhost -d control_calidad -v "C:\Backups\ControlCalidad\backup_2026-06-29.dump"
```

### Restaurar desde un archivo SQL plano

```powershell
psql -U postgres -h localhost -d control_calidad -f "C:\Backups\ControlCalidad\esquema_2026-06-29.sql"
```

### Verificar la restauración

```powershell
psql -U postgres -d control_calidad -c "\dt"
```

Esto debe listar todas las tablas del sistema. Confirme que aparecen tablas como `usuarios`, `rechazos_internos`, `capas`, etc.

---

## 8. Gestión de Logs

### Ubicación de los archivos de log

```
C:\Proyectos\ControlCalidad\logs\
├── server.log    — Output estándar (requests, información general)
└── server.err    — Errores del servidor
```

> La carpeta `logs/` se crea automáticamente al ejecutar `npm run start:prod`. Si no existe, créela manualmente: `mkdir C:\Proyectos\ControlCalidad\logs`.

### Ver los logs en tiempo real

```powershell
# Ver las últimas 50 líneas del log principal
Get-Content "C:\Proyectos\ControlCalidad\logs\server.log" -Tail 50

# Seguir el log en tiempo real (equivalente a tail -f)
Get-Content "C:\Proyectos\ControlCalidad\logs\server.log" -Wait -Tail 20

# Ver errores recientes
Get-Content "C:\Proyectos\ControlCalidad\logs\server.err" -Tail 50
```

### Qué buscar en los errores

| Mensaje / patrón | Causa probable | Acción |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL no está corriendo | Iniciar el servicio de PostgreSQL |
| `password authentication failed` | Contraseña incorrecta en `.env` | Revisar `DB_PASSWORD` en `.env` |
| `EADDRINUSE :::3001` | El puerto 3001 ya está en uso | Detener el proceso anterior o cambiar `PORT` en `.env` |
| `Could not find Chrome` | Chromium de Puppeteer no encontrado | Ejecutar `npm install` nuevamente |
| `relation "tabla" does not exist` | Tabla no creada en BD | Reiniciar el servidor para que `initDB()` la cree |
| `disk quota exceeded` | Disco lleno | Limpiar uploads o logs antiguos |

### Rotación de logs

Los archivos de log crecen indefinidamente. Se recomienda rotarlos mensualmente:

```powershell
# Script de rotación mensual (ejecutar como tarea programada)
$fecha = Get-Date -Format "yyyy-MM"
$logDir = "C:\Proyectos\ControlCalidad\logs"
$archDir = "C:\Proyectos\ControlCalidad\logs\archivo"

mkdir $archDir -Force

# Comprimir y archivar logs del mes anterior
if (Test-Path "$logDir\server.log") {
    Rename-Item "$logDir\server.log" "$archDir\server_$fecha.log"
}
if (Test-Path "$logDir\server.err") {
    Rename-Item "$logDir\server.err" "$archDir\server_err_$fecha.log"
}

# Reiniciar el servidor para que genere nuevos archivos de log
Get-Process node | Stop-Process -Force
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-Command cd C:\Proyectos\ControlCalidad; npm run start:prod"
```

---

## 9. Gestión de Uploads

### Estructura de carpetas

```
public/uploads/
├── aql/               — Imágenes de inspecciones AQL
├── organigrama/       — Fotos de perfil del organigrama QC
├── rechazos/          — Imágenes de rechazos externos
├── rechazos-internos/ — Imágenes de rechazos internos
└── shipping/          — Documentos de liberación de shipping
```

### Monitorear el espacio en disco

```powershell
# Ver tamaño total de la carpeta de uploads
$uploads = "C:\Proyectos\ControlCalidad\public\uploads"
$size = (Get-ChildItem $uploads -Recurse | Measure-Object -Property Length -Sum).Sum
[math]::Round($size / 1MB, 2)
# Resultado en MB
```

### Limpieza periódica

Los archivos de uploads no se eliminan automáticamente cuando se borra un registro en la base de datos (huérfanos). Para identificarlos:

```powershell
# Listar archivos de uploads más antiguos de 1 año
Get-ChildItem "C:\Proyectos\ControlCalidad\public\uploads" -Recurse |
    Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-365) } |
    Select-Object FullName, CreationTime, @{N="SizeMB"; E={[math]::Round($_.Length/1MB, 2)}}
```

> **Precaución:** Antes de eliminar cualquier archivo de uploads, verifique que no esté referenciado en la base de datos. Consulte las tablas `ri_images`, `rechazos_externos` y otras que guarden rutas de imagen.

### Recomendaciones

- Revisar el espacio en disco mensualmente.
- Si el disco supera el 70% de uso, planificar una limpieza o ampliación de capacidad.
- Hacer backup de la carpeta `public/uploads/` junto con el backup de la base de datos para mantener consistencia.

---

## 10. Actualización del Sistema

### Procedimiento estándar de actualización

```powershell
# Paso 1: Ir al directorio del proyecto
cd C:\Proyectos\ControlCalidad

# Paso 2: Hacer backup de la base de datos ANTES de actualizar
$fecha = Get-Date -Format "yyyy-MM-dd_HH-mm"
$env:PGPASSWORD = "contraseña_aqui"
pg_dump -U postgres -d control_calidad -F c -f "C:\Backups\ControlCalidad\pre_update_$fecha.dump"

# Paso 3: Detener el servidor
Get-Process node | Stop-Process -Force
Start-Sleep -Seconds 2

# Paso 4: Descargar los cambios del repositorio
git pull origin master

# Paso 5: Instalar dependencias nuevas (si las hay)
npm install

# Paso 6: Iniciar el servidor
npm run start:prod
```

### Verificar cambios antes de actualizar

```powershell
# Ver qué cambiará sin aplicarlo
git fetch origin
git log HEAD..origin/master --oneline
```

### Actualización con cambios de base de datos

Si la actualización incluye cambios en la base de datos (nuevas columnas o tablas), el servidor los aplicará automáticamente al arrancar gracias a `initDB()` que usa `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

No se requiere ningún script SQL manual en actualizaciones normales.

### Rollback ante problemas

Si la actualización genera errores:

```powershell
# Volver al commit anterior en el código
git log --oneline -10
git checkout <hash-del-commit-anterior>

# Restaurar la base de datos al estado previo
pg_restore -U postgres -d control_calidad -v "C:\Backups\ControlCalidad\pre_update_$fecha.dump"

# Reiniciar el servidor
npm run start:prod
```

---

## 11. Verificación de Salud

### Lista de verificación rápida

Ejecute estos pasos para confirmar que el sistema funciona correctamente:

#### 1. Verificar proceso Node.js

```powershell
Get-Process node
# Debe aparecer al menos un proceso "node"
```

#### 2. Verificar que el puerto responde

```powershell
Invoke-WebRequest -Uri http://localhost:3001 -UseBasicParsing | Select-Object StatusCode
# Debe devolver StatusCode: 200
```

#### 3. Verificar conexión a la base de datos

```powershell
psql -U postgres -d control_calidad -c "SELECT COUNT(*) FROM usuarios;"
# Debe devolver un número (aunque sea 0)
```

#### 4. Verificar logs por errores recientes

```powershell
Get-Content "C:\Proyectos\ControlCalidad\logs\server.err" -Tail 20
# No debe haber errores recientes
```

#### 5. Verificar espacio en disco

```powershell
Get-PSDrive C | Select-Object Name, @{N="UsedGB"; E={[math]::Round($_.Used/1GB,1)}}, @{N="FreeGB"; E={[math]::Round($_.Free/1GB,1)}}
# Debe haber al menos 5 GB libres
```

#### 6. Verificar el servicio de PostgreSQL

```powershell
Get-Service -Name postgresql* | Select-Object Name, Status
# Status debe ser "Running"
```

### Acceso desde el navegador

Abra un navegador y navegue a `http://localhost:3001` (o la IP del servidor en la red). Debe aparecer la pantalla de login del sistema. Inicie sesión con un usuario válido y confirme que puede acceder a los módulos principales.

---

## 12. Recomendaciones de Seguridad

### Contraseñas

- **PostgreSQL:** Cambie la contraseña por defecto del usuario `postgres` inmediatamente después de la instalación.

```powershell
psql -U postgres -c "ALTER USER postgres PASSWORD 'NuevaContraseñaSegura123!';"
```

- **Usuarios del sistema:** Asegúrese de que todos los usuarios creados en la aplicación tengan contraseñas fuertes (mínimo 12 caracteres, combinando letras, números y símbolos).

### SESSION_SECRET

- Use siempre un `SESSION_SECRET` largo (mínimo 48 caracteres) y aleatorio.
- **Nunca** use valores simples como `"secreto"`, `"desarrollo"` o `"12345"`.
- No comparta el valor del `SESSION_SECRET` fuera del equipo de administración.
- Si sospecha que el secret fue comprometido, cámbielo y reinicie el servidor (esto cerrará todas las sesiones activas).

### Archivo .env

- El archivo `.env` contiene credenciales sensibles. Protéjalo:

```powershell
# Restringir acceso al archivo .env solo al usuario que corre el servidor
icacls "C:\Proyectos\ControlCalidad\.env" /inheritance:r /grant:r "$env:USERNAME:(R)"
```

- Confirme que `.env` está en el `.gitignore` y nunca ha sido subido al repositorio.

### Acceso a la base de datos

- No exponga el puerto 5432 de PostgreSQL a internet. Debe ser accesible únicamente desde `localhost` o la red interna.
- Si varios servicios necesitan acceso a la BD, cree un usuario de PostgreSQL dedicado con permisos mínimos, en lugar de usar el usuario `postgres`:

```sql
CREATE USER calidad_app WITH PASSWORD 'ContraseñaApp!456';
GRANT CONNECT ON DATABASE control_calidad TO calidad_app;
GRANT USAGE ON SCHEMA public TO calidad_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO calidad_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO calidad_app;
```

### Acceso al servidor web

- Si el sistema es accesible solo desde la red interna de la planta, configure el firewall de Windows para bloquear el puerto 3001 desde el exterior:

```powershell
New-NetFirewallRule -DisplayName "ControlCalidad-Block-External" `
  -Direction Inbound -Protocol TCP -LocalPort 3001 `
  -RemoteAddress Internet -Action Block
```

- Considere colocar un proxy inverso (IIS o nginx para Windows) frente a Node.js para agregar HTTPS/TLS. Esto es especialmente importante si el sistema maneja datos sensibles o es accesible fuera de la red local.

### Actualizaciones de seguridad

- Mantenga Node.js y PostgreSQL actualizados con los últimos parches de seguridad.
- Revise periódicamente vulnerabilidades en dependencias npm:

```powershell
npm audit
```

Si hay vulnerabilidades, intente resolverlas con:

```powershell
npm audit fix
```

---

*Guía generada el 2026-06-29. Para cambios en la arquitectura del sistema, consulte `docs/DATABASE.md` y el código fuente en `server.js`.*
