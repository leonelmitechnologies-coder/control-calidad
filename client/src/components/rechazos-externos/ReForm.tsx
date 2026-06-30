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

const DEPARTAMENTOS_RE = ['INCOMING', 'SORTING', 'FFT', 'PALETIZADO', 'OPEN CELL', 'ALMACEN', 'SHIPPING B2C', 'SHIPPING B2B'] as const;

interface CorrectiveAction {
  departamento: string;
  orden:        number;
  accion:       string;
}

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
  corrective_actions: CorrectiveAction[];
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
    corrective_actions: [],
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

type FormErrors = Partial<Record<keyof Omit<ReFormData, 'problems' | 'corrective_actions'>, string>> & {
  problems?: string[];
};

function validateForm(form: ReFormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.return_order.trim())  errors.return_order   = 'Requerido';
  if (!form.license_plate.trim()) errors.license_plate  = 'Requerido';
  if (!form.classification)       errors.classification = 'Requerido';
  if (!form.plant_entry)          errors.plant_entry    = 'Requerido';
  if (!form.processed_by.trim())  errors.processed_by   = 'Requerido';

  const probErrors = form.problems.map((p) =>
    p.descripcion.trim() ? undefined : 'Requerido',
  );
  if (probErrors.some(Boolean)) errors.problems = probErrors as string[];

  return errors;
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
        corrective_actions: (data.corrective_actions ?? []).map((ca) => ({
          departamento: ca.departamento,
          orden:        ca.orden,
          accion:       ca.accion,
        })),
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
    (index: number, value: string) => {
      setForm((f) => {
        const updated = f.problems.map((p, i) =>
          i === index ? { ...p, descripcion: value } : p,
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

  // ── Corrective actions by department ──────────────────────────────────────

  const handleToggleDept = useCallback((dept: string) => {
    setForm((f) => {
      const isActive = f.corrective_actions.some((ca) => ca.departamento === dept);
      const updated = isActive
        ? f.corrective_actions.filter((ca) => ca.departamento !== dept)
        : [...f.corrective_actions, { departamento: dept, orden: f.corrective_actions.length + 1, accion: '' }];
      return { ...f, corrective_actions: updated };
    });
  }, []);

  const handleDeptActionChange = useCallback((dept: string, value: string) => {
    setForm((f) => ({
      ...f,
      corrective_actions: f.corrective_actions.map((ca) =>
        ca.departamento === dept ? { ...ca, accion: value } : ca,
      ),
    }));
  }, []);

  // ── Form submit ────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validateForm(form);
    setErrors(errs);
    const hasErrors =
      Object.keys(errs).filter((k) => k !== 'problems').length > 0 ||
      (errs.problems?.some(Boolean) ?? false);
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

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="re-form-title"
      className="fixed inset-0 z-[800] flex items-start justify-center overflow-y-auto p-4"
      style={{ paddingTop: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} aria-hidden="true" />

      {/* Dialog panel */}
      <div className="relative z-10 my-4 w-full" style={{ maxWidth: 780, background: '#fff', border: '1px solid #e2e2e2' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '16px 24px', borderBottom: '2px solid #0d2b4e' }}>
          <h2 id="re-form-title" className="modal-titulo" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#777', cursor: 'pointer', padding: '2px 6px' }}
            aria-label={t('common.close')}
          >
            &#10005;
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ padding: '20px 24px' }}>

            {/* ── Section 1: Información Base ── */}
            <FieldGroup title={t('rechazos_externos.form.section_base')}>
              <div>
                <label>
                  {t('rechazos_externos.form.return_order')}
                  <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.return_order}
                  onChange={(e) => set('return_order', e.target.value)}
                  placeholder="Ej. RO-2024-001"
                  style={errors.return_order ? { borderColor: '#c0392b' } : undefined}
                />
                {errors.return_order && <span className="form-error">{errors.return_order}</span>}
              </div>

              <div>
                <label>
                  {t('rechazos_externos.form.license_plate')}
                  <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.license_plate}
                  onChange={(e) => set('license_plate', e.target.value)}
                  placeholder="Ej. ABC-1234"
                  style={errors.license_plate ? { borderColor: '#c0392b' } : undefined}
                />
                {errors.license_plate && <span className="form-error">{errors.license_plate}</span>}
              </div>

              <div>
                <label>
                  {t('rechazos_externos.form.classification')}
                  <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                </label>
                <select
                  value={form.classification}
                  onChange={(e) => set('classification', e.target.value)}
                  style={errors.classification ? { borderColor: '#c0392b' } : undefined}
                >
                  {CLASSIFICATION_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.classification && <span className="form-error">{errors.classification}</span>}
              </div>

              <div>
                <label>{t('rechazos_externos.form.inches')}</label>
                <input
                  type="text"
                  value={form.inches}
                  onChange={(e) => set('inches', e.target.value)}
                  placeholder='Ej. 55"'
                />
              </div>

              <div className="full">
                <label>{t('rechazos_externos.form.sales_channel')}</label>
                <select
                  value={form.sales_channel}
                  onChange={(e) => set('sales_channel', e.target.value)}
                >
                  {SALES_CHANNEL_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </FieldGroup>

            {/* ── Section 2: Producto / SKU ── */}
            <FieldGroup title={t('rechazos_externos.form.section_product')}>
              <FieldGroupRow>
                <label>{t('rechazos_externos.form.sku')}</label>
                <SkuAutocomplete
                  value={form.sku}
                  onChange={(text) => set('sku', text)}
                  onSelect={handleSkuSelect}
                  placeholder={t('sku.search')}
                />
              </FieldGroupRow>

              {/* Override checkbox */}
              <FieldGroupRow>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textTransform: 'none', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={!skuLocked}
                    onChange={(e) => setSkuLocked(!e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  {t('rechazos_externos.form.override_sku_fields')}
                </label>
              </FieldGroupRow>

              <div>
                <label>{t('rechazos_externos.form.brand')}</label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => set('brand', e.target.value)}
                  readOnly={skuLocked}
                  style={skuLocked ? { background: '#f4f6f9', color: '#777', cursor: 'not-allowed' } : undefined}
                />
              </div>

              <div>
                <label>{t('rechazos_externos.form.modelo')}</label>
                <input
                  type="text"
                  value={form.modelo}
                  onChange={(e) => set('modelo', e.target.value)}
                  readOnly={skuLocked}
                  style={skuLocked ? { background: '#f4f6f9', color: '#777', cursor: 'not-allowed' } : undefined}
                />
              </div>

              <div>
                <label>{t('rechazos_externos.form.pulgada')}</label>
                <input
                  type="text"
                  value={form.pulgada}
                  onChange={(e) => set('pulgada', e.target.value)}
                  readOnly={skuLocked}
                  style={skuLocked ? { background: '#f4f6f9', color: '#777', cursor: 'not-allowed' } : undefined}
                />
              </div>

              <div className="full">
                <label>{t('rechazos_externos.form.descripcion')}</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => set('descripcion', e.target.value)}
                  readOnly={skuLocked}
                  style={skuLocked ? { background: '#f4f6f9', color: '#777', cursor: 'not-allowed' } : undefined}
                />
              </div>
            </FieldGroup>

            {/* ── Section 3: Tiempos en Planta ── */}
            <FieldGroup title={t('rechazos_externos.form.section_plant')}>
              <div>
                <label>
                  {t('rechazos_externos.form.plant_entry')}
                  <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.plant_entry}
                  onChange={(e) => set('plant_entry', e.target.value)}
                  style={errors.plant_entry ? { borderColor: '#c0392b' } : undefined}
                />
                {errors.plant_entry && <span className="form-error">{errors.plant_entry}</span>}
              </div>

              <div>
                <label>{t('rechazos_externos.form.plant_exit')}</label>
                <input
                  type="datetime-local"
                  value={form.plant_exit}
                  onChange={(e) => set('plant_exit', e.target.value)}
                />
              </div>

              <div>
                <label>{t('rechazos_externos.form.total_time')}</label>
                <input
                  type="text"
                  value={
                    form.total_time_minutes != null
                      ? `${form.total_time_minutes} min`
                      : '—'
                  }
                  readOnly
                  style={{ background: '#f4f6f9', color: '#777', cursor: 'not-allowed' }}
                />
              </div>

              <div>
                <label>{t('rechazos_externos.form.registration_date')}</label>
                <input
                  type="date"
                  value={form.registration_date}
                  onChange={(e) => set('registration_date', e.target.value)}
                />
              </div>
            </FieldGroup>

            {/* ── Section 4: Información de Orden ── */}
            <FieldGroup title={t('rechazos_externos.form.section_order')}>
              <div>
                <label>{t('rechazos_externos.form.outbound_order')}</label>
                <input
                  type="text"
                  value={form.outbound_order}
                  onChange={(e) => set('outbound_order', e.target.value)}
                  placeholder="Ej. OO-2024-001"
                />
              </div>

              <div>
                <label>
                  {t('rechazos_externos.form.processed_by')}
                  <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.processed_by}
                  onChange={(e) => set('processed_by', e.target.value)}
                  placeholder={t('rechazos_externos.form.processed_by_placeholder')}
                  style={errors.processed_by ? { borderColor: '#c0392b' } : undefined}
                />
                {errors.processed_by && <span className="form-error">{errors.processed_by}</span>}
              </div>
            </FieldGroup>

            {/* ── Section 5: Precios y Estatus ── */}
            <FieldGroup title={t('rechazos_externos.form.section_pricing')}>
              <div>
                <label>{t('rechazos_externos.form.sale_price')}</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#777', pointerEvents: 'none', fontSize: 13 }}>
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.sale_price}
                    onChange={(e) => set('sale_price', e.target.value)}
                    placeholder="0.00"
                    style={{ paddingLeft: 22 }}
                  />
                </div>
              </div>

              <div>
                <label>
                  {t('rechazos_externos.form.estatus')}
                  <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                </label>
                <select
                  value={form.estatus}
                  onChange={(e) => set('estatus', e.target.value)}
                >
                  {ESTATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>{t('rechazos_externos.form.registrado_por')}</label>
                <input
                  type="text"
                  value={registradoPor}
                  readOnly
                  style={{ background: '#f4f6f9', color: '#777', cursor: 'not-allowed' }}
                />
              </div>
            </FieldGroup>

            {/* ── Section 6: Problemas y Acciones Correctivas ── */}
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">{t('rechazos_externos.form.section_problems')}</div>

              <div>
                {form.problems.map((problem, idx) => (
                  <ProblemActionRow
                    key={idx}
                    index={idx}
                    descripcion={problem.descripcion}
                    onChange={handleProblemChange}
                    onRemove={handleRemoveProblem}
                    canRemove={form.problems.length > MIN_PROBLEMS}
                    error={errors.problems?.[idx]}
                    disabled={isSaving}
                  />
                ))}

                <button
                  type="button"
                  onClick={handleAddProblem}
                  disabled={!canAddProblem || isSaving}
                  className="btn btn-secundario"
                  style={!canAddProblem ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  + {t('rechazos_externos.form.add_problem')}
                  <span style={{ fontSize: 11, color: '#777', marginLeft: 6 }}>
                    ({form.problems.length}/{MAX_PROBLEMS})
                  </span>
                </button>
              </div>
            </div>

            {/* ── Section 7: Acciones Correctivas por Departamento ── */}
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">Acciones Correctivas por Departamento</div>

              {/* Department chip buttons */}
              <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 16 }}>
                {DEPARTAMENTOS_RE.map((dept) => {
                  const isActive = form.corrective_actions.some((ca) => ca.departamento === dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => handleToggleDept(dept)}
                      disabled={isSaving}
                      style={{
                        background: isActive ? '#0d2b4e' : '#f4f6f9',
                        color: isActive ? '#ffffff' : '#111111',
                        border: '1px solid #e2e2e2',
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        letterSpacing: 0.3,
                      }}
                    >
                      {dept}
                    </button>
                  );
                })}
              </div>

              {/* Active department action cards */}
              <div>
                {form.corrective_actions.map((ca) => (
                  <div key={ca.departamento} style={{ border: '1px solid #0d2b4e', padding: '10px 14px', marginBottom: 8, background: '#fff' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#0d2b4e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      {ca.departamento}
                    </p>
                    <textarea
                      value={ca.accion}
                      onChange={(e) => handleDeptActionChange(ca.departamento, e.target.value)}
                      placeholder="Describir la acción correctiva..."
                      rows={2}
                      disabled={isSaving}
                    />
                  </div>
                ))}

                {form.corrective_actions.length === 0 && (
                  <p style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>
                    Selecciona los departamentos involucrados para agregar acciones correctivas.
                  </p>
                )}
              </div>
            </div>

            {/* ── Section 8: Fotos ── */}
            <FieldGroup title={t('rechazos_externos.form.section_photos')}>
              <FieldGroupRow>
                <p style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
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
              <p style={{ fontSize: 12, color: '#777', fontStyle: 'italic' }}>
                {t('rechazos_externos.form.existing_photos_note', { count: data.images.length })}
              </p>
            )}

          </div>

          {/* Footer */}
          <div className="flex justify-end" style={{ gap: 10, padding: '14px 24px', borderTop: '1px solid #e2e2e2' }}>
            <div className="btn-grupo">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="btn btn-secundario"
                style={isSaving ? { opacity: 0.5 } : undefined}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primario"
                style={isSaving ? { opacity: 0.5 } : undefined}
              >
                {isSaving && (
                  <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6 }} />
                )}
                {isEditing ? t('rechazos_externos.form.update') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
