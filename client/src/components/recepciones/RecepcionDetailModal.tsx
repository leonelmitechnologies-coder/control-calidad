/**
 * RecepcionDetailModal — Read-only detail view for a single Recepcion.
 *
 * Shows all fields grouped by section, creation metadata, and contextual
 * status-change action buttons:
 *   Confirmado  → "Marcar en descarga"
 *   En descarga → "Marcar Descargado" + "Marcar Rechazado"
 *
 * Data operations (status change, close) are passed in as callbacks;
 * this component is purely presentational.
 */

import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Recepcion } from "../../types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface RecepcionDetailModalProps {
  isOpen: boolean;
  data: Recepcion;
  onClose: () => void;
  /** Called when the user clicks a status-change action button */
  onStatusChange: (newStatus: Recepcion["estatus"]) => void;
  isUpdatingStatus?: boolean;
}

// ── Badge helper ──────────────────────────────────────────────────────────────

function EstatusBadge({ estatus }: { estatus: Recepcion["estatus"] }) {
  const badgeMap: Record<Recepcion["estatus"], string> = {
    Confirmado: "badge badge-cerrada",
    "En descarga": "badge badge-proceso",
    Descargado: "badge badge-usuario",
    Rechazado: "badge badge-rechazada",
  };
  const cls = badgeMap[estatus] ?? "badge badge-usuario";
  return <span className={cls}>{estatus}</span>;
}

// ── Read-only field ───────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="form-group" style={{ marginBottom: 10 }}>
      <label style={{ marginBottom: 2 }}>{label}</label>
      <div style={{ fontSize: 13, color: "#111" }}>{value ?? "—"}</div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="seccion-titulo">{title}</div>
      <div className="form-grid">{children}</div>
    </div>
  );
}

// ── Status action buttons ─────────────────────────────────────────────────────

function StatusActions({
  estatus,
  onStatusChange,
  isUpdating,
}: {
  estatus: Recepcion["estatus"];
  onStatusChange: (s: Recepcion["estatus"]) => void;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();

  if (estatus === "Confirmado") {
    return (
      <button
        type="button"
        disabled={isUpdating}
        onClick={() => onStatusChange("En descarga")}
        className="btn btn-primario"
      >
        {isUpdating ? t("common.loading") : t("recepciones.actions.marcar_en_descarga")}
      </button>
    );
  }

  if (estatus === "En descarga") {
    return (
      <div className="btn-grupo" style={{ marginTop: 0 }}>
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onStatusChange("Descargado")}
          className="btn btn-primario"
        >
          {isUpdating ? t("common.loading") : t("recepciones.actions.marcar_descargado")}
        </button>
        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onStatusChange("Rechazado")}
          className="btn btn-peligro"
        >
          {isUpdating ? t("common.loading") : t("recepciones.actions.marcar_rechazado")}
        </button>
      </div>
    );
  }

  return null; // Descargado / Rechazado — no action buttons
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecepcionDetailModal({
  isOpen,
  data,
  onClose,
  onStatusChange,
  isUpdatingStatus = false,
}: RecepcionDetailModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const registradoDate = data.fecha_actualizado
    ? new Date(data.fecha_actualizado).toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      className="fixed inset-0 z-[800] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        className="relative z-10 w-full max-w-2xl bg-white"
        style={{ border: "1px solid #e2e2e2" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #e2e2e2" }}
        >
          <div className="flex items-center gap-3">
            <div
              id="detail-modal-title"
              className="modal-titulo"
              style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}
            >
              {t("recepciones.detail_title")} #{data.id}
            </div>
            <EstatusBadge estatus={data.estatus} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "#777",
              lineHeight: 1,
            }}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Section 1: Información General */}
          <Section title={t("recepciones.form.section_general")}>
            <DetailField label={t("recepciones.form.fecha")} value={data.fecha} />
            <DetailField label={t("recepciones.form.hora")} value={data.hora.slice(0, 5)} />
            <DetailField label={t("recepciones.form.company")} value={data.company} />
            <DetailField label={t("recepciones.form.origen")} value={data.origen} />
          </Section>

          {/* Section 2: Carga */}
          <Section title={t("recepciones.form.section_carga")}>
            <DetailField label={t("recepciones.form.cargo")} value={data.cargo} />
            <DetailField
              label={t("recepciones.form.unit_qty")}
              value={data.unit_qty.toLocaleString()}
            />
            <DetailField
              label={t("recepciones.form.pallet_qty")}
              value={data.pallet_qty.toLocaleString()}
            />
          </Section>

          {/* Section 3: Logística */}
          <Section title={t("recepciones.form.section_logistica")}>
            <DetailField
              label={t("recepciones.form.tipo")}
              value={
                <span
                  style={{
                    fontSize: 12,
                    background: "#f4f6f9",
                    padding: "2px 8px",
                    border: "1px solid #e2e2e2",
                    color: "#111",
                  }}
                >
                  {data.tipo}
                </span>
              }
            />
            <DetailField
              label={t("recepciones.form.estatus")}
              value={<EstatusBadge estatus={data.estatus} />}
            />
          </Section>

          {/* Section 4: Auditoría */}
          <Section title={t("recepciones.form.section_auditoria")}>
            <DetailField
              label={t("recepciones.form.registrado_por")}
              value={data.registrado_por ?? "—"}
            />
            <DetailField label={t("recepciones.form.fecha_actualizado")} value={registradoDate} />
          </Section>

          {/* Registration metadata */}
          <p style={{ fontSize: 11, color: "#aaa" }}>
            {t("recepciones.registered_by", {
              name: data.registrado_por ?? "?",
              date: data.fecha,
            })}
          </p>
        </div>

        {/* Footer — status actions + close */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: "1px solid #e2e2e2" }}
        >
          <StatusActions
            estatus={data.estatus}
            onStatusChange={onStatusChange}
            isUpdating={isUpdatingStatus}
          />
          <button type="button" onClick={onClose} className="btn btn-secundario">
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
