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

const PUESTOS = ['Jefe QC', 'Supervisor QC', 'Inspector', 'Otro'] as const;
const AREAS   = ['Recepción', 'Almacén', 'Inspección', 'Expedición', 'Otros'] as const;
const TURNOS  = ['Matutino', 'Vespertino', 'Nocturno'] as const;
const SEXOS   = [
  { value: 'M',    labelKey: 'organigrama.sexo.m' },
  { value: 'F',    labelKey: 'organigrama.sexo.f' },
  { value: 'Otro', labelKey: 'organigrama.sexo.otro' },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgFormValues {
  nombre_completo:  string;
  no_empleado:      string;
  sexo:             string;
  fecha_nacimiento: string;
  puesto:           string;
  area:             string;
  turno:            string;
  fecha_ingreso:    string;
  estatus:          string;
  telefono:         string;
  correo:           string;
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
    nombre_completo:  '',
    no_empleado:      '',
    sexo:             '',
    fecha_nacimiento: '',
    puesto:           '',
    area:             '',
    turno:            '',
    fecha_ingreso:    '',
    estatus:          'activo',
    telefono:         '',
    correo:           '',
  };
}

function fromEmployee(emp: OrganigramaQc): OrgFormValues {
  return {
    nombre_completo:  emp.nombre_completo,
    no_empleado:      emp.no_empleado ?? '',
    sexo:             emp.sexo ?? '',
    fecha_nacimiento: emp.fecha_nacimiento ? emp.fecha_nacimiento.slice(0, 10) : '',
    puesto:           emp.puesto,
    area:             emp.area ?? '',
    turno:            emp.turno ?? '',
    fecha_ingreso:    emp.fecha_ingreso ? emp.fecha_ingreso.slice(0, 10) : '',
    estatus:          emp.estatus ?? 'activo',
    telefono:         emp.telefono ?? '',
    correo:           emp.correo ?? '',
  };
}

// ── Existing photo URL ─────────────────────────────────────────────────────────

function existingPhotoUrl(emp: OrganigramaQc | null | undefined): string | null {
  if (!emp?.foto_filename) return null;
  return `${API_BASE_URL}/uploads/organigrama/${emp.foto_filename}`;
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Input({
  name,
  value,
  type = 'text',
  placeholder,
  onChange,
  error,
  disabled,
}: {
  name: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      disabled={disabled}
      className={[
        'block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
        'focus:outline-none focus:ring-1',
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-red-400'
          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
        disabled ? 'cursor-not-allowed bg-gray-100 text-gray-500' : 'bg-white',
      ].join(' ')}
    />
  );
}

function Select({
  name,
  value,
  onChange,
  error,
  disabled,
  children,
}: {
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  error?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={[
        'block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
        'focus:outline-none focus:ring-1',
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-red-400'
          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
        disabled ? 'cursor-not-allowed bg-gray-100 text-gray-500' : 'bg-white',
      ].join(' ')}
    >
      {children}
    </select>
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
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />

      {/* Panel */}
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 truncate pr-4">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            aria-label={t('common.cancel')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate className="overflow-y-auto flex-1 px-6 py-4 space-y-6">

          {/* Section 1: Información Personal */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('organigrama.section_personal')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('organigrama.form.nombre_completo')} required error={errors.nombre_completo}>
                <Input
                  name="nombre_completo"
                  value={values.nombre_completo}
                  onChange={handleChange}
                  error={errors.nombre_completo}
                  disabled={isSubmitting}
                  placeholder="Juan Pérez García"
                />
              </Field>

              <Field label={t('organigrama.form.no_empleado')} required error={errors.no_empleado}>
                <Input
                  name="no_empleado"
                  value={values.no_empleado}
                  onChange={handleChange}
                  error={errors.no_empleado}
                  disabled={isSubmitting}
                  placeholder="EMP-001"
                />
              </Field>

              <Field label={t('organigrama.form.sexo')} required error={errors.sexo}>
                <Select
                  name="sexo"
                  value={values.sexo}
                  onChange={handleChange}
                  error={errors.sexo}
                  disabled={isSubmitting}
                >
                  <option value="">{t('organigrama.seleccionar')}</option>
                  {SEXOS.map((s) => (
                    <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                  ))}
                </Select>
              </Field>

              <Field label={t('organigrama.form.fecha_nacimiento')} error={errors.fecha_nacimiento}>
                <Input
                  name="fecha_nacimiento"
                  type="date"
                  value={values.fecha_nacimiento}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </Field>
            </div>
          </section>

          {/* Section 2: Información Laboral */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('organigrama.section_laboral')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('organigrama.form.puesto')} required error={errors.puesto}>
                <Select
                  name="puesto"
                  value={values.puesto}
                  onChange={handleChange}
                  error={errors.puesto}
                  disabled={isSubmitting}
                >
                  <option value="">{t('organigrama.seleccionar')}</option>
                  {PUESTOS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </Field>

              <Field label={t('organigrama.form.area')} required error={errors.area}>
                <Select
                  name="area"
                  value={values.area}
                  onChange={handleChange}
                  error={errors.area}
                  disabled={isSubmitting}
                >
                  <option value="">{t('organigrama.seleccionar')}</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Select>
              </Field>

              <Field label={t('organigrama.form.turno')} required error={errors.turno}>
                <Select
                  name="turno"
                  value={values.turno}
                  onChange={handleChange}
                  error={errors.turno}
                  disabled={isSubmitting}
                >
                  <option value="">{t('organigrama.seleccionar')}</option>
                  {TURNOS.map((t2) => (
                    <option key={t2} value={t2}>{t2}</option>
                  ))}
                </Select>
              </Field>

              <Field label={t('organigrama.form.fecha_ingreso')} required error={errors.fecha_ingreso}>
                <Input
                  name="fecha_ingreso"
                  type="date"
                  value={values.fecha_ingreso}
                  onChange={handleChange}
                  error={errors.fecha_ingreso}
                  disabled={isSubmitting}
                />
              </Field>

              <Field label={t('organigrama.form.estatus')} required>
                <div className="flex items-center gap-4 pt-1">
                  {(['activo', 'inactivo'] as const).map((val) => (
                    <label key={val} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                      <input
                        type="radio"
                        name="estatus"
                        value={val}
                        checked={values.estatus === val}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        className="h-4 w-4 accent-blue-600"
                      />
                      {val === 'activo'
                        ? t('organigrama.estatus.activo')
                        : t('organigrama.estatus.inactivo')}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          {/* Section 3: Contacto */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('organigrama.section_contacto')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('organigrama.form.telefono')} error={errors.telefono}>
                <Input
                  name="telefono"
                  type="tel"
                  value={values.telefono}
                  onChange={handleChange}
                  error={errors.telefono}
                  disabled={isSubmitting}
                  placeholder="+52 81 1234 5678"
                />
              </Field>

              <Field label={t('organigrama.form.correo')} error={errors.correo}>
                <Input
                  name="correo"
                  type="email"
                  value={values.correo}
                  onChange={handleChange}
                  error={errors.correo}
                  disabled={isSubmitting}
                  placeholder="nombre@empresa.com"
                />
              </Field>
            </div>
          </section>

          {/* Section 4: Foto */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('organigrama.section_foto')}
            </h3>
            <PhotoUploadArea
              currentPhotoUrl={existingPhotoUrl(employee)}
              onFileChange={setPhotoFile}
              disabled={isSubmitting}
            />
          </section>

          {/* Footer buttons — inside form so Enter submits */}
          <div className="flex justify-end gap-3 pt-2 pb-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {isEdit ? t('organigrama.actualizar') : t('common.save')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
