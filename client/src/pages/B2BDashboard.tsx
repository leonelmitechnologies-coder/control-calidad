/**
 * Dashboard B2B — Order Manager
 *
 * Preview con datos simulados. Cuando IT entregue la API de Bin Manager
 * (módulo OrderManager), se reemplaza MOCK_ORDERS por useQuery real.
 *
 * Campos: OrderID, Customer, Total, Status, Location, SKU, LPN, Description,
 * Units Ordered/Delivered/Remaining/Not Found, Invoice Date, Due Date,
 * Entered By, Entered Date, SalesRep #1/#2, Billing Address.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { MultiSelectDropdown } from '../components/common/MultiSelectDropdown';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList, Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface B2BItem {
  sku:         string;
  lpn:         string;
  description: string;
  qtyOrdered:  number;
  qtyDelivered:number;
  price:       number;
  subtotal:    number;
}

interface B2BOrder {
  orderId:       string;
  customer:      string;
  total:         number;
  paid:          number;
  balance:       number;
  status:        string;
  location:      string;
  unitsOrdered:  number;
  unitsDelivered:number;
  unitsRemaining:number;
  notFound:      number;
  invoiceDate:   string;
  dueDate:       string;
  enteredBy:     string;
  enteredDate:   string;
  salesRep1:     string;
  salesRep2:     string;
  billingAddress:string;
  items:         B2BItem[];
}

// ── API Types & Mapping ───────────────────────────────────────────────────────

interface ApiItem {
  SKU: string; LPN: string; ItemDescription: string;
  QtyOrdered: number; Rate: number; Amount: number; QtyDelivered: number;
}
interface ApiOrder {
  OrderID: number; CustomerName: string; Total: number; Paid: number;
  Status: string; Location: string; EnteredDate: string; EnteredBy: string;
  InvoiceDate: string; DueDate: string; CurrencyCode: string | null;
  SalesRep1Name: string; SalesRep2Name: string; BillingAddress: string;
  UnitsOrdered: number; UnitsDelivered: number; Items: ApiItem[];
}

function mapApiOrder(o: ApiOrder): B2BOrder {
  const fmt = (iso: string) => iso ? new Date(iso).toLocaleString('es-MX') : '';
  return {
    orderId:        String(o.OrderID),
    customer:       o.CustomerName,
    total:          o.Total,
    paid:           o.Paid,
    balance:        o.Total - o.Paid,
    status:         o.Status,
    location:       o.Location,
    unitsOrdered:   o.UnitsOrdered,
    unitsDelivered: o.UnitsDelivered,
    unitsRemaining: Math.max(0, o.UnitsOrdered - o.UnitsDelivered),
    notFound:       0,
    invoiceDate:    fmt(o.InvoiceDate),
    dueDate:        fmt(o.DueDate),
    enteredBy:      o.EnteredBy || '',
    enteredDate:    fmt(o.EnteredDate),
    salesRep1:      o.SalesRep1Name,
    salesRep2:      o.SalesRep2Name,
    billingAddress: o.BillingAddress,
    items: (o.Items ?? []).map(it => ({
      sku:          it.SKU,
      lpn:          it.LPN || '',
      description:  it.ItemDescription || '',
      qtyOrdered:   it.QtyOrdered,
      qtyDelivered: it.QtyDelivered,
      price:        it.Rate || 0,
      subtotal:     it.Amount || 0,
    })),
  };
}

const STATUS_COLORS: Record<string, string> = {
  Complete: '#27ae60', Cancelled: '#c0392b', Processing: '#2980b9',
  Pending: '#c0711a', 'In Transit': '#8e44ad', Partial: '#d68910',
};
const LOC_COLORS = ['#0d2b4e', '#2980b9', '#27ae60', '#c0711a', '#8e44ad', '#d68910'];

// ── Inspección QC ─────────────────────────────────────────────────────────────

type InspeccionEstatus = 'ok' | 'con_problemas' | 'no_salio';

interface Inspeccion {
  estatus:    InspeccionEstatus;
  comentario: string;
  fotos:      string[];
  inspector:  string;
  timestamp:  string;
}

type InspeccionesMap = Record<string, Inspeccion[]>;

const LS_KEY = 'b2b_inspecciones_v1';

const INSP_CONFIG: Record<InspeccionEstatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  ok:            { label: 'Salió OK',            color: '#27ae60', bg: '#e8f5ee', border: '#27ae60', icon: '✓' },
  con_problemas: { label: 'Salió con problemas', color: '#c0711a', bg: '#fdf2e8', border: '#c0711a', icon: '⚠' },
  no_salio:      { label: 'No salió',            color: '#c0392b', bg: '#fde8e8', border: '#c0392b', icon: '✗' },
};

function useInspecciones() {
  const [data, setData] = useState<InspeccionesMap>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
  });

  const save = useCallback((orderId: string, entry: Inspeccion) => {
    setData((prev) => {
      const next = { ...prev, [orderId]: [...(prev[orderId] ?? []), entry] };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getLatest = useCallback((orderId: string): Inspeccion | undefined => {
    const list = data[orderId];
    return list && list.length > 0 ? list[list.length - 1] : undefined;
  }, [data]);

  const getAll = useCallback((orderId: string): Inspeccion[] => data[orderId] ?? [], [data]);

  return { save, getLatest, getAll };
}

// ── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  Complete:     { color: '#27ae60', bg: '#e8f5ee', label: 'Complete' },
  Cancelled:    { color: '#c0392b', bg: '#fde8e8', label: 'Cancelled' },
  Processing:   { color: '#2980b9', bg: '#e8f2fb', label: 'Processing' },
  Pending:      { color: '#c0711a', bg: '#fdf2e8', label: 'Pending' },
  'In Transit': { color: '#8e44ad', bg: '#f5eafb', label: 'In Transit' },
  Partial:      { color: '#d68910', bg: '#fef9e7', label: 'Partial' },
};

function statusCfg(s: string) {
  return STATUS_CONFIG[s] ?? { color: '#555', bg: '#f0f0f0', label: s };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(v: number) {
  return v === 0 ? 'USD $0.00' : `USD $${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function unitsRemBadge(order: B2BOrder) {
  if (order.status === 'Complete') return { label: 'Complete', color: '#27ae60', bg: '#e8f5ee' };
  if (order.status === 'Cancelled') return { label: `0/${order.unitsOrdered}`, color: '#c0392b', bg: '#fde8e8' };
  if (order.unitsRemaining > 0) return { label: String(order.unitsRemaining), color: '#c0392b', bg: '#fde8e8' };
  return { label: 'Complete', color: '#27ae60', bg: '#e8f5ee' };
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '18px 22px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: `4px solid ${accent ?? '#0d2b4e'}`,
      flex: 1, minWidth: 160,
    }}>
      <p style={{ margin: 0, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ margin: '6px 0 2px', fontSize: 26, fontWeight: 700, color: '#0d2b4e', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{sub}</p>}
    </div>
  );
}

// ── Detail Field ──────────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  const display = value == null || value === '' ? '—' : String(value);
  return (
    <div>
      <p style={{ margin: '0 0 2px', fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, color: '#222', fontWeight: 500, wordBreak: 'break-word' }}>{display}</p>
    </div>
  );
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
  order, historial, onSave, onClose,
}: {
  order: B2BOrder;
  historial: Inspeccion[];
  onSave: (e: Inspeccion) => void;
  onClose: () => void;
}) {
  const [estatus, setEstatus] = useState<InspeccionEstatus | null>(null);
  const [inspector, setInspector] = useState('');
  const [comentario, setComentario] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);

  const latest = historial[historial.length - 1];

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setFotos((p) => [...p, ev.target!.result as string]);
      };
      reader.readAsDataURL(f);
    });
  };

  const canSave = estatus !== null && inspector.trim() !== '' &&
    (estatus === 'ok' || comentario.trim() !== '');

  const handleSave = () => {
    if (!canSave || estatus === null) return;
    onSave({ estatus, comentario, fotos, inspector: inspector.trim(), timestamp: new Date().toISOString() });
    onClose();
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#0d2b4e' }}>Inspección QC</p>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Orden #{order.orderId} · {order.customer.split(' CID')[0]}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa' }}>×</button>
        </div>

        <div style={{ padding: '18px 22px' }}>

          {/* Estado actual */}
          {latest && (
            <div style={{ marginBottom: 18, padding: '10px 14px', borderRadius: 6, background: INSP_CONFIG[latest.estatus].bg, border: `1px solid ${INSP_CONFIG[latest.estatus].border}` }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: '#888' }}>Último estado registrado</p>
              <p style={{ margin: 0, fontWeight: 700, color: INSP_CONFIG[latest.estatus].color, fontSize: 13 }}>
                {INSP_CONFIG[latest.estatus].icon} {INSP_CONFIG[latest.estatus].label}
              </p>
              {latest.comentario && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#555' }}>{latest.comentario}</p>}
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#aaa' }}>Inspector: {latest.inspector} · {new Date(latest.timestamp).toLocaleString('es-MX')}</p>
            </div>
          )}

          {/* Nuevo registro */}
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#333' }}>Registrar nueva inspección</p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {(Object.keys(INSP_CONFIG) as InspeccionEstatus[]).map((k) => {
              const cfg = INSP_CONFIG[k];
              const active = estatus === k;
              return (
                <button key={k} type="button" onClick={() => setEstatus(k)} style={{
                  flex: 1, minWidth: 120, padding: '10px 8px', borderRadius: 6, fontWeight: 700,
                  fontSize: 12, cursor: 'pointer', border: `2px solid ${active ? cfg.color : '#ddd'}`,
                  background: active ? cfg.bg : '#fff', color: active ? cfg.color : '#888',
                  transition: 'all 0.15s',
                }}>
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
              Inspector *
            </label>
            <input value={inspector} onChange={(e) => setInspector(e.target.value)}
              placeholder="Nombre del inspector" style={{
                width: '100%', padding: '8px 12px', border: '1px solid #ddd',
                borderRadius: 5, fontSize: 13, boxSizing: 'border-box',
              }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
              Comentario {estatus !== 'ok' && <span style={{ color: '#c0392b' }}>*</span>}
            </label>
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)}
              rows={3} placeholder="Descripción de hallazgos / observaciones..." style={{
                width: '100%', padding: '8px 12px', border: '1px solid #ddd',
                borderRadius: 5, fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
              Evidencia fotográfica
            </label>
            <input type="file" accept="image/*" multiple onChange={handleFoto} style={{ fontSize: 12 }} />
            {fotos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {fotos.map((f, i) => (
                  <img key={i} src={f} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }} />
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={!canSave} style={{
            width: '100%', padding: '10px', borderRadius: 6, border: 'none',
            background: canSave ? '#0d2b4e' : '#ccc', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: canSave ? 'pointer' : 'not-allowed',
          }}>
            Guardar Inspección
          </button>

          {/* Historial */}
          {historial.length > 1 && (
            <div style={{ marginTop: 18 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#888' }}>
                Historial ({historial.length} registros)
              </p>
              {[...historial].reverse().slice(1).map((h, i) => {
                const cfg = INSP_CONFIG[h.estatus];
                return (
                  <div key={i} style={{ padding: '8px 12px', borderRadius: 5, background: '#f8f9fa', marginBottom: 6, borderLeft: `3px solid ${cfg.color}` }}>
                    <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.icon} {cfg.label}</p>
                    {h.comentario && <p style={{ margin: '0 0 2px', fontSize: 12, color: '#555' }}>{h.comentario}</p>}
                    <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{h.inspector} · {new Date(h.timestamp).toLocaleString('es-MX')}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({
  order, onClose, inspLatest, onInspeccionar,
}: {
  order: B2BOrder;
  onClose: () => void;
  inspLatest?: Inspeccion;
  onInspeccionar: () => void;
}) {
  const remBadge = unitsRemBadge(order);
  const scfg = statusCfg(order.status);

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: 780,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#0d2b4e' }}>Orden #{order.orderId}</span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: scfg.bg, color: scfg.color }}>{scfg.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <InspeccionBadge inspeccion={inspLatest} onClick={onInspeccionar} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa', lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ padding: '22px 24px' }}>

          {/* Info principal */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px 24px', marginBottom: 22 }}>
            <DetailField label="Cliente" value={order.customer} />
            <DetailField label="Location" value={order.location} />
            <DetailField label="Total" value={fmtUSD(order.total)} />
            <DetailField label="Paid" value={fmtUSD(order.paid)} />
            <DetailField label="Balance" value={fmtUSD(order.balance)} />
            <DetailField label="Billing Address" value={order.billingAddress} />
            <DetailField label="Invoice Date" value={order.invoiceDate} />
            <DetailField label="Due Date" value={order.dueDate} />
            <DetailField label="Entered By" value={order.enteredBy} />
            <DetailField label="Entered Date" value={order.enteredDate} />
            <DetailField label="SalesRep #1" value={order.salesRep1} />
            <DetailField label="SalesRep #2" value={order.salesRep2} />
          </div>

          {/* Fulfillment */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
            {[
              { l: 'Units Ordered',   v: order.unitsOrdered,   c: '#0d2b4e' },
              { l: 'Units Delivered', v: order.unitsDelivered, c: '#27ae60' },
              { l: 'Units Remaining', v: order.unitsRemaining, c: order.unitsRemaining > 0 ? '#c0392b' : '#27ae60' },
              { l: 'Not Found',       v: order.notFound,       c: order.notFound > 0 ? '#c0711a' : '#aaa' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ textAlign: 'center', flex: 1, minWidth: 100, padding: '12px 8px', background: '#f8f9fa', borderRadius: 8 }}>
                <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: c }}>{v}</p>
                <p style={{ margin: 0, fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{l}</p>
              </div>
            ))}
          </div>

          {/* Items */}
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#0d2b4e' }}>
            Items ({order.items.length})
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f4f6f9' }}>
                  {['SKU', 'LPN', 'Descripción', 'Qty O', 'Qty D', 'Price', 'SubTotal'].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: '#0d2b4e', fontWeight: 600 }}>{item.sku}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{item.lpn || '—'}</td>
                    <td style={{ padding: '8px 10px', color: '#333', maxWidth: 300 }}>{item.description}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>{item.qtyOrdered}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: item.qtyDelivered === item.qtyOrdered ? '#27ae60' : '#c0392b' }}>{item.qtyDelivered}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#555' }}>{item.price > 0 ? fmtUSD(item.price) : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{item.subtotal > 0 ? fmtUSD(item.subtotal) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function B2BDashboard() {
  const [tab, setTab] = useState<'resumen' | 'detalle'>('resumen');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus,        setFilterStatus]        = useState('');
  const [filterCustomer,      setFilterCustomer]      = useState('');
  const [filterVendedor,      setFilterVendedor]      = useState('');
  const [filterSKU,           setFilterSKU]           = useState<string[]>([]);
  const [filterClasificacion, setFilterClasificacion] = useState('');
  const [page, setPage] = useState(1);
  const [detailOrder, setDetailOrder] = useState<B2BOrder | null>(null);
  const [inspeccionOrder, setInspeccionOrder] = useState<B2BOrder | null>(null);
  const { save, getLatest, getAll } = useInspecciones();

  const PER_PAGE = 10;

  // Date range for API — usar fecha local para evitar desfase UTC
  const localDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayStr     = localDate(new Date());
  const thirtyAgoStr = localDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [apiFrom, setApiFrom] = useState(thirtyAgoStr);
  const [apiTo,   setApiTo]   = useState(todayStr);

  const { data: rawOrders = [], isLoading, isError } = useQuery<ApiOrder[]>({
    queryKey: ['b2b-orders', apiFrom, apiTo],
    queryFn: () => fetch(`/api/b2b-orders?startDate=${apiFrom}&endDate=${apiTo}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    staleTime: 5 * 60 * 1000,
  });

  const orders = useMemo(() => rawOrders.map(mapApiOrder), [rawOrders]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [filterStatus, filterCustomer, filterVendedor, filterSKU, filterClasificacion]);

  const customers       = useMemo(() => Array.from(new Set(orders.map((o) => o.customer.split(' CID')[0]))).sort(), [orders]);
  const statuses        = useMemo(() => Array.from(new Set(orders.map((o) => o.status))).sort(), [orders]);
  const vendedores      = useMemo(() => Array.from(new Set(orders.map((o) => o.salesRep1).filter(Boolean))).sort(), [orders]);
  const skus            = useMemo(() => Array.from(new Set(orders.flatMap((o) => o.items.map((i) => i.sku)))).sort(), [orders]);
  const clasificaciones = useMemo(() => {
    const skuClasif = (sku: string) => sku.includes('-') ? sku.split('-').pop()! : '';
    return Array.from(new Set(orders.flatMap((o) => o.items.map((i) => skuClasif(i.sku))).filter(Boolean))).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const skuClasif = (sku: string) => sku.includes('-') ? sku.split('-').pop()! : '';
    return orders.filter((o) => {
      if (filterStatus        && o.status    !== filterStatus)   return false;
      if (filterCustomer      && !o.customer.includes(filterCustomer)) return false;
      if (filterVendedor      && o.salesRep1 !== filterVendedor) return false;
      if (filterClasificacion && !o.items.some((i) => skuClasif(i.sku) === filterClasificacion)) return false;
      if (filterSKU.length > 0 && !o.items.some((i) => filterSKU.includes(i.sku))) return false;
      if (!q) return true;
      return (
        o.orderId.includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.enteredBy.toLowerCase().includes(q) ||
        o.salesRep1.toLowerCase().includes(q) ||
        o.location.toLowerCase().includes(q) ||
        o.items.some((it) => it.sku.toLowerCase().includes(q) || it.description.toLowerCase().includes(q))
      );
    });
  }, [debouncedSearch, filterStatus, filterCustomer, filterVendedor, filterSKU, filterClasificacion, orders]);

  // Chart data derived from all orders in the date range
  const chartPorDia = useMemo(() => {
    const byDay = new Map<string, { ordenes: number; unidades: number }>();
    for (const o of rawOrders) {
      if (!o.EnteredDate) continue;
      const d = new Date(o.EnteredDate);
      const dia = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
      const prev = byDay.get(dia) ?? { ordenes: 0, unidades: 0 };
      byDay.set(dia, { ordenes: prev.ordenes + 1, unidades: prev.unidades + (o.UnitsOrdered || 0) });
    }
    return Array.from(byDay.entries()).map(([dia, v]) => ({ dia, ...v })).slice(-15);
  }, [rawOrders]);

  const chartPorCliente = useMemo(() => {
    const by = new Map<string, number>();
    for (const o of rawOrders) {
      const name = (o.CustomerName || '').split(' CID')[0];
      by.set(name, (by.get(name) ?? 0) + (o.UnitsOrdered || 0));
    }
    return Array.from(by.entries())
      .map(([cliente, unidades]) => ({ cliente, unidades }))
      .sort((a, b) => b.unidades - a.unidades).slice(0, 8);
  }, [rawOrders]);

  const chartStatus = useMemo(() => {
    const by = new Map<string, number>();
    for (const o of rawOrders) { by.set(o.Status, (by.get(o.Status) ?? 0) + 1); }
    return Array.from(by.entries()).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] ?? '#555' }));
  }, [rawOrders]);

  const chartLocation = useMemo(() => {
    const by = new Map<string, number>();
    for (const o of rawOrders) {
      const loc = o.Location || 'Sin ubicación';
      by.set(loc, (by.get(loc) ?? 0) + 1);
    }
    return Array.from(by.entries()).map(([name, value], i) => ({ name, value, color: LOC_COLORS[i % LOC_COLORS.length] }));
  }, [rawOrders]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // KPIs
  const totalOrdenes   = filtered.length;
  const totalComplete  = filtered.filter((o) => o.status === 'Complete').length;
  const totalPending   = filtered.filter((o) => ['Pending', 'Processing', 'Partial'].includes(o.status)).length;
  const totalUnits     = filtered.reduce((a, o) => a + o.unitsOrdered, 0);
  const totalDelivered = filtered.reduce((a, o) => a + o.unitsDelivered, 0);
  const totalValue     = filtered.reduce((a, o) => a + o.total, 0);

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    borderBottom: tab === t ? '2px solid #0d2b4e' : '2px solid transparent',
    background: 'none', color: tab === t ? '#0d2b4e' : '#888', transition: 'all 0.15s',
  });

  return (
    <div style={{ fontFamily: 'inherit' }}>

      {/* Loading / error banner */}
      {(isLoading || isError) && (
        <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          background: isError ? '#fde8e8' : '#e8f2fb', color: isError ? '#c0392b' : '#2980b9',
          border: `1px solid ${isError ? '#c0392b' : '#2980b9'}` }}>
          {isError ? '⚠ Error al cargar datos de BinManager' : '⏳ Cargando órdenes B2B...'}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <KpiCard label="Total Órdenes"     value={totalOrdenes}          sub={`${filtered.length} en vista`}    accent="#0d2b4e" />
        <KpiCard label="Completadas"       value={totalComplete}         sub="entregadas"                        accent="#27ae60" />
        <KpiCard label="En Proceso"        value={totalPending}          sub="pendientes / parciales"            accent="#c0711a" />
        <KpiCard label="Units Ordered"     value={totalUnits.toLocaleString()}    sub={`${totalDelivered.toLocaleString()} entregadas`} accent="#2980b9" />
        <KpiCard label="Valor Total"       value={fmtUSD(totalValue)}    sub="en órdenes filtradas"             accent="#8e44ad" />
      </div>

      {/* Tabs + Filtros */}
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 8 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #eee', paddingLeft: 8 }}>
          <button style={tabStyle('resumen')} onClick={() => setTab('resumen')}>Resumen</button>
          <button style={tabStyle('detalle')} onClick={() => setTab('detalle')}>Detalle de Órdenes</button>
        </div>

        {/* Filtros siempre visibles */}
        <div style={{ padding: '14px 18px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <input type="date" value={apiFrom} onChange={(e) => { setApiFrom(e.target.value); setPage(1); }}
            style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13, background: '#fff' }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>–</span>
          <input type="date" value={apiTo} onChange={(e) => { setApiTo(e.target.value); setPage(1); }}
            style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13, background: '#fff' }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por orden, cliente, SKU, descripción..."
            style={{
              flex: 2, minWidth: 220, padding: '7px 12px', border: '1px solid #ddd',
              borderRadius: 5, fontSize: 13, outline: 'none',
            }}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            style={{ flex: 1, minWidth: 130, padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13, background: '#fff' }}>
            <option value="">Todos los estatus</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}
            style={{ flex: 1, minWidth: 150, padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13, background: '#fff' }}>
            <option value="">Todos los clientes</option>
            {customers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterVendedor} onChange={(e) => setFilterVendedor(e.target.value)}
            style={{ flex: 1, minWidth: 140, padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13, background: '#fff' }}>
            <option value="">Todos los vendedores</option>
            {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={filterClasificacion} onChange={(e) => setFilterClasificacion(e.target.value)}
            style={{ flex: 1, minWidth: 130, padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13, background: '#fff' }}>
            <option value="">Todas las clasif.</option>
            {clasificaciones.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <MultiSelectDropdown
            options={skus} value={filterSKU} onChange={setFilterSKU}
            placeholder="Filtrar por SKU..."
          />
          {(filterStatus || filterCustomer || filterVendedor || filterSKU.length > 0 || filterClasificacion || search) && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterCustomer(''); setFilterVendedor(''); setFilterSKU([]); setFilterClasificacion(''); }}
              style={{ padding: '7px 14px', borderRadius: 5, border: '1px solid #ddd', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#c0392b' }}>
              Limpiar
            </button>
          )}
          <span style={{ fontSize: 12, color: '#aaa', marginLeft: 4 }}>{filtered.length} registro(s)</span>
        </div>
      </div>

      {/* ── Tab: Resumen ─────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Fila 1: Órdenes por día + Unidades por Cliente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <div style={{ background: '#fff', borderRadius: 8, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: '#0d2b4e' }}>Órdenes y Unidades por Día</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartPorDia} margin={{ top: 16, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="ordenes" name="Órdenes" fill="#0d2b4e" radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="ordenes" position="top" style={{ fontSize: 10, fill: '#0d2b4e', fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey="unidades" name="Unidades" fill="#2980b9" radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="unidades" position="top" style={{ fontSize: 10, fill: '#2980b9', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#fff', borderRadius: 8, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: '#0d2b4e' }}>Unidades por Cliente</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartPorCliente} layout="vertical" margin={{ top: 4, right: 50, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="cliente" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="unidades" name="Unidades" fill="#2980b9" radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="unidades" position="right" style={{ fontSize: 10, fill: '#2980b9', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fila 2: Status + Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <div style={{ background: '#fff', borderRadius: 8, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#0d2b4e' }}>Distribución por Estatus</p>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={chartStatus} cx="50%" cy="48%" innerRadius={55} outerRadius={80}
                    dataKey="value"
                    label={({ value, percent }: { value: number; percent?: number }) =>
                      `${value} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    labelLine={true}
                  >
                    {chartStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} órdenes`]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#fff', borderRadius: 8, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#0d2b4e' }}>Distribución por Location</p>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={chartLocation} cx="50%" cy="48%" innerRadius={55} outerRadius={80}
                    dataKey="value"
                    label={({ value, percent }: { value: number; percent?: number }) =>
                      `${value} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    labelLine={true}
                  >
                    {chartLocation.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} órdenes`]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fulfillment summary */}
          <div style={{ background: '#fff', borderRadius: 8, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#0d2b4e' }}>Resumen de Fulfillment</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                { l: 'Units Ordered',   v: orders.reduce((a, o) => a + o.unitsOrdered,   0), c: '#0d2b4e' },
                { l: 'Units Delivered', v: orders.reduce((a, o) => a + o.unitsDelivered, 0), c: '#27ae60' },
                { l: 'Units Remaining', v: orders.reduce((a, o) => a + o.unitsRemaining, 0), c: '#c0392b' },
                { l: 'Not Found',       v: orders.reduce((a, o) => a + o.notFound,       0), c: '#c0711a' },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ flex: 1, minWidth: 140, textAlign: 'center', padding: '16px 8px', background: '#f8f9fa', borderRadius: 8 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: c }}>{v.toLocaleString()}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Detalle ─────────────────────────────────────────────────────── */}
      {tab === 'detalle' && (
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f4f6f9', borderBottom: '2px solid #e8e8e8' }}>
                  {['OrderID', 'Cliente', 'Total', 'Estatus', 'Location', 'Units O', 'Units D', 'Remaining', 'Invoice Date', 'Entered By', 'Inspección QC', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#555', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((order) => {
                  const scfg = statusCfg(order.status);
                  const rem  = unitsRemBadge(order);
                  const insp = getLatest(order.orderId);
                  return (
                    <tr key={order.orderId} style={{ borderBottom: '1px solid #f0f0f0' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0d2b4e', fontFamily: 'monospace', fontSize: 12 }}>
                        #{order.orderId}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#333', maxWidth: 200 }}>
                        <span style={{ display: 'block', fontWeight: 600 }}>{order.customer.split(' CID')[0]}</span>
                        <span style={{ fontSize: 10, color: '#aaa' }}>{order.customer.match(/CID\(\d+\)/)?.[0]}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: order.balance < 0 ? '#c0392b' : '#333', fontWeight: order.balance < 0 ? 700 : 400, whiteSpace: 'nowrap' }}>
                        {fmtUSD(order.total)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 3, background: scfg.bg, color: scfg.color, whiteSpace: 'nowrap' }}>
                          {scfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{order.location}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{order.unitsOrdered}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: order.unitsDelivered === order.unitsOrdered ? '#27ae60' : '#c0392b' }}>
                        {order.unitsDelivered}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 3, background: rem.bg, color: rem.color }}>
                          {rem.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#666', whiteSpace: 'nowrap', fontSize: 11 }}>{order.invoiceDate}</td>
                      <td style={{ padding: '10px 12px', color: '#666', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.enteredBy}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <InspeccionBadge inspeccion={insp} onClick={() => setInspeccionOrder(order)} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => setDetailOrder(order)} style={{
                          padding: '5px 12px', borderRadius: 4, border: '1px solid #ddd',
                          background: '#fff', fontSize: 11, cursor: 'pointer', color: '#0d2b4e', fontWeight: 600,
                        }}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pageItems.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>
                Página {page} de {totalPages}
              </span>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} style={{
                  width: 30, height: 30, borderRadius: 4, border: '1px solid',
                  borderColor: page === p ? '#0d2b4e' : '#ddd',
                  background: page === p ? '#0d2b4e' : '#fff',
                  color: page === p ? '#fff' : '#555',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {detailOrder && (
        <DetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          inspLatest={getLatest(detailOrder.orderId)}
          onInspeccionar={() => { setInspeccionOrder(detailOrder); setDetailOrder(null); }}
        />
      )}
      {inspeccionOrder && (
        <InspeccionModal
          order={inspeccionOrder}
          historial={getAll(inspeccionOrder.orderId)}
          onSave={(e) => save(inspeccionOrder.orderId, e)}
          onClose={() => setInspeccionOrder(null)}
        />
      )}
    </div>
  );
}
