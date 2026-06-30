interface StatusBadgeProps {
  status: string;
  variant?: 'estatus' | 'severidad' | 'rol' | 'generic';
}

const BADGE_CLASS: Record<string, string> = {
  // Estatus NC / CAPA / RE / RI
  'Abierta':     'badge badge-abierta',
  'En proceso':  'badge badge-proceso',
  'Cerrada':     'badge badge-cerrada',
  'Rechazada':   'badge badge-rechazada',
  'Aprobado':    'badge badge-aprobado',
  'Rechazado':   'badge badge-rechazado',
  'Pendiente':   'badge badge-pendiente',
  // Severidad NC
  'Alta':        'badge badge-alta',
  'Media':       'badge badge-media',
  'Baja':        'badge badge-baja',
  'Crítica':     'badge badge-critica',
  'Mayor':       'badge badge-mayor',
  'Menor':       'badge badge-menor',
  // Rol / activo
  'Administrador': 'badge badge-admin',
  'Usuario':       'badge badge-usuario',
  'Activo':        'badge badge-activo',
  'Inactivo':      'badge badge-inactivo',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cls = BADGE_CLASS[status] ?? 'badge badge-usuario';
  return <span className={cls}>{status}</span>;
}
