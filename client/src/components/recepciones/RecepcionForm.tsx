/**
 * RecepcionForm — Create / Edit modal form for Recepciones.
 *
 * Grouped into 4 FieldGroup sections:
 *   1. Información General  (fecha, hora, company, origen)
 *   2. Carga               (cargo, unit_qty, pallet_qty)
 *   3. Logística           (tipo, estatus)
 *   4. Auditoría           (registrado_por, fecha_actualizado — read-only)
 *
 * All validation is done before submission; invalid fields get a red border
 * and an inline error message.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import FieldGroup, { FieldGroupRow } from './FieldGroup';
import TipoSelector from './TipoSelector';
import type { Recepcion } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface RecepcionFormProps {
  isOpen: boolean;
  isEditing: boolean;
  data?: Recepcion;
  onSubmit: (data: RecepcionFormData) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ── Form data shape (mirrors server POST/PUT body) ────────────────────────────

export interface RecepcionFormData {
  fecha: string;
  hora: string;
  company: string;
  origen: string;
  cargo: string;
  unit_qty: number;
  pallet_qty: number;
  tipo: Recepcion['tipo'];
  estatus: Recepcion['estatus'];
}

// ── Initial / blank form state ────────────────────────────────────────────────

const BLANK: RecepcionFormData = {
  fecha:      new Date().toISOString().slice(0, 10),
  hora:       '08:00',
  company:    '',
  origen:     '',
  cargo:      'Electrónica',
  unit_qty:   0,
  pallet_qty: 0,
  tipo:       'Import',
  estatus:    'Confirmado',
};

// ── Cargo options ─────────────────────────────────────────────────────────────

const CARGOS = ['Electrónica', 'Accesorios', 'Embalaje', 'Otros'] as const;

// ── Estatus options ───────────────────────────────────────────────────────────

const ESTATUS_OPTS: Recepcion['estatus'][] = [
  'Confirmado',
  'Pendiente',
  'Rechazado',
  'En Descarga',
  'Descargado',
];

// ── Validation ────────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof RecepcionFormData, string>>;

function validate(form: RecepcionFormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.fecha)          errors.fecha      = 'Requerido';
  if (!form.hora)           errors.hora       = 'Requerido';
  if (!form.company.trim()) errors.company    = 'Requerido';
  if (!form.origen.trim())  errors.origen     = 'Requerido';
  if (!form.cargo)          errors.cargo      = 'Requerido';
  if (form.unit_qty < 0)    errors.unit_qty   = 'Debe ser ≥ 0';
  if (form.pallet_qty < 0)  errors.pallet_qty = 'Debe ser ≥ 0';
  if (!form.tipo)           errors.tipo       = 'Requerido';
  if (!form.estatus)        errors.estatus    = 'Requerido';
  return errors;
}

// ── Field label + error wrapper ───────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
  fullWidth = false,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Input classes helper ──────────────────────────────────────────────────────

function inputClass(hasError: boolean) {
  return [
    'block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
    'focus:outline-none focus:ring-2 focus:ring-blue-500',
    hasError
      ? 'border-red-400 focus:ring-red-400'
      : 'border-gray-300',
  ].join(' ');
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecepcionForm({
  isOpen,
  isEditing,
  data,
  onSubmit,
  onCancel,
  isSaving = false,
}: RecepcionFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [form, setForm] = useState<RecepcionFormData>(BLANK);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);

  // Populate form when editing or reset when opening create
  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && data) {
      setForm({
        fecha:      data.fecha,
        hora:       data.hora.slice(0, 5), // strip seconds
        company:    data.company,
        origen:     data.origen,
        cargo:      data.cargo,
        unit_qty:   data.unit_qty,
        pallet_qty: data.pallet_qty,
        tipo:       data.tipo,
        estatus:    data.estatus,
      });
    } else {
      setForm(BLANK);
    }
    setErrors({});
    setTouched(false);
  }, [isOpen, isEditing, data]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  // ── Field updaters ────────────────────────────────────────────────────────

  function set<K extends keyof RecepcionFormData>(key: K, value: RecepcionFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (touched) {
      // Re-validate on change after first submit attempt
      const next = { ...form, [key]: value };
      setErrors(validate(next));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit(form);
  }

  const title = isEditing
    ? `${t('recepciones.form.edit_title')} #${data?.id ?? ''}`
    : t('recepciones.add');

  const now = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  const registradoPor = isEditing ? (data?.registrado_por ?? user?.name ?? '') : (user?.name ?? '');

  return createPortal(
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recepcion-form-title"
      className="fixed inset-0 z-[800] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="recepcion-form-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">

            {/* ── Section 1: Información General ── */}
            <FieldGroup title={t('recepciones.form.section_general')}>
              <Field label={t('recepciones.form.fecha')} required error={errors.fecha}>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => set('fecha', e.target.value)}
                  className={inputClass(!!errors.fecha)}
                  required
                />
              </Field>

              <Field label={t('recepciones.form.hora')} required error={errors.hora}>
                <input
                  type="time"
                  value={form.hora}
                  onChange={(e) => set('hora', e.target.value)}
                  className={inputClass(!!errors.hora)}
                  required
                />
              </Field>

              <Field label={t('recepciones.form.company')} required error={errors.company}>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => set('company', e.target.value)}
                  className={inputClass(!!errors.company)}
                  placeholder="Ej. FedEx MX"
                  required
                />
              </Field>

              <Field label={t('recepciones.form.origen')} required error={errors.origen}>
                <input
                  type="text"
                  value={form.origen}
                  onChange={(e) => set('origen', e.target.value)}
                  className={inputClass(!!errors.origen)}
                  placeholder="Ej. Monterrey, N.L."
                  required
                />
              </Field>
            </FieldGroup>

            {/* ── Section 2: Carga ── */}
            <FieldGroup title={t('recepciones.form.section_carga')}>
              <Field label={t('recepciones.form.cargo')} required error={errors.cargo} fullWidth>
                <select
                  value={form.cargo}
                  onChange={(e) => set('cargo', e.target.value)}
                  className={inputClass(!!errors.cargo)}
                  required
                >
                  {CARGOS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('recepciones.form.unit_qty')} required error={errors.unit_qty}>
                <input
                  type="number"
                  min={0}
                  value={form.unit_qty}
                  onChange={(e) => set('unit_qty', parseInt(e.target.value, 10) || 0)}
                  className={inputClass(!!errors.unit_qty)}
                  required
                />
              </Field>

              <Field label={t('recepciones.form.pallet_qty')} required error={errors.pallet_qty}>
                <input
                  type="number"
                  min={0}
                  value={form.pallet_qty}
                  onChange={(e) => set('pallet_qty', parseInt(e.target.value, 10) || 0)}
                  className={inputClass(!!errors.pallet_qty)}
                  required
                />
              </Field>
            </FieldGroup>

            {/* ── Section 3: Logística ── */}
            <FieldGroup title={t('recepciones.form.section_logistica')}>
              <FieldGroupRow>
                <Field label={t('recepciones.form.tipo')} required error={errors.tipo}>
                  <TipoSelector value={form.tipo} onChange={(v) => set('tipo', v)} />
                </Field>
              </FieldGroupRow>

              <FieldGroupRow>
                <Field label={t('recepciones.form.estatus')} required error={errors.estatus}>
                  <select
                    value={form.estatus}
                    onChange={(e) => set('estatus', e.target.value as Recepcion['estatus'])}
                    className={inputClass(!!errors.estatus)}
                    required
                  >
                    {ESTATUS_OPTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </FieldGroupRow>
            </FieldGroup>

            {/* ── Section 4: Auditoría (read-only) ── */}
            <FieldGroup title={t('recepciones.form.section_auditoria')}>
              <Field label={t('recepciones.form.registrado_por')}>
                <input
                  type="text"
                  value={registradoPor}
                  readOnly
                  className="block w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </Field>

              <Field label={t('recepciones.form.fecha_actualizado')}>
                <input
                  type="text"
                  value={now}
                  readOnly
                  className="block w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </Field>
            </FieldGroup>

          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {isEditing ? t('recepciones.form.update') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
