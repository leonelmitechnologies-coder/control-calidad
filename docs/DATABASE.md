# Base de Datos — Control de Calidad
**Motor:** PostgreSQL 14+ · **Base de datos:** `control_calidad` · **Usuario:** `postgres` · **Puerto:** 5432

---

## Diagrama de relaciones (ERD)

```
┌─────────────────────────────────────┐
│             usuarios                │
├──────────────┬──────────────────────┤
│ PK  id       │ SERIAL               │
│     nombre   │ VARCHAR(100)         │
│ UQ  usuario  │ VARCHAR(50)          │
│     pass_hash│ TEXT                 │
│     rol      │ VARCHAR(20)          │  ← 'Administrador' | 'Usuario'
│     area     │ VARCHAR(50)          │
│     activo   │ BOOLEAN              │
│     created_at│ TIMESTAMP           │
└──────────────┴──────────────────────┘
         │
         │  registrado_por (nombre, sin FK formal)
         │
         ▼
┌─────────────────────────────────────┐
│         no_conformidades            │
├──────────────┬──────────────────────┤
│ PK  id       │ SERIAL               │
│     hora     │ TIME                 │
│     area     │ VARCHAR(50)          │
│     tipo     │ VARCHAR(100)         │
│     descripcion│ TEXT               │
│     severidad│ VARCHAR(10)          │  ← 'Alta' | 'Media' | 'Baja'
│     responsable│ VARCHAR(100)       │
│     accion   │ TEXT                 │
│     registrado_por│ VARCHAR(100)    │  ← copia del nombre del usuario
│     estatus  │ VARCHAR(20)          │  ← 'Abierta' | 'En proceso' | 'Cerrada'
│     fecha    │ DATE                 │
│     created_at│ TIMESTAMP           │
└──────────────┴──────────────────────┘
```

> **Nota:** No hay Foreign Key formal entre tablas. `no_conformidades.registrado_por`
> guarda una copia del `usuarios.nombre` al momento del registro.

---

## Tabla: `usuarios`

| Columna        | Tipo         | Nulo | Default   | Descripción                                   |
|----------------|--------------|------|-----------|-----------------------------------------------|
| `id`           | SERIAL       | NO   | auto      | Clave primaria autoincrementable               |
| `nombre`       | VARCHAR(100) | NO   | —         | Nombre completo del usuario                   |
| `usuario`      | VARCHAR(50)  | NO   | —         | Login único, sin espacios (UNIQUE)            |
| `password_hash`| TEXT         | NO   | —         | Hash bcrypt de la contraseña (cost=10)        |
| `rol`          | VARCHAR(20)  | NO   | `Usuario` | `Administrador` o `Usuario`                   |
| `area`         | VARCHAR(50)  | SÍ   | `''`      | Área organizacional asignada                  |
| `activo`       | BOOLEAN      | NO   | `true`    | `false` = desactivado, no puede iniciar sesión|
| `created_at`   | TIMESTAMP    | SÍ   | `NOW()`   | Fecha y hora de creación del registro         |

**Restricciones:**
- `PRIMARY KEY (id)`
- `UNIQUE (usuario)`

**Valores permitidos en `rol`:** `Administrador`, `Usuario`

**Valores permitidos en `area`:** `Produccion`, `Almacen`, `Logistica`, `Administracion`, `Mantenimiento`, `Calidad`, `Ventas`, `''` (sin área)

**Usuario inicial creado automáticamente:**
```
usuario: admin  |  password: admin123  |  rol: Administrador
```

---

## Tabla: `no_conformidades`

| Columna          | Tipo         | Nulo | Default    | Descripción                                      |
|------------------|--------------|------|------------|--------------------------------------------------|
| `id`             | SERIAL       | NO   | auto       | Clave primaria autoincrementable                  |
| `hora`           | TIME         | NO   | —          | Hora de detección del problema                   |
| `area`           | VARCHAR(50)  | NO   | —          | Área donde se detectó                            |
| `tipo`           | VARCHAR(100) | NO   | —          | Categoría del problema (ver valores abajo)        |
| `descripcion`    | TEXT         | NO   | —          | Descripción detallada del problema               |
| `severidad`      | VARCHAR(10)  | NO   | —          | Nivel de impacto: `Alta`, `Media`, `Baja`        |
| `responsable`    | VARCHAR(100) | SÍ   | `'—'`      | Nombre o puesto del responsable de atención      |
| `accion`         | TEXT         | SÍ   | `'—'`      | Acción inmediata tomada al detectar el problema  |
| `registrado_por` | VARCHAR(100) | SÍ   | —          | Nombre del usuario que creó el registro          |
| `estatus`        | VARCHAR(20)  | NO   | `'Abierta'`| Estado actual: `Abierta`, `En proceso`, `Cerrada`|
| `fecha`          | DATE         | NO   | —          | Fecha del registro (se setea automáticamente)    |
| `created_at`     | TIMESTAMP    | SÍ   | `NOW()`    | Timestamp exacto de inserción                    |

