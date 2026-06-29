# Base de Datos — Control de Calidad
**Motor:** PostgreSQL 14+ · **Base de datos:** `control_calidad` · **Puerto:** 5432

---

## Resumen de tablas

| Tabla | Descripción | Filas relacionadas |
|---|---|---|
| `usuarios` | Cuentas del sistema | — |
| `no_conformidades` | Registro de NCs | → `capas` |
| `recepciones` | Cargas entrantes/salientes | — |
| `rechazos_externos` | Return orders | → `re_problem_descriptions`, `re_images`, `re_corrective_actions`, `capas` |
| `re_problem_descriptions` | Descripciones de problemas (1..N por rechazo externo) | ← `rechazos_externos` |
| `re_images` | Fotos de rechazos externos (1..N) | ← `rechazos_externos` |
| `re_corrective_actions` | Acciones correctivas por departamento (1..N) | ← `rechazos_externos` |
| `rechazos_internos` | Defectos internos con COPQ | → `ri_images` |
| `ri_images` | Fotos de rechazos internos (1..N) | ← `rechazos_internos` |
| `capas` | Acciones correctivas/preventivas | → `capa_5porques`, `capa_ishikawa`, `capa_acciones` |
| `capa_5porques` | Respuestas del análisis 5 Por Qués (5 filas por CAPA) | ← `capas` |
| `capa_ishikawa` | Causas del diagrama Ishikawa (6 categorías por CAPA) | ← `capas` |
| `capa_acciones` | Acciones de seguimiento dentro de una CAPA (1..N) | ← `capas` |
| `aql_registros` | Inspecciones AQL de productos | — |
| `catalogo_sku` | Catálogo de SKUs para autocomplete | — |
| `liberacion_shipping` | Liberaciones de órdenes de envío | — |
| `organigrama_qc` | Equipo de calidad | → `calendario_solicitudes`, `calendario_saldo` |
| `calendario_solicitudes` | Solicitudes de vacaciones/permisos | ← `organigrama_qc` |
| `calendario_festivos` | Días festivos oficiales | — |
| `calendario_saldo` | Saldo vacacional por colaborador y año | ← `organigrama_qc` |

> **Nota general:** La mayoría de tablas no usan FK formales entre sí. `registrado_por` guarda una copia en texto del nombre del usuario al momento del registro. Las excepciones son `ri_images → rechazos_internos` y `calendario_solicitudes/saldo → organigrama_qc`, que sí tienen FK con `ON DELETE CASCADE`.

---

## Diagrama de relaciones (simplificado)

```
usuarios
  └─ (registrado_por, texto) ──→ no_conformidades, recepciones,
                                  rechazos_externos, rechazos_internos,
                                  capas, calendario_solicitudes

no_conformidades ──(origen_tipo='nc', origen_id)──→ capas

rechazos_externos
  ├── re_problem_descriptions  (rechazo_id, sin FK formal)
  ├── re_images                (rechazo_id, sin FK formal)
  ├── re_corrective_actions    (rechazo_id, sin FK formal)
  └──(origen_tipo='re', origen_id)──→ capas

rechazos_internos
  └── ri_images                (rechazo_id, FK ON DELETE CASCADE)

capas
  ├── capa_5porques            (capa_id, sin FK formal)
  ├── capa_ishikawa            (capa_id, sin FK formal)
  └── capa_acciones            (capa_id, sin FK formal)

organigrama_qc
  ├── calendario_solicitudes   (colaborador_id, FK)
  └── calendario_saldo         (colaborador_id, FK)
```

---

## Tabla: `usuarios`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK autoincremental |
| `nombre` | VARCHAR(100) | NO | — | Nombre completo |
| `usuario` | VARCHAR(50) | NO | — | Login único (UNIQUE) |
| `password_hash` | TEXT | NO | — | Hash bcrypt cost=10 |
| `rol` | VARCHAR(20) | NO | `'Usuario'` | `'Administrador'` \| `'Usuario'` |
| `area` | VARCHAR(50) | SÍ | `''` | Área organizacional |
| `activo` | BOOLEAN | NO | `true` | `false` = no puede iniciar sesión |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Fecha de creación |

