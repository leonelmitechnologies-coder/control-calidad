/**
 * OrgDetailModal
 *
 * Read-only detail view of an OrganigramaQc employee.
 * Shows all fields grouped in sections, a larger profile photo,
 * and action buttons (Editar, Cambiar Estatus, Eliminar).
 * Rendered as a portal-overlay at z-index 800.
 */

import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { OrganigramaQc } from '../../types';
import { API_BASE_URL } from '../../config/api';

// ── Props ─────────────────────────────────────────────────────────────────────

interface OrgDetailModalProps {
  employee:       OrganigramaQc;
  onClose:        () => void;
  onEdit:         () => void;
  onDelete:       () => void;
  onStatusChange: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function photoUrl(emp: OrganigramaQc): string | null {
  if (!emp.foto_filename) return null;
  return `${API_BASE_URL}/uploads/organigrama/${emp.foto_filename}`;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return iso; }
}

// ── Section row ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div
      className="flex justify-between items-baseline"
      style={{ padding: '7px 0', borderBottom: '1px solid #e2e2e2' }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: '#777', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: '#111' }}>{value || '—'}</span>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="seccion-titulo">{title}</div>
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrgDetailModal({
  employee,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}: OrgDetailModalProps) {
  const { t } = useTranslation();
  const photo = photoUrl(employee);

  const sexoLabel: Record<string, string> = {
    M:    t('organigrama.sexo.m'),
    F:    t('organigrama.sexo.f'),
    Otro: t('organigrama.sexo.otro'),
  };

  const modal = (
    <div
      className="fixed inset-0 z-[800] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${t('organigrama.detail_title')}: ${employee.nombre_completo}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg flex flex-col max-h-[90vh] bg-white"
        style={{ border: '1px solid #e2e2e2' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #e2e2e2' }}
        >
          <div className="modal-titulo truncate pr-4" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            {t('organigrama.detail_title')}: {employee.nombre_completo}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#777', lineHeight: 1 }}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">

          {/* Photo + basic info */}
          <div className="flex items-center gap-4" style={{ marginBottom: 20 }}>
            <div
              className="flex-shrink-0 flex items-center justify-center overflow-hidden"
              style={{
                width: 80,
                height: 80,
                border: '2px solid #e2e2e2',
                background: '#f4f6f9',
              }}
            >
              {photo ? (
                <img
                  src={photo}
                  alt={employee.nombre_completo}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 24, fontWeight: 700, color: '#777' }}>
                  {initials(employee.nombre_completo)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 2 }}>{employee.nombre_completo}</p>
              <p style={{ fontSize: 13, color: '#777', marginBottom: 6 }}>{employee.puesto}</p>
              <span className={`badge badge-${employee.estatus === 'activo' ? 'activo' : 'inactivo'}`}>
                {employee.estatus === 'activo'
                  ? t('organigrama.estatus.activo')
                  : t('organigrama.estatus.inactivo')}
              </span>
            </div>
          </div>

          {/* Section: Información Personal */}
          <Section title={t('organigrama.section_personal')}>
            <Row label={t('organigrama.form.no_empleado')} value={employee.no_empleado} />
            <Row label={t('organigrama.form.sexo')} value={sexoLabel[employee.sexo] ?? employee.sexo} />
            <Row label={t('organigrama.form.fecha_nacimiento')} value={formatDate(employee.fecha_nacimiento)} />
          </Section>

          {/* Section: Información Laboral */}
          <Section title={t('organigrama.section_laboral')}>
            <Row label={t('organigrama.form.puesto')} value={employee.puesto} />
            <Row label={t('organigrama.form.area')} value={employee.area} />
            <Row label={t('organigrama.form.turno')} value={employee.turno} />
            <Row label={t('organigrama.form.fecha_ingreso')} value={formatDate(employee.fecha_ingreso)} />
            <Row label={t('organigrama.form.estatus')} value={
              employee.estatus === 'activo'
                ? t('organigrama.estatus.activo')
                : t('organigrama.estatus.inactivo')
            } />
          </Section>

          {/* Section: Contacto */}
          <Section title={t('organigrama.section_contacto')}>
            <Row label={t('organigrama.form.telefono')} value={employee.telefono} />
            <Row label={t('organigrama.form.correo')} value={employee.correo} />
          </Section>

          {/* Metadata */}
          <p style={{ fontSize: 11, color: '#aaa' }}>
            {t('organigrama.registrado_el')} {formatDate(employee.created_at)}
          </p>
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0 flex-wrap gap-2"
          style={{ borderTop: '1px solid #e2e2e2' }}
        >
          <div className="btn-grupo" style={{ marginTop: 0 }}>
            <button
              type="button"
              onClick={onEdit}
              className="btn btn-primario"
            >
              {t('organigrama.edit')}
            </button>
            <button
              type="button"
              onClick={onStatusChange}
              className="btn btn-secundario"
            >
              {t('organigrama.cambiar_estatus')}
            </button>
          </div>
          <div className="btn-grupo" style={{ marginTop: 0 }}>
            <button
              type="button"
              onClick={onDelete}
              className="btn btn-peligro"
            >
              {t('organigrama.delete')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secundario"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
