/**
 * LsForm
 *
 * Modal form for creating or editing a Liberación Shipping record.
 *
 * Sections:
 *   1. Información de Envío (fecha, order_id, destino, referencia)
 *   2. Información del Producto (SKU autocomplete + cascading fields)
 *   3. Contenedor (ContainerFields)
 *   4. Documentación (bill_of_lading, pro_number, purchase_order)
 *   5. Fotos Requeridas (PhotoRequirements — EXACTLY 5)
 *   6. Información Adicional (observaciones, estatus, registrado_por)
 *
 * Photo strategy:
 *   - On CREATE: POST form → get new ID → upload 5 photos to separate endpoints
 *   - On EDIT: PUT form → upload only changed photos to respective endpoints
 *   - Submit button is DISABLED until all 5 photo slots are filled
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { LiberacionShipping, SkuRecord } from '../../types';
import { API_BASE_URL } from '../../config/api';
import SkuAutocomplete from '../SkuAutocomplete';
import ContainerFields, { type ContainerValues } from './ContainerFields';
import PhotoRequirements, {
  type PhotosState,
  type PhotoSlotKey,
  PHOTO_SLOTS,
  countPhotos,
  buildInitialPhotos,
  emptyPhotos,
} from './PhotoRequirements';

// ── Constants ─────────────────────────────────────────────────────────────────

const DESTINOS = [
  'Estados Unidos',
  'Canadá',
  'México',
  'Europa',
  'Asia',
  'Latinoamérica',
  'Otro',
] as const;

const ESTATUS_OPTIONS = [
  'Programado',
  'En Tránsito',
  'Entregado',
  'Cancelado',
] as const;

// Endpoint suffix for each photo slot
const SLOT_ENDPOINT: Record<PhotoSlotKey, string> = {
  contenedor_vacio:   'foto-contenedor-vacio',
  contenedor_cargado: 'foto-contenedor-cargado',
  caja_sellada:       'foto-caja-sellada',
  placas:             'foto-placas',
  manifiesto:         'foto-manifiesto',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LsFormValues {
  // Section 1
  fecha: string;
  order_id: string;
  destino: string;
  referencia: string;
  // Section 2 — SKU cascade
  sku: string;
  marca: string;
  modelo: string;
  pulgada: string;
  descripcion: string;
  // Section 3 — Container (managed via ContainerFields)
  numero_contenedor: string;
  tipo_contenedor: string;
  peso_total: number | '';
  volumen_cubico: number | '';
  // Section 4
  bill_of_lading: string;
  pro_number: string;
  purchase_order: string;
  // Section 6
  observaciones: string;
  estatus: string;
}

type FieldErrors = Partial<Record<
  | 'fecha' | 'order_id' | 'destino' | 'sku'
  | 'numero_contenedor' | 'tipo_contenedor' | 'peso_total' | 'volumen_cubico'
  | 'estatus' | 'fotos' | 'general',
  string
>>;

export interface LsFormProps {
  isOpen: boolean;
  isEditing: boolean;
  data?: LiberacionShipping | null;
  /** Called when form + photo uploads complete */
  onSuccess: () => void;
  onCancel: () => void;
  currentUser?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: LsFormValues = {
  fecha:              today(),
  order_id:           '',
  destino:            '',
  referencia:         '',
  sku:                '',
  marca:              '',
  modelo:             '',
  pulgada:            '',
  descripcion:        '',
  numero_contenedor:  '',
  tipo_contenedor:    '',
  peso_total:         '',
  volumen_cubico:     '',
  bill_of_lading:     '',
  pro_number:         '',
  purchase_order:     '',
  observaciones:      '',
  estatus:            'Programado',
};

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-md border px-3 py-2 text-sm shadow-sm',
    'focus:outline-none focus:ring-2 focus:ring-blue-400',
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-300',
  ].join(' ');
}

function SectionHeader({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
        {num}
      </span>
      {children}
    </h3>
  );
}

// ── API upload helper ─────────────────────────────────────────────────────────

