/**
 * LsTable
 *
 * Paginated table for Liberación Shipping records.
 *
 * Columns: # Fecha Order ID Destino SKU Número Contenedor Peso Estatus Fotos Acciones
 * Rows: 20 per page with pagination
 * Status badge: Color-coded
 */

import { useTranslation } from 'react-i18next';
import type { LiberacionShipping } from '../../types';
import { formatDate } from '../../utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LsTableProps {
  data: LiberacionShipping[];
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

type Estatus = LiberacionShipping['estatus'];

const ESTATUS_STYLES: Record<Estatus, string> = {
  'Programado':  'bg-yellow-100 text-yellow-700',
  'En Tránsito': 'bg-blue-100 text-blue-700',
  'Entregado':   'bg-green-100 text-green-700',
  'Cancelado':   'bg-red-100 text-red-600',
};

function EstatusBadge({ estatus }: { estatus: Estatus }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        ESTATUS_STYLES[estatus] ?? 'bg-gray-100 text-gray-600',
      ].join(' ')}
    >
      {estatus}
    </span>
  );
}

function FotosBadge({ fotos }: { fotos: LiberacionShipping['fotos'] }) {
  const count = Object.values(fotos).filter(Boolean).length;
  const isComplete = count === 5;
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isComplete
          ? 'bg-green-50 text-green-700'
          : count > 0
          ? 'bg-amber-50 text-amber-700'
          : 'bg-gray-50 text-gray-400',
      ].join(' ')}
    >
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      {count} / 5
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LsTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  isLoading = false,
}: LsTableProps) {
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
              {Array.from({ length: 10 }).map((_, i) => (
                <th key={i} className="px-3 py-3">
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 10 }).map((_, j) => (
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
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
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
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">#</th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('liberacion_shipping.table.fecha')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('liberacion_shipping.table.order_id')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('liberacion_shipping.table.destino')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('liberacion_shipping.table.sku')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('liberacion_shipping.table.contenedor')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('liberacion_shipping.table.peso')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('liberacion_shipping.table.status')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('liberacion_shipping.table.fotos')}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Acciones
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-100 bg-white">
            {data.map((ls, idx) => (
              <tr
                key={ls.id}
                className="cursor-pointer transition-colors hover:bg-gray-50"
                onClick={() => onView(ls.id)}
              >
                {/* Row index */}
                <td className="whitespace-nowrap px-3 py-3 text-gray-400 text-xs">
                  {startIdx + idx + 1}
                </td>

                {/* Fecha */}
                <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                  {formatDate(ls.fecha, 'dd/MM/yyyy')}
                </td>

                {/* Order ID */}
                <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-900">
                  {ls.order_id || <span className="text-gray-300">—</span>}
                </td>

                {/* Destino */}
                <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                  {ls.destino || <span className="text-gray-300">—</span>}
                </td>

                {/* SKU */}
                <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                  {ls.sku || <span className="text-gray-300">—</span>}
                </td>

                {/* Número Contenedor */}
                <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                  <span className="block max-w-[140px] overflow-hidden text-ellipsis" title={ls.numero_contenedor}>
                    {ls.numero_contenedor || <span className="text-gray-300">—</span>}
                  </span>
                </td>

                {/* Peso */}
                <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                  {ls.peso_total != null ? `${ls.peso_total} kg` : <span className="text-gray-300">—</span>}
                </td>

                {/* Estatus */}
                <td className="whitespace-nowrap px-3 py-3">
                  <EstatusBadge estatus={ls.estatus} />
                </td>

                {/* Fotos */}
                <td className="whitespace-nowrap px-3 py-3 text-center">
                  <FotosBadge fotos={ls.fotos} />
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
                      onClick={() => onView(ls.id)}
                      title="Ver"
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
                      onClick={() => onEdit(ls.id)}
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
                      onClick={() => onDelete(ls.id)}
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
            ))}
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