**APIs:**

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/usuarios` | admin | Lista todos los usuarios |
| POST | `/api/usuarios` | admin | Crea nuevo usuario |
| PUT | `/api/usuarios/:id` | admin | Edita nombre, login, contraseña, rol |
| PATCH | `/api/usuarios/:id/toggle` | admin | Activa / desactiva usuario |
| DELETE | `/api/usuarios/:id` | admin | Elimina usuario |

---

## Tabla: `no_conformidades`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `hora` | TIME | NO | — | Hora de detección |
| `area` | VARCHAR(50) | NO | — | Área donde se detectó |
| `tipo` | VARCHAR(100) | NO | — | Categoría del problema |
| `descripcion` | TEXT | NO | — | Descripción detallada |
| `severidad` | VARCHAR(10) | NO | — | `'Alta'` \| `'Media'` \| `'Baja'` |
| `responsable` | VARCHAR(100) | SÍ | `'—'` | Responsable de atención |
| `accion` | TEXT | SÍ | `'—'` | Acción inmediata tomada |
| `registrado_por` | VARCHAR(100) | SÍ | — | Nombre del usuario que registró |
| `estatus` | VARCHAR(20) | NO | `'Abierta'` | `'Abierta'` \| `'En proceso'` \| `'Cerrada'` |
| `fecha` | DATE | NO | — | Fecha del registro |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp de inserción |

**Valores de `tipo`:** `Producto no conforme`, `Proceso fuera de parametro`, `Documentacion incorrecta`, `Equipo defectuoso`, `Incumplimiento de procedimiento`, `Proveedor`, `Otro`

**Ciclo de estatus:** `Abierta → En proceso → Cerrada`

**APIs:**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/nc` | Lista NCs del día actual |
| GET | `/api/nc?fecha=YYYY-MM-DD` | Lista NCs de una fecha |
| GET | `/api/nc?fecha=todos` | Lista todas las NCs (con cnt_capas) |
| POST | `/api/nc` | Registra nueva NC |
| PATCH | `/api/nc/:id/estatus` | Cambia estatus |
| DELETE | `/api/nc/:id` | Elimina NC |

---

## Tabla: `recepciones`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `hora` | TIME | NO | — | Hora de recepción |
| `company` | VARCHAR(100) | NO | — | Empresa transportista |
| `origen` | VARCHAR(100) | NO | — | Origen de la carga |
| `cargo` | VARCHAR(100) | NO | — | Descripción de la carga |
| `unit_qty` | INTEGER | NO | `0` | Número de unidades |
| `pallet_qty` | INTEGER | NO | `0` | Número de pallets |
| `tipo` | VARCHAR(20) | NO | `'Import'` | `'Import'` \| `'Export'` |
| `estatus` | VARCHAR(30) | NO | `'Confirmado'` | `'Confirmado'` \| `'En descarga'` \| `'Descargado'` \| `'Rechazado'` |
| `registrado_por` | VARCHAR(100) | SÍ | — | Nombre del usuario |
| `fecha` | DATE | NO | — | Fecha de la recepción |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp de inserción |

