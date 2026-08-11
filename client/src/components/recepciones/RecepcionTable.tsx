import { useTranslation } from "react-i18next";
import type { Recepcion } from "../../types";
import { useIsMobile } from "../../hooks/useIsMobile";

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

function EstatusBadge({ estatus }: { estatus: Recepcion["estatus"] }) {
  const classMap: Record<Recepcion["estatus"], string> = {
    Confirmado: "badge badge-aprobado",
    "En descarga": "badge badge-proceso",
    Descargado: "badge badge-cerrada",
    Rechazado: "badge badge-rechazado",
  };
  return <span className={classMap[estatus] ?? "badge"}>{estatus}</span>;
}

function CardSkeleton() {
  return (
    <div className="tabla-cards">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="tabla-card animate-pulse" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ height: 14, background: "#e8e8e8", width: "60%" }} />
          <div style={{ height: 10, background: "#e8e8e8", width: "80%" }} />
          <div style={{ height: 10, background: "#e8e8e8", width: "40%" }} />
        </div>
      ))}
    </div>
  );
}

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
  const isMobile = useIsMobile();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < lastPage;

  // ── Vista de tarjetas (móvil) ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
        {loading ? (
          <CardSkeleton />
        ) : data.length === 0 ? (
          <div className="vacio">Sin registros.</div>
        ) : (
          <div className="tabla-cards">
            {data.map((rec, idx) => {
              const rowNumber = (currentPage - 1) * pageSize + idx + 1;
              return (
                <div key={rec.id} className="tabla-card" onClick={() => onView(rec.id)}>
                  {/* Header: Company + Estatus */}
                  <div className="tabla-card-header">
                    <div style={{ minWidth: 0 }}>
                      <div className="tabla-card-meta">
                        #{rowNumber} · {rec.fecha} {rec.hora.slice(0, 5)}
                      </div>
                      <div className="tabla-card-title">{rec.company}</div>
                    </div>
                    <EstatusBadge estatus={rec.estatus} />
                  </div>

                  {/* Origen + Cargo */}
                  <div className="tabla-card-row">
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Origen</span>
                      <span className="tabla-card-value">{rec.origen}</span>
                    </div>
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Cargo</span>
                      <span className="tabla-card-value">{rec.cargo}</span>
                    </div>
                  </div>

                  {/* Unidades + Pallets */}
                  <div className="tabla-card-row">
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Unidades</span>
                      <span className="tabla-card-value">{rec.unit_qty.toLocaleString()}</span>
                    </div>
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Pallets</span>
                      <span className="tabla-card-value">{rec.pallet_qty.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Tipo */}
                  <div className="tabla-card-field" style={{ marginBottom: 4 }}>
                    <span className="tabla-card-label">Tipo</span>
                    <span style={{
                      display: "inline-block",
                      background: "#f4f4f4",
                      padding: "2px 6px",
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#555",
                      width: "fit-content",
                    }}>
                      {rec.tipo}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="tabla-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn-accion" onClick={() => onView(rec.id)}>{t("recepciones.view")}</button>
                    <button type="button" className="btn-accion" onClick={() => onEdit(rec.id)}>{t("recepciones.edit")}</button>
                    <button type="button" className="btn-accion rojo" onClick={() => onDelete(rec.id)}>{t("recepciones.delete")}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="paginador">
          <span>
            {total === 0 ? "Sin registros"
              : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} de ${total}`}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={!hasPrev} onClick={() => onPageChange(currentPage - 1)}>← Anterior</button>
            <span style={{ padding: "0 8px" }}>{currentPage} / {lastPage}</span>
            <button type="button" disabled={!hasNext} onClick={() => onPageChange(currentPage + 1)}>Siguiente →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista de tabla (desktop) ───────────────────────────────────────────────
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
    t("common.edit"),
  ];

  return (
    <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
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
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: columns.length }).map((__, j) => (
                      <td key={j}><div className="h-4 animate-pulse" style={{ background: "#e8e8e8" }} /></td>
                    ))}
                  </tr>
                ))}
              </>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length} className="vacio">{t("common.loading")}</td></tr>
            ) : (
              data.map((rec, idx) => {
                const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr key={rec.id} onClick={() => onView(rec.id)}>
                    <td className="whitespace-nowrap" style={{ color: "#999" }}>{rowNumber}</td>
                    <td className="whitespace-nowrap">{rec.fecha}</td>
                    <td className="whitespace-nowrap">{rec.hora.slice(0, 5)}</td>
                    <td className="whitespace-nowrap" style={{ fontWeight: 500, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{rec.company}</td>
                    <td className="whitespace-nowrap" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{rec.origen}</td>
                    <td className="whitespace-nowrap">{rec.cargo}</td>
                    <td className="whitespace-nowrap tabular-nums" style={{ textAlign: "right" }}>{rec.unit_qty.toLocaleString()}</td>
                    <td className="whitespace-nowrap tabular-nums" style={{ textAlign: "right" }}>{rec.pallet_qty.toLocaleString()}</td>
                    <td className="whitespace-nowrap">
                      <span style={{ background: "#f4f4f4", padding: "2px 6px", fontSize: 11, fontWeight: 500, color: "#555" }}>{rec.tipo}</span>
                    </td>
                    <td className="whitespace-nowrap"><EstatusBadge estatus={rec.estatus} /></td>
                    <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => onView(rec.id)} className="btn-accion">{t("recepciones.view")}</button>
                        <button type="button" onClick={() => onEdit(rec.id)} className="btn-accion">{t("recepciones.edit")}</button>
                        <button type="button" onClick={() => onDelete(rec.id)} className="btn-accion rojo">{t("recepciones.delete")}</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="paginador">
        <span>
          {total === 0 ? t("common.loading")
            : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} de ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!hasPrev} onClick={() => onPageChange(currentPage - 1)}>← Anterior</button>
          <span style={{ padding: "0 8px" }}>{currentPage} / {lastPage}</span>
          <button type="button" disabled={!hasNext} onClick={() => onPageChange(currentPage + 1)}>Siguiente →</button>
        </div>
      </div>
    </div>
  );
}
