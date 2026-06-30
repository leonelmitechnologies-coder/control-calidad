import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Issuer, Strategy as OIDCStrategy } from "openid-client";
import session from "express-session";

/**
 * User type for Passport sessions
 */
export interface PassportUser {
  id: string;
  name: string;
  email: string;
  oidcId?: string;
}

declare global {
  namespace Express {
    interface User extends PassportUser {}
  }
}

/**
 * Initialize Nextcloud OIDC authentication with Passport
 */
export async function initializePassport(app: any) {
  const {
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
    SESSION_SECRET,
    APP_URL,
  } = process.env;

  if (!OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET) {
    throw new Error("OIDC_CLIENT_ID and OIDC_CLIENT_SECRET must be set");
  }

  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set");
  }

  // Initialize session middleware
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      },
    })
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Discover Nextcloud OIDC provider
  const issuer = await Issuer.discover(
    process.env.OIDC_ISSUER_URL ||
      "https://cloud.miglobal.com.mx/index.php/.well-known/openid-configuration"
  );

  const client = new issuer.Client({
    client_id: OIDC_CLIENT_ID,
    client_secret: OIDC_CLIENT_SECRET,
    redirect_uris: [`${APP_URL}/api/auth/callback`],
    response_types: ["code"],
  });

  // Configure OIDC Strategy
  const oidcStrategy = new OIDCStrategy(
    {
      client,
      usePKCE: false,
    },
    (tokenSet: any, userInfo: any, done: any) => {
      // Map OIDC user info to our user object
      const user: PassportUser = {
        id: userInfo.sub || userInfo.email || "unknown",
        name: userInfo.name || userInfo.given_name || "Usuario",
        email: userInfo.email || "",
        oidcId: userInfo.sub,
      };
      return done(null, user);
    }
  );

  passport.use("oidc", oidcStrategy);

  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user from session
  passport.deserializeUser((user: PassportUser, done) => {
    done(null, user);
  });

  return { issuer, client };
}

/**
 * Middleware: Require authentication
 * Bypasses auth when OIDC is not yet configured (SSO pending).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!process.env.OIDC_CLIENT_ID) {
    return next();
  }
  if (!req.user) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
}

/**
 * Middleware: Require admin role
 * Note: For now, admin status can be checked against a database or environment.
 * This is a placeholder that always passes; implement role checking as needed.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // TODO: Check user role from database (usuarios table)
  // For now, assume OIDC user needs to be in an admin list
  const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
  if (!req.user || !adminEmails.includes(req.user.email || "")) {
    return res
      .status(403)
      .json({ error: "Sin permisos de administrador" });
  }
  next();
}