**APIs:**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/recepciones` | Lista recepciones (filtro por fecha) |
| POST | `/api/recepciones` | Registra nueva recepción |
| PUT | `/api/recepciones/:id` | Edita recepción |
| PATCH | `/api/recepciones/:id/estatus` | Cambia estatus |
| DELETE | `/api/recepciones/:id` | Elimina recepción |

---

## Tabla: `rechazos_externos`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `return_order` | VARCHAR(100) | NO | — | Número de return order |
| `license_plate` | VARCHAR(50) | NO | — | Placa del vehículo |
| `classification` | VARCHAR(100) | NO | `''` | Clasificación del producto |
| `inches` | VARCHAR(20) | NO | `''` | Pulgadas del producto |
| `sales_channel` | VARCHAR(100) | NO | `''` | Canal de ventas |
| `sku` | VARCHAR(100) | NO | `''` | SKU del producto |
| `brand` | VARCHAR(100) | NO | `''` | Marca |
| `plant_entry` | TIMESTAMP | NO | — | Entrada a planta |
| `plant_exit` | TIMESTAMP | SÍ | — | Salida de planta |
| `total_time_minutes` | INTEGER | SÍ | — | Tiempo total en minutos |
| `outbound_order` | VARCHAR(100) | NO | `''` | Orden de salida |
| `processed_by` | VARCHAR(200) | NO | `''` | Procesado por |
| `registration_date` | DATE | SÍ | — | Fecha de registro (ALTER TABLE) |
| `sale_price` | NUMERIC(10,2) | SÍ | — | Precio de venta — KPI principal (ALTER TABLE) |
| `registrado_por` | VARCHAR(100) | SÍ | — | Nombre del usuario |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp de inserción |

**Tablas relacionadas:** `re_problem_descriptions`, `re_images`, `re_corrective_actions`

**APIs:**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/rechazos-externos` | Lista todos los rechazos externos |
| GET | `/api/rechazos-externos/:id` | Detalle completo con subtablas |
| POST | `/api/rechazos-externos` | Crea rechazo + descripciones + acciones (transacción) |
| PUT | `/api/rechazos-externos/:id` | Edita rechazo + subtablas (transacción) |
| POST | `/api/rechazos-externos/:id/images` | Sube fotos (multer, máx 10 MB) |
| DELETE | `/api/rechazos-externos/:id/images/:imageId` | Elimina una foto |
| DELETE | `/api/rechazos-externos/:id` | Elimina rechazo + subtablas |
| GET | `/api/rechazos-externos/:id/pdf` | Genera PDF NCR (Puppeteer, A4 horizontal) |

---

## Tabla: `re_problem_descriptions`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `rechazo_id` | INTEGER | NO | — | ID de `rechazos_externos` (sin FK formal) |
| `orden` | SMALLINT | NO | `1` | Número de orden (1, 2, 3…) |
| `descripcion` | TEXT | NO | — | Descripción del problema |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

---

## Tabla: `re_images`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `rechazo_id` | INTEGER | NO | — | ID de `rechazos_externos` (sin FK formal) |
| `filename` | VARCHAR(255) | NO | — | Nombre del archivo en `/uploads/rechazos/` |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

---

## Tabla: `re_corrective_actions`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `rechazo_id` | INTEGER | NO | — | ID de `rechazos_externos` (sin FK formal) |
| `departamento` | VARCHAR(50) | NO | — | Departamento responsable |
| `orden` | SMALLINT | NO | `1` | Número de orden |
| `accion` | TEXT | NO | — | Descripción de la acción |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

---

## Tabla: `rechazos_internos`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `fecha_registro` | DATE | NO | — | Fecha del hallazgo |
| `license_plate` | VARCHAR(50) | NO | — | Placa del vehículo |
| `sku` | VARCHAR(100) | NO | `''` | SKU del producto |
| `defecto` | VARCHAR(100) | NO | — | Tipo de defecto detectado |
| `actividad_realizar` | TEXT | NO | `''` | Actividad a realizar (auto según defecto) |
| `costo_no_calidad` | NUMERIC(10,2) | NO | `0` | COPQ en MXN (auto según defecto) |
| `origen_hallazgo` | VARCHAR(50) | NO | `''` | Dónde se detectó |
| `inspector` | VARCHAR(100) | NO | `''` | Nombre del inspector |
| `firma_filename` | VARCHAR(255) | NO | `''` | Nombre del archivo de firma digital |
| `registrado_por` | VARCHAR(100) | SÍ | — | Nombre del usuario |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

