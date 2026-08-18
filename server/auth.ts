import type { NextFunction, Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Issuer, Strategy as OIDCStrategy } from "openid-client";
import passport from "passport";
import { pool } from "./db.js";

/**
 * User type for Passport sessions
 */
export interface PassportUser {
  id: string;
  name: string;
  email: string;
  oidcId?: string;
  rol?: string;
  permisos?: Record<string, { ver: boolean; editar: boolean; eliminar: boolean }>;
  /** Set when this OIDC identity has no allowed_users-equivalent row yet (see GAC below). */
  pending?: boolean;
}

declare global {
  namespace Express {
    interface User extends PassportUser {}
  }
}

/**
 * ── Granular Access Control (GAC) — 2026-08-02 ──────────────────────────────
 * Retrofit of the stack's §7c GAC pattern (reference: mi2-apps/ops-hub
 * baf5c0a + 6a48892), adapted to this app's existing shape rather than a
 * literal port:
 *
 *  - This app already had a per-user, per-module permission model
 *    (usuarios.permisos JSONB, ver/editar/eliminar) plus an admin UI
 *    (/usuarios + PATCH /api/usuarios/:id). The actual gap was that
 *    upsertOidcUser() auto-created a usuarios row with broad DEFAULT_PERMISOS
 *    (view access to nearly every module) for ANY first-time SSO login — i.e.
 *    the same "any @miglobal/@mitechnologiesinc login gets full access" hole
 *    ops-hub had, just one layer deeper (per-row instead of per-request).
 *  - Rather than bolt on a parallel allowed_users table, the fix reuses
 *    `usuarios` as the allowlist: a user with no usuarios row is unlisted.
 *    ADMIN_EMAILS remains the break-glass path (same env var this app
 *    already had — equivalent to the scaffold's ALLOWED_EMAILS).
 *  - New first-time logins that aren't break-glass admins get `pending: true`
 *    instead of an auto-created row; the client shows a Request Access page;
 *    approval (Mattermost #approvals reply via the shared watcher, or the
 *    new /admin/access page) is what actually creates their usuarios row,
 *    with permisos scoped to what they asked for/were granted — not the old
 *    blanket default.
 *  - Deliberately NOT done in this pass: adding requireScope()-equivalent
 *    enforcement to the ~40 existing /api/nc, /api/recepciones, /api/aql...
 *    etc. routes (they still only require requireAuth, i.e. any *listed*
 *    user, same as before this change). Retrofitting that is a materially
 *    larger, separate change with real risk of locking out the 2 real users
 *    this app has today without knowing their true per-module needs — see
 *    the retrofit report for a full explanation. GAC here fixes WHO gets an
 *    account at all, not fine-grained per-module server-side enforcement
 *    (which remains UI-level via usePerm(), as it was before this change).
 */

// Requestable module scopes — matches the exact keys client/src/pages/Usuarios.tsx's
// MODULOS_PERMISOS already uses (minus "" dashboard and "manual", which stay open to
// every listed user by default, same as before this change).
export const SCOPE_DOMAINS = [
  "nc",
  "recepciones",
  "rechazos-ext",
  "rechazos-int",
  "capas",
  "aql",
  "liberacion-shipping",
  "organigrama-qc",
  "calendario",
  "dashboard-b2c",
  "dashboard-b2b",
  "registro-comida",
  "metricas-ml",
] as const;
export type ScopeDomain = (typeof SCOPE_DOMAINS)[number];

export const SCOPE_LABELS: Record<ScopeDomain, string> = {
  nc: "No Conformidades",
  recepciones: "Recepciones",
  "rechazos-ext": "Rechazos Externos",
  "rechazos-int": "Rechazos Internos",
  capas: "CAPA (Acciones Correctivas)",
  aql: "AQL",
  "liberacion-shipping": "Liberación Shipping",
  "organigrama-qc": "Organigrama QC",
  calendario: "Calendario",
  "dashboard-b2c": "Dashboard B2C",
  "dashboard-b2b": "Dashboard B2B",
  "registro-comida": "Registro Comida",
  "metricas-ml": "Métricas ML",
};

