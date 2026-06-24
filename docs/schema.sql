-- ============================================================
-- Control de Calidad — Esquema de base de datos
-- Base de datos: control_calidad (PostgreSQL)
-- Última actualización: 2026-06-24
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
  tipo           VARCHAR(100) NOT NULL,
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
  tipo           VARCHAR(20)  NOT NULL DEFAULT 'Import',     -- 'Import' | 'Export'
  estatus        VARCHAR(30)  NOT NULL DEFAULT 'Confirmado', -- 'Confirmado' | 'En descarga' | 'Descargado' | 'Rechazado'
  registrado_por VARCHAR(100),
  fecha          DATE         NOT NULL,
  created_at     TIMESTAMP    DEFAULT NOW()
  -- Nota: columna 'trailer' eliminada con ALTER TABLE DROP COLUMN
);

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
  created_at          TIMESTAMP    DEFAULT NOW(),
  registration_date   DATE,                                -- añadido vía ALTER TABLE
  sale_price          NUMERIC(10,2)                        -- añadido vía ALTER TABLE; KPI principal
);

CREATE TABLE IF NOT EXISTS re_problem_descriptions (
  id          SERIAL PRIMARY KEY,
  rechazo_id  INTEGER   NOT NULL REFERENCES rechazos_externos(id) ON DELETE CASCADE,
  orden       SMALLINT  NOT NULL DEFAULT 1,
  descripcion TEXT      NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS re_images (
  id          SERIAL PRIMARY KEY,
  rechazo_id  INTEGER      NOT NULL REFERENCES rechazos_externos(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS re_corrective_actions (
  id           SERIAL PRIMARY KEY,
  rechazo_id   INTEGER     NOT NULL REFERENCES rechazos_externos(id) ON DELETE CASCADE,
  departamento VARCHAR(50) NOT NULL,
  orden        SMALLINT    NOT NULL DEFAULT 1,
  accion       TEXT        NOT NULL,
  created_at   TIMESTAMP   DEFAULT NOW()
);

-- ── ORGANIGRAMA QC ────────────────────────────────────────────
-- Jerarquía: Ingeniero de Calidad → Supervisor → Técnico/Especialista → Inspector
CREATE TABLE IF NOT EXISTS organigrama_qc (
  id                  SERIAL PRIMARY KEY,
  nombre_completo     VARCHAR(200) NOT NULL,
  no_empleado         VARCHAR(50)  NOT NULL DEFAULT '',
  puesto              VARCHAR(50)  NOT NULL, -- 'Ingeniero de Calidad' | 'Supervisor de Calidad' | 'Tecnico de Calidad' | 'Especialista de Calidad' | 'Inspector de Calidad'
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
  foto_filename       VARCHAR(255) NOT NULL DEFAULT '', -- añadido vía ALTER TABLE; ruta relativa a /uploads/organigrama/
  created_at          TIMESTAMP    DEFAULT NOW()
);

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
  recurrente BOOLEAN      DEFAULT true, -- true = repite cada año (solo compara mes+día)
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

-- ── DATOS INICIALES ───────────────────────────────────────────
-- Festivos oficiales México (precargados si la tabla está vacía al iniciar)
-- INSERT INTO calendario_festivos (nombre, fecha, recurrente) VALUES
--   ('Año Nuevo',                  '2026-01-01', true),
--   ('Día de la Constitución',     '2026-02-02', true),
--   ('Natalicio de Benito Juárez', '2026-03-16', true),
--   ('Día del Trabajo',            '2026-05-01', true),
--   ('Independencia de México',    '2026-09-16', true),
--   ('Revolución Mexicana',        '2026-11-16', true),
--   ('Navidad',                    '2026-12-25', true);

-- Usuario administrador inicial (creado por initDB() si tabla vacía)
-- usuario: admin  /  contraseña: admin123
