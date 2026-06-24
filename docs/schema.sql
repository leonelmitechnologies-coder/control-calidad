-- ============================================================
-- Control de Calidad — Esquema de base de datos
-- Base de datos: control_calidad (PostgreSQL)
-- ============================================================

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

CREATE TABLE IF NOT EXISTS recepciones (
  id             SERIAL PRIMARY KEY,
  hora           TIME         NOT NULL,
  company        VARCHAR(100) NOT NULL,
  origen         VARCHAR(100) NOT NULL,
  cargo          VARCHAR(100) NOT NULL,
  unit_qty       INTEGER      NOT NULL DEFAULT 0,
  pallet_qty     INTEGER      NOT NULL DEFAULT 0,
  tipo           VARCHAR(20)  NOT NULL DEFAULT 'Import',   -- 'Import' | 'Export'
  estatus        VARCHAR(30)  NOT NULL DEFAULT 'Confirmado', -- 'Confirmado' | 'En descarga' | 'Descargado' | 'Rechazado'
  registrado_por VARCHAR(100),
  fecha          DATE         NOT NULL,
  created_at     TIMESTAMP    DEFAULT NOW()
);
