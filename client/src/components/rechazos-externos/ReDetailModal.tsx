/**
 * ReDetailModal — Read-only detail view for a single Rechazo Externo.
 *
 * Shows all fields in grouped sections with a PhotoGallery at the bottom.
 * Supports deleting individual photos (calls onDeletePhoto).
 */

import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import FieldGroup from '../recepciones/FieldGroup';
import PhotoGallery from './PhotoGallery';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/formatters';
import type { RechazosExterno } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReDetailModalProps {
  isOpen: boolean;
  data: RechazosExterno;
  onClose: () => void;
  onDeletePhoto?: (imageId: number) => void;
  isDeletingPhoto?: boolean;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function EstatusBadge({ estatus }: { estatus: RechazosExterno['estatus'] }) {
  const colorMap: Record<RechazosExterno['estatus'], string> = {
    Pendiente:  'bg-yellow-100 text-yellow-800 border-yellow-200',
    Aceptado:   'bg-green-100  text-green-800  border-green-200',
    Rechazado:  'bg-red-100    text-red-800    border-red-200',
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

// ── Main component ────────────────────────────────────────────────────────────

export default function ReDetailModal({
  isOpen,
  data,
  onClose,
  onDeletePhoto,
  isDeletingPhoto = false,
}: ReDetailModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // Derive combined problem + action pairs for display
  const probs   = data.problem_descriptions ?? [];
  const actions = data.corrective_actions   ?? [];
  const problems = probs.map((p) => ({
    descripcion: p.descripcion,
    accion: (actions.find((a) => a.orden === p.orden) ?? actions[0])?.accion ?? '',
  }));

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="re-detail-title"
      className="fixed inset-0 z-[800] flex items-start justify-center overflow-y-auto p-4 sm:items-start"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div className="relative z-10 my-4 w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="re-detail-title" className="text-lg font-semibold text-gray-900">
              {t('rechazos_externos.detail.title')} #{data.id}
            </h2>
            <EstatusBadge estatus={data.estatus} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('common.close')}
          >
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">

          {/* Section 1: Base */}
          <FieldGroup title={t('rechazos_externos.form.section_base')}>
            <DetailField label={t('rechazos_externos.form.return_order')} value={data.return_order} />
            <DetailField label={t('rechazos_externos.form.license_plate')} value={data.license_plate} />
            <DetailField label={t('rechazos_externos.form.classification')} value={data.classification || '—'} />
            <DetailField label={t('rechazos_externos.form.inches')} value={data.inches || '—'} />
            <DetailField label={t('rechazos_externos.form.sales_channel')} value={data.sales_channel || '—'} />
          </FieldGroup>

          {/* Section 2: Product */}
          <FieldGroup title={t('rechazos_externos.form.section_product')}>
            <DetailField label={t('rechazos_externos.form.sku')} value={data.sku || '—'} />
            <DetailField label={t('rechazos_externos.form.brand')} value={data.brand || '—'} />
            <DetailField label={t('rechazos_externos.form.modelo')} value={data.modelo || '—'} />
            <DetailField label={t('rechazos_externos.form.pulgada')} value={data.pulgada || '—'} />
            <DetailField label={t('rechazos_externos.form.descripcion')} value={data.descripcion || '—'} />
          </FieldGroup>

          {/* Section 3: Plant timing */}
          <FieldGroup title={t('rechazos_externos.form.section_plant')}>
            <DetailField
              label={t('rechazos_externos.form.plant_entry')}
              value={data.plant_entry ? formatDateTime(data.plant_entry) : '—'}
            />
            <DetailField
              label={t('rechazos_externos.form.plant_exit')}
              value={data.plant_exit ? formatDateTime(data.plant_exit) : '—'}
            />
            <DetailField
              label={t('rechazos_externos.form.total_time')}
              value={data.total_time_minutes != null ? `${data.total_time_minutes} min` : '—'}
            />
            <DetailField
              label={t('rechazos_externos.form.registration_date')}
              value={data.registration_date ? formatDate(data.registration_date) : '—'}
            />
          </FieldGroup>

          {/* Section 4: Order */}
          <FieldGroup title={t('rechazos_externos.form.section_order')}>
            <DetailField label={t('rechazos_externos.form.outbound_order')} value={data.outbound_order || '—'} />
            <DetailField label={t('rechazos_externos.form.processed_by')}  value={data.processed_by  || '—'} />
          </FieldGroup>

          {/* Section 5: Pricing */}
          <FieldGroup title={t('rechazos_externos.form.section_pricing')}>
            <DetailField
              label={t('rechazos_externos.form.sale_price')}
              value={data.sale_price != null ? formatCurrency(data.sale_price) : '—'}
            />
            <DetailField
              label={t('rechazos_externos.form.estatus')}
              value={<EstatusBadge estatus={data.estatus} />}
            />
            <DetailField label={t('rechazos_externos.form.registrado_por')} value={data.registrado_por || '—'} />
          </FieldGroup>

          {/* Section 6: Problems */}
          {problems.length > 0 && (
            <fieldset className="rounded-lg border border-gray-200 bg-gray-50 px-4 pb-4 pt-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_externos.form.section_problems')}
              </legend>
              <div className="mt-3 space-y-3">
                {problems.map((p, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t('rechazos_externos.form.problem_label', { num: idx + 1 })}
                    </p>
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                        {t('rechazos_externos.form.problem_description')}
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{p.descripcion || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                        {t('rechazos_externos.form.corrective_action')}
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{p.accion || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          {/* Section 7: Photos */}
          <fieldset className="rounded-lg border border-gray-200 bg-gray-50 px-4 pb-4 pt-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('rechazos_externos.form.section_photos')}
              {data.images && data.images.length > 0 && (
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {data.images.length}
                </span>
              )}
            </legend>
            <div className="mt-3">
              <PhotoGallery
                images={data.images ?? []}
                onDelete={onDeletePhoto}
                isDeleting={isDeletingPhoto}
              />
            </div>
          </fieldset>

          {/* Audit metadata */}
          <p className="text-xs text-gray-400">
            {t('rechazos_externos.detail.registered_by', {
              name: data.registrado_por ?? '?',
              date: formatDate(data.created_at),
            })}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
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
