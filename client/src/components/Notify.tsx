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

  const colorMap: Record<Toast['type'], string> = {
    success: 'bg-green-50 border-green-400 text-green-800',
    error:   'bg-red-50   border-red-400   text-red-800',
    warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
  };

  const iconMap: Record<Toast['type'], string> = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
  };

  const iconColorMap: Record<Toast['type'], string> = {
    success: 'text-green-500',
    error:   'text-red-500',
    warning: 'text-yellow-500',
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-start gap-3 w-80 px-4 py-3
        border rounded-lg shadow-lg
        animate-in slide-in-from-right-full duration-300
        ${colorMap[toast.type]}
      `}
    >
      {/* Icon */}
      <span className={`mt-0.5 flex-shrink-0 font-bold text-base ${iconColorMap[toast.type]}`}>
        {iconMap[toast.type]}
      </span>

      {/* Message */}
      <p className="flex-1 text-sm leading-snug break-words">{toast.message}</p>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="flex-shrink-0 mt-0.5 opacity-60 hover:opacity-100 transition-opacity text-base leading-none"
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
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        // pointer-events-auto re-enables clicks on individual toasts
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
