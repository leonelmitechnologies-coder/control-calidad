# Sistema de Control de Calidad — MI Technologies

Sistema web interno para el registro, seguimiento y análisis de operaciones de control de calidad: no conformidades, rechazos, acciones correctivas, gestión del equipo QC y calendarios. Orientado a la certificación ISO 9001:2015.

---

## Módulos

| Módulo | Ruta | Descripción |
|---|---|---|
| Dashboard | `/` | KPIs en tiempo real con gráficos (Chart.js), toggle Mes / YTD |
| No Conformidades | `/nc` | Registro y seguimiento de NCs por estatus (Abierta → En proceso → Cerrada) |
| Recepciones | `/recepciones` | Control diario de cargas entrantes/salientes agrupadas por fecha |
| Rechazos Externos | `/rechazos-ext` | Return orders con fotos, descripción de problemas, acciones correctivas y PDF NCR |
| Rechazos Internos | `/rechazos-int` | Defectos internos con mapeo automático COPQ (MXN), fotos y firma digital |
| Acciones Correctivas (CAPA) | `/capas` | Análisis 5 Por Qués o Ishikawa, acciones de seguimiento, ligado a NC o RE |
| AQL | `/aql` | Registro de inspecciones AQL con autocomplete de SKU |
| Liberación Shipping | `/liberacion-shipping` | Registro de órdenes de envío liberadas |
| Organigrama QC | `/organigrama-qc` | Directorio del equipo de calidad con foto, puesto, turno y datos de contacto |
| Calendario | `/calendario` | Solicitudes de vacaciones/permisos, festivos oficiales y saldo vacacional |
| Usuarios | `/usuarios` | Alta, edición y activación de usuarios (solo Administrador) |

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js 18+ + Express 4.x |
| Base de datos | PostgreSQL 14+ |
| Frontend | HTML5 / CSS3 / JavaScript vanilla (SPA con History API) |
| Autenticación | `express-session` + contraseñas con `bcrypt` |
| Uploads | `multer` (imágenes y firmas digitales) |
| PDF | `puppeteer` (headless Chrome) |
| Gráficos | Chart.js (cargado dinámicamente) |

---

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- Google Chrome / Chromium (para generación de PDFs con Puppeteer)

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd control-calidad

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con los datos de tu base de datos y sesión

# 4. Crear la base de datos en PostgreSQL
createdb control_calidad

# 5. Arrancar el servidor
npm start
```

El servidor corre en `http://localhost:3001` por defecto.
Las tablas se crean automáticamente con `CREATE TABLE IF NOT EXISTS` al primer arranque (función `initDB()` en `server.js`).

---

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=control_calidad
DB_USER=postgres
DB_PASSWORD=tu_password

SESSION_SECRET=una_clave_secreta_larga_y_aleatoria
PORT=3001
```

---

## Usuario inicial

Al arrancar por primera vez se crea automáticamente:

```
Usuario:    admin
Contraseña: admin123
Rol:        Administrador
```

> Cambia la contraseña desde el módulo de Usuarios después del primer inicio de sesión.

---

## Estructura del proyecto

```
├── public/
│   ├── index.html                  # SPA completa (HTML + CSS + JS vanilla)
│   ├── QC_logo_sin_fondo.png
│   └── uploads/
│       ├── rechazos/               # Fotos de rechazos externos (máx 10 MB)
│       ├── rechazos-internos/      # Fotos y firmas de rechazos internos (máx 10 MB)
│       └── organigrama/            # Fotos del equipo QC (máx 5 MB)
├── docs/
│   ├── DATABASE.md                 # Esquema completo y guía de la base de datos
│   ├── schema.sql                  # DDL de todas las tablas
│   ├── manual-usuario.md           # Manual de usuario final (módulos, FAQ, glosario)
│   ├── operaciones.md              # Guía de operaciones (backup, logs, deployment)
│   ├── roles-permisos.md           # Matriz de roles y permisos
│   └── troubleshooting.md          # Resolución de problemas comunes
├── logs/
│   ├── server.log                  # stdout del servidor (gitignoreado)
│   └── server.err                  # stderr del servidor (gitignoreado)
├── .env                            # Variables de entorno (gitignoreado)
├── .env.example                    # Plantilla de variables de entorno
├── .gitignore
├── CLAUDE.md                       # Instrucciones para Claude Code
├── package.json
└── server.js                       # Servidor Express + APIs + inicialización de BD
```

---

## Scripts

```bash
npm start            # Servidor (output a consola)
npm run start:prod   # Servidor en producción (output redirigido a logs/)
npm run dev          # Desarrollo con hot-reload (node --watch)
```

---

## Generación de PDFs

El módulo de Rechazos Externos genera un reporte NCR (Non-Conformance Report) en PDF via Puppeteer.
Requiere que Chromium esté disponible en el sistema. En producción Linux:

```bash
apt-get install -y chromium-browser
```

Puppeteer lo detecta automáticamente si está en el PATH.

---

## Documentación

| Documento | Descripción |
|---|---|
| [DATABASE.md](docs/DATABASE.md) | Esquema de tablas, relaciones y referencia de todas las APIs |
| [schema.sql](docs/schema.sql) | DDL completo de todas las tablas (idempotente) |
| [manual-usuario.md](docs/manual-usuario.md) | Guía de uso para usuarios finales (módulos, FAQ, glosario) |
| [operaciones.md](docs/operaciones.md) | Instalación, backup, deployment y gestión en producción |
| [roles-permisos.md](docs/roles-permisos.md) | Matriz de permisos por rol y módulo |
| [troubleshooting.md](docs/troubleshooting.md) | Resolución de problemas comunes |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios del proyecto |

---

## Convenciones del proyecto

- **Sin framework frontend:** toda la UI vive en `public/index.html` como SPA monolito.
- **Sin FK formales en la mayoría de tablas:** `registrado_por` guarda una copia del nombre en texto, no un id.
- **COPQ en MXN:** los costos de no calidad de rechazos internos están en pesos mexicanos.
- **Notificaciones:** siempre usar `ui.notificar()` y `ui.confirmar()` del sistema propio; nunca `alert()` / `confirm()` nativos del navegador.
- **Routing:** cada módulo nuevo necesita entrada en `MODULOS`, link en el nav con `href`, y `<div id="mod-xxx">` en el HTML.
