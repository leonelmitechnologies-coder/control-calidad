import { Pool, Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema.js";

// Initialize the database connection pool
// DATABASE_URL takes priority (Coolify/cloud); individual vars as fallback (local dev)
export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "control_calidad",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
    });

// Initialize Drizzle ORM
export const db = drizzle(pool, { schema });

/**
 * Initialize database — creates all tables if they don't exist.
 * Idempotent: safe to run multiple times.
 */
export async function initDB() {
  try {
    console.log("[DB] Initializing database...");

    // Create usuarios table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        usuario VARCHAR(50) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL DEFAULT '',
        rol VARCHAR(20) NOT NULL DEFAULT 'Usuario',
        area VARCHAR(50) DEFAULT '',
        activo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Migrate usuarios → OIDC-based (idempotent)
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS oidc_id TEXT`);
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT`);
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos JSONB NOT NULL DEFAULT '{}'`);
    await pool.query(`ALTER TABLE usuarios ALTER COLUMN password_hash SET DEFAULT ''`);
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE usuarios ADD CONSTRAINT usuarios_oidc_id_key UNIQUE (oidc_id);
      EXCEPTION WHEN duplicate_table THEN NULL;
      END $$
    `);

    // Create no_conformidades table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS no_conformidades (
        id SERIAL PRIMARY KEY,
        hora TIME NOT NULL,
        area VARCHAR(50) NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        descripcion TEXT NOT NULL,
        severidad VARCHAR(10) NOT NULL,
        responsable VARCHAR(100) DEFAULT '—',
        accion TEXT DEFAULT '—',
        registrado_por VARCHAR(100),
        estatus VARCHAR(20) NOT NULL DEFAULT 'Abierta',
        fecha DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create recepciones table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recepciones (
        id SERIAL PRIMARY KEY,
        hora TIME NOT NULL,
        company VARCHAR(100) NOT NULL,
        origen VARCHAR(100) NOT NULL,
        cargo VARCHAR(100) NOT NULL,
        unit_qty INTEGER NOT NULL DEFAULT 0,
        pallet_qty INTEGER NOT NULL DEFAULT 0,
        tipo VARCHAR(20) NOT NULL DEFAULT 'Import',
        estatus VARCHAR(30) NOT NULL DEFAULT 'Confirmado',
        registrado_por VARCHAR(100),
        fecha DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create rechazos_externos table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rechazos_externos (
        id SERIAL PRIMARY KEY,
        return_order VARCHAR(100) NOT NULL,
        license_plate VARCHAR(50) NOT NULL,
        classification VARCHAR(100) NOT NULL DEFAULT '',
        inches VARCHAR(20) NOT NULL DEFAULT '',
        sales_channel VARCHAR(100) NOT NULL DEFAULT '',
        sku VARCHAR(100) NOT NULL DEFAULT '',
        brand VARCHAR(100) NOT NULL DEFAULT '',
        plant_entry TIMESTAMP NOT NULL,
        plant_exit TIMESTAMP,
        total_time_minutes INTEGER,
        outbound_order VARCHAR(100) NOT NULL DEFAULT '',
        processed_by VARCHAR(200) NOT NULL DEFAULT '',
        registration_date DATE,
        sale_price NUMERIC(10,2),
        registrado_por VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create re_problem_descriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS re_problem_descriptions (
        id SERIAL PRIMARY KEY,
        rechazo_id INTEGER NOT NULL,
        orden SMALLINT NOT NULL DEFAULT 1,
        descripcion TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create re_images table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS re_images (
        id SERIAL PRIMARY KEY,
        rechazo_id INTEGER NOT NULL,
        filename VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create re_corrective_actions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS re_corrective_actions (
        id SERIAL PRIMARY KEY,
        rechazo_id INTEGER NOT NULL,
        departamento VARCHAR(50) NOT NULL,
        orden SMALLINT NOT NULL DEFAULT 1,
        accion TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create rechazos_internos table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rechazos_internos (
        id SERIAL PRIMARY KEY,
        fecha_registro DATE NOT NULL,
        license_plate VARCHAR(50) NOT NULL,
        sku VARCHAR(100) NOT NULL DEFAULT '',
        defecto VARCHAR(100) NOT NULL,
        actividad_realizar TEXT NOT NULL DEFAULT '',
        costo_no_calidad NUMERIC(10,2) NOT NULL DEFAULT 0,
        origen_hallazgo VARCHAR(50) NOT NULL DEFAULT '',
        inspector VARCHAR(100) NOT NULL DEFAULT '',
        firma_filename VARCHAR(255) NOT NULL DEFAULT '',
        marca VARCHAR(100) NOT NULL DEFAULT '',
        modelo VARCHAR(100) NOT NULL DEFAULT '',
        pulgada VARCHAR(20) NOT NULL DEFAULT '',
        descripcion TEXT NOT NULL DEFAULT '',
        registrado_por VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create ri_images table with FK cascade
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ri_images (
        id SERIAL PRIMARY KEY,
        rechazo_id INTEGER NOT NULL REFERENCES rechazos_internos(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE ri_images ADD COLUMN IF NOT EXISTS url VARCHAR(500)`);
    await pool.query(`ALTER TABLE ri_images ADD COLUMN IF NOT EXISTS data_b64 TEXT`);
    await pool.query(`ALTER TABLE re_images ADD COLUMN IF NOT EXISTS url VARCHAR(500)`);
    await pool.query(`ALTER TABLE re_images ADD COLUMN IF NOT EXISTS data_b64 TEXT`);
    await pool.query(`ALTER TABLE rechazos_internos ADD COLUMN IF NOT EXISTS firma_url VARCHAR(500)`);
    await pool.query(`ALTER TABLE rechazos_internos ADD COLUMN IF NOT EXISTS firma_data_b64 TEXT`);
    await pool.query(`ALTER TABLE aql_registros ADD COLUMN IF NOT EXISTS foto_lpn_url VARCHAR(500)`);
    await pool.query(`ALTER TABLE aql_registros ADD COLUMN IF NOT EXISTS foto_lpn_data_b64 TEXT`);
    await pool.query(`ALTER TABLE aql_registros ADD COLUMN IF NOT EXISTS foto_pantalla_url VARCHAR(500)`);
    await pool.query(`ALTER TABLE aql_registros ADD COLUMN IF NOT EXISTS foto_pantalla_data_b64 TEXT`);

    // Create catalogo_sku table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalogo_sku (
        id SERIAL PRIMARY KEY,
        sku TEXT NOT NULL UNIQUE,
        marca TEXT NOT NULL DEFAULT '',
        modelo TEXT NOT NULL DEFAULT '',
        descripcion TEXT NOT NULL DEFAULT '',
        pulgada TEXT NOT NULL DEFAULT ''
      )
    `);

    // Create aql_registros table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aql_registros (
        id SERIAL PRIMARY KEY,
        fecha_registro DATE NOT NULL,
        license_plate VARCHAR(50) NOT NULL,
        clasificacion VARCHAR(10) NOT NULL DEFAULT '',
        sku VARCHAR(100) NOT NULL DEFAULT '',
        marca VARCHAR(100) NOT NULL DEFAULT '',
        modelo VARCHAR(100) NOT NULL DEFAULT '',
        pulgada VARCHAR(20) NOT NULL DEFAULT '',
        descripcion TEXT NOT NULL DEFAULT '',
        accesorios_presentes VARCHAR(20) NOT NULL DEFAULT '',
        estado_accesorios VARCHAR(20) NOT NULL DEFAULT '',
        accesorios_defectos TEXT NOT NULL DEFAULT '',
        estado_bolsa VARCHAR(20) NOT NULL DEFAULT '',
        bolsa_defectos TEXT NOT NULL DEFAULT '',
        estado_audio VARCHAR(20) NOT NULL DEFAULT '',
        audio_defectos TEXT NOT NULL DEFAULT '',
        estado_video VARCHAR(20) NOT NULL DEFAULT '',
        video_defectos TEXT NOT NULL DEFAULT '',
        estado_fisico_pantalla VARCHAR(20) NOT NULL DEFAULT '',
        fisico_pantalla_defectos TEXT NOT NULL DEFAULT '',
        estado_limpieza VARCHAR(20) NOT NULL DEFAULT '',
        limpieza_defectos TEXT NOT NULL DEFAULT '',
        estado_aql VARCHAR(20) NOT NULL DEFAULT '',
        foto_lpn_filename VARCHAR(255) NOT NULL DEFAULT '',
        foto_pantalla_filename VARCHAR(255) NOT NULL DEFAULT '',
        inspector VARCHAR(100) NOT NULL DEFAULT '',
        registrado_por VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create capas table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capas (
        id SERIAL PRIMARY KEY,
        origen_tipo VARCHAR(5) NOT NULL,
        origen_id INTEGER NOT NULL,
        titulo TEXT NOT NULL DEFAULT '',
        descripcion_problema TEXT NOT NULL DEFAULT '',
        metodo_analisis VARCHAR(10) NOT NULL DEFAULT '5porques',
        responsable VARCHAR(100) NOT NULL DEFAULT '',
        fecha_apertura DATE NOT NULL,
        fecha_compromiso DATE,
        fecha_cierre DATE,
        estatus VARCHAR(20) NOT NULL DEFAULT 'Abierta',
        verificado_por VARCHAR(100) NOT NULL DEFAULT '',
        observaciones TEXT NOT NULL DEFAULT '',
        registrado_por VARCHAR(100) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create capa_5porques table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capa_5porques (
        id SERIAL PRIMARY KEY,
        capa_id INTEGER NOT NULL,
        orden SMALLINT NOT NULL,
        respuesta TEXT NOT NULL DEFAULT ''
      )
    `);

    // Create capa_ishikawa table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capa_ishikawa (
        id SERIAL PRIMARY KEY,
        capa_id INTEGER NOT NULL,
        categoria VARCHAR(50) NOT NULL,
        causa TEXT NOT NULL DEFAULT ''
      )
    `);

    // Create capa_acciones table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS capa_acciones (
        id SERIAL PRIMARY KEY,
        capa_id INTEGER NOT NULL,
        accion TEXT NOT NULL DEFAULT '',
        responsable VARCHAR(100) NOT NULL DEFAULT '',
        fecha_compromiso DATE,
        estatus VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create organigrama_qc table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organigrama_qc (
        id SERIAL PRIMARY KEY,
        nombre_completo VARCHAR(200) NOT NULL,
        no_empleado VARCHAR(50) NOT NULL DEFAULT '',
        puesto VARCHAR(50) NOT NULL,
        area VARCHAR(100) NOT NULL DEFAULT '',
        turno VARCHAR(50) NOT NULL DEFAULT '',
        estatus VARCHAR(20) NOT NULL DEFAULT 'activo',
        fecha_ingreso DATE,
        telefono VARCHAR(20) NOT NULL DEFAULT '',
        correo VARCHAR(100) NOT NULL DEFAULT '',
        sexo VARCHAR(20) NOT NULL DEFAULT '',
        fecha_nacimiento DATE,
        contacto_emergencia VARCHAR(200) NOT NULL DEFAULT '',
        tel_emergencia VARCHAR(20) NOT NULL DEFAULT '',
        foto_filename VARCHAR(255) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create calendario_solicitudes table with FK cascade
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendario_solicitudes (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL REFERENCES organigrama_qc(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL,
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE NOT NULL,
        dias_habiles INTEGER NOT NULL DEFAULT 1,
        motivo TEXT NOT NULL DEFAULT '',
        estatus VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        aprobado_por VARCHAR(100) NOT NULL DEFAULT '',
        observaciones TEXT NOT NULL DEFAULT '',
        registrado_por VARCHAR(100) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create calendario_festivos table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendario_festivos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        fecha DATE NOT NULL,
        recurrente BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create calendario_saldo table with FK cascade and unique constraint
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendario_saldo (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL REFERENCES organigrama_qc(id) ON DELETE CASCADE,
        anio INTEGER NOT NULL,
        dias_asignados INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(colaborador_id, anio)
      )
    `);

    // Create liberacion_shipping table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS liberacion_shipping (
        id SERIAL PRIMARY KEY,
        fecha DATE NOT NULL,
        numero_orden VARCHAR(100) NOT NULL DEFAULT '',
        hora_inicio TIME NOT NULL DEFAULT '00:00',
        hora_fin TIME NOT NULL DEFAULT '00:00',
        destino VARCHAR(50) NOT NULL DEFAULT '',
        tipo_envio VARCHAR(20) NOT NULL DEFAULT '',
        tipo_orden VARCHAR(50) NOT NULL DEFAULT '',
        paqueteria VARCHAR(50) NOT NULL DEFAULT '',
        numero_contenedor VARCHAR(100) NOT NULL DEFAULT '',
        numero_sello VARCHAR(100) NOT NULL DEFAULT '',
        cantidad_pallets INTEGER NOT NULL DEFAULT 0,
        cantidad_manifiesto INTEGER NOT NULL DEFAULT 0,
        cantidad_fisica INTEGER NOT NULL DEFAULT 0,
        estado VARCHAR(30) NOT NULL DEFAULT '',
        cantidad_diferencia INTEGER NOT NULL DEFAULT 0,
        resultado_inspeccion VARCHAR(20) NOT NULL DEFAULT '',
        foto_contenedor_vacio VARCHAR(255) NOT NULL DEFAULT '',
        foto_contenedor_cargado VARCHAR(255) NOT NULL DEFAULT '',
        foto_caja_sellada VARCHAR(255) NOT NULL DEFAULT '',
        foto_placas VARCHAR(255) NOT NULL DEFAULT '',
        foto_manifiesto VARCHAR(255) NOT NULL DEFAULT '',
        inspector VARCHAR(100) NOT NULL DEFAULT '',
        estatus_carga VARCHAR(30) NOT NULL DEFAULT '',
        comentarios TEXT NOT NULL DEFAULT '',
        registrado_por VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Seed calendar_festivos if empty (Mexican holidays)
    const festivos = await pool.query("SELECT COUNT(*) FROM calendario_festivos");
    if (festivos.rows[0].count === "0") {
      const mexicanHolidays = [
        ["Año Nuevo", "2024-01-01", true],
        ["Día de Reyes", "2024-01-06", true],
        ["Natalicio de Benito Juárez", "2024-03-21", true],
        ["Viernes Santo", "2024-03-29", false],
        ["Día del Trabajo", "2024-05-01", true],
        ["Grito de Independencia", "2024-09-16", true],
        ["Día de Muertos", "2024-11-02", true],
        ["Revolución Mexicana", "2024-11-20", true],
        ["Navidad", "2024-12-25", true],
      ];

      for (const [nombre, fecha, recurrente] of mexicanHolidays) {
        await pool.query(
          "INSERT INTO calendario_festivos (nombre, fecha, recurrente) VALUES ($1, $2, $3)",
          [nombre, fecha, recurrente]
        );
      }
      console.log("[DB] Seeded calendar_festivos");
    }

    console.log("[DB] Database initialization complete");
  } catch (err) {
    console.error("[DB] Error initializing database:", err);
    throw err;
  }
}

/**
 * Begin a database transaction.
 */
export async function beginTransaction(client: any) {
  await client.query("BEGIN");
}

/**
 * Commit a database transaction.
 */
export async function commitTransaction(client: any) {
  await client.query("COMMIT");
}

/**
 * Rollback a database transaction.
 */
export async function rollbackTransaction(client: any) {
  await client.query("ROLLBACK");
}

/**
 * Get a client from the pool for transaction management.
 */
export async function getClient() {
  return await pool.connect();
}

export default db;
