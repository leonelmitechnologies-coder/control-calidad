/**
 * OrgForm
 *
 * Create / Edit form modal for an OrganigramaQc employee.
 * Sections: Información Personal, Información Laboral, Contacto, Foto.
 * Validates email format and phone format when provided.
 * Photo is uploaded separately after the record is saved/created.
 * Rendered as a portal at z-index 800.
 */

import { createPortal } from 'react-dom';
import {
  useState,
  useEffect,
  useCallback,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { OrganigramaQc } from '../../types';
import PhotoUploadArea from './PhotoUploadArea';
import { API_BASE_URL } from '../../config/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const PUESTOS = ['Ingeniero de Calidad', 'Supervisor de Calidad', 'Tecnico de Calidad', 'Especialista de Calidad', 'Inspector de Calidad'] as const;
const AREAS   = ['Incoming', 'Sorting', 'FFT', 'Paletizado', 'Almacen', 'Shipping'] as const;
const TURNOS  = ['Turno 1', 'Turno 2'] as const;
const SEXOS   = [
  { value: 'M',    labelKey: 'organigrama.sexo.m' },
  { value: 'F',    labelKey: 'organigrama.sexo.f' },
  { value: 'Otro', labelKey: 'organigrama.sexo.otro' },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgFormValues {
  nombre_completo:      string;
  no_empleado:          string;
  sexo:                 string;
  fecha_nacimiento:     string;
  puesto:               string;
  area:                 string;
  turno:                string;
  fecha_ingreso:        string;
  estatus:              string;
  telefono:             string;
  correo:               string;
  contacto_emergencia:  string;
  tel_emergencia:       string;
}

interface FormErrors {
  nombre_completo?:  string;
  no_empleado?:      string;
  sexo?:             string;
  fecha_nacimiento?: string;
  puesto?:           string;
  area?:             string;
  turno?:            string;
  fecha_ingreso?:    string;
  correo?:           string;
  telefono?:         string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface OrgFormProps {
  /** Null = create mode; populated = edit mode */
  employee?:   OrganigramaQc | null;
  isSubmitting: boolean;
  onSubmit:    (values: OrgFormValues, photoFile: File | null) => void;
  onCancel:    () => void;
}

// ── Validation ────────────────────────────────────────────────────────────────

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE  = /^[+]?[\d\s\-().]{7,20}$/;

function validate(values: OrgFormValues, t: (k: string) => string): FormErrors {
  const errors: FormErrors = {};

  if (!values.nombre_completo.trim())
    errors.nombre_completo = t('forms.required_field');

  if (!values.no_empleado.trim())
    errors.no_empleado = t('forms.required_field');

  if (!values.sexo)
    errors.sexo = t('forms.required_field');

  if (!values.puesto)
    errors.puesto = t('forms.required_field');

  if (!values.area)
    errors.area = t('forms.required_field');

  if (!values.turno)
    errors.turno = t('forms.required_field');

  if (!values.fecha_ingreso)
    errors.fecha_ingreso = t('forms.required_field');

  if (values.correo && !EMAIL_RE.test(values.correo))
    errors.correo = t('forms.invalid_email');

  if (values.telefono && !PHONE_RE.test(values.telefono))
    errors.telefono = t('forms.invalid_phone');

  return errors;
}

// ── Empty form ────────────────────────────────────────────────────────────────

function emptyValues(): OrgFormValues {
  return {
    nombre_completo:      '',
    no_empleado:          '',
    sexo:                 '',
    fecha_nacimiento:     '',
    puesto:               '',
    area:                 '',
    turno:                '',
    fecha_ingreso:        '',
    estatus:              'activo',
    telefono:             '',
    correo:               '',
    contacto_emergencia:  '',
    tel_emergencia:       '',
  };
}

function fromEmployee(emp: OrganigramaQc): OrgFormValues {
  return {
    nombre_completo:      emp.nombre_completo,
    no_empleado:          emp.no_empleado ?? '',
    sexo:                 emp.sexo ?? '',
    fecha_nacimiento:     emp.fecha_nacimiento ? emp.fecha_nacimiento.slice(0, 10) : '',
    puesto:               emp.puesto,
    area:                 emp.area ?? '',
    turno:                emp.turno ?? '',
    fecha_ingreso:        emp.fecha_ingreso ? emp.fecha_ingreso.slice(0, 10) : '',
    estatus:              emp.estatus ?? 'activo',
    telefono:             emp.telefono ?? '',
    correo:               emp.correo ?? '',
    contacto_emergencia:  emp.contactoEmergencia ?? '',
    tel_emergencia:       emp.telEmergencia ?? '',
  };
}

// ── Existing photo URL ─────────────────────────────────────────────────────────

function existingPhotoUrl(emp: OrganigramaQc | null | undefined): string | null {
  if (!emp?.foto_filename) return null;
  return `${API_BASE_URL}/uploads/organigrama/${emp.foto_filename}`;
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="seccion-titulo">{title}</div>
      <div className="form-grid">
        {children}
      </div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrgForm({
  employee,
  isSubmitting,
  onSubmit,
  onCancel,
}: OrgFormProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(employee);

  const [values, setValues] = useState<OrgFormValues>(
    employee ? fromEmployee(employee) : emptyValues(),
  );
  const [errors, setErrors]     = useState<FormErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [touched, setTouched]   = useState(false);

  // Reset when employee prop changes (e.g., opening edit for a different person)
  useEffect(() => {
    setValues(employee ? fromEmployee(employee) : emptyValues());
    setErrors({});
    setPhotoFile(null);
    setTouched(false);
  }, [employee]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setValues((prev) => ({ ...prev, [name]: value }));
      if (touched) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [touched],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errs = validate(values, t);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSubmit(values, photoFile);
  };

  const title = isEdit
    ? `${t('organigrama.edit_title')}: ${employee!.nombre_completo}`
    : t('organigrama.add');

  const modal = (
    <div
      className="fixed inset-0 z-[800] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />

      {/* Panel */}
      <div
        className="relative w-full max-w-2xl flex flex-col max-h-[90vh] bg-white"
        style={{ border: '1px solid #e2e2e2' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #e2e2e2' }}
        >
          <div className="modal-titulo truncate pr-4" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#777', lineHeight: 1 }}
            aria-label={t('common.cancel')}
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate className="overflow-y-auto flex-1 px-6 py-5">

          {/* Section 1: Información Personal */}
          <Section title={t('organigrama.section_personal')}>
            <Field label={t('organigrama.form.nombre_completo')} error={errors.nombre_completo}>
              <input
                name="nombre_completo"
                type="text"
                value={values.nombre_completo}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="Juan Pérez García"
              />
            </Field>

            <Field label={t('organigrama.form.no_empleado')} error={errors.no_empleado}>
              <input
                name="no_empleado"
                type="text"
                value={values.no_empleado}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="EMP-001"
              />
            </Field>

            <Field label={t('organigrama.form.sexo')} error={errors.sexo}>
              <select
                name="sexo"
                value={values.sexo}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="">{t('organigrama.seleccionar')}</option>
                {SEXOS.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
              </select>
            </Field>

            <Field label={t('organigrama.form.fecha_nacimiento')} error={errors.fecha_nacimiento}>
              <input
                name="fecha_nacimiento"
                type="date"
                value={values.fecha_nacimiento}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </Field>
          </Section>

          {/* Section 2: Información Laboral */}
          <Section title={t('organigrama.section_laboral')}>
            <Field label={t('organigrama.form.puesto')} error={errors.puesto}>
              <select
                name="puesto"
                value={values.puesto}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="">{t('organigrama.seleccionar')}</option>
                {PUESTOS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label={t('organigrama.form.area')} error={errors.area}>
              <select
                name="area"
                value={values.area}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="">{t('organigrama.seleccionar')}</option>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Field>

            <Field label={t('organigrama.form.turno')} error={errors.turno}>
              <select
                name="turno"
                value={values.turno}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="">{t('organigrama.seleccionar')}</option>
                {TURNOS.map((t2) => (
                  <option key={t2} value={t2}>{t2}</option>
                ))}
              </select>
            </Field>

            <Field label={t('organigrama.form.fecha_ingreso')} error={errors.fecha_ingreso}>
              <input
                name="fecha_ingreso"
                type="date"
                value={values.fecha_ingreso}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </Field>

            <Field label={t('organigrama.form.estatus')} fullWidth>
              <div className="flex items-center gap-4" style={{ paddingTop: 4 }}>
                {(['activo', 'inactivo'] as const).map((val) => (
                  <label
                    key={val}
                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#111', textTransform: 'none', fontWeight: 400 }}
                  >
                    <input
                      type="radio"
                      name="estatus"
                      value={val}
                      checked={values.estatus === val}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      style={{ width: 'auto', accentColor: '#0d2b4e' }}
                    />
                    {val === 'activo'
                      ? t('organigrama.estatus.activo')
                      : t('organigrama.estatus.inactivo')}
                  </label>
                ))}
              </div>
            </Field>
          </Section>

          {/* Section 3: Contacto */}
          <Section title={t('organigrama.section_contacto')}>
            <Field label={t('organigrama.form.telefono')} error={errors.telefono}>
              <input
                name="telefono"
                type="tel"
                value={values.telefono}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="+52 81 1234 5678"
              />
            </Field>

            <Field label={t('organigrama.form.correo')} error={errors.correo}>
              <input
                name="correo"
                type="email"
                value={values.correo}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="nombre@empresa.com"
              />
            </Field>

            <Field label="Contacto de Emergencia">
              <input
                name="contacto_emergencia"
                type="text"
                value={values.contacto_emergencia}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="Nombre del contacto"
              />
            </Field>

            <Field label="Tel. Emergencia">
              <input
                name="tel_emergencia"
                type="text"
                value={values.tel_emergencia}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="Teléfono de emergencia"
              />
            </Field>
          </Section>

          {/* Section 4: Foto */}
          <div style={{ marginBottom: 24 }}>
            <div className="seccion-titulo">{t('organigrama.section_foto')}</div>
            <PhotoUploadArea
              currentPhotoUrl={existingPhotoUrl(employee)}
              onFileChange={setPhotoFile}
              disabled={isSubmitting}
            />
          </div>

          {/* Footer buttons — inside form so Enter submits */}
          <div className="flex justify-end" style={{ paddingTop: 8, paddingBottom: 4 }}>
            <div className="btn-grupo" style={{ marginTop: 0 }}>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="btn btn-secundario"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primario"
              >
                {isEdit ? t('organigrama.actualizar') : t('common.save')}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
