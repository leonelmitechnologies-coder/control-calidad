/**
 * ReForm — Create / Edit modal form for Rechazos Externos.
 *
 * Sections:
 *   1. Información Base        (return_order, license_plate, classification, inches, sales_channel)
 *   2. Producto / SKU          (sku autocomplete + cascading fill: brand/modelo/pulgada/descripcion)
 *   3. Tiempos en Planta       (plant_entry, plant_exit, total_time_minutes — auto-calculated)
 *   4. Información de Orden    (outbound_order, processed_by)
 *   5. Precios y Registro      (sale_price, estatus, registrado_por)
 *   6. Problemas y Acciones    (1–5 ProblemActionRow pairs, with add/remove)
 *   7. Fotos                   (ImageUpload max 10)
 *
 * On submit (create): POST body includes `problems` array + multipart images (two-step).
 * On submit (edit):   PUT body includes `problems` array; photos uploaded separately.
 */

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import SkuAutocomplete from '../SkuAutocomplete';
import ImageUpload from '../ImageUpload';
import ProblemActionRow from './ProblemActionRow';
import FieldGroup, { FieldGroupRow } from '../recepciones/FieldGroup';
import { API_BASE_URL } from '../../config/api';
import type { RechazosExterno, RechazosExternoProblem, SkuRecord } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PROBLEMS = 5;
const MIN_PROBLEMS = 1;

const CLASSIFICATION_OPTIONS = ['A', 'B', 'C', 'D', 'E'];
const SALES_CHANNEL_OPTIONS  = ['Walmart', 'Amazon', 'Liverpool', 'Soriana', 'Coppel', 'Otros'];
const ESTATUS_OPTIONS        = ['Pendiente', 'Aceptado', 'Rechazado'] as const;

// ── Form data shape ───────────────────────────────────────────────────────────

export interface ReFormData {
  return_order: string;
  license_plate: string;
  classification: string;
  inches: string;
  sales_channel: string;
  sku: string;
  brand: string;
  modelo: string;
  pulgada: string;
  descripcion: string;
  plant_entry: string;
  plant_exit: string;
  total_time_minutes: number | null;
  outbound_order: string;
  processed_by: string;
  registration_date: string;
  sale_price: string;
  estatus: string;
  problems: RechazosExternoProblem[];
}

// ── Blank form ────────────────────────────────────────────────────────────────

function makeBlank(): ReFormData {
  const now = new Date().toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
  return {
    return_order:       '',
    license_plate:      '',
    classification:     'A',
    inches:             '',
    sales_channel:      'Walmart',
    sku:                '',
    brand:              '',
    modelo:             '',
    pulgada:            '',
    descripcion:        '',
    plant_entry:        now,
    plant_exit:         now,
    total_time_minutes: null,
    outbound_order:     '',
    processed_by:       '',
    registration_date:  new Date().toISOString().slice(0, 10),
    sale_price:         '',
    estatus:            'Pendiente',
    problems:           [{ descripcion: '', accion: '' }],
  };
}

// ── Derive problems from detail endpoint data ─────────────────────────────────

function deriveProblems(data: RechazosExterno): RechazosExternoProblem[] {
  const probs   = data.problem_descriptions ?? [];
  const actions = data.corrective_actions   ?? [];

  if (probs.length === 0) return [{ descripcion: '', accion: '' }];

  return probs.map((p) => {
    const matched = actions.find((a) => a.orden === p.orden) ?? actions[0];
    return {
      descripcion: p.descripcion,
      accion:      matched?.accion ?? '',
    };
  });
}

// ── Calculate total minutes ───────────────────────────────────────────────────

function calcMinutes(entry: string, exit: string): number | null {
  if (!entry || !exit) return null;
  const diff = new Date(exit).getTime() - new Date(entry).getTime();
  if (isNaN(diff) || diff < 0) return null;
  return Math.round(diff / 60000);
}

// ── Validation ────────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof Omit<ReFormData, 'problems'>, string>> & {
  problems?: Array<{ descripcion?: string; accion?: string }>;
};

function validateForm(form: ReFormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.return_order.trim())  errors.return_order   = 'Requerido';
  if (!form.license_plate.trim()) errors.license_plate  = 'Requerido';
  if (!form.classification)       errors.classification = 'Requerido';
  if (!form.plant_entry)          errors.plant_entry    = 'Requerido';
  if (!form.processed_by.trim())  errors.processed_by   = 'Requerido';

  // Problems validation
  const probErrors = form.problems.map((p) => ({
    descripcion: p.descripcion.trim() ? undefined : 'Requerido',
    accion:      p.accion.trim()      ? undefined : 'Requerido',
  }));
  const hasProbErrors = probErrors.some((e) => e.descripcion || e.accion);
  if (hasProbErrors) errors.problems = probErrors;

  return errors;
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

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

