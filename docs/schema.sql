-- ============================================================
-- Control de Calidad — Esquema completo de base de datos
-- Base de datos: control_calidad (PostgreSQL 14+)
-- Última actualización: 2026-06-29
-- ============================================================
-- Nota: todas las tablas usan CREATE TABLE IF NOT EXISTS
-- y las columnas añadidas posteriormente usan ALTER TABLE … ADD COLUMN IF NOT EXISTS
-- para que el script sea idempotente al ejecutarse varias veces.
-- ============================================================

-- ── USUARIOS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  usuario       VARCHAR(50)  NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  rol           VARCHAR(20)  NOT NULL DEFAULT 'Usuario',   -- 'Administrador' | 'Usuario'
  area          VARCHAR(50)  DEFAULT '',
  activo        BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMP    DEFAULT NOW()
);

-- ── NO CONFORMIDADES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS no_conformidades (
  id             SERIAL PRIMARY KEY,
  hora           TIME         NOT NULL,
  area           VARCHAR(50)  NOT NULL,
  tipo           VARCHAR(100) NOT NULL,                    -- 'Producto no conforme' | 'Proceso fuera de parametro' | ...
  descripcion    TEXT         NOT NULL,
  severidad      VARCHAR(10)  NOT NULL,                    -- 'Alta' | 'Media' | 'Baja'
  responsable    VARCHAR(100) DEFAULT '—',
  accion         TEXT         DEFAULT '—',
  registrado_por VARCHAR(100),
  estatus        VARCHAR(20)  NOT NULL DEFAULT 'Abierta',  -- 'Abierta' | 'En proceso' | 'Cerrada'
  fecha          DATE         NOT NULL,
  created_at     TIMESTAMP    DEFAULT NOW()
);

-- ── RECEPCIONES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recepciones (
  id             SERIAL PRIMARY KEY,
  hora           TIME         NOT NULL,
  company        VARCHAR(100) NOT NULL,
  origen         VARCHAR(100) NOT NULL,
  cargo          VARCHAR(100) NOT NULL,
  unit_qty       INTEGER      NOT NULL DEFAULT 0,
  pallet_qty     INTEGER      NOT NULL DEFAULT 0,
  tipo           VARCHAR(20)  NOT NULL DEFAULT 'Import',      -- 'Import' | 'Export'
  estatus        VARCHAR(30)  NOT NULL DEFAULT 'Confirmado',  -- 'Confirmado' | 'En descarga' | 'Descargado' | 'Rechazado'
  registrado_por VARCHAR(100),
  fecha          DATE         NOT NULL,
  created_at     TIMESTAMP    DEFAULT NOW()
);

-- columna eliminada en producción:
ALTER TABLE recepciones DROP COLUMN IF EXISTS trailer;

-- ── RECHAZOS EXTERNOS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rechazos_externos (
  id                  SERIAL PRIMARY KEY,
  return_order        VARCHAR(100) NOT NULL,
  license_plate       VARCHAR(50)  NOT NULL,
  classification      VARCHAR(100) NOT NULL DEFAULT '',
  inches              VARCHAR(20)  NOT NULL DEFAULT '',
  sales_channel       VARCHAR(100) NOT NULL DEFAULT '',
  sku                 VARCHAR(100) NOT NULL DEFAULT '',
  brand               VARCHAR(100) NOT NULL DEFAULT '',
  plant_entry         TIMESTAMP    NOT NULL,
  plant_exit          TIMESTAMP,
  total_time_minutes  INTEGER,
  outbound_order      VARCHAR(100) NOT NULL DEFAULT '',
  processed_by        VARCHAR(200) NOT NULL DEFAULT '',
  registrado_por      VARCHAR(100),
  created_at          TIMESTAMP    DEFAULT NOW()
);

-- columnas añadidas posteriormente:
ALTER TABLE rechazos_externos ADD COLUMN IF NOT EXISTS registration_date DATE;
ALTER TABLE rechazos_externos ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2); -- KPI principal (MXN)

