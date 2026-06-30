/**
 * RiForm
 *
 * Modal form for creating or editing a Rechazo Interno.
 *
 * Sections:
 *   1. Información Básica (fecha, license plate, SKU + cascading auto-fill)
 *   2. Defecto & COPQ (CopqSection with auto-fill + manual override)
 *   3. Información Adicional (origen, inspector, observaciones)
 *   4. Fotos (ImageUpload, max 5)
 *   5. Firma Digital (SignatureCaptureSection, MANDATORY)
 *
 * Business rules:
 *   - Signature is MANDATORY — submit is blocked until drawn
 *   - COPQ fields auto-fill on defecto select, locked until manual override
 *   - SKU selection cascades: auto-fills marca, modelo, pulgada, descripcion
 *   - In edit mode: existing photos shown, new uploads appended
 *   - In edit mode: existing signature shown as preview, re-drawing replaces it
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { RechazosInterno, SkuRecord } from '../../types';
import { getCopqMapping } from '../../data/copq-mapping';
import { API_BASE_URL } from '../../config/api';
import SkuAutocomplete from '../SkuAutocomplete';
import ImageUpload from '../ImageUpload';
import CopqSection, { type CopqValues } from './CopqSection';
import SignatureCaptureSection from './SignatureCaptureSection';

// ── Constants ─────────────────────────────────────────────────────────────────

const ORIGENES = ['FFT Lineas', 'FFT Paletizado', 'Almacen', 'Shipping B2B', 'Shipping B2C'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RiFormValues {
  fecha_registro: string;
  license_plate: string;
  sku: string;
  marca: string;
  modelo: string;
  pulgada: string;
  descripcion: string;
  defecto: string;
  actividad_realizar: string;
  costo_no_calidad: number;
  manual_override: boolean;
  origen_hallazgo: string;
  inspector: string;
  observaciones: string;
  firma_digital: string;
  newFiles: File[];
}

type FieldErrors = Partial<Record<
  keyof Omit<RiFormValues, 'newFiles' | 'manual_override'> | 'firma' | 'general',
  string
>>;

interface RiFormProps {
  isOpen: boolean;
  isEditing: boolean;
  data?: RechazosInterno | null;
  onSubmit: (values: RiFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}

interface OrgPerson {
  id: number;
  nombre_completo: string;
  puesto: string;
  estatus: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: RiFormValues = {
  fecha_registro:    today(),
  license_plate:     '',
  sku:               '',
  marca:             '',
  modelo:            '',
  pulgada:           '',
  descripcion:       '',
  defecto:           '',
  actividad_realizar: '',
  costo_no_calidad:  0,
  manual_override:   false,
  origen_hallazgo:   '',
  inspector:         '',
  observaciones:     '',
  firma_digital:     '',
  newFiles:          [],
};

// ── Section label ─────────────────────────────────────────────────────────────

function SectionTitle({ num, label, danger }: { num: number; label: string; danger?: boolean }) {
  return (
    <div className="flex items-center" style={{ gap: 8, marginBottom: 14 }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        background: danger ? '#c0392b' : '#0d2b4e',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {num}
      </span>
      <div className="seccion-titulo" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0, flex: 1 }}>
        {label}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RiForm({
  isOpen,
  isEditing,
  data,
  onSubmit,
  onCancel,
  submitting = false,
}: RiFormProps) {
  const { t } = useTranslation();

  const [values, setValues] = useState<RiFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showSigError, setShowSigError] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // ── Organigrama query (inspectors) ────────────────────────────────────────

  const { data: orgData } = useQuery<{ data: OrgPerson[] } | OrgPerson[]>({
    queryKey: ['organigrama-qc'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/organigrama-qc`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const inspectors: OrgPerson[] = (() => {
    if (!orgData) return [];
    const arr = Array.isArray(orgData) ? orgData : (orgData.data ?? []);
    return arr.filter((p) => p.estatus === 'activo');
  })();

  // ── Populate form on open ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && data) {
      setValues({
        fecha_registro:    data.fecha_registro?.slice(0, 10) ?? today(),
        license_plate:     data.license_plate    ?? '',
        sku:               data.sku              ?? '',
        marca:             data.marca            ?? '',
        modelo:            data.modelo           ?? '',
        pulgada:           data.pulgada          ?? '',
        descripcion:       data.descripcion      ?? '',
        defecto:           data.defecto          ?? '',
        actividad_realizar: data.actividad_realizar ?? '',
        costo_no_calidad:  Number(data.costo_no_calidad) || 0,
        manual_override:   false,
        origen_hallazgo:   data.origen_hallazgo  ?? '',
        inspector:         data.inspector        ?? '',
        observaciones:     data.observaciones    ?? '',
        firma_digital:     data.firma_digital    ?? '',
        newFiles:          [],
      });
    } else {
      setValues({ ...EMPTY_FORM, fecha_registro: today() });
    }

    setErrors({});
    setShowSigError(false);
  }, [isOpen, isEditing, data]);

  // Focus first field on open
  useEffect(() => {
    if (isOpen) setTimeout(() => firstInputRef.current?.focus(), 60);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  // ── Value helpers ─────────────────────────────────────────────────────────

  function set<K extends keyof RiFormValues>(field: K, val: RiFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSkuSelect(record: SkuRecord) {
    setValues((prev) => ({
      ...prev,
      sku:        record.sku,
      marca:      record.marca        ?? '',
      modelo:     record.modelo       ?? '',
      pulgada:    record.pulgada      ?? '',
      descripcion: record.descripcion ?? '',
    }));
  }

  function handleCopqChange(copq: CopqValues) {
    setValues((prev) => ({
      ...prev,
      defecto:            copq.defecto,
      actividad_realizar: copq.actividad_realizar,
      costo_no_calidad:   copq.costo_no_calidad,
      manual_override:    copq.manual_override,
    }));
    setErrors((prev) => ({
      ...prev,
      defecto:            undefined,
      actividad_realizar: undefined,
      costo_no_calidad:   undefined,
    }));
  }

  function handleFilesSelect(files: File[]) {
    setValues((prev) => ({ ...prev, newFiles: files }));
  }

  function handleSignature(dataUrl: string) {
    setValues((prev) => ({ ...prev, firma_digital: dataUrl }));
    if (dataUrl) setShowSigError(false);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: FieldErrors = {};

    if (!values.fecha_registro) e.fecha_registro = t('forms.required_field');
    if (!values.license_plate?.trim()) e.license_plate = t('forms.required_field');
    if (!values.defecto) e.defecto = t('forms.required_field');
    if (!values.actividad_realizar?.trim()) e.actividad_realizar = t('forms.required_field');
    if (!values.origen_hallazgo) e.origen_hallazgo = t('forms.required_field');
    if (!values.inspector?.trim()) e.inspector = t('forms.required_field');

    if (!values.firma_digital) {
      setShowSigError(true);
      e.firma = t('rechazos_internos.form.firma_requerida');
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(values);
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  // ── COPQ section values ───────────────────────────────────────────────────

  const copqValues: CopqValues = {
    defecto:            values.defecto,
    actividad_realizar: values.actividad_realizar,
    costo_no_calidad:   values.costo_no_calidad,
    manual_override:    values.manual_override,
  };

  const canSubmit = !submitting;

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ri-form-title"
      className="fixed inset-0 z-[800] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} aria-hidden="true" />

      {/* Dialog panel */}
      <div
        className="relative z-10 w-full overflow-y-auto"
        style={{ maxWidth: 680, maxHeight: '92vh', background: '#fff', border: '1px solid #e2e2e2' }}
      >

        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between"
          style={{ padding: '16px 24px', borderBottom: '2px solid #0d2b4e', background: '#fff' }}
        >
          <h2 id="ri-form-title" className="modal-titulo" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
            {isEditing
              ? `${t('rechazos_internos.title')} #${data?.id ?? ''} — Editar`
              : t('rechazos_internos.add')}
          </h2>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#777', cursor: 'pointer', padding: '2px 6px' }}
            aria-label={t('common.cancel')}
          >
            &#10005;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ padding: '20px 24px' }}>

            {/* ── Section 1: Información Básica ── */}
            <div style={{ marginBottom: 24 }}>
              <SectionTitle num={1} label="Información Básica" />

              {/* Fecha + License Plate */}
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div>
                  <label htmlFor="ri-fecha">
                    {t('rechazos_internos.form.fecha_registro')}
                    <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    id="ri-fecha"
                    type="date"
                    value={values.fecha_registro}
                    onChange={(e) => set('fecha_registro', e.target.value)}
                    required
                    style={errors.fecha_registro ? { borderColor: '#c0392b' } : undefined}
                  />
                  {errors.fecha_registro && <span className="form-error">{errors.fecha_registro}</span>}
                </div>

                <div>
                  <label htmlFor="ri-lp">
                    {t('rechazos_internos.form.license_plate')}
                    <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                  </label>
                  <input
                    id="ri-lp"
                    type="text"
                    value={values.license_plate}
                    onChange={(e) => set('license_plate', e.target.value.toUpperCase())}
                    placeholder="Ej. MT123456"
                    style={errors.license_plate ? { borderColor: '#c0392b' } : undefined}
                  />
                  {errors.license_plate && <span className="form-error">{errors.license_plate}</span>}
                </div>
              </div>

              {/* SKU Autocomplete */}
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="ri-sku">{t('rechazos_internos.form.sku')}</label>
                <SkuAutocomplete
                  value={values.sku}
                  onChange={(text) => set('sku', text)}
                  onSelect={handleSkuSelect}
                  placeholder={t('sku.search')}
                />
                <p style={{ marginTop: 4, fontSize: 12, color: '#aaa' }}>
                  Seleccione para auto-llenar Marca, Modelo, Pulgada y Descripción
                </p>
              </div>

              {/* Cascaded SKU fields (read-only) */}
              <div className="form-grid" style={{ marginBottom: 12 }}>
                {[
                  { field: 'marca' as const,   label: t('rechazos_internos.form.marca') },
                  { field: 'modelo' as const,   label: t('rechazos_internos.form.modelo') },
                  { field: 'pulgada' as const,  label: t('rechazos_internos.form.pulgada') },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label>{label}</label>
                    <input
                      type="text"
                      value={values[field]}
                      readOnly
                      style={{ background: '#f4f6f9', color: '#777', cursor: 'not-allowed' }}
                    />
                  </div>
                ))}
              </div>

              {/* Descripcion (full width) */}
              {values.descripcion && (
                <div>
                  <label>{t('rechazos_internos.form.descripcion')}</label>
                  <input
                    type="text"
                    value={values.descripcion}
                    readOnly
                    style={{ background: '#f4f6f9', color: '#777', cursor: 'not-allowed' }}
                  />
                </div>
              )}
            </div>

            {/* ── Section 2: Defecto & COPQ ── */}
            <div style={{ marginBottom: 24 }}>
              <SectionTitle num={2} label="Defecto & COPQ" />
              <CopqSection
                values={copqValues}
                onChange={handleCopqChange}
                errors={{
                  defecto:            errors.defecto,
                  actividad_realizar: errors.actividad_realizar,
                  costo_no_calidad:   errors.costo_no_calidad,
                }}
              />
            </div>

            {/* ── Section 3: Información Adicional ── */}
            <div style={{ marginBottom: 24 }}>
              <SectionTitle num={3} label="Información Adicional" />

              <div className="form-grid" style={{ marginBottom: 12 }}>
                {/* Origen Hallazgo */}
                <div>
                  <label htmlFor="ri-origen">
                    {t('rechazos_internos.form.origen_hallazgo')}
                    <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                  </label>
                  <select
                    id="ri-origen"
                    value={values.origen_hallazgo}
                    onChange={(e) => set('origen_hallazgo', e.target.value)}
                    style={errors.origen_hallazgo ? { borderColor: '#c0392b' } : undefined}
                  >
                    <option value="">— Seleccionar —</option>
                    {ORIGENES.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {errors.origen_hallazgo && <span className="form-error">{errors.origen_hallazgo}</span>}
                </div>

                {/* Inspector */}
                <div>
                  <label htmlFor="ri-inspector">
                    {t('rechazos_internos.form.inspector')}
                    <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
                  </label>
                  <select
                    id="ri-inspector"
                    value={values.inspector}
                    onChange={(e) => set('inspector', e.target.value)}
                    style={errors.inspector ? { borderColor: '#c0392b' } : undefined}
                  >
                    <option value="">— Seleccionar Inspector —</option>
                    {inspectors.map((p) => (
                      <option key={p.id} value={p.nombre_completo}>
                        {p.nombre_completo} — {p.puesto}
                      </option>
                    ))}
                    {/* Allow manual entry if not in org chart */}
                    {values.inspector && !inspectors.find((p) => p.nombre_completo === values.inspector) && (
                      <option value={values.inspector}>{values.inspector}</option>
                    )}
                  </select>
                  {errors.inspector && <span className="form-error">{errors.inspector}</span>}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label htmlFor="ri-obs">{t('rechazos_internos.form.observaciones')}</label>
                <textarea
                  id="ri-obs"
                  rows={3}
                  value={values.observaciones}
                  onChange={(e) => set('observaciones', e.target.value)}
                  placeholder="Notas adicionales sobre el rechazo…"
                />
              </div>
            </div>

            {/* ── Section 4: Fotos ── */}
            <div style={{ marginBottom: 24 }}>
              <SectionTitle num={4} label={t('rechazos_internos.form.fotos')} />

              {/* Existing photos in edit mode */}
              {isEditing && data?.images && data.images.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
                    Fotos existentes ({data.images.length})
                  </p>
                  <div className="grid grid-cols-4" style={{ gap: 8 }}>
                    {data.images.map((img) => (
                      <div
                        key={img.id}
                        style={{ aspectRatio: '1', overflow: 'hidden', border: '1px solid #e2e2e2', background: '#f4f6f9' }}
                      >
                        <img src={img.url} alt={img.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New file upload */}
              <ImageUpload
                onFilesSelect={handleFilesSelect}
                maxFiles={5}
                label={`Agregar fotos nuevas (máx 5${isEditing && data?.images?.length ? `, ya tiene ${data.images.length}` : ''})`}
              />
            </div>

            {/* ── Section 5: Firma Digital ── */}
            <div style={{ marginBottom: 8 }}>
              <SectionTitle num={5} label={t('rechazos_internos.form.firma_digital')} danger />

              <SignatureCaptureSection
                signature={values.firma_digital}
                onSignature={handleSignature}
                showError={showSigError}
              />

              {errors.firma && (
                <span className="form-error" style={{ marginTop: 6 }}>{errors.firma}</span>
              )}
            </div>

          </div>

          {/* Footer */}
          <div
            className="sticky bottom-0 z-10 flex items-center justify-between"
            style={{ gap: 12, padding: '14px 24px', borderTop: '1px solid #e2e2e2', background: '#fff' }}
          >
            {/* Signature status */}
            <div style={{ fontSize: 12, color: '#777' }}>
              {values.firma_digital
                ? <span style={{ color: '#2e7d32', fontWeight: 700 }}>Firma capturada</span>
                : <span style={{ color: '#c0392b' }}>Firma requerida para guardar</span>
              }
            </div>
            <div className="btn-grupo">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="btn btn-secundario"
                style={submitting ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn btn-primario"
                style={!canSubmit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {submitting && (
                  <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6 }} />
                )}
                {isEditing ? 'Actualizar' : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
