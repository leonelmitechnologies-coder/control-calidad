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
      <dt style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#777', marginBottom: 4 }}>
        {label}
      </dt>
      <dd style={{ fontSize: 13, color: '#111', margin: 0, wordBreak: 'break-word' }}>
        {value || <span style={{ color: '#aaa', fontStyle: 'italic' }}>—</span>}
      </dd>
    </div>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="seccion-titulo" style={{ marginBottom: 14 }}>
      {label}
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
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} aria-hidden="true" />

        <div
          className="relative z-10 w-full overflow-y-auto"
          style={{ maxWidth: 680, maxHeight: '90vh', background: '#fff', border: '1px solid #e2e2e2' }}
        >

          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between"
            style={{ padding: '16px 24px', borderBottom: '2px solid #0d2b4e', background: '#fff' }}
          >
            <div>
              <h2 id="ri-detail-title" className="modal-titulo" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
                {ri
                  ? `${t('rechazos_internos.title')} #${ri.id}`
                  : t('rechazos_internos.title')}
              </h2>
              {ri && (
                <p style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
                  {formatDate(ri.fecha_registro, 'dd/MM/yyyy')} — {ri.license_plate}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 18, color: '#777', cursor: 'pointer', padding: '2px 6px' }}
              aria-label={t('common.close')}
            >
              &#10005;
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px' }}>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center" style={{ padding: '48px 0' }}>
                <span style={{ fontSize: 13, color: '#777' }}>Cargando…</span>
              </div>
            )}

            {/* Error */}
            {isError && (
              <div style={{ border: '1px solid #f5c6cb', background: '#fdecea', padding: '12px 16px', fontSize: 13, color: '#c0392b' }}>
                Error al cargar el detalle del registro.
              </div>
            )}

            {ri && (
              <>
                {/* Section 1: Información Básica */}
                <div style={{ marginBottom: 24 }}>
                  <SectionTitle label="Información Básica" />
                  <dl className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 24px' }}>
                    <Field label={t('rechazos_internos.form.fecha_registro')} value={formatDate(ri.fecha_registro, 'dd/MM/yyyy')} />
                    <Field label={t('rechazos_internos.form.license_plate')} value={ri.license_plate} />
                    <Field label={t('rechazos_internos.form.sku')} value={ri.sku} />
                    <Field label={t('rechazos_internos.form.marca')} value={ri.marca} />
                    <Field label={t('rechazos_internos.form.modelo')} value={ri.modelo} />
                    <Field label={t('rechazos_internos.form.pulgada')} value={ri.pulgada} />
                    {ri.descripcion && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <Field label={t('rechazos_internos.form.descripcion')} value={ri.descripcion} />
                      </div>
                    )}
                  </dl>
                </div>

                {/* Section 2: COPQ Mapping */}
                <div style={{ marginBottom: 24 }}>
                  <SectionTitle label="Defecto & COPQ" />

                  {/* Visual mapping */}
                  {mappingEntry && (
                    <div style={{ background: '#f4f6f9', border: '1px solid #0d2b4e', padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                      <p style={{ fontWeight: 700, color: '#0d2b4e', marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Mapeo COPQ
                      </p>
                      <p style={{ color: '#111', margin: 0 }}>
                        <strong>Defecto:</strong> {ri.defecto}
                        {' → '}
                        <strong>Actividad:</strong> {mappingEntry.actividad}
                        {' → '}
                        <strong style={{ color: '#0d2b4e' }}>{formatCurrency(mappingEntry.costo)}</strong>
                      </p>
                      {Number(ri.costo_no_calidad) !== mappingEntry.costo && (
                        <p style={{ marginTop: 6, fontSize: 12, color: '#856404' }}>
                          Costo registrado ({formatCurrency(Number(ri.costo_no_calidad))}) difiere del mapeo estándar (modificación manual).
                        </p>
                      )}
                    </div>
                  )}

                  <dl className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 24px' }}>
                    <Field label={t('rechazos_internos.form.defecto')} value={ri.defecto} />
                    <Field
                      label={t('rechazos_internos.form.costo_no_calidad')}
                      value={
                        <span style={{ fontWeight: 700, color: '#0d2b4e', fontSize: 15 }}>
                          {formatCurrency(Number(ri.costo_no_calidad))}
                        </span>
                      }
                    />
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label={t('rechazos_internos.form.actividad_realizar')} value={ri.actividad_realizar} />
                    </div>
                  </dl>
                </div>

                {/* Section 3: Información Adicional */}
                <div style={{ marginBottom: 24 }}>
                  <SectionTitle label="Información Adicional" />
                  <dl className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 24px' }}>
                    <Field label={t('rechazos_internos.form.origen_hallazgo')} value={ri.origen_hallazgo} />
                    <Field label={t('rechazos_internos.form.inspector')} value={ri.inspector} />
                    <Field
                      label={t('rechazos_internos.table.status')}
                      value={
                        <span className={`badge badge-${ri.estatus === 'Abierto' ? 'abierta' : 'cerrada'}`}>
                          {ri.estatus ?? 'Abierto'}
                        </span>
                      }
                    />
                    {ri.observaciones && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <Field label={t('rechazos_internos.form.observaciones')} value={ri.observaciones} />
                      </div>
                    )}
                  </dl>
                </div>

                {/* Section 4: Fotos */}
                {images.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <SectionTitle label={`${t('rechazos_internos.form.fotos')} (${images.length})`} />
                    <div className="grid grid-cols-4" style={{ gap: 8 }}>
                      {images.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setLightboxSrc(img.url)}
                          style={{
                            aspectRatio: '1',
                            overflow: 'hidden',
                            border: '1px solid #e2e2e2',
                            background: '#f4f6f9',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                          aria-label={`Ver foto ${img.filename}`}
                        >
                          <img
                            src={img.url}
                            alt={img.filename}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 5: Firma Digital */}
                <div style={{ marginBottom: 24 }}>
                  <SectionTitle label={t('rechazos_internos.form.firma_digital')} />
                  <SignatureCaptureSection
                    signature={signature}
                    onSignature={() => undefined}
                    disabled
                  />
                </div>

                {/* Section 6: Auditoría */}
                <div style={{ borderTop: '1px solid #e2e2e2', paddingTop: 14 }}>
                  <dl className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px' }}>
                    <div>
                      <dt style={{ fontSize: 11, fontWeight: 700, color: '#777', textTransform: 'uppercase' }}>Registrado por</dt>
                      <dd style={{ fontSize: 12, color: '#555', margin: 0 }}>{ri.registrado_por}</dd>
                    </div>
                    <div>
                      <dt style={{ fontSize: 11, fontWeight: 700, color: '#777', textTransform: 'uppercase' }}>Fecha de creación</dt>
                      <dd style={{ fontSize: 12, color: '#555', margin: 0 }}>{formatDate(ri.created_at, 'dd/MM/yyyy HH:mm')}</dd>
                    </div>
                  </dl>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="sticky bottom-0 flex justify-end"
            style={{ borderTop: '1px solid #e2e2e2', padding: '14px 24px', background: '#fff' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secundario"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && createPortal(
        <div
          className="fixed inset-0 z-[900] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              fontSize: 22,
              cursor: 'pointer',
              padding: '4px 10px',
            }}
            aria-label="Cerrar imagen"
          >
            &#10005;
          </button>
          <img
            src={lightboxSrc}
            alt="Foto ampliada"
            style={{ maxHeight: '85vh', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </>,
    document.body,
  );
}
