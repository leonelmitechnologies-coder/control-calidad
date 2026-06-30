/**
 * RecepcionForm — Create / Edit modal form for Recepciones.
 *
 * Grouped into 4 sections:
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
  cargo:      '',
  unit_qty:   0,
  pallet_qty: 0,
  tipo:       'Import',
  estatus:    'Confirmado',
};

// ── Estatus options ───────────────────────────────────────────────────────────

const ESTATUS_OPTS: Recepcion['estatus'][] = [
  'Confirmado',
  'En descarga',
  'Descargado',
  'Rechazado',
];

// ── Autocomplete lists ────────────────────────────────────────────────────────

const COMPANIES: string[] = [
  'JB HUNT', 'OMEGA', 'ARIITRANS', 'TRANE', 'SOLBE', 'MAFER',
  'Jasso Logístics', 'Trucka USA LLC', 'Mi Logístics', 'Absolute', 'TMH',
  'Transportes Dinámicos del Bajio', 'Tres Guerra',
  'Ornex Group S de RL de CV', 'DIMAS', 'ZURDOS EXPRESS',
  'José Gustavo Espinoza Rueda', 'Contreras Nuñes', 'Blue Fox', 'FEMA',
  'Transportes San Miguel', 'PAM Transport', 'ZARO Trucking',
  "NAVA'S TRUCKING", 'ALM', 'OLYMPIC TRANSPORT', 'THERCA',
];

const ORIGENES: string[] = [
  'GB', 'JHONY', 'TJ', 'Groesbeck TX', 'Tijuana BC', 'Manzanillo CO',
  'Johstown NY', 'Spartanburg NY', 'SPASC', 'Bentonville AR', 'Waco TX',
  'Greenfield IN', 'Spartanburg SC', 'Las Vegas NV',
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

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="seccion-titulo">{title}</div>
      <div className="form-grid">
        {children}
      </div>
    </div>
  );
}

// ── Field label + error wrapper ───────────────────────────────────────────────

function Field({
  label,
  error,
  children,
  fullWidth = false,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={['form-group', fullWidth ? 'full' : ''].filter(Boolean).join(' ')}>
      <label>{label}</label>
      {children}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
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
      <div className="relative z-10 w-full max-w-2xl bg-white" style={{ border: '1px solid #e2e2e2' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #e2e2e2' }}
        >
          <div id="recepcion-form-title" className="modal-titulo" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#777', lineHeight: 1 }}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5">

            {/* ── Section 1: Información General ── */}
            <Section title={t('recepciones.form.section_general')}>
              <Field label={t('recepciones.form.fecha')} error={errors.fecha}>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => set('fecha', e.target.value)}
                  required
                />
              </Field>

              <Field label={t('recepciones.form.hora')} error={errors.hora}>
                <input
                  type="time"
                  value={form.hora}
                  onChange={(e) => set('hora', e.target.value)}
                  required
                />
              </Field>

              <Field label={t('recepciones.form.company')} error={errors.company}>
                <input
                  list="companies-list"
                  type="text"
                  value={form.company}
                  onChange={(e) => set('company', e.target.value)}
                  placeholder="Ej. JB HUNT"
                  required
                />
                <datalist id="companies-list">
                  {COMPANIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>

              <Field label={t('recepciones.form.origen')} error={errors.origen}>
                <input
                  list="origenes-list"
                  type="text"
                  value={form.origen}
                  onChange={(e) => set('origen', e.target.value)}
                  placeholder="Ej. Groesbeck TX"
                  required
                />
                <datalist id="origenes-list">
                  {ORIGENES.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </Field>
            </Section>

            {/* ── Section 2: Carga ── */}
            <Section title={t('recepciones.form.section_carga')}>
              <Field label={t('recepciones.form.cargo')} error={errors.cargo} fullWidth>
                <input
                  type="text"
                  value={form.cargo}
                  onChange={(e) => set('cargo', e.target.value)}
                  placeholder="Tipo de mercancía"
                  required
                />
              </Field>

              <Field label={t('recepciones.form.unit_qty')} error={errors.unit_qty}>
                <input
                  type="number"
                  min={0}
                  value={form.unit_qty}
                  onChange={(e) => set('unit_qty', parseInt(e.target.value, 10) || 0)}
                  required
                />
              </Field>

              <Field label={t('recepciones.form.pallet_qty')} error={errors.pallet_qty}>
                <input
                  type="number"
                  min={0}
                  value={form.pallet_qty}
                  onChange={(e) => set('pallet_qty', parseInt(e.target.value, 10) || 0)}
                  required
                />
              </Field>
            </Section>

            {/* ── Section 3: Logística ── */}
            <Section title={t('recepciones.form.section_logistica')}>
              <Field label={t('recepciones.form.tipo')} error={errors.tipo} fullWidth>
                <TipoSelector value={form.tipo} onChange={(v) => set('tipo', v)} />
              </Field>

              <Field label={t('recepciones.form.estatus')} error={errors.estatus} fullWidth>
                <select
                  value={form.estatus}
                  onChange={(e) => set('estatus', e.target.value as Recepcion['estatus'])}
                  required
                >
                  {ESTATUS_OPTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </Section>

            {/* ── Section 4: Auditoría (read-only) ── */}
            <Section title={t('recepciones.form.section_auditoria')}>
              <Field label={t('recepciones.form.registrado_por')}>
                <input
                  type="text"
                  value={registradoPor}
                  readOnly
                  style={{ background: '#f4f6f9', color: '#777', cursor: 'not-allowed' }}
                />
              </Field>

              <Field label={t('recepciones.form.fecha_actualizado')}>
                <input
                  type="text"
                  value={now}
                  readOnly
                  style={{ background: '#f4f6f9', color: '#777', cursor: 'not-allowed' }}
                />
              </Field>
            </Section>

          </div>

          {/* Footer */}
          <div
            className="flex justify-end px-6 py-4"
            style={{ borderTop: '1px solid #e2e2e2' }}
          >
            <div className="btn-grupo" style={{ marginTop: 0 }}>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="btn btn-secundario"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primario"
              >
                {isEditing ? t('recepciones.form.update') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
