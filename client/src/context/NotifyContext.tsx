/**
 * NotifyContext — Global toast notification system
 *
 * Wraps the app; any component can call useNotify() to show a toast.
 * Toasts are auto-removed after their duration (default 3 000 ms).
 *
 * Usage:
 *   const notify = useNotify();
 *   notify('Guardado correctamente', 'success');
 *   notify('Error al guardar', 'error', 5000);
 */

import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";
import Notify from "../components/Notify";
import type { Toast } from "../types";

// ── Context shape ─────────────────────────────────────────────────────────────

type NotifyFn = (message: string, type: Toast["type"], duration?: number) => void;

const NotifyContext = createContext<NotifyFn | null>(null);

// ── Simple counter for deterministic IDs (no uuid dep needed) ─────────────────

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `toast-${_counter}`;
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface NotifyProviderProps {
  children: ReactNode;
}

export function NotifyProvider({ children }: NotifyProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Stable dismiss reference used both here and inside Notify
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Timeout map so we can clear on early dismiss
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const notify = useCallback<NotifyFn>(
    (message, type, duration = 3000) => {
      const id = nextId();
      const toast: Toast = { id, message, type, duration };

      setToasts((prev) => [...prev, toast]);

      // Auto-remove after duration (Notify's own timer handles visual
      // auto-dismiss, but we also clean state here as a safety net)
      const timer = setTimeout(() => {
        dismiss(id);
        timers.current.delete(id);
      }, duration + 100); // slight buffer so animation finishes first

      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Notify toasts={toasts} onDismiss={dismiss} />
    </NotifyContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * useNotify — returns the notify function.
 * Must be called inside a <NotifyProvider>.
 */
export function useNotify(): NotifyFn {
  const ctx = useContext(NotifyContext);
  if (ctx === null) {
    throw new Error("useNotify must be used inside <NotifyProvider>");
  }
  return ctx;
}
