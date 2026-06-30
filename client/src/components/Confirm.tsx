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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={handleOverlayClick}
    >
      {/* Dialog panel */}
      <div
        ref={dialogRef}
        style={{
          position: 'relative',
          background: '#fff',
          border: 'none',
          padding: 28,
          width: 380,
          maxWidth: '95vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {/* Title */}
        <h2
          id="confirm-title"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#0d2b4e',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            borderBottom: '2px solid #0d2b4e',
            paddingBottom: 8,
            marginBottom: 16,
            margin: '0 0 16px 0',
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          id="confirm-message"
          style={{ fontSize: 14, color: '#111', marginBottom: 20 }}
        >
          {message}
        </p>

        {/* Actions */}
        <div className="btn-grupo" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secundario"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-primario"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
