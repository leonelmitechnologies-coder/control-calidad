import "dotenv/config"; // must be first — loads .env before any module-level code runs
import express, { Request, Response, NextFunction } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import passport from "passport";
import multer from "multer";
// Initialize paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import local modules
import { initDB, pool, db, getClient, beginTransaction, commitTransaction, rollbackTransaction } from "./db.js";
import { setupSession, initializePassport, requireAuth, requireAdmin, PassportUser } from "./auth.js";
import * as s3 from "./s3.js";
import * as types from "./types.js";

// Import schema tables
import * as schema from "../shared/schema.js";
import { eq, and, like, desc, sql, count, asc } from "drizzle-orm";

// Import additional routes
import { registerRoutes } from "./routes.js";

// ── Express Setup ──────────────────────────────────────────────

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Trust Traefik/Coolify reverse proxy so req.secure and cookies work correctly
app.set("trust proxy", 1);

// Security headers + HTTPS redirect in production
if (process.env.NODE_ENV === "production") {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Force HTTPS
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(301, "https://" + req.headers.host + req.url);
    }
    // HSTS: tell browsers to always use HTTPS for 1 year
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });
}

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Session + passport: use a dev fallback when SESSION_SECRET is not set so the
// server can still start and serve the health endpoint even in misconfigured envs.
const SESSION_SECRET_VALUE = process.env.SESSION_SECRET ||
  (process.env.NODE_ENV !== "production" ? "dev-insecure-secret" : "");
if (!SESSION_SECRET_VALUE) {
  console.error("[App] FATAL: SESSION_SECRET env var is required in production");
}
// Override process.env so setupSession() picks it up
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = SESSION_SECRET_VALUE || "startup-placeholder";
}
setupSession(app);

// ── Startup state ──────────────────────────────────────────────
let appReady = false;
let startupError: string | null = null;

// ── Serve static files BEFORE initApp so "/" always works ──────────
const publicDir = path.join(process.cwd(), "dist/client");
app.use(express.static(publicDir));

// Local uploads (used when S3 is not configured)
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

