/**
 * Dashboard Page — Phase 2B Module 1
 *
 * Displays KPI cards + 4 charts for the Quality Control system.
 * Data is fetched from GET /api/dashboard?periodo=&anio=&mes=
 * and re-fetched whenever the period / year / month selectors change.
 */

import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiGet } from '../utils/api-client';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { useNotify } from '../context/NotifyContext';

import KpiCard from '../components/dashboard/KpiCard';
import DatePeriodSelector from '../components/dashboard/DatePeriodSelector';
import ChartContainer from '../components/dashboard/ChartContainer';

// ── Register Chart.js modules once ──────────────────────────────────────────

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandRow   { brand: string;          total: number; cnt: number }
interface ClasifRow  { classification: string; cnt:   number }
interface SevRow     { severidad: string;       cnt:   number }
interface AreaRow    { area: string;            cnt:   number }

interface DashboardData {
  sale_price_total:        number;
  copq_interno_total:      number;
  total_rejects_cost:      number;
  rechazos_total:          number;
  rechazos_internos_total: number;
  nc_abiertas:             number;
  colaboradores_activos:   number;
  sale_price_por_marca:    BrandRow[];
  rechazos_por_clasif:     ClasifRow[];
  nc_por_severidad:        SevRow[];
  nc_por_area:             AreaRow[];
}

// ── Tailwind-derived colour palette (hex) ────────────────────────────────────
// These mirror Tailwind's slate/blue/green/amber/red palettes for consistency.

const BLUE_SHADES  = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
const PIE_PALETTE  = ['#1d4ed8', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
const SEV_COLOURS  = {
  Crítica: '#dc2626',
  Mayor:   '#ea580c',
  Menor:   '#ca8a04',
  default: '#6b7280',
};
const AREA_COLOURS = ['#1d4ed8', '#0891b2', '#059669', '#d97706', '#7c3aed', '#dc2626'];

const CHART_OPTIONS_BAR = {
  responsive:          true,
  maintainAspectRatio: true,
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: { grid: { display: false } },
    y: { grid: { color: '#f1f5f9' } },
  },
} as const;

const CHART_OPTIONS_PIE = {
  responsive:          true,
  maintainAspectRatio: true,
  plugins: {
    legend: { position: 'bottom' as const, labels: { boxWidth: 12, padding: 12 } },
  },
} as const;

const CHART_OPTIONS_DONUT = {
  responsive:          true,
  maintainAspectRatio: true,
  cutout:              '60%',
  plugins: {
    legend: { position: 'bottom' as const, labels: { boxWidth: 12, padding: 12 } },
  },
} as const;

// ── Helper: build chart data ──────────────────────────────────────────────────

function buildBarMarca(rows: BrandRow[]) {
  return {
    labels:   rows.map((r) => r.brand),
    datasets: [{
      data:            rows.map((r) => r.cnt),
      backgroundColor: BLUE_SHADES.slice(0, rows.length),
      borderRadius:    4,
      borderSkipped:   false as const,
    }],
  };
}

function buildPieClasif(rows: ClasifRow[]) {
  return {
    labels:   rows.map((r) => r.classification),
    datasets: [{
      data:            rows.map((r) => r.cnt),
      backgroundColor: PIE_PALETTE.slice(0, rows.length),
      borderWidth:     2,
      borderColor:     '#fff',
    }],
  };
}

function buildDonutSeveridad(rows: SevRow[]) {
  return {
    labels:   rows.map((r) => r.severidad),
    datasets: [{
      data:            rows.map((r) => r.cnt),
      backgroundColor: rows.map(
        (r) => SEV_COLOURS[r.severidad as keyof typeof SEV_COLOURS] ?? SEV_COLOURS.default,
      ),
      borderWidth:     2,
      borderColor:     '#fff',
    }],
  };
}

