/**
 * RecepcionTable — Data table for the Recepciones module.
 *
 * Renders the paginated list of reception records with:
 *   - Color-coded estatus badges
 *   - Row hover and click for detail view
 *   - Per-row action buttons (Ver / Editar / Eliminar)
 *   - Prev/Next pagination controls
 *
 * All data operations are passed in via props; this component is purely
 * presentational.
 */

import { useTranslation } from 'react-i18next';
import type { Recepcion } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface RecepcionTableProps {
  data: Recepcion[];
  loading: boolean;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

// ── Badge helper ──────────────────────────────────────────────────────────────

function EstatusBadge({ estatus }: { estatus: Recepcion['estatus'] }) {
  const colorMap: Record<Recepcion['estatus'], string> = {
    Confirmado:    'bg-green-100  text-green-800  border-green-200',
    Pendiente:     'bg-yellow-100 text-yellow-800 border-yellow-200',
    Rechazado:     'bg-red-100    text-red-800    border-red-200',
    'En Descarga': 'bg-blue-100   text-blue-800   border-blue-200',
    Descargado:    'bg-gray-100   text-gray-700   border-gray-200',
  };
  const classes = colorMap[estatus] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {estatus}
    </span>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation();
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-sm text-gray-400">
        {t('common.loading')}
      </td>
    </tr>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function RecepcionTable({
  data,
  loading,
  onView,
  onEdit,
  onDelete,
  currentPage,
  pageSize,
  total,
  onPageChange,
}: RecepcionTableProps) {
  const { t } = useTranslation();

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev  = currentPage > 1;
  const hasNext  = currentPage < lastPage;

  const columns = [
    '#',
    t('recepciones.form.fecha'),
    t('recepciones.form.hora'),
    t('recepciones.form.company'),
    t('recepciones.form.origen'),
    t('recepciones.form.cargo'),
    t('recepciones.form.unit_qty'),
    t('recepciones.form.pallet_qty'),
    t('recepciones.form.tipo'),
    t('recepciones.form.estatus'),
    t('common.edit'), // actions column header
  ];

  return (
    <div className="flex flex-col gap-0">
      {/* ── Scrollable table ── */}
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
              data.map((rec, idx) => {
                const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr
                    key={rec.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100"
                    onClick={() => onView(rec.id)}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-400">{rowNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{rec.fecha}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {/* hora may come as "HH:MM:SS" from Postgres TIME */}
                      {rec.hora.slice(0, 5)}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 font-medium text-gray-900">
                      {rec.company}
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-gray-700">{rec.origen}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{rec.cargo}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                      {rec.unit_qty.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700">
                      {rec.pallet_qty.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {rec.tipo}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <EstatusBadge estatus={rec.estatus} />
                    </td>

                    {/* Action buttons — stop propagation so row click doesn't fire */}
                    <td
                      className="whitespace-nowrap px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onView(rec.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          aria-label={`${t('recepciones.view')} #${rec.id}`}
                        >
                          {t('recepciones.view')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(rec.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          aria-label={`${t('recepciones.edit')} #${rec.id}`}
                        >
                          {t('recepciones.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(rec.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                          aria-label={`${t('recepciones.delete')} #${rec.id}`}
                        >
                          {t('recepciones.delete')}
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

      {/* ── Pagination bar ── */}
      <div className="flex items-center justify-between border-x border-b border-gray-200 rounded-b-lg bg-white px-4 py-3">
        <p className="text-xs text-gray-500">
          {total === 0
            ? t('common.loading')
            : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} de ${total}`}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(currentPage - 1)}
            className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Anterior
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
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