**Mapeo COPQ (defecto → actividad → costo MXN):** El frontend calcula automáticamente `actividad_realizar` y `costo_no_calidad` según el defecto seleccionado. Hay 11 tipos de defecto con valores fijos.

**APIs:**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/rechazos-internos` | Lista todos |
| GET | `/api/rechazos-internos/:id` | Detalle con imágenes |
| POST | `/api/rechazos-internos` | Crea rechazo interno |
| PUT | `/api/rechazos-internos/:id` | Edita rechazo |
| POST | `/api/rechazos-internos/:id/images` | Sube fotos |
| POST | `/api/rechazos-internos/:id/firma` | Guarda firma digital (PNG) |
| DELETE | `/api/rechazos-internos/:id/images/:imgId` | Elimina foto |
| DELETE | `/api/rechazos-internos/:id` | Elimina rechazo |

---

## Tabla: `ri_images`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `rechazo_id` | INTEGER | NO | — | FK → `rechazos_internos(id) ON DELETE CASCADE` |
| `filename` | VARCHAR(255) | NO | — | Nombre del archivo en `/uploads/rechazos-internos/` |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

---

## Tabla: `capas`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `origen_tipo` | VARCHAR(5) | NO | — | `'nc'` \| `'re'` |
| `origen_id` | INTEGER | NO | — | ID de la NC o RE que origina la CAPA |
| `titulo` | TEXT | NO | `''` | Título descriptivo |
| `descripcion_problema` | TEXT | NO | `''` | Descripción detallada del problema |
| `metodo_analisis` | VARCHAR(10) | NO | `'5porques'` | `'5porques'` \| `'ishikawa'` |
| `responsable` | VARCHAR(100) | NO | `''` | Responsable de la CAPA |
| `fecha_apertura` | DATE | NO | — | Fecha de apertura |
| `fecha_compromiso` | DATE | SÍ | — | Fecha límite de cierre |
| `fecha_cierre` | DATE | SÍ | — | Fecha real de cierre (se llena al cerrar) |
| `estatus` | VARCHAR(20) | NO | `'Abierta'` | `'Abierta'` \| `'En proceso'` \| `'Cerrada'` |
| `verificado_por` | VARCHAR(100) | NO | `''` | Quien verifica el cierre |
| `observaciones` | TEXT | NO | `''` | Observaciones adicionales |
| `registrado_por` | VARCHAR(100) | NO | `''` | Nombre del usuario |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

**APIs:**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/capas` | Lista todas las CAPAs |
| GET | `/api/capas/:id` | Detalle completo con subtablas |
| POST | `/api/capas` | Crea CAPA + análisis + acciones (transacción) |
| PUT | `/api/capas/:id` | Edita CAPA + subtablas (transacción) |
| PATCH | `/api/capas/:id/estatus` | Cambia estatus |
| PATCH | `/api/capas/:id/acciones/:aid` | Cambia estatus de una acción individual |
| DELETE | `/api/capas/:id` | Elimina CAPA + subtablas (cascada manual) |

---

## Tabla: `capa_5porques`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `capa_id` | INTEGER | NO | — | ID de `capas` (sin FK formal) |
| `orden` | SMALLINT | NO | — | Nivel del Por Qué (1 al 5) |
| `respuesta` | TEXT | NO | `''` | Respuesta al Por Qué N |

---

## Tabla: `capa_ishikawa`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `capa_id` | INTEGER | NO | — | ID de `capas` (sin FK formal) |
| `categoria` | VARCHAR(50) | NO | — | `'Hombre'` \| `'Máquina'` \| `'Método'` \| `'Material'` \| `'Medición'` \| `'Medio Ambiente'` |
| `causa` | TEXT | NO | `''` | Causa identificada en esa categoría |