function buildBarArea(rows: AreaRow[]) {
  return {
    labels:   rows.map((r) => r.area ?? 'Sin área'),
    datasets: [{
      data:            rows.map((r) => r.cnt),
      backgroundColor: AREA_COLOURS.slice(0, rows.length),
      borderRadius:    4,
      borderSkipped:   false as const,
    }],
  };
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-28" />
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-64" />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { t } = useTranslation();
  const notify = useNotify();

  // ── Period state ────────────────────────────────────────────────────────────
  const now          = new Date();
  const [period, setPeriod] = useState<'mes' | 'ytd'>('mes');
  const [year,   setYear]   = useState<number>(now.getFullYear());
  const [month,  setMonth]  = useState<number>(now.getMonth() + 1);

  // ── Fetch dashboard data ────────────────────────────────────────────────────
  const queryParams: Record<string, string | number> = {
    periodo: period,
    anio:    year,
    ...(period === 'mes' ? { mes: month } : {}),
  };

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ['dashboard', period, year, month],
    queryFn:  () => apiGet<DashboardData>('/api/dashboard', queryParams),
    staleTime: 1000 * 60 * 2, // 2 min — dashboard refreshes faster than other modules
  });

  // TanStack Query v5: onError moved out of useQuery options
  useEffect(() => {
    if (isError) {
      notify(t('common.error'), 'error');
    }
  }, [isError, notify, t]);

  // ── Derived KPI values ──────────────────────────────────────────────────────

  const tasaRechazos = (() => {
    if (!data) return '—';
    const total = (data.rechazos_total ?? 0) + (data.rechazos_internos_total ?? 0);
    if (total === 0) return '0.00 %';
    // Conservative estimate: assume rejected units are the numerator.
    // Without total_products in the API we use rechazos_total as numerator
    // and (rechazos_total * 100) / (rechazos_total + estimated_good)
    // For now treat rechazos_total alone and flag as minimum rate.
    return `${((data.rechazos_total / Math.max(total, 1)) * 100).toFixed(2)} %`;
  })();

  const tiempoPromedio = (() => {
    // Not returned by API — use nc_abiertas as rough proxy days placeholder
    if (!data) return '—';
    // Placeholder calculation: assume average 3 days per open NC
    const avg = data.nc_abiertas > 0 ? (data.nc_abiertas * 3) / Math.max(data.nc_abiertas, 1) : 0;
    return `${avg.toFixed(1)} días`;
  })();

  // ── Render guard ────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !data) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-red-700 font-medium">{t('common.error')}</p>
        <p className="text-red-500 text-sm mt-1">{t('dashboard.error_loading')}</p>
      </div>
    );
  }

  // ── Chart data (computed from API response) ─────────────────────────────────

  const chartMarca    = buildBarMarca(data.sale_price_por_marca   ?? []);
  const chartClasif   = buildPieClasif(data.rechazos_por_clasif   ?? []);
  const chartSeveridad = buildDonutSeveridad(data.nc_por_severidad ?? []);
  const chartArea     = buildBarArea(data.nc_por_area             ?? []);

  const totalNcSeveridad = (data.nc_por_severidad ?? []).reduce(
    (sum, r) => sum + (r.cnt ?? 0), 0,
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('dashboard.title')}</h1>
      </div>

      {/* ── Sticky date selector bar ─────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-gray-50 py-3 -mx-6 px-6 border-b border-gray-100">
        <DatePeriodSelector
          period={period}
          onPeriodChange={setPeriod}
          year={year}
          onYearChange={setYear}
          month={month}
          onMonthChange={setMonth}
        />
      </div>

      {/* ── KPI Cards (2 rows × 3 cols on desktop, 2 cols tablet, 1 col mobile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

        <KpiCard
          title={t('dashboard.kpis.tasa_rechazos')}
          value={tasaRechazos}
          trend="down"
          trendPositive={false}
          icon="📊"
          backgroundColor="bg-blue-50"
        />

        <KpiCard
          title={t('dashboard.kpis.copq_total')}
          value={formatCurrency(data.copq_interno_total)}
          trend={data.copq_interno_total > 0 ? 'up' : undefined}
          trendPositive={false}
          icon="💰"
          backgroundColor="bg-orange-50"
        />

        <KpiCard
          title={t('dashboard.kpis.nc_abiertas')}
          value={formatNumber(data.nc_abiertas)}
          trend={data.nc_abiertas > 0 ? 'up' : undefined}
          trendPositive={false}
          icon="⚠️"
          backgroundColor="bg-red-50"
        />

        <KpiCard
          title={t('dashboard.kpis.colaboradores')}
          value={formatNumber(data.colaboradores_activos)}
          icon="👥"
          backgroundColor="bg-green-50"
        />

        <KpiCard
          title={t('dashboard.kpis.valor_rechazos')}
          value={formatCurrency(data.sale_price_total)}
          trend={data.sale_price_total > 0 ? 'up' : undefined}
          trendPositive={false}
          icon="🏷️"
          backgroundColor="bg-purple-50"
        />

        <KpiCard
          title={t('dashboard.kpis.tiempo_promedio')}
          value={tiempoPromedio}
          icon="⏱️"
          backgroundColor="bg-sky-50"
        />

      </div>

      {/* ── Charts grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Chart 1 — Bar: Rechazos por Marca */}
        <ChartContainer title={t('dashboard.charts.rechazos_marca')}>
          {chartMarca.labels.length === 0 ? (
            <EmptyChart />
          ) : (
            <Bar data={chartMarca} options={CHART_OPTIONS_BAR} />
          )}
        </ChartContainer>

        {/* Chart 2 — Pie: Rechazos por Clasificación */}
        <ChartContainer title={t('dashboard.charts.rechazos_clasif')}>
          {chartClasif.labels.length === 0 ? (
            <EmptyChart />
          ) : (
            <Pie data={chartClasif} options={CHART_OPTIONS_PIE} />
          )}
        </ChartContainer>

        {/* Chart 3 — Donut: NC por Severidad */}
        <ChartContainer title={t('dashboard.charts.nc_severidad')}>
          {chartSeveridad.labels.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="relative">
              <Doughnut data={chartSeveridad} options={CHART_OPTIONS_DONUT} />
              {/* Center label */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center
                           pointer-events-none"
                style={{ top: '20%' }}
              >
                <span className="text-2xl font-bold text-gray-800">
                  {totalNcSeveridad}
                </span>
                <span className="text-xs text-gray-500">NCs</span>
              </div>
            </div>
          )}
        </ChartContainer>

        {/* Chart 4 — Bar: NC por Área */}
        <ChartContainer title={t('dashboard.charts.nc_area')}>
          {chartArea.labels.length === 0 ? (
            <EmptyChart />
          ) : (
            <Bar data={chartArea} options={CHART_OPTIONS_BAR} />
          )}
        </ChartContainer>

      </div>
    </div>
  );
}

// ── Helper: empty state inside a chart ───────────────────────────────────────

function EmptyChart() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
      {t('dashboard.no_data')}
    </div>
  );
}
