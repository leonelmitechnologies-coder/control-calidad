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

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ORDERS: B2COrder[] = [
  {
    OrderEntryID: 452110, OrderID: '19009870', FechaIngreso: '2026-07-01T08:30:00',
    ShipDate: '2026-07-05', AccountName: 'Walmart', ShipBy: 'victor.leyva',
    CustomerShippingName: 'FedEx', Qty: 3, CanalVenta: 'B2C', Status: 'Shipped',
    Tracking: 'FX123456789', Shipment_ID: 'SHP-001', LocationName: 'TIJ-WH01',
    Items: [
      { WebSKU: 'WMT-TV-55-A', MitSKUShip: 'MIT-TV-55', LPN: 'LPN-2026-0001', Clasificacion: 'Electrónica', DescripcionProducto: 'Smart TV 55" 4K UHD' },
      { WebSKU: 'WMT-TV-55-B', MitSKUShip: 'MIT-TV-55', LPN: 'LPN-2026-0002', Clasificacion: 'Electrónica', DescripcionProducto: 'Smart TV 55" 4K UHD' },
      { WebSKU: 'WMT-AC-RMT', MitSKUShip: 'MIT-RMT-01', LPN: 'LPN-2026-0003', Clasificacion: 'Accesorio', DescripcionProducto: 'Control Remoto Universal' },
    ],
  },
  {
    OrderEntryID: 452111, OrderID: '19009871', FechaIngreso: '2026-07-01T09:15:00',
    ShipDate: '2026-07-05', AccountName: 'Amazon', ShipBy: 'jose.garcia',
    CustomerShippingName: 'UPS', Qty: 2, CanalVenta: 'Marketplace', Status: 'Shipped',
    Tracking: 'UPS987654321', Shipment_ID: 'SHP-002', LocationName: 'TIJ-WH01',
    Items: [
      { WebSKU: 'AMZ-LAP-15-001', MitSKUShip: 'MIT-LAP-15', LPN: 'LPN-2026-0004', Clasificacion: 'Cómputo', DescripcionProducto: 'Laptop 15.6" Intel Core i5' },
      { WebSKU: 'AMZ-LAP-15-002', MitSKUShip: 'MIT-LAP-15', LPN: 'LPN-2026-0005', Clasificacion: 'Cómputo', DescripcionProducto: 'Laptop 15.6" Intel Core i5' },
    ],
  },
  {
    OrderEntryID: 452112, OrderID: '19009872', FechaIngreso: '2026-07-01T10:00:00',
    ShipDate: null, AccountName: 'Target', ShipBy: 'maria.lopez',
    CustomerShippingName: 'DHL', Qty: 5, CanalVenta: 'Retail', Status: 'Pending',
    Tracking: '', Shipment_ID: 'SHP-003', LocationName: 'TIJ-WH02',
    Items: [
      { WebSKU: 'TGT-BT-SPK-01', MitSKUShip: 'MIT-SPK-01', LPN: 'LPN-2026-0006', Clasificacion: 'Audio', DescripcionProducto: 'Bocina Bluetooth Portátil 20W' },
      { WebSKU: 'TGT-BT-SPK-02', MitSKUShip: 'MIT-SPK-01', LPN: 'LPN-2026-0007', Clasificacion: 'Audio', DescripcionProducto: 'Bocina Bluetooth Portátil 20W' },
      { WebSKU: 'TGT-BT-SPK-03', MitSKUShip: 'MIT-SPK-01', LPN: 'LPN-2026-0008', Clasificacion: 'Audio', DescripcionProducto: 'Bocina Bluetooth Portátil 20W' },
      { WebSKU: 'TGT-BT-SPK-04', MitSKUShip: 'MIT-SPK-01', LPN: 'LPN-2026-0009', Clasificacion: 'Audio', DescripcionProducto: 'Bocina Bluetooth Portátil 20W' },
      { WebSKU: 'TGT-BT-SPK-05', MitSKUShip: 'MIT-SPK-01', LPN: 'LPN-2026-0010', Clasificacion: 'Audio', DescripcionProducto: 'Bocina Bluetooth Portátil 20W' },
    ],
  },
  {
    OrderEntryID: 452113, OrderID: '19009873', FechaIngreso: '2026-07-02T07:45:00',
    ShipDate: '2026-07-06', AccountName: 'Costco', ShipBy: 'carlos.torres',
    CustomerShippingName: 'FedEx', Qty: 10, CanalVenta: 'B2C', Status: 'Delivered',
    Tracking: 'FX555444333', Shipment_ID: 'SHP-004', LocationName: 'TIJ-WH01',
    Items: [
      { WebSKU: 'CST-MWV-001', MitSKUShip: 'MIT-MWV-01', LPN: 'LPN-2026-0011', Clasificacion: 'Hogar', DescripcionProducto: 'Microondas 1.1 pies³ 1000W' },
      { WebSKU: 'CST-MWV-002', MitSKUShip: 'MIT-MWV-01', LPN: 'LPN-2026-0012', Clasificacion: 'Hogar', DescripcionProducto: 'Microondas 1.1 pies³ 1000W' },
    ],
  },
  {
    OrderEntryID: 452114, OrderID: '19009874', FechaIngreso: '2026-07-02T08:00:00',
    ShipDate: null, AccountName: 'Best Buy', ShipBy: 'victor.leyva',
    CustomerShippingName: 'USPS', Qty: 1, CanalVenta: 'Marketplace', Status: 'Processing',
    Tracking: '', Shipment_ID: 'SHP-005', LocationName: 'TIJ-WH02',
    Items: [
      { WebSKU: 'BBY-GMS-001', MitSKUShip: 'MIT-GMS-01', LPN: 'LPN-2026-0013', Clasificacion: 'Gaming', DescripcionProducto: 'Consola de Videojuegos Next-Gen' },
    ],
  },
  {
    OrderEntryID: 452115, OrderID: '19009875', FechaIngreso: '2026-07-02T09:30:00',
    ShipDate: '2026-07-04', AccountName: 'Walmart', ShipBy: 'jose.garcia',
    CustomerShippingName: 'Amazon Logistics', Qty: 4, CanalVenta: 'B2C', Status: 'Shipped',
    Tracking: 'AMZL112233445', Shipment_ID: 'SHP-006', LocationName: 'TIJ-WH01',
    Items: [
      { WebSKU: 'WMT-TAB-10-01', MitSKUShip: 'MIT-TAB-10', LPN: 'LPN-2026-0014', Clasificacion: 'Cómputo', DescripcionProducto: 'Tablet 10.1" Android 64GB' },
      { WebSKU: 'WMT-TAB-10-02', MitSKUShip: 'MIT-TAB-10', LPN: 'LPN-2026-0015', Clasificacion: 'Cómputo', DescripcionProducto: 'Tablet 10.1" Android 64GB' },
      { WebSKU: 'WMT-TAB-10-03', MitSKUShip: 'MIT-TAB-10', LPN: 'LPN-2026-0016', Clasificacion: 'Cómputo', DescripcionProducto: 'Tablet 10.1" Android 64GB' },
      { WebSKU: 'WMT-TAB-10-04', MitSKUShip: 'MIT-TAB-10', LPN: 'LPN-2026-0017', Clasificacion: 'Cómputo', DescripcionProducto: 'Tablet 10.1" Android 64GB' },
    ],
  },
  {
    OrderEntryID: 452116, OrderID: '19009876', FechaIngreso: '2026-07-03T08:15:00',
    ShipDate: '2026-07-06', AccountName: 'Home Depot', ShipBy: 'maria.lopez',
    CustomerShippingName: 'UPS', Qty: 6, CanalVenta: 'Retail', Status: 'Shipped',
    Tracking: 'UPS778899001', Shipment_ID: 'SHP-007', LocationName: 'TIJ-WH01',
    Items: [
      { WebSKU: 'HD-VC-001', MitSKUShip: 'MIT-VC-01', LPN: 'LPN-2026-0018', Clasificacion: 'Hogar', DescripcionProducto: 'Aspiradora Robot Inteligente' },
      { WebSKU: 'HD-VC-002', MitSKUShip: 'MIT-VC-01', LPN: 'LPN-2026-0019', Clasificacion: 'Hogar', DescripcionProducto: 'Aspiradora Robot Inteligente' },
    ],
  },
  {
    OrderEntryID: 452117, OrderID: '19009877', FechaIngreso: '2026-07-03T10:00:00',
    ShipDate: null, AccountName: 'Amazon', ShipBy: 'carlos.torres',
    CustomerShippingName: 'DHL', Qty: 2, CanalVenta: 'Marketplace', Status: 'Cancelled',
    Tracking: '', Shipment_ID: 'SHP-008', LocationName: 'TIJ-WH02',
    Items: [
      { WebSKU: 'AMZ-HP-001', MitSKUShip: 'MIT-HP-01', LPN: 'LPN-2026-0020', Clasificacion: 'Cómputo', DescripcionProducto: 'Impresora Multifuncional Inalámbrica' },
      { WebSKU: 'AMZ-HP-002', MitSKUShip: 'MIT-HP-01', LPN: 'LPN-2026-0021', Clasificacion: 'Cómputo', DescripcionProducto: 'Impresora Multifuncional Inalámbrica' },
    ],
  },
  {
    OrderEntryID: 452118, OrderID: '19009878', FechaIngreso: '2026-07-04T07:30:00',
    ShipDate: '2026-07-06', AccountName: 'Target', ShipBy: 'victor.leyva',
    CustomerShippingName: 'FedEx', Qty: 8, CanalVenta: 'B2C', Status: 'Delivered',
    Tracking: 'FX999888777', Shipment_ID: 'SHP-009', LocationName: 'TIJ-WH01',
    Items: [
      { WebSKU: 'TGT-CAM-4K-01', MitSKUShip: 'MIT-CAM-4K', LPN: 'LPN-2026-0022', Clasificacion: 'Fotografía', DescripcionProducto: 'Cámara de Seguridad 4K Exterior' },
    ],
  },
  {
    OrderEntryID: 452119, OrderID: '19009879', FechaIngreso: '2026-07-04T09:00:00',
    ShipDate: null, AccountName: 'Costco', ShipBy: 'jose.garcia',
    CustomerShippingName: 'USPS', Qty: 3, CanalVenta: 'Retail', Status: 'Pending',
    Tracking: '', Shipment_ID: 'SHP-010', LocationName: 'TIJ-WH02',
    Items: [
      { WebSKU: 'CST-AIR-001', MitSKUShip: 'MIT-AIR-01', LPN: 'LPN-2026-0023', Clasificacion: 'Hogar', DescripcionProducto: 'Purificador de Aire HEPA 400m²' },
      { WebSKU: 'CST-AIR-002', MitSKUShip: 'MIT-AIR-01', LPN: 'LPN-2026-0024', Clasificacion: 'Hogar', DescripcionProducto: 'Purificador de Aire HEPA 400m²' },
      { WebSKU: 'CST-AIR-003', MitSKUShip: 'MIT-AIR-01', LPN: 'LPN-2026-0025', Clasificacion: 'Hogar', DescripcionProducto: 'Purificador de Aire HEPA 400m²' },
    ],
  },
  {
    OrderEntryID: 452120, OrderID: '19009880', FechaIngreso: '2026-07-05T08:00:00',
    ShipDate: '2026-07-06', AccountName: 'Best Buy', ShipBy: 'maria.lopez',
    CustomerShippingName: 'FedEx', Qty: 1, CanalVenta: 'Marketplace', Status: 'Shipped',
    Tracking: 'FX111222333', Shipment_ID: 'SHP-011', LocationName: 'TIJ-WH01',
    Items: [
      { WebSKU: 'BBY-TV-65-001', MitSKUShip: 'MIT-TV-65', LPN: 'LPN-2026-0026', Clasificacion: 'Electrónica', DescripcionProducto: 'Smart TV 65" QLED 8K' },
    ],
  },
  {
    OrderEntryID: 452121, OrderID: '19009881', FechaIngreso: '2026-07-05T09:45:00',
    ShipDate: null, AccountName: 'Walmart', ShipBy: 'carlos.torres',
    CustomerShippingName: 'UPS', Qty: 7, CanalVenta: 'B2C', Status: 'Processing',
    Tracking: '', Shipment_ID: 'SHP-012', LocationName: 'TIJ-WH02',
    Items: [
      { WebSKU: 'WMT-HDS-001', MitSKUShip: 'MIT-HDS-01', LPN: 'LPN-2026-0027', Clasificacion: 'Audio', DescripcionProducto: 'Audífonos Inalámbricos Noise Cancelling' },
      { WebSKU: 'WMT-HDS-002', MitSKUShip: 'MIT-HDS-01', LPN: 'LPN-2026-0028', Clasificacion: 'Audio', DescripcionProducto: 'Audífonos Inalámbricos Noise Cancelling' },
    ],
  },
];

