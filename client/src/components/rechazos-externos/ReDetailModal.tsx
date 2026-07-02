import { createPortal } from 'react-dom';
import PhotoGallery from './PhotoGallery';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/formatters';
import { API_BASE_URL } from '../../config/api';
import type { RechazosExterno } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReDetailModalProps {
  isOpen:           boolean;
  data:             RechazosExterno;
  onClose:          () => void;
  onEdit:           () => void;
  onDeletePhoto?:   (imageId: number) => void;
  isDeletingPhoto?: boolean;
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

// ── Time formatter ────────────────────────────────────────────────────────────

function formatTime(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReDetailModal({
  isOpen,
  data,
  onClose,
  onEdit,
  onDeletePhoto,
  isDeletingPhoto = false,
}: ReDetailModalProps) {
  if (!isOpen) return null;

  const probs   = data.problem_descriptions ?? [];
  const actions = data.corrective_actions   ?? [];

  // Group corrective actions by dept for display
  const depts = actions.reduce((acc, ca) => {
    if (!acc.includes(ca.departamento)) acc.push(ca.departamento);
    return acc;
  }, [] as string[]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="re-detail-title"
      className="fixed inset-0 z-[800] flex items-start justify-center overflow-y-auto p-4"
      style={{ paddingTop: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} aria-hidden="true" />

      <div className="relative z-10 my-4 w-full" style={{ maxWidth: 780, background: '#fff', border: '1px solid #e2e2e2' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '16px 24px', borderBottom: '2px solid #0d2b4e' }}>
          <h2 id="re-detail-title" className="modal-titulo" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
            Rechazo Externo #{data.id}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#777', cursor: 'pointer', padding: '2px 6px' }}
          >
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* All data fields — 2 column grid */}
          <div className="seccion-titulo">Datos del Rechazo</div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: 24 }}>
            <DetailField label="Return Order"     value={data.return_order} />
            <DetailField label="License Plate"    value={data.license_plate} />
            <DetailField label="Classification"   value={data.classification || '—'} />
            <DetailField label="Inches"           value={data.inches || '—'} />
            <DetailField label="Sales Channel"    value={data.sales_channel || '—'} />
            <DetailField label="SKU"              value={data.sku || '—'} />
            <DetailField label="Brand"            value={data.brand || '—'} />
            <DetailField label="Outbound Order"   value={data.outbound_order || '—'} />
            <DetailField label="Plant Entry"      value={data.plant_entry ? formatDateTime(data.plant_entry) : '—'} />
            <DetailField label="Plant Exit"       value={data.plant_exit  ? formatDateTime(data.plant_exit)  : '—'} />
            <DetailField label="Total Time in Plant" value={formatTime(data.total_time_minutes)} />
            <DetailField label="Processed By"     value={data.processed_by || '—'} />
            <DetailField label="Registration Date" value={data.registration_date ? formatDate(data.registration_date) : '—'} />
            <DetailField label="Sale Price"       value={data.sale_price != null ? formatCurrency(data.sale_price) : '—'} />
            <DetailField label="Registrado por"   value={data.registrado_por || '—'} />
          </dl>

          {/* Evidencia Fotografica */}
          {data.images && data.images.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Evidencia Fotografica
                <span style={{ fontSize: 11, background: '#0d2b4e', color: '#fff', padding: '1px 8px', fontWeight: 700 }}>
                  {data.images.length}
                </span>
              </div>
              <PhotoGallery
                images={data.images}
                onDelete={onDeletePhoto}
                isDeleting={isDeletingPhoto}
              />
            </div>
          )}

          {/* Problem Description */}
          {probs.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">Problem Description</div>
              {probs.map((p, idx) => (
                <div key={idx} style={{ border: '1px solid #e2e2e2', padding: '10px 14px', marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 4 }}>
                    Problema {idx + 1}
                  </p>
                  <p style={{ fontSize: 13, color: '#111', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {p.descripcion || '—'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Corrective Actions */}
          {depts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">Corrective Actions</div>
              {depts.map((dept) => {
                const deptActions = actions.filter((a) => a.departamento === dept);
                return (
                  <div key={dept} style={{ border: '1px solid #0d2b4e', padding: '10px 14px', marginBottom: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 6 }}>
                      {dept}
                    </p>
                    {deptActions.map((a, i) => (
                      <p key={i} style={{ fontSize: 13, color: '#111', whiteSpace: 'pre-wrap', margin: i > 0 ? '8px 0 0' : 0 }}>
                        {deptActions.length > 1 && <span style={{ color: '#999', marginRight: 6 }}>{i + 1}.</span>}
                        {a.accion || '—'}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Audit footer */}
          <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
            Registrado por {data.registrado_por ?? '?'} el {formatDate(data.created_at)}
          </p>
        </div>

        {/* Footer buttons — match monolith: Editar | Generar PDF | + Crear CAPA | Cerrar */}
        <div className="flex items-center justify-between" style={{ padding: '14px 24px', borderTop: '1px solid #e2e2e2' }}>
          <div className="btn-grupo" style={{ marginTop: 0 }}>
            <button type="button" onClick={onEdit} className="btn btn-primario">
              Editar
            </button>
            <a
              href={`${API_BASE_URL}/api/rechazos-externos/${data.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secundario"
            >
              &#128196; Generar PDF
            </a>
            <button
              type="button"
              className="btn btn-secundario"
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
              title="Próximamente"
            >
              + Crear CAPA
            </button>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secundario">
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
