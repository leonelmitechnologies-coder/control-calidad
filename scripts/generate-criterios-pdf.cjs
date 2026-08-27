'use strict';
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = 'C:/Users/User/.claude/image-cache/52dd125a-65df-49d1-8192-8d6b56e525d6/11.png';
const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'Criterios-Clasificacion-TVs-MI.pdf');

const logoBuffer = fs.readFileSync(LOGO_PATH);
const logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1a1a2e;
    background: #fff;
    font-size: 11pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── PORTADA ── */
  .cover {
    background: #0d2d5e;
    width: 100%;
    height: 100vh;
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    color: #fff;
    text-align: center;
    padding: 40px;
  }
  .cover-logo {
    background: #fff;
    border-radius: 16px;
    padding: 20px 32px;
    margin-bottom: 40px;
  }
  .cover-logo img { height: 80px; }
  .cover-title {
    font-size: 28pt;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1.2;
    margin-bottom: 16px;
  }
  .cover-subtitle {
    font-size: 14pt;
    color: #aac8f0;
    margin-bottom: 32px;
  }
  .cover-badge {
    background: #1565a7;
    border-radius: 8px;
    padding: 10px 28px;
    font-size: 11pt;
    color: #cde4ff;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .cover-version {
    font-size: 9pt;
    color: #6699cc;
    margin-top: 48px;
  }

  /* ── CONTENIDO ── */
  .page {
    padding: 18mm 18mm 14mm 18mm;
    page-break-after: always;
  }
  .page-last { padding: 18mm 18mm 14mm 18mm; }

  /* ── ENCABEZADO DE SECCIÓN ── */
  .section-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    page-break-inside: avoid;
    page-break-after: avoid;
  }
  .grade-badge {
    background: #0d2d5e;
    color: #fff;
    font-size: 22pt;
    font-weight: 800;
    padding: 8px 20px;
    border-radius: 10px;
    min-width: 80px;
    text-align: center;
    letter-spacing: 1px;
    flex-shrink: 0;
  }
  .grade-badge.ic  { background: #1565a7; }
  .grade-badge.box { background: #1a1a2e; }
  .section-title-block {}
  .section-title-block h2 {
    font-size: 18pt;
    font-weight: 700;
    color: #0d2d5e;
    line-height: 1.1;
  }
  .section-title-block p {
    font-size: 10pt;
    color: #555;
    margin-top: 3px;
  }
  .section-divider {
    border: none;
    border-top: 3px solid #0d2d5e;
    margin-bottom: 18px;
  }

  /* ── CARDS ── */
  .cards-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .card {
    border: 1.5px solid #d0daea;
    border-radius: 8px;
    padding: 14px 16px;
    page-break-inside: avoid;
  }
  .card-full {
    border: 1.5px solid #d0daea;
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .card h3 {
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #0d2d5e;
    border-bottom: 2px solid #0d2d5e;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }
  .card ul, .card-full ul {
    list-style: none;
    padding: 0;
  }
  .card ul li, .card-full ul li {
    padding: 3px 0 3px 14px;
    position: relative;
    font-size: 10pt;
    line-height: 1.45;
  }
  .card ul li::before, .card-full ul li::before {
    content: '•';
    position: absolute;
    left: 0;
    color: #1565a7;
    font-weight: 700;
  }
  .card ul li.warn::before { color: #c0392b; content: '✗'; }
  .card ul li.ok::before   { color: #27ae60; content: '✓'; }

  /* ── TABLA COMPARATIVA ── */
  .comp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }
  .comp-table th {
    background: #0d2d5e;
    color: #fff;
    padding: 7px 8px;
    text-align: center;
    font-weight: 700;
    font-size: 9pt;
  }
  .comp-table td {
    padding: 6px 8px;
    border: 1px solid #d0daea;
    vertical-align: top;
    line-height: 1.35;
  }
  .comp-table tr:nth-child(even) td { background: #f4f7fb; }
  .comp-table td.grade-col {
    font-weight: 800;
    font-size: 10pt;
    text-align: center;
    color: #0d2d5e;
    background: #e8eef8;
    white-space: nowrap;
  }
  .check { color: #27ae60; font-weight: 700; }
  .cross { color: #c0392b; font-weight: 700; }

  /* ── TABLA DE GOLPES / PÍXELES ── */
  .spec-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-top: 6px;
    page-break-inside: avoid;
  }
  .spec-table th {
    background: #1565a7;
    color: #fff;
    padding: 6px 10px;
    text-align: center;
    font-size: 9pt;
  }
  .spec-table td {
    padding: 5px 10px;
    border: 1px solid #c5d5e8;
    text-align: center;
  }
  .spec-table tr:nth-child(even) td { background: #edf2f9; }

  /* ── REGLAS GLOBALES ── */
  .global-item {
    border-left: 4px solid #1565a7;
    background: #f4f8ff;
    border-radius: 0 6px 6px 0;
    padding: 10px 14px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .global-item h4 {
    font-size: 10pt;
    font-weight: 700;
    color: #0d2d5e;
    margin-bottom: 4px;
  }
  .global-item p, .global-item ul {
    font-size: 9.5pt;
    color: #2a2a4a;
  }
  .global-item ul { padding-left: 16px; }
  .global-item ul li { margin: 2px 0; }

  /* ── HEADER DE PÁGINA INTERNA ── */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 2px solid #0d2d5e;
    margin-bottom: 16px;
    page-break-inside: avoid;
    page-break-after: avoid;
  }
  .page-header img { height: 32px; }
  .page-header span {
    font-size: 8.5pt;
    color: #6688aa;
    text-align: right;
  }

  /* ── INFO BOX ── */
  .info-box {
    background: #e8f4fd;
    border: 1.5px solid #2d9cdb;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .info-box p { font-size: 10pt; }

  .warning-box {
    background: #fff5f5;
    border: 1.5px solid #e74c3c;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .warning-box p { font-size: 10pt; color: #7b1010; }

  .note { font-size: 8.5pt; color: #667; font-style: italic; margin-top: 6px; }

  /* ── TABLA DE CONTENIDOS ── */
  .toc-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px dotted #c5d5e8;
    page-break-inside: avoid;
  }
  .toc-item .toc-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11pt;
    font-weight: 500;
  }
  .toc-badge {
    background: #0d2d5e;
    color: #fff;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 9.5pt;
    font-weight: 700;
    min-width: 50px;
    text-align: center;
  }
  .toc-badge.ic  { background: #1565a7; }
  .toc-badge.box { background: #1a1a2e; }
  .toc-desc { color: #555; font-size: 10pt; }

  h1.page-title {
    font-size: 20pt;
    font-weight: 800;
    color: #0d2d5e;
    margin-bottom: 4px;
  }
  .subtitle-line {
    font-size: 10.5pt;
    color: #666;
    margin-bottom: 20px;
  }
  .bold { font-weight: 700; }
  .tag {
    display: inline-block;
    background: #0d2d5e;
    color: #fff;
    font-size: 8pt;
    padding: 1px 7px;
    border-radius: 3px;
    font-weight: 700;
  }
  .tag.ic  { background: #1565a7; }
  .tag.box { background: #1a1a2e; }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════
     PORTADA
═══════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-logo">
    <img src="${logoDataUrl}" alt="MI Technologies">
  </div>
  <div class="cover-title">Criterios de Clasificación<br>de Televisiones</div>
  <div class="cover-subtitle">Documento de Control de Calidad — Producto Terminado</div>
  <div class="cover-badge">Sistema de Clasificación por Grado: GRA → GRB → GRC → ICB → ICC → ICD → ICX → BOX</div>
  <div class="cover-badge" style="margin-top:10px;">MI Technologies — Planta Logística / Warehouse</div>
  <div class="cover-version">Revisión: Agosto 2026 · Uso Interno QC</div>
</div>

<!-- ═══════════════════════════════════════════════
     TABLA DE CONTENIDOS
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>Tabla de Contenidos</span>
  </div>

  <h1 class="page-title">Tabla de Contenidos</h1>
  <div class="subtitle-line">Clasificaciones de menor a mayor nivel de defectos permitidos</div>

  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge">GLOBAL</span><span>Reglas Generales — Aplica a Todas las Clasificaciones</span></div>
  </div>
  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge">TABLA</span><span>Comparativa Rápida — Resumen de Accesorios y Empaque</span></div>
  </div>
  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge">GRA</span><span class="toc-desc">Great A — Condición de producto nuevo</span></div>
  </div>
  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge">GRB</span><span class="toc-desc">Great B — Defectos estéticos mínimos no visibles a simple vista</span></div>
  </div>
  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge">GRC</span><span class="toc-desc">Great C — Defectos visibles a 1 metro de distancia</span></div>
  </div>
  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge ic">ICB</span><span class="toc-desc">Incomplete B — Igual que GRB, sin bases (con wallmount)</span></div>
  </div>
  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge ic">ICC</span><span class="toc-desc">Incomplete C — Igual que GRC, sin bases (con wallmount)</span></div>
  </div>
  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge ic">ICD</span><span class="toc-desc">Incomplete D — Sin bases ni wallmount; defectos visibles a 1+ metro</span></div>
  </div>
  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge ic">ICX</span><span class="toc-desc">Incomplete X — Sin bases ni wallmount; píxeles muertos permitidos</span></div>
  </div>
  <div class="toc-item">
    <div class="toc-label"><span class="toc-badge box">BOX</span><span class="toc-desc">Clasificación de empaque — Caja irreparable (calidad interna variable)</span></div>
  </div>

  <div style="margin-top:32px;">
    <div class="info-box">
      <p><span class="bold">Nota importante:</span> Las clasificaciones <span class="tag ic">IC</span> (Incomplete) corresponden a televisores sin bases/stands. La diferencia con su equivalente <span class="tag">GR</span> es únicamente la ausencia de bases y la sustitución por wallmount (en ICB e ICC) o sin accesorio de montaje (en ICD e ICX). Los criterios de TV, pantalla y audio son idénticos a la clasificación GR correspondiente.</p>
    </div>
    <div class="info-box">
      <p><span class="bold">Prueba eléctrica:</span> Se realiza en <strong>TODAS</strong> las clasificaciones sin excepción, previo al proceso de clasificación.</p>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════
     REGLAS GLOBALES
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>Reglas Globales</span>
  </div>

  <div class="section-header">
    <div class="grade-badge" style="font-size:12pt;padding:8px 12px;">GLOBAL</div>
    <div class="section-title-block">
      <h2>Reglas Generales</h2>
      <p>Aplican a <strong>TODAS</strong> las clasificaciones sin excepción — GRA, GRB, GRC, ICB, ICC, ICD, ICX y BOX</p>
    </div>
  </div>
  <hr class="section-divider">

  <div class="global-item">
    <h4>Etiquetas en caja — LPN Únicamente</h4>
    <p>Solo se permiten etiquetas <strong>LPN (License Plate Number)</strong> en la caja. Ninguna caja puede salir con etiquetas ajenas al proceso (precio, proveedor, distribución anterior, etc.).</p>
  </div>

  <div class="global-item">
    <h4>Cajas sin reparar — No permitido</h4>
    <p>No se permite enviar ninguna caja con daños sin reparar en ninguna clasificación. Excepción única: <strong>BOX</strong>, cuya definición es precisamente caja irreparable.</p>
  </div>

  <div class="global-item">
    <h4>Criterio de empaque B2B vs B2C</h4>
    <ul>
      <li><strong>B2B (TRG Consignment y similares):</strong> defectos en caja aceptables si son reparables; ✗ no humedad, no perforaciones, no roturas grandes.</li>
      <li><strong>B2C (ML, Amazon, FULL y otros):</strong> caja puede ir reparada; daños mínimos en zonas no visibles por el cliente final y que no comprometan el traslado.</li>
    </ul>
  </div>

  <div class="global-item">
    <h4>Cushion / Burbuja protectora</h4>
    <ul>
      <li>TVs <strong>menores de 50":</strong> puede ir con cushion (unicel) o burbuja protectora, con protección y acomodo adecuado.</li>
      <li>TVs <strong>de 50" en adelante:</strong> cushion (unicel) es <strong>forzoso</strong> — no se acepta burbuja como sustituto.</li>
      <li><strong>Cobertura mínima de burbuja:</strong> debe cubrir el TV completamente — frente (pantalla), reverso y esquinas. ✗ No se acepta burbuja en tira o banda parcial que no cubra todo el TV.</li>
    </ul>
  </div>

  <div class="global-item">
    <h4>Protección de pantalla — Obligatoria en todas las clasificaciones</h4>
    <ul>
      <li>Toda TV debe llevar <strong>bolsa protectora</strong> cubriendo el televisor.</li>
      <li>Debe incluir un <strong>cartón protector frente a la pantalla</strong> dentro de la caja para evitar daños por contacto durante el traslado.</li>
    </ul>
  </div>

  <div class="global-item">
    <h4>Limpieza antes de empacar</h4>
    <ul>
      <li>Pantalla: sin huellas, polvo ni residuos visibles.</li>
      <li>Chasis: sin residuos de cinta adhesiva, marcador ni polvo acumulado.</li>
      <li>Control remoto y accesorios: limpios antes de colocar en bolsa.</li>
    </ul>
  </div>

  <div class="global-item">
    <h4>Organización de accesorios dentro de la caja</h4>
    <ul>
      <li>Control remoto y bases/stands deben ir en bolsa de plástico — no sueltos.</li>
      <li>Cable de corriente: si viene integrado al televisor, se enrolla y asegura; si no viene integrado, se agrega al kit de accesorios.</li>
      <li>Ningún accesorio va suelto dentro de la caja (riesgo de rayar el TV durante traslado).</li>
    </ul>
  </div>

  <div class="global-item">
    <h4>Sellado de la caja</h4>
    <ul>
      <li>La caja se sella <strong>hasta que el producto sea liberado</strong> — no antes.</li>
      <li>Materiales aceptados: cinta transparente o cinta especial para cajas de cartón rugoso/no liso.</li>
      <li>El sellado debe cubrir ambas aberturas (superior e inferior).</li>
    </ul>
  </div>

  <div class="global-item">
    <h4>Orientación del TV dentro de la caja</h4>
    <ul>
      <li>El TV debe quedar <strong>centrado en el cushion o protección interna</strong>.</li>
      <li>La pantalla no debe tener contacto directo con el cartón de la caja en ningún punto.</li>
    </ul>
  </div>

  <div class="global-item">
    <h4>Reset de fábrica (Factory Reset) — OBLIGATORIO</h4>
    <ul>
      <li>Todo televisor debe ir con reset de fábrica realizado antes de empacar.</li>
      <li>Sin cuentas activas (Netflix, YouTube, Google u otras apps) del propietario anterior.</li>
      <li>Aplica a todas las clasificaciones sin excepción.</li>
    </ul>
  </div>

  <div class="global-item">
    <h4>Verificación de coincidencia LPN / Número de serie</h4>
    <p>La etiqueta LPN de la caja debe corresponder al televisor que está dentro. Verificar <strong>antes de sellar</strong> la caja.</p>
  </div>

  <div class="global-item">
    <h4>Pilas del control remoto</h4>
    <p>Opcionales — pueden o no incluirse. No es un requisito para ninguna clasificación.</p>
  </div>

  <div class="global-item">
    <h4>Wallmount — ICB e ICC únicamente</h4>
    <p>Debe ser <strong>nuevo</strong>, con su kit de accesorios completo y tornillería adecuada para instalación.</p>
  </div>
</div>

<!-- ═══════════════════════════════════════════════
     TABLA COMPARATIVA
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>Comparativa Rápida</span>
  </div>

  <h1 class="page-title">Comparativa Rápida</h1>
  <div class="subtitle-line">Resumen de accesorios, empaque y condiciones por clasificación</div>

  <table class="comp-table">
    <thead>
      <tr>
        <th>Grado</th>
        <th>Cable</th>
        <th>Control</th>
        <th>Bases</th>
        <th>Wallmount</th>
        <th>Píxeles muertos</th>
        <th>Backlight bleeding</th>
        <th>Audio</th>
        <th>Tipo de Caja</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="grade-col">GRA</td>
        <td>Original</td>
        <td>Original</td>
        <td><span class="check">✓</span> Original</td>
        <td><span class="cross">✗</span></td>
        <td>Cero</td>
        <td>No perceptible a 50 cm</td>
        <td>Perfecto</td>
        <td>Original N (nueva)</td>
      </tr>
      <tr>
        <td class="grade-col">GRB</td>
        <td>Original</td>
        <td>Original / genérico / misma marca</td>
        <td><span class="check">✓</span> Incluidas</td>
        <td><span class="cross">✗</span></td>
        <td>Cero</td>
        <td>No permitido</td>
        <td>Perfecto</td>
        <td>Original A o Genérica A</td>
      </tr>
      <tr>
        <td class="grade-col">GRC</td>
        <td>Original</td>
        <td>Original / genérico (funcional)</td>
        <td><span class="check">✓</span> Rayadas OK</td>
        <td><span class="cross">✗</span></td>
        <td>Cero</td>
        <td>No permitido</td>
        <td>Perfecto</td>
        <td>Original N, Original A o Genérica A</td>
      </tr>
      <tr>
        <td class="grade-col">ICB</td>
        <td>Original</td>
        <td>Original / genérico / misma marca</td>
        <td><span class="cross">✗</span> Sin stock</td>
        <td><span class="check">✓</span> Nuevo + kit</td>
        <td>Cero</td>
        <td>No permitido</td>
        <td>Perfecto</td>
        <td>Original A, Genérica A o Genérica B</td>
      </tr>
      <tr>
        <td class="grade-col">ICC</td>
        <td>Original</td>
        <td>Original / genérico (funcional)</td>
        <td><span class="cross">✗</span> Sin stock</td>
        <td><span class="check">✓</span> Nuevo + kit</td>
        <td>Cero</td>
        <td>No permitido</td>
        <td>Perfecto</td>
        <td>Original A, Genérica A o Genérica B</td>
      </tr>
      <tr>
        <td class="grade-col">ICD</td>
        <td>Procura GRB, mín. GRC</td>
        <td>Procura GRB, mín. GRC</td>
        <td><span class="cross">✗</span></td>
        <td><span class="cross">✗</span></td>
        <td>Cero</td>
        <td>Solo en oscuridad total</td>
        <td>Mínima distorsión a vol. alto</td>
        <td>Original B/C o Genérica B/C</td>
      </tr>
      <tr>
        <td class="grade-col">ICX</td>
        <td>Procura GRB, mín. GRC</td>
        <td>Procura GRB, mín. GRC</td>
        <td><span class="cross">✗</span></td>
        <td><span class="cross">✗</span></td>
        <td>Hasta 10 (ver tabla)</td>
        <td>Perceptible en uso normal</td>
        <td>Leve dist. a vol. alto</td>
        <td>Original B/C o Genérica B/C</td>
      </tr>
      <tr>
        <td class="grade-col">BOX</td>
        <td colspan="7" style="text-align:center;font-style:italic;color:#555;">Según calidad interna del TV (GRB a ICX) — la caja está irreparable</td>
        <td>Caja irreparable / sin partes</td>
      </tr>
    </tbody>
  </table>

  <p class="note" style="margin-top:10px;">* Todas las clasificaciones llevan: prueba eléctrica, factory reset, protección de pantalla (bolsa + cartón), limpieza, etiqueta LPN y cushion/burbuja según regla global.</p>
</div>

<!-- ═══════════════════════════════════════════════
     GRA
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>GRA — Great A</span>
  </div>

  <div class="section-header">
    <div class="grade-badge">GRA</div>
    <div class="section-title-block">
      <h2>Great A</h2>
      <p>Producto reacondicionado que cumple con las características de un producto nuevo. Máxima calidad.</p>
    </div>
  </div>
  <hr class="section-divider">

  <div class="cards-grid">
    <div class="card">
      <h3>TV — Condición Física</h3>
      <ul>
        <li>Cero rayones en cualquier superficie (marco, bisel, chasis trasero)</li>
        <li>Cero golpes o deformaciones</li>
        <li>Sin ninguna imperfección visible</li>
        <li class="bold">Evaluación: bajo luz uniforme a 30 cm</li>
      </ul>
    </div>
    <div class="card">
      <h3>Pantalla</h3>
      <ul>
        <li>Cero píxeles muertos o atascados — en ninguna zona</li>
        <li>Sin manchas, sombras ni irregularidades de color</li>
        <li>Sin marcas de presión</li>
        <li>Verificar en fondo negro sólido y fondo blanco sólido</li>
        <li class="warn">Backlight bleeding no perceptible a 50 cm en luz normal → no aprueba</li>
      </ul>
    </div>
    <div class="card">
      <h3>Audio</h3>
      <ul>
        <li>Perfecto — sin distorsión en ningún nivel de volumen</li>
      </ul>
    </div>
    <div class="card">
      <h3>Botones y Puertos</h3>
      <ul>
        <li>Todos presentes, sin daño físico, respuesta táctil normal</li>
        <li>Todos los puertos (HDMI, USB, AV, etc.) funcionales</li>
        <li>Sin doblez, daño, flojo ni faltante</li>
      </ul>
    </div>
  </div>

  <div class="card-full" style="margin-top:14px;">
    <h3>Accesorios — Todos Obligatorios, Todos Originales</h3>
    <ul>
      <li class="ok">Cable de corriente — <strong>original</strong></li>
      <li class="ok">Control remoto — <strong>DEBE SER ORIGINAL de fábrica</strong> (no se aceptan genéricos ni adaptados)</li>
      <li class="ok">Bases/stands — originales del modelo</li>
      <li class="warn">Soporte de pared — <strong>no incluye</strong></li>
    </ul>
  </div>

  <div class="card-full">
    <h3>Empaque</h3>
    <ul>
      <li class="ok">Tipo: <strong>Caja Original N</strong> (caja nueva de fabricante)</li>
      <li>Sin golpes, rayones, manchas ni imperfecciones</li>
      <li>Esquinas y cantos intactos, sin abolladuras ni humedad</li>
    </ul>
  </div>
</div>

<!-- ═══════════════════════════════════════════════
     GRB
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>GRB — Great B</span>
  </div>

  <div class="section-header">
    <div class="grade-badge">GRB</div>
    <div class="section-title-block">
      <h2>Great B</h2>
      <p>Producto semi-nuevo. Defectos estéticos mínimos, muy difíciles de detectar a simple vista.</p>
    </div>
  </div>
  <hr class="section-divider">

  <div class="cards-grid">
    <div class="card">
      <h3>TV — Condición Física</h3>
      <ul>
        <li>Sin golpes, fisuras ni deformaciones</li>
        <li>Micro-rayones o roce superficial — solo visible con luz directa a menos de 40 cm con atención enfocada</li>
        <li class="warn">Si el defecto se detecta a más de 40 cm o sin luz directa → <strong>baja a GRC</strong></li>
      </ul>
    </div>
    <div class="card">
      <h3>Pantalla</h3>
      <ul>
        <li>Cero píxeles muertos — sin tolerancia (igual que GRA)</li>
        <li>Sin manchas, sombras ni irregularidades</li>
        <li>Verificar en fondo negro y fondo blanco</li>
        <li class="warn">Backlight bleeding — no permitido</li>
      </ul>
    </div>
    <div class="card">
      <h3>Audio</h3>
      <ul>
        <li>Perfecto — sin distorsión en ningún nivel de volumen</li>
      </ul>
    </div>
    <div class="card">
      <h3>Botones y Puertos</h3>
      <ul>
        <li>Pueden tener rayones superficiales</li>
        <li>Funcionales al 100%</li>
        <li class="warn">No se permiten golpes ni fisuras</li>
      </ul>
    </div>
  </div>

  <div class="card-full" style="margin-top:14px;">
    <h3>Accesorios</h3>
    <ul>
      <li class="ok">Cable de corriente — original</li>
      <li class="ok">Control remoto — original, genérico o de la misma marca compatible</li>
      <li class="ok">Bases/stands — incluidas</li>
      <li class="warn">Soporte de pared — <strong>no incluye</strong></li>
    </ul>
  </div>

  <div class="card-full">
    <h3>Empaque</h3>
    <ul>
      <li class="ok">Tipo: <strong>Caja Original A</strong> o <strong>Genérica A</strong></li>
      <li><strong>B2B:</strong> defectos en caja aceptables si son reparables; ✗ no humedad, no perforaciones, no roturas grandes</li>
      <li><strong>B2C:</strong> puede ir reparada, daños mínimos en zonas no visibles por cliente final ni que comprometan traslado</li>
    </ul>
  </div>
</div>

<!-- ═══════════════════════════════════════════════
     GRC
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>GRC — Great C</span>
  </div>

  <div class="section-header">
    <div class="grade-badge">GRC</div>
    <div class="section-title-block">
      <h2>Great C</h2>
      <p>Defectos estéticos visibles al fijar la atención, detectables a 1 metro de distancia.</p>
    </div>
  </div>
  <hr class="section-divider">

  <div class="cards-grid">
    <div class="card">
      <h3>TV — Condición Física</h3>
      <ul>
        <li>Rayones más grandes en el chasis, visibles a 1 metro</li>
        <li>Pequeños golpecitos sin afectar funcionalidad</li>
        <li>Sin deformaciones que comprometan estructura</li>
      </ul>
    </div>
    <div class="card">
      <h3>Pantalla</h3>
      <ul>
        <li>Cero píxeles muertos — sin tolerancia</li>
        <li>Cero manchas o irregularidades de color</li>
        <li class="warn">Cero backlight bleeding / fugas de luz</li>
      </ul>
    </div>
    <div class="card">
      <h3>Audio</h3>
      <ul>
        <li>Perfecto — sin distorsión en ningún nivel de volumen</li>
      </ul>
    </div>
    <div class="card">
      <h3>Botones y Puertos</h3>
      <ul>
        <li>Funcionales aunque rayados</li>
        <li>Mismo criterio que GRB</li>
      </ul>
    </div>
  </div>

  <div class="card-full" style="margin-top:14px;">
    <h3>Tamaño Máximo de Golpes en Chasis — por Pulgadas</h3>
    <table class="spec-table">
      <thead>
        <tr>
          <th>Tamaño del TV</th>
          <th>Diámetro máximo del golpe</th>
          <th>Referencia de visibilidad</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>32" – 40"</td><td><strong>≤ 4 mm</strong></td><td>Visible al fijar la atención a 1 metro</td></tr>
        <tr><td>43" – 55"</td><td><strong>≤ 6 mm</strong></td><td>Visible al fijar la atención a 1 metro</td></tr>
        <tr><td>58" – 65"</td><td><strong>≤ 8 mm</strong></td><td>Visible al fijar la atención a 1 metro</td></tr>
        <tr><td>70" en adelante</td><td><strong>≤ 10 mm</strong></td><td>Visible al fijar la atención a 1 metro</td></tr>
      </tbody>
    </table>
  </div>

  <div class="card-full">
    <h3>Accesorios</h3>
    <ul>
      <li class="ok">Cable de corriente — original</li>
      <li class="ok">Control remoto — puede venir más rayado que GRB; todos los botones presentes y funcionales</li>
      <li class="ok">Bases/stands — pueden venir rayadas; sin fisuras a punto de tronar; con todas sus gomas de asentamiento</li>
      <li class="warn">Soporte de pared — <strong>no incluye</strong></li>
    </ul>
  </div>

  <div class="card-full">
    <h3>Empaque</h3>
    <ul>
      <li class="ok">Tipo: <strong>Caja Original N</strong>, <strong>Original A</strong> o <strong>Genérica A</strong></li>
      <li><strong>B2B:</strong> defectos en caja aceptables si son reparables; ✗ no humedad, no perforaciones, no roturas grandes</li>
      <li><strong>B2C:</strong> puede ir reparada, daños mínimos no visibles por cliente final ni que comprometan traslado</li>
    </ul>
  </div>
</div>

<!-- ═══════════════════════════════════════════════
     ICB
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>ICB — Incomplete B</span>
  </div>

  <div class="section-header">
    <div class="grade-badge ic">ICB</div>
    <div class="section-title-block">
      <h2>Incomplete B</h2>
      <p>Equivalente a GRB en todos los criterios de TV y pantalla, excepto que <strong>no tiene bases</strong> — se sustituyen con wallmount.</p>
    </div>
  </div>
  <hr class="section-divider">

  <div class="info-box">
    <p><strong>Principio ICB:</strong> Todo el criterio de calidad de televisor, pantalla, audio y botones es idéntico a GRB. La única diferencia es la ausencia de bases/stands y su sustitución por wallmount nuevo.</p>
  </div>

  <div class="cards-grid">
    <div class="card">
      <h3>TV — Condición Física</h3>
      <ul>
        <li>Sin golpes, fisuras ni deformaciones</li>
        <li>Micro-rayones solo visibles con luz directa a menos de 40 cm</li>
        <li class="warn">Si visible a más de 40 cm sin luz directa → no es ICB</li>
      </ul>
    </div>
    <div class="card">
      <h3>Pantalla</h3>
      <ul>
        <li>Cero píxeles muertos — sin tolerancia</li>
        <li>Sin manchas, sombras ni fugas de luz</li>
        <li class="warn">Backlight bleeding — no permitido</li>
      </ul>
    </div>
    <div class="card">
      <h3>Audio</h3>
      <ul>
        <li>Perfecto — sin distorsión en ningún nivel de volumen</li>
      </ul>
    </div>
    <div class="card">
      <h3>Botones y Puertos</h3>
      <ul>
        <li>Funcionales aunque rayados</li>
        <li>No se permiten golpes ni fisuras</li>
      </ul>
    </div>
  </div>

  <div class="card-full" style="margin-top:14px;">
    <h3>Accesorios</h3>
    <ul>
      <li class="ok">Cable de corriente — original</li>
      <li class="ok">Control remoto — original, genérico o misma marca compatible</li>
      <li class="warn">Bases/stands — <strong>no incluye</strong> (sin stock)</li>
      <li class="ok">Soporte de pared (Wallmount) — <strong>OBLIGATORIO, debe ser NUEVO</strong> con kit de accesorios completo y tornillería adecuada para instalación</li>
    </ul>
  </div>

  <div class="card-full">
    <h3>Empaque</h3>
    <ul>
      <li class="ok">Tipo: <strong>Original A</strong>, <strong>Genérica A</strong> o <strong>Genérica B</strong></li>
      <li><strong>B2B:</strong> reparada si tiene daños; ✗ no humedad, no perforaciones, no roturas grandes</li>
      <li><strong>B2C:</strong> reparada, daños mínimos no visibles por cliente final</li>
    </ul>
  </div>
</div>

<!-- ═══════════════════════════════════════════════
     ICC
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>ICC — Incomplete C</span>
  </div>

  <div class="section-header">
    <div class="grade-badge ic">ICC</div>
    <div class="section-title-block">
      <h2>Incomplete C</h2>
      <p>Equivalente a GRC en todos los criterios, excepto que <strong>no tiene bases</strong> — se sustituyen con wallmount.</p>
    </div>
  </div>
  <hr class="section-divider">

  <div class="info-box">
    <p><strong>Principio ICC:</strong> Todo el criterio de calidad de televisor, pantalla, audio y botones es idéntico a GRC — incluyendo la tabla de tamaños de golpes por pulgadas. La única diferencia es la ausencia de bases/stands y su sustitución por wallmount nuevo.</p>
  </div>

  <div class="cards-grid">
    <div class="card">
      <h3>TV — Condición Física</h3>
      <ul>
        <li>Rayones más grandes en chasis, visibles a 1 metro</li>
        <li>Golpecitos dentro del límite por pulgadas (ver tabla GRC)</li>
        <li>Sin deformaciones que comprometan estructura</li>
      </ul>
    </div>
    <div class="card">
      <h3>Pantalla</h3>
      <ul>
        <li>Cero píxeles muertos — sin tolerancia</li>
        <li>Cero manchas ni fugas de luz</li>
        <li class="warn">Backlight bleeding — no permitido</li>
      </ul>
    </div>
    <div class="card">
      <h3>Audio</h3>
      <ul>
        <li>Perfecto — sin distorsión en ningún nivel de volumen</li>
      </ul>
    </div>
    <div class="card">
      <h3>Botones y Puertos</h3>
      <ul>
        <li>Funcionales aunque rayados</li>
      </ul>
    </div>
  </div>

  <div class="card-full" style="margin-top:14px;">
    <h3>Tabla de Golpes — Igual que GRC</h3>
    <table class="spec-table">
      <thead>
        <tr><th>Tamaño del TV</th><th>Diámetro máximo</th></tr>
      </thead>
      <tbody>
        <tr><td>32" – 40"</td><td><strong>≤ 4 mm</strong></td></tr>
        <tr><td>43" – 55"</td><td><strong>≤ 6 mm</strong></td></tr>
        <tr><td>58" – 65"</td><td><strong>≤ 8 mm</strong></td></tr>
        <tr><td>70" en adelante</td><td><strong>≤ 10 mm</strong></td></tr>
      </tbody>
    </table>
  </div>

  <div class="card-full">
    <h3>Accesorios</h3>
    <ul>
      <li class="ok">Cable de corriente — original</li>
      <li class="ok">Control remoto — puede venir más rayado; todos los botones presentes y funcionales</li>
      <li class="warn">Bases/stands — <strong>no incluye</strong> (sin stock)</li>
      <li class="ok">Soporte de pared (Wallmount) — <strong>OBLIGATORIO, debe ser NUEVO</strong> con kit de accesorios completo y tornillería adecuada</li>
    </ul>
  </div>

  <div class="card-full">
    <h3>Empaque</h3>
    <ul>
      <li class="ok">Tipo: <strong>Original A</strong>, <strong>Genérica A</strong> o <strong>Genérica B</strong></li>
      <li><strong>B2B:</strong> reparada si tiene daños; ✗ no humedad, no perforaciones, no roturas grandes</li>
      <li><strong>B2C:</strong> reparada, daños mínimos no visibles por cliente final</li>
    </ul>
  </div>
</div>

<!-- ═══════════════════════════════════════════════
     ICD
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>ICD — Incomplete D</span>
  </div>

  <div class="section-header">
    <div class="grade-badge ic">ICD</div>
    <div class="section-title-block">
      <h2>Incomplete D</h2>
      <p>Sin bases y sin wallmount. Defectos más notorios que GRC, visibles a más de 1 metro. Solo incluye cable y control remoto.</p>
    </div>
  </div>
  <hr class="section-divider">

  <div class="cards-grid">
    <div class="card">
      <h3>TV — Condición Física</h3>
      <ul>
        <li>Golpes más notorios en chasis y bisel/marco de pantalla</li>
        <li>Defectos visibles a más de <strong>1 metro</strong> de distancia</li>
        <li>Sin deformaciones que comprometan funcionamiento</li>
      </ul>
    </div>
    <div class="card">
      <h3>Pantalla</h3>
      <ul>
        <li>Cero píxeles muertos — sin tolerancia</li>
        <li>Fugas de luz (backlight bleeding) <strong>permitidas</strong> — solo perceptibles en ambiente muy oscuro/controlado; en uso normal dentro de una casa no se perciben</li>
        <li>Sin manchas ni irregularidades de color</li>
      </ul>
    </div>
    <div class="card">
      <h3>Audio</h3>
      <ul>
        <li>Puede tener <strong>mínima distorsión</strong> — solo perceptible a volúmenes muy altos</li>
        <li>A volumen normal: perfecto</li>
      </ul>
    </div>
    <div class="card">
      <h3>Botones y Puertos</h3>
      <ul>
        <li>Funcionales aunque rayados</li>
      </ul>
    </div>
  </div>

  <div class="card-full" style="margin-top:14px;">
    <h3>Tamaño Máximo de Golpes en Chasis — por Pulgadas</h3>
    <table class="spec-table">
      <thead>
        <tr>
          <th>Tamaño del TV</th>
          <th>Diámetro máximo del golpe</th>
          <th>Referencia de visibilidad</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>32" – 40"</td><td><strong>≤ 7 mm</strong></td><td>Visible a más de 1 metro</td></tr>
        <tr><td>43" – 55"</td><td><strong>≤ 10 mm</strong></td><td>Visible a más de 1 metro</td></tr>
        <tr><td>58" – 65"</td><td><strong>≤ 13 mm</strong></td><td>Visible a más de 1 metro</td></tr>
        <tr><td>70" en adelante</td><td><strong>≤ 16 mm</strong></td><td>Visible a más de 1 metro</td></tr>
      </tbody>
    </table>
  </div>

  <div class="card-full">
    <h3>Accesorios</h3>
    <ul>
      <li class="ok">Cable de corriente — se procura calidad GRB; <strong>mínimo aceptable GRC</strong></li>
      <li class="ok">Control remoto — se procura calidad GRB; <strong>mínimo aceptable GRC</strong> (funcional, todos los botones, puede estar rayado)</li>
      <li class="warn">Bases/stands — <strong>no incluye</strong></li>
      <li class="warn">Soporte de pared — <strong>no incluye</strong></li>
    </ul>
  </div>

  <div class="card-full">
    <h3>Empaque</h3>
    <ul>
      <li class="ok">Tipo: <strong>Original B</strong>, <strong>Original C</strong>, <strong>Genérica B</strong> o <strong>Genérica C</strong></li>
      <li><strong>B2B:</strong> reparada si tiene daños; ✗ no humedad, no perforaciones, no roturas grandes</li>
      <li><strong>B2C:</strong> reparada, daños mínimos no visibles por cliente final</li>
    </ul>
  </div>
</div>

<!-- ═══════════════════════════════════════════════
     ICX
═══════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>ICX — Incomplete X</span>
  </div>

  <div class="section-header">
    <div class="grade-badge ic">ICX</div>
    <div class="section-title-block">
      <h2>Incomplete X</h2>
      <p>Defectos funcionales menores aceptados. Píxeles muertos permitidos (distribuidos). Solo cable y control remoto.</p>
    </div>
  </div>
  <hr class="section-divider">

  <div class="cards-grid">
    <div class="card">
      <h3>TV — Condición Física</h3>
      <ul>
        <li>Golpes más grandes que ICD, visibles a <strong>3 metros</strong> de distancia</li>
        <li>Rayones en chasis y bisel visibles a 3 metros</li>
      </ul>
    </div>
    <div class="card">
      <h3>Pantalla</h3>
      <ul>
        <li>Píxeles muertos <strong>permitidos</strong> — distribuidos (no concentrados)</li>
        <li>Ningún píxel muerto en el <strong>centro de la pantalla</strong></li>
        <li>Fugas de luz más notorias — perceptibles en uso normal, pero pantalla funcional</li>
        <li>Sin manchas que impidan uso</li>
      </ul>
    </div>
    <div class="card">
      <h3>Audio</h3>
      <ul>
        <li>Distorsión leve — solo perceptible a volúmenes altos</li>
        <li>A volumen normal: funcional sin problemas</li>
      </ul>
    </div>
    <div class="card">
      <h3>Botones y Puertos</h3>
      <ul>
        <li>Botonera puede tener daños físicos</li>
        <li>Mínimo requerido: <strong>botón de encendido operativo</strong></li>
        <li class="ok">Puertos HDMI y USB: <strong>deben ser funcionales</strong></li>
        <li>Demás puertos (AV, óptico, etc.): no es requisito</li>
      </ul>
    </div>
  </div>

  <div class="card-full" style="margin-top:14px;">
    <h3>Límite de Píxeles Muertos — por Pulgadas</h3>
    <table class="spec-table">
      <thead>
        <tr>
          <th>Tamaño del TV</th>
          <th>Máximo de píxeles muertos</th>
          <th>Restricción adicional</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>32" – 42"</td><td><strong>Máx. 3 píxeles</strong></td><td>Ninguno en el centro de la pantalla</td></tr>
        <tr><td>43" – 55"</td><td><strong>Máx. 5 píxeles</strong></td><td>Ninguno en el centro de la pantalla</td></tr>
        <tr><td>58" – 65"</td><td><strong>Máx. 7 píxeles</strong></td><td>Ninguno en el centro de la pantalla</td></tr>
        <tr><td>70" en adelante</td><td><strong>Máx. 10 píxeles</strong></td><td>Ninguno en el centro de la pantalla</td></tr>
      </tbody>
    </table>
    <p class="note">Los píxeles muertos deben estar distribuidos por la pantalla, no concentrados en una zona. En uso cotidiano normal no deben ser evidentes a primera vista.</p>
  </div>

  <div class="card-full">
    <h3>Tamaño Máximo de Golpes en Chasis — por Pulgadas</h3>
    <table class="spec-table">
      <thead>
        <tr><th>Tamaño del TV</th><th>Diámetro máximo</th><th>Visibilidad</th></tr>
      </thead>
      <tbody>
        <tr><td>32" – 40"</td><td><strong>≤ 12 mm</strong></td><td>Visible a 3 metros</td></tr>
        <tr><td>43" – 55"</td><td><strong>≤ 18 mm</strong></td><td>Visible a 3 metros</td></tr>
        <tr><td>58" – 65"</td><td><strong>≤ 22 mm</strong></td><td>Visible a 3 metros</td></tr>
        <tr><td>70" en adelante</td><td><strong>≤ 28 mm</strong></td><td>Visible a 3 metros</td></tr>
      </tbody>
    </table>
  </div>

  <div class="card-full">
    <h3>Accesorios</h3>
    <ul>
      <li class="ok">Cable de corriente — estética mínimo GRC, preferible GRB</li>
      <li class="ok">Control remoto — estética mínimo GRC, preferible GRB; <strong>todos los botones presentes y funcionales</strong></li>
      <li class="warn">Bases/stands — <strong>no incluye</strong></li>
      <li class="warn">Soporte de pared — <strong>no incluye</strong></li>
    </ul>
  </div>

  <div class="card-full">
    <h3>Empaque</h3>
    <ul>
      <li class="ok">Tipo: <strong>Original B</strong>, <strong>Original C</strong>, <strong>Genérica B</strong> o <strong>Genérica C</strong></li>
      <li><strong>B2B:</strong> reparada si tiene daños; ✗ no humedad, no perforaciones, no roturas grandes</li>
      <li><strong>B2C:</strong> reparada, daños mínimos no visibles por cliente final</li>
    </ul>
  </div>
</div>

<!-- ═══════════════════════════════════════════════
     BOX
═══════════════════════════════════════════════ -->
<div class="page-last">
  <div class="page-header">
    <img src="${logoDataUrl}" alt="MI Technologies">
    <span>Criterios de Clasificación de TVs<br>BOX — Clasificación de Empaque</span>
  </div>

  <div class="section-header">
    <div class="grade-badge box">BOX</div>
    <div class="section-title-block">
      <h2>BOX — Clasificación de Empaque</h2>
      <p>No es un nivel fijo de calidad — es una clasificación de <strong>empaque</strong>.</p>
    </div>
  </div>
  <hr class="section-divider">

  <div class="warning-box">
    <p><strong>BOX ≠ Grado de calidad.</strong> Un TV puede ser BOX independientemente de si su calidad estética es GRB, GRC, ICD o ICX. Lo que define el BOX es únicamente el estado irreparable de la caja.</p>
  </div>

  <div class="card-full">
    <h3>¿Qué convierte un TV en BOX?</h3>
    <ul>
      <li>Su caja está <strong>totalmente dañada, sin posibilidad de reparación</strong></li>
      <li>La caja puede tener partes faltantes</li>
      <li class="warn">No hay stock de cajas de reemplazo disponibles</li>
    </ul>
  </div>

  <div class="card-full">
    <h3>TV y Accesorios</h3>
    <ul>
      <li>Rango aceptable: desde calidad <strong>GRB hasta ICX</strong></li>
      <li>El TV y sus accesorios se evalúan con los criterios del grado que le corresponda (GRB, GRC, ICD, ICX, etc.)</li>
      <li class="ok">Se debe documentar el grado real del TV dentro de la clasificación BOX — ejemplo: <strong>"BOX / calidad GRC"</strong></li>
    </ul>
  </div>

  <div class="card-full">
    <h3>Empaque</h3>
    <ul>
      <li>Caja con daños severos o partes faltantes — <strong>sin reparación posible</strong></li>
      <li class="warn">No se puede etiquetar como otro grado si la caja no cumple el estándar de ese grado</li>
      <li class="ok">Cushion/burbuja obligatorio según regla global — la protección del TV sigue vigente aunque la caja esté dañada</li>
      <li class="ok">Solo etiquetas LPN</li>
    </ul>
  </div>

  <div style="margin-top:30px;border-top:2px solid #0d2d5e;padding-top:18px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <img src="${logoDataUrl}" alt="MI Technologies" style="height:36px;opacity:0.7;">
      <div style="text-align:right;font-size:8.5pt;color:#888;">
        <div>MI Technologies — Control de Calidad</div>
        <div>Documento de uso interno · Agosto 2026</div>
        <div>ISO 9001:2015 — Control de Producto Terminado</div>
      </div>
    </div>
  </div>
</div>

</body>
</html>`;

async function main() {
  console.log('Iniciando generación de PDF...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: OUTPUT_PATH,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    console.log('PDF generado exitosamente:');
    console.log(OUTPUT_PATH);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
