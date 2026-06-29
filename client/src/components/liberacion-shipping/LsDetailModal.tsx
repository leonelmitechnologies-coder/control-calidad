/**
 * LsDetailModal
 *
 * Read-only detail view for a Liberación Shipping record.
 *
 * Sections:
 *   1. Información de Envío (fecha, order_id, destino, referencia)
 *   2. Información del Producto (sku cascade fields)
 *   3. Contenedor (numero, tipo, peso, volumen)
 *   4. Documentación (bill_of_lading, pro_number, purchase_order)
 *   5. Fotos (5 labeled thumbnails + lightbox on click)
 *   6. Información Adicional (observaciones, estatus, registrado_por)
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { LiberacionShipping } from '../../types';
import { formatDate } from '../../utils/formatters';
import { API_BASE_URL } from '../../config/api';
import { PHOTO_SLOTS } from './PhotoRequirements';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LsDetailModalProps {
  id: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// ── API helper ─────────────────────────────────────────────────────────────────

async function fetchDetail(id: number): Promise<LiberacionShipping> {
  const res = await fetch(`${API_BASE_URL}/api/liberacion-shipping/${id}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // Server returns raw row — normalise fotos object
  if (json && !json.fotos) {
    json.fotos = {
      contenedor_vacio:   json.foto_contenedor_vacio   || '',
      contenedor_cargado: json.foto_contenedor_cargado || '',
      caja_sellada:       json.foto_caja_sellada       || '',
      placas:             json.foto_placas             || '',
      manifiesto:         json.foto_manifiesto         || '',
    };
  }
  return json;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fotoUrl(filename: string | undefined): string | null {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${API_BASE_URL}/uploads/shipping/${filename}`;
}

type Estatus = LiberacionShipping['estatus'];

const ESTATUS_STYLES: Record<Estatus, string> = {
  'Programado':  'bg-yellow-100 text-yellow-700',
  'En Tránsito': 'bg-blue-100 text-blue-700',
  'Entregado':   'bg-green-100 text-green-700',
  'Cancelado':   'bg-red-100 text-red-600',
};

// ── Field helper ──────────────────────────────────────────────────────────────

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
      {children}
    </h3>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LsDetailModal({ id, isOpen, onClose }: LsDetailModalProps) {
  const { t } = useTranslation();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxLabel, setLightboxLabel] = useState<string>('');

  const { data: ls, isLoading, isError } = useQuery<LiberacionShipping>({
    queryKey: ['ls-detail', id],
    queryFn: () => fetchDetail(id!),
    enabled: isOpen && id !== null,
    staleTime: 30_000,
  });

  if (!isOpen) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  function openLightbox(src: string, label: string) {
    setLightboxSrc(src);
    setLightboxLabel(label);
  }

  const fotoCount = ls
    ? Object.values(ls.fotos || {}).filter(Boolean).length
    : 0;

  return createPortal(
    <>
      {/* Main modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ls-detail-title"
        className="fixed inset-0 z-[800] flex items-center justify-center p-4"
        onClick={handleOverlayClick}
      >
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

        <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
            <div>
              <h2 id="ls-detail-title" className="text-lg font-semibold text-gray-900">
                {ls
                  ? `${t('liberacion_shipping.title')} #${ls.id}`
                  : t('liberacion_shipping.title')}
              </h2>
              {ls && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDate(ls.fecha, 'dd/MM/yyyy')}
                  {ls.order_id ? ` — ${ls.order_id}` : ''}
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

            {ls && (
              <>
                {/* Section 1: Información de Envío */}
                <section>
                  <SectionTitle>{t('liberacion_shipping.form.section_envio')}</SectionTitle>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                    <Field label={t('liberacion_shipping.form.fecha')} value={formatDate(ls.fecha, 'dd/MM/yyyy')} />
                    <Field label={t('liberacion_shipping.form.order_id')} value={ls.order_id} />
                    <Field label={t('liberacion_shipping.form.destino')} value={ls.destino} />
                    <Field label={t('liberacion_shipping.form.referencia')} value={ls.referencia} />
                  </dl>
                </section>

                {/* Section 2: Información del Producto */}
                <section>
                  <SectionTitle>{t('liberacion_shipping.form.section_producto')}</SectionTitle>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
                    <Field label={t('liberacion_shipping.form.sku')} value={ls.sku} />
                    <Field label={t('liberacion_shipping.form.marca')} value={ls.marca} />
                    <Field label={t('liberacion_shipping.form.modelo')} value={ls.modelo} />
                    <Field label={t('liberacion_shipping.form.pulgada')} value={ls.pulgada} />
                    {ls.descripcion && (
                      <div className="col-span-2 md:col-span-3">
                        <Field label={t('liberacion_shipping.form.descripcion')} value={ls.descripcion} />
                      </div>
                    )}
                  </dl>
                </section>

                {/* Section 3: Contenedor */}
                <section>
                  <SectionTitle>{t('liberacion_shipping.form.section_contenedor')}</SectionTitle>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                    <Field label={t('liberacion_shipping.form.numero_contenedor')} value={ls.numero_contenedor} />
                    <Field label={t('liberacion_shipping.form.tipo_contenedor')} value={ls.tipo_contenedor} />
                    <Field
                      label={t('liberacion_shipping.form.peso_total')}
                      value={ls.peso_total != null ? `${ls.peso_total} kg` : undefined}
                    />
                    <Field
                      label={t('liberacion_shipping.form.volumen_cubico')}
                      value={ls.volumen_cubico != null ? `${ls.volumen_cubico} m³` : undefined}
                    />
                  </dl>
                </section>

                {/* Section 4: Documentación */}
                <section>
                  <SectionTitle>{t('liberacion_shipping.form.section_documentacion')}</SectionTitle>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3">
                    <Field label={t('liberacion_shipping.form.bill_of_lading')} value={ls.bill_of_lading} />
                    <Field label={t('liberacion_shipping.form.pro_number')} value={ls.pro_number} />
                    <Field label={t('liberacion_shipping.form.purchase_order')} value={ls.purchase_order} />
                  </dl>
                </section>

                {/* Section 5: Fotos */}
                <section>
                  <SectionTitle>
                    {t('liberacion_shipping.form.section_fotos')}
                    <span
                      className={[
                        'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                        fotoCount === 5 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                      ].join(' ')}
                    >
                      {fotoCount} / 5
                    </span>
                  </SectionTitle>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                    {PHOTO_SLOTS.map(({ key, labelKey }) => {
                      const filename = ls.fotos?.[key];
                      const src = fotoUrl(filename);
                      const label = t(labelKey);

                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-600 text-center leading-tight min-h-[2rem] flex items-end justify-center">
                            {label}
                          </span>
                          {src ? (
                            <button
                              type="button"
                              onClick={() => openLightbox(src, label)}
                              className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label={`Ver ${label}`}
                            >
                              <img
                                src={src}
                                alt={label}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                                <svg className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </button>
                          ) : (
                            <div className="aspect-square rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                              <svg className="h-6 w-6 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Section 6: Información Adicional */}
                <section>
                  <SectionTitle>{t('liberacion_shipping.form.section_adicional')}</SectionTitle>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
                    <Field
                      label={t('liberacion_shipping.form.estatus')}
                      value={
                        <span className={[
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          ESTATUS_STYLES[ls.estatus] ?? 'bg-gray-100 text-gray-600',
                        ].join(' ')}>
                          {ls.estatus}
                        </span>
                      }
                    />
                    <Field label={t('liberacion_shipping.form.registrado_por')} value={ls.registrado_por} />
                    {ls.observaciones && (
                      <div className="col-span-2 md:col-span-3">
                        <Field label={t('liberacion_shipping.form.observaciones')} value={ls.observaciones} />
                      </div>
                    )}
                  </dl>
                </section>

                {/* Auditoría */}
                <section className="border-t border-gray-100 pt-4">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-500">
                    <div>
                      <dt className="font-medium">Registrado por</dt>
                      <dd>{ls.registrado_por || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Fecha de creación</dt>
                      <dd>{formatDate(ls.created_at, 'dd/MM/yyyy HH:mm')}</dd>
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
          className="fixed inset-0 z-[900] flex items-center justify-center bg-black/85 p-4"
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
          <div className="flex flex-col items-center gap-3">
            <p className="text-white text-sm font-medium drop-shadow">{lightboxLabel}</p>
            <img
              src={lightboxSrc}
              alt={lightboxLabel}
              className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body,
      )}
    </>,
    document.body,
  );
}
