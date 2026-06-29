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
    <div className="grid grid-cols-2 gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 text-right">{value || '—'}</dd>
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
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 truncate pr-4">
            {t('organigrama.detail_title')}: {employee.nombre_completo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t('common.close')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-5 flex-1">
          {/* Photo + basic info */}
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
              {photo ? (
                <img
                  src={photo}
                  alt={employee.nombre_completo}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-gray-500">
                  {initials(employee.nombre_completo)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-gray-900 truncate">{employee.nombre_completo}</p>
              <p className="text-sm text-gray-500">{employee.puesto}</p>
              <span
                className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                  employee.estatus === 'activo'
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-red-100 text-red-800 border-red-300'
                }`}
              >
                {employee.estatus === 'activo'
                  ? t('organigrama.estatus.activo')
                  : t('organigrama.estatus.inactivo')}
              </span>
            </div>
          </div>

          {/* Section: Información Personal */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('organigrama.section_personal')}
            </h3>
            <dl className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-1">
              <Row label={t('organigrama.form.no_empleado')} value={employee.no_empleado} />
              <Row label={t('organigrama.form.sexo')} value={sexoLabel[employee.sexo] ?? employee.sexo} />
              <Row label={t('organigrama.form.fecha_nacimiento')} value={formatDate(employee.fecha_nacimiento)} />
            </dl>
          </section>

          {/* Section: Información Laboral */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('organigrama.section_laboral')}
            </h3>
            <dl className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-1">
              <Row label={t('organigrama.form.puesto')} value={employee.puesto} />
              <Row label={t('organigrama.form.area')} value={employee.area} />
              <Row label={t('organigrama.form.turno')} value={employee.turno} />
              <Row label={t('organigrama.form.fecha_ingreso')} value={formatDate(employee.fecha_ingreso)} />
              <Row label={t('organigrama.form.estatus')} value={
                employee.estatus === 'activo'
                  ? t('organigrama.estatus.activo')
                  : t('organigrama.estatus.inactivo')
              } />
            </dl>
          </section>

          {/* Section: Contacto */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('organigrama.section_contacto')}
            </h3>
            <dl className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-1">
              <Row label={t('organigrama.form.telefono')} value={employee.telefono} />
              <Row label={t('organigrama.form.correo')} value={employee.correo} />
            </dl>
          </section>

          {/* Metadata */}
          <p className="text-xs text-gray-400">
            {t('organigrama.registrado_el')} {formatDate(employee.created_at)}
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 flex-shrink-0 gap-2 flex-wrap">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('organigrama.edit')}
            </button>
            <button
              type="button"
              onClick={onStatusChange}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              {t('organigrama.cambiar_estatus')}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              {t('organigrama.delete')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
