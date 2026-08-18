/**
 * Métricas ML — Dashboard visual de reputación MercadoLibre
 * KPI cards, gráficas de consumo, radar por cuenta, tendencia de reclamos.
 */

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Line, Radar } from "react-chartjs-2";
import { API_BASE_URL } from "../config/api";
import { useConfirm } from "../context/ConfirmContext";
import { useNotify } from "../context/NotifyContext";
import { useAuth } from "../hooks/useAuth";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, RadarController, RadialLinearScale, Filler, Tooltip, Legend,
);

// ── Constantes ─────────────────────────────────────────────────────────────────

const CUENTAS = ["Apantallate", "Blow", "Lutema", "Autobot"] as const;
type Cuenta = (typeof CUENTAS)[number];

const LIMITES: Record<Cuenta, { reclamos: number; mediaciones: number; canceladas: number; demora: number }> = {
  Apantallate: { reclamos: 1.5, mediaciones: 0.5, canceladas: 1.0, demora: 10.0 },
  Blow:        { reclamos: 1.0, mediaciones: 0.5, canceladas: 0.5, demora: 8.0 },
  Lutema:      { reclamos: 1.5, mediaciones: 0.5, canceladas: 1.0, demora: 10.0 },
  Autobot:     { reclamos: 1.5, mediaciones: 0.5, canceladas: 1.0, demora: 10.0 },
};

const CUENTA_COLORS: Record<Cuenta, { solid: string; light: string; muted: string }> = {
  Apantallate: { solid: "#2563a8", light: "#dbeafe", muted: "rgba(37,99,168,0.15)" },
  Blow:        { solid: "#c2540a", light: "#fed7aa", muted: "rgba(194,84,10,0.15)" },
  Lutema:      { solid: "#7c3aed", light: "#ede9fe", muted: "rgba(124,58,237,0.15)" },
  Autobot:     { solid: "#0f766e", light: "#ccfbf1", muted: "rgba(15,118,110,0.15)" },
};

const METRICAS_KEYS = ["reclamos", "mediaciones", "canceladas", "demora"] as const;
type MetricaKey = (typeof METRICAS_KEYS)[number];

const METRICA_LABELS: Record<MetricaKey, string> = {
  reclamos: "Reclamos",
  mediaciones: "Mediaciones",
  canceladas: "Canceladas",
  demora: "Demora",
};

const NIVELES_DESEMPENO = ["7-7", "6-7", "5-7", "4-7", "3-7"];
const ESTATUS_OPTS = ["Verde", "Amarillo", "Rojo"];

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface MetricaML {
  id: number;
  cuenta: Cuenta;
  fecha: string;
  pct_reclamos: string;
  pct_mediaciones: string;
  pct_canceladas: string;
  pct_demora: string;
  nivel_desempeno: string;
  estatus: string;
  registrado_por: string;
  created_at: string;
}

