/**
 * RiTable
 *
 * Paginated, sortable table for Rechazos Internos records.
 *
 * Columns:
 *   #  Fecha  License Plate  SKU  Defecto  Actividad (truncated)
 *   COPQ (MXN, highlighted blue)  Origen  Inspector  Fotos  Firma  Estatus  Acciones
 */

import { useTranslation } from 'react-i18next';
import type { RechazosInterno } from '../../types';
import { formatDate, formatCurrency } from '../../utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RiTableProps {
  data: RechazosInterno[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SignatureBadge({ signed }: { signed: boolean }) {
  if (signed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Sí
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
      No
    </span>
  );
}

function EstatusBadge({ estatus }: { estatus: string }) {
  const isOpen = estatus === 'Abierto';
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        isOpen
          ? 'bg-amber-100 text-amber-700'
          : 'bg-gray-100 text-gray-600',
      ].join(' ')}
    >
      {estatus}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RiTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  isLoading = false,
}: RiTableProps) {
  const { t } = useTranslation();

  const totalPages = Math.ceil(total / pageSize);
  const startIdx   = (page - 1) * pageSize;

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: 13 }).map((_, i) => (
                <th key={i} className="px-3 py-3">
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 13 }).map((_, j) => (
                  <td key={j} className="px-3 py-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-16">
        <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="text-sm text-gray-500">Sin registros encontrados</p>
      </div>
    );
  }

  // ── Table ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">

          {/* Header */}
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                #
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_internos.table.fecha')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_internos.table.license_plate')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_internos.table.sku')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_internos.table.defecto')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 max-w-[180px]">
                {t('rechazos_internos.table.actividad')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-blue-600">
                {t('rechazos_internos.table.copq')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_internos.table.origen')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_internos.table.inspector')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_internos.table.fotos')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_internos.table.firma')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('rechazos_internos.table.status')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Acciones
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-100 bg-white">
            {data.map((ri, idx) => {
              const isSigned = !!(ri.firma_digital || ri.firma_filename);
              const imgCount = typeof ri.cnt_images === 'number' ? ri.cnt_images : (ri.images?.length ?? 0);

              return (
                <tr
                  key={ri.id}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  onClick={() => onView(ri.id)}
                >
                  {/* Row index */}
                  <td className="whitespace-nowrap px-3 py-3 text-gray-400 text-xs">
                    {startIdx + idx + 1}
                  </td>

                  {/* Fecha */}
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                    {formatDate(ri.fecha_registro, 'dd/MM/yyyy')}
                  </td>

                  {/* License Plate */}
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-900">
                    {ri.license_plate}
                  </td>

                  {/* SKU */}
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                    {ri.sku || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Defecto */}
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                    {ri.defecto}
                  </td>

                  {/* Actividad (truncated) */}
                  <td className="px-3 py-3 text-gray-600 max-w-[180px]">
                    <span
                      className="block overflow-hidden text-ellipsis whitespace-nowrap"
                      title={ri.actividad_realizar}
                    >
                      {ri.actividad_realizar || <span className="text-gray-300">—</span>}
                    </span>
                  </td>

                  {/* COPQ — highlighted blue */}
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className="font-bold text-blue-700">
                      {formatCurrency(Number(ri.costo_no_calidad))}
                    </span>
                  </td>

                  {/* Origen */}
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                    {ri.origen_hallazgo || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Inspector */}
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                    {ri.inspector || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Fotos count */}
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    {imgCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 font-medium">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {imgCount}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Firma badge */}
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <SignatureBadge signed={isSigned} />
                  </td>

                  {/* Estatus */}
                  <td className="whitespace-nowrap px-3 py-3">
                    <EstatusBadge estatus={ri.estatus ?? 'Abierto'} />
                  </td>

                  {/* Actions */}
                  <td
                    className="whitespace-nowrap px-3 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-1">
                      {/* Ver */}
                      <button
                        type="button"
                        onClick={() => onView(ri.id)}
                        title={t('common.view', { defaultValue: 'Ver' })}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>

                      {/* Editar */}
                      <button
                        type="button"
                        onClick={() => onEdit(ri.id)}
                        title={t('common.edit')}
                        className="rounded p-1.5 text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Eliminar */}
                      <button
                        type="button"
                        onClick={() => onDelete(ri.id)}
                        title={t('common.delete')}
                        className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 text-sm text-gray-600">
          <span>
            Mostrando {startIdx + 1}–{Math.min(startIdx + pageSize, total)} de {total} registros
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              ‹ Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              // Show pages around current page
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={[
                    'rounded border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    pageNum === page
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-gray-300 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              Siguiente ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
