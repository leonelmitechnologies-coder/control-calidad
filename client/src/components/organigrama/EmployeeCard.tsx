/**
 * EmployeeCard
 *
 * Displays a single OrganigramaQc employee as a card.
 * On hover, action buttons (Editar, Eliminar, Cambiar Estatus) slide in.
 * Clicking anywhere on the card (outside buttons) triggers onView.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrganigramaQc } from '../../types';
import { API_BASE_URL } from '../../config/api';

// ── Props ─────────────────────────────────────────────────────────────────────

interface EmployeeCardProps {
  employee: OrganigramaQc;
  onEdit:         () => void;
  onDelete:       () => void;
  onStatusChange: () => void;
  onView:         () => void;
}

// ── Photo helper ──────────────────────────────────────────────────────────────

function avatarUrl(emp: OrganigramaQc): string | null {
  if (!emp.foto_filename) return null;
  return `${API_BASE_URL}/uploads/organigrama/${emp.foto_filename}`;
}

// ── Initials fallback ─────────────────────────────────────────────────────────

function initials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Status badge colors ───────────────────────────────────────────────────────

function estatusBadgeClass(estatus: string): string {
  return estatus === 'activo'
    ? 'bg-green-100 text-green-800 border-green-300'
    : 'bg-red-100 text-red-800 border-red-300';
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

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only trigger onView if the click isn't on an action button
    const target = e.target as HTMLElement;
    if (target.closest('[data-action]')) return;
    onView();
  };

  return (
    <div
      className="relative rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow cursor-pointer select-none overflow-hidden"
      style={{ minWidth: '160px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onView(); }}
      aria-label={`Ver detalle: ${employee.nombre_completo}`}
    >
      {/* Hover action overlay */}
      {hovered && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/40 px-3 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            data-action="edit"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-full rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t('organigrama.edit')}
          </button>
          <button
            type="button"
            data-action="status"
            onClick={(e) => { e.stopPropagation(); onStatusChange(); }}
            className="w-full rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            {t('organigrama.cambiar_estatus')}
          </button>
          <button
            type="button"
            data-action="delete"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-full rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {t('organigrama.delete')}
          </button>
        </div>
      )}

      {/* Card content */}
      <div className="flex flex-col items-center p-4 text-center">
        {/* Avatar */}
        <div className="mb-3 h-20 w-20 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100 flex items-center justify-center flex-shrink-0">
          {photo ? (
            <img
              src={photo}
              alt={employee.nombre_completo}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xl font-bold text-gray-500">
              {initials(employee.nombre_completo)}
            </span>
          )}
        </div>

        {/* Name */}
        <p className="mb-1 text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
          {employee.nombre_completo}
        </p>

        {/* Puesto */}
        <p className="mb-1 text-xs text-gray-500 line-clamp-1">
          {employee.puesto}
        </p>

        {/* Turno */}
        <p className="mb-3 text-xs text-gray-400">
          {employee.turno}
        </p>

        {/* Estatus badge */}
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${estatusBadgeClass(employee.estatus)}`}
        >
          {employee.estatus === 'activo'
            ? t('organigrama.estatus.activo')
            : t('organigrama.estatus.inactivo')}
        </span>
      </div>
    </div>
  );
}
