/**
 * Centralized API Client
 * Wraps fetch with error handling, 401 redirect, and typed responses.
 *
 * All API calls use credentials: 'include' so the session cookie is forwarded.
 * On 401 the user is redirected to /login (Nextcloud SSO flow).
 */

import { API_BASE_URL } from "../config/api";

// ── Error shape ─────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function buildUrl(
  endpoint: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const base = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  if (!query) return base;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Session expired or not logged in — redirect to SSO login
    window.location.href = "/login";
    // Return a never-resolving promise so callers don't proceed
    return new Promise(() => undefined);
  }

  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message = `Request failed with status ${res.status}`;
    let details: unknown;

    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string; details?: unknown };
      };
      if (body.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
        details = body.error.details;
      }
    } catch {
      // body is not JSON — keep default message
    }

    throw new ApiClientError(res.status, code, message, details);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * GET /endpoint?key=value
 */
export async function apiGet<T>(
  endpoint: string,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const res = await fetch(buildUrl(endpoint, query), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return handleResponse<T>(res);
}

/**
 * POST /endpoint  { body }
 */
export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(buildUrl(endpoint), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

/**
 * PUT /endpoint  { body }
 */
export async function apiPut<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(buildUrl(endpoint), {
    method: "PUT",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

/**
 * PATCH /endpoint  { body }
 */
export async function apiPatch<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(buildUrl(endpoint), {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

/**
 * DELETE /endpoint
 */
export async function apiDelete<T = void>(endpoint: string): Promise<T> {
  const res = await fetch(buildUrl(endpoint), {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return handleResponse<T>(res);
}
