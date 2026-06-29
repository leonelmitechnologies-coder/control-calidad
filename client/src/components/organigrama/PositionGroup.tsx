/**
 * PositionGroup
 *
 * Renders a labeled group header + a responsive grid of EmployeeCards
 * for one position (puesto) category.
 */

import { useTranslation } from 'react-i18next';
import type { OrganigramaQc } from '../../types';
import EmployeeCard from './EmployeeCard';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CardActionHandlers {
  onEdit:         (emp: OrganigramaQc) => void;
  onDelete:       (emp: OrganigramaQc) => void;
  onStatusChange: (emp: OrganigramaQc) => void;
  onView:         (emp: OrganigramaQc) => void;
}

interface PositionGroupProps {
  position:  string;
  employees: OrganigramaQc[];
  handlers:  CardActionHandlers;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PositionGroup({
  position,
  employees,
  handlers,
}: PositionGroupProps) {
  const { t } = useTranslation();

  if (employees.length === 0) return null;

  // Map position key to i18n label
  const positionLabel = getPosLabel(position, t);

  return (
    <section className="space-y-3">
      {/* Group header */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-800">{positionLabel}</h2>
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-medium text-blue-700">
          {employees.length}
        </span>
        <div className="flex-1 border-t border-gray-200" />
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
    'Jefe QC':       t('organigrama.puestos.jefe_qc'),
    'Supervisor QC': t('organigrama.puestos.supervisor_qc'),
    'Inspector':     t('organigrama.puestos.inspector'),
    'Otro':          t('organigrama.puestos.otro'),
  };
  return MAP[position] ?? position;
}
