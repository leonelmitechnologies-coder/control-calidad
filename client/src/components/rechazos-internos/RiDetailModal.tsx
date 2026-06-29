/**
 * RiDetailModal
 *
 * Read-only detail view for a Rechazo Interno record.
 *
 * Sections:
 *   1. Información Básica (fecha, license plate, SKU cascade fields)
 *   2. COPQ mapping display: "Defecto → Actividad → Costo"
 *   3. Información Adicional (origen, inspector, observaciones)
 *   4. Fotos — thumbnail grid with lightbox on click
 *   5. Firma Digital — signature preview
 *   6. Auditoría (registrado_por, created_at)
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { RechazosInterno } from '../../types';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { getCopqMapping } from '../../data/copq-mapping';
import { API_BASE_URL } from '../../config/api';
import SignatureCaptureSection from './SignatureCaptureSection';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RiDetailModalProps {
  id: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// ── API helper ────────────────────────────────────────────────────────────────

async function fetchDetail(id: number): Promise<RechazosInterno> {
  const res = await fetch(`${API_BASE_URL}/api/rechazos-internos/${id}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

// ── Field pair helper ─────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-800 break-words">
        {value || <span className="italic text-gray-400">—</span>}
      </dd>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RiDetailModal({ id, isOpen, onClose }: RiDetailModalProps) {
  const { t } = useTranslation();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const { data: ri, isLoading, isError } = useQuery<RechazosInterno>({
    queryKey: ['ri-detail', id],
    queryFn: () => fetchDetail(id!),
    enabled: isOpen && id !== null,
    staleTime: 30_000,
  });

  if (!isOpen) return null;

  const mappingEntry = ri ? getCopqMapping(ri.defecto) : null;
  const images = ri?.images ?? [];
  const signature = ri?.firma_digital || '';

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return createPortal(
    <>
      {/* Main modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ri-detail-title"
        className="fixed inset-0 z-[800] flex items-center justify-center p-4"
        onClick={handleOverlayClick}
      >
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
            <div>
              <h2 id="ri-detail-title" className="text-lg font-semibold text-gray-900">
                {ri
                  ? `${t('rechazos_internos.title')} #${ri.id}`
                  : t('rechazos_internos.title')}
              </h2>
              {ri && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDate(ri.fecha_registro, 'dd/MM/yyyy')} — {ri.license_plate}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label={t('common.close')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-6">

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <svg className="h-8 w-8 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Error al cargar el detalle del registro.
              </div>
            )}

            {ri && (
              <>
                {/* Section 1: Información Básica */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                    Información Básica
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
                    <Field label={t('rechazos_internos.form.fecha_registro')} value={formatDate(ri.fecha_registro, 'dd/MM/yyyy')} />
                    <Field label={t('rechazos_internos.form.license_plate')} value={ri.license_plate} />
                    <Field label={t('rechazos_internos.form.sku')} value={ri.sku} />
                    <Field label={t('rechazos_internos.form.marca')} value={ri.marca} />
                    <Field label={t('rechazos_internos.form.modelo')} value={ri.modelo} />
                    <Field label={t('rechazos_internos.form.pulgada')} value={ri.pulgada} />
                    {ri.descripcion && (
                      <div className="col-span-2 md:col-span-3">
                        <Field label={t('rechazos_internos.form.descripcion')} value={ri.descripcion} />
                      </div>
                    )}
                  </dl>
                </section>

                {/* Section 2: COPQ Mapping */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                    Defecto & COPQ
                  </h3>

                  {/* Visual mapping */}
                  {mappingEntry && (
                    <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                      <p className="font-medium text-blue-800 mb-1">Mapeo COPQ</p>
                      <p className="text-blue-700 leading-relaxed">
                        <span className="font-semibold">Defecto:</span> {ri.defecto}
                        {' → '}
                        <span className="font-semibold">Actividad:</span> {mappingEntry.actividad}
                        {' → '}
                        <span className="font-bold text-blue-900">{formatCurrency(mappingEntry.costo)}</span>
                      </p>
                      {Number(ri.costo_no_calidad) !== mappingEntry.costo && (
                        <p className="mt-1 text-xs text-amber-600">
                          Costo registrado ({formatCurrency(Number(ri.costo_no_calidad))}) difiere del mapeo estándar (modificación manual).
                        </p>
                      )}
                    </div>
                  )}

                  <dl className="grid grid-cols-1 gap-y-3 md:grid-cols-2 gap-x-6">
                    <Field label={t('rechazos_internos.form.defecto')} value={ri.defecto} />
                    <Field
                      label={t('rechazos_internos.form.costo_no_calidad')}
                      value={
                        <span className="font-bold text-blue-700 text-base">
                          {formatCurrency(Number(ri.costo_no_calidad))}
                        </span>
                      }
                    />
                    <div className="md:col-span-2">
                      <Field label={t('rechazos_internos.form.actividad_realizar')} value={ri.actividad_realizar} />
                    </div>
                  </dl>
                </section>

                {/* Section 3: Información Adicional */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                    Información Adicional
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
                    <Field label={t('rechazos_internos.form.origen_hallazgo')} value={ri.origen_hallazgo} />
                    <Field label={t('rechazos_internos.form.inspector')} value={ri.inspector} />
                    <Field label={t('rechazos_internos.table.status')} value={
                      <span className={[
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        ri.estatus === 'Abierto' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600',
                      ].join(' ')}>
                        {ri.estatus ?? 'Abierto'}
                      </span>
                    } />
                    {ri.observaciones && (
                      <div className="col-span-2 md:col-span-3">
                        <Field label={t('rechazos_internos.form.observaciones')} value={ri.observaciones} />
                      </div>
                    )}
                  </dl>
                </section>

                {/* Section 4: Fotos */}
                {images.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                      {t('rechazos_internos.form.fotos')} ({images.length})
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                      {images.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setLightboxSrc(img.url)}
                          className="group relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label={`Ver foto ${img.filename}`}
                        >
                          <img
                            src={img.url}
                            alt={img.filename}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                            <svg className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Section 5: Firma Digital */}
                <section>
                  <SignatureCaptureSection
                    signature={signature}
                    onSignature={() => undefined}
                    disabled
                  />
                </section>

                {/* Section 6: Auditoría */}
                <section className="border-t border-gray-100 pt-4">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-500">
                    <div>
                      <dt className="font-medium">Registrado por</dt>
                      <dd>{ri.registrado_por}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Fecha de creación</dt>
                      <dd>{formatDate(ri.created_at, 'dd/MM/yyyy HH:mm')}</dd>
                    </div>
                  </dl>
                </section>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && createPortal(
        <div
          className="fixed inset-0 z-[900] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
            aria-label="Cerrar imagen"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxSrc}
            alt="Foto ampliada"
            className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </>,
    document.body,
  );
}