interface DashboardRow {
  cuenta: Cuenta;
  total_registros: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  avg_reclamos: string;
  avg_mediaciones: string;
  avg_canceladas: string;
  avg_demora: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function consumoPct(valor: number, limite: number): number {
  if (limite === 0) return 0;
  return Math.min((valor / limite) * 100, 110);
}

interface SemColor { solid: string; light: string; label: string; border: string }
function semaforo(pct: number): SemColor {
  if (pct < 50)  return { solid: "#16a34a", light: "#dcfce7", label: "Verde",    border: "#16a34a" };
  if (pct < 75)  return { solid: "#d97706", light: "#fef3c7", label: "Amarillo", border: "#d97706" };
  return           { solid: "#dc2626", light: "#fee2e2", label: "Rojo",     border: "#dc2626" };
}

function fmt(v: number, dec = 2): string { return v.toFixed(dec) + "%"; }

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function getCuentaMetrics(row: DashboardRow) {
  const lim = LIMITES[row.cuenta];
  return {
    reclamos:    { val: parseFloat(row.avg_reclamos),    lim: lim.reclamos },
    mediaciones: { val: parseFloat(row.avg_mediaciones), lim: lim.mediaciones },
    canceladas:  { val: parseFloat(row.avg_canceladas),  lim: lim.canceladas },
    demora:      { val: parseFloat(row.avg_demora),      lim: lim.demora },
  };
}

function worstPct(row: DashboardRow): number {
  const m = getCuentaMetrics(row);
  return Math.max(...Object.values(m).map(({ val, lim }) => consumoPct(val, lim)));
}

// ── Componente: Progress Bar ───────────────────────────────────────────────────

function ProgressBar({ value, limit, label }: { value: number; limit: number; label: string }) {
  const pct = consumoPct(value, limit);
  const sem = semaforo(pct);
  const displayPct = Math.min(pct, 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#555" }}>{label}</span>
        <span style={{ fontSize: 11, color: sem.solid, fontWeight: 700 }}>
          {fmt(value)} <span style={{ color: "#bbb", fontWeight: 400 }}>/ {fmt(limit)}</span>
          <span style={{ marginLeft: 6, fontSize: 10 }}>({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div style={{ height: 7, background: "#f0f0f0", borderRadius: 6, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${displayPct}%`,
          background: `linear-gradient(90deg, ${sem.solid}cc, ${sem.solid})`,
          borderRadius: 6,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
    </div>
  );
}

// ── Componente: Account Health Card ───────────────────────────────────────────

function AccountHealthCard({ row }: { row: DashboardRow }) {
  const total = parseInt(row.total_registros, 10);
  const colors = CUENTA_COLORS[row.cuenta];
  const metrics = getCuentaMetrics(row);
  const worst = total > 0 ? worstPct(row) : 0;
  const sem = semaforo(worst);

  return (
    <div style={{
      background: "#fff",
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      borderTop: `4px solid ${colors.solid}`,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: colors.solid, margin: 0, letterSpacing: "-0.3px" }}>
              {row.cuenta}
            </h3>
            <p style={{ fontSize: 10, color: "#999", margin: "2px 0 0" }}>
              {total > 0 ? `${formatDate(row.fecha_inicio)} – ${formatDate(row.fecha_fin)}` : "Sin registros aún"}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            {total > 0 ? (
              <>
                <span style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: sem.light,
                  color: sem.solid,
                  border: `1px solid ${sem.border}20`,
                }}>
                  {sem.label}
                </span>
                <p style={{ fontSize: 10, color: "#bbb", margin: "3px 0 0", textAlign: "right" }}>
                  {total} registros
                </p>
              </>
            ) : (
              <span style={{ fontSize: 11, color: "#ccc", fontStyle: "italic" }}>vacío</span>
            )}
          </div>
        </div>

        {/* Peor consumo highlight */}
        {total > 0 && (
          <div style={{
            marginTop: 10,
            padding: "6px 10px",
            background: worst >= 75 ? sem.light : worst >= 50 ? "#fffbeb" : "#f0fdf4",
            borderRadius: 5,
            borderLeft: `3px solid ${sem.solid}`,
          }}>
            <span style={{ fontSize: 11, color: "#555" }}>
              Consumo máximo del límite:{" "}
              <strong style={{ color: sem.solid }}>{worst.toFixed(1)}%</strong>
            </span>
          </div>
        )}
      </div>

      {/* Barras de consumo */}
      <div style={{ padding: "12px 16px 8px", flex: 1 }}>
        {total === 0 ? (
          <p style={{ color: "#ccc", fontSize: 12, textAlign: "center", margin: "20px 0", fontStyle: "italic" }}>
            Agrega registros para ver métricas
          </p>
        ) : (
          METRICAS_KEYS.map((k) => (
            <ProgressBar
              key={k}
              label={METRICA_LABELS[k]}
              value={metrics[k].val}
              limit={metrics[k].lim}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Componente: Alert Strip ────────────────────────────────────────────────────

function AlertStrip({ dashboard }: { dashboard: DashboardRow[] }) {
  const alerts = dashboard
    .filter((r) => parseInt(r.total_registros) > 0 && worstPct(r) >= 50)
    .map((r) => {
      const worst = worstPct(r);
      const sem = semaforo(worst);
      return { cuenta: r.cuenta, peor: worst, sem };
    });

  if (alerts.length === 0) return null;

  return (
    <div style={{
      background: alerts.some((a) => a.peor >= 75) ? "#fef2f2" : "#fffbeb",
      border: `1px solid ${alerts.some((a) => a.peor >= 75) ? "#fca5a5" : "#fde68a"}`,
      borderRadius: 8,
      padding: "10px 16px",
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: alerts.some((a) => a.peor >= 75) ? "#dc2626" : "#d97706", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {alerts.some((a) => a.peor >= 75) ? "Alerta crítica" : "Atención requerida"}
      </span>
      <span style={{ fontSize: 13, fontWeight: 400, color: "#555" }}>—</span>
      {alerts.map((a) => (
        <span key={a.cuenta} style={{
          padding: "3px 10px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          background: a.sem.light,
          color: a.sem.solid,
        }}>
          {a.cuenta} — {a.peor.toFixed(0)}% del límite
        </span>
      ))}
    </div>
  );
}

// ── Componente: Radar Chart ────────────────────────────────────────────────────

function CuentasRadar({ dashboard }: { dashboard: DashboardRow[] }) {
  const cuentasConDatos = dashboard.filter((r) => parseInt(r.total_registros) > 0);
  if (cuentasConDatos.length === 0) return null;

  const radarData = {
    labels: ["Reclamos", "Mediaciones", "Canceladas", "Demora"],
    datasets: cuentasConDatos.map((row) => {
      const m = getCuentaMetrics(row);
      const c = CUENTA_COLORS[row.cuenta];
      return {
        label: row.cuenta,
        data: [
          consumoPct(m.reclamos.val,    m.reclamos.lim),
          consumoPct(m.mediaciones.val, m.mediaciones.lim),
          consumoPct(m.canceladas.val,  m.canceladas.lim),
          consumoPct(m.demora.val,      m.demora.lim),
        ],
        backgroundColor: `${c.solid}22`,
        borderColor: c.solid,
        borderWidth: 2,
        pointBackgroundColor: c.solid,
        pointRadius: 4,
      };
    }),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { stepSize: 25, font: { size: 9 }, color: "#999",
          backdropColor: "transparent",
          callback: (v: number | string) => `${v}%`,
        },
        grid: { color: "#e5e7eb" },
        pointLabels: { font: { size: 11, weight: "600" as const }, color: "#374151" },
        angleLines: { color: "#e5e7eb" },
      },
    },
    plugins: {
      legend: { position: "bottom" as const, labels: { boxWidth: 12, padding: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}% del límite`,
        },
      },
    },
  };

  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0d2b4e", marginBottom: 4, margin: "0 0 4px" }}>
        Radar — Consumo del límite por cuenta
      </h3>
      <p style={{ fontSize: 11, color: "#999", margin: "0 0 14px" }}>
        Valores en % del límite permitido · zona amarilla ≥50% · zona roja ≥75%
      </p>
      <Radar data={radarData} options={options} />
    </div>
  );
}

// ── Plugin inline: etiquetas de valor sobre cada barra horizontal ─────────────

const barDataLabelPlugin = {
  id: "barDataLabels",
  afterDatasetsDraw(chart: any) {
    const { ctx, chartArea } = chart;
    chart.data.datasets.forEach((_: any, i: number) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      meta.data.forEach((bar: any, j: number) => {
        const value = chart.data.datasets[i].data[j] as number;
        if (value == null || value === 0) return;
        const rightEdge = bar.x;          // extremo derecho de la barra
        const centerY = bar.y;            // centro vertical de la barra
        const text = `${value}%`;
        ctx.save();
        ctx.font = "bold 9px Inter, system-ui, sans-serif";
        ctx.textBaseline = "middle";
        const textW = ctx.measureText(text).width;
        const spaceInside = rightEdge - bar.base;   // ancho de la barra
        if (spaceInside > textW + 8) {
          // Suficiente espacio: pinta dentro, texto blanco
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.textAlign = "right";
          ctx.fillText(text, rightEdge - 5, centerY);
        } else {
          // Barra corta: pinta fuera, texto oscuro
          const labelX = Math.min(rightEdge + 4, chartArea.right - textW - 2);
          ctx.fillStyle = "#374151";
          ctx.textAlign = "left";
          ctx.fillText(text, labelX, centerY);
        }
        ctx.restore();
      });
    });
  },
};

