import type { RechazosExterno } from "../../types";
import { useIsMobile } from "../../hooks/useIsMobile";

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

function formatTime(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDT(dt: string | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function weekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const dayOnly: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const withYear: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const start = monday.toLocaleDateString("es-MX", dayOnly);
  const end = sunday.toLocaleDateString("es-MX", withYear);
  return `${start} – ${end}`;
}

type WeekGroup = { key: string; label: string; rows: RechazosExterno[] };

function groupByWeek(rows: RechazosExterno[]): WeekGroup[] {
  const groups: WeekGroup[] = [];
  let current: WeekGroup | null = null;
  for (const row of rows) {
    let key: string;
    let label: string;
    if (!row.registration_date) {
      key = "__no_date__";
      label = "Sin fecha de registro";
    } else {
      const dateStr = row.registration_date.includes("T")
        ? row.registration_date
        : row.registration_date + "T12:00:00";
      const monday = weekMonday(new Date(dateStr));
      key = monday.toISOString().slice(0, 10);
      label = weekLabel(monday);
    }
    if (!current || current.key !== key) {
      current = { key, label, rows: [] };
      groups.push(current);
    }
    current.rows.push(row);
  }
  return groups;
}

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

function CardSkeleton() {
  return (
    <div className="tabla-cards">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="tabla-card animate-pulse" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ height: 14, background: "#e8e8e8", width: "50%" }} />
          <div style={{ height: 10, background: "#e8e8e8", width: "75%" }} />
          <div style={{ height: 10, background: "#e8e8e8", width: "60%" }} />
        </div>
      ))}
    </div>
  );
}