const PAGE_SIZE = 10;

// ── Chart mock data (independent from table mock) ─────────────────────────────

const CHART_POR_DIA = [
  { dia: '30 Jun', ordenes: 8,  unidades: 22 },
  { dia: '01 Jul', ordenes: 12, unidades: 38 },
  { dia: '02 Jul', ordenes: 7,  unidades: 19 },
  { dia: '03 Jul', ordenes: 15, unidades: 45 },
  { dia: '04 Jul', ordenes: 10, unidades: 31 },
  { dia: '05 Jul', ordenes: 18, unidades: 54 },
  { dia: '06 Jul', ordenes: 9,  unidades: 27 },
];

const CHART_POR_CLIENTE = [
  { cliente: 'Walmart',   unidades: 48 },
  { cliente: 'Amazon',    unidades: 36 },
  { cliente: 'Target',    unidades: 29 },
  { cliente: 'Costco',    unidades: 22 },
  { cliente: 'Best Buy',  unidades: 17 },
  { cliente: 'Home Depot',unidades: 14 },
];

const CHART_ESTATUS = [
  { name: 'Enviado',     value: 42, color: '#27ae60' },
  { name: 'Entregado',   value: 28, color: '#0d2b4e' },
  { name: 'En Proceso',  value: 15, color: '#c0711a' },
  { name: 'Pendiente',   value: 10, color: '#b09000' },
  { name: 'Cancelado',   value: 5,  color: '#c0392b' },
];