// ── Start HTTP server FIRST (so Traefik/Coolify health checks pass) ──
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[App] Server listening on 0.0.0.0:${PORT}`);
  initApp();
});

// ── Initialize Authentication ──────────────────────────────────

let passportClient: any;
let oidcReady = false;

async function initApp() {
  // Retry DB connection up to 5 times with 15s delay (handles transient DB startup races)
  let dbOk = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await initDB();
      dbOk = true;
      console.log("[App] Database initialized");
      break;
    } catch (err: any) {
      console.warn(`[App] DB init attempt ${attempt}/5 failed: ${err.message}`);
      if (attempt < 5) {
        await new Promise((r) => setTimeout(r, 15000));
      } else {
        startupError = `DB init failed after 5 attempts: ${err.message}`;
        console.error("[App]", startupError);
        return; // Keep server alive — /api/health will report the error
      }
    }
  }

  if (!dbOk) return;

  // Initialize Passport OIDC (optional — skip if SSO vars not yet configured)
  try {
    passportClient = await initializePassport(app);
    oidcReady = true;
    console.log("[App] Passport OIDC initialized");
  } catch (err: any) {
    console.warn("[App] OIDC not configured, SSO disabled:", err.message);
  }

  // Register additional routes
  registerRoutes(app);
  console.log("[App] Routes registered");

  appReady = true;
  startupError = null;
  console.log("[App] Initialization complete — ready to serve");
}

// ── Multer Configuration (temporary, for validation) ──────────────

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ── AUTHENTICATION ENDPOINTS ──────────────────────────────────

// GET /api/auth/login - Redirect to Nextcloud SSO (skip if OIDC not configured)
app.get("/api/auth/login", async (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.OIDC_CLIENT_ID) return res.redirect("/");
  // If OIDC failed at startup, retry initialization before giving up
  if (!oidcReady) {
    try {
      passportClient = await initializePassport(app);
      oidcReady = true;
      console.log("[Auth] OIDC re-initialized on login attempt");
    } catch (err: any) {
      console.error("[Auth] OIDC re-init failed:", err.message);
      return res.status(503).send("SSO no disponible. Nextcloud no accesible desde el servidor. Contacte al administrador.");
    }
  }
  passport.authenticate("oidc")(req, res, next);
});

// GET /api/auth/callback - OIDC callback handler
app.get(
  "/auth/callback",
  (req: Request, res: Response, next: NextFunction) => {
    if (!oidcReady) return res.redirect("/api/auth/login");
    passport.authenticate("oidc", {
      failureRedirect: "/api/auth/login",
      session: true,
    })(req, res, next);
  },
  (_req: Request, res: Response) => {
    res.redirect("/");
  }
);

// GET /api/auth/logout - Destroy local session only, redirect to /login
// No se toca la sesión de Nextcloud/SSO para no cerrar otras apps corporativas.
app.get("/api/auth/logout", (req: Request, res: Response) => {
  req.logout((_err) => {
    req.session.destroy((_destroyErr) => {
      res.clearCookie("connect.sid");
      res.redirect("/login");
    });
  });
});

// POST /api/logout - legacy, kept for compatibility
app.post("/api/logout", (req: Request, res: Response) => {
  req.logout((_err) => {
    req.session.destroy((_destroyErr) => {
      res.clearCookie("connect.sid");
      res.json({ ok: true, redirect: "/logged-out" });
    });
  });
});

// GET /api/me - Get current user with fresh permisos from DB
app.get("/api/me", async (req: Request, res: Response) => {
  if (req.user) {
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
    const isEnvAdmin = adminEmails.some(a => a === req.user!.email || a === req.user!.id);

    let rol = isEnvAdmin ? "Administrador" : ((req.user as any).rol ?? "Usuario");
    let permisos: any = (req.user as any).permisos ?? {};

    // Always fetch fresh permisos + rol from DB
    try {
      const dbUser = await pool.query(
        "SELECT rol, permisos, activo FROM usuarios WHERE oidc_id = $1",
        [req.user.id]
      );
      if (dbUser.rows.length > 0) {
        if (!isEnvAdmin) rol = dbUser.rows[0].rol;
        permisos = dbUser.rows[0].permisos || {};
        if (!dbUser.rows[0].activo) {
          return res.status(403).json({ error: "Cuenta desactivada. Contacte al administrador." });
        }
      }
    } catch (err) {
      console.error("[API] /api/me DB query error:", err);
    }

    return res.json({
      id:       req.user.id,
      nombre:   req.user.name,
      usuario:  req.user.email,
      rol,
      permisos: rol === "Administrador" ? null : permisos,
    });
  }
  if (!process.env.OIDC_CLIENT_ID) {
    return res.json({ id: "dev", nombre: "Dev Local", usuario: "dev", rol: "Administrador", permisos: null });
  }
  return res.status(401).json({ error: "No autorizado" });
});

// ── HEALTH CHECK ────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  if (startupError) {
    return res.status(503).json({ ok: false, error: startupError });
  }
  res.json({ ok: appReady, status: appReady ? "ready" : "initializing" });
});

// ── NO CONFORMIDADES ────────────────────────────────────────────

// GET /api/nc - List NCRs with optional date filter
app.get("/api/nc", async (req: Request, res: Response) => {
  try {
    const { fecha } = req.query;
    let whereClause: any = undefined;

    if (fecha && fecha !== "todos") {
      const dateStr = fecha as string;
      whereClause = eq(schema.noConformidades.fecha, dateStr);
    } else if (fecha === "todos") {
      // No filter
    } else {
      // Default to today
      const today = new Date().toISOString().split("T")[0];
      whereClause = eq(schema.noConformidades.fecha, today);
    }

    const result = await db
      .select()
      .from(schema.noConformidades)
      .where(whereClause)
      .orderBy(desc(schema.noConformidades.fecha), desc(schema.noConformidades.id));

    res.json(result);
  } catch (err) {
    console.error("[API] GET /api/nc error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/nc - Create NCR
app.post("/api/nc", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      hora,
      area,
      tipo,
      descripcion,
      severidad,
      responsable,
      accion,
      fecha,
    } = req.body;

    const today = new Date().toISOString().split("T")[0];
    const insertFecha = fecha || today;

    const result = await db
      .insert(schema.noConformidades)
      .values({
        hora,
        area,
        tipo,
        descripcion,
        severidad,
        responsable: responsable || "—",
        accion: accion || "—",
        estatus: "Abierta",
        registradoPor: req.user?.name || "",
        fecha: insertFecha,
      })
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] POST /api/nc error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/nc/:id/estatus - Update NCR status
app.patch("/api/nc/:id/estatus", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estatus } = req.body;

    const result = await db
      .update(schema.noConformidades)
      .set({ estatus })
      .where(eq(schema.noConformidades.id, parseInt(id)))
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] PATCH /api/nc/:id/estatus error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/nc/:id - Delete NCR
app.delete("/api/nc/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await db
      .delete(schema.noConformidades)
      .where(eq(schema.noConformidades.id, parseInt(id)));

    res.json({ ok: true });
  } catch (err) {
    console.error("[API] DELETE /api/nc/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── RECEPCIONES ────────────────────────────────────────────────

// GET /api/recepciones - List receptions
app.get("/api/recepciones", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await db
      .select()
      .from(schema.recepciones)
      .orderBy(desc(schema.recepciones.fecha), desc(schema.recepciones.hora), desc(schema.recepciones.id));

    res.json(result);
  } catch (err) {
    console.error("[API] GET /api/recepciones error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/recepciones - Create reception
app.post("/api/recepciones", requireAuth, async (req: Request, res: Response) => {
  try {
    const { hora, company, origen, cargo, unit_qty, pallet_qty, tipo, fecha } = req.body;

    const today = new Date().toISOString().split("T")[0];
    const insertFecha = fecha || today;

    const result = await db
      .insert(schema.recepciones)
      .values({
        hora,
        company,
        origen,
        cargo,
        unitQty: unit_qty || 0,
        palletQty: pallet_qty || 0,
        tipo: tipo || "Import",
        estatus: "Confirmado",
        registradoPor: req.user?.name || "",
        fecha: insertFecha,
      })
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] POST /api/recepciones error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/recepciones/:id - Update reception
app.put("/api/recepciones/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hora, company, origen, cargo, unit_qty, pallet_qty, tipo, estatus, fecha } = req.body;

    const result = await db
      .update(schema.recepciones)
      .set({
        hora,
        company,
        origen,
        cargo,
        unitQty: unit_qty,
        palletQty: pallet_qty,
        tipo,
        estatus,
        fecha,
      })
      .where(eq(schema.recepciones.id, parseInt(id)))
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] PUT /api/recepciones/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/recepciones/:id/estatus - Update reception status
app.patch("/api/recepciones/:id/estatus", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estatus } = req.body;

    const result = await db
      .update(schema.recepciones)
      .set({ estatus })
      .where(eq(schema.recepciones.id, parseInt(id)))
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] PATCH /api/recepciones/:id/estatus error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/recepciones/:id - Delete reception
app.delete("/api/recepciones/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await db
      .delete(schema.recepciones)
      .where(eq(schema.recepciones.id, parseInt(id)));

    res.json({ ok: true });
  } catch (err) {
    console.error("[API] DELETE /api/recepciones/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── CATÁLOGO SKU (Lookup) ──────────────────────────────────────

// GET /api/diag/s3 — test S3 connection (token protected)
app.get("/api/diag/s3", async (req: Request, res: Response) => {
  if (req.headers["x-seed-token"] !== "mi-sku-seed-2026-qc") {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const { PutObjectCommand, ListBucketsCommand } = await import("@aws-sdk/client-s3");
    const { default: s3Client } = await import("./s3.js");
    const rawKey = process.env.AWS_ACCESS_KEY_ID || "";
    const rawSecret = process.env.AWS_SECRET_ACCESS_KEY || "";
    const envVars = {
      AWS_ENDPOINT_URL_S3: process.env.AWS_ENDPOINT_URL_S3 || "(not set)",
      AWS_ACCESS_KEY_ID_len: rawKey.length,
      AWS_ACCESS_KEY_ID_val: rawKey.slice(0, 8) + "...",
      AWS_ACCESS_KEY_ID_hasSpaces: rawKey !== rawKey.trim(),
      AWS_SECRET_ACCESS_KEY_len: rawSecret.length,
      AWS_SECRET_ACCESS_KEY_hasSpaces: rawSecret !== rawSecret.trim(),
      AWS_STORAGE_BUCKET_NAME: process.env.AWS_STORAGE_BUCKET_NAME || "(not set)",
      MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL || "(not set)",
    };
    let listResult: any = null;
    let listError: string | null = null;
    // Also try with trimmed credentials
    let listErrorTrimmed: string | null = null;
    try {
      listResult = await (s3Client as any).send(new ListBucketsCommand({}));
    } catch (e: any) {
      listError = e?.message ?? String(e);
    }
    // Check uploads directory
    const fs = await import("fs");
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    let uploadDirExists = false;
    let uploadFiles: string[] = [];
    try {
      uploadDirExists = fs.existsSync(uploadDir);
      if (uploadDirExists) {
        const riDir = path.join(uploadDir, "rechazos-internos");
        if (fs.existsSync(riDir)) {
          uploadFiles = fs.readdirSync(riDir).slice(0, 10);
        }
      }
    } catch (e: any) { /* ignore */ }

    // Test write
    let canWrite = false;
    try {
      const testPath = path.join(uploadDir, "diag-test.txt");
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(testPath, "ok");
      fs.unlinkSync(testPath);
      canWrite = true;
    } catch (e: any) { /* ignore */ }

    res.json({ envVars, listResult, listError, listErrorTrimmed, cwd: process.cwd(), uploadDirExists, canWrite, uploadFiles });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
});

// POST /api/catalogo-sku/seed — bulk insert SKU records (token protected)
app.post("/api/catalogo-sku/seed", async (req: Request, res: Response) => {
  const token = req.headers["x-seed-token"];
  if (token !== "mi-sku-seed-2026-qc") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const records: Array<{ sku: string; marca: string; modelo: string; pulgada: string; descripcion: string }> = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "Body must be a non-empty array" });
  }
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of records) {
        await client.query(
          `INSERT INTO catalogo_sku (sku, marca, modelo, pulgada, descripcion)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (sku) DO UPDATE SET marca=$2, modelo=$3, pulgada=$4, descripcion=$5`,
          [r.sku, r.marca ?? "", r.modelo ?? "", r.pulgada ?? "", r.descripcion ?? ""]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    res.json({ inserted: records.length });
  } catch (err) {
    console.error("[API] POST /api/catalogo-sku/seed error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/catalogo-sku?q=... - Search SKU prefix
app.get("/api/catalogo-sku", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT sku, marca, modelo, pulgada, descripcion FROM catalogo_sku WHERE UPPER(sku) LIKE UPPER($1) LIMIT 25`,
      [`${q}%`]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[API] GET /api/catalogo-sku error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/catalogo-sku/:sku - Get exact SKU
