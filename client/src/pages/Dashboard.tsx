/**
 * Dashboard Page — Phase 2B Module 1
 *
 * Displays KPI cards + 4 charts for the Quality Control system.
 * Data is fetched from GET /api/dashboard?periodo=mes&anio=&mes=
 * Period is always the current month (no selector, matches monolith behaviour).
 */

import { useQuery } from "@tanstack/react-query";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { useEffect } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import ChartContainer from "../components/dashboard/ChartContainer";
import { useNotify } from "../context/NotifyContext";
import { apiGet } from "../utils/api-client";

// ── Register Chart.js modules once ──────────────────────────────────────────

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandRow {
  brand: string;
  total: number;
  cnt: number;
}
interface ClasifRow {
  classification: string;
  cnt: number;
}
interface SevRow {
  severidad: string;
  cnt: number;
}
interface AreaRow {
  area: string;
  cnt: number;
}

interface DashboardData {
  sale_price_total: number;
  copq_interno_total: number;
  total_rejects_cost: number;
  rechazos_total: number;
  rechazos_internos_total: number;
  nc_abiertas: number;
  colaboradores_activos: number;
  sale_price_por_marca: BrandRow[];
  rechazos_por_clasif: ClasifRow[];
  nc_por_severidad: SevRow[];
  nc_por_area: AreaRow[];
}

// ── Colour palette (monolith exact values) ───────────────────────────────────

const SEV_COLOURS: Record<string, string> = {
  Alta: "#c0392b",
  Media: "#8a6a00",
  Baja: "#1a6b3c",
  default: "#6b7280",
};

// ── Currency formatter (matches monolith) ────────────────────────────────────

function fmtMXN(v: number | string | null | undefined): string {
  return (
    "$" +
    parseFloat(String(v ?? 0)).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// ── Chart options ─────────────────────────────────────────────────────────────

// Chart 1 — Horizontal bar: Sale Price por Marca
const CHART_OPTIONS_BAR_MARCA = {
  responsive: true,
  maintainAspectRatio: true,
  indexAxis: "y" as const,
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: {
      grid: { color: "#f1f5f9" },
      ticks: {
        callback: (v: number | string) =>
          "$" +
          parseFloat(String(v)).toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
    },
    y: { grid: { display: false } },
  },
} as const;

// Chart 2 — Horizontal bar: Rechazos por Clasificación
const CHART_OPTIONS_BAR_CLASIF = {
  responsive: true,
  maintainAspectRatio: true,
  indexAxis: "y" as const,
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: { grid: { color: "#f1f5f9" } },
    y: { grid: { display: false } },
  },
} as const;

// Chart 3 — Doughnut: NCs por Severidad
const CHART_OPTIONS_DONUT = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: "60%",
  plugins: {
    legend: { position: "bottom" as const, labels: { boxWidth: 12, padding: 12 } },
  },
} as const;

// Chart 4 — Horizontal bar: NCs por Área (indexAxis y, uniform colour)
const CHART_OPTIONS_BAR_AREA = {
  responsive: true,
  maintainAspectRatio: true,
  indexAxis: "y" as const,
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: { grid: { color: "#f1f5f9" } },
    y: { grid: { display: false } },
  },
} as const;

// ── Chart data builders ───────────────────────────────────────────────────────

function buildBarMarca(rows: BrandRow[]) {
  return {
    labels: rows.map((r) => r.brand),
    datasets: [
      {
        data: rows.map((r) => r.total),
        backgroundColor: "#2563a8",
        borderRadius: 4,
        borderSkipped: false as const,
      },
    ],
  };
}

function buildBarClasif(rows: ClasifRow[]) {
  return {
    labels: rows.map((r) => r.classification),
    datasets: [
      {
        data: rows.map((r) => r.cnt),
        backgroundColor: "#0d2b4e",
        borderRadius: 4,
        borderSkipped: false as const,
      },
    ],
  };
}

