/**
 * Liberación Shipping — Gestión de liberaciones de carga saliente
 * Fiel al monolito: campos correctos, estado auto-calculado, 5 fotos opcionales.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNotify } from '../context/NotifyContext';
import { useConfirm } from '../context/ConfirmContext';
import { API_BASE_URL } from '../config/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const DESTINOS = ['Tijuana', 'Manzanillo', 'Texas', 'Local', 'Bodega (FRM)', 'CEDIS', 'Guadalajara'];
const TIPOS_ENVIO = ['B2B', 'B2C', 'Reciclaje'];
const PAQUETERIAS = ['Mercado Libre', 'Paquete Express', 'Amazon', 'Estafeta', 'Fedex', 'DHL', 'Paqueteria 3 Guerras'];
const TIPOS_ORDEN = ['Orden Entry', 'FULL', 'FBA', 'UPT', 'HIGHVALUE', 'TRG Consignment', 'Venta a Colaboradores'];
const RESULTADOS  = ['Aceptado', 'Rechazado'];
const ESTATUS_CARGA = ['Pendiente en inspección', 'Cargada y no enviada', 'Cargada y enviada'];

const FOTO_KEYS: { key: FotoKey; label: string }[] = [
  { key: 'contenedor_vacio',   label: 'Contenedor Vacío' },
  { key: 'contenedor_cargado', label: 'Contenedor Cargado' },
  { key: 'caja_sellada',       label: 'Caja Sellada' },
  { key: 'placas',             label: 'Placas' },
  { key: 'manifiesto',         label: 'Manifiesto / Orden / CheckList' },
];

type FotoKey = 'contenedor_vacio' | 'contenedor_cargado' | 'caja_sellada' | 'placas' | 'manifiesto';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LsRecord {
  id: number;
  fecha: string;
  numero_orden: string;
  hora_inicio: string;
  hora_fin: string;
  destino: string;
  tipo_envio: string;
  paqueteria?: string;
  tipo_orden: string;
  numero_contenedor?: string;
  numero_sello?: string;
  cantidad_pallets: number;
  cantidad_manifiesto: number;
  cantidad_fisica: number;
  estado?: string;
  cantidad_diferencia?: number;
  resultado_inspeccion: string;
  estatus_carga: string;
  inspector: string;
  comentarios?: string;
  foto_contenedor_vacio?: string;
  foto_contenedor_cargado?: string;
  foto_caja_sellada?: string;
  foto_placas?: string;
  foto_manifiesto?: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcEstado(man: number, fis: number): string {
  if (man > fis) return 'FALTARON';
  if (man < fis) return 'SOBRARON';
  return 'CANTIDADES CORRECTAS';
}

const ESTADO_COLOR: Record<string, string> = {
  'CANTIDADES CORRECTAS': '#2e7d32',
  'FALTARON': '#c62828',
  'SOBRARON': '#e65100',
};

function badgeEstatusCarga(estatus: string) {
  switch (estatus) {
    case 'Cargada y enviada':    return 'badge badge-cerrada';
    case 'Cargada y no enviada': return 'badge badge-proceso';
    case 'Pendiente en inspección': return 'badge badge-pendiente';
    default: return 'badge';
  }
}

// ── FotoZone ─────────────────────────────────────────────────────────────────

interface FotoZoneProps {
  label: string;
  existingUrl?: string;
  file: File | null;
  onFileChange: (f: File | null) => void;
}

function FotoZone({ label, existingUrl, file, onFileChange }: FotoZoneProps) {
  const id = `fz-${Math.random().toString(36).slice(2)}`;
  const previewUrl = file ? URL.createObjectURL(file) : existingUrl ? `${API_BASE_URL}/uploads/shipping/${existingUrl}` : null;
  return (
    <div>
      <p style={{ fontSize: '11px', color: '#777', marginBottom: '4px' }}>{label}</p>
      <label htmlFor={id} style={{
        display: 'flex',
        width: '100%',
        height: '112px',
        border: `2px dashed ${previewUrl ? '#4caf50' : '#ccc'}`,
        cursor: 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {previewUrl
          ? <img src={previewUrl} alt={label} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: '11px', color: '#aaa' }}>Seleccionar foto</span>}
        <input id={id} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0] ?? null; onFileChange(f); e.target.value = ''; }} />
      </label>
      {previewUrl && <button type="button" className="btn-accion rojo" style={{ marginTop: '4px' }} onClick={() => onFileChange(null)}>Quitar</button>}
    </div>
  );
}

// ── Form Modal ────────────────────────────────────────────────────────────────

interface FormModalProps {
  record: LsRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

function FormModal({ record, onClose, onSaved }: FormModalProps) {
  const notify = useNotify();
  const [saving, setSaving] = useState(false);
  const [fecha,             setFecha]             = useState(record?.fecha ? String(record.fecha).slice(0,10) : new Date().toISOString().slice(0,10));
  const [numeroOrden,       setNumeroOrden]       = useState(record?.numero_orden ?? '');
  const [horaInicio,        setHoraInicio]        = useState(record?.hora_inicio ?? '');
  const [horaFin,           setHoraFin]           = useState(record?.hora_fin ?? '');
  const [destino,           setDestino]           = useState(record?.destino ?? '');
  const [tipoEnvio,         setTipoEnvio]         = useState(record?.tipo_envio ?? '');
  const [paqueteria,        setPaqueteria]        = useState(record?.paqueteria ?? '');
  const [tipoOrden,         setTipoOrden]         = useState(record?.tipo_orden ?? '');
  const [numContenedor,     setNumContenedor]     = useState(record?.numero_contenedor ?? '');
  const [numSello,          setNumSello]          = useState(record?.numero_sello ?? '');
  const [cantPallets,       setCantPallets]       = useState(String(record?.cantidad_pallets ?? 0));
  const [cantManifiesto,    setCantManifiesto]    = useState(String(record?.cantidad_manifiesto ?? 0));
  const [cantFisica,        setCantFisica]        = useState(String(record?.cantidad_fisica ?? 0));
  const [resultadoInsp,     setResultadoInsp]     = useState(record?.resultado_inspeccion ?? '');
  const [estatusCarga,      setEstatusCarga]      = useState(record?.estatus_carga ?? '');
  const [inspector,         setInspector]         = useState(record?.inspector ?? '');
  const [comentarios,       setComentarios]       = useState(record?.comentarios ?? '');

  const [fotos, setFotos] = useState<Record<FotoKey, File | null>>({
    contenedor_vacio: null, contenedor_cargado: null, caja_sellada: null, placas: null, manifiesto: null,
  });

  const man = parseInt(cantManifiesto) || 0;
  const fis = parseInt(cantFisica) || 0;
  const estado = man > 0 || fis > 0 ? calcEstado(man, fis) : '';
  const diferencia = Math.abs(man - fis);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroOrden.trim() || !horaInicio || !horaFin || !destino || !tipoEnvio || !tipoOrden || !resultadoInsp || !estatusCarga) {
      notify('Completa todos los campos requeridos.', 'error'); return;
    }
    if (tipoEnvio === 'B2C' && !paqueteria) { notify('Selecciona la paquetería para envíos B2C.', 'error'); return; }

    setSaving(true);
    try {
      const body = {
        fecha, numero_orden: numeroOrden.trim(), hora_inicio: horaInicio, hora_fin: horaFin,
        destino, tipo_envio: tipoEnvio, paqueteria: tipoEnvio === 'B2C' ? paqueteria : '',
        tipo_orden: tipoOrden, numero_contenedor: numContenedor, numero_sello: numSello,
        cantidad_pallets: parseInt(cantPallets) || 0,
        cantidad_manifiesto: man, cantidad_fisica: fis, estado, cantidad_diferencia: diferencia,
        resultado_inspeccion: resultadoInsp, estatus_carga: estatusCarga, inspector: inspector.trim(), comentarios: comentarios.trim(),
      };

      let id: number;
      if (record?.id) {
        await apiFetch(`${API_BASE_URL}/api/liberacion-shipping/${record.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        id = record.id;
      } else {
        const nuevo = await apiFetch<{ id: number }>(`${API_BASE_URL}/api/liberacion-shipping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        id = nuevo.id;
      }

      for (const { key } of FOTO_KEYS) {
        const file = fotos[key as FotoKey];
        if (file) {
          const fd = new FormData();
          fd.append('foto', file);
          await apiFetch(`${API_BASE_URL}/api/liberacion-shipping/${id}/${key}`, { method: 'POST', body: fd });
        }
      }

      notify(record ? 'Liberación actualizada.' : 'Liberación registrada.', 'success');
      onSaved();
    } catch (err: any) { notify(err.message ?? 'Error al guardar.', 'error'); }
    finally { setSaving(false); }
  };

  const setFotoKey = (key: FotoKey) => (f: File | null) => setFotos(prev => ({ ...prev, [key]: f }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white w-full max-w-2xl my-8" style={{ border: '1px solid #e2e2e2' }}>
        <div className="p-6">
          <div className="modal-titulo">{record ? 'Editar Liberación Shipping' : 'Nueva Liberación Shipping'}</div>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Encabezado */}
            <div className="form-grid">
              <div>
                <label>Fecha <span style={{ color: '#d00' }}>*</span></label>
                <input type="date" className="w-full" value={fecha} onChange={e => setFecha(e.target.value)} required />
              </div>
              <div>
                <label>No. de Orden <span style={{ color: '#d00' }}>*</span></label>
                <input type="text" className="w-full" value={numeroOrden} onChange={e => setNumeroOrden(e.target.value)} placeholder="Ej. ORD-12345" required />
              </div>
              <div>
                <label>Hora de Inicio <span style={{ color: '#d00' }}>*</span></label>
                <input type="time" className="w-full" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} required />
              </div>
              <div>
                <label>Hora de Fin <span style={{ color: '#d00' }}>*</span></label>
                <input type="time" className="w-full" value={horaFin} onChange={e => setHoraFin(e.target.value)} required />
              </div>
            </div>

            {/* Datos de Envío */}
            <div className="seccion-titulo">Datos de Envío</div>
            <div className="form-grid">
              <div>
                <label>Destino <span style={{ color: '#d00' }}>*</span></label>
                <select className="w-full" value={destino} onChange={e => setDestino(e.target.value)} required>
                  <option value="">— Seleccionar —</option>
                  {DESTINOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label>Tipo de Envío <span style={{ color: '#d00' }}>*</span></label>
                <select className="w-full" value={tipoEnvio} onChange={e => { setTipoEnvio(e.target.value); if (e.target.value !== 'B2C') setPaqueteria(''); }} required>
                  <option value="">— Seleccionar —</option>
                  {TIPOS_ENVIO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {tipoEnvio === 'B2C' && (
                <div className="full">
                  <label>Paquetería <span style={{ color: '#d00' }}>*</span></label>
                  <select className="w-full" value={paqueteria} onChange={e => setPaqueteria(e.target.value)} required>
                    <option value="">— Seleccionar —</option>
                    {PAQUETERIAS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label>Tipo de Orden <span style={{ color: '#d00' }}>*</span></label>
                <select className="w-full" value={tipoOrden} onChange={e => setTipoOrden(e.target.value)} required>
                  <option value="">— Seleccionar —</option>
                  {TIPOS_ORDEN.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>No. Contenedor</label>
                <input type="text" className="w-full" value={numContenedor} onChange={e => setNumContenedor(e.target.value)} placeholder="Ej. MSKU1234567" />
              </div>
              <div>
                <label>No. de Sello</label>
                <input type="text" className="w-full" value={numSello} onChange={e => setNumSello(e.target.value)} placeholder="Ej. S-000123" />
              </div>
              <div>
                <label>Cantidad de Pallets</label>
                <input type="number" min="0" className="w-full" value={cantPallets} onChange={e => setCantPallets(e.target.value)} />
              </div>
            </div>

            {/* Cantidades */}
            <div className="seccion-titulo">Cantidades</div>
            <div className="form-grid">
              <div>
                <label>Cant. en Manifiesto <span style={{ color: '#d00' }}>*</span></label>
                <input type="number" min="0" className="w-full" value={cantManifiesto} onChange={e => setCantManifiesto(e.target.value)} required />
              </div>
              <div>
                <label>Cant. Física <span style={{ color: '#d00' }}>*</span></label>
                <input type="number" min="0" className="w-full" value={cantFisica} onChange={e => setCantFisica(e.target.value)} required />
              </div>
              <div>
                <label>Estado (automático)</label>
                <input
                  className="w-full"
                  style={{ background: '#f8f8f8', fontWeight: 'bold', color: estado ? ESTADO_COLOR[estado] : '#333' }}
                  value={estado}
                  readOnly
                />
              </div>
              <div>
                <label>Piezas que no coinciden</label>
                <input className="w-full" style={{ background: '#f8f8f8' }} value={estado && man !== fis ? diferencia : ''} readOnly />
              </div>
            </div>

            {/* Resultado */}
            <div className="seccion-titulo">Resultado de Inspección</div>
            <div className="form-grid">
              <div>
                <label>Resultado <span style={{ color: '#d00' }}>*</span></label>
                <select className="w-full" value={resultadoInsp} onChange={e => setResultadoInsp(e.target.value)} required>
                  <option value="">— Seleccionar —</option>
                  {RESULTADOS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label>Estatus de Carga <span style={{ color: '#d00' }}>*</span></label>
                <select className="w-full" value={estatusCarga} onChange={e => setEstatusCarga(e.target.value)} required>
                  <option value="">— Seleccionar —</option>
                  {ESTATUS_CARGA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>Inspector</label>
                <input type="text" className="w-full" value={inspector} onChange={e => setInspector(e.target.value)} />
              </div>
              <div className="full">
                <label>Comentarios</label>
                <textarea className="w-full" rows={2} value={comentarios} onChange={e => setComentarios(e.target.value)} />
              </div>
            </div>

            {/* Fotos */}
            <div className="seccion-titulo">Evidencia Fotográfica</div>
            <div className="grid grid-cols-2 gap-3">
              {FOTO_KEYS.map(({ key, label }) => (
                <div key={key} className={key === 'manifiesto' ? 'col-span-2' : ''}>
                  <FotoZone
                    label={label}
                    existingUrl={(record as any)?.[`foto_${key}`] ?? undefined}
                    file={fotos[key as FotoKey]}
                    onFileChange={setFotoKey(key as FotoKey)}
                  />
                </div>
              ))}
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

// ── Detail Modal ──────────────────────────────────────────────────────────────

interface DetailModalProps { record: LsRecord; onClose: () => void; onEdit: () => void; onDeleted: () => void; }

function DetailModal({ record: r, onClose, onEdit, onDeleted }: DetailModalProps) {
  const notify  = useNotify();
  const confirm = useConfirm();

  const eliminar = async () => {
    const ok = await confirm({ title: 'Eliminar liberación', message: '¿Eliminar esta liberación? Se borrarán las fotos adjuntas.' });
    if (!ok) return;
    try { await apiFetch(`${API_BASE_URL}/api/liberacion-shipping/${r.id}`, { method: 'DELETE' }); notify('Liberación eliminada.', 'success'); onDeleted(); }
    catch (err: any) { notify(err.message ?? 'Error.', 'error'); }
  };

  const estadoColor = ESTADO_COLOR[r.estado ?? ''] ?? '#333';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ border: '1px solid #e2e2e2' }}>
        <div className="p-6 space-y-4">
          <div className="modal-titulo">Liberación: {r.numero_orden}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Fecha',             String(r.fecha).slice(0,10)],
              ['No. Orden',         r.numero_orden],
              ['Hora Inicio',       r.hora_inicio || '—'],
              ['Hora Fin',          r.hora_fin || '—'],
              ['Destino',           r.destino],
              ['Tipo de Envío',     r.tipo_envio],
              ...(r.paqueteria ? [['Paquetería', r.paqueteria]] : []),
              ['Tipo de Orden',     r.tipo_orden],
              ['No. Contenedor',    r.numero_contenedor || '—'],
              ['No. Sello',         r.numero_sello || '—'],
              ['Pallets',           String(r.cantidad_pallets)],
              ['Cant. Manifiesto',  String(r.cantidad_manifiesto)],
              ['Cant. Física',      String(r.cantidad_fisica)],
              ['Piezas no coinciden', String(r.cantidad_diferencia ?? 0)],
              ['Inspector',         r.inspector || '—'],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>{lbl}</span>
                {val}
              </div>
            ))}
            <div>
              <span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Estado</span>
              <span style={{ fontWeight: 'bold', color: estadoColor }}>{r.estado || '—'}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Resultado Inspección</span>
              <span className={r.resultado_inspeccion === 'Aceptado' ? 'badge badge-cerrada' : 'badge badge-rechazada'}>{r.resultado_inspeccion || '—'}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Estatus de Carga</span>
              <span className={badgeEstatusCarga(r.estatus_carga)}>{r.estatus_carga || '—'}</span>
            </div>
            {r.comentarios && <div className="col-span-2"><span style={{ fontSize: '11px', color: '#aaa', display: 'block' }}>Comentarios</span>{r.comentarios}</div>}
          </div>

          {/* Fotos */}
          <div className="grid grid-cols-2 gap-3">
            {FOTO_KEYS.map(({ key, label }) => {
              const filename = (r as any)[`foto_${key}`];
              if (!filename) return null;
              return (
                <div key={key}>
                  <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>{label}</p>
                  <a href={`${API_BASE_URL}/uploads/shipping/${filename}`} target="_blank" rel="noreferrer">
                    <img src={`${API_BASE_URL}/uploads/shipping/${filename}`} alt={label} style={{ width: '100%', height: '128px', objectFit: 'contain', border: '1px solid #e2e2e2' }} />
                  </a>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #e2e2e2' }}>
            <button className="btn btn-secundario" onClick={onEdit}>Editar</button>
            <div className="flex-1" />
            <button className="btn btn-peligro" onClick={eliminar}>Eliminar</button>
            <button className="btn btn-secundario" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function LiberacionShipping() {
  const notify  = useNotify();
  const [records,  setRecords]  = useState<LsRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<LsRecord | null>(null);
  const [detail,   setDetail]   = useState<LsRecord | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await apiFetch<LsRecord[]>(`${API_BASE_URL}/api/liberacion-shipping`);
      setRecords(data);
    } catch (err: any) { notify(err.message ?? 'Error.', 'error'); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { cargar(); }, [cargar]);

  const openNew  = () => { setEditing(null); setShowForm(true); };
  const openEdit = (r: LsRecord) => { setDetail(null); setEditing(r); setShowForm(true); };

  if (loading) return <p className="vacio">Cargando...</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Liberación Shipping</h1>
        <button className="btn btn-primario" onClick={openNew}>+ Nueva Liberación</button>
      </div>

      {records.length === 0 ? (
        <p className="vacio">Sin registros de liberaciones.</p>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>No. Orden</th>
                <th>Destino</th>
                <th>Tipo Envío</th>
                <th>Tipo Orden</th>
                <th>Estado</th>
                <th>Resultado</th>
                <th>Estatus Carga</th>
                <th>Inspector</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(r)}>
                  <td style={{ color: '#aaa' }}>{i + 1}</td>
                  <td>{String(r.fecha).slice(0,10)}</td>
                  <td style={{ fontWeight: '500' }}>{r.numero_orden}</td>
                  <td>{r.destino}</td>
                  <td>{r.tipo_envio}</td>
                  <td>{r.tipo_orden}</td>
                  <td style={{ fontWeight: 'bold', color: ESTADO_COLOR[r.estado ?? ''] ?? '#333' }}>{r.estado || '—'}</td>
                  <td>
                    <span className={r.resultado_inspeccion === 'Aceptado' ? 'badge badge-cerrada' : 'badge badge-rechazada'}>{r.resultado_inspeccion || '—'}</span>
                  </td>
                  <td>
                    <span className={badgeEstatusCarga(r.estatus_carga)}>{r.estatus_carga || '—'}</span>
                  </td>
                  <td>{r.inspector || '—'}</td>
                  <td className="whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button className="btn-accion" onClick={() => setDetail(r)}>Ver</button>
                    {' '}
                    <button className="btn-accion" onClick={() => openEdit(r)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <FormModal record={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); cargar(); }} />
      )}
      {detail && (
        <DetailModal record={detail} onClose={() => setDetail(null)} onEdit={() => openEdit(detail)} onDeleted={() => { setDetail(null); cargar(); }} />
      )}
    </div>
  );
}
