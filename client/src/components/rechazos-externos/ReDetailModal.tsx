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
import { API_BASE_URL } from '../../config/api';
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
  const badgeMap: Record<RechazosExterno['estatus'], string> = {
    Pendiente: 'pendiente',
    Aceptado:  'aprobado',
    Rechazado: 'rechazado',
  };
  const cls = badgeMap[estatus] ?? 'pendiente';
  return (
    <span className={`badge badge-${cls}`}>
      {estatus}
    </span>
  );
}

// ── Read-only field ───────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#777', marginBottom: 4 }}>
        {label}
      </dt>
      <dd style={{ fontSize: 13, color: '#111', margin: 0 }}>
        {value ?? <span style={{ color: '#aaa', fontStyle: 'italic' }}>—</span>}
      </dd>
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

  const probs   = data.problem_descriptions ?? [];
  const actions = data.corrective_actions   ?? [];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="re-detail-title"
      className="fixed inset-0 z-[800] flex items-start justify-center overflow-y-auto p-4"
      style={{ paddingTop: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} aria-hidden="true" />

      {/* Dialog panel */}
      <div className="relative z-10 my-4 w-full" style={{ maxWidth: 780, background: '#fff', border: '1px solid #e2e2e2' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '16px 24px', borderBottom: '2px solid #0d2b4e' }}>
          <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
            <h2 id="re-detail-title" className="modal-titulo" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
              {t('rechazos_externos.detail.title')} #{data.id}
            </h2>
            <EstatusBadge estatus={data.estatus} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#777', cursor: 'pointer', padding: '2px 6px' }}
            aria-label={t('common.close')}
          >
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

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

          {/* Section 6: Problem descriptions */}
          {probs.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">{t('rechazos_externos.form.section_problems')}</div>
              <div>
                {probs.map((p, idx) => (
                  <div key={idx} style={{ border: '1px solid #e2e2e2', padding: '10px 14px', marginBottom: 8, background: '#fff' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 4 }}>
                      {t('rechazos_externos.form.problem_label', { num: idx + 1 })}
                    </p>
                    <p style={{ fontSize: 13, color: '#111', whiteSpace: 'pre-wrap', margin: 0 }}>{p.descripcion || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 6b: Corrective actions by department */}
          {actions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">Acciones Correctivas por Departamento</div>
              <div>
                {actions.map((ca) => (
                  <div key={ca.id ?? ca.departamento} style={{ border: '1px solid #0d2b4e', padding: '10px 14px', marginBottom: 8, background: '#fff' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 4 }}>
                      {ca.departamento}
                    </p>
                    <p style={{ fontSize: 13, color: '#111', whiteSpace: 'pre-wrap', margin: 0 }}>{ca.accion || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 7: Photos */}
          <div style={{ marginBottom: 20 }}>
            <div className="seccion-titulo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {t('rechazos_externos.form.section_photos')}
              {data.images && data.images.length > 0 && (
                <span style={{ fontSize: 11, background: '#0d2b4e', color: '#fff', padding: '1px 8px', fontWeight: 700 }}>
                  {data.images.length}
                </span>
              )}
            </div>
            <PhotoGallery
              images={data.images ?? []}
              onDelete={onDeletePhoto}
              isDeleting={isDeletingPhoto}
            />
          </div>

          {/* Audit metadata */}
          <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
            {t('rechazos_externos.detail.registered_by', {
              name: data.registrado_por ?? '?',
              date: formatDate(data.created_at),
            })}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between" style={{ padding: '14px 24px', borderTop: '1px solid #e2e2e2' }}>
          <a
            href={`${API_BASE_URL}/api/rechazos-externos/${data.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secundario"
          >
            &#128196; Descargar PDF
          </a>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secundario"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
