# Guía de Resolución de Problemas — Sistema de Control de Calidad
**MI Technologies · Versión 1.0 · Junio 2026**

---

## Tabla de Contenidos

1. [El servidor no responde / la página no carga](#1-el-servidor-no-responde--la-página-no-carga)
2. [Error de conexión a base de datos](#2-error-de-conexión-a-base-de-datos)
3. [Las sesiones se cierran solas](#3-las-sesiones-se-cierran-solas)
4. [No se pueden subir fotos o firma digital](#4-no-se-pueden-subir-fotos-o-firma-digital)
5. [El PDF del NCR no se genera](#5-el-pdf-del-ncr-no-se-genera)
6. [Un usuario no puede iniciar sesión](#6-un-usuario-no-puede-iniciar-sesión)
7. [Los datos del Dashboard no se actualizan](#7-los-datos-del-dashboard-no-se-actualizan)
8. [El servidor usa mucha memoria](#8-el-servidor-usa-mucha-memoria)
9. [Error al arrancar: "puerto en uso"](#9-error-al-arrancar-puerto-en-uso)
10. [Cómo revisar los logs de errores](#10-cómo-revisar-los-logs-de-errores)
11. [Contacto / Escalación](#11-contacto--escalación)

---

## 1. El servidor no responde / la página no carga

### Síntoma
El navegador muestra "Esta página no está disponible", "ERR_CONNECTION_REFUSED" o simplemente no carga al acceder a `http://localhost:3001` (o la IP del servidor).

### Posibles causas
- El proceso Node.js no está corriendo.
- El servidor se cayó por un error no manejado.
- El puerto 3001 está bloqueado por firewall o en uso por otro proceso.

### Solución paso a paso

**Paso 1 — Verificar si el proceso Node está activo**

```powershell
Get-Process node
```

Si el comando no devuelve ninguna línea, el proceso no está corriendo. Continúa al Paso 3.

**Paso 2 — Verificar que el puerto 3001 esté escuchando**

```powershell
netstat -ano | findstr ":3001"
```

Salida esperada (el servidor está activo):
```
TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    <PID>
```

Si no aparece ninguna línea, el servidor no está escuchando en ese puerto.

**Paso 3 — Levantar el servidor**

Abre PowerShell en el directorio del proyecto y ejecuta:

```powershell
# Modo producción (recomendado)
npm run start:prod

# O modo estándar
npm start

# O directamente
node server.js
```

**Paso 4 — Verificar en los logs si hubo un error al iniciar**

```powershell
Get-Content logs\server.log -Tail 30
Get-Content logs\server.err -Tail 30
```

Busca líneas con `ERROR`, `FATAL` o `ECONNREFUSED` para identificar la causa del fallo.

---

## 2. Error de conexión a base de datos

### Síntoma
El servidor arranca pero muestra un error como:
- `"Error de base de datos"` en la interfaz
- En los logs: `ECONNREFUSED 127.0.0.1:5432` o `password authentication failed for user`
- La aplicación carga pero no muestra datos, o muestra errores al guardar registros.

### Posibles causas
- El servicio de PostgreSQL no está corriendo en Windows.
- Las credenciales en el archivo `.env` son incorrectas.
- La base de datos `control_calidad` no existe.
- El puerto 5432 está bloqueado.

### Solución paso a paso

**Paso 1 — Verificar que el servicio PostgreSQL esté corriendo**

```powershell
Get-Service -Name "postgresql*"
```

El estado debe ser `Running`. Si está `Stopped`:

```powershell
# Iniciar el servicio (requiere permisos de administrador)
Start-Service -Name "postgresql-x64-14"
```

> El nombre exacto del servicio puede variar según la versión instalada. Usa `Get-Service -Name "postgres*"` para ver el nombre correcto.

**Paso 2 — Verificar que el puerto 5432 esté escuchando**

```powershell
netstat -ano | findstr ":5432"
```

**Paso 3 — Verificar las credenciales en el archivo .env**

Abre el archivo `.env` en el directorio raíz del proyecto y confirma que los valores sean correctos:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=control_calidad
DB_USER=<usuario>
DB_PASSWORD=<contraseña>
```

**Paso 4 — Probar la conexión manualmente**

```powershell
# Desde el cliente de PostgreSQL (si está en el PATH)
psql -h localhost -U <usuario> -d control_calidad
```

Si la conexión falla, el problema es en las credenciales o en el servicio.

**Paso 5 — Verificar que la base de datos exista**

```powershell
psql -h localhost -U postgres -c "\l"
```

Busca `control_calidad` en la lista. Si no existe, créala:

```powershell
psql -h localhost -U postgres -c "CREATE DATABASE control_calidad;"
```

Luego reinicia el servidor de la aplicación; `initDB()` creará automáticamente todas las tablas.

---

## 3. Las sesiones se cierran solas

### Síntoma
Los usuarios reportan que son desconectados del sistema sin haber cerrado sesión, o que al regresar después de un tiempo ya no están autenticados.

### Comportamiento esperado (diseño del sistema)

Esto es **comportamiento normal** en dos situaciones:

1. **Tiempo de inactividad / duración de sesión:** Las sesiones tienen una duración de **8 horas** desde el inicio de sesión. Al cumplirse ese tiempo, el sistema requiere volver a autenticarse. Esto es intencional por seguridad.

2. **Reinicio del servidor:** Las sesiones se almacenan **en memoria** (express-session sin store persistente). Cada vez que el servidor Node.js se reinicia — por actualización, error, o reinicio manual — **todas las sesiones activas se pierden** y los usuarios deben volver a iniciar sesión.

### Qué hacer

- **Cierre de sesión después de 8 horas:** El usuario simplemente debe iniciar sesión nuevamente. No hay problema técnico.
- **Cierre de sesión inesperado durante el día:** Revisar si el servidor fue reiniciado. Consultar los logs:

```powershell
Get-Content logs\server.log -Tail 20
```

Busca mensajes de inicio como `Servidor corriendo en puerto 3001` para identificar reinicios recientes.

- **Si el servidor se reinicia con frecuencia por errores:** Revisar `logs\server.err` para identificar la causa del reinicio y corregirla.

---

## 4. No se pueden subir fotos o firma digital

### Síntoma
Al intentar subir una imagen o firma digital, aparece un mensaje de error o el archivo simplemente no se sube.

### Posibles causas
- El archivo supera el límite de tamaño permitido.
- El archivo no es una imagen (el sistema solo acepta imágenes).
- Las carpetas de destino en `public/uploads/` no existen.

### Límites del sistema

| Módulo | Límite de tamaño | Tipos aceptados |
|---|---|---|
| Rechazos Internos (fotos de defecto) | 10 MB por imagen | Solo imágenes (`image/*`) |
| Organigrama QC (firma digital) | 5 MB | Solo imágenes (`image/*`) |

### Solución paso a paso

**Paso 1 — Verificar el tamaño y tipo del archivo**

Confirma que el archivo sea una imagen (JPG, PNG, GIF, WebP) y que no supere el límite. Si es necesario, comprímela antes de subirla.

**Paso 2 — Verificar que existan las carpetas de uploads**

```powershell
# Desde el directorio raíz del proyecto
Get-ChildItem public\uploads\
```

Deben existir subcarpetas como `rechazos_internos`, `organigrama_qc`, etc. Si no existen, créalas:

```powershell
New-Item -ItemType Directory -Force public\uploads\rechazos_internos
New-Item -ItemType Directory -Force public\uploads\organigrama_qc
```

> El servidor crea estas carpetas automáticamente al iniciar en condiciones normales. Si no existen, puede indicar un problema de permisos en el directorio.

**Paso 3 — Verificar permisos de escritura**

Confirma que el usuario con el que corre el servidor Node.js tenga permisos de escritura en `public\uploads\`.

```powershell
# Probar creando un archivo de prueba
New-Item -ItemType File -Path "public\uploads\test.txt" -Force
Remove-Item "public\uploads\test.txt"
```

Si el comando falla con un error de acceso denegado, ajusta los permisos de la carpeta desde el Explorador de Windows (clic derecho → Propiedades → Seguridad).

---

## 5. El PDF del NCR no se genera

### Síntoma
Al intentar generar el PDF de una No Conformidad, el botón no responde, aparece un mensaje de error, o el archivo PDF descargado está vacío/corrupto.

### Posibles causas
- Puppeteer no puede encontrar el ejecutable de Chromium.
- Chromium no está instalado o su instalación está incompleta.
- Falta de memoria o recursos del sistema al lanzar Chromium.

### Solución paso a paso

**Paso 1 — Revisar el error en los logs**

```powershell
Get-Content logs\server.err -Tail 30
```

Errores comunes de Puppeteer:
- `"Could not find Chrome"` o `"No usable sandbox"` → Chromium no está instalado correctamente.
- `"TimeoutError: Navigation timeout"` → El servidor tardó demasiado en generar la página.
- `"spawn ... ENOENT"` → La ruta al ejecutable de Chromium es incorrecta.

**Paso 2 — Verificar la instalación de Chromium de Puppeteer**

```powershell
# Desde el directorio del proyecto
node -e "const puppeteer = require('puppeteer'); puppeteer.launch().then(b => { console.log('OK:', b.wsEndpoint()); b.close(); }).catch(e => console.error('ERROR:', e.message))"
```

Si devuelve `OK:` con una URL, Puppeteer funciona correctamente.

**Paso 3 — Reinstalar el ejecutable de Chromium**

```powershell
# Forzar la descarga del Chromium incluido en Puppeteer
npx puppeteer browsers install chrome
```

O reinstalar la dependencia completa:

```powershell
npm install puppeteer --save
```

> La descarga de Chromium puede tardar varios minutos dependiendo de la velocidad de internet.

**Paso 4 — Verificar en entornos corporativos con antivirus**

En algunos entornos, el antivirus bloquea la ejecución de Chromium. Verifica con el equipo de IT si el ejecutable en `node_modules\puppeteer\.local-chromium\` está siendo bloqueado o en cuarentena.

---

## 6. Un usuario no puede iniciar sesión

### Síntoma
Un usuario ingresa su nombre de usuario y contraseña correctos pero el sistema no lo deja entrar, mostrando un mensaje de error.

### Posibles causas
- La cuenta del usuario está desactivada (`activo = false`).
- La contraseña fue cambiada por otro administrador.
- El usuario está escribiendo incorrectamente su usuario o contraseña (distingue mayúsculas/minúsculas).

### Solución paso a paso

**Paso 1 — Verificar el estado de la cuenta (solo Admin)**

Un usuario con rol `Admin` debe ingresar al módulo **Usuarios** (`/usuarios`) y:
1. Buscar al usuario en la lista.
2. Verificar que el interruptor "Activo" esté habilitado.
3. Si está desactivado, activarlo haciendo clic en el interruptor.

**Paso 2 — Resetear la contraseña (solo Admin)**

Desde el módulo **Usuarios**:
1. Hacer clic en "Editar" en la fila del usuario.
2. Ingresar una nueva contraseña en el campo correspondiente.
3. Guardar los cambios.
4. Comunicar la nueva contraseña al usuario por un canal seguro.

**Paso 3 — Credenciales del administrador inicial**

Si se perdió acceso a la cuenta de administrador, las credenciales por defecto del sistema son:

```
Usuario: admin
Contraseña: admin123
```

> **Importante:** Si estas credenciales no funcionan, la contraseña fue cambiada previamente (recomendado). En ese caso, escala al equipo de IT para resetear la contraseña directamente en la base de datos.

**Paso 4 — Resetear contraseña de admin directamente en BD (último recurso)**

```powershell
psql -h localhost -U postgres -d control_calidad
```

```sql
-- Dentro de psql: actualizar la contraseña (el hash bcrypt de "admin123")
UPDATE usuarios
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uHlmGzb6e'
WHERE username = 'admin';
```

> Después de este reset, inicia sesión inmediatamente y cambia la contraseña desde el módulo de Usuarios.

---

## 7. Los datos del Dashboard no se actualizan

### Síntoma
El Dashboard muestra datos desactualizados, contadores en cero, o los gráficos no reflejan los registros recientes.

### Comportamiento esperado

Los datos del Dashboard son **en tiempo real**: cada vez que se navega al Dashboard o se recarga la página, se realiza una nueva consulta a la base de datos. No hay caché de datos en el cliente.

### Solución paso a paso

**Paso 1 — Verificar los filtros activos**

El Dashboard tiene filtros de período:
- **Mes:** Muestra solo el mes actualmente seleccionado.
- **YTD (Year-to-Date):** Muestra desde enero hasta el mes actual.
- **Año seleccionado:** Verifica que el año del selector coincida con el año de los datos que buscas.

Un dato registrado en 2025 no aparecerá si el filtro está en 2026.

**Paso 2 — Forzar recarga de los datos**

Haz clic nuevamente en "Dashboard" en el menú lateral, o presiona `F5` para recargar la página completa.

**Paso 3 — Verificar conectividad con la base de datos**

Si el Dashboard muestra todos los contadores en cero de forma inesperada, puede ser un problema de conexión con PostgreSQL. Revisa la sección [2. Error de conexión a base de datos](#2-error-de-conexión-a-base-de-datos).

**Paso 4 — Verificar en los logs si hay errores en las consultas**

```powershell
Get-Content logs\server.log -Tail 50 | Select-String "dashboard|ERROR"
```

---

## 8. El servidor usa mucha memoria

### Síntoma
El proceso Node.js consume una cantidad creciente de memoria RAM con el tiempo, el servidor responde lentamente, o el sistema operativo reporta memoria baja.

### Causa principal

Las sesiones de usuario se almacenan **en memoria RAM** (express-session sin store persistente). Con muchos usuarios activos o sesiones antiguas acumuladas, el consumo de memoria puede crecer considerablemente.

### Solución paso a paso

**Paso 1 — Verificar el consumo actual de memoria**

```powershell
Get-Process node | Select-Object ProcessName, Id, WorkingSet, VirtualMemorySize
```

El valor `WorkingSet` indica la memoria física en uso (en bytes).

**Paso 2 — Reiniciar el servidor para liberar memoria**

Un reinicio limpia todas las sesiones en memoria. Programa el reinicio en un momento de baja actividad (por ejemplo, en la madrugada):

```powershell
# Detener el proceso actual
Stop-Process -Name node -Force

# Reiniciar el servidor
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Proyectos Claude\ControlCalidad'; npm run start:prod"
```

> Los usuarios conectados en ese momento perderán su sesión y deberán volver a iniciar sesión.

**Paso 3 — Monitorear el servidor en producción**

Para entornos de producción con muchos usuarios, se recomienda:
- Usar un gestor de procesos como **PM2** para reinicios automáticos ante errores o consumo excesivo.
- Configurar un reinicio programado nocturno.

```powershell
# Instalar PM2 globalmente (si no está instalado)
npm install -g pm2

# Iniciar el servidor con PM2
pm2 start server.js --name control-calidad

# Configurar reinicio automático si la memoria supera 500 MB
pm2 start server.js --name control-calidad --max-memory-restart 500M

# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs control-calidad
```

---

## 9. Error al arrancar: "puerto en uso"

### Síntoma
Al intentar iniciar el servidor aparece un error como:
```
Error: listen EADDRINUSE: address already in use :::3001
```

### Posibles causas
- Ya hay una instancia del servidor corriendo en el mismo puerto.
- Un servidor anterior no se cerró correctamente y el proceso sigue activo.
- Otra aplicación está usando el puerto 3001.

### Solución paso a paso

**Paso 1 — Identificar qué proceso está usando el puerto 3001**

```powershell
netstat -ano | findstr ":3001"
```

Anota el PID (último número de la línea) del proceso en estado `LISTENING`.

**Paso 2 — Identificar el proceso por su PID**

```powershell
# Sustituye <PID> por el número obtenido en el paso anterior
Get-Process -Id <PID>
```

**Paso 3 — Terminar el proceso**

```powershell
# Terminar el proceso por PID
Stop-Process -Id <PID> -Force
```

O si son múltiples instancias de Node:

```powershell
# Terminar TODOS los procesos Node (úsalo con precaución)
Stop-Process -Name node -Force
```

**Paso 4 — Confirmar que el puerto está libre y reiniciar**

```powershell
netstat -ano | findstr ":3001"
# No debe devolver ninguna línea

# Luego iniciar el servidor normalmente
npm start
```

---

## 10. Cómo revisar los logs de errores

### Síntoma
Ocurrió un error inesperado en el sistema y se necesita diagnosticar la causa.

### Ubicación de los archivos de log

| Archivo | Contenido |
|---|---|
| `logs\server.log` | Mensajes generales del servidor: inicios, peticiones, operaciones |
| `logs\server.err` | Errores y excepciones no manejadas |

### Comandos para leer los logs

**Ver las últimas líneas de un log:**

```powershell
# Últimas 50 líneas del log general
Get-Content logs\server.log -Tail 50

# Últimas 50 líneas del log de errores
Get-Content logs\server.err -Tail 50
```

**Seguir el log en tiempo real (equivalente a `tail -f`):**

```powershell
Get-Content logs\server.log -Wait
```

Presiona `Ctrl+C` para detener el seguimiento.

**Buscar un error específico dentro del log:**

```powershell
# Buscar todas las líneas que contienen "ERROR"
Select-String -Path logs\server.log -Pattern "ERROR"

# Buscar errores de base de datos
Select-String -Path logs\server.err -Pattern "postgres|ECONNREFUSED|QueryError"

# Buscar errores de Puppeteer
Select-String -Path logs\server.err -Pattern "puppeteer|chrome|Chromium"
```

**Ver el log por fecha (si los mensajes incluyen timestamp):**

```powershell
# Buscar entradas del día de hoy
$hoy = (Get-Date).ToString("yyyy-MM-dd")
Select-String -Path logs\server.log -Pattern $hoy
```

### Qué buscar en un error

Al analizar un error en los logs, identifica:

1. **Timestamp:** ¿Cuándo ocurrió exactamente?
2. **Tipo de error:** `ECONNREFUSED` (conexión rechazada), `QueryError` (error de BD), `SyntaxError` (error de código), `TimeoutError` (tiempo agotado).
3. **Stack trace:** Las líneas que empiezan con `at ...` indican en qué parte del código ocurrió el error.
4. **Contexto:** ¿Qué endpoint o módulo estaba siendo usado cuando ocurrió?

**Ejemplo de error de BD en el log:**
```
2026-06-29T10:34:21 ERROR /api/rechazos-internos
QueryError: column "marca" does not exist
    at Pool.query (server.js:1234)
```
En este caso, el problema es que falta una columna en la tabla, lo que indica que `initDB()` no se ejecutó correctamente o hay una migración pendiente.

---

## 11. Contacto / Escalación

Si los pasos anteriores no resuelven el problema, escala al equipo de soporte técnico:

| Rol | Nombre | Contacto |
|---|---|---|
| Administrador del Sistema | _(completar)_ | _(completar)_ |
| Soporte IT / Infraestructura | _(completar)_ | _(completar)_ |
| Administrador de Base de Datos | _(completar)_ | _(completar)_ |
| Desarrollador / Owner del proyecto | _(completar)_ | leonel.hernandez@miglobal.com.mx |

**Al escalar un problema, proporciona siempre:**
- Descripción del síntoma y qué acción lo desencadena.
- Hora aproximada en que ocurrió el error.
- Capturas de pantalla del mensaje de error en la interfaz (si aplica).
- Las últimas 50 líneas de `logs\server.err` y `logs\server.log`.

---

*Guía generada para el Sistema de Control de Calidad — MI Technologies · ISO 9001:2015*