---

## Tabla: `capa_acciones`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `capa_id` | INTEGER | NO | — | ID de `capas` (sin FK formal) |
| `accion` | TEXT | NO | `''` | Descripción de la acción |
| `responsable` | VARCHAR(100) | NO | `''` | Responsable de ejecutarla |
| `fecha_compromiso` | DATE | SÍ | — | Fecha límite |
| `estatus` | VARCHAR(20) | NO | `'Pendiente'` | `'Pendiente'` \| `'En progreso'` \| `'Completada'` |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

---

## Tabla: `aql_registros`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `fecha_registro` | DATE | NO | — | Fecha de la inspección |
| `license_plate` | VARCHAR(50) | NO | — | Placa del vehículo |
| `clasificacion` | VARCHAR(10) | NO | `''` | Clasificación del producto |
| `sku` | VARCHAR(100) | NO | `''` | SKU (autocomplete desde `catalogo_sku`) |
| `marca` | VARCHAR(100) | NO | `''` | Marca |
| `modelo` | VARCHAR(100) | NO | `''` | Modelo |
| `pulgada` | VARCHAR(20) | NO | `''` | Pulgadas |
| `descripcion` | TEXT | NO | `''` | Descripción del producto |
| `accesorios_presentes` | VARCHAR(20) | NO | `''` | `'Sí'` \| `'No'` |
| `estado_accesorios` | VARCHAR(20) | NO | `''` | `'OK'` \| `'Defecto'` |
| `accesorios_defectos` | TEXT | NO | `''` | Descripción de defectos en accesorios |
| `estado_bolsa` | VARCHAR(20) | NO | `''` | `'OK'` \| `'Defecto'` |
| `bolsa_defectos` | TEXT | NO | `''` | Descripción de defectos en bolsa |
| `estado_audio` | VARCHAR(20) | NO | `''` | `'OK'` \| `'Defecto'` |
| `audio_defectos` | TEXT | NO | `''` | Descripción de defectos en audio |
| `estado_video` | VARCHAR(20) | NO | `''` | `'OK'` \| `'Defecto'` |
| `video_defectos` | TEXT | NO | `''` | Descripción de defectos en video |
| `estado_fisico_pantalla` | VARCHAR(20) | NO | `''` | `'OK'` \| `'Defecto'` |
| `fisico_pantalla_defectos` | TEXT | NO | `''` | Descripción de defectos físicos en pantalla |
| `estado_limpieza` | VARCHAR(20) | NO | `''` | `'OK'` \| `'Defecto'` |
| `limpieza_defectos` | TEXT | NO | `''` | Descripción de defectos de limpieza |
| `estado_aql` | VARCHAR(20) | NO | `''` | Resultado final: `'Aprobado'` \| `'Rechazado'` |
| `foto_lpn_filename` | VARCHAR(255) | NO | `''` | Foto LPN en `/uploads/aql/` |
| `foto_pantalla_filename` | VARCHAR(255) | NO | `''` | Foto pantalla en `/uploads/aql/` |
| `inspector` | VARCHAR(100) | NO | `''` | Nombre del inspector |
| `registrado_por` | VARCHAR(100) | SÍ | — | Nombre del usuario |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

