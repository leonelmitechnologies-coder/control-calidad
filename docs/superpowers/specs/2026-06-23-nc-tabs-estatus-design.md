# Diseño: Módulo No Conformidades — Tabs por Estatus

**Fecha:** 2026-06-23
**Estado:** Aprobado

---

## Contexto

El módulo actual muestra todos los registros del día en una tabla plana debajo del formulario. Con muchos registros el scroll se vuelve interminable. El objetivo es reorganizar la sección "Registros del día" para que sea compacta, clara y fácil de operar por personal no técnico.

---

## Qué cambia

Solo la sección **"Registros del día"** (segunda card del módulo NC). El formulario de registro no se modifica.

---

## Diseño

### 1. Tabs por estatus

Tres pestañas horizontales sobre la tabla:

| Tab | Color del contador | Tab activo por defecto |
|---|---|---|
| Abiertas | Rojo | Sí |
| En proceso | Azul | No |
| Cerradas | Verde | No |

- Cada tab muestra un badge con el conteo de registros de ese estatus.
- Los conteos se actualizan en tiempo real al cambiar estatus desde el modal.
- El filtro por área (dropdown) se mantiene en la esquina superior derecha de la card, filtra el tab activo.
- El filtro por severidad que existía antes **se elimina** — la severidad es visible directamente en la columna de la tabla y ya no se necesita como filtro independiente.

### 2. Columnas de la tabla (iguales en los 3 tabs)

`#` | `Hora` | `Área` | `Tipo` | `Severidad` | `Registrado por` | `Ver →`

- No se muestra la columna Estatus (está implícita en el tab).
- No se muestra la columna Descripción, Responsable ni Acción (se ven en el modal).
- Hacer clic en cualquier fila —o en el botón "Ver →"— abre el modal de detalle.

### 3. Modal de detalle

Campos que muestra:
- Hora, Área, Tipo, Descripción, Severidad, Responsable, Acción inmediata, Registrado por

Botones de acción adaptados al estatus actual:

| Estatus actual | Botones disponibles |
|---|---|
| Abierta | "Marcar En proceso" · "Marcar Cerrada" · Eliminar · Cerrar |
| En proceso | "Marcar Cerrada" · "Regresar a Abierta" · Eliminar · Cerrar |
| Cerrada | "Reabrir" · Eliminar · Cerrar |

- Al cambiar estatus desde el modal: el modal se cierra, la tabla se refresca, los contadores se actualizan.
- El botón Eliminar pide confirmación antes de proceder.
- "Eliminar" y "Cerrar" se posicionan a la derecha para separarlos visualmente de las acciones de estatus.

---

## Lo que NO cambia

- Formulario de registro de nueva NC.
- Campos almacenados en la base de datos.
- APIs del backend (`GET /api/nc`, `PATCH /api/nc/:id/estatus`, `DELETE /api/nc/:id`).
- Módulo de Usuarios.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `index.html` | Reemplazar la segunda card del módulo NC (HTML + CSS + JS de `modNC`) |

Sin cambios en `server.js` ni en la base de datos.
