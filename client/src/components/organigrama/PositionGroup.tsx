/**
 * PositionGroup
 *
 * Renders a labeled group header + a responsive grid of EmployeeCards
 * for one position (puesto) category.
 */

import { useTranslation } from "react-i18next";
import type { OrganigramaQc } from "../../types";
import EmployeeCard from "./EmployeeCard";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CardActionHandlers {
  onEdit: (emp: OrganigramaQc) => void;
  onDelete: (emp: OrganigramaQc) => void;
  onStatusChange: (emp: OrganigramaQc) => void;
  onView: (emp: OrganigramaQc) => void;
}

interface PositionGroupProps {
  position: string;
  employees: OrganigramaQc[];
  handlers: CardActionHandlers;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PositionGroup({ position, employees, handlers }: PositionGroupProps) {
  const { t } = useTranslation();

  if (employees.length === 0) return null;

  // Map position key to i18n label
  const positionLabel = getPosLabel(position, t);

  return (
    <section style={{ marginBottom: 28 }}>
      {/* Group header */}
      <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
        <div className="seccion-titulo" style={{ marginBottom: 0, flex: "none" }}>
          {positionLabel}
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            fontSize: 11,
            fontWeight: 700,
            background: "#e8f0fd",
            color: "#0d2b4e",
            border: "1px solid #0d2b4e",
          }}
        >
          {employees.length}
        </span>
        <div style={{ flex: 1, borderTop: "1px solid #e2e2e2" }} />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {employees.map((emp) => (
          <EmployeeCard
            key={emp.id}
            employee={emp}
            onEdit={() => handlers.onEdit(emp)}
            onDelete={() => handlers.onDelete(emp)}
            onStatusChange={() => handlers.onStatusChange(emp)}
            onView={() => handlers.onView(emp)}
          />
        ))}
      </div>
    </section>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPosLabel(position: string, t: (key: string) => string): string {
  const MAP: Record<string, string> = {
    "Jefe QC": t("organigrama.puestos.jefe_qc"),
    "Supervisor QC": t("organigrama.puestos.supervisor_qc"),
    Inspector: t("organigrama.puestos.inspector"),
    Otro: t("organigrama.puestos.otro"),
  };
  return MAP[position] ?? position;
}
