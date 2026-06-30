/**
 * Notify — Toast notification component
 *
 * Renders a stack of toast messages in the top-right corner of the viewport.
 * Each toast auto-dismisses after its duration (default 3 000 ms).
 * Uses createPortal so it always renders above every other layer.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Toast } from '../types';

// ── Single toast item ──────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const duration = toast.duration ?? 3000;
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.id, toast.duration, onDismiss]);

  const bgMap: Record<Toast['type'], string> = {
    success: '#0d2b4e',
    error:   '#c0392b',
    warning: '#8a6a00',
  };

  const iconMap: Record<Toast['type'], string> = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: 320,
        padding: '12px 18px',
        background: bgMap[toast.type],
        color: '#fff',
        fontSize: 13,
        border: 'none',
      }}
    >
      {/* Icon */}
      <span style={{ flexShrink: 0, fontWeight: 700 }}>
        {iconMap[toast.type]}
      </span>

      {/* Message */}
      <p style={{ flex: 1, margin: 0, wordBreak: 'break-word', lineHeight: 1.4 }}>
        {toast.message}
      </p>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
          opacity: 0.75,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Toast container ────────────────────────────────────────────────────────────

interface NotifyProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/**
 * Notify renders the full toast stack via a portal.
 * Mount this once at the root; feed it the toasts array from NotifyContext.
 */
export default function Notify({ toasts, onDismiss }: NotifyProps) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-label="Notificaciones"
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