type ModuloPermisos = { ver: boolean; editar: boolean; eliminar: boolean };

// Always visible to any listed user, regardless of granted scopes (dashboard + docs —
// same as the old DEFAULT_PERMISOS treatment for these two keys).
const ALWAYS_OPEN_PERMISOS: Record<string, ModuloPermisos> = {
  "": { ver: true, editar: false, eliminar: false },
  manual: { ver: true, editar: false, eliminar: false },
};

/** Builds a usuarios.permisos value from a granted scope list (module-level ver+editar; eliminar stays false — matches this app's prior default for non-"solo ver" modules). */
export function buildPermisos(scopes: string[]): Record<string, ModuloPermisos> {
  const permisos: Record<string, ModuloPermisos> = { ...ALWAYS_OPEN_PERMISOS };
  for (const key of SCOPE_DOMAINS) {
    permisos[key] = scopes.includes(key)
      ? { ver: true, editar: true, eliminar: false }
      : { ver: false, editar: false, eliminar: false };
  }
  return permisos;
}

// ── email canonicalization (§7a dual-domain HARD RULE) ──────────────────────
// @miglobal.com.mx and @mitechnologiesinc.com are the same identity space.
// This NC OIDC issuer often returns bare usernames (no @domain) for sub/email
// claims (existing rows: oidc_id='leonel.hernandez', no @ at all) — handle both.
const CANONICAL_DOMAINS = ["miglobal.com.mx", "mitechnologiesinc.com"];
export function canonicalizeEmail(email: string): string {
  const e = (email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  return CANONICAL_DOMAINS.includes(domain) ? local : e;
}

function adminEmailSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .map(canonicalizeEmail),
  );
}

/**
 * Upsert OIDC user into the usuarios table — GAC-gated (2026-08-02).
 *
 * Returns:
 *   { pending: false, rol, permisos }  — existing or break-glass-admin user, allowed in.
 *   { pending: true }                  — unlisted first-time login; no row created.
 */
export async function upsertOidcUser(
  oidcId: string,
  name: string,
  email: string,
): Promise<{ pending: boolean; rol?: string; permisos?: Record<string, any> }> {
  // 1) Already-known identity (matched by oidc_id, unchanged from before this change).
  const existing = await pool.query(
    "SELECT id, rol, permisos, activo FROM usuarios WHERE oidc_id = $1",
    [oidcId],
  );
  if (existing.rows.length > 0) {
    await pool.query(
      "UPDATE usuarios SET nombre=$1, email=$2, ultimo_acceso=NOW() WHERE oidc_id=$3",
      [name, email, oidcId],
    );
    return {
      pending: false,
      rol: existing.rows[0].rol,
      permisos: existing.rows[0].permisos || ALWAYS_OPEN_PERMISOS,
    };
  }

  const canon = canonicalizeEmail(email);

  // 2) A row pre-seeded by email (admin granted access before this person's first
  //    login — e.g. the retrofit seed) but never claimed by an oidc_id yet: claim it.
  const byEmail = await pool.query(
    "SELECT id, rol, permisos, activo, oidc_id FROM usuarios WHERE oidc_id IS NULL AND lower(email) = $1",
    [canon],
  );
  if (byEmail.rows.length > 0) {
    const row = byEmail.rows[0];
    await pool.query(
      "UPDATE usuarios SET oidc_id=$1, nombre=$2, email=$3, ultimo_acceso=NOW() WHERE id=$4",
      [oidcId, name, email, row.id],
    );
    return { pending: false, rol: row.rol, permisos: row.permisos || ALWAYS_OPEN_PERMISOS };
  }

  // 3) Break-glass: ADMIN_EMAILS bypasses the allowlist entirely, full access —
  //    same env var this app already used for admin recognition, now also gating
  //    row creation (previously ADMIN_EMAILS only affected the *displayed* rol).
  if (adminEmailSet().has(canon)) {
    const usuarioVal = email || oidcId;
    try {
      const result = await pool.query(
        `INSERT INTO usuarios (oidc_id, nombre, usuario, email, password_hash, activo, rol, permisos, ultimo_acceso)
         VALUES ($1, $2, $3, $4, '', true, 'Administrador', NULL, NOW())
         RETURNING rol, permisos`,
        [oidcId, name, usuarioVal, email],
      );
      return { pending: false, rol: result.rows[0].rol, permisos: result.rows[0].permisos };
    } catch (err: any) {
      if (err.code === "23505") {
        const result = await pool.query(
          `INSERT INTO usuarios (oidc_id, nombre, usuario, email, password_hash, activo, rol, permisos, ultimo_acceso)
           VALUES ($1, $2, $3, $4, '', true, 'Administrador', NULL, NOW())
           ON CONFLICT (oidc_id) DO UPDATE SET nombre=EXCLUDED.nombre, email=EXCLUDED.email, ultimo_acceso=NOW()
           RETURNING rol, permisos`,
          [oidcId, name, oidcId, email],
        );
        return { pending: false, rol: result.rows[0].rol, permisos: result.rows[0].permisos };
      }
      throw err;
    }
  }

  // 4) Genuinely unlisted first-time login — GAC gate: no row created. The client
  //    shows Request Access; a usuarios row is only created on approval (see
  //    decideAccessRequest below).
  console.warn(
    `[GAC] denied auto-provision for unlisted OIDC login (oidc_id=${oidcId}, email=${email}) — Request Access flow required`,
  );
  return { pending: true };
}