const COLUMNS = [
  "#", "Return Order", "License Plate", "Classification", "SKU", "Brand",
  "Plant Entry", "Plant Exit", "Time in Plant", "Processed By", "Problemas", "Acciones",
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
  const isMobile = useIsMobile();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < lastPage;

  // ── Vista de tarjetas (móvil) ──────────────────────────────────────────────
  if (isMobile) {
    const groups = groupByWeek(data);
    let globalIdx = 0;

    return (
      <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
        {loading ? (
          <CardSkeleton />
        ) : data.length === 0 ? (
          <div className="vacio">Sin registros</div>
        ) : (
          <div style={{ paddingBottom: 4 }}>
            {groups.map((group) => {
              const sepLabel =
                group.label === "Sin fecha de registro"
                  ? "Sin fecha de registro"
                  : `Semana ${group.label}`;
              return (
                <div key={group.key}>
                  {/* Separador de semana */}
                  <div className="tabla-week-header">
                    {sepLabel}
                    <span style={{ fontWeight: 400, marginLeft: 8, color: "#6a8aaa" }}>
                      — {group.rows.length} {group.rows.length === 1 ? "registro" : "registros"}
                    </span>
                  </div>

                  {/* Tarjetas de la semana */}
                  <div className="tabla-cards" style={{ paddingTop: 8, paddingBottom: 4 }}>
                    {group.rows.map((row) => {
                      const rowNumber = (currentPage - 1) * pageSize + globalIdx + 1;
                      globalIdx++;
                      const cntProbs = Number(row.cnt_problemas ?? 0);

                      return (
                        <div key={row.id} className="tabla-card" onClick={() => onView(row.id)}>
                          {/* Header: return order + classification */}
                          <div className="tabla-card-header">
                            <div style={{ minWidth: 0 }}>
                              <div className="tabla-card-meta">#{rowNumber}</div>
                              <div className="tabla-card-title">{row.return_order || "—"}</div>
                            </div>
                            {row.classification && (
                              <span style={{
                                background: "#f4f4f4",
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#555",
                                flexShrink: 0,
                              }}>
                                {row.classification}
                              </span>
                            )}
                          </div>

                          {/* LP + SKU */}
                          <div className="tabla-card-row">
                            <div className="tabla-card-field">
                              <span className="tabla-card-label">License Plate</span>
                              <span className="tabla-card-value">{row.license_plate || "—"}</span>
                            </div>
                            <div className="tabla-card-field">
                              <span className="tabla-card-label">SKU</span>
                              <span className="tabla-card-value">{row.sku || "—"}</span>
                            </div>
                          </div>

                          {/* Brand + Procesado por */}
                          <div className="tabla-card-row">
                            <div className="tabla-card-field">
                              <span className="tabla-card-label">Brand</span>
                              <span className="tabla-card-value">{row.brand || "—"}</span>
                            </div>
                            <div className="tabla-card-field">
                              <span className="tabla-card-label">Processed By</span>
                              <span className="tabla-card-value">{row.processed_by || "—"}</span>
                            </div>
                          </div>

                          {/* Entrada + Salida */}
                          <div className="tabla-card-row">
                            <div className="tabla-card-field">
                              <span className="tabla-card-label">Plant Entry</span>
                              <span className="tabla-card-value">{formatDT(row.plant_entry)}</span>
                            </div>
                            <div className="tabla-card-field">
                              <span className="tabla-card-label">Plant Exit</span>
                              <span className="tabla-card-value">{formatDT(row.plant_exit)}</span>
                            </div>
                          </div>

                          {/* Tiempo + Problemas */}
                          <div className="tabla-card-row" style={{ marginBottom: 0 }}>
                            <div className="tabla-card-field">
                              <span className="tabla-card-label">Time in Plant</span>
                              <span className="tabla-card-value">{formatTime(row.total_time_minutes)}</span>
                            </div>
                            <div className="tabla-card-field">
                              <span className="tabla-card-label">Problemas</span>
                              {cntProbs > 0 ? (
                                <span style={{
                                  display: "inline-block",
                                  background: "#0d2b4e",
                                  color: "#fff",
                                  padding: "1px 8px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  width: "fit-content",
                                }}>
                                  {cntProbs}
                                </span>
                              ) : (
                                <span className="tabla-card-value" style={{ color: "#bbb" }}>—</span>
                              )}
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="tabla-card-actions" onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="btn-accion" onClick={() => onView(row.id)}>Ver</button>
                            <button type="button" className="btn-accion" onClick={() => onEdit(row.id)}>Editar</button>
                            <button type="button" className="btn-accion rojo" onClick={() => onDelete(row.id)}>Eliminar</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        <div className="paginador">
          <span>
            {total === 0
              ? "Sin registros"
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
  return (
    <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
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
              <tr><td colSpan={COLUMNS.length} className="vacio">Sin registros</td></tr>
            ) : (
              (() => {
                const groups = groupByWeek(data);
                const colSpan = COLUMNS.length;
                let globalIdx = 0;
                return groups.flatMap((group) => {
                  const sepKey = `sep-${group.key}`;
                  const separator = (
                    <tr key={sepKey} style={{ pointerEvents: "none" }}>
                      <td colSpan={colSpan} style={{
                        background: "#eef2f7", padding: "5px 12px", fontSize: 11,
                        fontWeight: 700, color: "#3a5a7a", borderTop: "2px solid #c8d8e8",
                        letterSpacing: "0.03em",
                      }}>
                        {group.label === "Sin fecha de registro" ? "Sin fecha de registro" : `Semana ${group.label}`}
                        <span style={{ fontWeight: 400, marginLeft: 8, color: "#6a8aaa" }}>
                          — {group.rows.length} {group.rows.length === 1 ? "registro" : "registros"}
                        </span>
                      </td>
                    </tr>
                  );
                  const rows = group.rows.map((row) => {
                    const rowNumber = (currentPage - 1) * pageSize + globalIdx + 1;
                    globalIdx++;
                    const cntProbs = Number(row.cnt_problemas ?? 0);
                    return (
                      <tr key={row.id} onClick={() => onView(row.id)}>
                        <td className="whitespace-nowrap" style={{ color: "#999" }}>{rowNumber}</td>
                        <td className="whitespace-nowrap" style={{ fontWeight: 500, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {row.return_order}
                        </td>
                        <td className="whitespace-nowrap">{row.license_plate}</td>
                        <td className="whitespace-nowrap">
                          <span style={{ background: "#f4f4f4", padding: "2px 6px", fontSize: 11, fontWeight: 500, color: "#555" }}>
                            {row.classification || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap" style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>{row.sku || "—"}</td>
                        <td className="whitespace-nowrap" style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>{row.brand || "—"}</td>
                        <td className="whitespace-nowrap" style={{ fontSize: 12 }}>{formatDT(row.plant_entry)}</td>
                        <td className="whitespace-nowrap" style={{ fontSize: 12 }}>{formatDT(row.plant_exit)}</td>
                        <td className="whitespace-nowrap" style={{ fontSize: 12 }}>{formatTime(row.total_time_minutes)}</td>
                        <td className="whitespace-nowrap" style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }}>{row.processed_by || "—"}</td>
                        <td className="whitespace-nowrap">
                          {cntProbs > 0 ? (
                            <span style={{ background: "#0d2b4e", color: "#fff", padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{cntProbs}</span>
                          ) : (
                            <span style={{ color: "#bbb" }}>—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => onView(row.id)} className="btn-accion">Ver</button>
                            <button type="button" onClick={() => onEdit(row.id)} className="btn-accion">Editar</button>
                            <button type="button" onClick={() => onDelete(row.id)} className="btn-accion rojo">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                  return [separator, ...rows];
                });
              })()
            )}
          </tbody>
        </table>
      </div>
      <div className="paginador">
        <span>
          {total === 0 ? "Sin registros" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} de ${total}`}
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