app.get("/api/catalogo-sku/:sku", async (req: Request, res: Response) => {
  try {
    const { sku } = req.params;

    const result = await pool.query(
      `SELECT marca, modelo, descripcion, pulgada FROM catalogo_sku WHERE UPPER(sku) = UPPER($1) LIMIT 1`,
      [sku]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "SKU not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("[API] GET /api/catalogo-sku/:sku error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── RECHAZOS EXTERNOS ──────────────────────────────────────────

// GET /api/rechazos-externos - List with pagination, estatus filter and search
app.get("/api/rechazos-externos", requireAuth, async (req: Request, res: Response) => {
  try {
    const page    = Math.max(1, parseInt(String(req.query.page  || "1")));
    const limit   = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "20"))));
    const offset  = (page - 1) * limit;
    const estatus = String(req.query.estatus || "").trim();
    const search  = String(req.query.search  || "").trim();

    const conditions: string[] = [];
    const params: any[]        = [];
    let idx = 1;

    if (estatus) {
      conditions.push(`re.estatus = $${idx++}`);
      params.push(estatus);
    }
    if (search) {
      conditions.push(`(re.return_order ILIKE $${idx} OR re.license_plate ILIKE $${idx} OR re.classification ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM rechazos_externos re ${where}`, params),
      pool.query(
        `SELECT re.*,
                COUNT(DISTINCT rpd.id)  AS cnt_problemas,
                COUNT(DISTINCT rca.id)  AS cnt_acciones,
                COUNT(DISTINCT rim.id)  AS cnt_images
         FROM rechazos_externos re
         LEFT JOIN re_problem_descriptions rpd ON rpd.rechazo_id = re.id
         LEFT JOIN re_corrective_actions   rca ON rca.rechazo_id = re.id
         LEFT JOIN re_images               rim ON rim.rechazo_id = re.id
         ${where}
         GROUP BY re.id
         ORDER BY re.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      data:  dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error("[API] GET /api/rechazos-externos error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/rechazos-externos/:id - Get external reject with related data
app.get("/api/rechazos-externos/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reId = parseInt(id);

    const reMain = await db
      .select()
      .from(schema.rechazosExternos)
      .where(eq(schema.rechazosExternos.id, reId))
      .limit(1);

    if (reMain.length === 0) {
      return res.status(404).json({ error: "Rechazo no encontrado" });
    }

    const [problemDescriptions, correctiveActions, images] = await Promise.all([
      db
        .select()
        .from(schema.reProblemDescriptions)
        .where(eq(schema.reProblemDescriptions.rechazoId, reId))
        .orderBy(schema.reProblemDescriptions.orden),
      db
        .select()
        .from(schema.reCorrectiveActions)
        .where(eq(schema.reCorrectiveActions.rechazoId, reId))
        .orderBy(schema.reCorrectiveActions.orden),
      db
        .select()
        .from(schema.reImages)
        .where(eq(schema.reImages.rechazoId, reId)),
    ]);

    res.json({
      ...reMain[0],
      problem_descriptions: problemDescriptions,
      corrective_actions: correctiveActions,
      images: images.map((img) => ({
        ...img,
        url: img.url || s3.getFileUrl("rechazos-externos", img.filename),
      })),
    });
  } catch (err) {
    console.error("[API] GET /api/rechazos-externos/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rechazos-externos - Create external reject (with transaction)
app.post("/api/rechazos-externos", requireAuth, async (req: Request, res: Response) => {
  const client = await getClient();
  try {
    await beginTransaction(client);

    const {
      return_order,
      license_plate,
      classification,
      inches,
      sales_channel,
      sku,
      brand,
      plant_entry,
      plant_exit,
      outbound_order,
      processed_by,
      registration_date,
      sale_price,
      problem_descriptions,
      corrective_actions,
    } = req.body;

    // Compute total_time_minutes server-side so it is consistent with stored timestamps
    let totalTimeMinutes: number | null = null;
    if (plant_entry && plant_exit) {
      const diffMs = new Date(plant_exit).getTime() - new Date(plant_entry).getTime();
      if (!isNaN(diffMs) && diffMs >= 0) {
        totalTimeMinutes = Math.round(diffMs / 60000);
      }
    }

    // Insert main rechazo_externo
    const reResult = await client.query(
      `INSERT INTO rechazos_externos
        (return_order, license_plate, classification, inches, sales_channel, sku, brand,
         plant_entry, plant_exit, total_time_minutes, outbound_order, processed_by,
         registration_date, sale_price, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, return_order, license_plate, classification, inches, sales_channel, sku, brand,
                 plant_entry, plant_exit, total_time_minutes, outbound_order, processed_by,
                 registration_date, sale_price`,
      [
        return_order,
        license_plate,
        classification || "",
        inches || "",
        sales_channel || "",
        sku || "",
        brand || "",
        plant_entry,
        plant_exit || null,
        totalTimeMinutes,
        outbound_order || "",
        processed_by || "",
        registration_date || null,
        sale_price != null && sale_price !== "" ? sale_price : null,
        req.user?.name || "",
      ]
    );

    const reId = reResult.rows[0].id;

    // Insert problem descriptions
    if (problem_descriptions && Array.isArray(problem_descriptions)) {
      for (const pd of problem_descriptions) {
        await client.query(
          `INSERT INTO re_problem_descriptions (rechazo_id, orden, descripcion) VALUES ($1, $2, $3)`,
          [reId, pd.orden || 1, pd.descripcion || ""]
        );
      }
    }

    // Insert corrective actions
    if (corrective_actions && Array.isArray(corrective_actions)) {
      for (const ca of corrective_actions) {
        await client.query(
          `INSERT INTO re_corrective_actions (rechazo_id, departamento, orden, accion) VALUES ($1, $2, $3, $4)`,
          [reId, ca.departamento || "", ca.orden || 1, ca.accion || ""]
        );
      }
    }

    await commitTransaction(client);

    res.json({ id: reId, ...reResult.rows[0] });
  } catch (err) {
    await rollbackTransaction(client);
    console.error("[API] POST /api/rechazos-externos error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// PUT /api/rechazos-externos/:id - Update external reject (with transaction)
app.put("/api/rechazos-externos/:id", requireAuth, async (req: Request, res: Response) => {
  const client = await getClient();
  try {
    await beginTransaction(client);

    const { id } = req.params;
    const reId = parseInt(id);

    const {
      return_order,
      license_plate,
      classification,
      inches,
      sales_channel,
      sku,
      brand,
      plant_entry,
      plant_exit,
      outbound_order,
      processed_by,
      registration_date,
      sale_price,
      problem_descriptions,
      corrective_actions,
    } = req.body;

    // Compute total_time_minutes server-side so it stays consistent with plant_entry/plant_exit
    let totalTimeMinutes: number | null = null;
    if (plant_entry && plant_exit) {
      const diffMs = new Date(plant_exit).getTime() - new Date(plant_entry).getTime();
      if (!isNaN(diffMs) && diffMs >= 0) {
        totalTimeMinutes = Math.round(diffMs / 60000);
      }
    }

    // Update main record
    const updateResult = await client.query(
      `UPDATE rechazos_externos
       SET return_order=$1, license_plate=$2, classification=$3, inches=$4, sales_channel=$5, sku=$6,
           brand=$7, plant_entry=$8, plant_exit=$9, total_time_minutes=$10, outbound_order=$11,
           processed_by=$12, registration_date=$13, sale_price=$14
       WHERE id=$15
       RETURNING *`,
      [
        return_order,
        license_plate,
        classification || "",
        inches || "",
        sales_channel || "",
        sku || "",
        brand || "",
        plant_entry,
        plant_exit || null,
        totalTimeMinutes,
        outbound_order || "",
        processed_by || "",
        registration_date || null,
        sale_price != null && sale_price !== "" ? sale_price : null,
        reId,
      ]
    );

    if (updateResult.rowCount === 0) {
      throw new Error("Rechazo no encontrado");
    }

    // Delete old related records
    await client.query("DELETE FROM re_problem_descriptions WHERE rechazo_id=$1", [reId]);
    await client.query("DELETE FROM re_corrective_actions WHERE rechazo_id=$1", [reId]);

    // Insert new problem descriptions
    if (problem_descriptions && Array.isArray(problem_descriptions)) {
      for (const pd of problem_descriptions) {
        await client.query(
          `INSERT INTO re_problem_descriptions (rechazo_id, orden, descripcion) VALUES ($1, $2, $3)`,
          [reId, pd.orden || 1, pd.descripcion || ""]
        );
      }
    }

    // Insert new corrective actions
    if (corrective_actions && Array.isArray(corrective_actions)) {
      for (const ca of corrective_actions) {
        await client.query(
          `INSERT INTO re_corrective_actions (rechazo_id, departamento, orden, accion) VALUES ($1, $2, $3, $4)`,
          [reId, ca.departamento || "", ca.orden || 1, ca.accion || ""]
        );
      }
    }

    await commitTransaction(client);

    res.json(updateResult.rows[0]);
  } catch (err) {
    await rollbackTransaction(client);
    console.error("[API] PUT /api/rechazos-externos/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// POST /api/rechazos-externos/:id/images - Upload images to S3
app.post(
  "/api/rechazos-externos/:id/images",
  requireAuth,
  upload.array("images", 10),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reId = parseInt(id);
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      const uploadedUrls: string[] = [];

      for (const file of files) {
        let finalUrl: string;
        let dataB64: string | null = null;
        let filename: string;

        try {
          const s3Url = await s3.uploadToS3Only(file.buffer, file.originalname, "rechazos-externos", `re-${reId}`);
          filename = s3Url.split("/").pop() || file.originalname;
          finalUrl = s3Url;
        } catch (_s3Err) {
          const ext = file.originalname.split(".").pop() || "jpg";
          filename = `re-${reId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          dataB64 = file.buffer.toString("base64");
          finalUrl = "db:pending";
        }

        const inserted = await db.insert(schema.reImages).values({
          rechazoId: reId,
          filename,
          url: finalUrl === "db:pending" ? "/api/re/image/0" : finalUrl,
          dataB64,
        }).returning({ id: schema.reImages.id });

        if (finalUrl === "db:pending" && inserted[0]) {
          finalUrl = `/api/re/image/${inserted[0].id}`;
          await db.update(schema.reImages).set({ url: finalUrl }).where(eq(schema.reImages.id, inserted[0].id));
        }

        uploadedUrls.push(finalUrl);
      }

      res.json({ images: uploadedUrls });
    } catch (err) {
      console.error("[API] POST /api/rechazos-externos/:id/images error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/re/image/:imgId — serve RE image stored in DB
app.get("/api/re/image/:imgId", requireAuth, async (req: Request, res: Response) => {
  try {
    const [img] = await db
      .select({ filename: schema.reImages.filename, dataB64: schema.reImages.dataB64 })
      .from(schema.reImages)
      .where(eq(schema.reImages.id, parseInt(req.params.imgId)));
    if (!img || !img.dataB64) return res.status(404).json({ error: "Image not found" });
    const ext = (img.filename.split(".").pop() || "jpg").toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(Buffer.from(img.dataB64, "base64"));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/rechazos-externos/:id/images/:imageId - Delete image
app.delete(
  "/api/rechazos-externos/:id/images/:imageId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { imageId } = req.params;

      const imageRecord = await db
        .select()
        .from(schema.reImages)
        .where(eq(schema.reImages.id, parseInt(imageId)))
        .limit(1);

      if (imageRecord.length === 0) {
        return res.status(404).json({ error: "Image not found" });
      }

      // Delete from S3
      await s3.deleteFileFromS3(
        `rechazos-externos/${imageRecord[0].filename}`
      );

      // Delete from database
      await db
        .delete(schema.reImages)
        .where(eq(schema.reImages.id, parseInt(imageId)));

      res.json({ ok: true });
    } catch (err) {
      console.error("[API] DELETE /api/rechazos-externos/:id/images/:imageId error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// DELETE /api/rechazos-externos/:id - Delete external reject
app.delete("/api/rechazos-externos/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reId = parseInt(id);

    // Get all images to delete from S3
    const images = await db
      .select()
      .from(schema.reImages)
      .where(eq(schema.reImages.rechazoId, reId));

    for (const img of images) {
      await s3.deleteFileFromS3(`rechazos-externos/${img.filename}`);
    }

    // Delete all related records (cascade)
    await db
      .delete(schema.reImages)
      .where(eq(schema.reImages.rechazoId, reId));

    await db
      .delete(schema.reProblemDescriptions)
      .where(eq(schema.reProblemDescriptions.rechazoId, reId));

    await db
      .delete(schema.reCorrectiveActions)
      .where(eq(schema.reCorrectiveActions.rechazoId, reId));

    // Delete main record
    await db
      .delete(schema.rechazosExternos)
      .where(eq(schema.rechazosExternos.id, reId));

    res.json({ ok: true });
  } catch (err) {
    console.error("[API] DELETE /api/rechazos-externos/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── RECHAZOS INTERNOS ──────────────────────────────────────────

// GET /api/rechazos-internos - List internal rejects
app.get("/api/rechazos-internos", requireAuth, async (req: Request, res: Response) => {
  try {
    const estatus  = req.query.estatus  as string | undefined;
    const search   = req.query.search   as string | undefined;
    const page     = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit    = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset   = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (estatus) {
      params.push(estatus);
      conditions.push(`ri.estatus = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conditions.push(`(ri.license_plate ILIKE $${n} OR ri.sku ILIKE $${n} OR ri.defecto ILIKE $${n})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM rechazos_internos ri ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT ri.*, COUNT(DISTINCT rii.id) as images_count
       FROM rechazos_internos ri
       LEFT JOIN ri_images rii ON rii.rechazo_id = ri.id
       ${where}
       GROUP BY ri.id
       ORDER BY ri.fecha_registro DESC, ri.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: dataResult.rows, total, page, limit });
  } catch (err) {
    console.error("[API] GET /api/rechazos-internos error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/rechazos-internos/:id - Get internal reject with images
app.get("/api/rechazos-internos/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const riId = parseInt(id);

    const [riMain, images] = await Promise.all([
      db
        .select()
        .from(schema.rechazosInternos)
        .where(eq(schema.rechazosInternos.id, riId))
        .limit(1),
      db
        .select()
        .from(schema.riImages)
        .where(eq(schema.riImages.rechazoId, riId)),
    ]);

    if (riMain.length === 0) {
      return res.status(404).json({ error: "Rechazo no encontrado" });
    }

    const ri = riMain[0];
    res.json({
      ...ri,
      firma_url: ri.firmaUrl || (ri.firmaFilename ? s3.getFileUrl("rechazos-internos", ri.firmaFilename) : null),
      images: images.map((img) => ({
        ...img,
        url: img.url || s3.getFileUrl("rechazos-internos", img.filename),
      })),
    });
  } catch (err) {
    console.error("[API] GET /api/rechazos-internos/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rechazos-internos - Create internal reject
app.post("/api/rechazos-internos", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      fecha_registro,
      license_plate,
      sku,
      marca,
      modelo,
      pulgada,
      descripcion,
      defecto,
      actividad_realizar,
      costo_no_calidad,
      origen_hallazgo,
      inspector,
    } = req.body;

    const result = await db
      .insert(schema.rechazosInternos)
      .values({
        fechaRegistro: fecha_registro,
        licensePlate: license_plate,
        sku: sku || "",
        marca: marca || "",
        modelo: modelo || "",
        pulgada: pulgada || "",
        descripcion: descripcion || "",
        defecto,
        actividadRealizar: actividad_realizar || "",
        costoNoCalidad: costo_no_calidad || "0",
        origenHallazgo: origen_hallazgo || "",
        inspector: inspector || "",
        registradoPor: req.user?.name || "",
      })
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] POST /api/rechazos-internos error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/rechazos-internos/:id - Update internal reject
app.put("/api/rechazos-internos/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fecha_registro,
      license_plate,
      sku,
      marca,
      modelo,
      pulgada,
      descripcion,
      defecto,
      actividad_realizar,
      costo_no_calidad,
      origen_hallazgo,
      inspector,
    } = req.body;

    const result = await db
      .update(schema.rechazosInternos)
      .set({
        fechaRegistro: fecha_registro,
        licensePlate: license_plate,
        sku: sku || "",
        marca: marca || "",
        modelo: modelo || "",
        pulgada: pulgada || "",
        descripcion: descripcion || "",
        defecto,
        actividadRealizar: actividad_realizar || "",
        costoNoCalidad: costo_no_calidad || "0",
        origenHallazgo: origen_hallazgo || "",
        inspector: inspector || "",
      })
      .where(eq(schema.rechazosInternos.id, parseInt(id)))
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] PUT /api/rechazos-internos/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rechazos-internos/:id/images - Upload RI images
app.post(
  "/api/rechazos-internos/:id/images",
  requireAuth,
  upload.array("images", 10),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const riId = parseInt(id);
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      const uploadedUrls: string[] = [];

      for (const file of files) {
        let finalUrl: string;
        let dataB64: string | null = null;
        let filename: string;

        try {
          // Try S3 first
          const s3Url = await s3.uploadToS3Only(
            file.buffer,
            file.originalname,
            "rechazos-internos",
            `ri-${riId}`
          );
          filename = s3Url.split("/").pop() || file.originalname;
          finalUrl = s3Url;
        } catch (_s3Err) {
          // S3 failed — store image in DB as base64
          const ext = file.originalname.split(".").pop() || "jpg";
          const ts = Date.now();
          const rand = Math.random().toString(36).slice(2, 8);
          filename = `ri-${riId}-${ts}-${rand}.${ext}`;
          dataB64 = file.buffer.toString("base64");
          finalUrl = "db:pending"; // placeholder, updated after insert
        }

        const inserted = await db.insert(schema.riImages).values({
          rechazoId: riId,
          filename,
          url: finalUrl === "db:pending" ? "/api/ri/image/0" : finalUrl,
          dataB64,
        }).returning({ id: schema.riImages.id });

        if (finalUrl === "db:pending" && inserted[0]) {
          const imgId = inserted[0].id;
          finalUrl = `/api/ri/image/${imgId}`;
          await db.update(schema.riImages)
            .set({ url: finalUrl })
            .where(eq(schema.riImages.id, imgId));
        }

        uploadedUrls.push(finalUrl);
      }

      res.json({ images: uploadedUrls });
    } catch (err) {
      console.error("[API] POST /api/rechazos-internos/:id/images error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/rechazos-internos/:id/firma - Upload signature
app.post(
  "/api/rechazos-internos/:id/firma",
  requireAuth,
  upload.single("firma"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const riId = parseInt(id);
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Get current record to delete old firma
      const current = await db
        .select()
        .from(schema.rechazosInternos)
        .where(eq(schema.rechazosInternos.id, riId))
        .limit(1);

      if (current.length > 0 && current[0].firmaFilename) {
        await s3.deleteFileFromS3(`rechazos-internos/${current[0].firmaFilename}`);
      }

      // Upload new firma
      let firmaUrl: string;
      let firmaDataB64: string | null = null;
      let firmaFilename: string;

      try {
        const s3Url = await s3.uploadToS3Only(file.buffer, file.originalname, "rechazos-internos", `firma-${riId}`);
        firmaFilename = s3Url.split("/").pop() || file.originalname;
        firmaUrl = s3Url;
      } catch (_s3Err) {
        const ext = file.originalname.split(".").pop() || "jpg";
        firmaFilename = `firma-${riId}-${Date.now()}.${ext}`;
        firmaDataB64 = file.buffer.toString("base64");
        firmaUrl = `/api/ri/firma-image/${riId}`;
      }

      await db
        .update(schema.rechazosInternos)
        .set({ firmaFilename, firmaUrl, firmaDataB64 })
        .where(eq(schema.rechazosInternos.id, riId));

      res.json({ firma: firmaUrl });
    } catch (err) {
      console.error("[API] POST /api/rechazos-internos/:id/firma error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/ri/firma-image/:riId — serve RI signature stored in DB
app.get("/api/ri/firma-image/:riId", requireAuth, async (req: Request, res: Response) => {
  try {
    const [ri] = await db
      .select({ firmaFilename: schema.rechazosInternos.firmaFilename, firmaDataB64: schema.rechazosInternos.firmaDataB64 })
      .from(schema.rechazosInternos)
      .where(eq(schema.rechazosInternos.id, parseInt(req.params.riId)));
    if (!ri || !ri.firmaDataB64) return res.status(404).json({ error: "Firma not found" });
    const ext = (ri.firmaFilename.split(".").pop() || "jpg").toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(Buffer.from(ri.firmaDataB64, "base64"));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/ri/image/:imgId — serve image stored in DB (base64 column)
app.get("/api/ri/image/:imgId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { imgId } = req.params;
    const [img] = await db
      .select({ filename: schema.riImages.filename, dataB64: schema.riImages.dataB64 })
      .from(schema.riImages)
      .where(eq(schema.riImages.id, parseInt(imgId)));

    if (!img || !img.dataB64) {
      return res.status(404).json({ error: "Image not found" });
    }

    const buf = Buffer.from(img.dataB64, "base64");
    const ext = (img.filename.split(".").pop() || "jpg").toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(buf);
  } catch (err) {
    console.error("[API] GET /api/ri/image/:imgId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/rechazos-internos/:id/images/:imgId - Delete image
app.delete(
  "/api/rechazos-internos/:id/images/:imgId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { imgId } = req.params;

      const imageRecord = await db
        .select()
        .from(schema.riImages)
        .where(eq(schema.riImages.id, parseInt(imgId)))
        .limit(1);

      if (imageRecord.length === 0) {
        return res.status(404).json({ error: "Image not found" });
      }

      await s3.deleteFileFromS3(
        `rechazos-internos/${imageRecord[0].filename}`
      );

      await db
        .delete(schema.riImages)
        .where(eq(schema.riImages.id, parseInt(imgId)));

      res.json({ ok: true });
    } catch (err) {
      console.error("[API] DELETE /api/rechazos-internos/:id/images/:imgId error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// DELETE /api/rechazos-internos/:id - Delete internal reject
app.delete("/api/rechazos-internos/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const riId = parseInt(id);

    // Get all images and firma to delete
    const [images, riData] = await Promise.all([
      db
        .select()
        .from(schema.riImages)
        .where(eq(schema.riImages.rechazoId, riId)),
      db
        .select()
        .from(schema.rechazosInternos)
        .where(eq(schema.rechazosInternos.id, riId))
        .limit(1),
    ]);

    // Delete images from S3
    for (const img of images) {
      await s3.deleteFileFromS3(`rechazos-internos/${img.filename}`);
    }

    // Delete firma from S3
    if (riData.length > 0 && riData[0].firmaFilename) {
      await s3.deleteFileFromS3(`rechazos-internos/${riData[0].firmaFilename}`);
    }

    // Delete all related records
    await db
      .delete(schema.riImages)
      .where(eq(schema.riImages.rechazoId, riId));

    // ri_images has ON DELETE CASCADE, so main delete will cascade
    await db
      .delete(schema.rechazosInternos)
      .where(eq(schema.rechazosInternos.id, riId));

    res.json({ ok: true });
  } catch (err) {
    console.error("[API] DELETE /api/rechazos-internos/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── AQL ────────────────────────────────────────────────────────

// GET /api/aql - List AQL registros (paginado, filtrado, con conteos)
app.get("/api/aql", requireAuth, async (req: Request, res: Response) => {
  try {
    const page     = Math.max(1, parseInt(String(req.query.page  || "1")));
    const limit    = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "20"))));
    const offset   = (page - 1) * limit;
    const estado   = String(req.query.estado || "").trim();
    const search   = String(req.query.search || "").trim();

    const conditions: string[] = [];
    const params: any[]        = [];
    let idx = 1;

    if (estado && estado !== "Todas") {
      conditions.push(`estado_aql = $${idx++}`);
      params.push(estado);
    }
    if (search) {
      conditions.push(`(order_id ILIKE $${idx} OR license_plate ILIKE $${idx} OR sku ILIKE $${idx} OR lote ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRes, dataRes, countsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM aql_registros ${where}`, params),
      pool.query(
        `SELECT * FROM aql_registros ${where} ORDER BY fecha_registro DESC, created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT estado_aql, COUNT(*) AS cnt FROM aql_registros GROUP BY estado_aql`
      ),
    ]);

    const total = parseInt(countRes.rows[0].count);
    const cMap  = Object.fromEntries(countsRes.rows.map((r: any) => [r.estado_aql, parseInt(r.cnt)]));
    const counts = {
      todas:     total,
      aceptado:  cMap["Aceptado"]  || 0,
      rechazado: cMap["Rechazado"] || 0,
    };

    const data = dataRes.rows.map((r: any) => ({
      ...r,
      checklist: r.checklist_json ? (() => { try { return JSON.parse(r.checklist_json); } catch { return []; } })() : [],
      foto_lpn_url:      r.foto_lpn_url      || (r.foto_lpn_filename      ? s3.getFileUrl("aql", r.foto_lpn_filename)      : null),
      foto_pantalla_url: r.foto_pantalla_url || (r.foto_pantalla_filename ? s3.getFileUrl("aql", r.foto_pantalla_filename) : null),
    }));

    res.json({ data, total, page, pageSize: limit, counts });
  } catch (err) {
    console.error("[API] GET /api/aql error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/aql/:id - Get AQL record
app.get("/api/aql/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db
      .select()
      .from(schema.aqlRegistros)
      .where(eq(schema.aqlRegistros.id, parseInt(id)))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const aql = result[0];
    res.json({
      ...aql,
      checklist: aql.checklistJson ? (() => { try { return JSON.parse(aql.checklistJson as string); } catch { return []; } })() : [],
      foto_lpn_url:      aql.fotoLpnUrl      || (aql.fotoLpnFilename      ? s3.getFileUrl("aql", aql.fotoLpnFilename)      : null),
      foto_pantalla_url: aql.fotoPantallaUrl || (aql.fotoPantallaFilename ? s3.getFileUrl("aql", aql.fotoPantallaFilename) : null),
    });
  } catch (err) {
    console.error("[API] GET /api/aql/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/aql - Create AQL record
app.post("/api/aql", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      fecha_registro, order_id, sku, marca, modelo, pulgada, descripcion,
      lote, muestra_total, defectos_encontrados, observaciones, checklist, inspector,
    } = req.body;

    const defectos   = parseInt(defectos_encontrados) || 0;
    const estadoAql  = defectos === 0 ? "Aceptado" : "Rechazado";

    const result = await db
      .insert(schema.aqlRegistros)
      .values({
        fechaRegistro:        fecha_registro,
        licensePlate:         order_id || "",
        orderId:              order_id || "",
        sku:                  sku || "",
        marca:                marca || "",
        modelo:               modelo || "",
        pulgada:              pulgada || "",
        descripcion:          descripcion || "",
        lote:                 lote || "",
        muestraTotal:         muestra_total ? parseInt(muestra_total) : null,
        defectosEncontrados:  defectos,
        observaciones:        observaciones || "",
        checklistJson:        checklist ? JSON.stringify(checklist) : null,
        estadoAql,
        inspector:            inspector || req.user?.name || "",
        registradoPor:        req.user?.name || "",
      })
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] POST /api/aql error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/aql/:id - Update AQL record
app.put("/api/aql/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fecha_registro, order_id, sku, marca, modelo, pulgada, descripcion,
      lote, muestra_total, defectos_encontrados, observaciones, checklist, inspector,
    } = req.body;

    const defectos  = parseInt(defectos_encontrados) || 0;
    const estadoAql = defectos === 0 ? "Aceptado" : "Rechazado";

    const result = await db
      .update(schema.aqlRegistros)
      .set({
        fechaRegistro:        fecha_registro,
        licensePlate:         order_id || "",
        orderId:              order_id || "",
        sku:                  sku || "",
        marca:                marca || "",
        modelo:               modelo || "",
        pulgada:              pulgada || "",
        descripcion:          descripcion || "",
        lote:                 lote || "",
        muestraTotal:         muestra_total ? parseInt(muestra_total) : null,
        defectosEncontrados:  defectos,
        observaciones:        observaciones || "",
        checklistJson:        checklist ? JSON.stringify(checklist) : null,
        estadoAql,
        inspector:            inspector || "",
      })
      .where(eq(schema.aqlRegistros.id, parseInt(id)))
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] PUT /api/aql/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/aql/:id/foto-lpn - Upload LPN photo
app.post(
  "/api/aql/:id/foto-lpn",
  requireAuth,
  upload.single("foto"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const aqlId = parseInt(id);
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Get current record
      const current = await db
        .select()
        .from(schema.aqlRegistros)
        .where(eq(schema.aqlRegistros.id, aqlId))
        .limit(1);

      if (current.length > 0 && current[0].fotoLpnFilename) {
        await s3.deleteFileFromS3(`aql/${current[0].fotoLpnFilename}`);
      }

      let fotoLpnUrl: string;
      let fotoLpnDataB64: string | null = null;
      let fotoLpnFilename: string;

      try {
        const s3Url = await s3.uploadToS3Only(file.buffer, file.originalname, "aql", `lpn-${aqlId}`);
        fotoLpnFilename = s3Url.split("/").pop() || file.originalname;
        fotoLpnUrl = s3Url;
      } catch (_s3Err) {
        const ext = file.originalname.split(".").pop() || "jpg";
        fotoLpnFilename = `lpn-${aqlId}-${Date.now()}.${ext}`;
        fotoLpnDataB64 = file.buffer.toString("base64");
        fotoLpnUrl = `/api/aql/image/lpn/${aqlId}`;
      }

      await db
        .update(schema.aqlRegistros)
        .set({ fotoLpnFilename, fotoLpnUrl, fotoLpnDataB64 })
        .where(eq(schema.aqlRegistros.id, aqlId));

      res.json({ foto_lpn: fotoLpnUrl });
    } catch (err) {
      console.error("[API] POST /api/aql/:id/foto-lpn error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/aql/:id/foto-pantalla - Upload screen photo
app.post(
  "/api/aql/:id/foto-pantalla",
  requireAuth,
  upload.single("foto"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const aqlId = parseInt(id);
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const current = await db
        .select()
        .from(schema.aqlRegistros)
        .where(eq(schema.aqlRegistros.id, aqlId))
        .limit(1);

      if (current.length > 0 && current[0].fotoPantallaFilename) {
        await s3.deleteFileFromS3(`aql/${current[0].fotoPantallaFilename}`);
      }

      let fotoPantallaUrl: string;
      let fotoPantallaDataB64: string | null = null;
      let fotoPantallaFilename: string;

      try {
        const s3Url = await s3.uploadToS3Only(file.buffer, file.originalname, "aql", `pantalla-${aqlId}`);
        fotoPantallaFilename = s3Url.split("/").pop() || file.originalname;
        fotoPantallaUrl = s3Url;
      } catch (_s3Err) {
        const ext = file.originalname.split(".").pop() || "jpg";
        fotoPantallaFilename = `pantalla-${aqlId}-${Date.now()}.${ext}`;
        fotoPantallaDataB64 = file.buffer.toString("base64");
        fotoPantallaUrl = `/api/aql/image/pantalla/${aqlId}`;
      }

      await db
        .update(schema.aqlRegistros)
        .set({ fotoPantallaFilename, fotoPantallaUrl, fotoPantallaDataB64 })
        .where(eq(schema.aqlRegistros.id, aqlId));

      res.json({ foto_pantalla: fotoPantallaUrl });
    } catch (err) {
      console.error("[API] POST /api/aql/:id/foto-pantalla error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/aql/image/lpn/:aqlId — serve LPN photo stored in DB
app.get("/api/aql/image/lpn/:aqlId", requireAuth, async (req: Request, res: Response) => {
  try {
    const [aql] = await db
      .select({ fotoLpnFilename: schema.aqlRegistros.fotoLpnFilename, fotoLpnDataB64: schema.aqlRegistros.fotoLpnDataB64 })
      .from(schema.aqlRegistros)
      .where(eq(schema.aqlRegistros.id, parseInt(req.params.aqlId)));
    if (!aql || !aql.fotoLpnDataB64) return res.status(404).json({ error: "Image not found" });
    const ext = (aql.fotoLpnFilename.split(".").pop() || "jpg").toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(Buffer.from(aql.fotoLpnDataB64, "base64"));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/aql/image/pantalla/:aqlId — serve screen photo stored in DB
app.get("/api/aql/image/pantalla/:aqlId", requireAuth, async (req: Request, res: Response) => {
  try {
    const [aql] = await db
      .select({ fotoPantallaFilename: schema.aqlRegistros.fotoPantallaFilename, fotoPantallaDataB64: schema.aqlRegistros.fotoPantallaDataB64 })
      .from(schema.aqlRegistros)
      .where(eq(schema.aqlRegistros.id, parseInt(req.params.aqlId)));
    if (!aql || !aql.fotoPantallaDataB64) return res.status(404).json({ error: "Image not found" });
    const ext = (aql.fotoPantallaFilename.split(".").pop() || "jpg").toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(Buffer.from(aql.fotoPantallaDataB64, "base64"));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/aql/:id - Delete AQL record
app.delete("/api/aql/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const aqlId = parseInt(id);

    const aqlRecord = await db
      .select()
      .from(schema.aqlRegistros)
      .where(eq(schema.aqlRegistros.id, aqlId))
      .limit(1);

    if (aqlRecord.length > 0) {
      if (aqlRecord[0].fotoLpnFilename) {
        await s3.deleteFileFromS3(`aql/${aqlRecord[0].fotoLpnFilename}`);
      }
      if (aqlRecord[0].fotoPantallaFilename) {
        await s3.deleteFileFromS3(`aql/${aqlRecord[0].fotoPantallaFilename}`);
      }
    }

    await db
      .delete(schema.aqlRegistros)
      .where(eq(schema.aqlRegistros.id, aqlId));

    res.json({ ok: true });
  } catch (err) {
    console.error("[API] DELETE /api/aql/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── CAPAS (Acciones Correctivas) ───────────────────────────────

// GET /api/capas - List CAPAS with origen_ref
app.get("/api/capas", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        c.*,
        CASE c.origen_tipo
          WHEN 'nc' THEN (SELECT CONCAT('NC — ', area, ' / ', tipo) FROM no_conformidades WHERE id = c.origen_id LIMIT 1)
          WHEN 're' THEN (SELECT CONCAT('RE — ', license_plate) FROM rechazos_externos WHERE id = c.origen_id LIMIT 1)
          ELSE 'Desconocido'
        END AS origen_ref
      FROM capas c
      ORDER BY c.fecha_apertura DESC, c.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("[API] GET /api/capas error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/capas/:id - Get CAPA with all related data
app.get("/api/capas/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const capaId = parseInt(id);

    const [capaMain, porques, ishikawa, acciones] = await Promise.all([
      db
        .select()
        .from(schema.capas)
        .where(eq(schema.capas.id, capaId))
        .limit(1),
      db
        .select()
        .from(schema.capa5Porques)
        .where(eq(schema.capa5Porques.capaId, capaId))
        .orderBy(schema.capa5Porques.orden),
      db
        .select()
        .from(schema.capaIshikawa)
        .where(eq(schema.capaIshikawa.capaId, capaId)),
      db
        .select()
        .from(schema.capaAcciones)
        .where(eq(schema.capaAcciones.capaId, capaId)),
    ]);

    if (capaMain.length === 0) {
      return res.status(404).json({ error: "CAPA no encontrada" });
    }

    res.json({
      ...capaMain[0],
      porques,
      ishikawa,
      acciones,
    });
  } catch (err) {
    console.error("[API] GET /api/capas/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/capas - Create CAPA (with transaction)
app.post("/api/capas", requireAuth, async (req: Request, res: Response) => {
  const client = await getClient();
  try {
    await beginTransaction(client);

    const {
      origen_tipo,
      origen_id,
      titulo,
      descripcion_problema,
      metodo_analisis,
      responsable,
      fecha_apertura,
      fecha_compromiso,
      porques,
      ishikawa,
      acciones,
    } = req.body;

    // Insert main CAPA
    const capaResult = await client.query(
      `INSERT INTO capas
        (origen_tipo, origen_id, titulo, descripcion_problema, metodo_analisis, responsable,
         fecha_apertura, fecha_compromiso, estatus, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Abierta', $9)
       RETURNING id, origen_tipo, origen_id, titulo, descripcion_problema, metodo_analisis,
                 responsable, fecha_apertura, fecha_compromiso, estatus`,
      [
        origen_tipo,
        origen_id,
        titulo || "",
        descripcion_problema || "",
        metodo_analisis,
        responsable || "",
        fecha_apertura,
        fecha_compromiso || null,
        req.user?.name || "",
      ]
    );

    const capaId = capaResult.rows[0].id;

    // Insert 5 porques if applicable
    if (metodo_analisis === "5porques" && porques && Array.isArray(porques)) {
      for (const pq of porques) {
        await client.query(
          `INSERT INTO capa_5porques (capa_id, orden, respuesta) VALUES ($1, $2, $3)`,
          [capaId, pq.orden || 1, pq.respuesta || ""]
        );
      }
    }

    // Insert Ishikawa if applicable
    if (metodo_analisis === "ishikawa" && ishikawa && Array.isArray(ishikawa)) {
      for (const ish of ishikawa) {
        await client.query(
          `INSERT INTO capa_ishikawa (capa_id, categoria, causa) VALUES ($1, $2, $3)`,
          [capaId, ish.categoria || "", ish.causa || ""]
        );
      }
    }

    // Insert acciones
    if (acciones && Array.isArray(acciones)) {
      for (const acc of acciones) {
        if (acc.accion && acc.accion.trim()) {
          await client.query(
            `INSERT INTO capa_acciones (capa_id, accion, responsable, fecha_compromiso, estatus)
             VALUES ($1, $2, $3, $4, 'Pendiente')`,
            [capaId, acc.accion || "", acc.responsable || "", acc.fecha_compromiso || null]
          );
        }
      }
    }

    await commitTransaction(client);

    res.json({ id: capaId, ...capaResult.rows[0] });
  } catch (err) {
    await rollbackTransaction(client);
    console.error("[API] POST /api/capas error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// PUT /api/capas/:id - Update CAPA (with transaction)
app.put("/api/capas/:id", requireAuth, async (req: Request, res: Response) => {
  const client = await getClient();
  try {
    await beginTransaction(client);

    const { id } = req.params;
    const capaId = parseInt(id);

    const {
      titulo,
      descripcion_problema,
      metodo_analisis,
      responsable,
      fecha_apertura,
      fecha_compromiso,
      porques,
      ishikawa,
      acciones,
    } = req.body;

    // Update main CAPA
    const updateResult = await client.query(
      `UPDATE capas
       SET titulo=$1, descripcion_problema=$2, metodo_analisis=$3, responsable=$4,
           fecha_apertura=$5, fecha_compromiso=$6
       WHERE id=$7
       RETURNING *`,
      [
        titulo || "",
        descripcion_problema || "",
        metodo_analisis,
        responsable || "",
        fecha_apertura,
        fecha_compromiso || null,
        capaId,
      ]
    );

    if (updateResult.rowCount === 0) {
      throw new Error("CAPA no encontrada");
    }

    // Delete old related records
    await client.query("DELETE FROM capa_5porques WHERE capa_id=$1", [capaId]);
    await client.query("DELETE FROM capa_ishikawa WHERE capa_id=$1", [capaId]);
    await client.query("DELETE FROM capa_acciones WHERE capa_id=$1", [capaId]);

    // Insert new 5 porques
    if (metodo_analisis === "5porques" && porques && Array.isArray(porques)) {
      for (const pq of porques) {
        await client.query(
          `INSERT INTO capa_5porques (capa_id, orden, respuesta) VALUES ($1, $2, $3)`,
          [capaId, pq.orden || 1, pq.respuesta || ""]
        );
      }
    }

    // Insert new Ishikawa
    if (metodo_analisis === "ishikawa" && ishikawa && Array.isArray(ishikawa)) {
      for (const ish of ishikawa) {
        await client.query(
          `INSERT INTO capa_ishikawa (capa_id, categoria, causa) VALUES ($1, $2, $3)`,
          [capaId, ish.categoria || "", ish.causa || ""]
        );
      }
    }

    // Insert new acciones
    if (acciones && Array.isArray(acciones)) {
      for (const acc of acciones) {
        if (acc.accion && acc.accion.trim()) {
          await client.query(
            `INSERT INTO capa_acciones (capa_id, accion, responsable, fecha_compromiso)
             VALUES ($1, $2, $3, $4)`,
            [capaId, acc.accion || "", acc.responsable || "", acc.fecha_compromiso || null]
          );
        }
      }
    }

    await commitTransaction(client);

    res.json(updateResult.rows[0]);
  } catch (err) {
    await rollbackTransaction(client);
    console.error("[API] PUT /api/capas/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// PATCH /api/capas/:id/estatus - Update CAPA status
app.patch("/api/capas/:id/estatus", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estatus, verificado_por, observaciones } = req.body;

    const fechaCierre = estatus === "Cerrada" ? new Date().toISOString().split("T")[0] : null;

    const result = await db
      .update(schema.capas)
      .set({
        estatus,
        verificadoPor: verificado_por || "",
        observaciones: observaciones || "",
        ...(fechaCierre && { fechaCierre }),
      })
      .where(eq(schema.capas.id, parseInt(id)))
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] PATCH /api/capas/:id/estatus error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/capas/:id/acciones/:aid - Update action status
app.patch("/api/capas/:id/acciones/:aid", requireAuth, async (req: Request, res: Response) => {
  try {
    const { aid } = req.params;
    const { estatus } = req.body;

    const result = await db
      .update(schema.capaAcciones)
      .set({ estatus })
      .where(eq(schema.capaAcciones.id, parseInt(aid)))
      .returning();

    res.json(result[0]);
  } catch (err) {
    console.error("[API] PATCH /api/capas/:id/acciones/:aid error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/capas/:id - Delete CAPA (cascade)
app.delete("/api/capas/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const capaId = parseInt(id);

    // Delete in cascade order
    await db
      .delete(schema.capa5Porques)
      .where(eq(schema.capa5Porques.capaId, capaId));

    await db
      .delete(schema.capaIshikawa)
      .where(eq(schema.capaIshikawa.capaId, capaId));

    await db
      .delete(schema.capaAcciones)
      .where(eq(schema.capaAcciones.capaId, capaId));

    await db
      .delete(schema.capas)
      .where(eq(schema.capas.id, capaId));

    res.json({ ok: true });
  } catch (err) {
    console.error("[API] DELETE /api/capas/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── USUARIOS (Administración) ──────────────────────────────────

// GET /api/usuarios - List all OIDC users (admin only)
app.get("/api/usuarios", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, oidc_id, nombre, usuario, email, rol, activo, permisos, ultimo_acceso, created_at
      FROM usuarios
      WHERE oidc_id IS NOT NULL
      ORDER BY ultimo_acceso DESC NULLS LAST, created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("[API] GET /api/usuarios error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/usuarios/:id - Update rol, permisos, activo (admin only)
app.patch("/api/usuarios/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rol, permisos, activo } = req.body;

    const fields: string[] = [];
    const vals: any[]      = [];
    let i = 1;

    if (rol      !== undefined) { fields.push(`rol = $${i++}`);                vals.push(rol); }
    if (permisos !== undefined) { fields.push(`permisos = $${i++}`);           vals.push(JSON.stringify(permisos)); }
    if (activo   !== undefined) { fields.push(`activo = $${i++}`);             vals.push(activo); }

    if (fields.length === 0) return res.status(400).json({ error: "Sin campos a actualizar" });

    vals.push(id);
    const result = await pool.query(
      `UPDATE usuarios SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      vals
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[API] PATCH /api/usuarios/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── SPA Catch-all ────────────────────────────────────────────────
// Serves index.html for all non-API routes (client-side routing via wouter).
// Registered after all API routes so Express only reaches this for deep-links.
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/auth/")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
