import type { NextFunction, Request, Response } from "express";
import session from "express-session";
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
}

declare global {
  namespace Express {
    interface User extends PassportUser {}
  }
}

// Default permissions for new OIDC users
const DEFAULT_PERMISOS: Record<string, { ver: boolean; editar: boolean; eliminar: boolean }> = {
  "": { ver: true, editar: false, eliminar: false },
  nc: { ver: true, editar: true, eliminar: false },
  recepciones: { ver: true, editar: true, eliminar: false },
  "rechazos-ext": { ver: true, editar: true, eliminar: false },
  "rechazos-int": { ver: true, editar: true, eliminar: false },
  capas: { ver: true, editar: true, eliminar: false },
  aql: { ver: true, editar: true, eliminar: false },
  "liberacion-shipping": { ver: true, editar: true, eliminar: false },
  "organigrama-qc": { ver: true, editar: false, eliminar: false },
  calendario: { ver: true, editar: false, eliminar: false },
  manual: { ver: true, editar: false, eliminar: false },
};

/**
 * Upsert OIDC user into the usuarios table.
 * Returns the user's rol and permisos from DB.
 */
export async function upsertOidcUser(
  oidcId: string,
  name: string,
  email: string,
): Promise<{ rol: string; permisos: Record<string, any> }> {
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
      rol: existing.rows[0].rol,
      permisos: existing.rows[0].permisos || DEFAULT_PERMISOS,
    };
  }

  // New user — insert with default permissions
  const usuarioVal = email || oidcId;
  try {
    const result = await pool.query(
      `INSERT INTO usuarios (oidc_id, nombre, usuario, email, password_hash, activo, rol, permisos, ultimo_acceso)
       VALUES ($1, $2, $3, $4, '', true, 'Usuario', $5, NOW())
       RETURNING rol, permisos`,
      [oidcId, name, usuarioVal, email, JSON.stringify(DEFAULT_PERMISOS)],
    );
    return { rol: result.rows[0].rol, permisos: result.rows[0].permisos || DEFAULT_PERMISOS };
  } catch (err: any) {
    if (err.code === "23505") {
      // usuario column conflict — retry with oidcId as username
      const result = await pool.query(
        `INSERT INTO usuarios (oidc_id, nombre, usuario, email, password_hash, activo, rol, permisos, ultimo_acceso)
         VALUES ($1, $2, $3, $4, '', true, 'Usuario', $5, NOW())
         ON CONFLICT (oidc_id) DO UPDATE SET nombre=EXCLUDED.nombre, email=EXCLUDED.email, ultimo_acceso=NOW()
         RETURNING rol, permisos`,
        [oidcId, name, oidcId, email, JSON.stringify(DEFAULT_PERMISOS)],
      );
      return { rol: result.rows[0].rol, permisos: result.rows[0].permisos || DEFAULT_PERMISOS };
    }
    throw err;
  }
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
  app.use(
    session({
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
        .then(({ rol, permisos }) => {
          user.rol = rol;
          user.permisos = permisos;
          return done(null, user);
        })
        .catch((err) => {
          console.error("[OIDC] upsertOidcUser failed:", err);
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
  next();
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
