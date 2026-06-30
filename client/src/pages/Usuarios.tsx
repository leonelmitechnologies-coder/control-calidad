/**
 * Usuarios — Administración de cuentas del sistema
 */

import { useCallback, useEffect, useState } from 'react';
import { useNotify } from '../context/NotifyContext';
import { useConfirm } from '../context/ConfirmContext';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../hooks/useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  rol: string;
  area?: string;
  activo: boolean;
  createdAt?: string;
}

const ROLES  = ['Administrador', 'Usuario'];
const AREAS  = ['Incoming', 'Sorting', 'FFT', 'Paletizado', 'Almacen', 'Shipping', 'Calidad', 'Administracion'];

// ── API ───────────────────────────────────────────────────────────────────────

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

// ── Modal Nuevo Usuario ───────────────────────────────────────────────────────

interface NuevoModalProps { onClose: () => void; onSaved: () => void; }

function NuevoModal({ onClose, onSaved }: NuevoModalProps) {
  const notify = useNotify();
  const [saving,  setSaving]  = useState(false);
  const [nombre,  setNombre]  = useState('');
  const [usuario, setUsuario] = useState('');
  const [pass,    setPass]    = useState('');
  const [pass2,   setPass2]   = useState('');
  const [rol,     setRol]     = useState('Usuario');
  const [area,    setArea]    = useState('');
  const [errMsg,  setErrMsg]  = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg('');
    if (!/^\S+$/.test(usuario)) { setErrMsg('El usuario no debe contener espacios.'); return; }
    if (pass.length < 6)         { setErrMsg('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (pass !== pass2)           { setErrMsg('Las contraseñas no coinciden.'); return; }

    setSaving(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), usuario: usuario.trim().toLowerCase(), password: pass, rol, area }),
      });
      notify('Usuario creado correctamente.', 'success');
      onSaved();
    } catch (err: any) { setErrMsg(err.message ?? 'Error al crear usuario.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md" style={{ border: '1px solid #e2e2e2' }}>
        <div className="p-6">
          <div className="modal-titulo">Nuevo Usuario</div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label>Nombre completo <span style={{ color: '#d00' }}>*</span></label>
              <input className="w-full" value={nombre} onChange={e => setNombre(e.target.value)} required />
            </div>
            <div>
              <label>Nombre de usuario <span style={{ color: '#d00' }}>*</span></label>
              <input className="w-full" value={usuario} onChange={e => setUsuario(e.target.value.toLowerCase())} required autoComplete="off" />
            </div>
            <div className="form-grid">
              <div>
                <label>Contraseña <span style={{ color: '#d00' }}>*</span></label>
                <input type="password" className="w-full" value={pass} onChange={e => setPass(e.target.value)} required autoComplete="new-password" />
              </div>
              <div>
                <label>Confirmar contraseña <span style={{ color: '#d00' }}>*</span></label>
                <input type="password" className="w-full" value={pass2} onChange={e => setPass2(e.target.value)} required />
              </div>
              <div>
                <label>Rol</label>
                <select className="w-full" value={rol} onChange={e => setRol(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label>Área</label>
                <select className="w-full" value={area} onChange={e => setArea(e.target.value)}>
                  <option value="">Sin área</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            {errMsg && <p className="form-error">{errMsg}</p>}
            <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '1px solid #e2e2e2' }}>
              <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
              <button type="submit" disabled={saving} className="btn btn-primario" style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Modal Editar Usuario ──────────────────────────────────────────────────────

interface EditarModalProps { usr: Usuario; onClose: () => void; onSaved: () => void; }

function EditarModal({ usr, onClose, onSaved }: EditarModalProps) {
  const notify = useNotify();
  const [saving,  setSaving]  = useState(false);
  const [nombre,  setNombre]  = useState(usr.nombre);
  const [usuario, setUsuario] = useState(usr.usuario);
  const [pass,    setPass]    = useState('');
  const [rol,     setRol]     = useState(usr.rol);
  const [area,    setArea]    = useState(usr.area ?? '');
  const [errMsg,  setErrMsg]  = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg('');
    if (!/^\S+$/.test(usuario))  { setErrMsg('El usuario no debe contener espacios.'); return; }
    if (pass && pass.length < 6) { setErrMsg('La contraseña debe tener al menos 6 caracteres.'); return; }

    setSaving(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/usuarios/${usr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), usuario: usuario.trim().toLowerCase(), ...(pass ? { password: pass } : {}), rol, area }),
      });
      notify('Usuario actualizado correctamente.', 'success');
      onSaved();
    } catch (err: any) { setErrMsg(err.message ?? 'Error al actualizar usuario.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md" style={{ border: '1px solid #e2e2e2' }}>
        <div className="p-6">
          <div className="modal-titulo">Editar Usuario</div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label>Nombre completo <span style={{ color: '#d00' }}>*</span></label>
              <input className="w-full" value={nombre} onChange={e => setNombre(e.target.value)} required />
            </div>
            <div>
              <label>Nombre de usuario <span style={{ color: '#d00' }}>*</span></label>
              <input className="w-full" value={usuario} onChange={e => setUsuario(e.target.value.toLowerCase())} required />
            </div>
            <div className="form-grid">
              <div className="full">
                <label>Nueva contraseña <span style={{ color: '#aaa', fontWeight: 'normal' }}>(dejar en blanco para no cambiar)</span></label>
                <input type="password" className="w-full" value={pass} onChange={e => setPass(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <label>Rol</label>
                <select className="w-full" value={rol} onChange={e => setRol(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label>Área</label>
                <select className="w-full" value={area} onChange={e => setArea(e.target.value)}>
                  <option value="">Sin área</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            {errMsg && <p className="form-error">{errMsg}</p>}
            <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '1px solid #e2e2e2' }}>
              <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
              <button type="submit" disabled={saving} className="btn btn-primario" style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Usuarios() {
  const notify  = useNotify();
  const confirm = useConfirm();
  const { user } = useAuth();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showNuevo,  setShowNuevo]  = useState(false);
  const [editando,   setEditando]   = useState<Usuario | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await apiFetch<Usuario[]>(`${API_BASE_URL}/api/usuarios`);
      setUsuarios(data);
    } catch (err: any) { notify(err.message ?? 'Error cargando usuarios.', 'error'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (u: Usuario) => {
    try {
      await apiFetch(`${API_BASE_URL}/api/usuarios/${u.id}/toggle`, { method: 'PATCH' });
      await cargar();
    } catch (err: any) { notify(err.message ?? 'Error al cambiar estatus.', 'error'); }
  };

  const eliminar = async (u: Usuario) => {
    const ok = await confirm({ title: 'Eliminar usuario', message: `Esta acción eliminará al usuario "${u.nombre}" de forma permanente.` });
    if (!ok) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/usuarios/${u.id}`, { method: 'DELETE' });
      notify('Usuario eliminado.', 'success');
      await cargar();
    } catch (err: any) { notify(err.message ?? 'Error al eliminar.', 'error'); }
  };

  if (loading) return <p className="vacio">Cargando...</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Usuarios del Sistema</h1>
        <button className="btn btn-primario" onClick={() => setShowNuevo(true)}>+ Nuevo usuario</button>
      </div>

      {usuarios.length === 0 ? (
        <p className="vacio">Sin usuarios registrados.</p>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Área</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => {
                const esMio = user && (u.usuario === (user as any).username || u.nombre === (user as any).name);
                return (
                  <tr key={u.id}>
                    <td style={{ color: '#aaa' }}>{i + 1}</td>
                    <td style={{ fontWeight: '500' }}>
                      {u.nombre}
                      {esMio && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#aaa' }}>(sesión actual)</span>}
                    </td>
                    <td className="font-mono" style={{ fontSize: '12px' }}>{u.usuario}</td>
                    <td>
                      <span className={u.rol === 'Administrador' ? 'badge badge-admin' : 'badge badge-usuario'}>
                        {u.rol}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#555' }}>{u.area || '—'}</td>
                    <td>
                      <span className={u.activo ? 'badge badge-activo' : 'badge badge-inactivo'}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <button className="btn-accion" onClick={() => setEditando(u)}>Editar</button>
                      {!esMio && (
                        <>
                          {' '}
                          <button className="btn-accion" onClick={() => toggleActivo(u)}>
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          {' '}
                          <button className="btn-accion rojo" onClick={() => eliminar(u)}>Eliminar</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && <NuevoModal onClose={() => setShowNuevo(false)} onSaved={() => { setShowNuevo(false); cargar(); }} />}
      {editando  && <EditarModal usr={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); cargar(); }} />}
    </div>
  );
}
