# Control de Calidad — Progress Tracker

**Proyecto:** Migration to MI Stack  
**Rama activa:** `stack-migration`  
**Última actualización:** 2026-06-29

---

## Fase 1 — Migración Base ✅ COMPLETADA

### 1A — Drizzle Schema ✅
- [x] 20 tablas traducidas a Drizzle ORM
- [x] Tipos exactos (serial, varchar, text, integer, date, timestamp, decimal)
- [x] Defaults precisos según DATABASE.md
- [x] Relaciones FK formales (ri_images, calendario_*)
- [x] UNIQUE constraints
- [x] Camel case TypeScript → snake_case BD
- [x] TypeScript strict: ✅ Zero errors

**Archivo:** `shared/schema.ts` (343 líneas)

### 1B — Express Server ✅
- [x] Port `0.0.0.0:3001`
- [x] Nextcloud OIDC (openid-client + Passport)
- [x] MinIO S3 storage (AWS SDK)
- [x] PostgreSQL pool + initDB()
- [x] Transacciones (Rechazos Externos, CAPAS)
- [x] 48+ endpoints reimplementados (sin cambios de lógica)
- [x] Puppeteer PDF (plantilla lista, ejecución en Fase 2)
- [x] TypeScript strict: ✅ Zero errors

**Archivos:**
- `server/index.ts` (1,600+ líneas)
- `server/routes.ts` (900+ líneas)
- `server/db.ts` (350+ líneas)
- `server/auth.ts` (90+ líneas)
- `server/s3.ts` (150+ líneas)
- `server/types.ts`

### 1C — React Client ✅
- [x] React 18 + TypeScript setup
- [x] Autenticación OIDC hook (useAuth)
- [x] i18n: 3 idiomas (en, es-MX, zh-CN)
- [x] Wouter routing: 11 rutas + catch-all SPA
- [x] Layout: Sidebar + Header + Main
- [x] TanStack Query setup
- [x] API client centralizado
- [x] 11 componentes placeholder (Dashboard + 10 módulos + Login)
- [x] TypeScript strict: ✅ Zero errors

**Archivos:**
- `client/src/main.tsx`
- `client/src/App.tsx`
- `client/src/components/Layout.tsx`
- `client/src/hooks/useAuth.ts`
- `client/src/api/auth.ts`
- `client/src/config/{api, i18n}.ts`
- `client/src/pages/{Dashboard, NC, Recepciones, RechazosExt, RechazosInt, Capas, AQL, LiberacionShipping, OrganigramaQC, Calendario, Login}.tsx`
- `client/src/i18n/{en.json, es-MX.json, zh-CN.json}`

### 1D — Configuración ✅
- [x] `.env.example` completo (DB, OIDC, S3, CLIENT)
- [x] `tsconfig.json` actualizado
- [x] `package.json` con dependencias necesarias
- [x] `vite.config.ts` (ya existía)
- [x] `drizzle.config.ts` (ya existía)

---

## Fase 2 — Módulos Completos ⏳ PENDIENTE

### 2A — Dashboard
- [ ] KPIs reales (costo no calidad, NCs, rejects)
- [ ] Gráficos (sale price por marca, rejects por clasificación, NCs por severidad)
- [ ] Período selector (mes/YTD)
- [ ] Datos en vivo desde BD

### 2B — No Conformidades (NC)
- [ ] Tabla con listado de NCs
- [ ] Crear NC (formulario)
- [ ] Editar estatus (Abierta → En proceso → Cerrada)
- [ ] Filtros por fecha/severidad/área
- [ ] Eliminar NC

### 2C — Recepciones
- [ ] Tabla de recepciones (Import/Export)
- [ ] Crear recepción
- [ ] Cambiar estatus (Confirmado → En descarga → Descargado → Rechazado)
- [ ] Editar recepción
- [ ] Eliminar

### 2D — Rechazos Externos (RE)
- [ ] Tabla de rechazos
- [ ] Crear rechazo + problemas + acciones (transacción)
- [ ] Upload de fotos (→ S3)
- [ ] Editar
- [ ] PDF generation (Puppeteer)
- [ ] Eliminar

### 2E — Rechazos Internos (RI)
- [ ] Tabla de rechazos internos
- [ ] Crear rechazo + COPQ automático
- [ ] Upload de fotos + firma (→ S3)
- [ ] Editar
- [ ] Eliminar
- [ ] Filtros por defecto/inspector

### 2F — CAPAS (Acciones Correctivas)
- [ ] Tabla de CAPAs (origen NC/RE)
- [ ] Crear CAPA + 5 Por Qués / Ishikawa / Acciones (transacción)
- [ ] Editar CAPA
- [ ] Cambiar estatus (Abierta → En proceso → Cerrada)
- [ ] Agregar acciones de seguimiento
- [ ] Eliminar

