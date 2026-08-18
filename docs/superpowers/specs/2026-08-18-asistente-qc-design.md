# Asistente QC — Diseño del Módulo

**Fecha:** 2026-08-18
**Ruta:** `/asistente`
**Estado:** Aprobado — listo para implementación

---

## Resumen

Módulo de chat con IA integrado al sistema de Control de Calidad. Permite a los usuarios hacer preguntas en lenguaje natural sobre procedimientos, procesos y datos del sistema. El asistente responde combinando información de documentos de referencia subidos por administradores y datos en tiempo real de la base de datos.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| LLM provider | OpenRouter | Ya usado en el stack MI Technologies; soporta múltiples modelos |
| Estrategia RAG | Contexto completo (sin vectores) | Documentos de tamaño moderado; más simple y predecible |
| Layout UI | Chat pantalla completa + preguntas sugeridas | Más espacio para conversación; más amigable |
| Alcance de documentos | Globales (compartidos por todos) | Base de conocimiento departamental QC |
| Historial de chat | Sin historial persistente | Primera versión; sesión limpia al recargar |
| Almacenamiento de docs | S3/MinIO (bucket existente) | Ya configurado; mismo patrón que Rechazos Internos |

---

## Arquitectura

```
Usuario escribe pregunta
        ↓
POST /api/asistente/chat
        ↓
Backend construye prompt:
  1. Lee texto extraído de todos los docs activos (desde BD)
  2. Consulta datos relevantes de BD según la pregunta
  3. Arma prompt: sistema + documentos + datos + pregunta
        ↓
Llama a OpenRouter API (streaming)
        ↓
SSE (text/event-stream) → Frontend acumula tokens → muestra en tiempo real
```

---

## Modelo de datos

### Tabla `asistente_docs`

```sql
CREATE TABLE IF NOT EXISTS asistente_docs (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  tipo          TEXT NOT NULL,          -- 'pdf' | 'docx' | 'xlsx' | 'txt'
  s3_key        TEXT NOT NULL,          -- ej. 'asistente/procedimiento-iso.pdf'
  tamanio_bytes INTEGER,
  activo        BOOLEAN NOT NULL DEFAULT true,
  texto_extraido TEXT,                  -- texto plano para el prompt
  subido_por    TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

**Notas:**
- `texto_extraido` se llena al subir el documento y se reutiliza en cada pregunta
- Solo documentos con `activo = true` se incluyen en el contexto del LLM
- Sin tabla de mensajes (sin historial persistente)

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/asistente/docs` | requireAuth | Lista documentos activos |
| `POST` | `/api/asistente/docs` | requireAdmin | Sube documento → S3 + extrae texto → BD |
| `PATCH` | `/api/asistente/docs/:id` | requireAdmin | Activa/desactiva documento |
| `DELETE` | `/api/asistente/docs/:id` | requireAdmin | Elimina documento (S3 + BD) |
| `POST` | `/api/asistente/chat` | requireAuth | Streaming SSE de respuesta del LLM |

### Payload `/api/asistente/chat`

```json
{
  "pregunta": "¿Cuántas NC críticas hay abiertas?",
  "historial": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

El `historial` se incluye en el prompt para mantener contexto dentro de la misma sesión de chat (sin persistirlo en BD).

---

## Construcción del prompt

```
[SISTEMA]
Eres el Asistente QC de MI Technologies. Respondes en español.
Usa los documentos de referencia y datos del sistema para responder con precisión.
Al citar fuentes, menciona el nombre del documento o la tabla de origen.
Si no tienes información suficiente para responder, dilo claramente.

[DOCUMENTOS DE REFERENCIA]
--- {nombre_doc_1} ---
{texto_extraido_1}

--- {nombre_doc_2} ---
{texto_extraido_2}

[DATOS DEL SISTEMA]
{datos_relevantes_de_BD}

[HISTORIAL DE CONVERSACIÓN]
{historial}

[PREGUNTA DEL USUARIO]
{pregunta}
```

**Datos del sistema incluidos automáticamente:**
- Conteo de NCs abiertas/cerradas por mes
- Rechazos externos e internos del mes actual
- CAPAs abiertas y vencidas
- Registros AQL recientes
- KPIs del dashboard principal

---

## Componentes frontend

### `client/src/pages/AsistenteQC.tsx`

**Secciones:**
1. **Header** — título, contador de docs activos, indicador de estado del sistema
2. **Área de chat** — mensajes con rol (usuario/asistente) + fuentes citadas al pie de cada respuesta
3. **Preguntas sugeridas** — chips interactivos (se ocultan al iniciar conversación)
4. **Panel admin** (visible solo para admin) — lista de documentos con toggle activo/inactivo + botón de subida
5. **Input** — textarea + botón enviar; deshabilitado durante streaming

**Estado React (sin persistencia):**
```ts
const [mensajes, setMensajes] = useState<Mensaje[]>([])
const [cargando, setCargando] = useState(false)
const [docs, setDocs] = useState<Doc[]>([])
```

---

## Librerías nuevas

| Paquete | Uso |
|---|---|
| `pdf-parse` | Extracción de texto de PDF |
| `mammoth` | Extracción de texto de Word (.docx) |
| `xlsx` | Extracción de texto de Excel (.xlsx, .xls) |
| `openai` | SDK compatible con OpenRouter API |

**Variables de entorno nuevas:**
```
OPENROUTER_API_KEY=<key>
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet   # o el modelo preferido
```

---

## Permisos

- **Todos los usuarios autenticados** — pueden chatear
- **Solo administradores** — pueden subir, activar/desactivar y eliminar documentos
- El panel de gestión de documentos aparece en la misma página `/asistente` pero solo visible para admins

---

## Límites y consideraciones

- **Tamaño máximo de documento:** 10 MB por archivo
- **Tipos permitidos:** `.pdf`, `.docx`, `.xlsx`, `.xls`, `.txt`
- **Contexto máximo:** Si el texto combinado de todos los docs supera ~100,000 caracteres, se recorta por orden de prioridad (más recientes primero) con aviso en consola
- **Sin Mattermost en esta versión:** `MM_BOT_TOKEN` y `MM_CHANNEL_ID` disponibles para notificaciones futuras (ej. alertar cuando se sube un documento nuevo)

---

## Flujo de subida de documento (admin)

1. Admin selecciona archivo en el panel
2. `POST /api/asistente/docs` con `multipart/form-data`
3. Backend valida MIME type
4. Sube archivo a S3: `asistente/{timestamp}-{nombre}`
5. Extrae texto según tipo (pdf-parse / mammoth / xlsx)
6. Inserta registro en `asistente_docs` con `texto_extraido`
7. Responde con el documento creado
8. Frontend actualiza lista de documentos

---

## Variables de entorno a agregar en Coolify

```
OPENROUTER_API_KEY=<key>
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

Solicitarlas al admin del stack vía `@coolify-manager` en el canal `app-control-calidad-qc`.

---

## Módulos existentes a actualizar

- `server/routes.ts` — agregar sección `// ── ASISTENTE QC ──` con instancia multer propia (acepta pdf/docx/xlsx/txt, no solo imágenes)
- `shared/schema.ts` — agregar tabla `asistente_docs`
- `client/src/App.tsx` — agregar ruta `/asistente`
- `client/src/components/Sidebar.tsx` — agregar link al módulo
- `server/auth.ts` — agregar `asistente` a `SCOPE_DOMAINS`
- `client/src/pages/Usuarios.tsx` — agregar `asistente` a `MODULOS_PERMISOS`
