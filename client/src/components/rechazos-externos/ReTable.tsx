import type { RechazosExterno } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReTableProps {
  data:         RechazosExterno[];
  loading:      boolean;
  onView:       (id: number) => void;
  onEdit:       (id: number) => void;
  onDelete:     (id: number) => void;
  currentPage:  number;
  pageSize:     number;
  total:        number;
  onPageChange: (page: number) => void;
}

// ── Time formatter ────────────────────────────────────────────────────────────

function formatTime(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDT(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count, colSpan }: { count: number; colSpan: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: colSpan }).map((__, j) => (
            <td key={j}><div className="h-4 animate-pulse" style={{ background: '#e8e8e8' }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="vacio">Sin registros</td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const COLUMNS = [
  '#', 'Return Order', 'License Plate', 'Classification',
  'SKU', 'Brand', 'Plant Entry', 'Plant Exit',
  'Time in Plant', 'Processed By', 'Problemas', 'Acciones',
];

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
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev  = currentPage > 1;
  const hasNext  = currentPage < lastPage;

  return (
    <div style={{ border: '1px solid #e2e2e2', background: '#fff' }}>
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col} className="whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <SkeletonRows count={5} colSpan={COLUMNS.length} />
            ) : data.length === 0 ? (
              <EmptyRow colSpan={COLUMNS.length} />
            ) : (
              data.map((row, idx) => {
                const rowNumber  = (currentPage - 1) * pageSize + idx + 1;
                const cntProbs   = Number(row.cnt_problemas ?? 0);

                return (
                  <tr key={row.id} onClick={() => onView(row.id)}>

                    <td className="whitespace-nowrap" style={{ color: '#999' }}>{rowNumber}</td>

                    <td className="whitespace-nowrap" style={{ fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.return_order}
                    </td>

                    <td className="whitespace-nowrap">{row.license_plate}</td>

                    <td className="whitespace-nowrap">
                      <span style={{ background: '#f4f4f4', padding: '2px 6px', fontSize: 11, fontWeight: 500, color: '#555' }}>
                        {row.classification || '—'}
                      </span>
                    </td>

                    <td className="whitespace-nowrap" style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.sku || '—'}
                    </td>

                    <td className="whitespace-nowrap" style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.brand || '—'}
                    </td>

                    <td className="whitespace-nowrap" style={{ fontSize: 12 }}>
                      {formatDT(row.plant_entry)}
                    </td>

                    <td className="whitespace-nowrap" style={{ fontSize: 12 }}>
                      {formatDT(row.plant_exit)}
                    </td>

                    <td className="whitespace-nowrap" style={{ fontSize: 12 }}>
                      {formatTime(row.total_time_minutes)}
                    </td>

                    <td className="whitespace-nowrap" style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.processed_by || '—'}
                    </td>

                    {/* Problemas badge */}
                    <td className="whitespace-nowrap">
                      {cntProbs > 0 ? (
                        <span style={{ background: '#0d2b4e', color: '#fff', padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                          {cntProbs}
                        </span>
                      ) : (
                        <span style={{ color: '#bbb' }}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => onView(row.id)} className="btn-accion">Ver</button>
                        <button type="button" onClick={() => onEdit(row.id)} className="btn-accion">Editar</button>
                        <button type="button" onClick={() => onDelete(row.id)} className="btn-accion rojo">Eliminar</button>
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="paginador">
        <span>
          {total === 0
            ? 'Sin registros'
            : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} de ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!hasPrev} onClick={() => onPageChange(currentPage - 1)}>← Anterior</button>
          <span style={{ padding: '0 8px' }}>{currentPage} / {lastPage}</span>
          <button type="button" disabled={!hasNext} onClick={() => onPageChange(currentPage + 1)}>Siguiente →</button>
        </div>
      </div>
    </div>
  );
}