**Restricciones:**
- `PRIMARY KEY (id)`

**Valores permitidos en `tipo`:**
- `Producto no conforme`
- `Proceso fuera de parametro`
- `Documentacion incorrecta`
- `Equipo defectuoso`
- `Incumplimiento de procedimiento`
- `Proveedor`
- `Otro`

**Ciclo de vida de `estatus`:**
```
Abierta  →  En proceso  →  Cerrada
```
El cambio de estatus se hace vía `PATCH /api/nc/:id/estatus`.

---

## Dónde vive el esquema en el código

| Qué           | Archivo      | Línea   |
|---------------|--------------|---------|
| Tabla usuarios | `server.js` | L.42–53 |
| Tabla no_conformidades | `server.js` | L.55–70 |
| Usuario admin inicial | `server.js` | L.72–81 |
| API no conformidades | `server.js` | L.113–157 |
| API usuarios | `server.js` | L.159+ |

El esquema se crea con `CREATE TABLE IF NOT EXISTS` al arrancar el servidor
(función `initDB()` en `server.js:41`).

---

## APIs que tocan cada tabla

### `usuarios`
| Método | Ruta                        | Descripción                       |
|--------|-----------------------------|-----------------------------------|
| GET    | `/api/usuarios`             | Lista todos los usuarios          |
| POST   | `/api/usuarios`             | Crea nuevo usuario                |
| PUT    | `/api/usuarios/:id`         | Edita nombre, usuario, pass, rol  |
| PATCH  | `/api/usuarios/:id/toggle`  | Activa / desactiva usuario        |
| DELETE | `/api/usuarios/:id`         | Elimina usuario                   |

### `no_conformidades`
| Método | Ruta                        | Descripción                       |
|--------|-----------------------------|-----------------------------------|
| GET    | `/api/nc`                   | Lista NCs del día actual          |
| GET    | `/api/nc?fecha=YYYY-MM-DD`  | Lista NCs de una fecha específica |
| POST   | `/api/nc`                   | Registra nueva NC                 |
| PATCH  | `/api/nc/:id/estatus`       | Cambia el estatus de una NC       |
| DELETE | `/api/nc/:id`               | Elimina una NC                    |

---

## Guía: ¿Qué editar y dónde?

| Si necesitas...                          | Editar...                                               |
|------------------------------------------|---------------------------------------------------------|
| Agregar un nuevo campo a una tabla       | `server.js` `initDB()` + endpoint correspondiente + frontend |
| Agregar un nuevo área válida             | `server.js` (si validas) + `public/index.html` selects |
| Agregar un nuevo tipo de NC              | `public/index.html` select `#nc-tipo`                  |
| Cambiar el estatus inicial de una NC     | `server.js` L.132 (`'Abierta'`)                        |
| Cambiar la duración de la sesión         | `server.js` L.26 (`maxAge`)                            |
| Cambiar el usuario/contraseña inicial    | `server.js` L.73–80                                    |
| Añadir un nuevo rol                      | `server.js` middleware `admin()` + frontend            |

---

## Mejores prácticas aplicadas (según investigación)

### 1. Comentarios nativos en PostgreSQL
Agrega documentación directamente en la BD con `COMMENT ON`:
```sql
COMMENT ON TABLE usuarios IS 'Usuarios del sistema con autenticación por sesión';
COMMENT ON COLUMN usuarios.activo IS 'false = no puede iniciar sesión, pero conserva su historial';
COMMENT ON TABLE no_conformidades IS 'Registro diario de problemas detectados en cualquier área';
COMMENT ON COLUMN no_conformidades.registrado_por IS 'Copia del nombre del usuario al momento del registro (sin FK)';
```

### 2. Versionado de migraciones
Si en el futuro se agrega una columna o tabla nueva, crear un archivo de migración numerado:
```
migrations/
  V001__crear_tablas_iniciales.sql
  V002__agregar_columna_x.sql
  V003__nueva_tabla_y.sql
```
Herramientas recomendadas para este tamaño de proyecto:
- **pg-schema-version** — ligero, ideal para proyectos pequeños
- **Flyway** — si el equipo crece

### 3. ERD visual
Generar diagrama visual con **pgAdmin 4** (incluido, sin instalación extra):
`Tools → ERD Tool → Generate ERD`

O con **dbdiagram.io** (gratuito, en línea) usando el DBML del esquema.

### 4. Evitar cambios destructivos
- Nunca hacer `DROP COLUMN` directamente en producción → primero marcar como obsoleta
- Usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para ser idempotente
- Siempre envolver DDL en `BEGIN / COMMIT`

---

*Última actualización: 2026-06-23*
