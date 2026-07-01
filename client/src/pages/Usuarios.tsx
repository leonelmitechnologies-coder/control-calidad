/**
 * Usuarios — Administración de usuarios SSO y permisos por módulo
 */

import { useCallback, useEffect, useState } from 'react';
import { useNotify } from '../context/NotifyContext';
import { useConfirm } from '../context/ConfirmContext';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import type { ModuloPermisos } from '../api/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsuarioDb {
  id: number;
  oidc_id: string;
  nombre: string;
  usuario: string;
  email: string;
  rol: string;
  activo: boolean;
  permisos: Record<string, ModuloPermisos>;
  ultimo_acceso: string | null;
  created_at: string;
}

// Módulos con sus claves de permisos
const MODULOS_PERMISOS = [
  { key: '',                    label: 'Dashboard',            soloVer: true  },
  { key: 'nc',                  label: 'No Conformidades',     soloVer: false },
  { key: 'recepciones',         label: 'Recepciones',          soloVer: false },
  { key: 'rechazos-ext',        label: 'Rechazos Externos',    soloVer: false },
  { key: 'rechazos-int',        label: 'Rechazos Internos',    soloVer: false },
  { key: 'capas',               label: 'CAPA',                 soloVer: false },
  { key: 'aql',                 label: 'AQL',                  soloVer: false },
  { key: 'liberacion-shipping', label: 'Liberación Shipping',  soloVer: false },
  { key: 'organigrama-qc',      label: 'Organigrama QC',       soloVer: false },
  { key: 'calendario',          label: 'Calendario',           soloVer: false },
  { key: 'manual',              label: 'Manual',               soloVer: true  },
];

const DEFAULT_PERMISOS: Record<string, ModuloPermisos> = Object.fromEntries(
  MODULOS_PERMISOS.map(m => [m.key, { ver: true, editar: !m.soloVer, eliminar: false }])
);

// ── API helper ────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j?.error ?? j?.message ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

// ── Panel de permisos (modal lateral) ────────────────────────────────────────

interface PermisosModalProps {
  usr: UsuarioDb;
  onClose: () => void;
  onSaved: () => void;
}

