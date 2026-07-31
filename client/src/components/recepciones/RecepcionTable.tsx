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

import { useTranslation } from "react-i18next";
import type { Recepcion } from "../../types";

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

function EstatusBadge({ estatus }: { estatus: Recepcion["estatus"] }) {
  const classMap: Record<Recepcion["estatus"], string> = {
    Confirmado: "badge badge-aprobado",
    "En descarga": "badge badge-proceso",
    Descargado: "badge badge-cerrada",
    Rechazado: "badge badge-rechazado",
  };
  const cls = classMap[estatus] ?? "badge";
  return <span className={cls}>{estatus}</span>;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation();
  return (
    <tr>
      <td colSpan={colSpan} className="vacio">
        {t("common.loading")}
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
            <td key={j}>
              <div className="h-4 animate-pulse" style={{ background: "#e8e8e8" }} />
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
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < lastPage;

  const columns = [
    "#",
    t("recepciones.form.fecha"),
    t("recepciones.form.hora"),
    t("recepciones.form.company"),
    t("recepciones.form.origen"),
    t("recepciones.form.cargo"),
    t("recepciones.form.unit_qty"),
    t("recepciones.form.pallet_qty"),
    t("recepciones.form.tipo"),
    t("recepciones.form.estatus"),
    t("common.edit"), // actions column header
  ];

  return (
    <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
      {/* ── Scrollable table ── */}
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <SkeletonRows count={5} colSpan={columns.length} />
            ) : data.length === 0 ? (
              <EmptyRow colSpan={columns.length} />
            ) : (
              data.map((rec, idx) => {
                const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr key={rec.id} onClick={() => onView(rec.id)}>
                    <td className="whitespace-nowrap" style={{ color: "#999" }}>
                      {rowNumber}
                    </td>
                    <td className="whitespace-nowrap">{rec.fecha}</td>
                    <td className="whitespace-nowrap">
                      {/* hora may come as "HH:MM:SS" from Postgres TIME */}
                      {rec.hora.slice(0, 5)}
                    </td>
                    <td
                      className="whitespace-nowrap"
                      style={{
                        fontWeight: 500,
                        maxWidth: 140,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {rec.company}
                    </td>
                    <td
                      className="whitespace-nowrap"
                      style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {rec.origen}
                    </td>
                    <td className="whitespace-nowrap">{rec.cargo}</td>
                    <td className="whitespace-nowrap tabular-nums" style={{ textAlign: "right" }}>
                      {rec.unit_qty.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap tabular-nums" style={{ textAlign: "right" }}>
                      {rec.pallet_qty.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap">
                      <span
                        style={{
                          background: "#f4f4f4",
                          padding: "2px 6px",
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#555",
                        }}
                      >
                        {rec.tipo}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <EstatusBadge estatus={rec.estatus} />
                    </td>

                    {/* Action buttons — stop propagation so row click doesn't fire */}
                    <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onView(rec.id)}
                          className="btn-accion"
                          aria-label={`${t("recepciones.view")} #${rec.id}`}
                        >
                          {t("recepciones.view")}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(rec.id)}
                          className="btn-accion"
                          aria-label={`${t("recepciones.edit")} #${rec.id}`}
                        >
                          {t("recepciones.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(rec.id)}
                          className="btn-accion rojo"
                          aria-label={`${t("recepciones.delete")} #${rec.id}`}
                        >
                          {t("recepciones.delete")}
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
      <div className="paginador">
        <span>
          {total === 0
            ? t("common.loading")
            : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} de ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!hasPrev} onClick={() => onPageChange(currentPage - 1)}>
            ← Anterior
          </button>
          <span style={{ padding: "0 8px" }}>
            {currentPage} / {lastPage}
          </span>
          <button type="button" disabled={!hasNext} onClick={() => onPageChange(currentPage + 1)}>
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