// ── Componente: Bar Chart comparativo ─────────────────────────────────────────

function ConsumptionBarChart({ dashboard }: { dashboard: DashboardRow[] }) {
  const cuentasConDatos = dashboard.filter((r) => parseInt(r.total_registros) > 0);
  if (cuentasConDatos.length === 0) return null;

  const metricas: MetricaKey[] = ["reclamos", "mediaciones", "canceladas", "demora"];

  // Horizontal: Y = métricas, datasets = cuentas
  const barData = {
    labels: metricas.map((k) => METRICA_LABELS[k]),
    datasets: cuentasConDatos.map((row) => {
      const m = getCuentaMetrics(row);
      const c = CUENTA_COLORS[row.cuenta];
      return {
        label: row.cuenta,
        data: metricas.map((k) => parseFloat(consumoPct(m[k].val, m[k].lim).toFixed(1))),
        backgroundColor: c.solid + "cc",
        borderColor: c.solid,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false as const,
      };
    }),
  };

  // Eje X dinámico según datos reales
  const allVals = barData.datasets.flatMap((d) => d.data as number[]);
  const maxVal = Math.max(...allVals, 0);
  const xMax = Math.max(Math.ceil((maxVal + 18) / 10) * 10, 50);

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 4 } },
    plugins: {
      legend: { position: "bottom" as const, labels: { boxWidth: 10, padding: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw}% del límite`,
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: xMax,
        grid: { color: "#f1f5f9" },
        ticks: {
          stepSize: 25,
          callback: (v: number | string) => `${v}%`,
          font: { size: 10 },
        },
      },
      y: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#444" } },
    },
  };

  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", height: "100%" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0d2b4e", margin: "0 0 4px", flexShrink: 0 }}>
        Comparativo — % Consumo del límite por métrica
      </h3>
      <p style={{ fontSize: 11, color: "#999", margin: "0 0 14px", flexShrink: 0 }}>
        Verde &lt;50% · Amarillo 50–75% · Rojo ≥75%
      </p>

      {/* Gráfica horizontal — altura fija */}
      <div style={{ height: 450, flexShrink: 0 }}>
        <Bar data={barData} options={options} plugins={[barDataLabelPlugin]} />
      </div>

      {/* Heatmap — valores reales con color semáforo */}
      <div style={{ marginTop: 18, overflowX: "auto", flexShrink: 0 }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "3px 3px", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 6px", color: "#888", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Cuenta
              </th>
              {metricas.map((k) => (
                <th key={k} style={{ padding: "4px 6px", color: "#888", fontWeight: 600, fontSize: 10, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {METRICA_LABELS[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cuentasConDatos.map((row) => {
              const m = getCuentaMetrics(row);
              const cc = CUENTA_COLORS[row.cuenta];
              return (
                <tr key={row.cuenta}>
                  <td style={{ padding: "5px 8px", fontWeight: 700, color: cc.solid, fontSize: 12 }}>
                    {row.cuenta}
                  </td>
                  {metricas.map((k) => {
                    const pct = consumoPct(m[k].val, m[k].lim);
                    const sem = semaforo(pct);
                    return (
                      <td key={k} style={{
                        padding: "5px 10px",
                        textAlign: "center",
                        background: sem.light,
                        borderRadius: 5,
                      }}>
                        <div style={{ fontWeight: 700, color: sem.solid, fontSize: 12 }}>
                          {m[k].val.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: 9, color: sem.solid, opacity: 0.75 }}>
                          {pct.toFixed(0)}% lím.
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Componente: Tendencia de Reclamos ─────────────────────────────────────────

// Regresión lineal sobre un array de valores (nulls ignorados en el cálculo,
// pero se devuelve un valor interpolado para cada índice).
function linearRegression(values: (number | null)[]): number[] {
  const valid = values
    .map((v, i) => (v !== null ? { x: i, y: v } : null))
    .filter((p): p is { x: number; y: number } => p !== null);

  if (valid.length < 2) return values.map(() => 0);

  const n = valid.length;
  const sumX  = valid.reduce((s, p) => s + p.x, 0);
  const sumY  = valid.reduce((s, p) => s + p.y, 0);
  const sumXY = valid.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = valid.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return values.map((_, i) => parseFloat((intercept + slope * i).toFixed(3)));
}

function TendenciaChart({ registros }: { registros: MetricaML[] }) {
  const [cuentaFiltro, setCuentaFiltro] = useState<Cuenta | "">("");

  if (registros.length < 4) return null;

  // Índice por cuenta
  const byAccount: Partial<Record<Cuenta, Map<string, number>>> = {};
  for (const r of registros) {
    if (!byAccount[r.cuenta]) byAccount[r.cuenta] = new Map();
    byAccount[r.cuenta]!.set(r.fecha.slice(0, 10), parseFloat(r.pct_reclamos));
  }

  // Últimas 30 fechas únicas globales (de todas las cuentas)
  const todasFechas = [...new Set(registros.map((r) => r.fecha.slice(0, 10)))]
    .sort()
    .slice(-30);

  if (todasFechas.length < 2) return null;

  // ── Datasets según filtro ────────────────────────────────────────────────────

  const datasets: any[] = [];

  if (cuentaFiltro === "") {
    // Todas las cuentas: una línea por cuenta
    for (const cuenta of CUENTAS) {
      const mapa = byAccount[cuenta];
      if (!mapa || mapa.size === 0) continue;
      const c = CUENTA_COLORS[cuenta];
      datasets.push({
        label: cuenta,
        data: todasFechas.map((f) => mapa.get(f) ?? null),
        borderColor: c.solid,
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.3,
        spanGaps: true,
        order: 1,
      });
    }

    // Tendencia general: promedio por fecha entre todas las cuentas con dato
    const promediosPorFecha = todasFechas.map((f) => {
      const vals = CUENTAS
        .map((c) => byAccount[c]?.get(f))
        .filter((v): v is number => v !== undefined);
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    });

    const trendData = linearRegression(promediosPorFecha);
    datasets.push({
      label: "Tendencia general",
      data: trendData,
      borderColor: "#64748b",
      backgroundColor: "transparent",
      borderWidth: 2,
      borderDash: [7, 4],
      pointRadius: 0,
      tension: 0,
      spanGaps: true,
      order: 0,
    });
  } else {
    // Una sola cuenta: su línea real + su línea de tendencia
    const mapa = byAccount[cuentaFiltro] ?? new Map();
    const c = CUENTA_COLORS[cuentaFiltro];
    const valores = todasFechas.map((f) => mapa.get(f) ?? null);

    datasets.push({
      label: cuentaFiltro,
      data: valores,
      borderColor: c.solid,
      backgroundColor: c.muted,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.3,
      fill: false,
      spanGaps: true,
      order: 1,
    });

    const trendData = linearRegression(valores);
    datasets.push({
      label: `Tendencia — ${cuentaFiltro}`,
      data: trendData,
      borderColor: c.solid,
      backgroundColor: "transparent",
      borderWidth: 2,
      borderDash: [7, 4],
      pointRadius: 0,
      tension: 0,
      spanGaps: true,
      order: 0,
    });
  }

  const lineData = { labels: todasFechas.map(formatDate), datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { boxWidth: 12, padding: 12, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            `${ctx.dataset.label}: ${ctx.raw !== null ? ctx.raw.toFixed(2) + "%" : "—"}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 }, maxTicksLimit: 10 },
      },
      y: {
        min: 0,
        grid: { color: "#f1f5f9" },
        ticks: { callback: (v: number | string) => `${v}%`, font: { size: 10 } },
      },
    },
  };

  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      {/* Header con selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0d2b4e", margin: 0 }}>
            Tendencia — % Reclamos
          </h3>
          <p style={{ fontSize: 11, color: "#999", margin: "3px 0 0" }}>
            Últimos 30 períodos · línea punteada = tendencia
          </p>
        </div>

        {/* Selector de cuenta */}
        <div style={{ display: "flex", gap: 2, background: "#f1f5f9", padding: 3, borderRadius: 5, flexShrink: 0 }}>
          <button
            onClick={() => setCuentaFiltro("")}
            style={{
              padding: "4px 10px", fontSize: 11, border: "none", borderRadius: 3,
              fontFamily: "inherit", cursor: "pointer",
              background: cuentaFiltro === "" ? "#fff" : "transparent",
              color: cuentaFiltro === "" ? "#0d2b4e" : "#888",
              fontWeight: cuentaFiltro === "" ? 700 : 400,
              boxShadow: cuentaFiltro === "" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Todas
          </button>
          {CUENTAS.map((c) => (
            <button
              key={c}
              onClick={() => setCuentaFiltro(c)}
              style={{
                padding: "4px 10px", fontSize: 11, border: "none", borderRadius: 3,
                fontFamily: "inherit", cursor: "pointer",
                background: cuentaFiltro === c ? "#fff" : "transparent",
                color: cuentaFiltro === c ? CUENTA_COLORS[c].solid : "#888",
                fontWeight: cuentaFiltro === c ? 700 : 400,
                boxShadow: cuentaFiltro === c ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <Line data={lineData} options={options} />
    </div>
  );
}

// ── Componente: KPI Summary Strip ─────────────────────────────────────────────

function KpiStrip({ dashboard }: { dashboard: DashboardRow[] }) {
  const totalRegistros = dashboard.reduce((s, r) => s + parseInt(r.total_registros), 0);
  const cuentasActivas = dashboard.filter((r) => parseInt(r.total_registros) > 0).length;
  const enRojo = dashboard.filter((r) => parseInt(r.total_registros) > 0 && worstPct(r) >= 75).length;
  const enAmarillo = dashboard.filter((r) => parseInt(r.total_registros) > 0 && worstPct(r) >= 50 && worstPct(r) < 75).length;

  const kpis = [
    { label: "Registros totales", value: totalRegistros.toLocaleString(), color: "#2563a8", bg: "#f0f5ff" },
    { label: "Cuentas activas",   value: `${cuentasActivas} / 4`,         color: "#0f766e", bg: "#f0fdf9" },
    { label: "Zona amarilla",     value: enAmarillo,                       color: "#d97706", bg: "#fffbeb" },
    { label: "Zona roja",         value: enRojo,                           color: "#dc2626", bg: "#fef2f2" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
      {kpis.map((k) => (
        <div key={k.label} style={{
          background: "#fff",
          borderRadius: 6,
          padding: "16px 18px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          borderTop: `3px solid ${k.color}`,
        }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: 0, lineHeight: 1 }}>
            {k.value}
          </p>
          <p style={{ fontSize: 11, color: "#888", margin: "6px 0 0", fontWeight: 500 }}>{k.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Formulario vacío ───────────────────────────────────────────────────────────

const EMPTY_FORM = {
  cuenta: "Apantallate" as Cuenta,
  fecha: new Date().toISOString().slice(0, 10),
  pct_reclamos: "",
  pct_mediaciones: "",
  pct_canceladas: "",
  pct_demora: "",
  nivel_desempeno: "7-7",
  estatus: "Verde",
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function MetricasML() {
  const { user } = useAuth();
  const notify = useNotify();
  const confirm = useConfirm();

  const [tab, setTab] = useState<"dashboard" | "historial">("dashboard");
  const [dashboard, setDashboard] = useState<DashboardRow[]>([]);
  const [registros, setRegistros] = useState<MetricaML[]>([]);
  const [loadingDash, setLoadingDash] = useState(true);
  const [loadingReg, setLoadingReg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filtroCuenta, setFiltroCuenta] = useState("");
  const [showForm, setShowForm] = useState(false);

  const isAdmin = (user as any)?.rol === "Administrador";

  // Fetch dashboard aggregates
  const fetchDashboard = useCallback(async () => {
    setLoadingDash(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/metricas-ml/dashboard`, { credentials: "include" });
      if (!r.ok) throw new Error();
      const data: DashboardRow[] = await r.json();
      const map = new Map(data.map((d) => [d.cuenta, d]));
      setDashboard(CUENTAS.map((c) => map.get(c) ?? {
        cuenta: c, total_registros: "0", fecha_inicio: null, fecha_fin: null,
        avg_reclamos: "0", avg_mediaciones: "0", avg_canceladas: "0", avg_demora: "0",
      }));
    } catch {
      notify("Error al cargar el dashboard", "error");
    } finally {
      setLoadingDash(false);
    }
  }, [notify]);

  // Fetch all records (for trend chart + historial)
  const fetchRegistros = useCallback(async () => {
    setLoadingReg(true);
    try {
      const qs = filtroCuenta ? `?cuenta=${encodeURIComponent(filtroCuenta)}` : "";
      const r = await fetch(`${API_BASE_URL}/api/metricas-ml${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      setRegistros(await r.json());
    } catch {
      notify("Error al cargar registros", "error");
    } finally {
      setLoadingReg(false);
    }
  }, [filtroCuenta, notify]);

  // Always load all records for trend chart (sin filtro de cuenta)
  const fetchAllForTrend = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/metricas-ml`, { credentials: "include" });
      if (!r.ok) throw new Error();
      const all: MetricaML[] = await r.json();
      setRegistros(all);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { fetchDashboard(); fetchAllForTrend(); }, [fetchDashboard, fetchAllForTrend]);

  const registrosFiltrados = useMemo(() => {
    if (!filtroCuenta) return registros;
    return registros.filter((r) => r.cuenta === filtroCuenta);
  }, [registros, filtroCuenta]);

  // Submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/metricas-ml`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      notify("Registro guardado", "success");
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      fetchDashboard();
      fetchAllForTrend();
    } catch {
      notify("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  }, [form, notify, fetchDashboard, fetchAllForTrend]);

  // Delete
  const handleDelete = useCallback(async (id: number) => {
    const ok = await confirm("¿Eliminar este registro? Esta acción no se puede deshacer.");
    if (!ok) return;
    setDeleting(id);
    try {
      const r = await fetch(`${API_BASE_URL}/api/metricas-ml/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!r.ok) throw new Error();
      notify("Registro eliminado", "success");
      fetchDashboard();
      fetchAllForTrend();
    } catch {
      notify("Error al eliminar", "error");
    } finally {
      setDeleting(null);
    }
  }, [confirm, notify, fetchDashboard, fetchAllForTrend]);

  const setField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Tabs + botón */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 2, background: "#e8ecf0", padding: 3, borderRadius: 6 }}>
          {([["dashboard", "Dashboard"], ["historial", "Historial"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); if (key === "historial") fetchRegistros(); }}
              style={{
                padding: "6px 20px", fontSize: 13, fontWeight: tab === key ? 700 : 400,
                background: tab === key ? "#fff" : "transparent",
                color: tab === key ? "#0d2b4e" : "#666",
                border: "none", borderRadius: 4, cursor: "pointer",
                boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                transition: "all 0.15s", fontFamily: "inherit",
              }}
            >{label}</button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: "#0d2b4e", color: "#fff", border: "none",
            padding: "8px 18px", borderRadius: 6, fontSize: 13,
            fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 2px 6px rgba(13,43,78,0.3)",
          }}
        >
          + Nuevo registro
        </button>
      </div>

      {/* ── TAB: Dashboard ── */}
      {tab === "dashboard" && (
        <>
          {loadingDash ? (
            <div style={{ textAlign: "center", padding: 80, color: "#bbb", fontSize: 14 }}>
                Cargando métricas...
            </div>
          ) : (
            <>
              {/* Alertas */}
              <AlertStrip dashboard={dashboard} />

              {/* KPI strip */}
              <KpiStrip dashboard={dashboard} />

              {/* 4 Account Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
                {dashboard.map((row) => <AccountHealthCard key={row.cuenta} row={row} />)}
              </div>

              {/* Charts row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20, alignItems: "stretch" }}>
                <ConsumptionBarChart dashboard={dashboard} />
                <CuentasRadar dashboard={dashboard} />
              </div>

              {/* Tendencia si hay datos */}
              {registros.length >= 4 && (
                <div style={{ marginBottom: 20 }}>
                  <TendenciaChart registros={registros} />
                </div>
              )}

              {/* Nota semáforo */}
              <div style={{
                background: "#fff", borderRadius: 8, padding: "12px 16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                display: "flex", gap: 20, flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>Semáforo de consumo:</span>
                {[
                  { label: "Verde — Proceso estable", color: "#16a34a", light: "#dcfce7", rango: "< 50%" },
                  { label: "Amarillo — Requiere atención", color: "#d97706", light: "#fef3c7", rango: "50 – 74%" },
                  { label: "Rojo — Acción correctiva inmediata", color: "#dc2626", light: "#fee2e2", rango: "≥ 75%" },
                ].map((s) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: s.color, display: "inline-block", flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 11, color: "#555" }}>{s.label}</span>
                    <span style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 10,
                      background: s.light, color: s.color, fontWeight: 700,
                    }}>{s.rango} del límite</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── TAB: Historial ── */}
      {tab === "historial" && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <select
              value={filtroCuenta}
              onChange={(e) => setFiltroCuenta(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 4, border: "1px solid #ccc", fontSize: 13, fontFamily: "inherit" }}
            >
              <option value="">Todas las cuentas</option>
              {CUENTAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loadingReg ? (
            <div style={{ textAlign: "center", padding: 60, color: "#bbb" }}>Cargando...</div>
          ) : registrosFiltrados.length === 0 ? (
            <div style={{
              textAlign: "center", padding: 60, color: "#bbb", fontSize: 13,
              background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              No hay registros. Usa "+ Nuevo registro" para agregar el primero.
            </div>
          ) : (
            <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f4f6f9" }}>
                    {["Fecha", "Cuenta", "% Reclamos", "% Mediaciones", "% Canceladas", "% Demora", "Nivel", "Estatus ML", "Registrado por", ""].map((h) => (
                      <th key={h} style={{ padding: "9px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#555", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map((r) => {
                    const cColor = CUENTA_COLORS[r.cuenta];
                    const estColor = r.estatus === "Verde" ? "#16a34a" : r.estatus === "Amarillo" ? "#d97706" : "#dc2626";
                    const estBg   = r.estatus === "Verde" ? "#dcfce7" : r.estatus === "Amarillo" ? "#fef3c7" : "#fee2e2";
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ padding: "7px 10px", fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(r.fecha)}</td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: cColor.solid }}>{r.cuenta}</span>
                        </td>
                        <td style={{ padding: "7px 10px", fontSize: 12 }}>{parseFloat(r.pct_reclamos).toFixed(2)}%</td>
                        <td style={{ padding: "7px 10px", fontSize: 12 }}>{parseFloat(r.pct_mediaciones).toFixed(2)}%</td>
                        <td style={{ padding: "7px 10px", fontSize: 12 }}>{parseFloat(r.pct_canceladas).toFixed(2)}%</td>
                        <td style={{ padding: "7px 10px", fontSize: 12 }}>{parseFloat(r.pct_demora).toFixed(2)}%</td>
                        <td style={{ padding: "7px 10px", fontSize: 12 }}>{r.nivel_desempeno || "—"}</td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: estBg, color: estColor }}>{r.estatus}</span>
                        </td>
                        <td style={{ padding: "7px 10px", fontSize: 11, color: "#999" }}>{r.registrado_por}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right" }}>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={deleting === r.id}
                              style={{
                                background: "none", border: "1px solid #fca5a5", color: "#dc2626",
                                borderRadius: 4, padding: "2px 8px", fontSize: 11, cursor: "pointer",
                                opacity: deleting === r.id ? 0.5 : 1, fontFamily: "inherit",
                              }}
                            >
                              {deleting === r.id ? "..." : "Eliminar"}
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
        </div>
      )}

      {/* ── Modal: Nuevo registro ── */}
      {showForm && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 10, width: "100%", maxWidth: 580,
            boxShadow: "0 16px 48px rgba(0,0,0,0.2)", overflow: "hidden",
          }}>
            <div style={{ background: "#0d2b4e", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: 0 }}>Nuevo registro</h2>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: "2px 0 0" }}>Métricas de reputación MercadoLibre</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 22, lineHeight: 1 }}
              >×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>Cuenta *</label>
                  <select
                    value={form.cuenta}
                    onChange={(e) => setField("cuenta", e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 5, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit" }}
                  >
                    {CUENTAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>Fecha *</label>
                  <input
                    type="date" value={form.fecha}
                    onChange={(e) => setField("fecha", e.target.value)}
                    required
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 5, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* 4 campos de porcentaje */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {([
                  { field: "pct_reclamos",    label: "% Reclamos",    limite: LIMITES[form.cuenta].reclamos },
                  { field: "pct_mediaciones", label: "% Mediaciones", limite: LIMITES[form.cuenta].mediaciones },
                  { field: "pct_canceladas",  label: "% Canceladas",  limite: LIMITES[form.cuenta].canceladas },
                  { field: "pct_demora",      label: "% Demora",      limite: LIMITES[form.cuenta].demora },
                ] as const).map(({ field, label, limite }) => {
                  const raw = parseFloat((form as any)[field]);
                  const pct = !isNaN(raw) && raw > 0 ? consumoPct(raw, limite) : null;
                  const sem = pct !== null ? semaforo(pct) : null;
                  return (
                    <div key={field}>
                      <label style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                        <span>{label}</span>
                        <span style={{ fontWeight: 400, color: "#bbb" }}>límite {limite}%</span>
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="number" step="0.01" min="0" max="100"
                          value={(form as any)[field]}
                          onChange={(e) => setField(field, e.target.value)}
                          placeholder="0.00"
                          style={{
                            width: "100%", padding: "8px 44px 8px 10px",
                            borderRadius: 5, fontSize: 13, fontFamily: "inherit",
                            boxSizing: "border-box",
                            border: `1px solid ${sem ? sem.border : "#ddd"}`,
                            background: sem ? sem.light + "66" : "#fff",
                            transition: "border-color 0.2s, background 0.2s",
                          }}
                        />
                        {pct !== null && (
                          <span style={{
                            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                            fontSize: 10, fontWeight: 700,
                            color: sem?.solid,
                          }}>{pct.toFixed(0)}%</span>
                        )}
                      </div>
                      {/* mini progress */}
                      {pct !== null && (
                        <div style={{ height: 3, background: "#eee", borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: sem?.solid, borderRadius: 2 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>Nivel de desempeño</label>
                  <select
                    value={form.nivel_desempeno}
                    onChange={(e) => setField("nivel_desempeno", e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 5, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit" }}
                  >
                    {NIVELES_DESEMPENO.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>Estatus en ML</label>
                  <select
                    value={form.estatus}
                    onChange={(e) => setField("estatus", e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 5, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit" }}
                  >
                    {ESTATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button" onClick={() => setShowForm(false)}
                  style={{ padding: "9px 18px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                >Cancelar</button>
                <button
                  type="submit" disabled={saving}
                  style={{
                    padding: "9px 22px", borderRadius: 5, border: "none",
                    background: saving ? "#94a3b8" : "#0d2b4e", color: "#fff",
                    fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
                    boxShadow: saving ? "none" : "0 2px 6px rgba(13,43,78,0.3)",
                  }}
                >{saving ? "Guardando..." : "Guardar registro"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