/**
 * Set up session + passport middleware. MUST run synchronously BEFORE any routes
 * are registered.
 */
export function setupSession(app: any) {
  const { SESSION_SECRET } = process.env;
  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set");
  }

  const PgStore = connectPgSimple(session);

  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
}

/**
 * Initialize Nextcloud OIDC authentication with Passport
 */
export async function initializePassport(app: any) {
  const { OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, SESSION_SECRET, APP_URL } = process.env;

  if (!OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET) {
    throw new Error("OIDC_CLIENT_ID and OIDC_CLIENT_SECRET must be set");
  }

  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set");
  }

  const issuer = await Issuer.discover(
    process.env.OIDC_ISSUER_URL ||
      "https://cloud.miglobal.com.mx/index.php/.well-known/openid-configuration",
  );

  const client = new issuer.Client({
    client_id: OIDC_CLIENT_ID,
    client_secret: OIDC_CLIENT_SECRET,
    redirect_uris: [process.env.OIDC_REDIRECT_URI || `${APP_URL}/auth/callback`],
    response_types: ["code"],
  });

  const oidcStrategy = new OIDCStrategy(
    { client, usePKCE: false },
    (tokenSet: any, userInfo: any, done: any) => {
      console.log("[OIDC] userInfo claims:", JSON.stringify(userInfo));
      const user: PassportUser = {
        id: userInfo.sub || userInfo.preferred_username || userInfo.email || "unknown",
        name:
          userInfo.name ||
          userInfo.display_name ||
          userInfo.preferred_username ||
          userInfo.given_name ||
          "Usuario",
        email: userInfo.email || userInfo.preferred_username || "",
        oidcId: userInfo.sub,
      };

      upsertOidcUser(user.id, user.name, user.email)
        .then(({ pending, rol, permisos }) => {
          if (pending) {
            user.pending = true;
          } else {
            user.rol = rol;
            user.permisos = permisos;
          }
          return done(null, user);
        })
        .catch((err) => {
          console.error("[OIDC] upsertOidcUser failed:", err);
          // Fail closed, not open: an error deciding access must NOT silently grant
          // a session with no rol/permisos (previously fell through as if allowed).
          user.pending = true;
          return done(null, user);
        });
    },
  );

  passport.use("oidc", oidcStrategy);

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: PassportUser, done) => {
    done(null, user);
  });

  return { issuer, client };
}

/**
 * Middleware: Require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!process.env.OIDC_CLIENT_ID) return next();
  if (!req.user) return res.status(401).json({ error: "No autorizado" });
  if (req.user.pending) {
    return res.status(403).json({ error: "Acceso pendiente de aprobación", pending: true });
  }
  next();
}

/**
 * Middleware: internal-only, for the shared Mattermost access-request-watcher
 * cron to call POST /internal/access-requests/:id/decide. Not reachable from
 * the browser — X-Internal-Token only (INTERNAL_APPROVAL_TOKEN env, injected
 * via Coolify, mirrored in the watcher's cron env on the host).
 */