async function uploadPhoto(id: number, slotKey: PhotoSlotKey, file: File): Promise<void> {
  const endpoint = `${API_BASE_URL}/api/liberacion-shipping/${id}/${SLOT_ENDPOINT[slotKey]}`;
  const fd = new FormData();
  fd.append('foto', file);
  const res = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload ${slotKey} failed: ${res.status} ${text}`);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LsForm({
  isOpen,
  isEditing,
  data,
  onSuccess,
  onCancel,
  currentUser = '',
}: LsFormProps) {
  const { t } = useTranslation();

  const [values, setValues]           = useState<LsFormValues>(EMPTY_FORM);
  const [photos, setPhotos]           = useState<PhotosState>(emptyPhotos());
  const [errors, setErrors]           = useState<FieldErrors>({});
  const [showPhotoError, setShowPhotoError] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // ── Photo count ───────────────────────────────────────────────────────────

  const photoCount = countPhotos(photos);
  const photosComplete = photoCount === 5;

  // ── Populate form on open ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && data) {
      setValues({
        fecha:              data.fecha?.slice(0, 10) ?? today(),
        order_id:           data.order_id            ?? '',
        destino:            data.destino             ?? '',
        referencia:         data.referencia          ?? '',
        sku:                data.sku                 ?? '',
        marca:              data.marca               ?? '',
        modelo:             data.modelo              ?? '',
        pulgada:            data.pulgada             ?? '',
        descripcion:        data.descripcion         ?? '',
        numero_contenedor:  data.numero_contenedor   ?? '',
        tipo_contenedor:    data.tipo_contenedor     ?? '',
        peso_total:         data.peso_total != null  ? data.peso_total : '',
        volumen_cubico:     data.volumen_cubico != null ? data.volumen_cubico : '',
        bill_of_lading:     data.bill_of_lading      ?? '',
        pro_number:         data.pro_number          ?? '',
        purchase_order:     data.purchase_order      ?? '',
        observaciones:      data.observaciones       ?? '',
        estatus:            data.estatus             ?? 'Programado',
      });
      setPhotos(buildInitialPhotos(data.fotos));
    } else {
      setValues({ ...EMPTY_FORM, fecha: today() });
      setPhotos(emptyPhotos());
    }

    setErrors({});
    setShowPhotoError(false);
    setSubmitError(null);
  }, [isOpen, isEditing, data]);

  // Focus first field
  useEffect(() => {
    if (isOpen) setTimeout(() => firstInputRef.current?.focus(), 60);
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  // ── Field helpers ─────────────────────────────────────────────────────────

  function set<K extends keyof LsFormValues>(key: K, val: LsFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
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
    setErrors((prev) => ({ ...prev, sku: undefined }));
  }

  function handleContainerChange(container: ContainerValues) {
    setValues((prev) => ({
      ...prev,
      numero_contenedor: container.numero_contenedor,
      tipo_contenedor:   container.tipo_contenedor,
      peso_total:        container.peso_total,
      volumen_cubico:    container.volumen_cubico,
    }));
    setErrors((prev) => ({
      ...prev,
      numero_contenedor: undefined,
      tipo_contenedor:   undefined,
      peso_total:        undefined,
      volumen_cubico:    undefined,
    }));
  }

  function handlePhotoChange(key: PhotoSlotKey, state: { existingUrl?: string; newFile?: File }) {
    setPhotos((prev) => ({ ...prev, [key]: state }));
    setShowPhotoError(false);
    setErrors((prev) => ({ ...prev, fotos: undefined }));
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: FieldErrors = {};

    if (!values.fecha)                       e.fecha               = t('forms.required_field');
    if (!values.order_id.trim())             e.order_id            = t('forms.required_field');
    if (!values.destino)                     e.destino             = t('forms.required_field');
    if (!values.sku.trim())                  e.sku                 = t('forms.required_field');
    if (!values.numero_contenedor.trim())    e.numero_contenedor   = t('forms.required_field');
    if (!values.tipo_contenedor)             e.tipo_contenedor     = t('forms.required_field');
    if (values.peso_total === '')            e.peso_total          = t('forms.required_field');
    if (values.volumen_cubico === '')        e.volumen_cubico      = t('forms.required_field');
    if (!values.estatus)                     e.estatus             = t('forms.required_field');

    if (!photosComplete) {
      e.fotos = t('liberacion_shipping.form.fotos_requeridas');
      setShowPhotoError(true);
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    const body = {
      fecha:              values.fecha,
      order_id:           values.order_id,
      destino:            values.destino,
      referencia:         values.referencia || null,
      sku:                values.sku,
      marca:              values.marca,
      modelo:             values.modelo,
      pulgada:            values.pulgada,
      descripcion:        values.descripcion,
      numero_contenedor:  values.numero_contenedor,
      tipo_contenedor:    values.tipo_contenedor,
      peso_total:         values.peso_total === '' ? null : Number(values.peso_total),
      volumen_cubico:     values.volumen_cubico === '' ? null : Number(values.volumen_cubico),
      bill_of_lading:     values.bill_of_lading || null,
      pro_number:         values.pro_number || null,
      purchase_order:     values.purchase_order || null,
      observaciones:      values.observaciones || null,
      estatus:            values.estatus,
    };

    try {
      let recordId: number;

      if (isEditing && data) {
        // PUT existing record
        const res = await fetch(`${API_BASE_URL}/api/liberacion-shipping/${data.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
          throw new Error(err.error?.message ?? err.error ?? `HTTP ${res.status}`);
        }
        const updated = await res.json();
        recordId = updated.id ?? data.id;
      } else {
        // POST new record
        const res = await fetch(`${API_BASE_URL}/api/liberacion-shipping`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
          throw new Error(err.error?.message ?? err.error ?? `HTTP ${res.status}`);
        }
        const created = await res.json();
        recordId = created.id;
      }

      // Upload photos — only slots that have a new file
      const uploadErrors: string[] = [];
      for (const { key } of PHOTO_SLOTS) {
        const slot = photos[key];
        if (slot.newFile) {
          try {
            await uploadPhoto(recordId, key, slot.newFile);
          } catch (err) {
            uploadErrors.push(String(err));
          }
        }
      }

      if (uploadErrors.length > 0) {
        // Partial success — record saved but some photos failed
        setSubmitError(
          `Registro guardado, pero ${uploadErrors.length} foto(s) no se pudieron subir. Por favor intenta subirlas de nuevo al editar.`
        );
        setSubmitting(false);
        return;
      }

      onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al guardar el registro.');
      setSubmitting(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !submitting) onCancel();
  }

  // ── ContainerValues adapter ────────────────────────────────────────────────

  const containerValues: ContainerValues = {
    numero_contenedor: values.numero_contenedor,
    tipo_contenedor:   values.tipo_contenedor,
    peso_total:        values.peso_total,
    volumen_cubico:    values.volumen_cubico,
  };

  const containerErrors = {
    numero_contenedor: errors.numero_contenedor,
    tipo_contenedor:   errors.tipo_contenedor,
    peso_total:        errors.peso_total,
    volumen_cubico:    errors.volumen_cubico,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ls-form-title"
      className="fixed inset-0 z-[800] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div className="relative z-10 w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl bg-white shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 id="ls-form-title" className="text-lg font-semibold text-gray-900">
            {isEditing
              ? `${t('liberacion_shipping.title')} #${data?.id ?? ''} — Editar`
              : t('liberacion_shipping.add')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label={t('common.cancel')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-7">

            {/* Submit error banner */}
            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* ── Section 1: Información de Envío ── */}
            <section className="space-y-4">
              <SectionHeader num={1}>{t('liberacion_shipping.form.section_envio')}</SectionHeader>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Fecha */}
                <div>
                  <label htmlFor="ls-fecha" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('liberacion_shipping.form.fecha')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    id="ls-fecha"
                    type="date"
                    value={values.fecha}
                    onChange={(e) => set('fecha', e.target.value)}
                    className={inputCls(!!errors.fecha)}
                    disabled={submitting}
                  />
                  {errors.fecha && <p className="mt-1 text-xs text-red-600">{errors.fecha}</p>}
                </div>

                {/* Order ID */}
                <div>
                  <label htmlFor="ls-order-id" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('liberacion_shipping.form.order_id')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="ls-order-id"
                    type="text"
                    value={values.order_id}
                    onChange={(e) => set('order_id', e.target.value)}
                    placeholder="Ej. ORD-2026-001"
                    className={inputCls(!!errors.order_id)}
                    disabled={submitting}
                  />
                  {errors.order_id && <p className="mt-1 text-xs text-red-600">{errors.order_id}</p>}
                </div>

                {/* Destino */}
                <div>
                  <label htmlFor="ls-destino" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('liberacion_shipping.form.destino')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="ls-destino"
                    value={values.destino}
                    onChange={(e) => set('destino', e.target.value)}
                    className={inputCls(!!errors.destino)}
                    disabled={submitting}
                  >
                    <option value="">— Seleccionar —</option>
                    {DESTINOS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {errors.destino && <p className="mt-1 text-xs text-red-600">{errors.destino}</p>}
                </div>

                {/* Referencia */}
                <div>
                  <label htmlFor="ls-referencia" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('liberacion_shipping.form.referencia')}
                  </label>
                  <input
                    id="ls-referencia"
                    type="text"
                    value={values.referencia}
                    onChange={(e) => set('referencia', e.target.value)}
                    placeholder="Referencia opcional"
                    className={inputCls(false)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </section>

            {/* ── Section 2: Información del Producto ── */}
            <section className="space-y-4">
              <SectionHeader num={2}>{t('liberacion_shipping.form.section_producto')}</SectionHeader>

              {/* SKU Autocomplete */}
              <div>
                <label htmlFor="ls-sku" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('liberacion_shipping.form.sku')} <span className="text-red-500">*</span>
                </label>
                <SkuAutocomplete
                  value={values.sku}
                  onChange={(text) => set('sku', text)}
                  onSelect={handleSkuSelect}
                  placeholder={t('sku.search')}
                  disabled={submitting}
                />
                {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku}</p>}
                <p className="mt-1 text-xs text-gray-400">
                  Seleccione para auto-llenar Marca, Modelo, Pulgada y Descripción
                </p>
              </div>

              {/* Cascaded fields (read-only) */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {(
                  [
                    { field: 'marca' as const,  label: t('liberacion_shipping.form.marca') },
                    { field: 'modelo' as const, label: t('liberacion_shipping.form.modelo') },
                    { field: 'pulgada' as const, label: t('liberacion_shipping.form.pulgada') },
                  ]
                ).map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('liberacion_shipping.form.descripcion')}
                </label>
                <input
                  type="text"
                  value={values.descripcion}
                  readOnly
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                />
              </div>
            </section>

            {/* ── Section 3: Contenedor ── */}
            <section className="space-y-4">
              <SectionHeader num={3}>{t('liberacion_shipping.form.section_contenedor')}</SectionHeader>
              <ContainerFields
                values={containerValues}
                errors={containerErrors}
                onChange={handleContainerChange}
                disabled={submitting}
              />
            </section>

            {/* ── Section 4: Documentación ── */}
            <section className="space-y-4">
              <SectionHeader num={4}>{t('liberacion_shipping.form.section_documentacion')}</SectionHeader>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Bill of Lading */}
                <div>
                  <label htmlFor="ls-bol" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('liberacion_shipping.form.bill_of_lading')}
                  </label>
                  <input
                    id="ls-bol"
                    type="text"
                    value={values.bill_of_lading}
                    onChange={(e) => set('bill_of_lading', e.target.value)}
                    placeholder="BOL #"
                    className={inputCls(false)}
                    disabled={submitting}
                  />
                </div>
                {/* Pro Number */}
                <div>
                  <label htmlFor="ls-pro" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('liberacion_shipping.form.pro_number')}
                  </label>
                  <input
                    id="ls-pro"
                    type="text"
                    value={values.pro_number}
                    onChange={(e) => set('pro_number', e.target.value)}
                    placeholder="Pro #"
                    className={inputCls(false)}
                    disabled={submitting}
                  />
                </div>
                {/* Purchase Order */}
                <div>
                  <label htmlFor="ls-po" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('liberacion_shipping.form.purchase_order')}
                  </label>
                  <input
                    id="ls-po"
                    type="text"
                    value={values.purchase_order}
                    onChange={(e) => set('purchase_order', e.target.value)}
                    placeholder="PO #"
                    className={inputCls(false)}
                    disabled={submitting}
                  />
                </div>
              </div>
            </section>

            {/* ── Section 5: Fotos Requeridas ── */}
            <section className="space-y-4">
              <SectionHeader num={5}>
                {t('liberacion_shipping.form.section_fotos')}
                <span
                  className={[
                    'ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    photosComplete
                      ? 'bg-green-100 text-green-700'
                      : errors.fotos
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600',
                  ].join(' ')}
                >
                  {photoCount} / 5
                </span>
              </SectionHeader>

              <PhotoRequirements
                photos={photos}
                onChange={handlePhotoChange}
                showError={showPhotoError}
                disabled={submitting}
              />

              {errors.fotos && !showPhotoError && (
                <p className="text-xs text-red-600">{errors.fotos}</p>
              )}
            </section>

            {/* ── Section 6: Información Adicional ── */}
            <section className="space-y-4">
              <SectionHeader num={6}>{t('liberacion_shipping.form.section_adicional')}</SectionHeader>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Estatus */}
                <div>
                  <label htmlFor="ls-estatus" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('liberacion_shipping.form.estatus')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="ls-estatus"
                    value={values.estatus}
                    onChange={(e) => set('estatus', e.target.value)}
                    className={inputCls(!!errors.estatus)}
                    disabled={submitting}
                  >
                    {ESTATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.estatus && <p className="mt-1 text-xs text-red-600">{errors.estatus}</p>}
                </div>

                {/* Registrado Por (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('liberacion_shipping.form.registrado_por')}
                  </label>
                  <input
                    type="text"
                    value={currentUser}
                    readOnly
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label htmlFor="ls-obs" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('liberacion_shipping.form.observaciones')}
                </label>
                <textarea
                  id="ls-obs"
                  rows={3}
                  value={values.observaciones}
                  onChange={(e) => set('observaciones', e.target.value)}
                  placeholder="Notas adicionales sobre el envío…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={submitting}
                />
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-6 py-4">
            {/* Photo status indicator */}
            <div className="text-xs text-gray-500">
              {photosComplete ? (
                <span className="text-green-600 font-medium">5 fotos cargadas — listo para guardar</span>
              ) : (
                <span className="text-amber-600">
                  {photoCount} de 5 fotos — se requieren todas para guardar
                </span>
              )}
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
                disabled={submitting || !photosComplete}
                title={!photosComplete ? 'Se requieren exactamente 5 fotos' : undefined}
                className={[
                  'inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition-colors',
                  submitting || !photosComplete
                    ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
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