**APIs:**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/aql` | Lista todos los registros AQL |
| GET | `/api/aql/:id` | Detalle de un registro |
| POST | `/api/aql` | Crea registro AQL |
| PUT | `/api/aql/:id` | Edita registro AQL |
| POST | `/api/aql/:id/foto-lpn` | Sube foto LPN (multer) |
| POST | `/api/aql/:id/foto-pantalla` | Sube foto pantalla (multer) |
| DELETE | `/api/aql/:id` | Elimina registro AQL |

---

## Tabla: `catalogo_sku`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `sku` | TEXT | NO | — | SKU único (UNIQUE) |
| `marca` | TEXT | NO | `''` | Marca del producto |
| `modelo` | TEXT | NO | `''` | Modelo |
| `descripcion` | TEXT | NO | `''` | Descripción |
| `pulgada` | TEXT | NO | `''` | Pulgadas |

> Usado para el autocomplete de SKU en los módulos AQL y Rechazos Internos.

---

## Tabla: `liberacion_shipping`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `fecha` | DATE | NO | — | Fecha de la liberación |
| `numero_orden` | VARCHAR(100) | NO | `''` | Número de orden |
| `hora_inicio` | TIME | NO | `'00:00'` | Hora de inicio de inspección |
| `hora_fin` | TIME | NO | `'00:00'` | Hora de fin de inspección |
| `destino` | VARCHAR(50) | NO | `''` | Destino del envío |
| `tipo_envio` | VARCHAR(20) | NO | `''` | Tipo de envío |
| `tipo_orden` | VARCHAR(50) | NO | `''` | Tipo de orden |
| `paqueteria` | VARCHAR(50) | NO | `''` | Paquetería / transportista |
| `numero_contenedor` | VARCHAR(100) | NO | `''` | Número de contenedor |
| `numero_sello` | VARCHAR(100) | NO | `''` | Número de sello |
| `cantidad_pallets` | INTEGER | NO | `0` | Cantidad de pallets |
| `cantidad_manifiesto` | INTEGER | NO | `0` | Cantidad según manifiesto |
| `cantidad_fisica` | INTEGER | NO | `0` | Cantidad física verificada |
| `estado` | VARCHAR(30) | NO | `''` | Estado del contenedor |
| `cantidad_diferencia` | INTEGER | NO | `0` | Diferencia manifiesto vs física |
| `resultado_inspeccion` | VARCHAR(20) | NO | `''` | `'Aprobado'` \| `'Rechazado'` |
| `foto_contenedor_vacio` | VARCHAR(255) | NO | `''` | Foto contenedor vacío en `/uploads/shipping/` |
| `foto_contenedor_cargado` | VARCHAR(255) | NO | `''` | Foto contenedor cargado |
| `foto_caja_sellada` | VARCHAR(255) | NO | `''` | Foto caja sellada |
| `foto_placas` | VARCHAR(255) | NO | `''` | Foto placas del vehículo |
| `foto_manifiesto` | VARCHAR(255) | NO | `''` | Foto del manifiesto |
| `inspector` | VARCHAR(100) | NO | `''` | Nombre del inspector |
| `estatus_carga` | VARCHAR(30) | NO | `''` | Estatus de la carga |
| `comentarios` | TEXT | NO | `''` | Comentarios adicionales |
| `registrado_por` | VARCHAR(100) | SÍ | — | Nombre del usuario |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

**APIs:**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/liberacion-shipping` | Lista todos los registros |
| GET | `/api/liberacion-shipping/:id` | Detalle de un registro |
| POST | `/api/liberacion-shipping` | Crea registro de liberación |
| PUT | `/api/liberacion-shipping/:id` | Edita registro |
| DELETE | `/api/liberacion-shipping/:id` | Elimina registro |
| POST | `/api/liberacion-shipping/:id/foto-contenedor-vacio` | Sube foto contenedor vacío |
| POST | `/api/liberacion-shipping/:id/foto-contenedor-cargado` | Sube foto contenedor cargado |
| POST | `/api/liberacion-shipping/:id/foto-caja-sellada` | Sube foto caja sellada |
| POST | `/api/liberacion-shipping/:id/foto-placas` | Sube foto placas |
| POST | `/api/liberacion-shipping/:id/foto-manifiesto` | Sube foto manifiesto |

---