export function requireInternalToken(req: Request, res: Response, next: NextFunction) {
  const token = process.env.INTERNAL_APPROVAL_TOKEN || "";
  if (!token) return res.status(500).json({ error: "INTERNAL_APPROVAL_TOKEN not configured" });
  if (req.header("x-internal-token") !== token) {
    return res.status(401).json({ error: "invalid or missing X-Internal-Token" });
  }
  next();
}

// ── Mattermost notification (best-effort) ───────────────────────────────────

async function postToApprovals(text: string): Promise<string | null> {
  const MM_URL = (process.env.MM_URL || "").replace(/\/$/, "");
  const MM_BOT_TOKEN = process.env.MM_BOT_TOKEN || "";
  const MM_APPROVALS_CHANNEL_ID = process.env.MM_APPROVALS_CHANNEL_ID || "";
  if (!MM_URL || !MM_BOT_TOKEN || !MM_APPROVALS_CHANNEL_ID) {
    console.warn(
      "[GAC] MM_URL/MM_BOT_TOKEN/MM_APPROVALS_CHANNEL_ID not fully configured — access request recorded but not posted to Mattermost",
    );
    return null;
  }
  try {
    const r = await fetch(`${MM_URL}/api/v4/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${MM_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: MM_APPROVALS_CHANNEL_ID, message: text }),
    });
    if (!r.ok) {
      console.error("[GAC] posting access request to Mattermost failed:", r.status, await r.text());
      return null;
    }
    const post = (await r.json()) as { id: string };
    return post.id;
  } catch (e) {
    console.error("[GAC] posting access request to Mattermost threw:", e);
    return null;
  }
}

export interface AccessRequestRow {
  id: number;
  oidc_id: string;
  email: string;
  name: string | null;
  requested_scopes: string[];
  status: string;
  note: string | null;
  mm_post_id: string | null;
  decided_by: string | null;
  decided_at: Date | null;
  requested_at: Date;
}

/** Records a new access request and best-effort posts it to #approvals. */
export async function createAccessRequest(
  oidcId: string,
  email: string,
  name: string | undefined,
  scopes: string[],
  note: string | null,
): Promise<{ id: number; alreadyPending: boolean; notifiedMattermost: boolean }> {
  const canon = canonicalizeEmail(email);
  const existingPending = await pool.query(
    "SELECT id FROM access_requests WHERE oidc_id = $1 AND status = 'pending' ORDER BY requested_at DESC LIMIT 1",
    [oidcId],
  );
  if (existingPending.rows.length > 0) {
    return { id: existingPending.rows[0].id, alreadyPending: true, notifiedMattermost: false };
  }

  const result = await pool.query(
    `INSERT INTO access_requests (oidc_id, email, name, requested_scopes, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [oidcId, canon, name ?? null, scopes, note],
  );
  const id = result.rows[0].id as number;

  const scopeLine = scopes.map((s) => SCOPE_LABELS[s as ScopeDomain] ?? s).join(", ");
  const msg =
    `🔐 **Access request — Control Calidad QC** (request #${id})\n` +
    `**User:** ${name ? `${name} ` : ""}<${email}>\n` +
    `**Requested:** ${scopeLine}` +
    (note ? `\n**Reason:** ${note}` : "") +
    `\n\nReply in this thread: \`approved\` (grants exactly what was requested), \`approved: scope1,scope2\` (override), or \`denied: reason\`.`;
  const postId = await postToApprovals(msg);
  if (postId) {
    await pool.query("UPDATE access_requests SET mm_post_id = $1 WHERE id = $2", [postId, id]);
  }
  return { id, alreadyPending: false, notifiedMattermost: Boolean(postId) };
}

export async function latestAccessRequestFor(oidcId: string): Promise<AccessRequestRow | null> {
  const r = await pool.query(
    "SELECT * FROM access_requests WHERE oidc_id = $1 ORDER BY requested_at DESC LIMIT 1",
    [oidcId],
  );
  return r.rows[0] ?? null;
}

type DecideResult =
  | { ok: true; status: "denied" }
  | { ok: true; status: "approved"; rol: string; scopes: string[] }
  | { ok: false; code: number; error: string };

/**
 * Shared approve/deny logic — used by both the internal-token route (called
 * by the Mattermost approval watcher) and the /api/admin/access-requests
 * admin-UI route.
 */
export async function decideAccessRequest(
  id: number,
  action: "approve" | "deny",
  decidedBy: string,
  scopeOverride?: string[],
): Promise<DecideResult> {
  const reqRes = await pool.query("SELECT * FROM access_requests WHERE id = $1", [id]);
  const reqRow = reqRes.rows[0] as AccessRequestRow | undefined;
  if (!reqRow) return { ok: false, code: 404, error: "request not found" };
  if (reqRow.status !== "pending")
    return { ok: false, code: 409, error: `request already ${reqRow.status}` };

  if (action === "deny") {
    await pool.query(
      "UPDATE access_requests SET status='denied', decided_by=$1, decided_at=NOW() WHERE id=$2",
      [decidedBy, id],
    );
    return { ok: true, status: "denied" };
  }

  const rawScopes =
    scopeOverride && scopeOverride.length > 0 ? scopeOverride : reqRow.requested_scopes;
  const validScopes = rawScopes.filter(
    (s) => s === "*" || (SCOPE_DOMAINS as readonly string[]).includes(s),
  );
  const isFull = validScopes.includes("*");
  const rol = isFull ? "Administrador" : "Usuario";
  const permisos = isFull ? null : buildPermisos(validScopes);
  const canon = canonicalizeEmail(reqRow.email);
  const usuarioVal = reqRow.email || reqRow.oidc_id;

  try {
    await pool.query(
      `INSERT INTO usuarios (oidc_id, nombre, usuario, email, password_hash, activo, rol, permisos, ultimo_acceso)
       VALUES ($1, $2, $3, $4, '', true, $5, $6, NOW())
       ON CONFLICT (oidc_id) DO UPDATE SET rol=EXCLUDED.rol, permisos=EXCLUDED.permisos, activo=true`,
      [
        reqRow.oidc_id,
        reqRow.name || canon,
        usuarioVal,
        reqRow.email,
        rol,
        permisos ? JSON.stringify(permisos) : null,
      ],
    );
  } catch (err: any) {
    if (err.code === "23505") {
      await pool.query(
        `INSERT INTO usuarios (oidc_id, nombre, usuario, email, password_hash, activo, rol, permisos, ultimo_acceso)
         VALUES ($1, $2, $3, $4, '', true, $5, $6, NOW())
         ON CONFLICT (oidc_id) DO UPDATE SET rol=EXCLUDED.rol, permisos=EXCLUDED.permisos, activo=true`,
        [
          reqRow.oidc_id,
          reqRow.name || canon,
          reqRow.oidc_id,
          reqRow.email,
          rol,
          permisos ? JSON.stringify(permisos) : null,
        ],
      );
    } else {
      throw err;
    }
  }

  await pool.query(
    "UPDATE access_requests SET status='approved', decided_by=$1, decided_at=NOW() WHERE id=$2",
    [decidedBy, id],
  );
  return { ok: true, status: "approved", rol, scopes: validScopes };
}

/**
 * Middleware: Require admin role — checks ADMIN_EMAILS env var OR DB rol.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!process.env.OIDC_CLIENT_ID) return next();
  if (!req.user) return res.status(401).json({ error: "No autorizado" });

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (adminEmails.some((a) => a === req.user!.email || a === req.user!.id)) return next();

  // Check DB for promoted admins
  try {
    const r = await pool.query("SELECT rol FROM usuarios WHERE oidc_id = $1", [req.user.id]);
    if (r.rows[0]?.rol === "Administrador") return next();
  } catch {
    // ignore DB error — fall through to 403
  }

  return res.status(403).json({ error: "Sin permisos de administrador" });
}
