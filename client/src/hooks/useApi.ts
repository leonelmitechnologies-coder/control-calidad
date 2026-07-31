/**
 * useApi — generic hook for API CRUD operations
 *
 * Wraps TanStack Query for GET requests and useMutation for writes.
 * All errors are forwarded to the global notify system so consumers
 * never need to handle the error state manually.
 *
 * Usage (read):
 *   const { data, loading, error, refetch } = useApi<Order[]>('/api/orders');
 *
 * Usage (write):
 *   const { execute, loading } = useApi<Order, InsertOrder>('/api/orders', 'POST');
 *   await execute(payload);
 */

import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { API_BASE_URL } from "../config/api";
import { useNotify } from "../context/NotifyContext";

// ── Types ──────────────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface UseApiReadResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: UseQueryResult<T>["refetch"];
  execute?: never;
}

interface UseApiWriteResult<T, B> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch?: never;
  execute: (body?: B) => Promise<T>;
}

type UseApiResult<T, B> = HttpMethod extends "GET" ? UseApiReadResult<T> : UseApiWriteResult<T, B>;

// ── Helper: fetch with credentials ────────────────────────────────────────────

async function apiFetch<T>(url: string, method: HttpMethod, body?: unknown): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  const res = await fetch(fullUrl, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      message = json?.error?.message ?? json?.message ?? message;
    } catch {
      // ignore JSON parse errors; keep HTTP status message
    }
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * useApi<T, B>(endpoint, method?)
 *
 * @param endpoint  - API path (e.g. '/api/orders') or full URL
 * @param method    - HTTP method. Defaults to 'GET'.
 *                    GET returns a TanStack Query read result.
 *                    Any other method returns a mutation result with execute().
 */
export function useApi<T, B = unknown>(
  endpoint: string,
  method: HttpMethod = "GET",
): UseApiReadResult<T> | UseApiWriteResult<T, B> {
  const notify = useNotify();
  const qc = useQueryClient();

  // ── GET — use TanStack Query ────────────────────────────────────────────────
  if (method === "GET") {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const query = useQuery<T>({
      queryKey: [endpoint],
      queryFn: () => apiFetch<T>(endpoint, "GET"),
    });

    if (query.error) {
      // Show error once (not on every render — TanStack Query dedupes)
      const msg = query.error instanceof Error ? query.error.message : "Error al cargar datos";
      notify(msg, "error");
    }

    return {
      data: query.data,
      loading: query.isLoading,
      error: query.error instanceof Error ? query.error : null,
      refetch: query.refetch,
    };
  }

  // ── Mutations ───────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const mutation = useMutation<T, Error, B | undefined>({
    mutationFn: (body) => apiFetch<T>(endpoint, method, body),
    onError: (err) => {
      notify(err.message ?? "Error en la operación", "error");
    },
    onSuccess: () => {
      // Invalidate the GET cache for the same endpoint so lists refresh
      void qc.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const execute = useCallback(
    async (body?: B): Promise<T> => {
      return mutation.mutateAsync(body);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutation.mutateAsync],
  );

  return {
    data: mutation.data,
    loading: mutation.isPending,
    error: mutation.error,
    execute,
  };
}
