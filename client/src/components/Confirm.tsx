/**
 * Confirm — Portal-based confirmation modal
 *
 * Renders a centered modal dialog with a dark overlay (z-50000) over all content.
 * Click outside the dialog or press Escape to cancel.
 * Consumed via ConfirmContext / useConfirm() — not used directly.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ConfirmConfig } from '../types';

interface ConfirmProps extends ConfirmConfig {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function Confirm({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  // Trap focus inside modal when open
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const firstFocusable = dialogRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    // Only close when clicking the backdrop itself, not the dialog
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }

  return createPortal(
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        className="
          relative z-10 w-full max-w-md
          bg-white rounded-xl shadow-2xl
          p-6 flex flex-col gap-4
          animate-in zoom-in-95 duration-200
        "
      >
        {/* Title */}
        <h2 id="confirm-title" className="text-lg font-semibold text-gray-900 leading-snug">
          {title}
        </h2>

        {/* Message */}
        <p id="confirm-message" className="text-sm text-gray-600 leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="
              px-4 py-2 text-sm font-medium
              bg-gray-100 text-gray-700 rounded-lg
              hover:bg-gray-200 transition-colors
              focus:outline-none focus:ring-2 focus:ring-gray-400
            "
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="
              px-4 py-2 text-sm font-medium
              bg-blue-600 text-white rounded-lg
              hover:bg-blue-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
