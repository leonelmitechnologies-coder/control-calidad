/**
 * Dashboard B2C — Salidas de Material
 *
 * Preview con datos simulados. Cuando IT entregue la API de Bin Manager,
 * solo se cambia MOCK_ORDERS por una llamada real a useQuery.
 *
 * Campos cubiertos: Número de Orden, Orden ID, Fecha de Ingreso, Fecha de Salida,
 * Cliente, Vendedor, Destino, SKUs, LPN, Clasificación, Cantidad,
 * Canal de Venta, Estatus, Descripción del Producto.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { MultiSelectDropdown } from '../components/common/MultiSelectDropdown';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';
import type { B2COrder, B2COrderItem } from '../types';

// ── Inspección types ──────────────────────────────────────────────────────────

type InspeccionEstatus = 'ok' | 'con_problemas' | 'no_salio';

interface Inspeccion {
  estatus:    InspeccionEstatus;
  comentario: string;
  fotos:      string[];   // base64
  inspector:  string;
  timestamp:  string;
}

type InspeccionesMap = Record<number, Inspeccion[]>;

const LS_KEY = 'b2c_inspecciones_v1';

const INSP_CONFIG: Record<InspeccionEstatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  ok:             { label: 'Salió OK',              color: '#27ae60', bg: '#e8f5ee', border: '#27ae60', icon: '✓' },
  con_problemas:  { label: 'Salió con problemas',   color: '#c0711a', bg: '#fdf2e8', border: '#c0711a', icon: '⚠' },
  no_salio:       { label: 'No salió',              color: '#c0392b', bg: '#fde8e8', border: '#c0392b', icon: '✗' },
};

// ── localStorage hook ─────────────────────────────────────────────────────────

function useInspecciones() {
  const [data, setData] = useState<InspeccionesMap>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
  });

  const save = useCallback((ordenId: number, entry: Inspeccion) => {
    setData((prev) => {
      const next = { ...prev, [ordenId]: [...(prev[ordenId] ?? []), entry] };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getLatest = useCallback((ordenId: number): Inspeccion | undefined => {
    const list = data[ordenId];
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }, [data]);

  const getAll = useCallback((ordenId: number): Inspeccion[] => {
    return data[ordenId] ?? [];
  }, [data]);

  return { save, getLatest, getAll };
}

// ── Inspección Badge ──────────────────────────────────────────────────────────

function InspeccionBadge({ inspeccion, onClick }: { inspeccion?: Inspeccion; onClick: () => void }) {
  if (!inspeccion) {
    return (
      <button type="button" onClick={onClick} style={{
        background: '#f4f6f9', color: '#888', border: '1px dashed #ccc',
        borderRadius: 3, padding: '3px 10px', fontSize: 11, fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        🔍 Sin revisar
      </button>
    );
  }
  const cfg = INSP_CONFIG[inspeccion.estatus];
  return (
    <button type="button" onClick={onClick} style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: 3, padding: '3px 10px', fontSize: 11, fontWeight: 700,
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {cfg.label}
    </button>
  );
}

// ── Inspección Modal ──────────────────────────────────────────────────────────

function InspeccionModal({
  order,
  historial,
  onSave,
  onClose,
}: {
  order:    B2COrder;
  historial: Inspeccion[];
  onSave:   (entry: Inspeccion) => void;
  onClose:  () => void;
}) {
  const [estatus,    setEstatus]    = useState<InspeccionEstatus | ''>('');
  const [comentario, setComentario] = useState('');
  const [fotos,      setFotos]      = useState<string[]>([]);
  const [inspector,  setInspector]  = useState('');
  const [error,      setError]      = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFotos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const b64 = e.target?.result as string;
        setFotos((prev) => [...prev, b64]);
      };
      reader.readAsDataURL(f);
    });
  };

  const handleSave = () => {
    if (!estatus)    { setError('Selecciona un estatus.'); return; }
    if (!inspector.trim()) { setError('Escribe tu nombre como inspector.'); return; }
    if (estatus !== 'ok' && !comentario.trim()) {
      setError('El comentario es obligatorio cuando hay problema o no salió.'); return;
    }
    onSave({
      estatus,
      comentario: comentario.trim(),
      fotos,
      inspector: inspector.trim(),
      timestamp: new Date().toISOString(),
    });
  };

  const ultima = historial.length > 0 ? historial[historial.length - 1] : undefined;

  return createPortal(
    <div
      role="dialog" aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '24px 16px', background: 'rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: 600, background: '#fff', border: '1px solid #e2e2e2', margin: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '2px solid #0d2b4e' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0d2b4e' }}>Inspección — Orden #{order.OrderID}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>{order.AccountName} · {order.CustomerShippingName}</p>
          </div>
          {ultima && (
            <span style={{
              background: INSP_CONFIG[ultima.estatus].bg, color: INSP_CONFIG[ultima.estatus].color,
              border: `1px solid ${INSP_CONFIG[ultima.estatus].border}`,
              borderRadius: 3, padding: '3px 10px', fontSize: 11, fontWeight: 700, marginRight: 12,
            }}>
              {INSP_CONFIG[ultima.estatus].icon} {INSP_CONFIG[ultima.estatus].label}
            </span>
          )}
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#777', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Nuevo registro */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', borderBottom: '2px solid #0d2b4e', paddingBottom: 6, marginBottom: 14 }}>
              Registrar Inspección
            </div>

            {/* Estatus buttons */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Estatus *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.entries(INSP_CONFIG) as [InspeccionEstatus, typeof INSP_CONFIG[InspeccionEstatus]][]).map(([k, cfg]) => (
                  <button
                    key={k} type="button"
                    onClick={() => { setEstatus(k); setError(''); }}
                    style={{
                      padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 3,
                      border: `2px solid ${estatus === k ? cfg.color : '#e2e2e2'}`,
                      background: estatus === k ? cfg.bg : '#fafafa',
                      color: estatus === k ? cfg.color : '#555',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cfg.icon} {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inspector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Nombre del Inspector *</label>
              <input
                type="text" value={inspector} onChange={(e) => setInspector(e.target.value)}
                placeholder="Ej: Juan Pérez"
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid #d0d0d0', borderRadius: 2, boxSizing: 'border-box' }}
              />
            </div>

            {/* Comentario */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                Comentario {estatus !== 'ok' ? '*' : '(opcional)'}
              </label>
              <textarea
                value={comentario} onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder={estatus === 'con_problemas' ? 'Describe el problema observado y qué acción se tomó...' : estatus === 'no_salio' ? 'Describe por qué no salió la orden...' : 'Observaciones generales...'}
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid #d0d0d0', borderRadius: 2, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Fotos */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Evidencia Fotográfica</label>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleFotos(e.target.files)} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="btn btn-secundario" style={{ fontSize: 12, marginBottom: fotos.length ? 10 : 0 }}>
                + Agregar fotos
              </button>
              {fotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {fotos.map((b64, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={b64} alt="" style={{ width: 70, height: 70, objectFit: 'cover', border: '1px solid #e2e2e2', borderRadius: 2 }} />
                      <button type="button"
                        onClick={() => setFotos((f) => f.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: -6, right: -6, background: '#c0392b', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p style={{ fontSize: 12, color: '#c0392b', margin: '0 0 10px', fontWeight: 600 }}>{error}</p>}
          </div>

          {/* Historial */}
          {historial.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', borderBottom: '2px solid #0d2b4e', paddingBottom: 6, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                Historial
                <span style={{ background: '#0d2b4e', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>{historial.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...historial].reverse().map((h, i) => {
                  const cfg = INSP_CONFIG[h.estatus];
                  return (
                    <div key={i} style={{ border: `1px solid ${cfg.border}`, borderLeft: `4px solid ${cfg.color}`, padding: '10px 14px', borderRadius: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                        <span style={{ fontSize: 11, color: '#888' }}>{new Date(h.timestamp).toLocaleString('es-MX')} · {h.inspector}</span>
                      </div>
                      {h.comentario && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#444' }}>{h.comentario}</p>}
                      {h.fotos.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          {h.fotos.map((b64, j) => (
                            <img key={j} src={b64} alt="" style={{ width: 52, height: 52, objectFit: 'cover', border: '1px solid #e2e2e2', borderRadius: 2 }} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#aaa' }}>Los datos se guardan localmente en este navegador.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-secundario">Cancelar</button>
            <button type="button" onClick={handleSave} className="btn btn-primario">Guardar Inspección</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchB2COrders(startDate: string, endDate: string): Promise<B2COrder[]> {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`/api/b2c-orders?${params}`);
  if (!res.ok) throw new Error('Error al cargar órdenes B2C');
  return res.json();
}

// ── Chart palette helpers ─────────────────────────────────────────────────────

const CHART_COLORS = ['#0d2b4e','#2980b9','#27ae60','#c0711a','#8e44ad','#c0392b','#16a085','#d68910'];

const PAGE_SIZE = 10;

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; color: string; border: string; label: string }> = {
  'Received OE':    { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', label: 'Recibido'        },
  'Pending':        { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: 'Pendiente'       },
  'paid':           { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc', label: 'Pagado'          },
  'Unshipped':      { bg: '#fef3c7', color: '#b45309', border: '#fcd34d', label: 'Sin Enviar'      },
  'ready_to_print': { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', label: 'Listo p/ Envío' },
  'Shipped':        { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', label: 'Enviado'         },
  'shipped':        { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', label: 'Enviado'         },
  'Delivered':      { bg: '#e8f0f9', color: '#0d2b4e', border: '#93c5fd', label: 'Entregado'       },
  'delivered':      { bg: '#e8f0f9', color: '#0d2b4e', border: '#93c5fd', label: 'Entregado'       },
  'cancelled':      { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Cancelado'       },
};

function detectMarketplace(accountName: string): 'ml' | 'amazon' | 'walmart' | '' {
  const lower = (accountName ?? '').toLowerCase();
  if (lower.includes('ml') || lower.includes('mercado') || lower.includes('libre') || lower.includes('berojov') || lower.includes('blow') || lower.includes('lutema') || lower.includes('apantallate') || lower.includes('autobot mx') || lower.includes('remotes')) return 'ml';
  if (lower.includes('amazon') || lower.includes('fba')) return 'amazon';
  if (lower.includes('walmart')) return 'walmart';
  return '';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelative(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1)  return 'Justo ahora';
  if (mins < 60) return `Hace ${mins} min`;
  if (hrs  < 24) return `Hace ${hrs} hora${hrs !== 1 ? 's' : ''}`;
  return `Hace ${days} día${days !== 1 ? 's' : ''}`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: '#f4f4f4', color: '#555', border: '#ccc', label: status };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: 3, padding: '2px 9px', fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e2e2', padding: '18px 22px',
      borderTop: `3px solid ${color ?? '#0d2b4e'}`, flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? '#0d2b4e', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginBottom: 3 }}>
        {label}
      </dt>
      <dd style={{ fontSize: 13, color: '#111', margin: 0 }}>
        {value || <span style={{ color: '#bbb', fontStyle: 'italic' }}>—</span>}
      </dd>
    </div>
  );
}

function DetailModal({ order, onClose }: { order: B2COrder; onClose: () => void }) {
  const [lpnSearch, setLpnSearch] = useState('');
  const visibleItems = lpnSearch.trim()
    ? order.Items.filter((it) => {
        const q = lpnSearch.toLowerCase();
        return it.LPN.toLowerCase().includes(q)
          || it.WebSKU.toLowerCase().includes(q)
          || (it.MitSKU ?? '').toLowerCase().includes(q);
      })
    : order.Items;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 800,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '24px 16px',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <div style={{
        position: 'relative', width: '100%', maxWidth: 820,
        background: '#fff', border: '1px solid #e2e2e2', margin: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '2px solid #0d2b4e',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0d2b4e' }}>
              Orden #{order.OrderID}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>
              Entry ID: {order.OrderEntryID} · {order.LocationName}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={order.Status} />
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 18, color: '#777', cursor: 'pointer', padding: '2px 6px' }}
            >
              &#10005;
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* General info */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', borderBottom: '2px solid #0d2b4e', paddingBottom: 6, marginBottom: 16 }}>
            Información General
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 24px', marginBottom: 24 }}>
            <DetailField label="Número de Orden"  value={order.OrderID} />
            <DetailField label="Orden ID"         value={String(order.OrderEntryID)} />
            <DetailField label="Estatus"          value={<StatusBadge status={order.Status} />} />
            <DetailField label="Fecha de Ingreso" value={fmtDateTime(order.FechaIngreso)} />
            <DetailField label="Fecha de Salida"  value={fmtDate(order.ShipDate)} />
            <DetailField label="Canal de Venta"   value={order.CanalVenta} />
            <DetailField label="Cliente"          value={order.AccountName} />
            <DetailField label="Vendedor"         value={order.ShipBy} />
            <DetailField label="Destino"          value={order.CustomerShippingName} />
            <DetailField label="Tracking"         value={order.Tracking || '—'} />
            <DetailField label="Shipment ID"      value={order.Shipment_ID} />
            <DetailField label="Total Unidades"   value={String(order.Qty)} />
          </dl>

          {/* Items */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #0d2b4e', paddingBottom: 6, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e' }}>
              Productos
              <span style={{ background: '#0d2b4e', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                {visibleItems.length}{lpnSearch.trim() ? ` / ${order.Items.length}` : ''}
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 13, pointerEvents: 'none' }}>&#128269;</span>
              <input
                value={lpnSearch}
                onChange={(e) => setLpnSearch(e.target.value)}
                placeholder="Buscar LPN, Web SKU o MIT SKU..."
                style={{ padding: '5px 28px 5px 28px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12, width: 220 }}
              />
              {lpnSearch && (
                <button onClick={() => setLpnSearch('')}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 14, lineHeight: 1 }}>
                  ×
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0d2b4e', color: '#fff' }}>
                  {['LPN', 'Web SKU', 'MIT SKU', 'Cant.', 'Clasificación', 'Descripción'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '16px 12px', textAlign: 'center', color: '#aaa', fontSize: 12 }}>Sin resultados para "{lpnSearch}"</td></tr>
                )}
                {visibleItems.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e2e2', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#0d2b4e', fontWeight: 600 }}>{item.LPN}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                      <span style={{ background: '#f0f4f9', borderRadius: 3, padding: '1px 6px' }}>{item.WebSKU}</span>
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                      {item.MitSKU ? <span style={{ background: '#e8f5ee', color: '#065f46', borderRadius: 3, padding: '1px 6px' }}>{item.MitSKU}</span> : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{item.Qty}</td>
                    <td style={{ padding: '8px 12px' }}>{item.Clasificacion}</td>
                    <td style={{ padding: '8px 12px', color: '#444' }}>{item.DescripcionProducto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e2e2', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn btn-secundario">
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function B2CDashboard() {
  // Filters
  const [search,           setSearch]           = useState('');
  const [debouncedSq,      setDebouncedSq]      = useState('');
  const [filterStatus,        setFilterStatus]        = useState('');
  const [filterClient,        setFilterClient]        = useState('');
  const [filterChannel,       setFilterChannel]       = useState('');
  const [filterVendedor,      setFilterVendedor]      = useState('');
  const [filterSKU,           setFilterSKU]           = useState<string[]>([]);
  const [filterClasificacion, setFilterClasificacion] = useState('');
  const [filterMarketplace,   setFilterMarketplace]   = useState<'ml' | 'amazon' | 'walmart' | ''>('');
  const [filterFrom,       setFilterFrom]       = useState('');
  const [filterTo,         setFilterTo]         = useState('');
  const [page,             setPage]             = useState(1);
  const [detailOrder,      setDetailOrder]      = useState<B2COrder | null>(null);
  const [activeTab,        setActiveTab]        = useState<'resumen' | 'detalle'>('resumen');
  const [inspOrder,        setInspOrder]        = useState<B2COrder | null>(null);

  const { save: saveInsp, getLatest, getAll } = useInspecciones();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSq(v); setPage(1); }, 400);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch(''); setDebouncedSq('');
    setFilterStatus(''); setFilterClient('');
    setFilterChannel(''); setFilterVendedor('');
    setFilterSKU([]); setFilterClasificacion('');
    setFilterMarketplace('');
    setFilterFrom(''); setFilterTo('');
    setPage(1);
  }, []);

  // Default date range: last 30 days
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, []);
  const defaultTo = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, []);

  const apiFrom = filterFrom || defaultFrom;
  const apiTo   = filterTo   || defaultTo;

  const { data: allOrders = [], isLoading, isError } = useQuery<B2COrder[]>({
    queryKey: ['b2c-orders', apiFrom, apiTo],
    queryFn:  () => fetchB2COrders(apiFrom, apiTo),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  // Unique options from real data
  const clients         = useMemo(() => [...new Set(allOrders.map((o) => o.AccountName))].sort(), [allOrders]);
  const channels        = useMemo(() => [...new Set(allOrders.map((o) => o.CanalVenta))].sort(), [allOrders]);
  const vendedores      = useMemo(() => [...new Set(allOrders.map((o) => o.ShipBy).filter(Boolean))].sort(), [allOrders]);
  const skus            = useMemo(() => [...new Set(allOrders.flatMap((o) => o.Items.map((i) => i.WebSKU)).filter(Boolean))].sort(), [allOrders]);
  const clasificaciones = useMemo(() => [...new Set(allOrders.flatMap((o) => o.Items.map((i) => i.Clasificacion)).filter(Boolean))].sort(), [allOrders]);

  // Client-side filters (marketplace, status, client, channel, search)
  const filtered = useMemo(() => {
    const sq = debouncedSq.toLowerCase().trim();
    return allOrders.filter((o) => {
      if (filterMarketplace    && detectMarketplace(o.AccountName) !== filterMarketplace) return false;
      if (filterStatus         && o.Status      !== filterStatus)  return false;
      if (filterClient         && o.AccountName !== filterClient)  return false;
      if (filterChannel        && o.CanalVenta  !== filterChannel) return false;
      if (filterVendedor       && o.ShipBy      !== filterVendedor) return false;
      if (filterClasificacion  && !o.Items.some((i) => i.Clasificacion === filterClasificacion)) return false;
      if (filterSKU.length > 0 && !o.Items.some((i) => filterSKU.includes(i.WebSKU))) return false;
      if (sq) {
        const hay = [
          o.OrderID, String(o.OrderEntryID), o.AccountName, o.ShipBy,
          o.CustomerShippingName, o.CanalVenta, o.Status, o.Tracking,
          ...o.Items.flatMap((i) => [i.LPN, i.WebSKU, i.MitSKU, i.DescripcionProducto]),
        ].join(' ').toLowerCase();
        if (!hay.includes(sq)) return false;
      }
      return true;
    });
  }, [allOrders, debouncedSq, filterMarketplace, filterStatus, filterClient, filterChannel, filterVendedor, filterSKU, filterClasificacion]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPIs (globales sobre todas las órdenes del período, sin filtros de UI)
  const kpiRecibidas    = allOrders.filter((o) => o.Status === 'Received OE').length;
  const kpiEnProceso    = allOrders.filter((o) => ['Pending', 'paid', 'Unshipped'].includes(o.Status)).length;
  const kpiListos       = allOrders.filter((o) => o.Status === 'ready_to_print').length;
  const kpiEnviados     = allOrders.filter((o) => ['Shipped', 'shipped', 'Delivered', 'delivered'].includes(o.Status)).length;
  const kpiCancelados   = allOrders.filter((o) => o.Status === 'cancelled').length;
  const kpiTotalFiltered = filtered.length;
  const kpiUnits         = filtered.reduce((s, o) => s + o.Qty, 0);

  // Chart data derived from real orders
  const chartPorDia = useMemo(() => {
    const byDay = new Map<string, { ordenes: number; unidades: number }>();
    filtered.forEach((o) => {
      const day = (o.FechaIngreso ?? '').slice(0, 10);
      if (!day) return;
      const prev = byDay.get(day) ?? { ordenes: 0, unidades: 0 };
      byDay.set(day, { ordenes: prev.ordenes + 1, unidades: prev.unidades + o.Qty });
    });
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([dia, v]) => ({ dia: dia.slice(5).replace('-', '/'), ...v }));
  }, [filtered]);

  const chartPorCliente = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((o) => m.set(o.AccountName, (m.get(o.AccountName) ?? 0) + o.Qty));
    return Array.from(m.entries()).sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([cliente, unidades]) => ({ cliente, unidades }));
  }, [filtered]);

  const chartEstatus = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((o) => m.set(o.Status, (m.get(o.Status) ?? 0) + 1));
    return Array.from(m.entries()).sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [filtered]);

  const chartCanal = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((o) => m.set(o.CanalVenta, (m.get(o.CanalVenta) ?? 0) + 1));
    return Array.from(m.entries()).sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({ name, value, color: CHART_COLORS[(i + 3) % CHART_COLORS.length] }));
  }, [filtered]);

  const chartSKU = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((o) => o.Items.forEach((i) => {
      const key = i.MitSKU || i.WebSKU;
      m.set(key, (m.get(key) ?? 0) + (i.Qty || 1));
    }));
    return Array.from(m.entries())
      .sort(([, a], [, b]) => b - a).slice(0, 12)
      .map(([sku, unidades]) => ({ sku, unidades }));
  }, [filtered]);

  const chartClasificacion = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((o) => o.Items.forEach((i) => {
      const key = i.Clasificacion || 'Sin clasificación';
      m.set(key, (m.get(key) ?? 0) + (i.Qty || 1));
    }));
    return Array.from(m.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [filtered]);

  const chartVendedor = useMemo(() => {
    const m = new Map<string, { ordenes: number; full: string }>();
    filtered.forEach((o) => {
      const full = o.ShipBy || 'Sin asignar';
      const short = full.includes('@') ? full.split('@')[0] : full;
      const prev = m.get(short) ?? { ordenes: 0, full };
      m.set(short, { ordenes: prev.ordenes + 1, full });
    });
    return Array.from(m.entries())
      .sort(([, a], [, b]) => b.ordenes - a.ordenes).slice(0, 12)
      .map(([vendedor, { ordenes, full }]) => ({ vendedor, ordenes, full }));
  }, [filtered]);

  const hasFilters = filterStatus || filterClient || filterChannel || filterVendedor || filterSKU.length > 0 || filterClasificacion || filterMarketplace || filterFrom || filterTo || search;

  // Tab style helper
  const tabStyle = (tab: 'resumen' | 'detalle') => ({
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 500,
    background: 'none',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #0d2b4e' : '2px solid transparent',
    marginBottom: -2,
    color: activeTab === tab ? '#0d2b4e' : '#666',
    cursor: 'pointer' as const,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 2 }}>
            Dashboard B2C
          </h1>
          <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
            Salidas de material — datos en tiempo real de Bin Manager
            {isLoading && <span style={{ marginLeft: 10, color: '#2980b9', fontSize: 11, fontWeight: 700 }}>Cargando...</span>}
            {isError   && <span style={{ marginLeft: 10, color: '#c0392b', fontSize: 11, fontWeight: 700 }}>Error al conectar con BinManager</span>}
          </p>
        </div>
      </div>

      {/* KPI Cards — conteos globales del período */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Recibidas"       value={kpiRecibidas}     color="#1d4ed8" sub="Received OE" />
        <KpiCard label="En Proceso"      value={kpiEnProceso}     color="#b45309" sub="Pending · Paid · Unshipped" />
        <KpiCard label="Listas p/ Envío" value={kpiListos}        color="#065f46" sub="Ready to print" />
        <KpiCard label="Enviadas"        value={kpiEnviados}      color="#5b21b6" sub="Shipped · Delivered" />
        <KpiCard label="Canceladas"      value={kpiCancelados}    color="#991b1b" sub="cancelled" />
        <KpiCard label="Total filtrado"  value={kpiTotalFiltered} sub={`${kpiUnits} unidades`} />
      </div>

      {/* Marketplace quick filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {([
          { key: 'ml',      label: 'Mercado Libre', bg: '#fff0e0', color: '#F7971E', border: '#F7971E' },
          { key: 'amazon',  label: 'Amazon',        bg: '#fff8e6', color: '#FF9900', border: '#FF9900' },
          { key: 'walmart', label: 'Walmart',       bg: '#e6f0ff', color: '#0071dc', border: '#0071dc' },
        ] as { key: 'ml' | 'amazon' | 'walmart'; label: string; bg: string; color: string; border: string }[]).map(({ key, label, bg, color, border }) => {
          const active = filterMarketplace === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setFilterMarketplace(active ? '' : key); setPage(1); }}
              style={{
                padding: '7px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 4,
                border: `2px solid ${active ? border : '#e2e2e2'}`,
                background: active ? bg : '#fafafa',
                color: active ? color : '#777',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
        {filterMarketplace && (
          <button type="button" onClick={() => { setFilterMarketplace(''); setPage(1); }}
            style={{ background: 'none', border: 'none', fontSize: 11, color: '#888', cursor: 'pointer', textDecoration: 'underline' }}>
            Quitar filtro
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '2px solid #e2e2e2', display: 'flex', gap: 0 }}>
        <button type="button" style={tabStyle('resumen')} onClick={() => setActiveTab('resumen')}>
          Resumen
        </button>
        <button type="button" style={tabStyle('detalle')} onClick={() => setActiveTab('detalle')}>
          Detalle de Órdenes
        </button>
      </div>

      {/* Filters + Search — siempre visibles en ambas pestañas */}
      <div style={{ background: '#fff', border: '1px solid #e2e2e2', padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Fecha Ingreso Desde</label>
            <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
              style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #d0d0d0', borderRadius: 2 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Fecha Ingreso Hasta</label>
            <input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
              style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #d0d0d0', borderRadius: 2 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Estatus</label>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #d0d0d0', borderRadius: 2 }}>
              <option value="">Todos</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Cliente</label>
            <select value={filterClient} onChange={(e) => { setFilterClient(e.target.value); setPage(1); }}
              style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #d0d0d0', borderRadius: 2 }}>
              <option value="">Todos</option>
              {clients.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Canal de Venta</label>
            <select value={filterChannel} onChange={(e) => { setFilterChannel(e.target.value); setPage(1); }}
              style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #d0d0d0', borderRadius: 2 }}>
              <option value="">Todos</option>
              {channels.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Vendedor</label>
            <select value={filterVendedor} onChange={(e) => { setFilterVendedor(e.target.value); setPage(1); }}
              style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #d0d0d0', borderRadius: 2 }}>
              <option value="">Todos</option>
              {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Clasificación</label>
            <select value={filterClasificacion} onChange={(e) => { setFilterClasificacion(e.target.value); setPage(1); }}
              style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #d0d0d0', borderRadius: 2 }}>
              <option value="">Todas</option>
              {clasificaciones.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>SKU</label>
            <MultiSelectDropdown
              options={skus} value={filterSKU}
              onChange={(v) => { setFilterSKU(v); setPage(1); }}
              placeholder="Seleccionar SKU..."
              style={{ flex: 'unset', minWidth: 'unset' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 14, pointerEvents: 'none' }}>&#128269;</span>
            <input type="search" value={search} onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar por orden, cliente, LPN, SKU, vendedor, tracking..."
              style={{ width: '100%', fontSize: 13, padding: '7px 10px 7px 32px', border: '1px solid #d0d0d0', borderRadius: 2 }} />
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="btn btn-secundario" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
              ✕ Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Tab: Resumen (Gráficas) ── */}
      {activeTab === 'resumen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          <div style={{ background: '#fff', border: '1px solid #e2e2e2', padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 16 }}>Órdenes y Unidades por Día</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartPorDia} barGap={4} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e2e2', borderRadius: 2 }} cursor={{ fill: '#f0f4f9' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ordenes" name="Órdenes" fill="#0d2b4e" radius={[2, 2, 0, 0]}>
                  <LabelList dataKey="ordenes" position="top" style={{ fontSize: 10, fill: '#0d2b4e', fontWeight: 700 }} />
                </Bar>
                <Bar dataKey="unidades" name="Unidades" fill="#5a9fd4" radius={[2, 2, 0, 0]}>
                  <LabelList dataKey="unidades" position="top" style={{ fontSize: 10, fill: '#5a9fd4', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e2e2', padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 16 }}>Unidades por Cliente</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartPorCliente} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="cliente" tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e2e2', borderRadius: 2 }} cursor={{ fill: '#f0f4f9' }} />
                <Bar dataKey="unidades" name="Unidades" fill="#0d2b4e" radius={[0, 2, 2, 0]}>
                  <LabelList dataKey="unidades" position="right" style={{ fontSize: 10, fill: '#0d2b4e', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e2e2', padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 16 }}>Distribución por Estatus</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartEstatus} cx="50%" cy="48%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value"
                  label={({ value, percent }: { value: number; percent?: number }) => `${value} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: '#ccc', strokeWidth: 1 }}>
                  {chartEstatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value) => [`${value} órdenes`]} contentStyle={{ fontSize: 12, border: '1px solid #e2e2e2', borderRadius: 2 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span style={{ color: '#555' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e2e2', padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 16 }}>Distribución por Canal de Venta</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartCanal} cx="50%" cy="48%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value"
                  label={({ value, percent }: { value: number; percent?: number }) => `${value} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: '#ccc', strokeWidth: 1 }}>
                  {chartCanal.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value) => [`${value} órdenes`]} contentStyle={{ fontSize: 12, border: '1px solid #e2e2e2', borderRadius: 2 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span style={{ color: '#555' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top SKUs — horizontal para que los nombres sean legibles */}
          <div style={{ background: '#fff', border: '1px solid #e2e2e2', padding: '18px 20px', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 16 }}>Top SKUs por Unidades</div>
            <ResponsiveContainer width="100%" height={Math.max(200, chartSKU.length * 30)}>
              <BarChart data={chartSKU} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="sku" tick={{ fontSize: 11, fill: '#333', fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={200} />
                <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e2e2', borderRadius: 2 }} cursor={{ fill: '#f0f4f9' }} />
                <Bar dataKey="unidades" name="Unidades" fill="#0d2b4e" radius={[0, 2, 2, 0]}>
                  <LabelList dataKey="unidades" position="right" style={{ fontSize: 11, fill: '#0d2b4e', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Clasificaciones — sin etiquetas inline, solo leyenda */}
          <div style={{ background: '#fff', border: '1px solid #e2e2e2', padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 16 }}>Unidades por Clasificación</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartClasificacion} cx="50%" cy="42%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value" label={false}>
                  {chartClasificacion.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} uds.`, name]} contentStyle={{ fontSize: 12, border: '1px solid #e2e2e2', borderRadius: 2 }} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => <span style={{ color: '#444' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Vendedor — usuario corto, email completo en tooltip */}
          <div style={{ background: '#fff', border: '1px solid #e2e2e2', padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 16 }}>Órdenes por Vendedor</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartVendedor} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="vendedor" tick={{ fontSize: 11, fill: '#333' }} axisLine={false} tickLine={false} width={150} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as { vendedor: string; ordenes: number; full: string };
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e2e2', padding: '8px 12px', fontSize: 12, borderRadius: 2 }}>
                        <div style={{ fontWeight: 700, color: '#0d2b4e', marginBottom: 2 }}>{d.full}</div>
                        <div>{d.ordenes} órdenes</div>
                      </div>
                    );
                  }}
                  cursor={{ fill: '#f0f4f9' }}
                />
                <Bar dataKey="ordenes" name="Órdenes" fill="#2980b9" radius={[0, 2, 2, 0]}>
                  <LabelList dataKey="ordenes" position="right" style={{ fontSize: 11, fill: '#2980b9', fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      {/* ── Tab: Detalle (Tabla) ── */}
      {activeTab === 'detalle' && (
        <div style={{ background: '#fff', border: '1px solid #e2e2e2', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0d2b4e', color: '#fff' }}>
                {[
                  { label: 'SiteOrderID',    align: 'left'   },
                  { label: 'Cuenta / Canal', align: 'left'   },
                  { label: 'Estado Interno', align: 'left'   },
                  { label: 'Web SKU',        align: 'left'   },
                  { label: 'MIT SKU',        align: 'left'   },
                  { label: 'Uds.',           align: 'center' },
                  { label: 'Descripción',    align: 'left'   },
                  { label: 'Fecha',          align: 'left'   },
                  { label: 'Insp. QC',       align: 'left'   },
                  { label: '',               align: 'left'   },
                ].map((h) => (
                  <th key={h.label} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: h.align as 'left' | 'center', whiteSpace: 'nowrap' }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                    {hasFilters ? 'Sin resultados para los filtros aplicados.' : 'Sin registros.'}
                  </td>
                </tr>
              ) : rows.map((order) => {
                const firstItem = order.Items[0];
                const webSKU = firstItem?.WebSKU ?? '—';
                const mitSKU = firstItem?.MitSKU  ?? '—';
                const desc   = firstItem?.DescripcionProducto ?? '—';
                const extraItems = order.Items.length > 1 ? order.Items.length - 1 : 0;
                return (
                  <tr key={order.OrderEntryID} onClick={() => setDetailOrder(order)}
                    style={{ borderBottom: '1px solid #e2e2e2', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#0d2b4e', fontFamily: 'monospace', fontSize: 11 }}>{order.OrderID}</div>
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>ID: {order.OrderEntryID}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{order.AccountName}</div>
                      {order.CanalVenta && (
                        <span style={{ background: '#f0f4f9', color: '#0d2b4e', borderRadius: 3, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>{order.CanalVenta}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={order.Status} />
                      {order.ShipBy && (
                        <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>/ {order.ShipBy}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: '#f0f4f9', color: '#0d2b4e', borderRadius: 3, padding: '2px 7px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>{webSKU}</span>
                      {extraItems > 0 && <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>+{extraItems}</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {mitSKU !== '—' ? (
                        <span style={{ background: '#e8f5ee', color: '#065f46', borderRadius: 3, padding: '2px 7px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>{mitSKU}</span>
                      ) : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#0d2b4e' }}>{order.Qty}</td>
                    <td style={{ padding: '10px 12px', color: '#444', maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }} title={desc}>{desc}</div>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 11, color: '#555', fontWeight: 500 }}>{fmtRelative(order.FechaIngreso)}</div>
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{fmtDate(order.FechaIngreso)}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
                      <InspeccionBadge
                        inspeccion={getLatest(order.OrderEntryID)}
                        onClick={() => setInspOrder(order)}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDetailOrder(order); }} className="btn-accion" style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #e2e2e2', fontSize: 12, color: '#666' }}>
              <span>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #d0d0d0', background: page === 1 ? '#f4f4f4' : '#fff', cursor: page === 1 ? 'default' : 'pointer', borderRadius: 2 }}>‹</button>
                <span style={{ padding: '0 8px' }}>Pág. {page} de {totalPages}</span>
                <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                  style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #d0d0d0', background: page === totalPages ? '#f4f4f4' : '#fff', cursor: page === totalPages ? 'default' : 'pointer', borderRadius: 2 }}>›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {detailOrder && <DetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />}

      {inspOrder && (
        <InspeccionModal
          order={inspOrder}
          historial={getAll(inspOrder.OrderEntryID)}
          onSave={(entry) => { saveInsp(inspOrder.OrderEntryID, entry); setInspOrder(null); }}
          onClose={() => setInspOrder(null)}
        />
      )}

    </div>
  );
}