function buildDonutSeveridad(rows: SevRow[]) {
  return {
    labels: rows.map((r) => r.severidad),
    datasets: [
      {
        data: rows.map((r) => r.cnt),
        backgroundColor: rows.map((r) => SEV_COLOURS[r.severidad] ?? SEV_COLOURS.default),
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };
}

function buildBarArea(rows: AreaRow[]) {
  return {
    labels: rows.map((r) => r.area ?? "Sin área"),
    datasets: [
      {
        data: rows.map((r) => r.cnt),
        backgroundColor: "#2563a8",
        borderRadius: 4,
        borderSkipped: false as const,
      },
    ],
  };
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2 bg-gray-100 h-28" />
        <div className="bg-gray-100 h-28" />
        <div className="bg-gray-100 h-28" />
      </div>
      {/* Chart skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-100 h-64" />
        ))}
      </div>
    </div>
  );
}

// ── Empty chart placeholder ───────────────────────────────────────────────────

function EmptyChart() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
      {t("dashboard.no_data")}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation();
  const notify = useNotify();

  // Always use current month — no selector, matches monolith
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const queryParams = {
    periodo: "mes",
    anio: currentYear,
    mes: currentMonth,
  };

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["dashboard", "mes", currentYear, currentMonth],
    queryFn: () => apiGet<DashboardData>("/api/dashboard", queryParams),
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    if (isError) {
      notify(t("common.error"), "error");
    }
  }, [isError, notify, t]);

  // ── Render guards ───────────────────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !data) {
    return (
      <div
        style={{
          background: "#fff5f5",
          border: "1px solid #fca5a5",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#b91c1c", fontWeight: 600 }}>{t("common.error")}</p>
        <p style={{ color: "#ef4444", fontSize: "0.875rem", marginTop: "4px" }}>
          {t("dashboard.error_loading")}
        </p>
      </div>
    );
  }

  // ── Chart data ──────────────────────────────────────────────────────────────

  const chartMarca = buildBarMarca(data.sale_price_por_marca ?? []);
  const chartClasif = buildBarClasif(data.rechazos_por_clasif ?? []);
  const chartSeveridad = buildDonutSeveridad(data.nc_por_severidad ?? []);
  const chartArea = buildBarArea(data.nc_por_area ?? []);

  const totalNcSeveridad = (data.nc_por_severidad ?? []).reduce((sum, r) => sum + (r.cnt ?? 0), 0);

  // ── KPI styles ──────────────────────────────────────────────────────────────

  const kpiBase: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e2e2e2",
    padding: "20px 22px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#6b7280",
  };

  const bigNumStyle: React.CSSProperties = {
    fontSize: "2rem",
    fontWeight: 700,
    lineHeight: 1.1,
    color: "#111827",
  };

  const subTextStyle: React.CSSProperties = {
    fontSize: "0.8rem",
    color: "#6b7280",
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t("dashboard.title")}</h1>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1 — Rejects Cost Summary (col-span-2) */}
        <div className="col-span-2" style={{ ...kpiBase, borderLeft: "4px solid #c0392b" }}>
          <span style={labelStyle}>Rejects Cost Summary</span>

          {/* Row 1: External Rejects */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: "0.875rem", color: "#374151" }}>
              External Rejects Prices{" "}
              <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                ({data.rechazos_total ?? 0} registros)
              </span>
            </span>
            <span style={{ fontWeight: 700, color: "#1a6b3c", fontVariantNumeric: "tabular-nums" }}>
              {fmtMXN(data.sale_price_total)}
            </span>
          </div>

          {/* Row 2: Internal Rejects */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: "0.875rem", color: "#374151" }}>
              Internal Reject Prices{" "}
              <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                ({data.rechazos_internos_total ?? 0} registros)
              </span>
            </span>
            <span style={{ fontWeight: 700, color: "#8a6a00", fontVariantNumeric: "tabular-nums" }}>
              {fmtMXN(data.copq_interno_total)}
            </span>
          </div>

          {/* Separator + Total */}
          <div
            style={{
              borderTop: "1px solid #e2e2e2",
              paddingTop: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
              Total Rejects Cost
            </span>
            <span
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#111827",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmtMXN(data.total_rejects_cost)}
            </span>
          </div>
        </div>

        {/* Card 2 — NCs Abiertas */}
        <div
          style={{
            ...kpiBase,
            borderLeft: data.nc_abiertas > 0 ? "4px solid #c0392b" : "1px solid #e2e2e2",
          }}
        >
          <span style={labelStyle}>{t("dashboard.kpis.nc_abiertas")}</span>
          <span style={bigNumStyle}>{data.nc_abiertas ?? 0}</span>
          <span style={subTextStyle}>No conformidades sin cerrar</span>
        </div>

        {/* Card 3 — Colaboradores Activos */}
        <div style={kpiBase}>
          <span style={labelStyle}>{t("dashboard.kpis.colaboradores")}</span>
          <span style={bigNumStyle}>{data.colaboradores_activos ?? 0}</span>
          <span style={subTextStyle}>En el departamento QC</span>
        </div>
      </div>

      {/* ── Charts grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 1 — Horizontal Bar: Sale Price por Marca */}
        <ChartContainer title={t("dashboard.charts.rechazos_marca")}>
          {chartMarca.labels.length === 0 ? (
            <EmptyChart />
          ) : (
            <Bar data={chartMarca} options={CHART_OPTIONS_BAR_MARCA} />
          )}
        </ChartContainer>

        {/* Chart 2 — Horizontal Bar: Rechazos por Clasificación */}
        <ChartContainer title={t("dashboard.charts.rechazos_clasif")}>
          {chartClasif.labels.length === 0 ? (
            <EmptyChart />
          ) : (
            <Bar data={chartClasif} options={CHART_OPTIONS_BAR_CLASIF} />
          )}
        </ChartContainer>

        {/* Chart 3 — Doughnut: NCs por Severidad */}
        <ChartContainer title={t("dashboard.charts.nc_severidad")}>
          {chartSeveridad.labels.length === 0 ? (
            <EmptyChart />
          ) : (
            <div style={{ position: "relative" }}>
              <Doughnut data={chartSeveridad} options={CHART_OPTIONS_DONUT} />
              {/* Centre label */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  top: "20%",
                }}
              >
                <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1f2937" }}>
                  {totalNcSeveridad}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>NCs</span>
              </div>
            </div>
          )}
        </ChartContainer>

        {/* Chart 4 — Horizontal Bar: NCs por Área (uniform colour) */}
        <ChartContainer title={t("dashboard.charts.nc_area")}>
          {chartArea.labels.length === 0 ? (
            <EmptyChart />
          ) : (
            <Bar data={chartArea} options={CHART_OPTIONS_BAR_AREA} />
          )}
        </ChartContainer>
      </div>
    </div>
  );
}
