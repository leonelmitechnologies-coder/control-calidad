/**
 * ReTable — Paginated data table for Rechazos Externos.
 *
 * Features:
 *   - Color-coded estatus badges (Pendiente / Aceptado / Rechazado)
 *   - Photo count badge column
 *   - Row click triggers onView
 *   - Per-row action buttons: Ver / Editar / Eliminar
 *   - Skeleton loading rows
 *   - Prev/Next pagination
 */

import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency } from '../../utils/formatters';
import type { RechazosExterno } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReTableProps {
  data: RechazosExterno[];
  loading: boolean;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function EstatusBadge({ estatus }: { estatus: RechazosExterno['estatus'] }) {
  const colorMap: Record<RechazosExterno['estatus'], string> = {
    Pendiente:  'bg-yellow-100 text-yellow-800 border-yellow-200',
    Aceptado:   'bg-green-100  text-green-800  border-green-200',
    Rechazado:  'bg-red-100    text-red-800    border-red-200',
  };
  const cls = colorMap[estatus] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {estatus}
    </span>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count, colSpan }: { count: number; colSpan: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: colSpan }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation();
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-sm text-gray-400">
        {t('rechazos_externos.table.empty')}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReTable({
  data,
  loading,
  onView,
  onEdit,
  onDelete,
  currentPage,
  pageSize,
  total,
  onPageChange,
}: ReTableProps) {
  const { t } = useTranslation();

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev  = currentPage > 1;
  const hasNext  = currentPage < lastPage;

  const columns = [
    '#',
    t('rechazos_externos.table.fecha'),
    t('rechazos_externos.table.return_order'),
    t('rechazos_externos.table.license_plate'),
    t('rechazos_externos.table.classification'),
    t('rechazos_externos.table.sku'),
    t('rechazos_externos.table.brand'),
    t('rechazos_externos.table.sale_price'),
    t('rechazos_externos.table.processed_by'),
    t('rechazos_externos.table.photos'),
    t('rechazos_externos.table.status'),
    t('common.edit'), // actions header
  ];

  return (
    <div className="flex flex-col gap-0">
      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <SkeletonRows count={5} colSpan={columns.length} />
            ) : data.length === 0 ? (
              <EmptyRow colSpan={columns.length} />
            ) : (
              data.map((row, idx) => {
                const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                const photoCnt  = Number(row.cnt_images ?? 0);

                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100"
                    onClick={() => onView(row.id)}
                  >
                    {/* # */}
                    <td className="whitespace-nowrap px-4 py-3 text-gray-400">{rowNumber}</td>

                    {/* Fecha */}
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDate(row.created_at)}
                    </td>

                    {/* Return Order */}
                    <td className="max-w-[120px] truncate px-4 py-3 font-medium text-gray-900">
                      {row.return_order}
                    </td>

                    {/* License Plate */}
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {row.license_plate}
                    </td>

                    {/* Classification */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {row.classification || '—'}
                      </span>
                    </td>

                    {/* SKU */}
                    <td className="max-w-[100px] truncate px-4 py-3 text-gray-700">
                      {row.sku || '—'}
                    </td>

                    {/* Brand */}
                    <td className="max-w-[100px] truncate px-4 py-3 text-gray-700">
                      {row.brand || '—'}
                    </td>

                    {/* Sale Price */}
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-700">
                      {row.sale_price != null ? formatCurrency(row.sale_price) : '—'}
                    </td>

                    {/* Processed By */}
                    <td className="max-w-[120px] truncate px-4 py-3 text-gray-700">
                      {row.processed_by || '—'}
                    </td>

                    {/* Photos badge */}
                    <td className="whitespace-nowrap px-4 py-3">
                      {photoCnt > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {photoCnt}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Estatus */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <EstatusBadge estatus={row.estatus} />
                    </td>

                    {/* Actions — stop propagation so row click does not fire */}
                    <td
                      className="whitespace-nowrap px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onView(row.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          aria-label={`${t('rechazos_externos.actions.view')} #${row.id}`}
                        >
                          {t('rechazos_externos.actions.view')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(row.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          aria-label={`${t('rechazos_externos.actions.edit')} #${row.id}`}
                        >
                          {t('rechazos_externos.actions.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                          aria-label={`${t('rechazos_externos.actions.delete')} #${row.id}`}
                        >
                          {t('rechazos_externos.actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between rounded-b-lg border-x border-b border-gray-200 bg-white px-4 py-3">
        <p className="text-xs text-gray-500">
          {total === 0
            ? t('rechazos_externos.table.empty')
            : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} de ${total}`}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(currentPage - 1)}
            className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Anterior
          </button>
          <span className="min-w-[3rem] text-center text-xs text-gray-500">
            {currentPage} / {lastPage}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
