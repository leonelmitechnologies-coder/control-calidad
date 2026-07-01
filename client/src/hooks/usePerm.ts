import { useAuth } from './useAuth';
import type { ModuloPermisos } from '../api/auth';

const FULL: ModuloPermisos    = { ver: true, editar: true, eliminar: true };
const DEFAULT: ModuloPermisos = { ver: true, editar: true, eliminar: false };
const NONE: ModuloPermisos    = { ver: false, editar: false, eliminar: false };

/**
 * Returns the permissions for a given module key (e.g. 'nc', 'rechazos-int').
 * Admins (rol === 'Administrador' or permisos === null) always get full access.
 * If the user has no permisos entry for the module, DEFAULT is returned.
 */
export function usePerm(modulo: string): ModuloPermisos {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) return NONE;
  if (user.rol === 'Administrador' || user.permisos === null) return FULL;
  const p = user.permisos?.[modulo];
  return p ?? DEFAULT;
}
