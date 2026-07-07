import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { RechazosExterno, SkuRecord } from '../../types';
import SkuAutocomplete from '../SkuAutocomplete';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPARTAMENTOS_RE = [
  'INCOMING', 'SORTING', 'FFT', 'PALETIZADO',
  'OPEN CELL', 'ALMACEN', 'SHIPPING B2C', 'SHIPPING B2B',
] as const;

const CLASSIFICATION_OPTIONS = [
  'GRA', 'GRB', 'GRC', 'ICB', 'ICC', 'ICD', 'ICX',
  'BOX', 'DMA', 'DMT', 'POC', 'PEN', 'PNP',
];

// ── SearchableSelect ──────────────────────────────────────────────────────────

interface SearchableSelectProps {
  value:       string;
  options:     string[];
  onChange:    (v: string) => void;
  placeholder?: string;
  hasError?:   boolean;
  disabled?:   boolean;
}

function SearchableSelect({ value, options, onChange, placeholder = 'Escribe o selecciona...', hasError, disabled }: SearchableSelectProps) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function select(opt: string) {
    onChange(opt);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Display input */}
      <div
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px', border: `1px solid ${hasError ? '#c0392b' : open ? '#0d2b4e' : '#ccc'}`,
          background: disabled ? '#f4f6f9' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13, color: value ? '#222' : '#aaa', userSelect: 'none',
          transition: 'border-color 0.15s',
        }}
      >
        <span>{value || placeholder}</span>
        <span style={{ color: '#999', fontSize: 10, marginLeft: 6 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', zIndex: 999, left: 0, right: 0, top: '100%',
          background: '#fff', border: '1px solid #ccc', borderTop: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 220, display: 'flex', flexDirection: 'column',
        }}>
          {/* Search input */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && filtered.length === 1) select(filtered[0]);
              }}
              placeholder="Escribe o selecciona..."
              style={{
                width: '100%', border: '1px solid #e0e0e0', padding: '5px 8px',
                fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Options list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Sin resultados</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt}
                  onMouseDown={() => select(opt)}
                  style={{
                    padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                    background: opt === value ? '#f0f4fa' : '#fff',
                    color: opt === value ? '#0d2b4e' : '#333',
                    fontWeight: opt === value ? 700 : 400,
                    borderBottom: '1px solid #f5f5f5',
                  }}
                  onMouseEnter={(e) => { if (opt !== value) (e.currentTarget as HTMLDivElement).style.background = '#f8f9fa'; }}
                  onMouseLeave={(e) => { if (opt !== value) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                >
                  {opt}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MultiSelect ───────────────────────────────────────────────────────────────

interface MultiSelectProps {
  value:       string;   // comma-separated string stored in DB
  options:     readonly string[];
  onChange:    (v: string) => void;
  placeholder?: string;
  hasError?:   boolean;
  disabled?:   boolean;
}

function MultiSelect({ value, options, onChange, placeholder = 'Selecciona una o más opciones...', hasError, disabled }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef    = useRef<HTMLDivElement>(null);

  const selected = value ? value.split(', ').filter(Boolean) : [];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function toggle(opt: string) {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next.join(', '));
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Display area */}
      <div
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: 36, padding: '5px 10px', flexWrap: 'wrap', gap: 4,
          border: `1px solid ${hasError ? '#c0392b' : open ? '#0d2b4e' : '#ccc'}`,
          background: disabled ? '#f4f6f9' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
          {selected.length === 0 ? (
            <span style={{ fontSize: 13, color: '#aaa' }}>{placeholder}</span>
          ) : (
            selected.map((s) => (
              <span key={s} style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px',
                background: '#e8eef6', color: '#0d2b4e', borderRadius: 3,
              }}>
                {s}
              </span>
            ))
          )}
        </div>
        <span style={{ color: '#999', fontSize: 10, marginLeft: 4, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', zIndex: 999, left: 0, right: 0, top: '100%',
          background: '#fff', border: '1px solid #ccc', borderTop: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto',
        }}>
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <div
                key={opt}
                onMouseDown={(e) => { e.preventDefault(); toggle(opt); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                  background: checked ? '#f0f4fa' : '#fff',
                  borderBottom: '1px solid #f5f5f5',
                  color: checked ? '#0d2b4e' : '#333',
                  fontWeight: checked ? 700 : 400,
                }}
                onMouseEnter={(e) => { if (!checked) (e.currentTarget as HTMLDivElement).style.background = '#f8f9fa'; }}
                onMouseLeave={(e) => { if (!checked) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
              >
                <div style={{
                  width: 16, height: 16, border: `2px solid ${checked ? '#0d2b4e' : '#ccc'}`,
                  borderRadius: 3, background: checked ? '#0d2b4e' : '#fff',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CorrectiveAction {
  departamento: string;
  orden:        number;
  accion:       string;
}

export interface ReFormData {
  return_order:       string;
  license_plate:      string;
  classification:     string;
  inches:             string;
  sales_channel:      string;
  sku:                string;
  brand:              string;
  modelo:             string;
  descripcion:        string;
  outbound_order:     string;
  plant_entry:        string;
  plant_exit:         string;
  total_time_minutes: number | null;
  processed_by:       string;
  registration_date:  string;
  sale_price:         string;
  problems:           { descripcion: string }[];
  corrective_actions: CorrectiveAction[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBlank(): ReFormData {
  const now = new Date().toISOString().slice(0, 16);
  return {
    return_order:       '',
    license_plate:      '',
    classification:     '',
    inches:             '',
    sales_channel:      '',
    sku:                '',
    brand:              '',
    modelo:             '',
    descripcion:        '',
    outbound_order:     '',
    plant_entry:        now,
    plant_exit:         now,
    total_time_minutes: null,
    processed_by:       '',
    registration_date:  new Date().toISOString().slice(0, 10),
    sale_price:         '',
    problems:           [{ descripcion: '' }],
    corrective_actions: [],
  };
}

function calcMinutes(entry: string, exit: string): number | null {
  if (!entry || !exit) return null;
  const diff = new Date(exit).getTime() - new Date(entry).getTime();
  if (isNaN(diff) || diff < 0) return null;
  return Math.round(diff / 60000);
}

function formatTime(minutes: number | null): string {
  if (minutes == null) return '—';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Validation ────────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof Omit<ReFormData, 'problems' | 'corrective_actions'>, string>> & {
  problems?: (string | undefined)[];
};

function validateForm(form: ReFormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.return_order.trim())   errors.return_order   = 'Requerido';
  if (!form.license_plate.trim())  errors.license_plate  = 'Requerido';
  if (!form.classification.trim()) errors.classification = 'Requerido';
  if (!form.plant_entry)           errors.plant_entry    = 'Requerido';
  if (!form.processed_by.trim())   errors.processed_by   = 'Requerido';
  const probErrors = form.problems.map((p) => p.descripcion.trim() ? undefined : 'Requerido');
  if (probErrors.some(Boolean)) errors.problems = probErrors;
  return errors;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReFormProps {
  isOpen:    boolean;
  isEditing: boolean;
  data?:     RechazosExterno;
  onSubmit:  (formData: ReFormData, files: File[]) => void;
  onCancel:  () => void;
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
  const [form,    setForm]    = useState<ReFormData>(makeBlank());
  const [errors,  setErrors]  = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);
  const [files,   setFiles]   = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Populate / reset ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && data) {
      const probs = data.problem_descriptions ?? [];
      setForm({
        return_order:       data.return_order    || '',
        license_plate:      data.license_plate   || '',
        classification:     data.classification || '',
        inches:             data.inches || '',
        sales_channel:      data.sales_channel || '',
        sku:                data.sku || '',
        brand:              data.brand || '',
        modelo:             data.modelo      || '',
        descripcion:        data.descripcion || '',
        outbound_order:     data.outbound_order || '',
        plant_entry:        data.plant_entry ? new Date(data.plant_entry).toISOString().slice(0, 16) : '',
        plant_exit:         data.plant_exit  ? new Date(data.plant_exit).toISOString().slice(0, 16)  : '',
        total_time_minutes: data.total_time_minutes ?? null,
        processed_by:       data.processed_by || '',
        registration_date:  data.registration_date ? data.registration_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        sale_price:         data.sale_price != null ? String(data.sale_price) : '',
        problems:           probs.length > 0 ? probs.map((p) => ({ descripcion: p.descripcion })) : [{ descripcion: '' }],
        corrective_actions: (data.corrective_actions ?? []).map((ca) => ({
          departamento: ca.departamento,
          orden:        ca.orden,
          accion:       ca.accion,
        })),
      });
    } else {
      setForm(makeBlank());
    }
    setErrors({});
    setTouched(false);
    setFiles([]);
  }, [isOpen, isEditing, data]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  // ── Field setter ───────────────────────────────────────────────────────────

  function set<K extends keyof ReFormData>(key: K, value: ReFormData[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
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

  // ── Problem handlers ───────────────────────────────────────────────────────

  const handleProblemChange = useCallback((index: number, value: string) => {
    setForm((f) => {
      const updated = f.problems.map((p, i) => i === index ? { descripcion: value } : p);
      const next = { ...f, problems: updated };
      if (touched) setErrors(validateForm(next));
      return next;
    });
  }, [touched]);

  const handleAddProblem = useCallback(() => {
    setForm((f) => ({ ...f, problems: [...f.problems, { descripcion: '' }] }));
  }, []);

  const handleRemoveProblem = useCallback((index: number) => {
    setForm((f) => {
      if (f.problems.length <= 1) return f;
      const updated = f.problems.filter((_, i) => i !== index);
      const next = { ...f, problems: updated };
      if (touched) setErrors(validateForm(next));
      return next;
    });
  }, [touched]);

  // ── SKU autocomplete ───────────────────────────────────────────────────────

  const handleSkuSelect = useCallback((record: SkuRecord) => {
    setForm((f) => ({
      ...f,
      sku:         record.sku,
      brand:       record.marca        ?? '',
      inches:      record.descripcion  ?? '',  // catalogo_sku: columnas pulgada/descripcion invertidas
      modelo:      record.modelo       ?? '',
      descripcion: record.pulgada      ?? '',  // catalogo_sku: columnas pulgada/descripcion invertidas
    }));
  }, []);

  // ── Corrective action handlers ─────────────────────────────────────────────

  const handleToggleDept = useCallback((dept: string) => {
    setForm((f) => {
      const isActive = f.corrective_actions.some((ca) => ca.departamento === dept);
      if (isActive) {
        return { ...f, corrective_actions: f.corrective_actions.filter((ca) => ca.departamento !== dept) };
      }
      return { ...f, corrective_actions: [...f.corrective_actions, { departamento: dept, orden: 1, accion: '' }] };
    });
  }, []);

  const handleDeptActionChange = useCallback((globalIdx: number, value: string) => {
    setForm((f) => ({
      ...f,
      corrective_actions: f.corrective_actions.map((ca, i) => i === globalIdx ? { ...ca, accion: value } : ca),
    }));
  }, []);

  const handleAddDeptAction = useCallback((dept: string) => {
    setForm((f) => {
      const count = f.corrective_actions.filter((ca) => ca.departamento === dept).length;
      return {
        ...f,
        corrective_actions: [...f.corrective_actions, { departamento: dept, orden: count + 1, accion: '' }],
      };
    });
  }, []);

  const handleRemoveDeptAction = useCallback((globalIdx: number) => {
    setForm((f) => ({
      ...f,
      corrective_actions: f.corrective_actions.filter((_, i) => i !== globalIdx),
    }));
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────

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

  const activeDepts = form.corrective_actions.reduce((acc, ca) => {
    if (!acc.includes(ca.departamento)) acc.push(ca.departamento);
    return acc;
  }, [] as string[]);

  const title = isEditing
    ? `Editar Rechazo Externo #${data?.id ?? ''}`
    : 'Nueva Recepción';

  // ── Render ─────────────────────────────────────────────────────────────────

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
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} aria-hidden="true" />

      <div className="relative z-10 my-4 w-full" style={{ maxWidth: 720, background: '#fff', border: '1px solid #e2e2e2' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '16px 24px', borderBottom: '2px solid #0d2b4e' }}>
          <h2 id="re-form-title" className="modal-titulo" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#777', cursor: 'pointer', padding: '2px 6px' }}
          >
            &#10005;
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ padding: '20px 24px' }}>

            {/* ── Datos del Rechazo ── */}
            <div className="seccion-titulo">Datos del Rechazo</div>
            <div className="form-grid" style={{ marginBottom: 24 }}>

              <div className="form-group">
                <label>Return Order <span style={{ color: '#c0392b' }}>*</span></label>
                <input type="text" value={form.return_order}
                  onChange={(e) => set('return_order', e.target.value)}
                  placeholder="Ej. RO-2024-001"
                  style={errors.return_order ? { borderColor: '#c0392b' } : undefined} />
                {errors.return_order && <span className="form-error">{errors.return_order}</span>}
              </div>

              <div className="form-group">
                <label>License Plate <span style={{ color: '#c0392b' }}>*</span></label>
                <input type="text" value={form.license_plate}
                  onChange={(e) => set('license_plate', e.target.value)}
                  placeholder="Ej. ABC-1234"
                  style={errors.license_plate ? { borderColor: '#c0392b' } : undefined} />
                {errors.license_plate && <span className="form-error">{errors.license_plate}</span>}
              </div>

              <div className="form-group">
                <label>Classification <span style={{ color: '#c0392b' }}>*</span></label>
                <SearchableSelect
                  value={form.classification}
                  options={CLASSIFICATION_OPTIONS}
                  onChange={(v) => set('classification', v)}
                  hasError={!!errors.classification}
                  disabled={isSaving}
                />
                {errors.classification && <span className="form-error">{errors.classification}</span>}
              </div>

              <div className="form-group">
                <label>Inches</label>
                <input type="text" value={form.inches}
                  onChange={(e) => set('inches', e.target.value)}
                  placeholder='Ej. 55"' />
              </div>

              <div className="form-group">
                <label>Sales Channel</label>
                <input type="text" value={form.sales_channel}
                  onChange={(e) => set('sales_channel', e.target.value)}
                  placeholder="Ej. Walmart" />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>SKU</label>
                <SkuAutocomplete
                  value={form.sku}
                  onChange={(text) => set('sku', text)}
                  onSelect={handleSkuSelect}
                  disabled={isSaving}
                  placeholder="Código de producto"
                />
              </div>

              <div className="form-group">
                <label>Brand</label>
                <input type="text" value={form.brand}
                  onChange={(e) => set('brand', e.target.value)} />
              </div>

              <div className="form-group">
                <label>Modelo</label>
                <input type="text" value={form.modelo}
                  onChange={(e) => set('modelo', e.target.value)}
                  placeholder="Ej. UN55TU8000" />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Descripción</label>
                <textarea value={form.descripcion}
                  onChange={(e) => set('descripcion', e.target.value)}
                  rows={2}
                  placeholder="Descripción del producto" />
              </div>

              <div className="form-group">
                <label>Outbound Order</label>
                <input type="text" value={form.outbound_order}
                  onChange={(e) => set('outbound_order', e.target.value)} />
              </div>

              <div className="form-group">
                <label>Plant Entry <span style={{ color: '#c0392b' }}>*</span></label>
                <input type="datetime-local" value={form.plant_entry}
                  onChange={(e) => set('plant_entry', e.target.value)}
                  style={errors.plant_entry ? { borderColor: '#c0392b' } : undefined} />
                {errors.plant_entry && <span className="form-error">{errors.plant_entry}</span>}
              </div>

              <div className="form-group">
                <label>Plant Exit</label>
                <input type="datetime-local" value={form.plant_exit}
                  onChange={(e) => set('plant_exit', e.target.value)} />
              </div>

              <div className="form-group">
                <label>Total Time in Plant</label>
                <input type="text"
                  value={formatTime(form.total_time_minutes)}
                  readOnly
                  style={{ background: '#f4f6f9', color: '#777', cursor: 'not-allowed' }} />
              </div>

              <div className="form-group full">
                <label>Processed By <span style={{ color: '#c0392b' }}>*</span></label>
                <MultiSelect
                  value={form.processed_by}
                  options={DEPARTAMENTOS_RE}
                  onChange={(v) => set('processed_by', v)}
                  hasError={!!errors.processed_by}
                  disabled={isSaving}
                />
                {errors.processed_by && <span className="form-error">{errors.processed_by}</span>}
              </div>

              <div className="form-group">
                <label>Registration Date</label>
                <input type="date" value={form.registration_date}
                  onChange={(e) => set('registration_date', e.target.value)} />
              </div>

              <div className="form-group">
                <label>Sale Price</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#777', pointerEvents: 'none', fontSize: 13 }}>$</span>
                  <input type="number" min={0} step={0.01}
                    value={form.sale_price}
                    onChange={(e) => set('sale_price', e.target.value)}
                    placeholder="0.00"
                    style={{ paddingLeft: 22 }} />
                </div>
              </div>

            </div>

            {/* ── Problem Description ── */}
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">Problem Description</div>
              {form.problems.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#555', paddingTop: 10, minWidth: 18, textAlign: 'right' }}>
                    {idx + 1}.
                  </span>
                  <div style={{ flex: 1 }}>
                    <textarea
                      rows={3}
                      value={p.descripcion}
                      onChange={(e) => handleProblemChange(idx, e.target.value)}
                      disabled={isSaving}
                      placeholder="Describir el problema..."
                      style={errors.problems?.[idx] ? { borderColor: '#c0392b' } : undefined}
                    />
                    {errors.problems?.[idx] && <span className="form-error">{errors.problems[idx]}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveProblem(idx)}
                    disabled={isSaving}
                    style={{
                      visibility: form.problems.length <= 1 ? 'hidden' : 'visible',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 18, color: '#c0392b', paddingTop: 6, flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddProblem}
                disabled={isSaving}
                className="btn btn-secundario"
              >
                + Agregar punto
              </button>
            </div>

            {/* ── Corrective Actions ── */}
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">Corrective Actions</div>

              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#555', marginBottom: 8 }}>
                Departamentos afectados
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 12px', marginBottom: 16 }}>
                {DEPARTAMENTOS_RE.map((dept) => {
                  const isActive = form.corrective_actions.some((ca) => ca.departamento === dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => handleToggleDept(dept)}
                      disabled={isSaving}
                      style={{
                        background:  'none',
                        border:      'none',
                        textAlign:   'left',
                        padding:     '4px 0',
                        fontSize:    12,
                        fontWeight:  isActive ? 700 : 400,
                        color:       isActive ? '#0d2b4e' : '#555',
                        cursor:      'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        textDecoration: isActive ? 'underline' : 'none',
                      }}
                    >
                      {dept}
                    </button>
                  );
                })}
              </div>

              <div>
                {activeDepts.map((dept) => {
                  const deptEntries = form.corrective_actions
                    .map((ca, idx) => ({ ...ca, _idx: idx }))
                    .filter((ca) => ca.departamento === dept);
                  return (
                    <div key={dept} style={{ border: '1px solid #0d2b4e', marginBottom: 8, background: '#fff' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#0d2b4e', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 14px 4px', margin: 0 }}>
                        {dept}
                      </p>
                      {deptEntries.map(({ _idx, accion }) => (
                        <div key={_idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 14px 8px' }}>
                          <textarea
                            value={accion}
                            onChange={(e) => handleDeptActionChange(_idx, e.target.value)}
                            placeholder="Describir la acción correctiva..."
                            rows={2}
                            disabled={isSaving}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveDeptAction(_idx)}
                            disabled={isSaving}
                            style={{
                              visibility: deptEntries.length <= 1 ? 'hidden' : 'visible',
                              background: 'none', border: '1px solid #e2e2e2',
                              width: 28, height: 28, cursor: 'pointer',
                              fontSize: 14, color: '#c0392b', flexShrink: 0, marginTop: 4,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <div style={{ padding: '0 14px 10px' }}>
                        <button
                          type="button"
                          onClick={() => handleAddDeptAction(dept)}
                          disabled={isSaving}
                          className="btn btn-secundario"
                          style={{ fontSize: 12, padding: '4px 12px' }}
                        >
                          + Acción
                        </button>
                      </div>
                    </div>
                  );
                })}
                {activeDepts.length === 0 && (
                  <p style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>
                    Selecciona los departamentos involucrados para agregar acciones correctivas.
                  </p>
                )}
              </div>
            </div>

            {/* ── Evidencia Fotografica ── */}
            <div style={{ marginBottom: 8 }}>
              <div className="seccion-titulo">Evidencia Fotografica</div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={isSaving}
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) setFiles(Array.from(e.target.files));
                }}
              />
              <label
                onClick={() => !isSaving && fileInputRef.current?.click()}
                style={{
                  display:       'block',
                  border:        '2px dashed #cccccc',
                  padding:       '16px',
                  textAlign:     'center',
                  cursor:        isSaving ? 'not-allowed' : 'pointer',
                  fontSize:      11,
                  fontWeight:    700,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color:         '#666',
                }}
              >
                {files.length > 0
                  ? 'Haz clic para agregar más imágenes'
                  : 'Haz clic para agregar imágenes (JPG, PNG, WEBP — MAX 10MB c/u)'}
              </label>
              {files.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {files.map((f, i) => {
                    const url = URL.createObjectURL(f);
                    return (
                      <div key={i} style={{ position: 'relative' }}>
                        <img
                          src={url}
                          alt={f.name}
                          onLoad={() => URL.revokeObjectURL(url)}
                          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                        />
                        <button
                          type="button"
                          onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: '#e53e3e', color: '#fff', cursor: 'pointer', fontSize: 10, lineHeight: '18px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {isEditing && data?.images && data.images.length > 0 && (
                <p style={{ fontSize: 12, color: '#777', fontStyle: 'italic', marginTop: 8 }}>
                  Este registro ya tiene {data.images.length} imagen(es). Las nuevas se agregarán.
                </p>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="flex justify-end" style={{ padding: '14px 24px', borderTop: '1px solid #e2e2e2' }}>
            <div className="btn-grupo">
              <button type="button" onClick={onCancel} disabled={isSaving} className="btn btn-secundario">
                Cancelar
              </button>
              <button type="submit" disabled={isSaving} className="btn btn-primario">
                {isSaving && (
                  <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6 }} />
                )}
                {isEditing ? 'Guardar cambios' : 'Registrar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
