import { useTranslation } from "react-i18next";
import type { RechazosInterno } from "../../types";
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatCurrency, formatDate } from "../../utils/formatters";

interface RiTableProps {
  data: RechazosInterno[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
}

function CardSkeleton() {
  return (
    <div className="tabla-cards">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="tabla-card animate-pulse" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ height: 14, background: "#e8e8e8", width: "55%" }} />
          <div style={{ height: 10, background: "#e8e8e8", width: "80%" }} />
          <div style={{ height: 10, background: "#e8e8e8", width: "45%" }} />
        </div>
      ))}
    </div>
  );
}

export default function RiTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  isLoading = false,
}: RiTableProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const totalPages = Math.ceil(total / pageSize);
  const startIdx = (page - 1) * pageSize;

  // ── Vista de tarjetas (móvil) ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
        {isLoading ? (
          <CardSkeleton />
        ) : data.length === 0 ? (
          <div className="vacio" style={{ padding: 40 }}>Sin registros encontrados</div>
        ) : (
          <div className="tabla-cards">
            {data.map((ri, idx) => {
              const imgCount = typeof ri.cnt_images === "number" ? ri.cnt_images : (ri.images?.length ?? 0);
              return (
                <div key={ri.id} className="tabla-card" onClick={() => onView(ri.id)}>
                  {/* Header: License Plate + COPQ */}
                  <div className="tabla-card-header">
                    <div style={{ minWidth: 0 }}>
                      <div className="tabla-card-meta">
                        #{startIdx + idx + 1} · {formatDate(ri.fecha_registro, "dd/MM/yyyy")}
                      </div>
                      <div className="tabla-card-title">{ri.license_plate}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: "#2563a8", fontSize: 14, flexShrink: 0 }}>
                      {formatCurrency(Number(ri.costo_no_calidad))}
                    </span>
                  </div>

                  {/* Defecto + SKU */}
                  <div className="tabla-card-row">
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Defecto</span>
                      <span className="tabla-card-value">{ri.defecto || "—"}</span>
                    </div>
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">SKU</span>
                      <span className="tabla-card-value">{ri.sku || "—"}</span>
                    </div>
                  </div>

                  {/* Origen + Inspector */}
                  <div className="tabla-card-row">
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Origen</span>
                      <span className="tabla-card-value">{ri.origen_hallazgo || "—"}</span>
                    </div>
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Inspector</span>
                      <span className="tabla-card-value">{ri.inspector || "—"}</span>
                    </div>
                  </div>

                  {/* Actividad */}
                  {ri.actividad_realizar && (
                    <div className="tabla-card-field" style={{ marginBottom: 4 }}>
                      <span className="tabla-card-label">Actividad</span>
                      <span className="tabla-card-value wrap">{ri.actividad_realizar}</span>
                    </div>
                  )}

                  {/* Fotos */}
                  {imgCount > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#2563a8", fontWeight: 500 }}>
                        📷 {imgCount} {imgCount === 1 ? "foto" : "fotos"}
                      </span>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="tabla-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="btn-accion" onClick={() => onView(ri.id)}>Ver</button>
                    <button type="button" className="btn-accion" onClick={() => onEdit(ri.id)}>{t("common.edit")}</button>
                    <button type="button" className="btn-accion rojo" onClick={() => onDelete(ri.id)}>{t("common.delete")}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="paginador">
            <span>
              {startIdx + 1}–{Math.min(startIdx + pageSize, total)} de {total} registros
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>‹ Anterior</button>
              <span style={{ padding: "0 8px" }}>{page} / {totalPages}</span>
              <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Siguiente ›</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Loading skeleton (desktop) ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="tabla-wrap" style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
        <table className="tabla">
          <thead>
            <tr>{Array.from({ length: 11 }).map((_, i) => (
              <th key={i}><div className="h-3 w-16 animate-pulse" style={{ background: "#d0d0d0" }} /></th>
            ))}</tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: 11 }).map((_, j) => (
                  <td key={j}><div className="h-3 w-20 animate-pulse" style={{ background: "#e8e8e8" }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Empty state (desktop) ──────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="vacio" style={{ border: "1px dashed #ccc", padding: 64 }}>
        <svg className="mb-3 h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          aria-hidden="true" style={{ color: "#ccc", margin: "0 auto 12px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>Sin registros encontrados</p>
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
              <th className="whitespace-nowrap">#</th>
              <th className="whitespace-nowrap">{t("rechazos_internos.table.fecha")}</th>
              <th className="whitespace-nowrap">{t("rechazos_internos.table.license_plate")}</th>
              <th className="whitespace-nowrap">{t("rechazos_internos.table.sku")}</th>
              <th className="whitespace-nowrap">{t("rechazos_internos.table.defecto")}</th>
              <th className="whitespace-nowrap" style={{ maxWidth: 180 }}>{t("rechazos_internos.table.actividad")}</th>
              <th className="whitespace-nowrap" style={{ color: "#2563a8" }}>{t("rechazos_internos.table.copq")}</th>
              <th className="whitespace-nowrap">{t("rechazos_internos.table.origen")}</th>
              <th className="whitespace-nowrap">{t("rechazos_internos.table.inspector")}</th>
              <th className="centrado whitespace-nowrap">{t("rechazos_internos.table.fotos")}</th>
              <th className="whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((ri, idx) => {
              const imgCount = typeof ri.cnt_images === "number" ? ri.cnt_images : (ri.images?.length ?? 0);
              return (
                <tr key={ri.id} onClick={() => onView(ri.id)}>
                  <td className="whitespace-nowrap font-mono" style={{ fontSize: 11, color: "#999" }}>
                    {startIdx + idx + 1}
                  </td>
                  <td className="whitespace-nowrap">{formatDate(ri.fecha_registro, "dd/MM/yyyy")}</td>
                  <td className="whitespace-nowrap" style={{ fontWeight: 500 }}>{ri.license_plate}</td>
                  <td className="whitespace-nowrap">{ri.sku || <span style={{ color: "#bbb" }}>—</span>}</td>
                  <td className="whitespace-nowrap">{ri.defecto}</td>
                  <td style={{ maxWidth: 180 }}>
                    <span className="block overflow-hidden whitespace-nowrap" style={{ textOverflow: "ellipsis" }} title={ri.actividad_realizar}>
                      {ri.actividad_realizar || <span style={{ color: "#bbb" }}>—</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span style={{ fontWeight: 700, color: "#2563a8" }}>{formatCurrency(Number(ri.costo_no_calidad))}</span>
                  </td>
                  <td className="whitespace-nowrap">{ri.origen_hallazgo || <span style={{ color: "#bbb" }}>—</span>}</td>
                  <td className="whitespace-nowrap">{ri.inspector || <span style={{ color: "#bbb" }}>—</span>}</td>
                  <td className="centrado whitespace-nowrap">
                    {imgCount > 0 ? (
                      <span className="inline-flex items-center gap-1" style={{ color: "#2563a8", fontSize: 11, fontWeight: 500 }}>
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {imgCount}
                      </span>
                    ) : (
                      <span style={{ color: "#bbb", fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => onView(ri.id)} className="btn-accion">Ver</button>
                      <button type="button" onClick={() => onEdit(ri.id)} className="btn-accion">{t("common.edit")}</button>
                      <button type="button" onClick={() => onDelete(ri.id)} className="btn-accion rojo">{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="paginador">
          <span>Mostrando {startIdx + 1}–{Math.min(startIdx + pageSize, total)} de {total} registros</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>‹ Anterior</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) pageNum = i + 1;
              else if (page <= 4) pageNum = i + 1;
              else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
              else pageNum = page - 3 + i;
              return (
                <button key={pageNum} type="button" onClick={() => onPageChange(pageNum)}
                  style={pageNum === page ? { background: "#0d2b4e", color: "#fff", borderColor: "#0d2b4e" } : {}}>
                  {pageNum}
                </button>
              );
            })}
            <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Siguiente ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
