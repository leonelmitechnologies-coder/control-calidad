/**
 * NcDetailModal — Read-only detail view for a No Conformidad
 *
 * Shows all fields in a two-column grid.
 * Provides status advancement buttons based on current estatus:
 *   Abierta     → "Marcar En Progreso"
 *   En Progreso → "Marcar Cerrada"
 *
 * Props:
 *   isOpen          - controls visibility
 *   data            - the NC record to display
 *   onClose         - called when user clicks Cerrar or overlay
 *   onStatusChange  - called with the new estatus string
 *   statusChanging  - loading state for the status mutation
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { NoConformidad } from '../../types';
import StatusBadge from '../common/StatusBadge';

// ── Helper: format date ────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Detail row helper ─────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-gray-900">{children}</dd>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface NcDetailModalProps {
  isOpen: boolean;
  data: NoConformidad | null;
  onClose: () => void;
  onStatusChange: (newStatus: string) => void;
  statusChanging?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NcDetailModal({
  isOpen,
  data,
  onClose,
  onStatusChange,
  statusChanging = false,
}: NcDetailModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const firstBtn = dialogRef.current.querySelector<HTMLElement>('button');
      firstBtn?.focus();
    }
  }, [isOpen]);

  if (!isOpen || !data) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // Determine next status action
  const nextStatusMap: Record<string, string> = {
    Abierta:      'En Progreso',
    'En Progreso': 'Cerrada',
  };
  const nextStatusLabel: Record<string, string> = {
    Abierta:      'Marcar En Progreso',
    'En Progreso': 'Marcar Cerrada',
  };
  const nextStatus = nextStatusMap[data.estatus];
  const nextLabel  = nextStatusLabel[data.estatus];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nc-detail-title"
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        className="
          relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto
          bg-white rounded-xl shadow-2xl
          animate-in zoom-in-95 duration-200
        "
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 id="nc-detail-title" className="text-lg font-semibold text-gray-900">
              {t('nc.detail.title')} #{data.id}
            </h2>
            <StatusBadge status={data.estatus} size="md" />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">

          {/* Core fields — 2-column grid */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailRow label={t('nc.form.fecha')}>
              {formatFecha(data.fecha)}
            </DetailRow>
            <DetailRow label={t('nc.form.hora')}>
              {(data.hora ?? '').slice(0, 5)}
            </DetailRow>
            <DetailRow label={t('nc.form.area')}>
              {data.area}
            </DetailRow>
            <DetailRow label={t('nc.form.tipo')}>
              {data.tipo}
            </DetailRow>
            <DetailRow label={t('nc.form.severidad')}>
              <StatusBadge status={data.severidad} variant="severidad" size="sm" />
            </DetailRow>
            <DetailRow label={t('nc.form.responsable')}>
              {data.responsable}
            </DetailRow>
          </dl>

          {/* Descripción — full width */}
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {t('nc.form.descripcion')}
            </dt>
            <dd className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-200">
              {data.descripcion || '—'}
            </dd>
          </div>

          {/* Acción correctiva — full width */}
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {t('nc.form.accion')}
            </dt>
            <dd className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-200">
              {data.accion || '—'}
            </dd>
          </div>

          {/* Metadata */}
          <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
            {t('nc.detail.created_by', {
              name: data.registrado_por,
              date: formatFecha(data.fecha),
            })}
          </p>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          {/* Status change action (if applicable) */}
          <div>
            {nextStatus && (
              <button
                onClick={() => onStatusChange(nextStatus)}
                disabled={statusChanging}
                className="
                  px-4 py-2 text-sm font-medium rounded-lg
                  bg-blue-600 text-white hover:bg-blue-700
                  transition-colors disabled:opacity-70
                  flex items-center gap-2
                "
              >
                {statusChanging && (
                  <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {nextLabel}
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t('nc.detail.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
