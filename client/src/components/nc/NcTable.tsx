/**
 * NcTable — Display table for No Conformidades with pagination
 *
 * Columns: #, Fecha, Hora, Área, Tipo, Severidad, Descripción, Responsable, Estatus, Acciones
 * Rows: clicking anywhere on a row opens the detail view
 * Actions: Ver | Editar | Eliminar per row
 */

import { useTranslation } from 'react-i18next';
import type { NoConformidad } from '../../types';
import StatusBadge from '../common/StatusBadge';

// ── Types ──────────────────────────────────────────────────────────────────────

interface NcTableProps {
  data: NoConformidad[];
  loading: boolean;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

// ── Helper: format date "YYYY-MM-DD" → "DD/MM/YYYY" ───────────────────────────

function formatFecha(iso: string): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10); // ensure we only take date part
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Helper: truncate long text ─────────────────────────────────────────────────

function truncate(text: string, maxLen = 60): string {
  if (!text) return '—';
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

// ── Pagination component ───────────────────────────────────────────────────────

interface PaginatorProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

function Paginator({ page, pageSize, total, onPageChange }: PaginatorProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev  = page > 1;
  const hasNext  = page < lastPage;

  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <p className="text-sm text-gray-600">
        Mostrando <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span>{' '}
        de <span className="font-medium">{total}</span> registros
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={!hasPrev}
          className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Primera página"
        >
          «
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Página anterior"
        >
          ‹
        </button>
        <span className="px-3 py-1 text-sm text-gray-700">
          {page} / {lastPage}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Página siguiente"
        >
          ›
        </button>
        <button
          onClick={() => onPageChange(lastPage)}
          disabled={!hasNext}
          className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Última página"
        >
          »
        </button>
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 10 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-200 rounded w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NcTable({
  data,
  loading,
  onView,
  onEdit,
  onDelete,
  currentPage,
  pageSize,
  total,
  onPageChange,
}: NcTableProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Hora
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('nc.form.area')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('nc.form.tipo')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('nc.form.severidad')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider max-w-xs">
                {t('nc.form.descripcion')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('nc.form.responsable')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Estatus
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading && <TableSkeleton />}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No hay registros para mostrar.
                </td>
              </tr>
            )}
            {!loading &&
              data.map((nc, idx) => (
                <tr
                  key={nc.id}
                  onClick={() => onView(nc.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {(currentPage - 1) * pageSize + idx + 1}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {formatFecha(nc.fecha)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-mono text-xs">
                    {(nc.hora ?? '').slice(0, 5)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {nc.area}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {nc.tipo}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={nc.severidad} variant="severidad" />
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <span title={nc.descripcion}>{truncate(nc.descripcion)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {nc.responsable}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={nc.estatus} />
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onView(nc.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        title={t('nc.view')}
                      >
                        {t('nc.view')}
                      </button>
                      <button
                        onClick={() => onEdit(nc.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        title={t('nc.edit')}
                      >
                        {t('nc.edit')}
                      </button>
                      <button
                        onClick={() => onDelete(nc.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                        title={t('nc.delete')}
                      >
                        {t('nc.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Paginator
        page={currentPage}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  );
}
