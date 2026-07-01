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

// GET /api/auth/logout - Destroy local session + clear Nextcloud SSO + redirect to /login
app.get("/api/auth/logout", (req: Request, res: Response) => {
  req.logout((_err) => {
    req.session.destroy((_destroyErr) => {
      res.clearCookie("connect.sid");
      const appUrl = process.env.APP_URL || "https://control-calidad-qc.mi2.com.mx";
      const endSession = oidcReady && passportClient?.issuer?.metadata?.end_session_endpoint;
      if (endSession) {
        const url = `${endSession}?post_logout_redirect_uri=${encodeURIComponent(appUrl + "/login")}`;
        return res.redirect(url);
      }
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

// GET /api/me - Get current user
app.get("/api/me", (req: Request, res: Response) => {
  if (req.user) {
    // Usuario autenticado (OIDC o login directo)
    return res.json({
      id:      req.user.id,
      nombre:  req.user.name,
      usuario: req.user.email,
      rol:     (req.user as any).rol ?? "Usuario",
    });
  }
  if (!process.env.OIDC_CLIENT_ID) {
    // Dev sin OIDC configurado: devuelve usuario de desarrollo
    return res.json({ id: "dev", nombre: "Dev Local", usuario: "dev", rol: "Administrador" });
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

// GET /api/catalogo-sku?q=... - Search SKU prefix
app.get("/api/catalogo-sku", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT sku, marca, modelo, pulgada, descripcion FROM catalogo_sku WHERE UPPER(sku) LIKE UPPER($1) LIMIT 10`,
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

// GET /api/rechazos-externos - List external rejects with counts
app.get("/api/rechazos-externos", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        re.*,
        COUNT(DISTINCT rpd.id) as cnt_problemas,
        COUNT(DISTINCT rca.id) as cnt_acciones,
        COUNT(DISTINCT c.id) as cnt_capas
      FROM rechazos_externos re
      LEFT JOIN re_problem_descriptions rpd ON rpd.rechazo_id = re.id
      LEFT JOIN re_corrective_actions rca ON rca.rechazo_id = re.id
      LEFT JOIN capas c ON c.origen_tipo = 're' AND c.origen_id = re.id
      GROUP BY re.id
      ORDER BY re.created_at DESC
    `);

    res.json(result.rows);
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
      images,
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

    // Insert main rechazo_externo
    const reResult = await client.query(
      `INSERT INTO rechazos_externos
        (return_order, license_plate, classification, inches, sales_channel, sku, brand,
         plant_entry, plant_exit, outbound_order, processed_by, registration_date, sale_price, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, return_order, license_plate, classification, inches, sales_channel, sku, brand,
                 plant_entry, plant_exit, outbound_order, processed_by, registration_date, sale_price`,
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
        outbound_order || "",
        processed_by || "",
        registration_date || null,
        sale_price || null,
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

    // Update main record
    const updateResult = await client.query(
      `UPDATE rechazos_externos
       SET return_order=$1, license_plate=$2, classification=$3, inches=$4, sales_channel=$5, sku=$6,
           brand=$7, plant_entry=$8, plant_exit=$9, outbound_order=$10, processed_by=$11,
           registration_date=$12, sale_price=$13
       WHERE id=$14
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
        outbound_order || "",
        processed_by || "",
        registration_date || null,
        sale_price || null,
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
        const url = await s3.uploadFileToS3(
          file.buffer,
          file.originalname,
          "rechazos-externos",
          `re-${reId}`
        );

        // Extract filename from URL
        const filename = url.split("/").pop() || file.originalname;

        // Store in database
        await db.insert(schema.reImages).values({
          rechazoId: reId,
          filename,
        });

        uploadedUrls.push(url);
      }

      res.json({ images: uploadedUrls });
    } catch (err) {
      console.error("[API] POST /api/rechazos-externos/:id/images error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

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
    const result = await pool.query(`
      SELECT
        ri.*,
        COUNT(DISTINCT rii.id) as images_count
      FROM rechazos_internos ri
      LEFT JOIN ri_images rii ON rii.rechazo_id = ri.id
      GROUP BY ri.id
      ORDER BY ri.fecha_registro DESC, ri.created_at DESC
    `);

    res.json(result.rows);
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

    res.json({
      ...riMain[0],
      images,
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
        const url = await s3.uploadFileToS3(
          file.buffer,
          file.originalname,
          "rechazos-internos",
          `ri-${riId}`
        );

        const filename = url.split("/").pop() || file.originalname;

        await db.insert(schema.riImages).values({
          rechazoId: riId,
          filename,
        });

        uploadedUrls.push(url);
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
      const url = await s3.uploadFileToS3(
        file.buffer,
        file.originalname,
        "rechazos-internos",
        `firma-${riId}`
      );

      const filename = url.split("/").pop() || file.originalname;

      // Update database
      await db
        .update(schema.rechazosInternos)
        .set({ firmaFilename: filename })
        .where(eq(schema.rechazosInternos.id, riId));

      res.json({ firma: url });
    } catch (err) {
      console.error("[API] POST /api/rechazos-internos/:id/firma error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

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

// GET /api/aql - List AQL registros
app.get("/api/aql", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await db
      .select()
      .from(schema.aqlRegistros)
      .orderBy(desc(schema.aqlRegistros.fechaRegistro), desc(schema.aqlRegistros.createdAt));

    res.json(result);
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

    res.json(result[0]);
  } catch (err) {
    console.error("[API] GET /api/aql/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/aql - Create AQL record
app.post("/api/aql", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      fecha_registro,
      license_plate,
      clasificacion,
      sku,
      marca,
      modelo,
      pulgada,
      descripcion,
      accesorios_presentes,
      estado_accesorios,
      accesorios_defectos,
      estado_bolsa,
      bolsa_defectos,
      estado_audio,
      audio_defectos,
      estado_video,
      video_defectos,
      estado_fisico_pantalla,
      fisico_pantalla_defectos,
      estado_limpieza,
      limpieza_defectos,
      estado_aql,
      inspector,
    } = req.body;

    const result = await db
      .insert(schema.aqlRegistros)
      .values({
        fechaRegistro: fecha_registro,
        licensePlate: license_plate,
        clasificacion: clasificacion || "",
        sku: sku || "",
        marca: marca || "",
        modelo: modelo || "",
        pulgada: pulgada || "",
        descripcion: descripcion || "",
        accesoriosPresentes: accesorios_presentes || "",
        estadoAccesorios: estado_accesorios || "",
        accesoriosDefectos: accesorios_defectos || "",
        estadoBolsa: estado_bolsa || "",
        bolsaDefectos: bolsa_defectos || "",
        estadoAudio: estado_audio || "",
        audioDefectos: audio_defectos || "",
        estadoVideo: estado_video || "",
        videoDefectos: video_defectos || "",
        estadoFisicoPantalla: estado_fisico_pantalla || "",
        fisicoPantallaDefectos: fisico_pantalla_defectos || "",
        estadoLimpieza: estado_limpieza || "",
        limpiezaDefectos: limpieza_defectos || "",
        estadoAql: estado_aql || "",
        inspector: inspector || req.user?.name || "",
        registradoPor: req.user?.name || "",
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
      fecha_registro,
      license_plate,
      clasificacion,
      sku,
      marca,
      modelo,
      pulgada,
      descripcion,
      accesorios_presentes,
      estado_accesorios,
      accesorios_defectos,
      estado_bolsa,
      bolsa_defectos,
      estado_audio,
      audio_defectos,
      estado_video,
      video_defectos,
      estado_fisico_pantalla,
      fisico_pantalla_defectos,
      estado_limpieza,
      limpieza_defectos,
      estado_aql,
      inspector,
    } = req.body;

    const result = await db
      .update(schema.aqlRegistros)
      .set({
        fechaRegistro: fecha_registro,
        licensePlate: license_plate,
        clasificacion: clasificacion || "",
        sku: sku || "",
        marca: marca || "",
        modelo: modelo || "",
        pulgada: pulgada || "",
        descripcion: descripcion || "",
        accesoriosPresentes: accesorios_presentes || "",
        estadoAccesorios: estado_accesorios || "",
        accesoriosDefectos: accesorios_defectos || "",
        estadoBolsa: estado_bolsa || "",
        bolsaDefectos: bolsa_defectos || "",
        estadoAudio: estado_audio || "",
        audioDefectos: audio_defectos || "",
        estadoVideo: estado_video || "",
        videoDefectos: video_defectos || "",
        estadoFisicoPantalla: estado_fisico_pantalla || "",
        fisicoPantallaDefectos: fisico_pantalla_defectos || "",
        estadoLimpieza: estado_limpieza || "",
        limpiezaDefectos: limpieza_defectos || "",
        estadoAql: estado_aql || "",
        inspector: inspector || "",
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

      const url = await s3.uploadFileToS3(
        file.buffer,
        file.originalname,
        "aql",
        `lpn-${aqlId}`
      );

      const filename = url.split("/").pop() || file.originalname;

      await db
        .update(schema.aqlRegistros)
        .set({ fotoLpnFilename: filename })
        .where(eq(schema.aqlRegistros.id, aqlId));

      res.json({ foto_lpn: url });
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

      const url = await s3.uploadFileToS3(
        file.buffer,
        file.originalname,
        "aql",
        `pantalla-${aqlId}`
      );

      const filename = url.split("/").pop() || file.originalname;

      await db
        .update(schema.aqlRegistros)
        .set({ fotoPantallaFilename: filename })
        .where(eq(schema.aqlRegistros.id, aqlId));

      res.json({ foto_pantalla: url });
    } catch (err) {
      console.error("[API] POST /api/aql/:id/foto-pantalla error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

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

// ── SPA Catch-all ────────────────────────────────────────────────
// Serves index.html for all non-API routes (client-side routing via wouter).
// Registered after all API routes so Express only reaches this for deep-links.
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/auth/")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
