require('dotenv').config();

const express  = require('express');
const { Pool } = require('pg');
const session  = require('express-session');
const bcrypt   = require('bcrypt');
const path     = require('path');

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
    const { rows } = await pool.query(
      'SELECT * FROM no_conformidades WHERE fecha = $1 ORDER BY hora',
      [fecha]
    );
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