### 2G — AQL (Inspecciones)
- [ ] Tabla de registros AQL
- [ ] Crear registro AQL (muchos campos)
- [ ] Upload fotos LPN + pantalla (→ S3)
- [ ] Editar
- [ ] Filtros por estado AQL (Aprobado/Rechazado)
- [ ] Eliminar

### 2H — Catálogo SKU
- [ ] Página de gestión de SKUs
- [ ] Upload CSV o entrada manual
- [ ] Búsqueda (usada en Rechazos Internos + AQL)
- [ ] Editar/Eliminar SKU

### 2I — Liberación Shipping
- [ ] Tabla de liberaciones
- [ ] Crear liberación + 5 fotos (→ S3)
- [ ] Editar
- [ ] Cálculo automático de diferencia
- [ ] Filtros por estatus/resultado inspección
- [ ] Eliminar

### 2J — Organigrama QC
- [ ] Tabla de colaboradores
- [ ] Crear colaborador + foto (→ S3)
- [ ] Editar datos
- [ ] Toggle activo/inactivo
- [ ] Eliminar

### 2K — Calendario (RRHH)
- [ ] Vista de calendario (mes/año)
- [ ] Crear solicitud (Vacaciones/Permiso/Incapacidad/Capacitación)
- [ ] Aprobar/Rechazar solicitud
- [ ] Gestión de festivos
- [ ] Saldo vacacional por colaborador/año
- [ ] Cálculo de días hábiles
- [ ] Eliminar

---

## Fase 3 — Testing & Deploy ⏳ PENDIENTE

- [ ] Unit tests (Jest)
- [ ] E2E tests (Playwright)
- [ ] Setup CI/CD (GitHub Actions)
- [ ] Staging deploy
- [ ] Producción deploy
- [ ] Monitoring & logging
- [ ] Backup strategy

---

## Estadísticas

| Aspecto | Cantidad | Estado |
|---------|----------|--------|
| Tablas BD | 20 | ✅ Drizzle |
| Endpoints API | 48+ | ✅ Implementados |
| Módulos Frontend | 11 | ✅ Skeleton |
| Idiomas i18n | 3 | ✅ Completos (en, es-MX, zh-CN) |
| Líneas servidor | ~2,500 | ✅ TypeScript |
| Líneas cliente | ~1,000 | ✅ React |
| Líneas schema | 343 | ✅ Drizzle |
| TypeScript errors | 0 | ✅ Zero errors |

---

## Notas Técnicas

### Cambios de Arquitectura
- **Autenticación:** Bcrypt local → Nextcloud OIDC
- **Storage:** Multer local → MinIO S3
- **ORM:** SQL raw → Drizzle ORM (+ SQL raw para queries complejas)
- **Frontend:** Vanilla JS → React 18
- **Build:** None → Vite 5.3
- **Lenguaje:** JavaScript → TypeScript (strict)

### Configuración necesaria antes de ejecutar
```
.env con:
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
- OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, SESSION_SECRET, APP_URL
- AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION, AWS_STORAGE_BUCKET_NAME, MINIO_PUBLIC_URL
- NODE_ENV=development|production
- VITE_API_URL=http://localhost:3001
```

### Comandos disponibles
```bash
npm run dev              # Client + Server concurrently
npm run dev:client      # Vite only
npm run dev:server      # tsx watch server/index.ts
npm run build           # Vite + tsc para server
npm run build:client    # Vite build
npm run build:server    # tsc -p server/tsconfig.json
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run start           # pm2-runtime ecosystem.config.cjs (producción)
npm run db:generate     # drizzle-kit generate (migraciones)
npm run db:push         # drizzle-kit push (aplicar migraciones)
```

---

## Blockers & Riesgos

### Bloqueadores Actuales
- ❌ Ninguno. Fase 1 completada sin dependencias.

### Riesgos Identificados
1. **OIDC Setup:** Requiere credenciales Nextcloud válidas. Fallback: implementar login local en Fase 2.
2. **MinIO Setup:** Requiere infraestructura S3. Fallback: mantener multer local como alternativa.
3. **PDF Generation:** Puppeteer puede ser pesado. Fallback: usar librería más ligera (pdfkit).

---

## Contactos & Refs

- **Rama:** stack-migration
- **Base datos:** control_calidad (PostgreSQL 14+)
- **Frontend:** React 18 + TypeScript
- **Backend:** Node.js 20+ + Express 4.19
- **Stack:** MI Stack completo

---

*Actualización automática cada vez que se completa una tarea.*
