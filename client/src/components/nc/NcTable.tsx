import { useTranslation } from "react-i18next";
import type { NoConformidad } from "../../types";
import { useIsMobile } from "../../hooks/useIsMobile";
import StatusBadge from "../common/StatusBadge";

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

function formatFecha(iso: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function truncate(text: string, maxLen = 60): string {
  if (!text) return "—";
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

interface PaginatorProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

function Paginator({ page, pageSize, total, onPageChange }: PaginatorProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < lastPage;
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="paginador">
      <span>
        Mostrando <strong>{from}</strong>–<strong>{to}</strong> de <strong>{total}</strong> registros
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={!hasPrev} title="Primera página">«</button>
        <button onClick={() => onPageChange(page - 1)} disabled={!hasPrev} title="Página anterior">‹</button>
        <span style={{ padding: "0 8px" }}>{page} / {lastPage}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={!hasNext} title="Página siguiente">›</button>
        <button onClick={() => onPageChange(lastPage)} disabled={!hasNext} title="Última página">»</button>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 10 }).map((__, j) => (
            <td key={j}>
              <div className="h-4 animate-pulse" style={{ background: "#e8e8e8", borderRadius: 0 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function CardSkeleton() {
  return (
    <div className="tabla-cards">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="tabla-card animate-pulse" style={{ gap: 8, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 14, background: "#e8e8e8", width: "60%" }} />
          <div style={{ height: 10, background: "#e8e8e8", width: "80%" }} />
          <div style={{ height: 10, background: "#e8e8e8", width: "40%" }} />
        </div>
      ))}
    </div>
  );
}

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
  const isMobile = useIsMobile();

  // ── Vista de tarjetas (móvil) ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
        {loading ? (
          <CardSkeleton />
        ) : data.length === 0 ? (
          <div className="vacio">No hay registros para mostrar.</div>
        ) : (
          <div className="tabla-cards">
            {data.map((nc, idx) => (
              <div key={nc.id} className="tabla-card" onClick={() => onView(nc.id)}>
                {/* Header: fecha + estatus */}
                <div className="tabla-card-header">
                  <div style={{ minWidth: 0 }}>
                    <div className="tabla-card-meta">
                      #{(currentPage - 1) * pageSize + idx + 1} · {formatFecha(nc.fecha)}{" "}
                      {(nc.hora ?? "").slice(0, 5)}
                    </div>
                    <div className="tabla-card-title">{nc.area}</div>
                  </div>
                  <StatusBadge status={nc.estatus} />
                </div>

                {/* Tipo + Severidad */}
                <div className="tabla-card-row">
                  <div className="tabla-card-field">
                    <span className="tabla-card-label">Tipo</span>
                    <span className="tabla-card-value">{nc.tipo}</span>
                  </div>
                  <div className="tabla-card-field">
                    <span className="tabla-card-label">Severidad</span>
                    <StatusBadge status={nc.severidad} variant="severidad" />
                  </div>
                </div>

                {/* Descripción */}
                <div className="tabla-card-field" style={{ marginBottom: 8 }}>
                  <span className="tabla-card-label">Descripción</span>
                  <span className="tabla-card-value wrap">{truncate(nc.descripcion, 100)}</span>
                </div>

                {/* Responsable */}
                <div className="tabla-card-field" style={{ marginBottom: 4 }}>
                  <span className="tabla-card-label">Responsable</span>
                  <span className="tabla-card-value">{nc.responsable}</span>
                </div>

                {/* Acciones */}
                <div className="tabla-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-accion" onClick={() => onView(nc.id)}>{t("nc.view")}</button>
                  <button className="btn-accion" onClick={() => onEdit(nc.id)}>{t("nc.edit")}</button>
                  <button className="btn-accion rojo" onClick={() => onDelete(nc.id)}>{t("nc.delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Paginator page={currentPage} pageSize={pageSize} total={total} onPageChange={onPageChange} />
      </div>
    );
  }

  // ── Vista de tabla (desktop) ───────────────────────────────────────────────
  return (
    <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>{t("nc.form.area")}</th>
              <th>{t("nc.form.tipo")}</th>
              <th>{t("nc.form.severidad")}</th>
              <th>{t("nc.form.descripcion")}</th>
              <th>{t("nc.form.responsable")}</th>
              <th>Estatus</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <TableSkeleton />}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={10} className="vacio">No hay registros para mostrar.</td>
              </tr>
            )}
            {!loading &&
              data.map((nc, idx) => (
                <tr key={nc.id} onClick={() => onView(nc.id)}>
                  <td className="font-mono" style={{ fontSize: 11 }}>
                    {(currentPage - 1) * pageSize + idx + 1}
                  </td>
                  <td className="whitespace-nowrap">{formatFecha(nc.fecha)}</td>
                  <td className="whitespace-nowrap font-mono" style={{ fontSize: 11 }}>
                    {(nc.hora ?? "").slice(0, 5)}
                  </td>
                  <td className="whitespace-nowrap">{nc.area}</td>
                  <td className="whitespace-nowrap">{nc.tipo}</td>
                  <td className="whitespace-nowrap">
                    <StatusBadge status={nc.severidad} variant="severidad" />
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    <span title={nc.descripcion}>{truncate(nc.descripcion)}</span>
                  </td>
                  <td className="whitespace-nowrap">{nc.responsable}</td>
                  <td className="whitespace-nowrap">
                    <StatusBadge status={nc.estatus} />
                  </td>
                  <td
                    className="whitespace-nowrap"
                    style={{ textAlign: "right" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <button className="btn-accion" onClick={() => onView(nc.id)} title={t("nc.view")}>
                        {t("nc.view")}
                      </button>
                      <button className="btn-accion" onClick={() => onEdit(nc.id)} title={t("nc.edit")}>
                        {t("nc.edit")}
                      </button>
                      <button className="btn-accion rojo" onClick={() => onDelete(nc.id)} title={t("nc.delete")}>
                        {t("nc.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Paginator page={currentPage} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </div>
  );
}
