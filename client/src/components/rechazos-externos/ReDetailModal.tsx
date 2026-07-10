import { createPortal } from 'react-dom';
import PhotoGallery from './PhotoGallery';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/formatters';
import type { RechazosExterno } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReDetailModalProps {
  isOpen:           boolean;
  data:             RechazosExterno;
  onClose:          () => void;
  onEdit:           () => void;
  onDeletePhoto?:   (imageId: number) => void;
  isDeletingPhoto?: boolean;
}

// ── Read-only field ───────────────────────────────────────────────────────────

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#777', marginBottom: 4 }}>
        {label}
      </dt>
      <dd style={{ fontSize: 13, color: '#111', margin: 0 }}>
        {value ?? <span style={{ color: '#aaa', fontStyle: 'italic' }}>—</span>}
      </dd>
    </div>
  );
}

// ── Time formatter ────────────────────────────────────────────────────────────

function formatTime(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtMinsLong(m: number | null | undefined): string {
  if (m == null) return '—';
  const totalDays = Math.floor(m / 1440);
  const remHours  = Math.floor((m % 1440) / 60);
  if (totalDays >= 365) {
    const yr = Math.floor(totalDays / 365);
    const mo = Math.floor((totalDays % 365) / 30);
    const d  = (totalDays % 365) % 30;
    return `${yr} yr${yr > 1 ? 's' : ''} ${mo} mo ${d} d`;
  }
  if (totalDays >= 30) { const mo = Math.floor(totalDays / 30); return `${mo} mo ${totalDays % 30} d`; }
  if (totalDays >= 1) return `${totalDays} d ${remHours} h`;
  return `${remHours}h ${m % 60}m`;
}

// ── Client-side print PDF ─────────────────────────────────────────────────────

function generatePdf(data: RechazosExterno) {
  const esc = (s: any) => String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmtTs = (ts: any) => ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
  const fmtDate = (d: any) => d ? String(d).slice(0, 10) : '—';
  const fmtPrice = (p: any) => p != null ? '$' + parseFloat(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const di = (label: string, val: any) => `<div class="di"><label>${label}</label><span>${esc(val)}</span></div>`;
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const probs = data.problem_descriptions ?? [];
  const acts  = data.corrective_actions   ?? [];
  const depts: Record<string, string[]> = {};
  for (const a of acts) {
    if (!depts[a.departamento]) depts[a.departamento] = [];
    depts[a.departamento].push(a.accion);
  }

  const photosHtml = data.images && data.images.length > 0 ? `
    <div class="section">
      <div class="sec-title">Photographic Evidence</div>
      <div class="photo-box">
        <div class="photos-wrap">
          ${data.images.map(img => `<div class="photo-item"><img src="${img.url || ''}" crossorigin="anonymous"></div>`).join('')}
        </div>
        <p class="photo-cap">${esc(data.license_plate)} — Visual evidence</p>
      </div>
    </div>` : '';

  const probsHtml = probs.length ? `
    <div class="section" style="break-before:page;page-break-before:always">
      <div class="sec-title">Problem Description</div>
      ${probs.map((p, i) => `<div class="prob-item"><div class="prob-num">${i + 1}</div><div class="prob-text">${esc(p.descripcion)}</div></div>`).join('')}
    </div>` : '';

  const accsHtml = Object.keys(depts).length ? `
    <div class="section">
      <div class="sec-title">Corrective Actions</div>
      ${Object.entries(depts).map(([dept, items]) => `
        <div class="dept-block">
          <div class="dept-hdr">${esc(dept)}</div>
          ${items.map((a, i) => `<div class="act-item"><div class="act-num">${i + 1}</div><div class="act-text">${esc(a)}</div></div>`).join('')}
        </div>`).join('')}
    </div>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>NCR-${esc(data.license_plate)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#222;background:#fff}
.header{display:flex;justify-content:space-between;align-items:center;padding:16px 28px 14px;border-bottom:2px solid #0d2b4e}
.header-right{text-align:right;font-size:10px;color:#555;line-height:1.7}
.title-block{background:#111;color:#fff;padding:16px 28px;margin-bottom:20px}
.title-block h1{font-size:19px;font-weight:700;letter-spacing:0.5px}
.title-block p{font-size:11px;margin-top:5px;color:rgba(255,255,255,.6)}
.section{padding:0 28px;margin-bottom:20px}
.sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0d2b4e;border-bottom:2px solid #0d2b4e;padding-bottom:5px;margin-bottom:12px}
.data-box{border-left:3px solid #0d2b4e;padding:12px 16px;background:#f8f9fb}
.data-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 32px}
.di label{display:block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#888;margin-bottom:2px}
.di span{font-size:11px;color:#222;font-weight:500}
.photo-box{border:1px solid #ddd;padding:14px}
.photos-wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.photo-item img{max-width:340px;max-height:280px;object-fit:contain;display:block}
.photo-cap{font-size:9px;color:#777;font-style:italic;margin-top:10px;text-align:center}
.prob-item{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;break-inside:avoid;page-break-inside:avoid}
.prob-num{width:22px;height:22px;background:#111;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px}
.prob-text{font-size:11px;line-height:1.6}
.dept-block{margin-bottom:14px;break-inside:avoid;page-break-inside:avoid}
.dept-hdr{background:#111;color:#fff;padding:7px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px}
.act-item{display:flex;gap:10px;margin-bottom:7px;padding:0 6px;align-items:flex-start;break-inside:avoid;page-break-inside:avoid}
.act-num{width:18px;height:18px;background:#444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;border-radius:2px;margin-top:1px}
.act-text{font-size:11px;line-height:1.6}
.footer{padding:10px 28px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:9px;color:#aaa;margin-top:8px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header">
  <img src="/QC_logo_sin_fondo.png" style="height:40px" onerror="this.style.display='none'">
  <div class="header-right">ISO 9001:2015<br>Non-Conformance Report</div>
</div>
<div class="title-block">
  <h1>NON-CONFORMANCE REPORT</h1>
  <p>License Plate: ${esc(data.license_plate)}</p>
</div>
<div class="section">
  <div class="sec-title">Product Information</div>
  <div class="data-box">
    <div class="data-grid">
      ${di('Return Order', data.return_order)}
      ${di('Sales Channel', data.sales_channel)}
      ${di('License Plate', data.license_plate)}
      ${di('SKU', data.sku)}
      ${di('Classification', data.classification)}
      ${di('Brand', data.brand)}
      ${di('Inches', data.inches)}
      ${di('Modelo', data.modelo)}
      ${di('Descripción', data.descripcion)}
      <div class="di"><label>Sale Price</label><span>${fmtPrice(data.sale_price)}</span></div>
    </div>
  </div>
</div>
${photosHtml}
<div class="section">
  <div class="sec-title">Processing Data</div>
  <div class="data-box">
    <div class="data-grid">
      <div class="di"><label>Plant Entry</label><span>${fmtTs(data.plant_entry)}</span></div>
      <div class="di"><label>Plant Exit</label><span>${fmtTs(data.plant_exit)}</span></div>
      <div class="di"><label>Total Time in Plant</label><span>${fmtMinsLong(data.total_time_minutes)}</span></div>
      ${di('Processed By', data.processed_by)}
      ${di('Outbound Order', data.outbound_order)}
      <div class="di"><label>Registration Date</label><span>${fmtDate(data.registration_date)}</span></div>
    </div>
  </div>
</div>
${probsHtml}
${accsHtml}
<div class="footer">
  <span>License Plate: ${esc(data.license_plate)}</span>
  <span>Outbound Order: ${esc(data.outbound_order)}</span>
  <span>Generated: ${today}</span>
</div>
<script>window.onload = () => { window.print(); };<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReDetailModal({
  isOpen,
  data,
  onClose,
  onEdit,
  onDeletePhoto,
  isDeletingPhoto = false,
}: ReDetailModalProps) {
  if (!isOpen) return null;

  const probs   = data.problem_descriptions ?? [];
  const actions = data.corrective_actions   ?? [];

  // Group corrective actions by dept for display
  const depts = actions.reduce((acc, ca) => {
    if (!acc.includes(ca.departamento)) acc.push(ca.departamento);
    return acc;
  }, [] as string[]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="re-detail-title"
      className="fixed inset-0 z-[800] flex items-start justify-center overflow-y-auto p-4"
      style={{ paddingTop: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} aria-hidden="true" />

      <div className="relative z-10 my-4 w-full" style={{ maxWidth: 780, background: '#fff', border: '1px solid #e2e2e2' }}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '16px 24px', borderBottom: '2px solid #0d2b4e' }}>
          <h2 id="re-detail-title" className="modal-titulo" style={{ margin: 0, border: 'none', paddingBottom: 0 }}>
            Rechazo Externo #{data.id}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#777', cursor: 'pointer', padding: '2px 6px' }}
          >
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>

          {/* All data fields — 2 column grid */}
          <div className="seccion-titulo">Datos del Rechazo</div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: 24 }}>
            <DetailField label="Return Order"     value={data.return_order} />
            <DetailField label="License Plate"    value={data.license_plate} />
            <DetailField label="Classification"   value={data.classification || '—'} />
            <DetailField label="Inches"           value={data.inches || '—'} />
            <DetailField label="Sales Channel"    value={data.sales_channel || '—'} />
            <DetailField label="SKU"              value={data.sku || '—'} />
            <DetailField label="Brand"            value={data.brand || '—'} />
            <DetailField label="Modelo"           value={data.modelo      || '—'} />
            <DetailField label="Outbound Order"   value={data.outbound_order || '—'} />
            <DetailField label="Descripción"      value={data.descripcion  || '—'} />
            <DetailField label="Plant Entry"      value={data.plant_entry ? formatDateTime(data.plant_entry) : '—'} />
            <DetailField label="Plant Exit"       value={data.plant_exit  ? formatDateTime(data.plant_exit)  : '—'} />
            <DetailField label="Total Time in Plant" value={formatTime(data.total_time_minutes)} />
            <DetailField label="Processed By"     value={data.processed_by || '—'} />
            <DetailField label="Registration Date" value={data.registration_date ? formatDate(data.registration_date) : '—'} />
            <DetailField label="Sale Price"       value={data.sale_price != null ? formatCurrency(data.sale_price) : '—'} />
            <DetailField label="Registrado por"   value={data.registrado_por || '—'} />
          </dl>

          {/* Evidencia Fotografica */}
          {data.images && data.images.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Evidencia Fotografica
                <span style={{ fontSize: 11, background: '#0d2b4e', color: '#fff', padding: '1px 8px', fontWeight: 700 }}>
                  {data.images.length}
                </span>
              </div>
              <PhotoGallery
                images={data.images}
                onDelete={onDeletePhoto}
                isDeleting={isDeletingPhoto}
              />
            </div>
          )}

          {/* Problem Description */}
          {probs.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">Problem Description</div>
              {probs.map((p, idx) => (
                <div key={idx} style={{ border: '1px solid #e2e2e2', padding: '10px 14px', marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 4 }}>
                    Problema {idx + 1}
                  </p>
                  <p style={{ fontSize: 13, color: '#111', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {p.descripcion || '—'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Corrective Actions */}
          {depts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="seccion-titulo">Corrective Actions</div>
              {depts.map((dept) => {
                const deptActions = actions.filter((a) => a.departamento === dept);
                return (
                  <div key={dept} style={{ border: '1px solid #0d2b4e', padding: '10px 14px', marginBottom: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e', marginBottom: 6 }}>
                      {dept}
                    </p>
                    {deptActions.map((a, i) => (
                      <p key={i} style={{ fontSize: 13, color: '#111', whiteSpace: 'pre-wrap', margin: i > 0 ? '8px 0 0' : 0 }}>
                        {deptActions.length > 1 && <span style={{ color: '#999', marginRight: 6 }}>{i + 1}.</span>}
                        {a.accion || '—'}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Audit footer */}
          <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
            Registrado por {data.registrado_por ?? '?'} el {formatDate(data.created_at)}
          </p>
        </div>

        {/* Footer buttons — match monolith: Editar | Generar PDF | + Crear CAPA | Cerrar */}
        <div className="flex items-center justify-between" style={{ padding: '14px 24px', borderTop: '1px solid #e2e2e2' }}>
          <div className="btn-grupo" style={{ marginTop: 0 }}>
            <button type="button" onClick={onEdit} className="btn btn-primario">
              Editar
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              onClick={() => generatePdf(data)}
            >
              &#128196; Generar PDF
            </button>
            <button
              type="button"
              className="btn btn-secundario"
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
              title="Próximamente"
            >
              + Crear CAPA
            </button>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secundario">
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
