# Sistema de Control de Calidad — MI Technologies

Sistema web interno para el registro y seguimiento de operaciones de control de calidad: no conformidades, recepciones de carga y administración de usuarios.

---

## Módulos

| Módulo | Ruta | Descripción |
|---|---|---|
| No Conformidades | `/nc` | Registro y seguimiento de NCs por estatus (Abierta / En proceso / Cerrada) |
| Recepciones | `/recepciones` | Control diario de cargas entrantes agrupadas por fecha |
| Usuarios | `/usuarios` | Alta, edición y activación de usuarios (solo Administrador) |

---

## Stack

- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Frontend:** HTML / CSS / JavaScript vanilla (SPA con History API)
- **Auth:** Sesiones con `express-session` + contraseñas con `bcrypt`

---

## Requisitos

- Node.js 18+
- PostgreSQL 14+

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/leonelmitechnologies-coder/control-calidad.git
cd control-calidad

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con los datos de tu base de datos

# 4. Crear la base de datos en PostgreSQL
createdb control_calidad

# 5. Arrancar el servidor
npm start
```

El servidor corre en `http://localhost:3001` por defecto.  
Las tablas se crean automáticamente al primer arranque.

---

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=control_calidad
DB_USER=postgres
DB_PASSWORD=tu_password

SESSION_SECRET=una_clave_secreta_larga
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
├── public/             # Frontend (SPA)
│   ├── index.html      # Aplicación completa
│   └── QC_logo_sin_fondo.png
├── docs/               # Documentación
│   ├── DATABASE.md     # Esquema y guía de la base de datos
│   └── schema.sql      # DDL de las tablas
├── logs/               # Logs de runtime (gitignoreado)
├── .env.example        # Plantilla de variables de entorno
├── .gitignore
├── package.json
└── server.js           # Servidor Express + APIs + inicialización de BD
```

---

## Scripts

```bash
npm start     # Producción
npm run dev   # Desarrollo con hot-reload (node --watch)
```
