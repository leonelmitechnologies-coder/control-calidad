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
  const classMap: Record<RechazosExterno['estatus'], string> = {
    Pendiente: 'badge badge-pendiente',
    Aceptado:  'badge badge-aprobado',
    Rechazado: 'badge badge-rechazado',
  };
  const cls = classMap[estatus] ?? 'badge';
  return <span className={cls}>{estatus}</span>;
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count, colSpan }: { count: number; colSpan: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: colSpan }).map((__, j) => (
            <td key={j}>
              <div className="h-4 animate-pulse" style={{ background: '#e8e8e8' }} />
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
      <td colSpan={colSpan} className="vacio">
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
    <div style={{ border: '1px solid #e2e2e2', background: '#fff' }}>
      {/* Scrollable table */}
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>

          <tbody>
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
                    onClick={() => onView(row.id)}
                  >
                    {/* # */}
                    <td className="whitespace-nowrap" style={{ color: '#999' }}>{rowNumber}</td>

                    {/* Fecha */}
                    <td className="whitespace-nowrap">{formatDate(row.created_at)}</td>

                    {/* Return Order */}
                    <td className="whitespace-nowrap" style={{ fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.return_order}
                    </td>

                    {/* License Plate */}
                    <td className="whitespace-nowrap">{row.license_plate}</td>

                    {/* Classification */}
                    <td className="whitespace-nowrap">
                      <span style={{ background: '#f4f4f4', padding: '2px 6px', fontSize: 11, fontWeight: 500, color: '#555' }}>
                        {row.classification || '—'}
                      </span>
                    </td>

                    {/* SKU */}
                    <td className="whitespace-nowrap" style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.sku || '—'}
                    </td>

                    {/* Brand */}
                    <td className="whitespace-nowrap" style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.brand || '—'}
                    </td>

                    {/* Sale Price */}
                    <td className="whitespace-nowrap tabular-nums">
                      {row.sale_price != null ? formatCurrency(row.sale_price) : '—'}
                    </td>

                    {/* Processed By */}
                    <td className="whitespace-nowrap" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.processed_by || '—'}
                    </td>

                    {/* Photos badge */}
                    <td className="whitespace-nowrap">
                      {photoCnt > 0 ? (
                        <span className="inline-flex items-center gap-1" style={{ color: '#2563a8', fontSize: 11, fontWeight: 500 }}>
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {photoCnt}
                        </span>
                      ) : (
                        <span style={{ color: '#bbb' }}>—</span>
                      )}
                    </td>

                    {/* Estatus */}
                    <td className="whitespace-nowrap">
                      <EstatusBadge estatus={row.estatus} />
                    </td>

                    {/* Actions — stop propagation so row click does not fire */}
                    <td
                      className="whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onView(row.id)}
                          className="btn-accion"
                          aria-label={`${t('rechazos_externos.actions.view')} #${row.id}`}
                        >
                          {t('rechazos_externos.actions.view')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(row.id)}
                          className="btn-accion"
                          aria-label={`${t('rechazos_externos.actions.edit')} #${row.id}`}
                        >
                          {t('rechazos_externos.actions.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row.id)}
                          className="btn-accion rojo"
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
      <div className="paginador">
        <span>
          {total === 0
            ? t('rechazos_externos.table.empty')
            : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} de ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => onPageChange(currentPage - 1)}
          >
            ← Anterior
          </button>
          <span style={{ padding: '0 8px' }}>{currentPage} / {lastPage}</span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
