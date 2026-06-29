/**
 * RecepcionDetailModal — Read-only detail view for a single Recepcion.
 *
 * Shows all fields grouped by section, creation metadata, and contextual
 * status-change action buttons:
 *   Confirmado   → "Marcar en Descarga"
 *   En Descarga  → "Marcar Descargado" + "Marcar Rechazado"
 *
 * Data operations (status change, close) are passed in as callbacks;
 * this component is purely presentational.
 */

import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import FieldGroup from './FieldGroup';
import type { Recepcion } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface RecepcionDetailModalProps {
  isOpen: boolean;
  data: Recepcion;
  onClose: () => void;
  /** Called when the user clicks a status-change action button */
  onStatusChange: (newStatus: Recepcion['estatus']) => void;
  isUpdatingStatus?: boolean;
}

// ── Badge helper (re-used from table; kept local to avoid coupling) ─────────

function EstatusBadge({ estatus }: { estatus: Recepcion['estatus'] }) {
  const colorMap: Record<Recepcion['estatus'], string> = {
    Confirmado:    'bg-green-100  text-green-800  border-green-200',
    Pendiente:     'bg-yellow-100 text-yellow-800 border-yellow-200',
    Rechazado:     'bg-red-100    text-red-800    border-red-200',
    'En Descarga': 'bg-blue-100   text-blue-800   border-blue-200',
    Descargado:    'bg-gray-100   text-gray-700   border-gray-200',
  };
  const cls = colorMap[estatus] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${cls}`}>
      {estatus}
    </span>
  );
}

// ── Read-only field ───────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-800">{value ?? '—'}</dd>
    </div>
  );
}

// ── Status action buttons ─────────────────────────────────────────────────────

function StatusActions({
  estatus,
  onStatusChange,
  isUpdating,
}: {
  estatus: Recepcion['estatus'];
  onStatusChange: (s: Recepcion['estatus']) => void;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();

  if (estatus === 'Confirmado') {
    return (
      <button
        type="button"
        disabled={isUpdating}
        onClick={() => onStatusChange('En Descarga')}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isUpdating ? t('common.loading') : t('recepciones.actions.marcar_en_descarga')}
      </button>
    );
  }

  if (estatus === 'En Descarga') {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onStatusChange('Descargado')}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isUpdating ? t('common.loading') : t('recepciones.actions.marcar_descargado')}
        </button>
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onStatusChange('Rechazado')}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isUpdating ? t('common.loading') : t('recepciones.actions.marcar_rechazado')}
        </button>
      </div>
    );
  }

  return null; // Descargado / Rechazado / Pendiente — no action buttons
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecepcionDetailModal({
  isOpen,
  data,
  onClose,
  onStatusChange,
  isUpdatingStatus = false,
}: RecepcionDetailModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const registradoDate = data.fecha_actualizado
    ? new Date(data.fecha_actualizado).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      className="fixed inset-0 z-[800] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 id="detail-modal-title" className="text-lg font-semibold text-gray-900">
              {t('recepciones.detail_title')} #{data.id}
            </h2>
            <EstatusBadge estatus={data.estatus} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">

          {/* Section 1: Información General */}
          <FieldGroup title={t('recepciones.form.section_general')}>
            <DetailField label={t('recepciones.form.fecha')} value={data.fecha} />
            <DetailField label={t('recepciones.form.hora')} value={data.hora.slice(0, 5)} />
            <DetailField label={t('recepciones.form.company')} value={data.company} />
            <DetailField label={t('recepciones.form.origen')} value={data.origen} />
          </FieldGroup>

          {/* Section 2: Carga */}
          <FieldGroup title={t('recepciones.form.section_carga')}>
            <DetailField label={t('recepciones.form.cargo')} value={data.cargo} />
            <DetailField
              label={t('recepciones.form.unit_qty')}
              value={data.unit_qty.toLocaleString()}
            />
            <DetailField
              label={t('recepciones.form.pallet_qty')}
              value={data.pallet_qty.toLocaleString()}
            />
          </FieldGroup>

          {/* Section 3: Logística */}
          <FieldGroup title={t('recepciones.form.section_logistica')}>
            <DetailField
              label={t('recepciones.form.tipo')}
              value={
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {data.tipo}
                </span>
              }
            />
            <DetailField
              label={t('recepciones.form.estatus')}
              value={<EstatusBadge estatus={data.estatus} />}
            />
          </FieldGroup>

          {/* Section 4: Auditoría */}
          <FieldGroup title={t('recepciones.form.section_auditoria')}>
            <DetailField
              label={t('recepciones.form.registrado_por')}
              value={data.registrado_por ?? '—'}
            />
            <DetailField
              label={t('recepciones.form.fecha_actualizado')}
              value={registradoDate}
            />
          </FieldGroup>

          {/* Registration metadata */}
          <p className="text-xs text-gray-400">
            {t('recepciones.registered_by', {
              name: data.registrado_por ?? '?',
              date: data.fecha,
            })}
          </p>
        </div>

        {/* Footer — status actions + close */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <StatusActions
            estatus={data.estatus}
            onStatusChange={onStatusChange}
            isUpdating={isUpdatingStatus}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
