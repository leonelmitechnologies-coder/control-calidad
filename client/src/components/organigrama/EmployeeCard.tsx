/**
 * EmployeeCard
 *
 * Displays a single OrganigramaQc employee as a card.
 * On hover (mouse only), action buttons slide in.
 * Clicking anywhere on the card (outside buttons) triggers onView.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { OrganigramaQc } from "../../types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface EmployeeCardProps {
  employee: OrganigramaQc;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: () => void;
  onView: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarUrl(emp: OrganigramaQc): string | null {
  if (emp.fotoUrl) return emp.fotoUrl;
  const filename = emp.foto_filename ?? emp.fotoFilename;
  if (!filename) return null;
  return `/api/media/organigrama/${filename}`;
}

function initials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function empGet(emp: OrganigramaQc, snake: string, camel: string): string {
  const e = emp as unknown as Record<string, unknown>;
  return String(e[camel] ?? e[snake] ?? "");
}

// True when the primary pointer is a mouse/trackpad (not a touchscreen)
function hasFinePointer(): boolean {
  return window.matchMedia?.("(pointer: fine)").matches ?? false;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmployeeCard({
  employee,
  onEdit,
  onDelete,
  onStatusChange,
  onView,
}: EmployeeCardProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);

  const photo = avatarUrl(employee);
  const nombreCompleto = empGet(employee, "nombre_completo", "nombreCompleto");

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-action]")) return;
    onView();
  };

  return (
    <div
      className="relative cursor-pointer select-none overflow-hidden"
      style={{
        minWidth: 160,
        border: "1px solid #e2e2e2",
        background: "#fff",
      }}
      onMouseEnter={() => { if (hasFinePointer()) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onView();
      }}
      aria-label={`Ver detalle: ${nombreCompleto}`}
    >
      {/* Hover action overlay — mouse only */}
      {hovered && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-3"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            data-action="edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            style={{
              width: "100%",
              background: "#fff",
              border: "none",
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 700,
              color: "#111",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            {t("organigrama.edit")}
          </button>
          <button
            type="button"
            data-action="status"
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange();
            }}
            style={{
              width: "100%",
              background: "#fff",
              border: "none",
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 700,
              color: "#111",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            {t("organigrama.cambiar_estatus")}
          </button>
          <button
            type="button"
            data-action="delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              width: "100%",
              background: "#c0392b",
              border: "none",
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            {t("organigrama.delete")}
          </button>
        </div>
      )}

      {/* Card content */}
      <div className="flex flex-col items-center p-4 text-center">
        {/* Avatar */}
        <div
          className="flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{
            width: 72,
            height: 72,
            marginBottom: 10,
            border: "2px solid #e2e2e2",
            background: "#f4f6f9",
            borderRadius: "50%",
          }}
        >
          {photo ? (
            <img
              src={photo}
              alt={nombreCompleto}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span style={{ fontSize: 20, fontWeight: 700, color: "#777" }}>
              {initials(nombreCompleto)}
            </span>
          )}
        </div>

        {/* Name */}
        <p
          style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 4, lineHeight: 1.3 }}
          className="line-clamp-2"
        >
          {nombreCompleto}
        </p>

        {/* Puesto */}
        <p style={{ fontSize: 11, color: "#777", marginBottom: 3 }} className="line-clamp-1">
          {employee.puesto}
        </p>

        {/* Turno */}
        <p style={{ fontSize: 11, color: "#aaa", marginBottom: 10 }}>{employee.turno}</p>

        {/* Estatus badge */}
        <span className={`badge badge-${employee.estatus === "activo" ? "activo" : "inactivo"}`}>
          {employee.estatus === "activo"
            ? t("organigrama.estatus.activo")
            : t("organigrama.estatus.inactivo")}
        </span>
      </div>
    </div>
  );
}