function inputClass(hasError: boolean, readOnly = false) {
  return [
    'block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
    'focus:outline-none focus:ring-2 focus:ring-blue-500',
    hasError  ? 'border-red-400 focus:ring-red-400' : 'border-gray-300',
    readOnly  ? 'cursor-not-allowed bg-gray-50 text-gray-500' : '',
  ].join(' ');
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReFormProps {
  isOpen: boolean;
  isEditing: boolean;
  data?: RechazosExterno;
  onSubmit: (formData: ReFormData, files: File[]) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReForm({
  isOpen,
  isEditing,
  data,
  onSubmit,
  onCancel,
  isSaving = false,
}: ReFormProps) {
  const { t }   = useTranslation();
  const { user } = useAuth();

  const [form,    setForm]    = useState<ReFormData>(makeBlank());
  const [errors,  setErrors]  = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);
  const [files,   setFiles]   = useState<File[]>([]);
  // Track whether SKU fields are manually overridden
  const [skuLocked, setSkuLocked] = useState(true);

  // ── Populate / reset form ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && data) {
      setForm({
        return_order:       data.return_order,
        license_plate:      data.license_plate,
        classification:     data.classification || 'A',
        inches:             data.inches || '',
        sales_channel:      data.sales_channel || 'Walmart',
        sku:                data.sku || '',
        brand:              data.brand || '',
        modelo:             data.modelo || '',
        pulgada:            data.pulgada || '',
        descripcion:        data.descripcion || '',
        plant_entry:        data.plant_entry ? data.plant_entry.slice(0, 16) : '',
        plant_exit:         data.plant_exit  ? data.plant_exit.slice(0, 16)  : '',
        total_time_minutes: data.total_time_minutes ?? null,
        outbound_order:     data.outbound_order || '',
        processed_by:       data.processed_by || '',
        registration_date:  data.registration_date
                              ? data.registration_date.slice(0, 10)
                              : new Date().toISOString().slice(0, 10),
        sale_price:         data.sale_price != null ? String(data.sale_price) : '',
        estatus:            data.estatus || 'Pendiente',
        problems:           deriveProblems(data),
      });
      setSkuLocked(true);
    } else {
      setForm(makeBlank());
      setSkuLocked(true);
    }
    setErrors({});
    setTouched(false);
    setFiles([]);
  }, [isOpen, isEditing, data]);

  // ── Close on Escape ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  // ── Generic field setter ───────────────────────────────────────────────────

  function set<K extends keyof ReFormData>(key: K, value: ReFormData[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Auto-calculate total_time_minutes when plant times change
      if (key === 'plant_entry' || key === 'plant_exit') {
        next.total_time_minutes = calcMinutes(
          key === 'plant_entry' ? (value as string) : f.plant_entry,
          key === 'plant_exit'  ? (value as string) : f.plant_exit,
        );
      }
      if (touched) setErrors(validateForm(next));
      return next;
    });
  }

  // ── SKU selection handler ──────────────────────────────────────────────────

  const handleSkuSelect = useCallback((record: SkuRecord) => {
    setForm((f) => {
      const next = {
        ...f,
        sku:        record.sku,
        brand:      record.marca,
        modelo:     record.modelo,
        pulgada:    record.pulgada,
        descripcion: record.descripcion,
      };
      if (touched) setErrors(validateForm(next));
      return next;
    });
    setSkuLocked(true);
  }, [touched]);

  // ── Problem management ─────────────────────────────────────────────────────

  const handleProblemChange = useCallback(
    (index: number, field: 'descripcion' | 'accion', value: string) => {
      setForm((f) => {
        const updated = f.problems.map((p, i) =>
          i === index ? { ...p, [field]: value } : p,
        );
        const next = { ...f, problems: updated };
        if (touched) setErrors(validateForm(next));
        return next;
      });
    },
    [touched],
  );

  const handleAddProblem = useCallback(() => {
    setForm((f) => {
      if (f.problems.length >= MAX_PROBLEMS) return f;
      return { ...f, problems: [...f.problems, { descripcion: '', accion: '' }] };
    });
  }, []);

  const handleRemoveProblem = useCallback((index: number) => {
    setForm((f) => {
      if (f.problems.length <= MIN_PROBLEMS) return f;
      const updated = f.problems.filter((_, i) => i !== index);
      const next = { ...f, problems: updated };
      if (touched) setErrors(validateForm(next));
      return next;
    });
  }, [touched]);

  // ── Form submit ────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validateForm(form);
    setErrors(errs);
    const hasErrors =
      Object.keys(errs).filter((k) => k !== 'problems').length > 0 ||
      (errs.problems?.some((p) => p.descripcion || p.accion) ?? false);
    if (hasErrors) return;
    onSubmit(form, files);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const title = isEditing
    ? `${t('rechazos_externos.form.edit_title')} #${data?.id ?? ''}`
    : t('rechazos_externos.add');

  const registradoPor = isEditing
    ? (data?.registrado_por ?? user?.name ?? '')
    : (user?.name ?? '');

  const canAddProblem = form.problems.length < MAX_PROBLEMS;

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="re-form-title"
      className="fixed inset-0 z-[800] flex items-start justify-center overflow-y-auto p-4 sm:items-start"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div className="relative z-10 my-4 w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="re-form-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('common.close')}
          >
            &#10005;
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">

            {/* ── Section 1: Información Base ── */}
            <FieldGroup title={t('rechazos_externos.form.section_base')}>
              <Field label={t('rechazos_externos.form.return_order')} required error={errors.return_order}>
                <input
                  type="text"
                  value={form.return_order}
                  onChange={(e) => set('return_order', e.target.value)}
                  className={inputClass(!!errors.return_order)}
                  placeholder="Ej. RO-2024-001"
                />
              </Field>

              <Field label={t('rechazos_externos.form.license_plate')} required error={errors.license_plate}>
                <input
                  type="text"
                  value={form.license_plate}
                  onChange={(e) => set('license_plate', e.target.value)}
                  className={inputClass(!!errors.license_plate)}
                  placeholder="Ej. ABC-1234"
                />
              </Field>

              <Field label={t('rechazos_externos.form.classification')} required error={errors.classification}>
                <select
                  value={form.classification}
                  onChange={(e) => set('classification', e.target.value)}
                  className={inputClass(!!errors.classification)}
                >
                  {CLASSIFICATION_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label={t('rechazos_externos.form.inches')} error={errors.inches}>
                <input
                  type="text"
                  value={form.inches}
                  onChange={(e) => set('inches', e.target.value)}
                  className={inputClass(!!errors.inches)}
                  placeholder='Ej. 55"'
                />
              </Field>

              <Field label={t('rechazos_externos.form.sales_channel')} error={errors.sales_channel} fullWidth>
                <select
                  value={form.sales_channel}
                  onChange={(e) => set('sales_channel', e.target.value)}
                  className={inputClass(!!errors.sales_channel)}
                >
                  {SALES_CHANNEL_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </FieldGroup>

            {/* ── Section 2: Producto / SKU ── */}
            <FieldGroup title={t('rechazos_externos.form.section_product')}>
              <FieldGroupRow>
                <Field label={t('rechazos_externos.form.sku')} required error={errors.sku}>
                  <SkuAutocomplete
                    value={form.sku}
                    onChange={(text) => set('sku', text)}
                    onSelect={handleSkuSelect}
                    placeholder={t('sku.search')}
                  />
                </Field>
              </FieldGroupRow>

              {/* Override checkbox */}
              <FieldGroupRow>
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!skuLocked}
                    onChange={(e) => setSkuLocked(!e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {t('rechazos_externos.form.override_sku_fields')}
                </label>
              </FieldGroupRow>

              <Field label={t('rechazos_externos.form.brand')} error={errors.brand}>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => set('brand', e.target.value)}
                  readOnly={skuLocked}
                  className={inputClass(!!errors.brand, skuLocked)}
                />
              </Field>

              <Field label={t('rechazos_externos.form.modelo')} error={errors.modelo}>
                <input
                  type="text"
                  value={form.modelo}
                  onChange={(e) => set('modelo', e.target.value)}
                  readOnly={skuLocked}
                  className={inputClass(!!errors.modelo, skuLocked)}
                />
              </Field>

              <Field label={t('rechazos_externos.form.pulgada')} error={errors.pulgada}>
                <input
                  type="text"
                  value={form.pulgada}
                  onChange={(e) => set('pulgada', e.target.value)}
                  readOnly={skuLocked}
                  className={inputClass(!!errors.pulgada, skuLocked)}
                />
              </Field>

              <Field label={t('rechazos_externos.form.descripcion')} error={errors.descripcion} fullWidth>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => set('descripcion', e.target.value)}
                  readOnly={skuLocked}
                  className={inputClass(!!errors.descripcion, skuLocked)}
                />
              </Field>
            </FieldGroup>

            {/* ── Section 3: Tiempos en Planta ── */}
            <FieldGroup title={t('rechazos_externos.form.section_plant')}>
              <Field label={t('rechazos_externos.form.plant_entry')} required error={errors.plant_entry}>
                <input
                  type="datetime-local"
                  value={form.plant_entry}
                  onChange={(e) => set('plant_entry', e.target.value)}
                  className={inputClass(!!errors.plant_entry)}
                />
              </Field>

              <Field label={t('rechazos_externos.form.plant_exit')} error={errors.plant_exit}>
                <input
                  type="datetime-local"
                  value={form.plant_exit}
                  onChange={(e) => set('plant_exit', e.target.value)}
                  className={inputClass(!!errors.plant_exit)}
                />
              </Field>

              <Field label={t('rechazos_externos.form.total_time')}>
                <input
                  type="text"
                  value={
                    form.total_time_minutes != null
                      ? `${form.total_time_minutes} min`
                      : '—'
                  }
                  readOnly
                  className={inputClass(false, true)}
                />
              </Field>

              <Field label={t('rechazos_externos.form.registration_date')} error={errors.registration_date}>
                <input
                  type="date"
                  value={form.registration_date}
                  onChange={(e) => set('registration_date', e.target.value)}
                  className={inputClass(!!errors.registration_date)}
                />
              </Field>
            </FieldGroup>

            {/* ── Section 4: Información de Orden ── */}
            <FieldGroup title={t('rechazos_externos.form.section_order')}>
              <Field label={t('rechazos_externos.form.outbound_order')} error={errors.outbound_order}>
                <input
                  type="text"
                  value={form.outbound_order}
                  onChange={(e) => set('outbound_order', e.target.value)}
                  className={inputClass(!!errors.outbound_order)}
                  placeholder="Ej. OO-2024-001"
                />
              </Field>

              <Field label={t('rechazos_externos.form.processed_by')} required error={errors.processed_by}>
                <input
                  type="text"
                  value={form.processed_by}
                  onChange={(e) => set('processed_by', e.target.value)}
                  className={inputClass(!!errors.processed_by)}
                  placeholder={t('rechazos_externos.form.processed_by_placeholder')}
                />
              </Field>
            </FieldGroup>

            {/* ── Section 5: Precios y Estatus ── */}
            <FieldGroup title={t('rechazos_externos.form.section_pricing')}>
              <Field label={t('rechazos_externos.form.sale_price')} error={errors.sale_price}>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.sale_price}
                    onChange={(e) => set('sale_price', e.target.value)}
                    className={inputClass(!!errors.sale_price) + ' pl-7'}
                    placeholder="0.00"
                  />
                </div>
              </Field>

              <Field label={t('rechazos_externos.form.estatus')} required error={errors.estatus}>
                <select
                  value={form.estatus}
                  onChange={(e) => set('estatus', e.target.value)}
                  className={inputClass(!!errors.estatus)}
                >
                  {ESTATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>

              <Field label={t('rechazos_externos.form.registrado_por')}>
                <input
                  type="text"
                  value={registradoPor}
                  readOnly
                  className={inputClass(false, true)}
                />
              </Field>
            </FieldGroup>

            {/* ── Section 6: Problemas y Acciones Correctivas ── */}
            <fieldset className="rounded-lg border border-gray-200 bg-gray-50 px-4 pb-4 pt-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_externos.form.section_problems')}
              </legend>

              <div className="mt-3 space-y-3">
                {form.problems.map((problem, idx) => (
                  <ProblemActionRow
                    key={idx}
                    index={idx}
                    descripcion={problem.descripcion}
                    accion={problem.accion}
                    onChange={handleProblemChange}
                    onRemove={handleRemoveProblem}
                    canRemove={form.problems.length > MIN_PROBLEMS}
                    errors={errors.problems?.[idx]}
                    disabled={isSaving}
                  />
                ))}

                <button
                  type="button"
                  onClick={handleAddProblem}
                  disabled={!canAddProblem || isSaving}
                  className={[
                    'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    canAddProblem
                      ? 'border-blue-300 text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400'
                      : 'cursor-not-allowed border-gray-200 text-gray-400',
                  ].join(' ')}
                >
                  + {t('rechazos_externos.form.add_problem')}
                  <span className="text-xs text-gray-400">
                    ({form.problems.length}/{MAX_PROBLEMS})
                  </span>
                </button>
              </div>
            </fieldset>

            {/* ── Section 7: Fotos ── */}
            <FieldGroup title={t('rechazos_externos.form.section_photos')}>
              <FieldGroupRow>
                <p className="mb-2 text-xs text-gray-500">
                  {t('rechazos_externos.form.max_photos')}
                </p>
                <ImageUpload
                  maxFiles={10}
                  onFilesSelect={setFiles}
                  disabled={isSaving}
                  label={t('rechazos_externos.form.photos')}
                />
              </FieldGroupRow>
            </FieldGroup>

            {/* Existing photos note when editing */}
            {isEditing && data?.images && data.images.length > 0 && (
              <p className="text-xs text-gray-500 italic">
                {t('rechazos_externos.form.existing_photos_note', { count: data.images.length })}
              </p>
            )}

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
              {isEditing ? t('rechazos_externos.form.update') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
