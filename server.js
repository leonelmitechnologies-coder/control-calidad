require('dotenv').config();

const express  = require('express');
const { Pool } = require('pg');
const session  = require('express-session');
const bcrypt   = require('bcrypt');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Base de datos ──────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ── Middleware ─────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 },
}));

// ── Uploads ────────────────────────────────────────────────────
const uploadsDir    = path.join(__dirname, 'public', 'uploads', 'rechazos');
const uploadsOrgDir = path.join(__dirname, 'public', 'uploads', 'organigrama');
if (!fs.existsSync(uploadsDir))    fs.mkdirSync(uploadsDir,    { recursive: true });
if (!fs.existsSync(uploadsOrgDir)) fs.mkdirSync(uploadsOrgDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadOrg = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsOrgDir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `org-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadsIntDir = path.join(__dirname, 'public', 'uploads', 'rechazos-internos');
if (!fs.existsSync(uploadsIntDir)) fs.mkdirSync(uploadsIntDir, { recursive: true });

const uploadInt = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadsIntDir),
    filename:    (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadsAqlDir = path.join(__dirname, 'public', 'uploads', 'aql');
if (!fs.existsSync(uploadsAqlDir)) fs.mkdirSync(uploadsAqlDir, { recursive: true });

const uploadAql = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadsAqlDir),
    filename:    (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function auth(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ error: 'No autorizado' });
  next();
}

function admin(req, res, next) {
  if (req.session.usuario?.rol !== 'Administrador')
    return res.status(403).json({ error: 'Sin permisos de administrador' });
  next();
}

// ── Inicializar BD ─────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id            SERIAL PRIMARY KEY,
      nombre        VARCHAR(100) NOT NULL,
      usuario       VARCHAR(50)  NOT NULL UNIQUE,
      password_hash TEXT         NOT NULL,
      rol           VARCHAR(20)  NOT NULL DEFAULT 'Usuario',
      area          VARCHAR(50)  DEFAULT '',
      activo        BOOLEAN      NOT NULL DEFAULT true,
      created_at    TIMESTAMP    DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS no_conformidades (
      id             SERIAL PRIMARY KEY,
      hora           TIME        NOT NULL,
      area           VARCHAR(50) NOT NULL,
      tipo           VARCHAR(100) NOT NULL,
      descripcion    TEXT        NOT NULL,
      severidad      VARCHAR(10) NOT NULL,
      responsable    VARCHAR(100) DEFAULT '—',
      accion         TEXT        DEFAULT '—',
      registrado_por VARCHAR(100),
      estatus        VARCHAR(20) NOT NULL DEFAULT 'Abierta',
      fecha          DATE        NOT NULL,
      created_at     TIMESTAMP   DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS recepciones (
      id             SERIAL PRIMARY KEY,
      hora           TIME         NOT NULL,
      company        VARCHAR(100) NOT NULL,
      origen         VARCHAR(100) NOT NULL,
      cargo          VARCHAR(100) NOT NULL,
      unit_qty       INTEGER      NOT NULL DEFAULT 0,
      pallet_qty     INTEGER      NOT NULL DEFAULT 0,
      tipo           VARCHAR(20)  NOT NULL DEFAULT 'Import',
      estatus        VARCHAR(30)  NOT NULL DEFAULT 'Confirmado',
      registrado_por VARCHAR(100),
      fecha          DATE         NOT NULL,
      created_at     TIMESTAMP    DEFAULT NOW()
    )
  `);

  await pool.query('ALTER TABLE recepciones DROP COLUMN IF EXISTS trailer');

  await pool.query(`
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
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS re_problem_descriptions (
      id          SERIAL PRIMARY KEY,
      rechazo_id  INTEGER  NOT NULL,
      orden       SMALLINT NOT NULL DEFAULT 1,
      descripcion TEXT     NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query('ALTER TABLE rechazos_externos ADD COLUMN IF NOT EXISTS registration_date DATE');
  await pool.query('ALTER TABLE rechazos_externos ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS re_images (
      id          SERIAL PRIMARY KEY,
      rechazo_id  INTEGER      NOT NULL,
      filename    VARCHAR(255) NOT NULL,
      created_at  TIMESTAMP    DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS re_corrective_actions (
      id           SERIAL PRIMARY KEY,
      rechazo_id   INTEGER     NOT NULL,
      departamento VARCHAR(50) NOT NULL,
      orden        SMALLINT    NOT NULL DEFAULT 1,
      accion       TEXT        NOT NULL,
      created_at   TIMESTAMP   DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organigrama_qc (
      id                  SERIAL PRIMARY KEY,
      nombre_completo     VARCHAR(200) NOT NULL,
      no_empleado         VARCHAR(50)  NOT NULL DEFAULT '',
      puesto              VARCHAR(50)  NOT NULL,
      area                VARCHAR(100) NOT NULL DEFAULT '',
      turno               VARCHAR(50)  NOT NULL DEFAULT '',
      estatus             VARCHAR(20)  NOT NULL DEFAULT 'activo',
      fecha_ingreso       DATE,
      telefono            VARCHAR(20)  NOT NULL DEFAULT '',
      correo              VARCHAR(100) NOT NULL DEFAULT '',
      sexo                VARCHAR(20)  NOT NULL DEFAULT '',
      fecha_nacimiento    DATE,
      contacto_emergencia VARCHAR(200) NOT NULL DEFAULT '',
      tel_emergencia      VARCHAR(20)  NOT NULL DEFAULT '',
      created_at          TIMESTAMP    DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE organigrama_qc ADD COLUMN IF NOT EXISTS foto_filename VARCHAR(255) NOT NULL DEFAULT ''`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendario_solicitudes (
      id             SERIAL PRIMARY KEY,
      colaborador_id INTEGER      NOT NULL,
      tipo           VARCHAR(50)  NOT NULL,
      fecha_inicio   DATE         NOT NULL,
      fecha_fin      DATE         NOT NULL,
      dias_habiles   INTEGER      NOT NULL DEFAULT 1,
      motivo         TEXT         NOT NULL DEFAULT '',
      estatus        VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
      aprobado_por   VARCHAR(100) NOT NULL DEFAULT '',
      observaciones  TEXT         NOT NULL DEFAULT '',
      registrado_por VARCHAR(100) NOT NULL DEFAULT '',
      created_at     TIMESTAMP    DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendario_festivos (
      id         SERIAL PRIMARY KEY,
      nombre     VARCHAR(100) NOT NULL,
      fecha      DATE         NOT NULL,
      recurrente BOOLEAN      DEFAULT true,
      created_at TIMESTAMP    DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendario_saldo (
      id             SERIAL PRIMARY KEY,
      colaborador_id INTEGER NOT NULL,
      anio           INTEGER NOT NULL,
      dias_asignados INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMP DEFAULT NOW(),
      UNIQUE(colaborador_id, anio)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS capas (
      id                   SERIAL PRIMARY KEY,
      origen_tipo          VARCHAR(5)   NOT NULL,
      origen_id            INTEGER      NOT NULL,
      titulo               TEXT         NOT NULL DEFAULT '',
      descripcion_problema TEXT         NOT NULL DEFAULT '',
      metodo_analisis      VARCHAR(10)  NOT NULL DEFAULT '5porques',
      responsable          VARCHAR(100) NOT NULL DEFAULT '',
      fecha_apertura       DATE         NOT NULL,
      fecha_compromiso     DATE,
      fecha_cierre         DATE,
      estatus              VARCHAR(20)  NOT NULL DEFAULT 'Abierta',
      verificado_por       VARCHAR(100) NOT NULL DEFAULT '',
      observaciones        TEXT         NOT NULL DEFAULT '',
      registrado_por       VARCHAR(100) NOT NULL DEFAULT '',
      created_at           TIMESTAMP    DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS capa_5porques (
      id        SERIAL PRIMARY KEY,
      capa_id   INTEGER  NOT NULL,
      orden     SMALLINT NOT NULL,
      respuesta TEXT     NOT NULL DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS capa_ishikawa (
      id        SERIAL PRIMARY KEY,
      capa_id   INTEGER     NOT NULL,
      categoria VARCHAR(50) NOT NULL,
      causa     TEXT        NOT NULL DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS capa_acciones (
      id               SERIAL PRIMARY KEY,
      capa_id          INTEGER      NOT NULL,
      accion           TEXT         NOT NULL DEFAULT '',
      responsable      VARCHAR(100) NOT NULL DEFAULT '',
      fecha_compromiso DATE,
      estatus          VARCHAR(20)  NOT NULL DEFAULT 'Pendiente',
      created_at       TIMESTAMP    DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rechazos_internos (
      id                SERIAL PRIMARY KEY,
      fecha_registro    DATE          NOT NULL,
      license_plate     VARCHAR(50)   NOT NULL,
      sku               VARCHAR(100)  NOT NULL DEFAULT '',
      defecto           VARCHAR(100)  NOT NULL,
      actividad_realizar TEXT         NOT NULL DEFAULT '',
      costo_no_calidad  NUMERIC(10,2) NOT NULL DEFAULT 0,
      origen_hallazgo   VARCHAR(50)   NOT NULL DEFAULT '',
      inspector         VARCHAR(100)  NOT NULL DEFAULT '',
      firma_filename    VARCHAR(255)  NOT NULL DEFAULT '',
      registrado_por    VARCHAR(100),
      created_at        TIMESTAMP     DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ri_images (
      id          SERIAL PRIMARY KEY,
      rechazo_id  INTEGER      NOT NULL REFERENCES rechazos_internos(id) ON DELETE CASCADE,
      filename    VARCHAR(255) NOT NULL,
      created_at  TIMESTAMP    DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aql_registros (
      id                       SERIAL PRIMARY KEY,
      fecha_registro           DATE          NOT NULL,
      license_plate            VARCHAR(50)   NOT NULL,
      clasificacion            VARCHAR(10)   NOT NULL DEFAULT '',
      sku                      VARCHAR(100)  NOT NULL DEFAULT '',
      marca                    VARCHAR(100)  NOT NULL DEFAULT '',
      modelo                   VARCHAR(100)  NOT NULL DEFAULT '',
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
    )
  `);

  // Festivos oficiales México (solo si la tabla está vacía)
  const { rows: fRows } = await pool.query('SELECT COUNT(*) FROM calendario_festivos');
  if (parseInt(fRows[0].count) === 0) {
    const festivos = [
      ['Año Nuevo',                  '2026-01-01'],
      ['Día de la Constitución',     '2026-02-02'],
      ['Natalicio de Benito Juárez', '2026-03-16'],
      ['Día del Trabajo',            '2026-05-01'],
      ['Independencia de México',    '2026-09-16'],
      ['Revolución Mexicana',        '2026-11-16'],
      ['Navidad',                    '2026-12-25'],
    ];
    for (const [nombre, fecha] of festivos) {
      await pool.query('INSERT INTO calendario_festivos (nombre, fecha, recurrente) VALUES ($1,$2,true)', [nombre, fecha]);
    }
    console.log('Festivos oficiales precargados.');
  }

  const { rows } = await pool.query('SELECT COUNT(*) FROM usuarios');
  if (parseInt(rows[0].count) === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO usuarios (nombre, usuario, password_hash, rol, area, activo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['Administrador', 'admin', hash, 'Administrador', '', true]
    );
    console.log('Usuario inicial creado → admin / admin123');
  }
}

// ── AUTH ───────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { usuario, password } = req.body;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE usuario = $1 AND activo = true',
      [usuario]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    const u  = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    const sesion = { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol };
    req.session.usuario = sesion;
    res.json(sesion);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ error: 'No autenticado' });
  res.json(req.session.usuario);
});

// ── NO CONFORMIDADES ───────────────────────────────────────────
app.get('/api/nc', auth, async (req, res) => {
  const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
  try {
    let rows;
    if (fecha === 'todos') {
      ({ rows } = await pool.query(
        `SELECT nc.*,
           (SELECT COUNT(*) FROM capas WHERE origen_tipo='nc' AND origen_id=nc.id) AS cnt_capas
         FROM no_conformidades nc ORDER BY fecha DESC, hora DESC`
      ));
    } else {
      ({ rows } = await pool.query(
        `SELECT nc.*,
           (SELECT COUNT(*) FROM capas WHERE origen_tipo='nc' AND origen_id=nc.id) AS cnt_capas
         FROM no_conformidades nc WHERE fecha = $1 ORDER BY hora`,
        [fecha]
      ));
    }
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/nc', auth, async (req, res) => {
  const { hora, area, tipo, descripcion, severidad, responsable, accion } = req.body;
  const fecha         = new Date().toISOString().slice(0, 10);
  const registrado_por = req.session.usuario.nombre;
  try {
    const { rows } = await pool.query(
      `INSERT INTO no_conformidades
         (hora, area, tipo, descripcion, severidad, responsable, accion, registrado_por, estatus, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Abierta',$9)
       RETURNING *`,
      [hora, area, tipo, descripcion, severidad,
       responsable || '—', accion || '—', registrado_por, fecha]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/nc/:id/estatus', auth, async (req, res) => {
  const { estatus } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE no_conformidades SET estatus=$1 WHERE id=$2 RETURNING *',
      [estatus, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/nc/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM no_conformidades WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RECEPCIONES ────────────────────────────────────────────────
app.get('/api/recepciones', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM recepciones ORDER BY fecha DESC, hora, id'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/recepciones', auth, async (req, res) => {
  const { hora, company, origen, cargo, unit_qty, pallet_qty, tipo, fecha: fechaBody } = req.body;
  const fecha          = fechaBody || new Date().toISOString().slice(0, 10);
  const registrado_por = req.session.usuario.nombre;
  try {
    const { rows } = await pool.query(
      `INSERT INTO recepciones
         (hora, company, origen, cargo, unit_qty, pallet_qty, tipo, estatus, registrado_por, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Confirmado',$8,$9)
       RETURNING *`,
      [hora, company, origen, cargo, unit_qty || 0, pallet_qty || 0, tipo || 'Import', registrado_por, fecha]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/recepciones/:id/estatus', auth, async (req, res) => {
  const { estatus } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE recepciones SET estatus=$1 WHERE id=$2 RETURNING *',
      [estatus, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/recepciones/:id', auth, async (req, res) => {
  const { hora, company, origen, cargo, unit_qty, pallet_qty, tipo, estatus } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE recepciones SET hora=$1, company=$2, origen=$3, cargo=$4,
       unit_qty=$5, pallet_qty=$6, tipo=$7, estatus=$8 WHERE id=$9 RETURNING *`,
      [hora, company, origen, cargo, unit_qty || 0, pallet_qty || 0, tipo, estatus, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/recepciones/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM recepciones WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RECHAZOS EXTERNOS ─────────────────────────────────────────
app.get('/api/rechazos-externos', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT re.*,
        (SELECT COUNT(*) FROM re_problem_descriptions WHERE rechazo_id = re.id) AS cnt_problemas,
        (SELECT COUNT(*) FROM re_corrective_actions   WHERE rechazo_id = re.id) AS cnt_acciones,
        (SELECT COUNT(*) FROM capas WHERE origen_tipo='re' AND origen_id=re.id) AS cnt_capas
      FROM rechazos_externos re
      ORDER BY re.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rechazos-externos/:id', auth, async (req, res) => {
  try {
    const { rows: [re] } = await pool.query('SELECT * FROM rechazos_externos WHERE id=$1', [req.params.id]);
    if (!re) return res.status(404).json({ error: 'Registro no encontrado' });
    const { rows: probs } = await pool.query(
      'SELECT * FROM re_problem_descriptions WHERE rechazo_id=$1 ORDER BY orden',
      [req.params.id]
    );
    const { rows: accs } = await pool.query(
      'SELECT * FROM re_corrective_actions WHERE rechazo_id=$1 ORDER BY departamento, orden',
      [req.params.id]
    );
    const { rows: imgs } = await pool.query(
      'SELECT * FROM re_images WHERE rechazo_id=$1 ORDER BY id',
      [req.params.id]
    );
    res.json({ ...re, problem_descriptions: probs, corrective_actions: accs, images: imgs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rechazos-externos', auth, async (req, res) => {
  const {
    return_order, license_plate, classification, inches, sales_channel,
    sku, brand, plant_entry, plant_exit, total_time_minutes, outbound_order,
    processed_by, registration_date, sale_price,
    problem_descriptions = [], corrective_actions = []
  } = req.body;
  const registrado_por = req.session.usuario.nombre;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO rechazos_externos
         (return_order, license_plate, classification, inches, sales_channel,
          sku, brand, plant_entry, plant_exit, total_time_minutes,
          outbound_order, processed_by, registration_date, sale_price, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [return_order, license_plate, classification || '', inches || '', sales_channel || '',
       sku || '', brand || '', plant_entry, plant_exit || null, total_time_minutes || null,
       outbound_order || '', processed_by || '', registration_date || null,
       sale_price || null, registrado_por]
    );
    const id = rows[0].id;
    for (const p of problem_descriptions) {
      await client.query(
        'INSERT INTO re_problem_descriptions (rechazo_id, orden, descripcion) VALUES ($1,$2,$3)',
        [id, p.orden, p.descripcion]
      );
    }
    for (const a of corrective_actions) {
      await client.query(
        'INSERT INTO re_corrective_actions (rechazo_id, departamento, orden, accion) VALUES ($1,$2,$3,$4)',
        [id, a.departamento, a.orden, a.accion]
      );
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

app.put('/api/rechazos-externos/:id', auth, async (req, res) => {
  const {
    return_order, license_plate, classification, inches, sales_channel,
    sku, brand, plant_entry, plant_exit, total_time_minutes, outbound_order,
    processed_by, registration_date, sale_price,
    problem_descriptions = [], corrective_actions = []
  } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE rechazos_externos SET
         return_order=$1, license_plate=$2, classification=$3, inches=$4, sales_channel=$5,
         sku=$6, brand=$7, plant_entry=$8, plant_exit=$9, total_time_minutes=$10,
         outbound_order=$11, processed_by=$12, registration_date=$13, sale_price=$14
       WHERE id=$15 RETURNING *`,
      [return_order, license_plate, classification || '', inches || '', sales_channel || '',
       sku || '', brand || '', plant_entry, plant_exit || null, total_time_minutes || null,
       outbound_order || '', processed_by || '', registration_date || null,
       sale_price || null, req.params.id]
    );
    await client.query('DELETE FROM re_problem_descriptions WHERE rechazo_id=$1', [req.params.id]);
    await client.query('DELETE FROM re_corrective_actions WHERE rechazo_id=$1', [req.params.id]);
    for (const p of problem_descriptions) {
      await client.query(
        'INSERT INTO re_problem_descriptions (rechazo_id, orden, descripcion) VALUES ($1,$2,$3)',
        [req.params.id, p.orden, p.descripcion]
      );
    }
    for (const a of corrective_actions) {
      await client.query(
        'INSERT INTO re_corrective_actions (rechazo_id, departamento, orden, accion) VALUES ($1,$2,$3,$4)',
        [req.params.id, a.departamento, a.orden, a.accion]
      );
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

app.post('/api/rechazos-externos/:id/images', auth, upload.array('images', 10), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No se enviaron imagenes.' });
  try {
    const saved = [];
    for (const file of req.files) {
      const { rows } = await pool.query(
        'INSERT INTO re_images (rechazo_id, filename) VALUES ($1,$2) RETURNING *',
        [req.params.id, file.filename]
      );
      saved.push(rows[0]);
    }
    res.json(saved);
  } catch (e) {
    req.files.forEach(f => fs.unlink(f.path, () => {}));
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/rechazos-externos/:id/images/:imageId', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM re_images WHERE id=$1 AND rechazo_id=$2 RETURNING filename',
      [req.params.imageId, req.params.id]
    );
    if (rows.length) fs.unlink(path.join(uploadsDir, rows[0].filename), () => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/rechazos-externos/:id', auth, async (req, res) => {
  try {
    const { rows: imgs } = await pool.query('SELECT filename FROM re_images WHERE rechazo_id=$1', [req.params.id]);
    imgs.forEach(img => fs.unlink(path.join(uploadsDir, img.filename), () => {}));
    await pool.query('DELETE FROM re_images WHERE rechazo_id=$1', [req.params.id]);
    await pool.query('DELETE FROM re_problem_descriptions WHERE rechazo_id=$1', [req.params.id]);
    await pool.query('DELETE FROM re_corrective_actions WHERE rechazo_id=$1', [req.params.id]);
    await pool.query('DELETE FROM rechazos_externos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rechazos-externos/:id/pdf', auth, async (req, res) => {
  let browser;
  try {
    const { rows: [re] } = await pool.query('SELECT * FROM rechazos_externos WHERE id=$1', [req.params.id]);
    if (!re) return res.status(404).json({ error: 'Registro no encontrado' });

    const [{ rows: probs }, { rows: accs }, { rows: imgs }] = await Promise.all([
      pool.query('SELECT * FROM re_problem_descriptions WHERE rechazo_id=$1 ORDER BY orden', [req.params.id]),
      pool.query('SELECT * FROM re_corrective_actions WHERE rechazo_id=$1 ORDER BY departamento, orden', [req.params.id]),
      pool.query('SELECT * FROM re_images WHERE rechazo_id=$1 ORDER BY id', [req.params.id]),
    ]);

    const logoPath = path.join(__dirname, 'public', 'QC_logo_sin_fondo.png');
    const logoB64 = fs.existsSync(logoPath)
      ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
      : '';

    const imgsB64 = imgs.map(img => {
      const p = path.join(uploadsDir, img.filename);
      if (!fs.existsSync(p)) return null;
      const ext = path.extname(img.filename).slice(1).toLowerCase();
      const mime = ext === 'jpg' ? 'jpeg' : (ext || 'jpeg');
      return `data:image/${mime};base64,${fs.readFileSync(p).toString('base64')}`;
    }).filter(Boolean);

    const depts = {};
    accs.forEach(a => { if (!depts[a.departamento]) depts[a.departamento] = []; depts[a.departamento].push(a.accion); });

    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(buildNcrHtml({ re, probs, depts, imgsB64, logoB64 }), { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="NCR-${re.license_plate}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (e) {
    console.error('Error generando PDF:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  } finally {
    if (browser) await browser.close();
  }
});

function buildNcrHtml({ re, probs, depts, imgsB64, logoB64 }) {
  const esc = s => String(s ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const fmtTs = ts => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
  };
  const fmtDate = d => d ? String(d).slice(0,10) : '—';
  const fmtMins = m => {
    if (m == null) return '—';
    const h = Math.floor(m / 60), min = m % 60;
    return `${h}h ${min}m`;
  };
  const fmtPrice = p => p != null ? '$' + parseFloat(p).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '—';

  const di = (label, val) => `<div class="di"><label>${label}</label><span>${esc(val)}</span></div>`;

  const photosHtml = imgsB64.length ? `
    <div class="section">
      <div class="sec-title">Photographic Evidence</div>
      <div class="photo-box">
        <div class="photos-wrap">${imgsB64.map(src => `<div class="photo-item"><img src="${src}"></div>`).join('')}</div>
        <p class="photo-cap">${esc(re.license_plate)} — Visual evidence</p>
      </div>
    </div>` : '';

  const probsHtml = probs.length ? `
    <div class="section">
      <div class="sec-title">Problem Description</div>
      ${probs.map((p,i) => `<div class="prob-item"><div class="prob-num">${i+1}</div><div class="prob-text">${esc(p.descripcion)}</div></div>`).join('')}
    </div>` : '';

  const accsHtml = Object.keys(depts).length ? `
    <div class="section">
      <div class="sec-title">Corrective Actions</div>
      ${Object.entries(depts).map(([dept, acts]) => `
        <div class="dept-block">
          <div class="dept-hdr">${esc(dept)}</div>
          ${acts.map((a,i) => `<div class="act-item"><div class="act-num">${i+1}</div><div class="act-text">${esc(a)}</div></div>`).join('')}
        </div>`).join('')}
    </div>` : '';

  const today = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#222;background:#fff}
.header{display:flex;justify-content:space-between;align-items:center;padding:16px 28px 14px;border-bottom:2px solid #0d2b4e}
.header-right{text-align:right;font-size:10px;color:#555;line-height:1.7}
.title-block{background:#111;color:#fff;padding:16px 28px;margin-bottom:20px}
.title-block h1{font-size:19px;font-weight:700;letter-spacing:0.5px}
.title-block p{font-size:11px;margin-top:5px;color:rgba(255,255,255,.6)}
.section{padding:0 28px;margin-bottom:20px}
.sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0d2b4e;border-bottom:2px solid #0d2b4e;padding-bottom:5px;margin-bottom:12px}
.data-box{border-left:3px solid #0d2b4e;padding:12px 16px;background:#f8f9fb}
.data-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 32px}
.di label{display:block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#888;margin-bottom:2px}
.di span{font-size:11px;color:#222;font-weight:500}
.photo-box{border:1px solid #ddd;padding:14px}
.photos-wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.photo-item img{max-width:260px;max-height:200px;object-fit:contain;display:block}
.photo-cap{font-size:9px;color:#777;font-style:italic;margin-top:10px;text-align:center}
.prob-item{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start}
.prob-num{width:22px;height:22px;background:#111;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px}
.prob-text{font-size:11px;line-height:1.6}
.dept-block{margin-bottom:14px}
.dept-hdr{background:#111;color:#fff;padding:7px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px}
.act-item{display:flex;gap:10px;margin-bottom:7px;padding:0 6px;align-items:flex-start}
.act-num{width:18px;height:18px;background:#444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;border-radius:2px;margin-top:1px}
.act-text{font-size:11px;line-height:1.6}
.footer{padding:10px 28px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:9px;color:#aaa;margin-top:8px}
</style></head><body>

<div class="header">
  ${logoB64 ? `<img src="${logoB64}" style="height:40px">` : '<div></div>'}
  <div class="header-right">ISO 9001:2015<br>Non-Conformance Report</div>
</div>

<div class="title-block">
  <h1>NON-CONFORMANCE REPORT</h1>
  <p>License Plate: ${esc(re.license_plate)}</p>
</div>

<div class="section">
  <div class="sec-title">Product Information</div>
  <div class="data-box">
    <div class="data-grid">
      ${di('Return Order', re.return_order)}
      ${di('Sales Channel', re.sales_channel)}
      ${di('License Plate', re.license_plate)}
      ${di('SKU', re.sku)}
      ${di('Classification', re.classification)}
      ${di('Brand', re.brand)}
      ${di('Inches', re.inches)}
      <div class="di"><label>Sale Price</label><span>${fmtPrice(re.sale_price)}</span></div>
    </div>
  </div>
</div>

${photosHtml}

<div class="section">
  <div class="sec-title">Processing Data</div>
  <div class="data-box">
    <div class="data-grid">
      <div class="di"><label>Plant Entry</label><span>${fmtTs(re.plant_entry)}</span></div>
      <div class="di"><label>Plant Exit</label><span>${fmtTs(re.plant_exit)}</span></div>
      <div class="di"><label>Total Time in Plant</label><span>${fmtMins(re.total_time_minutes)}</span></div>
      ${di('Processed By', re.processed_by)}
      ${di('Outbound Order', re.outbound_order)}
      <div class="di"><label>Registration Date</label><span>${fmtDate(re.registration_date)}</span></div>
    </div>
  </div>
</div>

${probsHtml}
${accsHtml}

<div class="footer">
  <span>License Plate: ${esc(re.license_plate)}</span>
  <span>Outbound Order: ${esc(re.outbound_order)}</span>
  <span>Generated: ${today}</span>
</div>

</body></html>`;
}

// ── RECHAZOS INTERNOS ─────────────────────────────────────────
app.get('/api/rechazos-internos', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ri.*,
        (SELECT COUNT(*) FROM ri_images WHERE rechazo_id = ri.id) AS cnt_images
      FROM rechazos_internos ri
      ORDER BY ri.fecha_registro DESC, ri.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rechazos-internos/:id', auth, async (req, res) => {
  try {
    const [rec, imgs] = await Promise.all([
      pool.query('SELECT * FROM rechazos_internos WHERE id=$1', [req.params.id]),
      pool.query('SELECT * FROM ri_images WHERE rechazo_id=$1 ORDER BY id', [req.params.id]),
    ]);
    if (!rec.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ...rec.rows[0], images: imgs.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rechazos-internos', auth, async (req, res) => {
  const { fecha_registro, license_plate, sku, defecto, actividad_realizar,
          costo_no_calidad, origen_hallazgo, inspector } = req.body;
  const registrado_por = req.session.usuario.nombre;
  try {
    const { rows } = await pool.query(
      `INSERT INTO rechazos_internos
         (fecha_registro, license_plate, sku, defecto, actividad_realizar,
          costo_no_calidad, origen_hallazgo, inspector, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [fecha_registro, license_plate, sku || '', defecto,
       actividad_realizar || '', costo_no_calidad || 0,
       origen_hallazgo || '', inspector || registrado_por, registrado_por]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rechazos-internos/:id', auth, async (req, res) => {
  const { fecha_registro, license_plate, sku, defecto, actividad_realizar,
          costo_no_calidad, origen_hallazgo, inspector } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE rechazos_internos SET
         fecha_registro=$1, license_plate=$2, sku=$3, defecto=$4,
         actividad_realizar=$5, costo_no_calidad=$6, origen_hallazgo=$7, inspector=$8
       WHERE id=$9 RETURNING *`,
      [fecha_registro, license_plate, sku || '', defecto,
       actividad_realizar || '', costo_no_calidad || 0,
       origen_hallazgo || '', inspector || '', req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rechazos-internos/:id/images', auth, uploadInt.array('images', 10), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No se recibieron imágenes.' });
  try {
    for (const file of req.files) {
      await pool.query(
        'INSERT INTO ri_images (rechazo_id, filename) VALUES ($1,$2)',
        [req.params.id, file.filename]
      );
    }
    res.json({ ok: true, count: req.files.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rechazos-internos/:id/firma', auth, uploadInt.single('firma'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió firma.' });
  try {
    const { rows: [old] } = await pool.query(
      'SELECT firma_filename FROM rechazos_internos WHERE id=$1', [req.params.id]
    );
    if (old?.firma_filename) fs.unlink(path.join(uploadsIntDir, old.firma_filename), () => {});
    await pool.query(
      'UPDATE rechazos_internos SET firma_filename=$1 WHERE id=$2',
      [req.file.filename, req.params.id]
    );
    res.json({ firma_filename: req.file.filename });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/rechazos-internos/:id/images/:imgId', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM ri_images WHERE id=$1 AND rechazo_id=$2 RETURNING filename',
      [req.params.imgId, req.params.id]
    );
    if (rows.length) fs.unlink(path.join(uploadsIntDir, rows[0].filename), () => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/rechazos-internos/:id', auth, async (req, res) => {
  try {
    const { rows: imgs } = await pool.query(
      'SELECT filename FROM ri_images WHERE rechazo_id=$1', [req.params.id]
    );
    imgs.forEach(img => fs.unlink(path.join(uploadsIntDir, img.filename), () => {}));
    const { rows: [rec] } = await pool.query(
      'SELECT firma_filename FROM rechazos_internos WHERE id=$1', [req.params.id]
    );
    if (rec?.firma_filename) fs.unlink(path.join(uploadsIntDir, rec.firma_filename), () => {});
    await pool.query('DELETE FROM rechazos_internos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AQL ───────────────────────────────────────────────────────
app.get('/api/aql', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM aql_registros ORDER BY fecha_registro DESC, created_at DESC`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/aql/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM aql_registros WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/aql', auth, async (req, res) => {
  const u = req.session.usuario;
  const {
    fecha_registro, license_plate, clasificacion, sku, marca, modelo, descripcion,
    accesorios_presentes, estado_accesorios, accesorios_defectos,
    estado_bolsa, bolsa_defectos,
    estado_audio, audio_defectos,
    estado_video, video_defectos,
    estado_fisico_pantalla, fisico_pantalla_defectos,
    estado_limpieza, limpieza_defectos,
    estado_aql, inspector,
  } = req.body;
  try {
    const { rows: [r] } = await pool.query(`
      INSERT INTO aql_registros
        (fecha_registro, license_plate, clasificacion, sku, marca, modelo, descripcion,
         accesorios_presentes, estado_accesorios, accesorios_defectos,
         estado_bolsa, bolsa_defectos,
         estado_audio, audio_defectos,
         estado_video, video_defectos,
         estado_fisico_pantalla, fisico_pantalla_defectos,
         estado_limpieza, limpieza_defectos,
         estado_aql, inspector, registrado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *`,
      [fecha_registro, license_plate, clasificacion||'', sku||'', marca||'', modelo||'', descripcion||'',
       accesorios_presentes||'', estado_accesorios||'', accesorios_defectos||'',
       estado_bolsa||'', bolsa_defectos||'',
       estado_audio||'', audio_defectos||'',
       estado_video||'', video_defectos||'',
       estado_fisico_pantalla||'', fisico_pantalla_defectos||'',
       estado_limpieza||'', limpieza_defectos||'',
       estado_aql||'', inspector||u.nombre, u.nombre]
    );
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/aql/:id', auth, async (req, res) => {
  const {
    fecha_registro, license_plate, clasificacion, sku, marca, modelo, descripcion,
    accesorios_presentes, estado_accesorios, accesorios_defectos,
    estado_bolsa, bolsa_defectos,
    estado_audio, audio_defectos,
    estado_video, video_defectos,
    estado_fisico_pantalla, fisico_pantalla_defectos,
    estado_limpieza, limpieza_defectos,
    estado_aql, inspector,
  } = req.body;
  try {
    const { rows: [r] } = await pool.query(`
      UPDATE aql_registros SET
        fecha_registro=$1, license_plate=$2, clasificacion=$3, sku=$4, marca=$5, modelo=$6,
        descripcion=$7, accesorios_presentes=$8, estado_accesorios=$9, accesorios_defectos=$10,
        estado_bolsa=$11, bolsa_defectos=$12,
        estado_audio=$13, audio_defectos=$14,
        estado_video=$15, video_defectos=$16,
        estado_fisico_pantalla=$17, fisico_pantalla_defectos=$18,
        estado_limpieza=$19, limpieza_defectos=$20,
        estado_aql=$21, inspector=$22
      WHERE id=$23 RETURNING *`,
      [fecha_registro, license_plate, clasificacion||'', sku||'', marca||'', modelo||'', descripcion||'',
       accesorios_presentes||'', estado_accesorios||'', accesorios_defectos||'',
       estado_bolsa||'', bolsa_defectos||'',
       estado_audio||'', audio_defectos||'',
       estado_video||'', video_defectos||'',
       estado_fisico_pantalla||'', fisico_pantalla_defectos||'',
       estado_limpieza||'', limpieza_defectos||'',
       estado_aql||'', inspector||'', req.params.id]
    );
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/aql/:id/foto-lpn', auth, uploadAql.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });
  try {
    const { rows: [old] } = await pool.query('SELECT foto_lpn_filename FROM aql_registros WHERE id=$1', [req.params.id]);
    if (old?.foto_lpn_filename) fs.unlink(path.join(uploadsAqlDir, old.foto_lpn_filename), () => {});
    await pool.query('UPDATE aql_registros SET foto_lpn_filename=$1 WHERE id=$2', [req.file.filename, req.params.id]);
    res.json({ foto_lpn_filename: req.file.filename });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/aql/:id/foto-pantalla', auth, uploadAql.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });
  try {
    const { rows: [old] } = await pool.query('SELECT foto_pantalla_filename FROM aql_registros WHERE id=$1', [req.params.id]);
    if (old?.foto_pantalla_filename) fs.unlink(path.join(uploadsAqlDir, old.foto_pantalla_filename), () => {});
    await pool.query('UPDATE aql_registros SET foto_pantalla_filename=$1 WHERE id=$2', [req.file.filename, req.params.id]);
    res.json({ foto_pantalla_filename: req.file.filename });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/aql/:id', auth, async (req, res) => {
  try {
    const { rows: [rec] } = await pool.query('SELECT foto_lpn_filename, foto_pantalla_filename FROM aql_registros WHERE id=$1', [req.params.id]);
    if (rec?.foto_lpn_filename)      fs.unlink(path.join(uploadsAqlDir, rec.foto_lpn_filename),      () => {});
    if (rec?.foto_pantalla_filename) fs.unlink(path.join(uploadsAqlDir, rec.foto_pantalla_filename), () => {});
    await pool.query('DELETE FROM aql_registros WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CAPAS (Acciones Correctivas) ──────────────────────────────
app.get('/api/capas', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
        CASE c.origen_tipo
          WHEN 'nc' THEN (SELECT CONCAT('NC — ', area, ' / ', tipo) FROM no_conformidades WHERE id = c.origen_id)
          WHEN 're' THEN (SELECT CONCAT('RE — ', license_plate)     FROM rechazos_externos  WHERE id = c.origen_id)
        END AS origen_ref
      FROM capas c
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/capas/:id', auth, async (req, res) => {
  try {
    const id = req.params.id;
    const [resCapa, resPorques, resIshikawa, resAcciones] = await Promise.all([
      pool.query(`SELECT c.*,
        CASE c.origen_tipo
          WHEN 'nc' THEN (SELECT CONCAT('NC — ', area, ' / ', tipo) FROM no_conformidades WHERE id = c.origen_id)
          WHEN 're' THEN (SELECT CONCAT('RE — ', license_plate)     FROM rechazos_externos  WHERE id = c.origen_id)
        END AS origen_ref
        FROM capas c WHERE c.id=$1`, [id]),
      pool.query('SELECT * FROM capa_5porques  WHERE capa_id=$1 ORDER BY orden', [id]),
      pool.query('SELECT * FROM capa_ishikawa  WHERE capa_id=$1', [id]),
      pool.query('SELECT * FROM capa_acciones  WHERE capa_id=$1 ORDER BY id', [id]),
    ]);
    if (!resCapa.rows[0]) return res.status(404).json({ error: 'CAPA no encontrada' });
    res.json({ ...resCapa.rows[0], porques: resPorques.rows, ishikawa: resIshikawa.rows, acciones: resAcciones.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/capas', auth, async (req, res) => {
  const { origen_tipo, origen_id, titulo, descripcion_problema, metodo_analisis,
          responsable, fecha_apertura, fecha_compromiso, porques, ishikawa, acciones } = req.body;
  const registrado_por = req.session.usuario.nombre;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [capa] } = await client.query(
      `INSERT INTO capas (origen_tipo,origen_id,titulo,descripcion_problema,metodo_analisis,
         responsable,fecha_apertura,fecha_compromiso,registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [origen_tipo, origen_id, titulo, descripcion_problema, metodo_analisis,
       responsable, fecha_apertura, fecha_compromiso || null, registrado_por]
    );
    const cid = capa.id;
    if (metodo_analisis === '5porques' && Array.isArray(porques)) {
      for (const p of porques) {
        await client.query('INSERT INTO capa_5porques (capa_id,orden,respuesta) VALUES ($1,$2,$3)',
          [cid, p.orden, p.respuesta || '']);
      }
    }
    if (metodo_analisis === 'ishikawa' && Array.isArray(ishikawa)) {
      for (const c of ishikawa) {
        if (c.causa && c.causa.trim()) {
          await client.query('INSERT INTO capa_ishikawa (capa_id,categoria,causa) VALUES ($1,$2,$3)',
            [cid, c.categoria, c.causa]);
        }
      }
    }
    if (Array.isArray(acciones)) {
      for (const a of acciones) {
        if (a.accion && a.accion.trim()) {
          await client.query(
            'INSERT INTO capa_acciones (capa_id,accion,responsable,fecha_compromiso,estatus) VALUES ($1,$2,$3,$4,$5)',
            [cid, a.accion, a.responsable || '', a.fecha_compromiso || null, a.estatus || 'Pendiente']);
        }
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ id: cid });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.put('/api/capas/:id', auth, async (req, res) => {
  const { titulo, descripcion_problema, metodo_analisis, responsable,
          fecha_apertura, fecha_compromiso, porques, ishikawa, acciones } = req.body;
  const cid = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE capas SET titulo=$1,descripcion_problema=$2,metodo_analisis=$3,responsable=$4,
         fecha_apertura=$5,fecha_compromiso=$6 WHERE id=$7`,
      [titulo, descripcion_problema, metodo_analisis, responsable,
       fecha_apertura, fecha_compromiso || null, cid]
    );
    await client.query('DELETE FROM capa_5porques WHERE capa_id=$1', [cid]);
    await client.query('DELETE FROM capa_ishikawa  WHERE capa_id=$1', [cid]);
    await client.query('DELETE FROM capa_acciones  WHERE capa_id=$1', [cid]);
    if (metodo_analisis === '5porques' && Array.isArray(porques)) {
      for (const p of porques) {
        await client.query('INSERT INTO capa_5porques (capa_id,orden,respuesta) VALUES ($1,$2,$3)',
          [cid, p.orden, p.respuesta || '']);
      }
    }
    if (metodo_analisis === 'ishikawa' && Array.isArray(ishikawa)) {
      for (const c of ishikawa) {
        if (c.causa && c.causa.trim()) {
          await client.query('INSERT INTO capa_ishikawa (capa_id,categoria,causa) VALUES ($1,$2,$3)',
            [cid, c.categoria, c.causa]);
        }
      }
    }
    if (Array.isArray(acciones)) {
      for (const a of acciones) {
        if (a.accion && a.accion.trim()) {
          await client.query(
            'INSERT INTO capa_acciones (capa_id,accion,responsable,fecha_compromiso,estatus) VALUES ($1,$2,$3,$4,$5)',
            [cid, a.accion, a.responsable || '', a.fecha_compromiso || null, a.estatus || 'Pendiente']);
        }
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.patch('/api/capas/:id/estatus', auth, async (req, res) => {
  const { estatus, verificado_por, observaciones } = req.body;
  try {
    const fechaCierre = estatus === 'Cerrada' ? new Date().toISOString().slice(0,10) : null;
    await pool.query(
      `UPDATE capas SET estatus=$1, verificado_por=COALESCE($2,verificado_por),
         observaciones=COALESCE($3,observaciones),
         fecha_cierre=CASE WHEN $1='Cerrada' THEN $4::date ELSE fecha_cierre END
       WHERE id=$5`,
      [estatus, verificado_por || null, observaciones || null, fechaCierre, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/capas/:id/acciones/:aid', auth, async (req, res) => {
  const { estatus } = req.body;
  try {
    await pool.query('UPDATE capa_acciones SET estatus=$1 WHERE id=$2 AND capa_id=$3',
      [estatus, req.params.aid, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/capas/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM capa_5porques WHERE capa_id=$1', [req.params.id]);
    await pool.query('DELETE FROM capa_ishikawa  WHERE capa_id=$1', [req.params.id]);
    await pool.query('DELETE FROM capa_acciones  WHERE capa_id=$1', [req.params.id]);
    await pool.query('DELETE FROM capas WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DASHBOARD ─────────────────────────────────────────────────
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const { periodo = 'mes', anio, mes } = req.query;
    const anioN = parseInt(anio) || new Date().getFullYear();
    const mesN  = parseInt(mes)  || (new Date().getMonth() + 1);

    let whereRE, whereNC, whereRI, params;
    if (periodo === 'ytd') {
      whereRE = `EXTRACT(year FROM registration_date) = $1`;
      whereNC = `EXTRACT(year FROM fecha) = $1`;
      whereRI = `EXTRACT(year FROM fecha_registro) = $1`;
      params  = [anioN];
    } else {
      whereRE = `DATE_TRUNC('month', registration_date) = make_date($1,$2,1)`;
      whereNC = `DATE_TRUNC('month', fecha) = make_date($1,$2,1)`;
      whereRI = `DATE_TRUNC('month', fecha_registro) = make_date($1,$2,1)`;
      params  = [anioN, mesN];
    }

    const [resRE, resMarca, resClasif, resNcTotal, resNcSev, resNcArea, resColabs, resRI] =
      await Promise.all([
        pool.query(`SELECT COALESCE(SUM(sale_price),0) AS total_price, COUNT(*) AS total_rechazos
                    FROM rechazos_externos WHERE ${whereRE}`, params),
        pool.query(`SELECT COALESCE(brand,'Sin marca') AS brand,
                           COALESCE(SUM(sale_price),0) AS total, COUNT(*) AS cnt
                    FROM rechazos_externos WHERE ${whereRE}
                    GROUP BY brand ORDER BY total DESC LIMIT 6`, params),
        pool.query(`SELECT COALESCE(NULLIF(TRIM(classification),''),'Sin clasificación') AS classification,
                           COUNT(*) AS cnt
                    FROM rechazos_externos WHERE ${whereRE}
                    GROUP BY classification ORDER BY cnt DESC LIMIT 6`, params),
        pool.query(`SELECT COUNT(*) AS abiertas FROM no_conformidades
                    WHERE estatus = 'Abierta' AND ${whereNC}`, params),
        pool.query(`SELECT severidad, COUNT(*) AS cnt FROM no_conformidades
                    WHERE ${whereNC} GROUP BY severidad`, params),
        pool.query(`SELECT area, COUNT(*) AS cnt FROM no_conformidades
                    WHERE ${whereNC} GROUP BY area ORDER BY cnt DESC LIMIT 6`, params),
        pool.query(`SELECT COUNT(*) AS activos FROM organigrama_qc WHERE estatus = 'activo'`),
        pool.query(`SELECT COALESCE(SUM(costo_no_calidad),0) AS total_copq, COUNT(*) AS total_ri
                    FROM rechazos_internos WHERE ${whereRI}`, params),
      ]);

    const extPrice  = parseFloat(resRE.rows[0].total_price);
    const intCopq   = parseFloat(resRI.rows[0].total_copq);

    res.json({
      sale_price_total:      extPrice,
      copq_interno_total:    intCopq,
      total_rejects_cost:    extPrice + intCopq,
      rechazos_total:        parseInt(resRE.rows[0].total_rechazos),
      rechazos_internos_total: parseInt(resRI.rows[0].total_ri),
      nc_abiertas:           parseInt(resNcTotal.rows[0].abiertas),
      colaboradores_activos: parseInt(resColabs.rows[0].activos),
      sale_price_por_marca:  resMarca.rows,
      rechazos_por_clasif:   resClasif.rows,
      nc_por_severidad:      resNcSev.rows,
      nc_por_area:           resNcArea.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ORGANIGRAMA QC ────────────────────────────────────────────
const ORDEN_PUESTO = `CASE puesto
  WHEN 'Ingeniero de Calidad'   THEN 1
  WHEN 'Supervisor de Calidad'  THEN 2
  WHEN 'Tecnico de Calidad'     THEN 3
  WHEN 'Especialista de Calidad' THEN 3
  WHEN 'Inspector de Calidad'   THEN 4
  ELSE 5 END`;

app.get('/api/organigrama-qc', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM organigrama_qc ORDER BY ${ORDEN_PUESTO}, nombre_completo`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/organigrama-qc', auth, async (req, res) => {
  const { nombre_completo, no_empleado, puesto, area, turno, estatus,
          fecha_ingreso, telefono, correo, sexo, fecha_nacimiento,
          contacto_emergencia, tel_emergencia } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO organigrama_qc
       (nombre_completo,no_empleado,puesto,area,turno,estatus,fecha_ingreso,
        telefono,correo,sexo,fecha_nacimiento,contacto_emergencia,tel_emergencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [nombre_completo, no_empleado||'', puesto, area||'', turno||'', estatus||'activo',
       fecha_ingreso||null, telefono||'', correo||'', sexo||'',
       fecha_nacimiento||null, contacto_emergencia||'', tel_emergencia||'']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/organigrama-qc/:id', auth, async (req, res) => {
  const { nombre_completo, no_empleado, puesto, area, turno, estatus,
          fecha_ingreso, telefono, correo, sexo, fecha_nacimiento,
          contacto_emergencia, tel_emergencia } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE organigrama_qc SET
       nombre_completo=$1, no_empleado=$2, puesto=$3, area=$4, turno=$5, estatus=$6,
       fecha_ingreso=$7, telefono=$8, correo=$9, sexo=$10, fecha_nacimiento=$11,
       contacto_emergencia=$12, tel_emergencia=$13
       WHERE id=$14 RETURNING *`,
      [nombre_completo, no_empleado||'', puesto, area||'', turno||'', estatus||'activo',
       fecha_ingreso||null, telefono||'', correo||'', sexo||'',
       fecha_nacimiento||null, contacto_emergencia||'', tel_emergencia||'',
       req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/organigrama-qc/:id/estatus', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE organigrama_qc SET estatus = CASE WHEN estatus='activo' THEN 'inactivo' ELSE 'activo' END
       WHERE id=$1 RETURNING estatus`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/organigrama-qc/:id/foto', auth, uploadOrg.single('foto'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen.' });
    const { rows: [old] } = await pool.query('SELECT foto_filename FROM organigrama_qc WHERE id=$1', [req.params.id]);
    if (old?.foto_filename) fs.unlink(path.join(uploadsOrgDir, old.foto_filename), () => {});
    await pool.query('UPDATE organigrama_qc SET foto_filename=$1 WHERE id=$2', [req.file.filename, req.params.id]);
    res.json({ foto_filename: req.file.filename });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/organigrama-qc/:id', auth, async (req, res) => {
  try {
    const { rows: [rec] } = await pool.query('SELECT foto_filename FROM organigrama_qc WHERE id=$1', [req.params.id]);
    if (rec?.foto_filename) fs.unlink(path.join(uploadsOrgDir, rec.foto_filename), () => {});
    await pool.query('DELETE FROM organigrama_qc WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CALENDARIO ────────────────────────────────────────────────
app.get('/api/calendario', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cs.*, oq.nombre_completo, oq.area, oq.puesto
      FROM calendario_solicitudes cs
      JOIN organigrama_qc oq ON cs.colaborador_id = oq.id
      ORDER BY cs.fecha_inicio DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/calendario', auth, async (req, res) => {
  const { colaborador_id, tipo, fecha_inicio, fecha_fin, dias_habiles, motivo, estatus } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO calendario_solicitudes
       (colaborador_id,tipo,fecha_inicio,fecha_fin,dias_habiles,motivo,estatus,registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [colaborador_id, tipo, fecha_inicio, fecha_fin, dias_habiles||1, motivo||'',
       estatus||'pendiente', req.session.usuario?.nombre||'']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/calendario/:id', auth, async (req, res) => {
  const { colaborador_id, tipo, fecha_inicio, fecha_fin, dias_habiles, motivo, estatus } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE calendario_solicitudes SET
       colaborador_id=$1,tipo=$2,fecha_inicio=$3,fecha_fin=$4,
       dias_habiles=$5,motivo=$6,estatus=$7
       WHERE id=$8 RETURNING *`,
      [colaborador_id, tipo, fecha_inicio, fecha_fin, dias_habiles||1,
       motivo||'', estatus||'pendiente', req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/calendario/:id/estatus', auth, async (req, res) => {
  const { estatus, observaciones } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE calendario_solicitudes SET estatus=$1, observaciones=$2, aprobado_por=$3 WHERE id=$4 RETURNING *`,
      [estatus, observaciones||'', req.session.usuario?.nombre||'', req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/calendario/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM calendario_solicitudes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/calendario/festivos', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM calendario_festivos ORDER BY fecha');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/calendario/festivos', auth, async (req, res) => {
  const { nombre, fecha, recurrente } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO calendario_festivos (nombre,fecha,recurrente) VALUES ($1,$2,$3) RETURNING *',
      [nombre, fecha, recurrente !== false]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/calendario/festivos/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM calendario_festivos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/calendario/saldo', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cs.*, oq.nombre_completo, oq.area
      FROM calendario_saldo cs
      JOIN organigrama_qc oq ON cs.colaborador_id = oq.id
      ORDER BY oq.nombre_completo
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/calendario/saldo', auth, async (req, res) => {
  const { colaborador_id, anio, dias_asignados } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO calendario_saldo (colaborador_id,anio,dias_asignados)
       VALUES ($1,$2,$3)
       ON CONFLICT (colaborador_id,anio) DO UPDATE SET dias_asignados=$3
       RETURNING *`,
      [colaborador_id, anio, dias_asignados]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── USUARIOS ───────────────────────────────────────────────────
app.get('/api/usuarios', auth, admin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, usuario, rol, area, activo FROM usuarios ORDER BY id'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/usuarios', auth, admin, async (req, res) => {
  const { nombre, usuario, password, rol, area } = req.body;
  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE usuario=$1', [usuario]);
    if (existe.rows.length) return res.status(400).json({ error: 'El nombre de usuario ya existe.' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, usuario, password_hash, rol, area, activo)
       VALUES ($1,$2,$3,$4,$5,true)
       RETURNING id, nombre, usuario, rol, area, activo`,
      [nombre, usuario.toLowerCase(), hash, rol, area]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/usuarios/:id', auth, admin, async (req, res) => {
  const { nombre, usuario, password, rol, area } = req.body;
  const id = parseInt(req.params.id);
  try {
    const existe = await pool.query(
      'SELECT id FROM usuarios WHERE usuario=$1 AND id!=$2', [usuario, id]
    );
    if (existe.rows.length) return res.status(400).json({ error: 'El nombre de usuario ya existe.' });
    let result;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      result = await pool.query(
        `UPDATE usuarios SET nombre=$1, usuario=$2, password_hash=$3, rol=$4, area=$5
         WHERE id=$6 RETURNING id, nombre, usuario, rol, area, activo`,
        [nombre, usuario.toLowerCase(), hash, rol, area, id]
      );
    } else {
      result = await pool.query(
        `UPDATE usuarios SET nombre=$1, usuario=$2, rol=$3, area=$4
         WHERE id=$5 RETURNING id, nombre, usuario, rol, area, activo`,
        [nombre, usuario.toLowerCase(), rol, area, id]
      );
    }
    if (req.session.usuario.id === id) {
      req.session.usuario = { ...req.session.usuario, nombre: result.rows[0].nombre, rol: result.rows[0].rol };
    }
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/usuarios/:id/toggle', auth, admin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.session.usuario.id === id)
    return res.status(400).json({ error: 'No puedes cambiar el estatus de tu propia cuenta.' });
  try {
    const { rows } = await pool.query(
      'UPDATE usuarios SET activo = NOT activo WHERE id=$1 RETURNING id, nombre, usuario, rol, area, activo',
      [id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/usuarios/:id', auth, admin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.session.usuario.id === id)
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
  try {
    await pool.query('DELETE FROM usuarios WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Catch-all SPA ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Arranque ───────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n Control de Calidad corriendo en → http://localhost:${PORT}\n`);
    });
  })
  .catch(err => {
    console.error('Error al inicializar la base de datos:', err.message);
    process.exit(1);
  });
