# TypeScript Server Migration - FASE 1B

## Overview

Se ha completado la migración del servidor Node.js/Express del stack legacy a **TypeScript moderno** con:

- ✅ **Nextcloud OIDC Authentication** (Passport.js)
- ✅ **MinIO S3** para almacenamiento de archivos
- ✅ **Drizzle ORM** para operaciones de base de datos
- ✅ **Todos los 48+ endpoints** del sistema original
- ✅ **Transacciones** para operaciones multi-tabla (Rechazos Externos, CAPAS)
- ✅ **TypeScript strict mode** (sin errores de compilación)

## Archivo Nuevo

- **server/index.ts** — Servidor principal con endpoints de autenticación, no conformidades, recepciones, catálogo SKU, rechazos externos, rechazos internos, AQL, y CAPAS
- **server/routes.ts** — Endpoints adicionales (Dashboard, Organigrama, Calendario, Usuarios, Liberación Shipping)
- **server/db.ts** — Inicialización de base de datos, conexión pool, transacciones
- **server/auth.ts** — Estrategia OIDC Nextcloud con Passport.js
- **server/s3.ts** — Cliente MinIO S3 con funciones helper para upload/delete
- **server/types.ts** — Tipos TypeScript personalizados para request/response
- **.env.example** — Variables de entorno actualizadas

## Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Variables de entorno (.env)
Copiar `.env.example` a `.env` y configurar:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=control_calidad
DB_USER=postgres
DB_PASSWORD=your-password

# Session
SESSION_SECRET=generate-random-secret

# OIDC Nextcloud
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-secret
APP_URL=http://localhost:3001

# MinIO S3
AWS_ENDPOINT_URL_S3=http://minio:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_DEFAULT_REGION=us-east-1
AWS_STORAGE_BUCKET_NAME=uploads
MINIO_PUBLIC_URL=http://localhost:9000

# Server
PORT=3001
NODE_ENV=development
```

### 3. Ejecutar en desarrollo
```bash
npm run dev:server
```

El servidor se ejecutará en `http://0.0.0.0:3001`

### 4. Type check
```bash
npm run typecheck
```

## Cambios Clave

### Auth: Session → Passport OIDC
**Legacy:**
```javascript
if (!req.session.usuario) return res.status(401).json({ error });
res.session.usuario.nombre
```

**Nuevo:**
```typescript
if (!req.user) return res.status(401).json({ error });
req.user?.name
```

### Uploads: Multer Disk → MinIO S3
**Legacy:**
```javascript
multer.diskStorage({
  destination: (req, file, cb) => cb(null, '/public/uploads/rechazos'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${random}.jpg`)
})
```

**Nuevo:**
```typescript
await s3.uploadFileToS3(
  file.buffer,
  file.originalname,
  'rechazos-externos',
  `re-${reId}`
);
// URL: http://minio:9000/uploads/rechazos-externos/...
```

### Database: Pool → Drizzle ORM
**Legacy:**
```javascript
const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
```

**Nuevo:**
```typescript
const result = await db
  .select()
  .from(schema.usuarios)
  .where(eq(schema.usuarios.id, id));
