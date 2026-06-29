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

const ORIGENES = ['Línea', 'Recepción', 'Almacén', 'Expedición', 'Otros'] as const;

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
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl bg-white shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 id="ri-form-title" className="text-lg font-semibold text-gray-900">
            {isEditing
              ? `${t('rechazos_internos.title')} #${data?.id ?? ''} — Editar`
              : t('rechazos_internos.add')}
          </h2>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label={t('common.cancel')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-6">

            {/* ── Section 1: Información Básica ── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                Información Básica
              </h3>

              {/* Fecha + License Plate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ri-fecha" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('rechazos_internos.form.fecha_registro')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    id="ri-fecha"
                    type="date"
                    value={values.fecha_registro}
                    onChange={(e) => set('fecha_registro', e.target.value)}
                    required
                    className={[
                      'w-full rounded-md border px-3 py-2 text-sm shadow-sm',
                      'focus:outline-none focus:ring-2 focus:ring-blue-400',
                      errors.fecha_registro ? 'border-red-400 bg-red-50' : 'border-gray-300',
                    ].join(' ')}
                  />
                  {errors.fecha_registro && <p className="mt-1 text-xs text-red-600">{errors.fecha_registro}</p>}
                </div>

                <div>
                  <label htmlFor="ri-lp" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('rechazos_internos.form.license_plate')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="ri-lp"
                    type="text"
                    value={values.license_plate}
                    onChange={(e) => set('license_plate', e.target.value.toUpperCase())}
                    placeholder="Ej. MT123456"
                    className={[
                      'w-full rounded-md border px-3 py-2 text-sm shadow-sm',
                      'focus:outline-none focus:ring-2 focus:ring-blue-400',
                      errors.license_plate ? 'border-red-400 bg-red-50' : 'border-gray-300',
                    ].join(' ')}
                  />
                  {errors.license_plate && <p className="mt-1 text-xs text-red-600">{errors.license_plate}</p>}
                </div>
              </div>

              {/* SKU Autocomplete */}
              <div>
                <label htmlFor="ri-sku" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('rechazos_internos.form.sku')}
                </label>
                <SkuAutocomplete
                  value={values.sku}
                  onChange={(text) => set('sku', text)}
                  onSelect={handleSkuSelect}
                  placeholder={t('sku.search')}
                />
                <p className="mt-1 text-xs text-gray-400">Seleccione para auto-llenar Marca, Modelo, Pulgada y Descripción</p>
              </div>

              {/* Cascaded SKU fields (read-only) */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { field: 'marca' as const,  label: t('rechazos_internos.form.marca') },
                  { field: 'modelo' as const, label: t('rechazos_internos.form.modelo') },
                  { field: 'pulgada' as const, label: t('rechazos_internos.form.pulgada') },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={values[field]}
                      readOnly
                      className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>

              {/* Descripcion (full width) */}
              {values.descripcion && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('rechazos_internos.form.descripcion')}
                  </label>
                  <input
                    type="text"
                    value={values.descripcion}
                    readOnly
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                  />
                </div>
              )}
            </section>

            {/* ── Section 2: Defecto & COPQ ── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                Defecto & COPQ
              </h3>

              <CopqSection
                values={copqValues}
                onChange={handleCopqChange}
                errors={{
                  defecto:            errors.defecto,
                  actividad_realizar: errors.actividad_realizar,
                  costo_no_calidad:   errors.costo_no_calidad,
                }}
              />
            </section>

            {/* ── Section 3: Información Adicional ── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                Información Adicional
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Origen Hallazgo */}
                <div>
                  <label htmlFor="ri-origen" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('rechazos_internos.form.origen_hallazgo')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="ri-origen"
                    value={values.origen_hallazgo}
                    onChange={(e) => set('origen_hallazgo', e.target.value)}
                    className={[
                      'w-full rounded-md border px-3 py-2 text-sm shadow-sm',
                      'focus:outline-none focus:ring-2 focus:ring-blue-400',
                      errors.origen_hallazgo ? 'border-red-400 bg-red-50' : 'border-gray-300',
                    ].join(' ')}
                  >
                    <option value="">— Seleccionar —</option>
                    {ORIGENES.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {errors.origen_hallazgo && <p className="mt-1 text-xs text-red-600">{errors.origen_hallazgo}</p>}
                </div>

                {/* Inspector */}
                <div>
                  <label htmlFor="ri-inspector" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('rechazos_internos.form.inspector')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="ri-inspector"
                    value={values.inspector}
                    onChange={(e) => set('inspector', e.target.value)}
                    className={[
                      'w-full rounded-md border px-3 py-2 text-sm shadow-sm',
                      'focus:outline-none focus:ring-2 focus:ring-blue-400',
                      errors.inspector ? 'border-red-400 bg-red-50' : 'border-gray-300',
                    ].join(' ')}
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
                  {errors.inspector && <p className="mt-1 text-xs text-red-600">{errors.inspector}</p>}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label htmlFor="ri-obs" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('rechazos_internos.form.observaciones')}
                </label>
                <textarea
                  id="ri-obs"
                  rows={3}
                  value={values.observaciones}
                  onChange={(e) => set('observaciones', e.target.value)}
                  placeholder="Notas adicionales sobre el rechazo…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </section>

            {/* ── Section 4: Fotos ── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">4</span>
                {t('rechazos_internos.form.fotos')}
              </h3>

              {/* Existing photos in edit mode */}
              {isEditing && data?.images && data.images.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-500">Fotos existentes ({data.images.length})</p>
                  <div className="grid grid-cols-4 gap-2">
                    {data.images.map((img) => (
                      <div key={img.id} className="relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                        <img src={img.url} alt={img.filename} className="h-full w-full object-cover" />
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
            </section>

            {/* ── Section 5: Firma Digital ── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">5</span>
                {t('rechazos_internos.form.firma_digital')}
                <span className="text-xs font-normal text-red-500">(obligatorio)</span>
              </h3>

              <SignatureCaptureSection
                signature={values.firma_digital}
                onSignature={handleSignature}
                showError={showSigError}
              />

              {errors.firma && (
                <p className="text-xs text-red-600">{errors.firma}</p>
              )}
            </section>

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-6 py-4">
            {/* Signature status */}
            <div className="text-xs text-gray-500">
              {values.firma_digital
                ? <span className="text-green-600 font-medium">Firma capturada</span>
                : <span className="text-red-500">Firma requerida para guardar</span>
              }
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className={[
                  'inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition-colors',
                  canSubmit
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    : 'cursor-not-allowed bg-gray-300 text-gray-500',
                ].join(' ')}
              >
                {submitting && (
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
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
