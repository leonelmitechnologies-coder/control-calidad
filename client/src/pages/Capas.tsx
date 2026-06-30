/**
 * Acciones Correctivas (CAPA) — fiel al monolito
 * Tabla + filtros + modal formulario (5 Porqués / Ishikawa) + modal detalle
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotify } from '../context/NotifyContext';
import { useConfirm } from '../context/ConfirmContext';
import { API_BASE_URL } from '../config/api';

// ── Constantes ────────────────────────────────────────────────────────────────

const PORQUES_LABEL = [
  '¿Por qué ocurrió?',
  '¿Por qué esa causa?',
  '¿Por qué esa razón?',
  '¿Por qué no se detectó?',
  'Causa raíz identificada',
];

const ISHIKAWA_CATS = [
  'Mano de obra', 'Máquina', 'Método',
  'Material', 'Medio ambiente', 'Medición',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Accion {
  id?: number;
  accion: string;
  responsable: string;
  fecha_compromiso: string;
  estatus: string;
}

interface IshikawaCausa {
  categoria: string;
  causa: string;
}

interface Porque {
  orden: number;
  respuesta: string;
}

interface Capa {
  id: number;
  origen_tipo: string;
  origen_id: number;
  origen_ref?: string;
  titulo: string;
  descripcion_problema: string;
  metodo_analisis: string;
  responsable: string;
  fecha_apertura: string;
  fecha_compromiso?: string;
  fecha_cierre?: string;
  estatus: string;
  verificado_por?: string;
  observaciones?: string;
  porques?: Porque[];
  ishikawa?: IshikawaCausa[];
  acciones?: Accion[];
}

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

// ── Badge helpers ─────────────────────────────────────────────────────────────

function badgeEstatus(estatus: string) {
  switch (estatus) {
    case 'Abierta':    return 'badge badge-abierta';
    case 'En proceso': return 'badge badge-proceso';
    case 'Cerrada':    return 'badge badge-cerrada';
    default:           return 'badge';
  }
}

function badgeOrigen(tipo: string) {
  switch (tipo) {
    case 'nc': return 'badge badge-alta';
    case 're': return 'badge badge-rechazada';
    default:   return 'badge';
  }
}

// ── Modal de Formulario ───────────────────────────────────────────────────────

interface FormModalProps {
  capa: Capa | null;
  onClose: () => void;
  onSaved: () => void;
}

function FormModal({ capa, onClose, onSaved }: FormModalProps) {
  const notify = useNotify();
  const [saving, setSaving] = useState(false);

  // Campos generales
  const [origenTipo, setOrigenTipo] = useState(capa?.origen_tipo ?? '');
  const [origenId,   setOrigenId]   = useState(capa?.origen_id   ? String(capa.origen_id) : '');
  const [titulo,     setTitulo]     = useState(capa?.titulo       ?? '');
  const [descripcion, setDescripcion] = useState(capa?.descripcion_problema ?? '');
  const [responsable, setResponsable] = useState(capa?.responsable ?? '');
  const [fechaApertura, setFechaApertura] = useState(
    capa?.fecha_apertura ? String(capa.fecha_apertura).slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [fechaCompromiso, setFechaCompromiso] = useState(
    capa?.fecha_compromiso ? String(capa.fecha_compromiso).slice(0, 10) : ''
  );

  // Método de análisis
  const [metodo, setMetodo] = useState<'5porques' | 'ishikawa'>(
    (capa?.metodo_analisis as '5porques' | 'ishikawa') ?? '5porques'
  );

  // 5 Porqués
  const [porques, setPorques] = useState<string[]>(() => {
    const arr = ['', '', '', '', ''];
    if (capa?.porques) {
      capa.porques.forEach(p => { if (p.orden >= 1 && p.orden <= 5) arr[p.orden - 1] = p.respuesta; });
    }
    return arr;
  });

  // Ishikawa
  const [ishikawa, setIshikawa] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    ISHIKAWA_CATS.forEach(cat => { init[cat] = ['']; });
    if (capa?.ishikawa) {
      const map: Record<string, string[]> = {};
      capa.ishikawa.forEach(r => {
        if (!map[r.categoria]) map[r.categoria] = [];
        map[r.categoria].push(r.causa);
      });
      ISHIKAWA_CATS.forEach(cat => { if (map[cat]?.length) init[cat] = [...map[cat], '']; });
    }
    return init;
  });

  // Acciones
  const [acciones, setAcciones] = useState<Accion[]>(() =>
    capa?.acciones?.length
      ? capa.acciones.map(a => ({ ...a, fecha_compromiso: a.fecha_compromiso ? String(a.fecha_compromiso).slice(0, 10) : '' }))
      : [{ accion: '', responsable: '', fecha_compromiso: '', estatus: 'Pendiente' }]
  );

  // Origenes
  const [origenes, setOrigenes] = useState<{ nc: { id: number; label: string }[]; re: { id: number; label: string }[] }>({ nc: [], re: [] });

  useEffect(() => {
    Promise.all([
      apiFetch<any[]>(`${API_BASE_URL}/api/nc?fecha=todos`).catch(() => []),
      apiFetch<any[]>(`${API_BASE_URL}/api/rechazos-externos`).catch(() => []),
    ]).then(([ncs, res]) => {
      setOrigenes({
        nc: (Array.isArray(ncs) ? ncs : []).map(r => ({ id: r.id, label: `NC #${r.id} — ${r.area} / ${r.tipo} (${String(r.fecha ?? '').slice(0, 10)})` })),
        re: (Array.isArray(res) ? res : []).map(r => ({ id: r.id, label: `RE #${r.id} — ${r.license_plate} (${r.brand ?? ''})` })),
      });
    });
  }, []);

  const addIshikawaCausa = (cat: string) => {
    setIshikawa(prev => ({ ...prev, [cat]: [...prev[cat], ''] }));
  };

  const setIshikawaCausa = (cat: string, idx: number, val: string) => {
    setIshikawa(prev => {
      const arr = [...prev[cat]];
      arr[idx] = val;
      return { ...prev, [cat]: arr };
    });
  };

  const removeIshikawaCausa = (cat: string, idx: number) => {
    setIshikawa(prev => {
      const arr = prev[cat].filter((_, i) => i !== idx);
      return { ...prev, [cat]: arr.length ? arr : [''] };
    });
  };

  const addAccion = () => {
    setAcciones(prev => [...prev, { accion: '', responsable: '', fecha_compromiso: '', estatus: 'Pendiente' }]);
  };

  const removeAccion = (idx: number) => {
    setAcciones(prev => prev.filter((_, i) => i !== idx));
  };

  const updateAccion = (idx: number, field: keyof Accion, val: string) => {
    setAcciones(prev => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const pqs = porques.map((r, i) => ({ orden: i + 1, respuesta: r.trim() }));
      const ishi = metodo === 'ishikawa'
        ? ISHIKAWA_CATS.flatMap(cat => ishikawa[cat].filter(c => c.trim()).map(c => ({ categoria: cat, causa: c.trim() })))
        : [];
      const accs = acciones.filter(a => a.accion.trim());

      const body = {
        origen_tipo: origenTipo,
        origen_id: parseInt(origenId),
        titulo: titulo.trim(),
        descripcion_problema: descripcion.trim(),
        metodo_analisis: metodo,
        responsable: responsable.trim(),
        fecha_apertura: fechaApertura,
        fecha_compromiso: fechaCompromiso || null,
        porques: metodo === '5porques' ? pqs : [],
        ishikawa: ishi,
        acciones: accs,
      };

      if (capa?.id) {
        await apiFetch(`${API_BASE_URL}/api/capas/${capa.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        notify('CAPA actualizada correctamente.', 'success');
      } else {
        await apiFetch(`${API_BASE_URL}/api/capas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        notify('CAPA creada correctamente.', 'success');
      }
      onSaved();
    } catch (err: any) {
      notify(err.message ?? 'Error al guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const origenesDisponibles = origenTipo ? (origenes[origenTipo as 'nc' | 're'] ?? []) : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ border: '1px solid #e2e2e2' }}>
        <div className="p-6">
          <div className="modal-titulo">{capa ? `Editar CAPA #${capa.id}` : 'Nueva Acción Correctiva (CAPA)'}</div>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Datos Generales */}
            <div>
              <div className="seccion-titulo">Datos Generales</div>
              <div className="form-grid">
                <div>
                  <label>Tipo de origen</label>
                  <select value={origenTipo} onChange={e => { setOrigenTipo(e.target.value); setOrigenId(''); }} required>
                    <option value="">— Seleccionar —</option>
                    <option value="nc">No Conformidad</option>
                    <option value="re">Rechazo Externo</option>
                  </select>
                </div>
                <div>
                  <label>Registro origen</label>
                  <select value={origenId} onChange={e => setOrigenId(e.target.value)} required>
                    <option value="">{origenTipo ? '— Seleccionar —' : '— Primero selecciona tipo —'}</option>
                    {origenesDisponibles.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div className="full">
                  <label>Título de la CAPA</label>
                  <input className="w-full" value={titulo} onChange={e => setTitulo(e.target.value)} required />
                </div>
                <div className="full">
                  <label>Descripción del problema</label>
                  <textarea className="w-full" rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} />
                </div>
                <div>
                  <label>Responsable</label>
                  <input className="w-full" value={responsable} onChange={e => setResponsable(e.target.value)} required />
                </div>
                <div>
                  <label>Fecha de apertura</label>
                  <input type="date" className="w-full" value={fechaApertura} onChange={e => setFechaApertura(e.target.value)} required />
                </div>
                <div>
                  <label>Fecha compromiso</label>
                  <input type="date" className="w-full" value={fechaCompromiso} onChange={e => setFechaCompromiso(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Método de Análisis */}
            <div>
              <div className="seccion-titulo">Método de Análisis de Causa Raíz</div>
              <div className="flex gap-6 mb-3" style={{ marginTop: '10px' }}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="metodo" value="5porques" checked={metodo === '5porques'} onChange={() => setMetodo('5porques')} />
                  5 Porqués
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="metodo" value="ishikawa" checked={metodo === 'ishikawa'} onChange={() => setMetodo('ishikawa')} />
                  Ishikawa (6M)
                </label>
              </div>

              {/* Panel 5 Porqués */}
              {metodo === '5porques' && (
                <div className="tabla-wrap">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th style={{ width: '30px' }}>#</th>
                        <th style={{ width: '176px' }}>Pregunta guía</th>
                        <th>Respuesta / Causa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3, 4].map(i => (
                        <tr key={i}>
                          <td style={{ color: '#aaa', fontSize: '11px' }}>{i + 1}</td>
                          <td style={{ fontSize: '12px', color: '#555' }}>{PORQUES_LABEL[i]}</td>
                          <td>
                            <textarea
                              className="w-full"
                              style={{ resize: 'vertical', minHeight: '40px', padding: '4px 8px', fontSize: '13px' }}
                              rows={2}
                              value={porques[i]}
                              onChange={e => {
                                const next = [...porques];
                                next[i] = e.target.value;
                                setPorques(next);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Panel Ishikawa */}
              {metodo === 'ishikawa' && (
                <div className="grid grid-cols-2 gap-3">
                  {ISHIKAWA_CATS.map(cat => (
                    <div key={cat} className="card" style={{ padding: '12px' }}>
                      <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#444', marginBottom: '8px' }}>{cat}</p>
                      {ishikawa[cat].map((causa, idx) => (
                        <div key={idx} className="flex gap-1 mb-1">
                          <input
                            className="flex-1"
                            style={{ fontSize: '12px' }}
                            placeholder="Agregar causa..."
                            value={causa}
                            onChange={e => setIshikawaCausa(cat, idx, e.target.value)}
                          />
                          <button type="button" className="btn-accion rojo" onClick={() => removeIshikawaCausa(cat, idx)}>✕</button>
                        </div>
                      ))}
                      <button type="button" className="btn-accion" style={{ marginTop: '4px' }} onClick={() => addIshikawaCausa(cat)}>+ causa</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Acciones Correctivas */}
            <div>
              <div className="seccion-titulo">Acciones Correctivas</div>
              <div className="grid grid-cols-[1fr_140px_120px_110px_28px] gap-1 mb-1 px-1" style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '11px', color: '#777', fontWeight: '600', textTransform: 'uppercase' }}>Acción</span>
                <span style={{ fontSize: '11px', color: '#777', fontWeight: '600', textTransform: 'uppercase' }}>Responsable</span>
                <span style={{ fontSize: '11px', color: '#777', fontWeight: '600', textTransform: 'uppercase' }}>F. Compromiso</span>
                <span style={{ fontSize: '11px', color: '#777', fontWeight: '600', textTransform: 'uppercase' }}>Estatus</span>
                <span />
              </div>
              {acciones.map((acc, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_140px_120px_110px_28px] gap-1 mb-1">
                  <textarea
                    className="w-full"
                    style={{ resize: 'none', fontSize: '13px', padding: '4px 8px' }}
                    rows={2}
                    placeholder="Descripción de la acción..."
                    value={acc.accion}
                    onChange={e => updateAccion(idx, 'accion', e.target.value)}
                  />
                  <input
                    className="w-full"
                    style={{ fontSize: '13px' }}
                    placeholder="Responsable"
                    value={acc.responsable}
                    onChange={e => updateAccion(idx, 'responsable', e.target.value)}
                  />
                  <input
                    type="date"
                    className="w-full"
                    style={{ fontSize: '13px' }}
                    value={acc.fecha_compromiso}
                    onChange={e => updateAccion(idx, 'fecha_compromiso', e.target.value)}
                  />
                  <select
                    style={{ fontSize: '13px' }}
                    value={acc.estatus}
                    onChange={e => updateAccion(idx, 'estatus', e.target.value)}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En proceso">En proceso</option>
                    <option value="Completada">Completada</option>
                  </select>
                  <button type="button" className="btn-accion rojo" onClick={() => removeAccion(idx)}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-secundario" style={{ marginTop: '8px' }} onClick={addAccion}>
                + Agregar acción
              </button>
            </div>

            <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '1px solid #e2e2e2' }}>
              <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
              <button type="submit" disabled={saving} className="btn btn-primario" style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Modal de Detalle ──────────────────────────────────────────────────────────

interface DetalleModalProps {
  capaId: number;
  onClose: () => void;
  onEdit: (c: Capa) => void;
  onRefresh: () => void;
}

function DetalleModal({ capaId, onClose, onEdit, onRefresh }: DetalleModalProps) {
  const notify  = useNotify();
  const confirm = useConfirm();
  const [verificadoPor, setVerificadoPor] = useState('');
  const [pidVerificado, setPidVerificado] = useState(false);

  const { data: c, refetch } = useQuery<Capa>({
    queryKey: ['capa-detail', capaId],
    queryFn: () => apiFetch(`${API_BASE_URL}/api/capas/${capaId}`),
  });

  const cambiarEstatus = async (estatus: string) => {
    if (estatus === 'Cerrada') {
      setPidVerificado(true);
      return;
    }
    try {
      await apiFetch(`${API_BASE_URL}/api/capas/${capaId}/estatus`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estatus }),
      });
      await refetch();
      onRefresh();
    } catch (err: any) { notify(err.message ?? 'Error.', 'error'); }
  };

  const confirmarCierre = async () => {
    try {
      await apiFetch(`${API_BASE_URL}/api/capas/${capaId}/estatus`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estatus: 'Cerrada', verificado_por: verificadoPor }),
      });
      setPidVerificado(false);
      await refetch();
      onRefresh();
    } catch (err: any) { notify(err.message ?? 'Error.', 'error'); }
  };

  const cambiarEstatusAccion = async (accionId: number, estatus: string) => {
    try {
      await apiFetch(`${API_BASE_URL}/api/capas/${capaId}/acciones/${accionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estatus }),
      });
      await refetch();
    } catch (err: any) { notify(err.message ?? 'Error.', 'error'); }
  };

  const eliminar = async () => {
    const ok = await confirm({ title: 'Eliminar CAPA', message: 'Se eliminará la CAPA y todo su análisis de forma permanente.' });
    if (!ok) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/capas/${capaId}`, { method: 'DELETE' });
      notify('CAPA eliminada.', 'success');
      onClose();
      onRefresh();
    } catch (err: any) { notify(err.message ?? 'Error.', 'error'); }
  };

  if (!c) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white p-8" style={{ color: '#777' }}>Cargando...</div>
    </div>
  );

  const metodoLabel: Record<string, string> = { '5porques': '5 Porqués', 'ishikawa': 'Ishikawa (6M)' };

  const analisisHtml = () => {
    if (c.metodo_analisis === '5porques') {
      const filas = (c.porques ?? []).filter(p => p.respuesta);
      if (!filas.length) return <p className="vacio" style={{ textAlign: 'left', padding: '4px 0' }}>Sin respuestas registradas.</p>;
      return (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th style={{ width: '30px' }}>#</th>
                <th style={{ width: '176px' }}>Pregunta</th>
                <th>Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(p => (
                <tr key={p.orden}>
                  <td style={{ color: '#aaa', fontSize: '11px' }}>{p.orden}</td>
                  <td style={{ fontSize: '12px', color: '#555' }}>{PORQUES_LABEL[p.orden - 1]}</td>
                  <td style={{ fontSize: '13px' }}>{p.respuesta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    const catMap: Record<string, string[]> = {};
    (c.ishikawa ?? []).forEach(r => { if (!catMap[r.categoria]) catMap[r.categoria] = []; catMap[r.categoria].push(r.causa); });
    return (
      <div className="grid grid-cols-2 gap-3">
        {ISHIKAWA_CATS.map(cat => (
          <div key={cat} className="card" style={{ padding: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#444', marginBottom: '8px' }}>{cat}</p>
            {(catMap[cat] ?? []).length
              ? catMap[cat].map((ca, i) => <div key={i} style={{ fontSize: '13px', padding: '2px 0', borderBottom: '1px solid #f0f0f0' }}>{ca}</div>)
              : <div style={{ fontSize: '11px', color: '#aaa' }}>Sin causas registradas.</div>
            }
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ border: '1px solid #e2e2e2' }}>
        <div className="p-6 space-y-4">
          <div className="modal-titulo">{c.titulo}</div>

          {/* Info general */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Origen</span>
              <span className={badgeOrigen(c.origen_tipo)}>{c.origen_tipo === 'nc' ? 'NC' : 'RE'}</span>
              {' '}<span style={{ color: '#666', fontSize: '12px' }}>{c.origen_ref}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Estatus</span>
              <span className={badgeEstatus(c.estatus)}>{c.estatus}</span>
            </div>
            <div><span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Responsable</span>{c.responsable}</div>
            <div><span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Método de análisis</span>{metodoLabel[c.metodo_analisis] ?? c.metodo_analisis}</div>
            <div><span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Fecha apertura</span>{String(c.fecha_apertura).slice(0, 10)}</div>
            <div><span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Fecha compromiso</span>{c.fecha_compromiso ? String(c.fecha_compromiso).slice(0, 10) : '—'}</div>
            {c.fecha_cierre && <div><span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Fecha cierre</span>{String(c.fecha_cierre).slice(0, 10)}</div>}
            {c.verificado_por && <div><span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Verificado por</span>{c.verificado_por}</div>}
            {c.descripcion_problema && (
              <div className="col-span-2"><span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Descripción del problema</span>{c.descripcion_problema}</div>
            )}
          </div>

          {/* Análisis */}
          <div>
            <div className="seccion-titulo">Análisis de Causa Raíz — {metodoLabel[c.metodo_analisis]}</div>
            <div style={{ marginTop: '8px' }}>{analisisHtml()}</div>
          </div>

          {/* Acciones */}
          <div>
            <div className="seccion-titulo">Acciones Correctivas</div>
            {(c.acciones ?? []).length === 0
              ? <p className="vacio" style={{ textAlign: 'left', padding: '4px 0' }}>Sin acciones registradas.</p>
              : (
                <div className="tabla-wrap" style={{ marginTop: '8px' }}>
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Acción</th>
                        <th>Responsable</th>
                        <th>F. Compromiso</th>
                        <th>Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(c.acciones ?? []).map(a => (
                        <tr key={a.id}>
                          <td>{a.accion}</td>
                          <td>{a.responsable}</td>
                          <td>{a.fecha_compromiso ? String(a.fecha_compromiso).slice(0, 10) : '—'}</td>
                          <td>
                            <select
                              style={{ fontSize: '12px', padding: '2px 4px' }}
                              value={a.estatus}
                              onChange={e => cambiarEstatusAccion(a.id!, e.target.value)}
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="En proceso">En proceso</option>
                              <option value="Completada">Completada</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>

          {/* Solicitar verificado_por al cerrar */}
          {pidVerificado && (
            <div style={{ border: '1px solid #e2e2e2', background: '#fffdf0', padding: '12px' }} className="space-y-2">
              <p style={{ fontSize: '13px', fontWeight: '500' }}>Verificado por (quien cierra la CAPA):</p>
              <input
                className="w-full"
                value={verificadoPor}
                onChange={e => setVerificadoPor(e.target.value)}
                placeholder="Nombre completo"
                autoFocus
              />
              <div className="btn-grupo">
                <button className="btn btn-primario" onClick={confirmarCierre}>Confirmar cierre</button>
                <button className="btn btn-secundario" onClick={() => setPidVerificado(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid #e2e2e2' }}>
            {c.estatus === 'Abierta'  && <button className="btn btn-secundario" onClick={() => cambiarEstatus('En proceso')}>En proceso</button>}
            {c.estatus !== 'Cerrada'  && <button className="btn btn-primario" onClick={() => cambiarEstatus('Cerrada')}>Cerrar CAPA</button>}
            {c.estatus === 'Cerrada'  && <button className="btn btn-secundario" onClick={() => cambiarEstatus('Abierta')}>Reabrir</button>}
            <div className="flex-1" />
            <button className="btn btn-secundario" onClick={() => { onClose(); onEdit(c); }}>Editar</button>
            <button className="btn btn-peligro" onClick={eliminar}>Eliminar</button>
            <button className="btn btn-secundario" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Capas() {
  const notify  = useNotify();
  const qc      = useQueryClient();

  const [filtroTipo,    setFiltroTipo]    = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [detailId,      setDetailId]      = useState<number | null>(null);
  const [editingCapa,   setEditingCapa]   = useState<Capa | null>(null);
  const [showForm,      setShowForm]      = useState(false);

  const { data: capas = [], isLoading } = useQuery<Capa[]>({
    queryKey: ['capas'],
    queryFn:  () => apiFetch(`${API_BASE_URL}/api/capas`),
  });

  const refresh = useCallback(() => { qc.invalidateQueries({ queryKey: ['capas'] }); }, [qc]);

  const openNew = () => { setEditingCapa(null); setShowForm(true); };

  const openEdit = (c: Capa) => { setEditingCapa(c); setShowForm(true); };

  const filtered = capas.filter(r =>
    (!filtroTipo    || r.origen_tipo === filtroTipo) &&
    (!filtroEstatus || r.estatus     === filtroEstatus)
  );

  const metodoLabel: Record<string, string> = { '5porques': '5 Porqués', 'ishikawa': 'Ishikawa' };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold">Acciones Correctivas (CAPA)</h1>
        <div className="filtros">
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">NC y Rechazos</option>
            <option value="nc">Solo NCs</option>
            <option value="re">Solo Rechazos</option>
          </select>
          <select value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}>
            <option value="">Todos los estatus</option>
            <option value="Abierta">Abierta</option>
            <option value="En proceso">En proceso</option>
            <option value="Cerrada">Cerrada</option>
          </select>
          <button className="btn btn-primario" onClick={openNew}>+ Nueva CAPA</button>
        </div>
      </div>

      {isLoading ? (
        <p className="vacio">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="vacio">Sin acciones correctivas registradas.</p>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Origen</th>
                <th>Título</th>
                <th>Método</th>
                <th>Responsable</th>
                <th>F. Compromiso</th>
                <th>Estatus</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(r.id)}>
                  <td style={{ color: '#aaa' }}>{r.id}</td>
                  <td>
                    <span className={badgeOrigen(r.origen_tipo)}>
                      {r.origen_tipo === 'nc' ? 'NC' : 'RE'}
                    </span>
                    <span style={{ color: '#aaa', fontSize: '11px', marginLeft: '4px' }}>{r.origen_ref}</span>
                  </td>
                  <td>{r.titulo}</td>
                  <td>{metodoLabel[r.metodo_analisis] ?? r.metodo_analisis}</td>
                  <td>{r.responsable}</td>
                  <td>{r.fecha_compromiso ? String(r.fecha_compromiso).slice(0, 10) : '—'}</td>
                  <td>
                    <span className={badgeEstatus(r.estatus)}>{r.estatus}</span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn-accion" onClick={() => setDetailId(r.id)}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalle */}
      {detailId !== null && (
        <DetalleModal
          capaId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={c => { setDetailId(null); openEdit(c); }}
          onRefresh={refresh}
        />
      )}

      {/* Modal formulario */}
      {showForm && (
        <FormModal
          capa={editingCapa}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refresh(); }}
        />
      )}
    </div>
  );
}