```

Para queries complejas (con JOINs, GROUP BY), se usa SQL crudo:
```typescript
const result = await pool.query(`
  SELECT re.*, COUNT(DISTINCT rpd.id) as cnt_problemas
  FROM rechazos_externos re
  LEFT JOIN re_problem_descriptions rpd ON rpd.rechazo_id = re.id
  GROUP BY re.id
`);
```

## Estructura de Carpetas

```
server/
├── index.ts          # Servidor principal + endpoints core
├── routes.ts         # Endpoints adicionales (dashboard, organigrama, etc)
├── db.ts             # Inicialización BD, pool, transacciones
├── auth.ts           # Estrategia OIDC Nextcloud
├── s3.ts             # Cliente MinIO S3 + helpers
├── types.ts          # Tipos TypeScript personalizados
└── tsconfig.json     # Configuración TypeScript
```

## Endpoints Implementados (48+)

### Auth
- `GET /api/auth/login`
- `GET /api/auth/callback`
- `POST /api/logout`
- `GET /api/me`

### No Conformidades (NCR)
- `GET /api/nc`
- `POST /api/nc`
- `PATCH /api/nc/:id/estatus`
- `DELETE /api/nc/:id`

### Recepciones
- `GET /api/recepciones`
- `POST /api/recepciones`
- `PUT /api/recepciones/:id`
- `PATCH /api/recepciones/:id/estatus`
- `DELETE /api/recepciones/:id`

### Catálogo SKU
- `GET /api/catalogo-sku?q=...`
- `GET /api/catalogo-sku/:sku`

### Rechazos Externos (RE)
- `GET /api/rechazos-externos`
- `GET /api/rechazos-externos/:id`
- `POST /api/rechazos-externos`
- `PUT /api/rechazos-externos/:id`
- `POST /api/rechazos-externos/:id/images`
- `DELETE /api/rechazos-externos/:id/images/:imageId`
- `DELETE /api/rechazos-externos/:id`
- `GET /api/rechazos-externos/:id/pdf` (pendiente Puppeteer)

### Rechazos Internos (RI)
- `GET /api/rechazos-internos`
- `GET /api/rechazos-internos/:id`
- `POST /api/rechazos-internos`
- `PUT /api/rechazos-internos/:id`
- `POST /api/rechazos-internos/:id/images`
- `POST /api/rechazos-internos/:id/firma`
- `DELETE /api/rechazos-internos/:id/images/:imgId`
- `DELETE /api/rechazos-internos/:id`

### AQL
- `GET /api/aql`
- `GET /api/aql/:id`
- `POST /api/aql`
- `PUT /api/aql/:id`
- `POST /api/aql/:id/foto-lpn`
- `POST /api/aql/:id/foto-pantalla`
- `DELETE /api/aql/:id`

### CAPAS (Acciones Correctivas)
- `GET /api/capas`
- `GET /api/capas/:id`
- `POST /api/capas` (transacción)
- `PUT /api/capas/:id` (transacción)
- `PATCH /api/capas/:id/estatus`
- `PATCH /api/capas/:id/acciones/:aid`
- `DELETE /api/capas/:id`

### Dashboard
- `GET /api/dashboard?periodo=mes|ytd&anio=YYYY&mes=MM`

### Organigrama QC
- `GET /api/organigrama-qc`
- `POST /api/organigrama-qc`
- `PUT /api/organigrama-qc/:id`
- `PATCH /api/organigrama-qc/:id/estatus`
- `POST /api/organigrama-qc/:id/foto`
- `DELETE /api/organigrama-qc/:id`

### Calendario
**Solicitudes:**
- `GET /api/calendario`
- `POST /api/calendario`
- `PUT /api/calendario/:id`
- `PATCH /api/calendario/:id/estatus`
- `DELETE /api/calendario/:id`

**Festivos:**
- `GET /api/calendario/festivos`
- `POST /api/calendario/festivos`
- `DELETE /api/calendario/festivos/:id`

**Saldo:**
- `GET /api/calendario/saldo`
- `POST /api/calendario/saldo` (upsert)

### Usuarios (admin only)
- `GET /api/usuarios`
- `POST /api/usuarios`
- `PUT /api/usuarios/:id`
- `PATCH /api/usuarios/:id/toggle`
- `DELETE /api/usuarios/:id`

### Liberación Shipping
- `GET /api/liberacion-shipping`
- `GET /api/liberacion-shipping/:id`
- `POST /api/liberacion-shipping`
- `PUT /api/liberacion-shipping/:id`
- `DELETE /api/liberacion-shipping/:id`
- `POST /api/liberacion-shipping/:id/foto-contenedor-vacio`
- `POST /api/liberacion-shipping/:id/foto-contenedor-cargado`
- `POST /api/liberacion-shipping/:id/foto-caja-sellada`
- `POST /api/liberacion-shipping/:id/foto-placas`
- `POST /api/liberacion-shipping/:id/foto-manifiesto`

### Health
- `GET /api/health`

## Pendientes (FASE 2+)

- [ ] PDF generation (Puppeteer) para Rechazos Externos
- [ ] bcrypt password hashing para usuarios (parcial en schema)
- [ ] Role-based access control (RBAC) desde database
- [ ] Admin validation middleware completo
- [ ] Unit tests
- [ ] E2E tests

## Notas Importantes

1. **OIDC vs Local Auth:** Fue reemplazado el auth manual de sesión con Nextcloud OIDC. El endpoint `/api/users` aún existe pero sin FK a tabla usuarios (legacy).

2. **S3 Keys:** Se guardan solo los filenames en BD (ej: `re-123-1234567890-abc.jpg`). Las URLs completas se construyen en runtime con `MINIO_PUBLIC_URL`.

3. **Transacciones:** Las operaciones de Rechazos Externos y CAPAS usan `BEGIN/COMMIT/ROLLBACK` nativas de PostgreSQL. Drizzle ORM se usa para queries simples.

4. **COPQ:** El mapeo defecto → actividad → costo sigue siendo client-side (no cambió del legacy).

5. **Timezone:** Asume UTC en PostgreSQL. Verificar TIMESTAMP fields en cliente si hay necesidad de conversión.

## Próximos Pasos

1. Configurar Nextcloud OIDC con valores reales
2. Configurar MinIO S3 (servidor + credenciales)
3. Actualizar PostgreSQL 14+
4. Ejecutar `npm run dev:server` y probar endpoints
5. Migrar de rama `stack-migration` a `main` después de validación

## Recursos

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Passport.js OIDC](https://www.passportjs.org/)
- [MinIO SDK AWS](https://docs.min.io/docs/javascript-client-api-reference.html)
- [Express.js Docs](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
