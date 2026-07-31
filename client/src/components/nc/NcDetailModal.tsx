/**
 * NcDetailModal — Read-only detail view for a No Conformidad
 *
 * Shows all fields in a two-column grid.
 * Provides status advancement buttons based on current estatus:
 *   Abierta     → "Marcar En proceso"
 *   En proceso  → "Marcar Cerrada"
 *
 * Props:
 *   isOpen          - controls visibility
 *   data            - the NC record to display
 *   onClose         - called when user clicks Cerrar or overlay
 *   onStatusChange  - called with the new estatus string
 *   statusChanging  - loading state for the status mutation
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { NoConformidad } from "../../types";
import StatusBadge from "../common/StatusBadge";

// ── Helper: format date ────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ── Detail row helper ─────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group" style={{ marginBottom: 10 }}>
      <label style={{ marginBottom: 2 }}>{label}</label>
      <div style={{ fontSize: 13, color: "#111" }}>{children}</div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface NcDetailModalProps {
  isOpen: boolean;
  data: NoConformidad | null;
  onClose: () => void;
  onStatusChange: (newStatus: string) => void;
  statusChanging?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NcDetailModal({
  isOpen,
  data,
  onClose,
  onStatusChange,
  statusChanging = false,
}: NcDetailModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const firstBtn = dialogRef.current.querySelector<HTMLElement>("button");
      firstBtn?.focus();
    }
  }, [isOpen]);

  if (!isOpen || !data) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // Determine next status action
  const nextStatusMap: Record<string, string> = {
    Abierta: "En proceso",
    "En proceso": "Cerrada",
  };
  const nextStatusLabel: Record<string, string> = {
    Abierta: "Marcar En proceso",
    "En proceso": "Marcar Cerrada",
  };
  const nextStatus = nextStatusMap[data.estatus];
  const nextLabel = nextStatusLabel[data.estatus];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nc-detail-title"
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white"
        style={{ border: "1px solid #e2e2e2" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 bg-white flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #e2e2e2" }}
        >
          <div className="flex items-center gap-3">
            <div
              id="nc-detail-title"
              className="modal-titulo"
              style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}
            >
              {t("nc.detail.title")} #{data.id}
            </div>
            <StatusBadge status={data.estatus} />
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "#777",
              lineHeight: 1,
            }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Core fields — 2-column grid */}
          <div className="form-grid" style={{ marginBottom: 14 }}>
            <DetailRow label={t("nc.form.fecha")}>{formatFecha(data.fecha)}</DetailRow>
            <DetailRow label={t("nc.form.hora")}>{(data.hora ?? "").slice(0, 5)}</DetailRow>
            <DetailRow label={t("nc.form.area")}>{data.area}</DetailRow>
            <DetailRow label={t("nc.form.tipo")}>{data.tipo}</DetailRow>
            <DetailRow label={t("nc.form.severidad")}>
              <StatusBadge status={data.severidad} variant="severidad" />
            </DetailRow>
            <DetailRow label={t("nc.form.responsable")}>{data.responsable}</DetailRow>
          </div>

          {/* Descripción — full width */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>{t("nc.form.descripcion")}</label>
            <div
              className="whitespace-pre-wrap"
              style={{
                fontSize: 13,
                color: "#111",
                background: "#f4f6f9",
                padding: "10px 12px",
                border: "1px solid #e2e2e2",
              }}
            >
              {data.descripcion || "—"}
            </div>
          </div>

          {/* Acción correctiva — full width */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>{t("nc.form.accion")}</label>
            <div
              className="whitespace-pre-wrap"
              style={{
                fontSize: 13,
                color: "#111",
                background: "#f4f6f9",
                padding: "10px 12px",
                border: "1px solid #e2e2e2",
              }}
            >
              {data.accion || "—"}
            </div>
          </div>

          {/* Metadata */}
          <p
            style={{
              fontSize: 11,
              color: "#aaa",
              borderTop: "1px solid #e2e2e2",
              paddingTop: 12,
              marginTop: 8,
            }}
          >
            {t("nc.detail.created_by", {
              name: data.registrado_por,
              date: formatFecha(data.fecha),
            })}
          </p>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 bg-white flex items-center justify-between px-6 py-4"
          style={{ borderTop: "1px solid #e2e2e2" }}
        >
          <div>
            {nextStatus && (
              <button
                onClick={() => onStatusChange(nextStatus)}
                disabled={statusChanging}
                className="btn btn-primario"
              >
                {nextLabel}
              </button>
            )}
          </div>

          <button onClick={onClose} className="btn btn-secundario">
            {t("nc.detail.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