const CHART_CANAL = [
  { name: 'B2C',         value: 45, color: '#0d2b4e' },
  { name: 'Marketplace', value: 30, color: '#2e6da4' },
  { name: 'Retail',      value: 18, color: '#5a9fd4' },
  { name: 'Wholesale',   value: 7,  color: '#a8cce8' },
];

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; color: string; border: string; label: string }> = {
  Shipped:    { bg: '#e8f5ee', color: '#27ae60', border: '#27ae60', label: 'Enviado' },
  Delivered:  { bg: '#e8f0f9', color: '#0d2b4e', border: '#0d2b4e', label: 'Entregado' },
  Processing: { bg: '#fdf2e8', color: '#c0711a', border: '#c0711a', label: 'En Proceso' },
  Pending:    { bg: '#fdf6e8', color: '#8a6a00', border: '#b09000', label: 'Pendiente' },
  Cancelled:  { bg: '#fde8e8', color: '#c0392b', border: '#c0392b', label: 'Cancelado' },
};

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
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', borderBottom: '2px solid #0d2b4e', paddingBottom: 6, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            Productos
            <span style={{ background: '#0d2b4e', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
              {order.Items.length}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0d2b4e', color: '#fff' }}>
                  {['LPN', 'SKU (Web)', 'SKU (MIT)', 'Clasificación', 'Descripción'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.Items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e2e2', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#0d2b4e', fontWeight: 600 }}>{item.LPN}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{item.WebSKU}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{item.MitSKUShip}</td>
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
  const [search,      setSearch]      = useState('');
  const [debouncedSq, setDebouncedSq] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterClient,  setFilterClient]  = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterFrom,    setFilterFrom]    = useState('');
  const [filterTo,      setFilterTo]      = useState('');
  const [page,          setPage]          = useState(1);
  const [detailOrder,   setDetailOrder]   = useState<B2COrder | null>(null);
  const [activeTab,     setActiveTab]     = useState<'resumen' | 'detalle'>('resumen');
  const [inspOrder,     setInspOrder]     = useState<B2COrder | null>(null);

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
    setFilterChannel(''); setFilterFrom(''); setFilterTo('');
    setPage(1);
  }, []);

  // Unique options from data
  const clients  = useMemo(() => [...new Set(MOCK_ORDERS.map((o) => o.AccountName))].sort(), []);
  const channels = useMemo(() => [...new Set(MOCK_ORDERS.map((o) => o.CanalVenta))].sort(), []);

  // Filter logic
  const filtered = useMemo(() => {
    const sq = debouncedSq.toLowerCase().trim();
    return MOCK_ORDERS.filter((o) => {
      if (filterStatus  && o.Status      !== filterStatus)  return false;
      if (filterClient  && o.AccountName !== filterClient)  return false;
      if (filterChannel && o.CanalVenta  !== filterChannel) return false;
      if (filterFrom) {
        const from = new Date(filterFrom + 'T00:00:00');
        const ing  = new Date(o.FechaIngreso);
        if (ing < from) return false;
      }
      if (filterTo) {
        const to  = new Date(filterTo + 'T23:59:59');
        const ing = new Date(o.FechaIngreso);
        if (ing > to) return false;
      }
      if (sq) {
        const hay = [
          o.OrderID, String(o.OrderEntryID), o.AccountName, o.ShipBy,
          o.CustomerShippingName, o.CanalVenta, o.Status, o.Tracking,
          ...o.Items.flatMap((i) => [i.LPN, i.WebSKU, i.MitSKUShip, i.DescripcionProducto]),
        ].join(' ').toLowerCase();
        if (!hay.includes(sq)) return false;
      }
      return true;
    });
  }, [debouncedSq, filterStatus, filterClient, filterChannel, filterFrom, filterTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPIs from filtered set
  const kpiTotal     = filtered.length;
  const kpiShipped   = filtered.filter((o) => o.Status === 'Shipped' || o.Status === 'Delivered').length;
  const kpiPending   = filtered.filter((o) => o.Status === 'Pending' || o.Status === 'Processing').length;
  const kpiUnits     = filtered.reduce((s, o) => s + o.Qty, 0);

  const hasFilters = filterStatus || filterClient || filterChannel || filterFrom || filterTo || search;

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
            Salidas de material — datos de Bin Manager
            <span style={{ marginLeft: 10, background: '#fdf6e8', color: '#8a6a00', border: '1px solid #b09000', borderRadius: 3, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
              PREVIEW — Datos simulados
            </span>
          </p>
        </div>
      </div>

      {/* KPI Cards — siempre visibles */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Total Órdenes"          value={kpiTotal}   sub={`de ${MOCK_ORDERS.length} en el período`} />
        <KpiCard label="Enviadas / Entregadas"   value={kpiShipped}  color="#27ae60" />
        <KpiCard label="En Proceso / Pendiente"  value={kpiPending}  color="#c0711a" />
        <KpiCard label="Total Unidades"          value={kpiUnits}   color="#0d2b4e" />
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
              <BarChart data={CHART_POR_DIA} barGap={4} barSize={14}>
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
              <BarChart data={CHART_POR_CLIENTE} layout="vertical" barSize={14}>
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
                <Pie data={CHART_ESTATUS} cx="50%" cy="48%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value"
                  label={({ value, percent }: { value: number; percent?: number }) => `${value} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: '#ccc', strokeWidth: 1 }}>
                  {CHART_ESTATUS.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
                <Pie data={CHART_CANAL} cx="50%" cy="48%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value"
                  label={({ value, percent }: { value: number; percent?: number }) => `${value} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: '#ccc', strokeWidth: 1 }}>
                  {CHART_CANAL.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value) => [`${value} órdenes`]} contentStyle={{ fontSize: 12, border: '1px solid #e2e2e2', borderRadius: 2 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span style={{ color: '#555' }}>{value}</span>} />
              </PieChart>
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
                {['# Orden', 'Cliente', 'Vendedor', 'Destino', 'Ingreso', 'Salida', 'Canal', 'Uds.', 'Estatus', 'Inspección QC', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: h === 'Uds.' ? 'center' : 'left', whiteSpace: 'nowrap' }}>
                    {h}
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
              ) : rows.map((order) => (
                <tr key={order.OrderEntryID} onClick={() => setDetailOrder(order)}
                  style={{ borderBottom: '1px solid #e2e2e2', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0d2b4e', fontFamily: 'monospace', fontSize: 12 }}>{order.OrderID}</td>
                  <td style={{ padding: '10px 12px' }}>{order.AccountName}</td>
                  <td style={{ padding: '10px 12px', color: '#555' }}>{order.ShipBy}</td>
                  <td style={{ padding: '10px 12px', color: '#555' }}>{order.CustomerShippingName}</td>
                  <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{fmtDate(order.FechaIngreso)}</td>
                  <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{fmtDate(order.ShipDate)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: '#f0f4f9', color: '#0d2b4e', borderRadius: 3, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{order.CanalVenta}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{order.Qty}</td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={order.Status} /></td>
                  <td style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
                    <InspeccionBadge
                      inspeccion={getLatest(order.OrderEntryID)}
                      onClick={() => setInspOrder(order)}
                    />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDetailOrder(order); }} className="btn-accion" style={{ fontSize: 11, fontWeight: 700 }}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
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