function PermisosModal({ usr, onClose, onSaved }: PermisosModalProps) {
  const notify  = useNotify();
  const [saving, setSaving]   = useState(false);
  const [rol,    setRol]      = useState(usr.rol);
  const [perms,  setPerms]    = useState<Record<string, ModuloPermisos>>(
    () => ({ ...DEFAULT_PERMISOS, ...usr.permisos })
  );

  const isAdmin = rol === 'Administrador';

  const toggle = (key: string, campo: keyof ModuloPermisos) => {
    setPerms(prev => ({
      ...prev,
      [key]: { ...prev[key], [campo]: !prev[key]?.[campo] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/usuarios/${usr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol, permisos: isAdmin ? DEFAULT_PERMISOS : perms }),
      });
      notify('Permisos actualizados correctamente.', 'success');
      onSaved();
    } catch (err: any) {
      notify(err.message ?? 'Error al guardar permisos.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const S = {
    th: { padding: '8px 12px', textAlign: 'center' as const, fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
    td: { padding: '8px 12px', textAlign: 'center' as const },
    tdLabel: { padding: '8px 12px', fontSize: 13, color: '#222' },
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg flex flex-col" style={{ border: '1px solid #e2e2e2', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #e2e2e2' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0d2b4e' }}>{usr.nombre}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{usr.email || usr.oidc_id}</div>
        </div>

        {/* Rol */}
        <div className="px-6 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #f0f0f0' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#444', minWidth: 40 }}>Rol:</label>
          <select
            value={rol}
            onChange={e => setRol(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #ddd' }}
          >
            <option value="Usuario">Usuario</option>
            <option value="Administrador">Administrador</option>
          </select>
          {isAdmin && (
            <span style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
              Los administradores tienen acceso total
            </span>
          )}
        </div>

        {/* Permisos grid */}
        <div className="overflow-y-auto flex-1">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f8f8', borderBottom: '1px solid #e8e8e8' }}>
                <th style={{ ...S.th, textAlign: 'left', minWidth: 160 }}>Módulo</th>
                <th style={S.th}>Ver</th>
                <th style={S.th}>Editar</th>
                <th style={S.th}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {MODULOS_PERMISOS.map((m, idx) => {
                const p = perms[m.key] ?? DEFAULT_PERMISOS[m.key];
                return (
                  <tr key={m.key} style={{ borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={S.tdLabel}>{m.label}</td>

                    {/* Ver */}
                    <td style={S.td}>
                      <input
                        type="checkbox"
                        checked={isAdmin || p.ver}
                        disabled={isAdmin}
                        onChange={() => toggle(m.key, 'ver')}
                        style={{ cursor: isAdmin ? 'default' : 'pointer', width: 15, height: 15 }}
                      />
                    </td>

                    {/* Editar */}
                    <td style={S.td}>
                      {m.soloVer ? (
                        <span style={{ color: '#ccc', fontSize: 11 }}>—</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isAdmin || p.editar}
                          disabled={isAdmin}
                          onChange={() => toggle(m.key, 'editar')}
                          style={{ cursor: isAdmin ? 'default' : 'pointer', width: 15, height: 15 }}
                        />
                      )}
                    </td>

                    {/* Eliminar */}
                    <td style={S.td}>
                      {m.soloVer ? (
                        <span style={{ color: '#ccc', fontSize: 11 }}>—</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={isAdmin || p.eliminar}
                          disabled={isAdmin}
                          onChange={() => toggle(m.key, 'eliminar')}
                          style={{ cursor: isAdmin ? 'default' : 'pointer', width: 15, height: 15 }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-6 py-4" style={{ borderTop: '1px solid #e2e2e2' }}>
          <button className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primario"
            onClick={handleSave}
            disabled={saving}
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Guardando...' : 'Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Usuarios() {
  const notify  = useNotify();
  const confirm = useConfirm();
  const { user: meUser } = useAuth();

  const [usuarios,   setUsuarios]   = useState<UsuarioDb[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [gestionando, setGestionando] = useState<UsuarioDb | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<UsuarioDb[]>(`${API_BASE_URL}/api/usuarios`);
      setUsuarios(data);
    } catch (err: any) {
      notify(err.message ?? 'Error cargando usuarios.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (u: UsuarioDb) => {
    const accion = u.activo ? 'desactivar' : 'activar';
    const ok = await confirm({
      title: `${u.activo ? 'Desactivar' : 'Activar'} usuario`,
      message: `¿Seguro que deseas ${accion} a "${u.nombre}"?${u.activo ? ' No podrá iniciar sesión.' : ''}`,
    });
    if (!ok) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/usuarios/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !u.activo }),
      });
      notify(`Usuario ${u.activo ? 'desactivado' : 'activado'}.`, 'success');
      await cargar();
    } catch (err: any) {
      notify(err.message ?? 'Error al cambiar estatus.', 'error');
    }
  };

  if (loading) return <p className="vacio">Cargando usuarios...</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Usuarios del Sistema</h1>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            Los usuarios se registran automáticamente al iniciar sesión con SSO.
          </p>
        </div>
      </div>

      {usuarios.length === 0 ? (
        <p className="vacio">Ningún usuario ha iniciado sesión aún.</p>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email / Usuario</th>
                <th>Rol</th>
                <th>Último acceso</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const esMio = meUser && u.oidc_id === meUser.id;
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>
                      {u.nombre}
                      {esMio && <span style={{ marginLeft: 8, fontSize: 10, color: '#aaa' }}>(tú)</span>}
                    </td>
                    <td style={{ fontSize: 12, color: '#555' }}>
                      {u.email || u.usuario || u.oidc_id}
                    </td>
                    <td>
                      <span className={u.rol === 'Administrador' ? 'badge badge-admin' : 'badge badge-usuario'}>
                        {u.rol}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#777' }}>{fmt(u.ultimo_acceso)}</td>
                    <td>
                      <span className={u.activo ? 'badge badge-activo' : 'badge badge-inactivo'}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <button className="btn-accion" onClick={() => setGestionando(u)}>
                        Permisos
                      </button>
                      {' '}
                      {!esMio && (
                        <button className="btn-accion" onClick={() => toggleActivo(u)}>
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {gestionando && (
        <PermisosModal
          usr={gestionando}
          onClose={() => setGestionando(null)}
          onSaved={() => { setGestionando(null); cargar(); }}
        />
      )}
    </div>
  );
}
