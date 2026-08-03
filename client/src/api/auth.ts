/**
 * Authentication API Functions
 * Handle logout and OIDC callback operations
 */

import { API_ENDPOINTS } from "../config/api";

export interface ModuloPermisos {
  ver: boolean;
  editar: boolean;
  eliminar: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  picture?: string;
  rol?: string;
  usuario?: string;
  permisos?: Record<string, ModuloPermisos> | null;
  /** GAC (2026-08-02): signed in via SSO but not on the allowlist yet — no usuarios
   * row exists. See requestStatus/requestedScopes for their in-flight request, if any. */
  pending?: boolean;
  requestStatus?: "pending" | "approved" | "denied" | null;
  requestedScopes?: string[];
  requestNote?: string | null;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

/**
 * Get current user session from API
 */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch(API_ENDPOINTS.auth.me, {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) return null;
      throw new Error(`Failed to fetch user: ${response.status}`);
    }

    const raw = await response.json();
    const data = raw.user ?? raw;
    if (!data?.id) return null;

    // El servidor devuelve { id, nombre, usuario, rol } — mapeamos a User
    // GAC (2026-08-02): a pending user has no rol/permisos yet — carry the
    // pending flag + their request status through so the UI can show the
    // Request Access page instead of the normal app shell.
    return {
      id: String(data.id),
      name: data.nombre ?? data.name ?? data.usuario ?? "",
      email: data.email ?? data.usuario ?? "",
      picture: data.picture,
      rol: data.rol,
      usuario: data.usuario,
      permisos: data.permisos ?? null,
      pending: Boolean(data.pending),
      requestStatus: data.requestStatus ?? null,
      requestedScopes: data.requestedScopes ?? [],
      requestNote: data.requestNote ?? null,
    } as User;
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
}

/**
 * Logout the current user — navigates to GET /api/auth/logout which
 * destroys the local session and redirects to the OIDC end_session_endpoint
 * so the Nextcloud SSO session is also cleared.
 */
export function logout(): void {
  window.location.href = "/api/auth/logout";
}

/**
 * Handle OIDC callback (called from /login route)
 */
export async function handleOIDCCallback(): Promise<User | null> {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      throw new Error("Missing OAuth code or state");
    }

    const response = await fetch(API_ENDPOINTS.auth.callback, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ code, state }),
    });

    if (!response.ok) {
      throw new Error(`Callback failed: ${response.status}`);
    }

    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error("Error handling OIDC callback:", error);
    return null;
  }
}

/**
 * Redirect to OIDC login provider
 */
export function redirectToLogin(): void {
  window.location.href = "/api/auth/login";
}