## Tabla: `organigrama_qc`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `nombre_completo` | VARCHAR(200) | NO | — | Nombre completo del colaborador |
| `no_empleado` | VARCHAR(50) | NO | `''` | Número de empleado |
| `puesto` | VARCHAR(50) | NO | — | Ver valores abajo |
| `area` | VARCHAR(100) | NO | `''` | Área de trabajo |
| `turno` | VARCHAR(50) | NO | `''` | `'Turno 1'` \| `'Turno 2'` |
| `estatus` | VARCHAR(20) | NO | `'activo'` | `'activo'` \| `'inactivo'` |
| `fecha_ingreso` | DATE | SÍ | — | Fecha de ingreso a la empresa |
| `telefono` | VARCHAR(20) | NO | `''` | Teléfono personal |
| `correo` | VARCHAR(100) | NO | `''` | Correo electrónico |
| `sexo` | VARCHAR(20) | NO | `''` | Sexo |
| `fecha_nacimiento` | DATE | SÍ | — | Fecha de nacimiento |
| `contacto_emergencia` | VARCHAR(200) | NO | `''` | Nombre del contacto de emergencia |
| `tel_emergencia` | VARCHAR(20) | NO | `''` | Teléfono del contacto de emergencia |
| `foto_filename` | VARCHAR(255) | NO | `''` | Nombre del archivo en `/uploads/organigrama/` (ALTER TABLE) |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

**Valores de `puesto`:** `Ingeniero de Calidad`, `Supervisor de Calidad`, `Tecnico de Calidad`, `Especialista de Calidad`, `Inspector de Calidad`

**Valores de `area`:** `Incoming`, `Sorting`, `FFT`, `Paletizado`, `Almacen`, `Shipping`

**APIs:**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/organigrama-qc` | Lista todo el equipo |
| POST | `/api/organigrama-qc` | Registra colaborador |
| PUT | `/api/organigrama-qc/:id` | Edita colaborador |
| PATCH | `/api/organigrama-qc/:id/estatus` | Toggle activo/inactivo |
| POST | `/api/organigrama-qc/:id/foto` | Sube foto (multer, máx 5 MB) |
| DELETE | `/api/organigrama-qc/:id` | Elimina colaborador |

---

## Tabla: `calendario_solicitudes`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `colaborador_id` | INTEGER | NO | — | FK → `organigrama_qc(id)` |
| `tipo` | VARCHAR(50) | NO | — | `'Vacaciones'` \| `'Permiso'` \| `'Incapacidad'` \| `'Capacitación'` |
| `fecha_inicio` | DATE | NO | — | Inicio del período |
| `fecha_fin` | DATE | NO | — | Fin del período |
| `dias_habiles` | INTEGER | NO | `1` | Días hábiles calculados |
| `motivo` | TEXT | NO | `''` | Motivo de la solicitud |
| `estatus` | VARCHAR(20) | NO | `'pendiente'` | `'pendiente'` \| `'aprobado'` \| `'rechazado'` |
| `aprobado_por` | VARCHAR(100) | NO | `''` | Quien aprobó o rechazó |
| `observaciones` | TEXT | NO | `''` | Notas adicionales |
| `registrado_por` | VARCHAR(100) | NO | `''` | Nombre del usuario |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

---

## Tabla: `calendario_festivos`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `nombre` | VARCHAR(100) | NO | — | Nombre del festivo |
| `fecha` | DATE | NO | — | Fecha del festivo |
| `recurrente` | BOOLEAN | SÍ | `true` | Si es `true`, se compara solo mes+día cada año |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

**Festivos precargados al iniciar (si tabla vacía):** Año Nuevo, Día de la Constitución, Natalicio de Benito Juárez, Día del Trabajo, Independencia de México, Revolución Mexicana, Navidad.

---

## Tabla: `calendario_saldo`

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | SERIAL | NO | auto | PK |
| `colaborador_id` | INTEGER | NO | — | FK → `organigrama_qc(id)` |
| `anio` | INTEGER | NO | — | Año del saldo |
| `dias_asignados` | INTEGER | NO | `0` | Días de vacaciones asignados ese año |
| `created_at` | TIMESTAMP | SÍ | `NOW()` | Timestamp |

**Restricción:** `UNIQUE(colaborador_id, anio)` — un registro por colaborador por año.

---

## Dashboard — APIs y KPIs

**Endpoint:** `GET /api/dashboard?periodo=mes|ytd&anio=YYYY&mes=MM`

| KPI | Fuente | Descripción |
|---|---|---|
| External Rejects Prices | `rechazos_externos.sale_price` | Suma del período |
| Internal Reject Prices | `rechazos_internos.costo_no_calidad` | Suma del período (MXN) |
| Total Rejects Cost | Suma de los dos anteriores | KPI principal del dashboard |
| NCs Abiertas | `no_conformidades` WHERE `estatus='Abierta'` | COUNT del período |
| Colaboradores Activos | `organigrama_qc` WHERE `estatus='activo'` | COUNT total |
| Total Rechazos Externos | `rechazos_externos` | COUNT del período |

**Gráficos:**
- Sale Price por Marca (top 6, `rechazos_externos.brand`)
- Rechazos por Clasificación (top 6, `rechazos_externos.classification`)
- NCs por Severidad (`Alta` / `Media` / `Baja`)
- NCs por Área (top 6)

---

## Autenticación — APIs

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/login` | Inicia sesión; retorna `{ id, nombre, usuario, rol }` |
| POST | `/api/logout` | Destruye la sesión |
| GET | `/api/me` | Retorna el usuario de sesión activo |

