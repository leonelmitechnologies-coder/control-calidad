/**
 * StatusBadge — Reusable colored badge for NC estatus values
 *
 * Estatus color mapping:
 *   Abierta     → yellow
 *   En Progreso → blue
 *   Cerrada     → green
 *   Rechazada   → red
 *
 * Also handles Severidad:
 *   Crítica     → red
 *   Mayor       → orange
 *   Menor       → yellow
 */

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'estatus' | 'severidad';
}

const ESTATUS_COLORS: Record<string, string> = {
  Abierta:      'bg-yellow-100 text-yellow-800 border-yellow-300',
  'En Progreso': 'bg-blue-100   text-blue-800   border-blue-300',
  Cerrada:      'bg-green-100  text-green-800  border-green-300',
  Rechazada:    'bg-red-100    text-red-800    border-red-300',
};

const SEVERIDAD_COLORS: Record<string, string> = {
  'Crítica': 'bg-red-100    text-red-800    border-red-300',
  Mayor:     'bg-orange-100 text-orange-800 border-orange-300',
  Menor:     'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const SIZE_CLASSES: Record<NonNullable<StatusBadgeProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
  lg: 'px-3 py-1 text-sm',
};

export default function StatusBadge({
  status,
  size = 'sm',
  variant = 'estatus',
}: StatusBadgeProps) {
  const colorMap = variant === 'severidad' ? SEVERIDAD_COLORS : ESTATUS_COLORS;
  const colors = colorMap[status] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  const sizeClass = SIZE_CLASSES[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${colors} ${sizeClass}`}
    >
      {status}
    </span>
  );
}