CREATE TABLE IF NOT EXISTS re_problem_descriptions (
  id          SERIAL PRIMARY KEY,
  rechazo_id  INTEGER   NOT NULL,   -- referencia a rechazos_externos(id), sin FK formal
  orden       SMALLINT  NOT NULL DEFAULT 1,
  descripcion TEXT      NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS re_images (
  id          SERIAL PRIMARY KEY,
  rechazo_id  INTEGER      NOT NULL,   -- referencia a rechazos_externos(id), sin FK formal
  filename    VARCHAR(255) NOT NULL,   -- archivo en /public/uploads/rechazos/
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS re_corrective_actions (
  id           SERIAL PRIMARY KEY,
  rechazo_id   INTEGER     NOT NULL,   -- referencia a rechazos_externos(id), sin FK formal
  departamento VARCHAR(50) NOT NULL,
  orden        SMALLINT    NOT NULL DEFAULT 1,
  accion       TEXT        NOT NULL,
  created_at   TIMESTAMP   DEFAULT NOW()
);

-- ── RECHAZOS INTERNOS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rechazos_internos (
  id                 SERIAL PRIMARY KEY,
  fecha_registro     DATE          NOT NULL,
  license_plate      VARCHAR(50)   NOT NULL,
  sku                VARCHAR(100)  NOT NULL DEFAULT '',
  defecto            VARCHAR(100)  NOT NULL,
  actividad_realizar TEXT          NOT NULL DEFAULT '', -- calculado automáticamente según defecto
  costo_no_calidad   NUMERIC(10,2) NOT NULL DEFAULT 0, -- COPQ en MXN, calculado según defecto
  origen_hallazgo    VARCHAR(50)   NOT NULL DEFAULT '',
  inspector          VARCHAR(100)  NOT NULL DEFAULT '',
  firma_filename     VARCHAR(255)  NOT NULL DEFAULT '', -- PNG en /public/uploads/rechazos-internos/
  registrado_por     VARCHAR(100),
  created_at         TIMESTAMP     DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ri_images (
  id          SERIAL PRIMARY KEY,
  rechazo_id  INTEGER      NOT NULL REFERENCES rechazos_internos(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL,   -- archivo en /public/uploads/rechazos-internos/
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- ── CAPAS (Corrective & Preventive Actions) ───────────────────
CREATE TABLE IF NOT EXISTS capas (
  id                   SERIAL PRIMARY KEY,
  origen_tipo          VARCHAR(5)   NOT NULL,            -- 'nc' | 're'
  origen_id            INTEGER      NOT NULL,            -- ID de no_conformidades o rechazos_externos
  titulo               TEXT         NOT NULL DEFAULT '',
  descripcion_problema TEXT         NOT NULL DEFAULT '',
  metodo_analisis      VARCHAR(10)  NOT NULL DEFAULT '5porques', -- '5porques' | 'ishikawa'
  responsable          VARCHAR(100) NOT NULL DEFAULT '',
  fecha_apertura       DATE         NOT NULL,
  fecha_compromiso     DATE,
  fecha_cierre         DATE,                             -- se llena al cambiar estatus a 'Cerrada'
  estatus              VARCHAR(20)  NOT NULL DEFAULT 'Abierta', -- 'Abierta' | 'En proceso' | 'Cerrada'
  verificado_por       VARCHAR(100) NOT NULL DEFAULT '',
  observaciones        TEXT         NOT NULL DEFAULT '',
  registrado_por       VARCHAR(100) NOT NULL DEFAULT '',
  created_at           TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capa_5porques (
  id        SERIAL PRIMARY KEY,
  capa_id   INTEGER  NOT NULL,      -- referencia a capas(id), sin FK formal
  orden     SMALLINT NOT NULL,      -- 1 al 5
  respuesta TEXT     NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS capa_ishikawa (
  id        SERIAL PRIMARY KEY,
  capa_id   INTEGER     NOT NULL,   -- referencia a capas(id), sin FK formal
  categoria VARCHAR(50) NOT NULL,   -- 'Hombre' | 'Máquina' | 'Método' | 'Material' | 'Medición' | 'Medio Ambiente'
  causa     TEXT        NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS capa_acciones (
  id               SERIAL PRIMARY KEY,
  capa_id          INTEGER      NOT NULL,   -- referencia a capas(id), sin FK formal
  accion           TEXT         NOT NULL DEFAULT '',
  responsable      VARCHAR(100) NOT NULL DEFAULT '',
  fecha_compromiso DATE,
  estatus          VARCHAR(20)  NOT NULL DEFAULT 'Pendiente', -- 'Pendiente' | 'En progreso' | 'Completada'
  created_at       TIMESTAMP    DEFAULT NOW()
);

-- ── ORGANIGRAMA QC ────────────────────────────────────────────
-- Jerarquía: Ingeniero de Calidad → Supervisor → Técnico/Especialista → Inspector
CREATE TABLE IF NOT EXISTS organigrama_qc (
  id                  SERIAL PRIMARY KEY,
  nombre_completo     VARCHAR(200) NOT NULL,
  no_empleado         VARCHAR(50)  NOT NULL DEFAULT '',
  puesto              VARCHAR(50)  NOT NULL,  -- 'Ingeniero de Calidad' | 'Supervisor de Calidad' | 'Tecnico de Calidad' | 'Especialista de Calidad' | 'Inspector de Calidad'
  area                VARCHAR(100) NOT NULL DEFAULT '', -- 'Incoming' | 'Sorting' | 'FFT' | 'Paletizado' | 'Almacen' | 'Shipping'
  turno               VARCHAR(50)  NOT NULL DEFAULT '', -- 'Turno 1' | 'Turno 2'
  estatus             VARCHAR(20)  NOT NULL DEFAULT 'activo', -- 'activo' | 'inactivo'
  fecha_ingreso       DATE,
  telefono            VARCHAR(20)  NOT NULL DEFAULT '',
  correo              VARCHAR(100) NOT NULL DEFAULT '',
  sexo                VARCHAR(20)  NOT NULL DEFAULT '',
  fecha_nacimiento    DATE,
  contacto_emergencia VARCHAR(200) NOT NULL DEFAULT '',
  tel_emergencia      VARCHAR(20)  NOT NULL DEFAULT '',
  created_at          TIMESTAMP    DEFAULT NOW()
);

-- columna añadida posteriormente:
ALTER TABLE organigrama_qc ADD COLUMN IF NOT EXISTS foto_filename VARCHAR(255) NOT NULL DEFAULT ''; -- en /public/uploads/organigrama/

-- ── CALENDARIO ────────────────────────────────────────────────
-- Gestión de permisos, vacaciones e incidencias del equipo QC
CREATE TABLE IF NOT EXISTS calendario_solicitudes (
  id             SERIAL PRIMARY KEY,
  colaborador_id INTEGER      NOT NULL REFERENCES organigrama_qc(id),
  tipo           VARCHAR(50)  NOT NULL, -- 'Vacaciones' | 'Permiso' | 'Incapacidad' | 'Capacitación'
  fecha_inicio   DATE         NOT NULL,
  fecha_fin      DATE         NOT NULL,
  dias_habiles   INTEGER      NOT NULL DEFAULT 1,
  motivo         TEXT         NOT NULL DEFAULT '',
  estatus        VARCHAR(20)  NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'aprobado' | 'rechazado'
  aprobado_por   VARCHAR(100) NOT NULL DEFAULT '',
  observaciones  TEXT         NOT NULL DEFAULT '',
  registrado_por VARCHAR(100) NOT NULL DEFAULT '',
  created_at     TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendario_festivos (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  fecha      DATE         NOT NULL,
  recurrente BOOLEAN      DEFAULT true, -- true = repite cada año (compara solo mes+día)
  created_at TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendario_saldo (
  id             SERIAL PRIMARY KEY,
  colaborador_id INTEGER   NOT NULL REFERENCES organigrama_qc(id),
  anio           INTEGER   NOT NULL,
  dias_asignados INTEGER   NOT NULL DEFAULT 0,
  created_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(colaborador_id, anio)
);

-- ── AQL ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aql_registros (
  id                       SERIAL PRIMARY KEY,
  fecha_registro           DATE          NOT NULL,
  license_plate            VARCHAR(50)   NOT NULL,
  clasificacion            VARCHAR(10)   NOT NULL DEFAULT '',
  sku                      VARCHAR(100)  NOT NULL DEFAULT '',
  marca                    VARCHAR(100)  NOT NULL DEFAULT '',
  modelo                   VARCHAR(100)  NOT NULL DEFAULT '',
  pulgada                  VARCHAR(20)   NOT NULL DEFAULT '',
  descripcion              TEXT          NOT NULL DEFAULT '',
  accesorios_presentes     VARCHAR(20)   NOT NULL DEFAULT '',
  estado_accesorios        VARCHAR(20)   NOT NULL DEFAULT '',
  accesorios_defectos      TEXT          NOT NULL DEFAULT '',
  estado_bolsa             VARCHAR(20)   NOT NULL DEFAULT '',
  bolsa_defectos           TEXT          NOT NULL DEFAULT '',
  estado_audio             VARCHAR(20)   NOT NULL DEFAULT '',
  audio_defectos           TEXT          NOT NULL DEFAULT '',
  estado_video             VARCHAR(20)   NOT NULL DEFAULT '',
  video_defectos           TEXT          NOT NULL DEFAULT '',
  estado_fisico_pantalla   VARCHAR(20)   NOT NULL DEFAULT '',
  fisico_pantalla_defectos TEXT          NOT NULL DEFAULT '',
  estado_limpieza          VARCHAR(20)   NOT NULL DEFAULT '',
  limpieza_defectos        TEXT          NOT NULL DEFAULT '',
  estado_aql               VARCHAR(20)   NOT NULL DEFAULT '',
  foto_lpn_filename        VARCHAR(255)  NOT NULL DEFAULT '',
  foto_pantalla_filename   VARCHAR(255)  NOT NULL DEFAULT '',
  inspector                VARCHAR(100)  NOT NULL DEFAULT '',
  registrado_por           VARCHAR(100),
  created_at               TIMESTAMP     DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalogo_sku (
  id          SERIAL PRIMARY KEY,
  sku         TEXT NOT NULL UNIQUE,
  marca       TEXT NOT NULL DEFAULT '',
  modelo      TEXT NOT NULL DEFAULT '',
  descripcion TEXT NOT NULL DEFAULT '',
  pulgada     TEXT NOT NULL DEFAULT ''
);

-- ── LIBERACIÓN SHIPPING ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS liberacion_shipping (
  id                      SERIAL PRIMARY KEY,
  fecha                   DATE          NOT NULL,
  numero_orden            VARCHAR(100)  NOT NULL DEFAULT '',
  hora_inicio             TIME          NOT NULL DEFAULT '00:00',
  hora_fin                TIME          NOT NULL DEFAULT '00:00',
  destino                 VARCHAR(50)   NOT NULL DEFAULT '',
  tipo_envio              VARCHAR(20)   NOT NULL DEFAULT '',
  tipo_orden              VARCHAR(50)   NOT NULL DEFAULT '',
  paqueteria              VARCHAR(50)   NOT NULL DEFAULT '',
  numero_contenedor       VARCHAR(100)  NOT NULL DEFAULT '',
  numero_sello            VARCHAR(100)  NOT NULL DEFAULT '',
  cantidad_pallets        INTEGER       NOT NULL DEFAULT 0,
  cantidad_manifiesto     INTEGER       NOT NULL DEFAULT 0,
  cantidad_fisica         INTEGER       NOT NULL DEFAULT 0,
  estado                  VARCHAR(30)   NOT NULL DEFAULT '',
  cantidad_diferencia     INTEGER       NOT NULL DEFAULT 0,
  resultado_inspeccion    VARCHAR(20)   NOT NULL DEFAULT '',
  foto_contenedor_vacio   VARCHAR(255)  NOT NULL DEFAULT '',
  foto_contenedor_cargado VARCHAR(255)  NOT NULL DEFAULT '',
  foto_caja_sellada       VARCHAR(255)  NOT NULL DEFAULT '',
  foto_placas             VARCHAR(255)  NOT NULL DEFAULT '',
  foto_manifiesto         VARCHAR(255)  NOT NULL DEFAULT '',
  inspector               VARCHAR(100)  NOT NULL DEFAULT '',
  estatus_carga           VARCHAR(30)   NOT NULL DEFAULT '',
  comentarios             TEXT          NOT NULL DEFAULT '',
  registrado_por          VARCHAR(100),
  created_at              TIMESTAMP     DEFAULT NOW()
);

-- ── DATOS INICIALES ───────────────────────────────────────────
-- Festivos oficiales México (se insertan por código en initDB() si la tabla está vacía)
-- INSERT INTO calendario_festivos (nombre, fecha, recurrente) VALUES
--   ('Año Nuevo',                  '2026-01-01', true),
--   ('Día de la Constitución',     '2026-02-02', true),
--   ('Natalicio de Benito Juárez', '2026-03-16', true),
--   ('Día del Trabajo',            '2026-05-01', true),
--   ('Independencia de México',    '2026-09-16', true),
--   ('Revolución Mexicana',        '2026-11-16', true),
--   ('Navidad',                    '2026-12-25', true);

-- Usuario administrador inicial (se crea por código en initDB() si tabla está vacía)
-- usuario: admin  /  contraseña: admin123  /  rol: Administrador