Sesión de 8 horas (`maxAge: 8 * 60 * 60 * 1000`). Se usa `express-session` con almacenamiento en memoria.

---

## Calendario — APIs

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/calendario` | Lista solicitudes (filtro por colaborador/año) |
| POST | `/api/calendario` | Crea solicitud |
| PUT | `/api/calendario/:id` | Edita solicitud |
| PATCH | `/api/calendario/:id/estatus` | Aprueba o rechaza solicitud |
| DELETE | `/api/calendario/:id` | Elimina solicitud |
| GET | `/api/calendario/festivos` | Lista festivos |
| POST | `/api/calendario/festivos` | Agrega festivo |
| DELETE | `/api/calendario/festivos/:id` | Elimina festivo |
| GET | `/api/calendario/saldo` | Consulta saldo vacacional |
| POST | `/api/calendario/saldo` | Asigna/actualiza saldo de un año |

---

## Guía de cambios

| Si necesitas… | Editar… |
|---|---|
| Agregar una columna a una tabla | `server.js` `initDB()` con `ALTER TABLE … ADD COLUMN IF NOT EXISTS` + endpoint + frontend |
| Agregar un nuevo módulo | `server.js` (endpoints) + `public/index.html` (MODULOS, nav, HTML, JS object) |
| Cambiar los tipos de defecto COPQ | `public/index.html` objeto `COPQ_MAP` en el módulo Rechazos Internos |
| Cambiar la duración de sesión | `server.js` L.30 (`maxAge`) |
| Cambiar el usuario/contraseña inicial | `server.js` `initDB()` bloque de usuario admin |
| Agregar un nuevo rol | `server.js` middleware `admin()` + frontend |
| Cambiar el puerto | `.env` variable `PORT` |

---

## Mejores prácticas aplicadas

- `CREATE TABLE IF NOT EXISTS` en todos los `CREATE` — idempotente al reiniciar.
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS` para columnas agregadas posteriormente.
- Contraseñas hasheadas con bcrypt (cost=10); nunca se almacena en texto plano.
- Transacciones (`BEGIN / COMMIT / ROLLBACK`) en escrituras multi-tabla (CAPA, Rechazos Externos).
- MIME type validation en todos los uploads — solo imágenes aceptadas.
- Archivos de upload separados por módulo en subdirectorios de `/public/uploads/`.

---

*Última actualización: 2026-06-29*
