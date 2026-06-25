# CLAUDE.md — Control de Calidad

Instrucciones para Claude Code al trabajar en este proyecto.

---

## Qué es este proyecto

Sistema web interno de Control de Calidad para MI Technologies (planta de logística/warehouse). Orientado a la certificación ISO 9001:2015. Stack monolito: Node.js + Express + PostgreSQL + SPA en un solo HTML.

---

## Estructura de archivos clave

| Archivo | Rol |
|---|---|
| `server.js` | Todo el backend: `initDB()`, middlewares, endpoints, Puppeteer PDF |
| `public/index.html` | Todo el frontend: HTML + CSS + JS vanilla (SPA monolito) |
| `docs/DATABASE.md` | Documentación completa de tablas y APIs |
| `docs/schema.sql` | DDL completo de todas las tablas |

---

## Convenciones que DEBES seguir

### Frontend

- **Sin frameworks:** Solo HTML5, CSS3 y JavaScript vanilla. Sin React, Vue, ni bundlers.
- **SPA con History API:** La navegación usa `history.pushState`. Cada módulo necesita:
  1. Entrada en el objeto `MODULOS` (con `titulo`, `render`, `init`)
  2. Link en el sidebar con `href="/ruta"`
  3. `<div id="mod-nombre-modulo">` en el HTML
- **Notificaciones:** Siempre usar `ui.notificar(msg, tipo)` y `ui.confirmar(msg)`. **Nunca** `alert()` ni `confirm()` nativos del navegador.
- **Modales propios:** El sistema tiene modales CSS propios. El `z-index` de `#modal-confirmar` y `#modal-notificar` es 400 para aparecer sobre cualquier otro modal.

### Backend

- **Un solo archivo:** Todo el backend vive en `server.js`. No crear archivos de rutas separados.
- **initDB():** Todas las tablas se crean con `CREATE TABLE IF NOT EXISTS`. Columnas nuevas con `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. El esquema debe ser idempotente.
- **Sin FK formales en la mayoría de relaciones:** `registrado_por` guarda texto (nombre del usuario), no un ID. Las FK explícitas que sí existen: `ri_images → rechazos_internos`, `calendario_solicitudes → organigrama_qc`, `calendario_saldo → organigrama_qc`.
- **Transacciones:** Las escrituras multi-tabla (CAPA, Rechazos Externos) usan `BEGIN / COMMIT / ROLLBACK`.
- **Uploads:** Multer con validación de MIME type (`image/*`). Directorios separados por módulo en `/public/uploads/`.

### Base de datos

- **Motor:** PostgreSQL 14+. Base de datos: `control_calidad`.
- **Costos en MXN:** El campo `costo_no_calidad` de `rechazos_internos` y los KPIs relacionados son en pesos mexicanos, no USD.
- **COPQ automático:** El mapeo defecto → actividad → costo está en el objeto `COPQ_MAP` del frontend (`public/index.html`), no en el servidor.

---

## Cómo agregar un módulo nuevo

1. En `server.js`: agregar los endpoints bajo un comentario `// ── NOMBRE MÓDULO ──`.
2. En `server.js` `initDB()`: agregar `CREATE TABLE IF NOT EXISTS` para las tablas nuevas.
3. En `public/index.html`:
   - Agregar entrada en el objeto `MODULOS` con `{ titulo, icono, render, init }`.
   - Agregar `<a href="/ruta" ...>` en el sidebar nav.
   - Agregar `<div id="mod-ruta">...</div>` con el HTML del módulo.
   - Agregar el objeto JS del módulo (funciones `cargar`, `abrir`, `guardar`, etc.).
4. Actualizar `docs/DATABASE.md` y `docs/schema.sql` con las tablas nuevas.
5. Actualizar `README.md` con el nuevo módulo en la tabla de módulos.

---

## Módulos actuales (2026-06-25)

| Módulo | Ruta | Tablas principales |
|---|---|---|
| Dashboard | `/` | — (consulta todas) |
| No Conformidades | `/nc` | `no_conformidades` |
| Recepciones | `/recepciones` | `recepciones` |
| Rechazos Externos | `/rechazos-ext` | `rechazos_externos`, `re_*` |
| Rechazos Internos | `/rechazos-int` | `rechazos_internos`, `ri_images` |
| Acciones Correctivas (CAPA) | `/capas` | `capas`, `capa_*` |
| Organigrama QC | `/organigrama-qc` | `organigrama_qc` |
| Calendario | `/calendario` | `calendario_*` |
| Usuarios | `/usuarios` | `usuarios` |

---

## Próximos módulos sugeridos (por prioridad)

1. **Calibración de Equipos** — ISO 9001:2015 cláusula 7.1.5
2. **Auditorías Internas** — ISO 9001:2015 cláusula 9.2
3. **Control de Documentos** — ISO 9001:2015 cláusula 7.5
4. **Evaluación de Proveedores** — ISO 9001:2015 cláusula 8.4
5. **Objetivos de Calidad con semáforo** — ISO 9001:2015 cláusula 6.2

---

## Lo que NO hacer

- No usar `alert()` / `confirm()` nativos.
- No crear archivos de rutas separados en el backend.
- No introducir frameworks JS (React, Vue, Angular, etc.).
- No agregar dependencias npm sin necesidad real.
- No cambiar los costos COPQ en el servidor; el mapeo vive en el frontend.
- No hardcodear textos en inglés en la UI; el sistema es en español (excepto términos técnicos ya establecidos como "CAPA", "NCR", "SKU", "COPQ").
