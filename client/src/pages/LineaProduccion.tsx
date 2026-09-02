/**
 * Línea de Producción — Dashboard de inspección en tiempo real
 *
 * Consume dos stored procedures de SmartControl/BinManager:
 *   - sp_GetDefectsWithDetailsByDateRange  → defectos
 *   - sp_GetQualityReleasesWithDetailsByDateRange → liberaciones
 *
 * Tabs: Dashboard | Liberaciones | Defectos
 * Auto-refresh cada 60 segundos con countdown visible.
 */

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../utils/api-client";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
);

// ── Color palette ─────────────────────────────────────────────────────────────

const C = {
  primary: "#0d2b4e",
  white: "#ffffff",
  bg: "#f4f6f9",
  border: "#e2e2e2",
  muted: "#888",
  dark: "#111",
  severidadBg: { CRITICO: "#0d2b4e", MAYOR: "#555555", MENOR: "#e8e8e8" } as Record<string, string>,
  severidadText: { CRITICO: "#ffffff", MAYOR: "#ffffff", MENOR: "#666666" } as Record<string, string>,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Defecto {
  DefectsRecordsID: number;
  LicencePlateNumber: string;
  ProductionLineName: string;
  DefectGeneratedBy: string;
  DefectRecordedBy: string;
  DefectEnteredDate: string;
  CODE: string;
  DefectName: string;
  Area: string;
  Severity: string;
  Commentary: string;
}

interface Liberacion {
  ProductionQualityReleaseID: number;
  TV_LPN: string;
  TV_SKU: string;
  TV_Brand: string;
  TV_Model: string;
  TV_Size: number;
  TV_Description: string;
  ProductionLineName: string;
  ReleaseEnteredBy: string;
  ReleaseEnteredDate: string;
  ReleaseComment: string;
  DetailsJSON: string;
}

interface AccesorioDetalle {
  ProductionQualityReleaseDetailID: number;
  SKU: string;
  Brand: string;
  Model: string;
  Description: string;
  Qty: number;
}

// ── Small reusable pieces ─────────────────────────────────────────────────────

function SeveridadBadge({ sev }: { sev: string }) {
  const bg = C.severidadBg[sev] ?? "#ccc";
  const color = C.severidadText[sev] ?? "#333";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
        letterSpacing: "0.3px",
        whiteSpace: "nowrap",
      }}
    >
      {sev}
    </span>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? C.primary : C.white,
        border: `1px solid ${accent ? C.primary : C.border}`,
        borderRadius: 6,
        padding: "16px 20px",
        flex: 1,
        minWidth: 120,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          color: accent ? "rgba(255,255,255,0.7)" : C.muted,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: accent ? C.white : C.primary,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "9px 12px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.4px",
        color: C.muted,
        borderBottom: `2px solid ${C.border}`,
        whiteSpace: "nowrap",
        background: C.white,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "8px 12px",
        fontSize: 13,
        color: C.dark,
        borderBottom: `1px solid ${C.border}`,
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.ceil(total / pageSize) || 1;
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          border: `1px solid ${C.border}`,
          background: C.white,
          cursor: page === 1 ? "default" : "pointer",
          opacity: page === 1 ? 0.4 : 1,
          borderRadius: 3,
        }}
      >
        &larr;
      </button>
      <span style={{ fontSize: 12, color: C.muted }}>
        {page} / {pages}
      </span>
      <button
        onClick={() => onPage(Math.min(pages, page + 1))}
        disabled={page === pages}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          border: `1px solid ${C.border}`,
          background: C.white,
          cursor: page === pages ? "default" : "pointer",
          opacity: page === pages ? 0.4 : 1,
          borderRadius: 3,
        }}
      >
        &rarr;
      </button>
    </div>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

const CHART_MONOCHROME = [
  "#0d2b4e",
  "#1a4a82",
  "#2d6ab4",
  "#4d8fd4",
  "#7db3e8",
  "#a8cef0",
  "#c8def7",
  "#e4f0fb",
];

const CHART_FONT = { family: "inherit", size: 11 };

// ── Main component ────────────────────────────────────────────────────────────

export default function LineaProduccion() {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Filters
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [filtroLinea, setFiltroLinea] = useState("");
  const [filtroInspector, setFiltroInspector] = useState("");
  const [filtroSeveridad, setFiltroSeveridad] = useState("");

  // Tab
  const [tab, setTab] = useState<"dashboard" | "liberaciones" | "defectos">("dashboard");

  // Detail panel
  const [selectedItem, setSelectedItem] = useState<{
    type: "liberacion" | "defecto";
    lpn: string;
  } | null>(null);

  // Search
  const [searchLib, setSearchLib] = useState("");
  const [searchDef, setSearchDef] = useState("");

  // Extra tab-level filters
  const [filtroAreaDef, setFiltroAreaDef] = useState("");
  const [filtroSevDef, setFiltroSevDef] = useState("");

  // Pagination
  const [pageLib, setPageLib] = useState(1);
  const [pageDef, setPageDef] = useState(1);
  const PAGE_SIZE = 50;

  // Auto-refresh countdown
  const [countdown, setCountdown] = useState(60);

  // ── Queries ────────────────────────────────────────────────────────────────

  const defectosQuery = useQuery<Defecto[]>({
    queryKey: [
      "produccion-defectos",
      startDate,
      endDate,
      filtroLinea,
      filtroInspector,
      filtroSeveridad,
    ],
    queryFn: () =>
      apiGet<Defecto[]>("/api/produccion/defectos", {
        startDate,
        endDate,
        linea: filtroLinea || undefined,
        inspector: filtroInspector || undefined,
        severidad: filtroSeveridad || undefined,
      }),
    refetchInterval: 60000,
    staleTime: 50000,
  });

  const liberacionesQuery = useQuery<Liberacion[]>({
    queryKey: [
      "produccion-liberaciones",
      startDate,
      endDate,
      filtroLinea,
      filtroInspector,
    ],
    queryFn: () =>
      apiGet<Liberacion[]>("/api/produccion/liberaciones", {
        startDate,
        endDate,
        linea: filtroLinea || undefined,
        inspector: filtroInspector || undefined,
      }),
    refetchInterval: 60000,
    staleTime: 50000,
  });

  const defectos = defectosQuery.data ?? [];
  const liberaciones = liberacionesQuery.data ?? [];
  const loading = defectosQuery.isLoading || liberacionesQuery.isLoading;
  const error = defectosQuery.error || liberacionesQuery.error;

  // ── Countdown ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 60 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!defectosQuery.isFetching) setCountdown(60);
  }, [defectosQuery.isFetching]);

  // ── Derived filters ────────────────────────────────────────────────────────

  const lineas = useMemo(
    () =>
      [
        ...new Set([
          ...defectos.map((d) => d.ProductionLineName),
          ...liberaciones.map((l) => l.ProductionLineName),
        ]),
      ]
        .filter(Boolean)
        .sort(),
    [defectos, liberaciones],
  );

  const inspectores = useMemo(
    () =>
      [
        ...new Set([
          ...defectos.map((d) => d.DefectGeneratedBy),
          ...liberaciones.map((l) => l.ReleaseEnteredBy),
        ]),
      ]
        .filter(Boolean)
        .sort(),
    [defectos, liberaciones],
  );

  const areasDisponibles = useMemo(
    () => [...new Set(defectos.map((d) => d.Area))].filter(Boolean).sort(),
    [defectos],
  );

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const kpis = useMemo(
    () => ({
      totalLib: liberaciones.length,
      totalDef: defectos.length,
      tasa:
        liberaciones.length > 0
          ? ((defectos.length / liberaciones.length) * 100).toFixed(1)
          : "0.0",
      criticos: defectos.filter((d) => d.Severity === "CRITICO").length,
    }),
    [defectos, liberaciones],
  );

  // ── Pareto ─────────────────────────────────────────────────────────────────

  const paretoData = useMemo(() => {
    const counts = defectos.reduce(
      (acc, d) => {
        acc[d.DefectName] = (acc[d.DefectName] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [defectos]);

  // ── Area distribution ──────────────────────────────────────────────────────

  const areaData = useMemo(() => {
    const counts = defectos.reduce(
      (acc, d) => {
        acc[d.Area] = (acc[d.Area] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [defectos]);

  // ── By line ────────────────────────────────────────────────────────────────

  const lineaData = useMemo(() => {
    const lines = [
      ...new Set(defectos.map((d) => d.ProductionLineName)),
    ]
      .filter(Boolean)
      .sort();
    return lines
      .map((linea) => {
        const defsLinea = defectos.filter((d) => d.ProductionLineName === linea);
        const libsLinea = liberaciones.filter((l) => l.ProductionLineName === linea);
        return {
          linea,
          total: defsLinea.length,
          liberaciones: libsLinea.length,
          menor: defsLinea.filter((d) => d.Severity === "MENOR").length,
          mayor: defsLinea.filter((d) => d.Severity === "MAYOR").length,
          critico: defsLinea.filter((d) => d.Severity === "CRITICO").length,
          tasa:
            libsLinea.length > 0
              ? ((defsLinea.length / libsLinea.length) * 100).toFixed(1)
              : "0.0",
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [defectos, liberaciones]);

  // ── Inspector performance ──────────────────────────────────────────────────

  const inspectorData = useMemo(() => {
    const inspMap = liberaciones.reduce(
      (acc, l) => {
        if (!acc[l.ReleaseEnteredBy])
          acc[l.ReleaseEnteredBy] = {
            liberaciones: 0,
            defectos: 0,
            linea: l.ProductionLineName,
          };
        acc[l.ReleaseEnteredBy].liberaciones++;
        return acc;
      },
      {} as Record<string, { liberaciones: number; defectos: number; linea: string }>,
    );
    defectos.forEach((d) => {
      const key = d.DefectRecordedBy;
      if (inspMap[key]) inspMap[key].defectos++;
    });
    return Object.entries(inspMap)
      .map(([name, data]) => ({
        name,
        ...data,
        tasa:
          data.liberaciones > 0
            ? ((data.defectos / data.liberaciones) * 100).toFixed(1)
            : "0.0",
      }))
      .sort((a, b) => b.liberaciones - a.liberaciones);
  }, [defectos, liberaciones]);

  // ── Daily trend ────────────────────────────────────────────────────────────

  const dailyTrend = useMemo(() => {
    const libByDay = liberaciones.reduce(
      (acc, l) => {
        const day = l.ReleaseEnteredDate?.slice(0, 10) || "";
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const defByDay = defectos.reduce(
      (acc, d) => {
        const day = d.DefectEnteredDate?.slice(0, 10) || "";
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const days = [
      ...new Set([...Object.keys(libByDay), ...Object.keys(defByDay)]),
    ].sort();
    return days.map((day) => ({ day, lib: libByDay[day] || 0, def: defByDay[day] || 0 }));
  }, [defectos, liberaciones]);

  // ── Cross-reference maps ───────────────────────────────────────────────────

  const defectosPorLPN = useMemo(() => {
    const map: Record<string, Defecto[]> = {};
    defectos.forEach((d) => {
      if (!map[d.LicencePlateNumber]) map[d.LicencePlateNumber] = [];
      map[d.LicencePlateNumber].push(d);
    });
    return map;
  }, [defectos]);

  const liberacionPorLPN = useMemo(() => {
    const map: Record<string, Liberacion> = {};
    liberaciones.forEach((l) => {
      map[l.TV_LPN] = l;
    });
    return map;
  }, [liberaciones]);

  // ── Filtered table data ────────────────────────────────────────────────────

  const libsFiltradas = useMemo(() => {
    if (!searchLib) return liberaciones;
    const q = searchLib.toLowerCase();
    return liberaciones.filter(
      (l) =>
        l.TV_LPN?.toLowerCase().includes(q) ||
        l.TV_Brand?.toLowerCase().includes(q) ||
        l.TV_Model?.toLowerCase().includes(q) ||
        l.TV_SKU?.toLowerCase().includes(q) ||
        l.ReleaseEnteredBy?.toLowerCase().includes(q),
    );
  }, [liberaciones, searchLib]);

  const defsFiltrados = useMemo(() => {
    let rows = defectos;
    if (searchDef) {
      const q = searchDef.toLowerCase();
      rows = rows.filter(
        (d) =>
          d.LicencePlateNumber?.toLowerCase().includes(q) ||
          d.DefectName?.toLowerCase().includes(q) ||
          d.Area?.toLowerCase().includes(q) ||
          d.DefectGeneratedBy?.toLowerCase().includes(q) ||
          d.ProductionLineName?.toLowerCase().includes(q),
      );
    }
    if (filtroAreaDef) rows = rows.filter((d) => d.Area === filtroAreaDef);
    if (filtroSevDef) rows = rows.filter((d) => d.Severity === filtroSevDef);
    return rows;
  }, [defectos, searchDef, filtroAreaDef, filtroSevDef]);

  // ── Selected detail ────────────────────────────────────────────────────────

  const selectedLib =
    selectedItem?.type === "liberacion" ? liberacionPorLPN[selectedItem.lpn] : null;
  const selectedDef =
    selectedItem?.type === "defecto"
      ? defectos.find((d) => String(d.DefectsRecordsID) === selectedItem.lpn)
      : null;

  // ── Accessory details from DetailsJSON ────────────────────────────────────

  const accesorios: AccesorioDetalle[] = useMemo(() => {
    if (!selectedLib?.DetailsJSON) return [];
    try {
      return JSON.parse(selectedLib.DetailsJSON) as AccesorioDetalle[];
    } catch {
      return [];
    }
  }, [selectedLib]);

  // ── Paginated slices ───────────────────────────────────────────────────────

  const libsPage = libsFiltradas.slice((pageLib - 1) * PAGE_SIZE, pageLib * PAGE_SIZE);
  const defsPage = defsFiltrados.slice((pageDef - 1) * PAGE_SIZE, pageDef * PAGE_SIZE);

  // Reset pages on filter change
  useEffect(() => { setPageLib(1); }, [searchLib, liberaciones]);
  useEffect(() => { setPageDef(1); }, [searchDef, filtroAreaDef, filtroSevDef, defectos]);

  // ── Chart data ─────────────────────────────────────────────────────────────

  const paretoChartData = {
    labels: paretoData.map(([name]) =>
      name.length > 22 ? name.slice(0, 22) + "…" : name,
    ),
    datasets: [
      {
        label: "Defectos",
        data: paretoData.map(([, count]) => count),
        backgroundColor: CHART_MONOCHROME[0],
        borderRadius: 3,
      },
    ],
  };

  const tendenciaChartData = {
    labels: dailyTrend.map((d) => d.day.slice(5)), // MM-DD
    datasets: [
      {
        label: "Liberaciones",
        data: dailyTrend.map((d) => d.lib),
        borderColor: C.primary,
        backgroundColor: "rgba(13,43,78,0.08)",
        tension: 0.3,
        yAxisID: "y",
        pointRadius: 3,
      },
      {
        label: "Defectos",
        data: dailyTrend.map((d) => d.def),
        borderColor: "#888",
        backgroundColor: "rgba(136,136,136,0.08)",
        tension: 0.3,
        yAxisID: "y2",
        pointRadius: 3,
        borderDash: [4, 3],
      },
    ],
  };

  const donutChartData = {
    labels: areaData.map(([area]) => area),
    datasets: [
      {
        data: areaData.map(([, count]) => count),
        backgroundColor: CHART_MONOCHROME,
        borderWidth: 1,
        borderColor: C.white,
      },
    ],
  };

  const stacked = lineaData.slice(0, 10);
  const stackedChartData = {
    labels: stacked.map((l) =>
      l.linea.length > 18 ? l.linea.slice(0, 18) + "…" : l.linea,
    ),
    datasets: [
      {
        label: "MENOR",
        data: stacked.map((l) => l.menor),
        backgroundColor: "#e8e8e8",
        stack: "sev",
      },
      {
        label: "MAYOR",
        data: stacked.map((l) => l.mayor),
        backgroundColor: "#555555",
        stack: "sev",
      },
      {
        label: "CRITICO",
        data: stacked.map((l) => l.critico),
        backgroundColor: C.primary,
        stack: "sev",
      },
    ],
  };

  // ── Tasa color helper ──────────────────────────────────────────────────────

  function tasaColor(tasa: string) {
    const v = parseFloat(tasa);
    if (v === 0) return "#27ae60";
    if (v < 2) return "#e67e22";
    return "#c0392b";
  }

  // ── Common select style ────────────────────────────────────────────────────

  const selectStyle: React.CSSProperties = {
    padding: "5px 8px",
    fontSize: 12,
    border: `1px solid ${C.border}`,
    background: C.white,
    color: C.dark,
    borderRadius: 3,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  const inputStyle: React.CSSProperties = {
    padding: "5px 10px",
    fontSize: 12,
    border: `1px solid ${C.border}`,
    borderRadius: 3,
    fontFamily: "inherit",
    background: C.white,
    color: C.dark,
    outline: "none",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "inherit", minHeight: "100%" }}>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: C.primary,
          borderRadius: 6,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            color: C.white,
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            marginRight: 4,
            whiteSpace: "nowrap",
          }}
        >
          LÍNEA DE PRODUCCIÓN
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>Desde</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ ...inputStyle, width: 130 }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>Hasta</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ ...inputStyle, width: 130 }}
          />
        </div>

        <select
          value={filtroLinea}
          onChange={(e) => setFiltroLinea(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todas las líneas</option>
          {lineas.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select
          value={filtroInspector}
          onChange={(e) => setFiltroInspector(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todos los inspectores</option>
          {inspectores.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>

        <select
          value={filtroSeveridad}
          onChange={(e) => setFiltroSeveridad(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todas las severidades</option>
          <option value="CRITICO">CRITICO</option>
          <option value="MAYOR">MAYOR</option>
          <option value="MENOR">MENOR</option>
        </select>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {loading && (
            <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>Actualizando…</span>
          )}
          <span
            style={{
              background: "rgba(255,255,255,0.12)",
              color: C.white,
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 20,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            ↻ en {countdown}s
          </span>
        </div>
      </div>

      {/* ── Error state ──────────────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            background: "#fde8e8",
            border: "1px solid #f5c6c6",
            borderRadius: 6,
            padding: "12px 16px",
            marginBottom: 16,
            color: "#b03030",
            fontSize: 13,
          }}
        >
          Error al cargar datos: {error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {/* ── Tab nav ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          borderBottom: `2px solid ${C.border}`,
          marginBottom: 20,
          gap: 0,
        }}
      >
        {(["dashboard", "liberaciones", "defectos"] as const).map((t) => {
          const labels: Record<string, string> = {
            dashboard: "Dashboard",
            liberaciones: `Liberaciones (${liberaciones.length})`,
            defectos: `Defectos (${defectos.length})`,
          };
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "9px 20px",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                background: active ? C.primary : "transparent",
                color: active ? C.white : C.muted,
                border: "none",
                borderBottom: active ? `2px solid ${C.primary}` : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
                marginBottom: -2,
                letterSpacing: "0.2px",
              }}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* ── Content area with optional detail panel ───────────────────────── */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* TAB: DASHBOARD                                                  */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {tab === "dashboard" && (
            <div>

              {/* KPI cards */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                <KpiCard label="Liberaciones" value={kpis.totalLib} accent />
                <KpiCard label="Defectos" value={kpis.totalDef} />
                <KpiCard label="Tasa defectos" value={`${kpis.tasa}%`} />
                <KpiCard label="Críticos" value={kpis.criticos} />
              </div>

              {/* Charts row 1 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                {/* Pareto */}
                <div
                  style={{
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: C.muted,
                      letterSpacing: "0.5px",
                      marginBottom: 12,
                    }}
                  >
                    Pareto de Defectos
                  </div>
                  {paretoData.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                      Sin datos
                    </div>
                  ) : (
                    <Bar
                      data={paretoChartData}
                      options={{
                        indexAxis: "y",
                        responsive: true,
                        plugins: {
                          legend: { display: false },
                          tooltip: { bodyFont: CHART_FONT, titleFont: CHART_FONT },
                        },
                        scales: {
                          x: { ticks: { font: CHART_FONT }, grid: { color: "#f0f0f0" } },
                          y: { ticks: { font: CHART_FONT } },
                        },
                      }}
                    />
                  )}
                </div>

                {/* Tendencia diaria */}
                <div
                  style={{
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: C.muted,
                      letterSpacing: "0.5px",
                      marginBottom: 12,
                    }}
                  >
                    Tendencia Diaria
                  </div>
                  {dailyTrend.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                      Sin datos
                    </div>
                  ) : (
                    <Line
                      data={tendenciaChartData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            display: true,
                            labels: { font: CHART_FONT, boxWidth: 12 },
                          },
                          tooltip: { bodyFont: CHART_FONT, titleFont: CHART_FONT },
                        },
                        scales: {
                          y: {
                            position: "left",
                            ticks: { font: CHART_FONT },
                            title: { display: true, text: "Liberaciones", font: CHART_FONT },
                          },
                          y2: {
                            position: "right",
                            ticks: { font: CHART_FONT },
                            grid: { drawOnChartArea: false },
                            title: { display: true, text: "Defectos", font: CHART_FONT },
                          },
                          x: { ticks: { font: CHART_FONT } },
                        },
                      }}
                    />
                  )}
                </div>

                {/* Donut área */}
                <div
                  style={{
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: C.muted,
                      letterSpacing: "0.5px",
                      marginBottom: 12,
                    }}
                  >
                    Defectos por Área
                  </div>
                  {areaData.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                      Sin datos
                    </div>
                  ) : (
                    <Doughnut
                      data={donutChartData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            display: true,
                            position: "bottom",
                            labels: { font: CHART_FONT, boxWidth: 12 },
                          },
                          tooltip: { bodyFont: CHART_FONT, titleFont: CHART_FONT },
                        },
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Charts row 2 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                {/* Stacked by line */}
                <div
                  style={{
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: C.muted,
                      letterSpacing: "0.5px",
                      marginBottom: 12,
                    }}
                  >
                    Defectos por Línea
                  </div>
                  {stacked.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                      Sin datos
                    </div>
                  ) : (
                    <Bar
                      data={stackedChartData}
                      options={{
                        indexAxis: "y",
                        responsive: true,
                        plugins: {
                          legend: {
                            display: true,
                            labels: { font: CHART_FONT, boxWidth: 12 },
                          },
                          tooltip: { bodyFont: CHART_FONT, titleFont: CHART_FONT },
                        },
                        scales: {
                          x: { stacked: true, ticks: { font: CHART_FONT } },
                          y: { stacked: true, ticks: { font: CHART_FONT } },
                        },
                      }}
                    />
                  )}
                </div>

                {/* Inspector table */}
                <div
                  style={{
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: C.muted,
                      letterSpacing: "0.5px",
                      marginBottom: 12,
                    }}
                  >
                    Desempeño por Inspector
                  </div>
                  {inspectorData.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                      Sin datos
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <TableHeader>Inspector</TableHeader>
                          <TableHeader>Lib.</TableHeader>
                          <TableHeader>Def.</TableHeader>
                          <TableHeader>Tasa</TableHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {inspectorData.map((insp) => (
                          <tr key={insp.name}>
                            <Td>
                              <span style={{ fontSize: 12 }}>{insp.name}</span>
                            </Td>
                            <Td>{insp.liberaciones}</Td>
                            <Td>{insp.defectos}</Td>
                            <Td>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: tasaColor(insp.tasa),
                                  fontSize: 12,
                                }}
                              >
                                {insp.tasa}%
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Defects list sorted by severity */}
              {defectos.length > 0 && (
                <div
                  style={{
                    background: C.white,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: C.muted,
                      letterSpacing: "0.5px",
                      marginBottom: 12,
                    }}
                  >
                    Todos los Defectos
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <TableHeader>Severidad</TableHeader>
                          <TableHeader>LPN</TableHeader>
                          <TableHeader>Defecto</TableHeader>
                          <TableHeader>Área</TableHeader>
                          <TableHeader>Línea</TableHeader>
                          <TableHeader>Inspector</TableHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {[...defectos]
                          .sort((a, b) => {
                            const order: Record<string, number> = {
                              CRITICO: 0,
                              MAYOR: 1,
                              MENOR: 2,
                            };
                            return (order[a.Severity] ?? 3) - (order[b.Severity] ?? 3);
                          })
                          .slice(0, 100)
                          .map((d) => (
                            <tr
                              key={d.DefectsRecordsID}
                              style={{ cursor: "pointer" }}
                              onClick={() =>
                                setSelectedItem({
                                  type: "defecto",
                                  lpn: String(d.DefectsRecordsID),
                                })
                              }
                            >
                              <Td>
                                <SeveridadBadge sev={d.Severity} />
                              </Td>
                              <Td style={{ fontFamily: "monospace", fontSize: 11 }}>
                                {d.LicencePlateNumber}
                              </Td>
                              <Td>{d.DefectName}</Td>
                              <Td>{d.Area}</Td>
                              <Td>{d.ProductionLineName}</Td>
                              <Td>{d.DefectRecordedBy}</Td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {defectos.length > 100 && (
                      <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: 8 }}>
                        Mostrando 100 de {defectos.length} — usa la pestaña Defectos para ver todos
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!loading && defectos.length === 0 && liberaciones.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: C.muted,
                    fontSize: 14,
                  }}
                >
                  Sin datos para el período y filtros seleccionados.
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* TAB: LIBERACIONES                                               */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {tab === "liberaciones" && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="text"
                  placeholder="Buscar LPN, marca, modelo, SKU, inspector…"
                  value={searchLib}
                  onChange={(e) => setSearchLib(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                />
                <span style={{ color: C.muted, fontSize: 12, whiteSpace: "nowrap" }}>
                  {libsFiltradas.length} resultado(s)
                </span>
              </div>

              {libsFiltradas.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: C.muted,
                    fontSize: 14,
                  }}
                >
                  Sin liberaciones para los filtros actuales.
                </div>
              ) : (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <TableHeader>LPN</TableHeader>
                          <TableHeader>Línea</TableHeader>
                          <TableHeader>Tam.</TableHeader>
                          <TableHeader>Marca</TableHeader>
                          <TableHeader>Inspector</TableHeader>
                          <TableHeader>Hora</TableHeader>
                          <TableHeader>Defectos</TableHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {libsPage.map((l) => {
                          const defsLPN = defectosPorLPN[l.TV_LPN] ?? [];
                          const hasDef = defsLPN.length > 0;
                          return (
                            <tr
                              key={l.ProductionQualityReleaseID}
                              style={{ cursor: "pointer" }}
                              onClick={() =>
                                setSelectedItem({ type: "liberacion", lpn: l.TV_LPN })
                              }
                            >
                              <Td style={{ fontFamily: "monospace", fontSize: 11 }}>
                                {l.TV_LPN}
                              </Td>
                              <Td>{l.ProductionLineName}</Td>
                              <Td>{l.TV_Size ? `${l.TV_Size}"` : "—"}</Td>
                              <Td>{l.TV_Brand}</Td>
                              <Td>{l.ReleaseEnteredBy}</Td>
                              <Td style={{ fontSize: 11, color: C.muted }}>
                                {l.ReleaseEnteredDate
                                  ? new Date(l.ReleaseEnteredDate).toLocaleTimeString("es-MX", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </Td>
                              <Td>
                                {hasDef ? (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      background: "#fff3cd",
                                      border: "1px solid #f0c040",
                                      borderRadius: 3,
                                      padding: "2px 7px",
                                      fontSize: 11,
                                      color: "#8a6200",
                                      fontWeight: 600,
                                    }}
                                  >
                                    ⚠ {defsLPN.length}
                                  </span>
                                ) : (
                                  <span style={{ color: C.muted, fontSize: 11 }}>—</span>
                                )}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={pageLib}
                    total={libsFiltradas.length}
                    pageSize={PAGE_SIZE}
                    onPage={setPageLib}
                  />
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* TAB: DEFECTOS                                                   */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {tab === "defectos" && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="text"
                  placeholder="Buscar LPN, defecto, área, inspector, línea…"
                  value={searchDef}
                  onChange={(e) => setSearchDef(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                />
                <select
                  value={filtroAreaDef}
                  onChange={(e) => setFiltroAreaDef(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Todas las áreas</option>
                  {areasDisponibles.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <select
                  value={filtroSevDef}
                  onChange={(e) => setFiltroSevDef(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Todas las severidades</option>
                  <option value="CRITICO">CRITICO</option>
                  <option value="MAYOR">MAYOR</option>
                  <option value="MENOR">MENOR</option>
                </select>
                <span style={{ color: C.muted, fontSize: 12, whiteSpace: "nowrap" }}>
                  {defsFiltrados.length} resultado(s)
                </span>
              </div>

              {defsFiltrados.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: C.muted,
                    fontSize: 14,
                  }}
                >
                  Sin defectos para los filtros actuales.
                </div>
              ) : (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <TableHeader>LPN</TableHeader>
                          <TableHeader>Defecto</TableHeader>
                          <TableHeader>Área</TableHeader>
                          <TableHeader>Severidad</TableHeader>
                          <TableHeader>Línea</TableHeader>
                          <TableHeader>Inspector</TableHeader>
                        </tr>
                      </thead>
                      <tbody>
                        {defsPage.map((d) => (
                          <tr
                            key={d.DefectsRecordsID}
                            style={{ cursor: "pointer" }}
                            onClick={() =>
                              setSelectedItem({
                                type: "defecto",
                                lpn: String(d.DefectsRecordsID),
                              })
                            }
                          >
                            <Td style={{ fontFamily: "monospace", fontSize: 11 }}>
                              {d.LicencePlateNumber}
                            </Td>
                            <Td>{d.DefectName}</Td>
                            <Td>{d.Area}</Td>
                            <Td>
                              <SeveridadBadge sev={d.Severity} />
                            </Td>
                            <Td>{d.ProductionLineName}</Td>
                            <Td>{d.DefectRecordedBy}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={pageDef}
                    total={defsFiltrados.length}
                    pageSize={PAGE_SIZE}
                    onPage={setPageDef}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Detail panel ─────────────────────────────────────────────────── */}
        {selectedItem && (
          <div
            style={{
              width: 300,
              flexShrink: 0,
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: 16,
              position: "sticky",
              top: 0,
              maxHeight: "calc(100vh - 120px)",
              overflowY: "auto",
            }}
          >
            {/* Close */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13, color: C.primary }}>
                {selectedItem.type === "liberacion" ? "Detalle Liberación" : "Detalle Defecto"}
              </span>
              <button
                onClick={() => setSelectedItem(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: C.muted,
                  padding: "0 4px",
                  fontFamily: "inherit",
                }}
              >
                ×
              </button>
            </div>

            {/* LIBERACION DETAIL */}
            {selectedLib && (
              <div>
                <div
                  style={{
                    background: C.bg,
                    borderRadius: 4,
                    padding: "10px 12px",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: C.primary }}
                  >
                    {selectedLib.TV_LPN}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {selectedLib.TV_Brand} {selectedLib.TV_Model}
                    {selectedLib.TV_Size ? ` — ${selectedLib.TV_Size}"` : ""}
                  </div>
                  {selectedLib.TV_Description && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {selectedLib.TV_Description}
                    </div>
                  )}
                </div>

                <DetailRow label="SKU" value={selectedLib.TV_SKU} />
                <DetailRow label="Línea" value={selectedLib.ProductionLineName} />
                <DetailRow label="Inspector" value={selectedLib.ReleaseEnteredBy} />
                <DetailRow
                  label="Fecha"
                  value={
                    selectedLib.ReleaseEnteredDate
                      ? new Date(selectedLib.ReleaseEnteredDate).toLocaleString("es-MX")
                      : "—"
                  }
                />
                {selectedLib.ReleaseComment && (
                  <DetailRow label="Comentario" value={selectedLib.ReleaseComment} />
                )}

                {/* Accessories */}
                {accesorios.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: C.muted,
                        letterSpacing: "0.4px",
                        marginBottom: 6,
                      }}
                    >
                      Accesorios
                    </div>
                    {accesorios.map((a) => (
                      <div
                        key={a.ProductionQualityReleaseDetailID}
                        style={{
                          background: C.bg,
                          borderRadius: 4,
                          padding: "6px 10px",
                          marginBottom: 4,
                          fontSize: 11,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {a.Brand} {a.Model}
                        </div>
                        <div style={{ color: C.muted }}>{a.Description}</div>
                        <div style={{ color: C.primary, fontWeight: 600 }}>Qty: {a.Qty}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cross-ref defectos */}
                {(() => {
                  const defs = defectosPorLPN[selectedLib.TV_LPN] ?? [];
                  if (defs.length === 0) return null;
                  return (
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#b03030",
                          letterSpacing: "0.4px",
                          marginBottom: 6,
                        }}
                      >
                        Defectos registrados ({defs.length})
                      </div>
                      {defs.map((d) => (
                        <div
                          key={d.DefectsRecordsID}
                          style={{
                            background: "#fff3cd",
                            border: "1px solid #f0c040",
                            borderRadius: 4,
                            padding: "6px 10px",
                            marginBottom: 4,
                            fontSize: 11,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>{d.DefectName}</span>
                            <SeveridadBadge sev={d.Severity} />
                          </div>
                          <div style={{ color: C.muted, marginTop: 2 }}>
                            {d.Area} — {d.DefectRecordedBy}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* DEFECTO DETAIL */}
            {selectedDef && (
              <div>
                <div
                  style={{
                    background: C.bg,
                    borderRadius: 4,
                    padding: "10px 12px",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 13,
                        fontWeight: 700,
                        color: C.primary,
                      }}
                    >
                      {selectedDef.LicencePlateNumber}
                    </span>
                    <SeveridadBadge sev={selectedDef.Severity} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                    {selectedDef.DefectName}
                  </div>
                </div>

                <DetailRow label="Área" value={selectedDef.Area} />
                <DetailRow label="Código" value={selectedDef.CODE} />
                <DetailRow label="Línea" value={selectedDef.ProductionLineName} />
                <DetailRow label="Generado por" value={selectedDef.DefectGeneratedBy} />
                <DetailRow label="Registrado por" value={selectedDef.DefectRecordedBy} />
                <DetailRow
                  label="Fecha"
                  value={
                    selectedDef.DefectEnteredDate
                      ? new Date(selectedDef.DefectEnteredDate).toLocaleString("es-MX")
                      : "—"
                  }
                />
                {selectedDef.Commentary && (
                  <DetailRow label="Comentario" value={selectedDef.Commentary} />
                )}

                {/* Cross-ref liberación */}
                {(() => {
                  const lib = liberacionPorLPN[selectedDef.LicencePlateNumber];
                  if (!lib) return null;
                  return (
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: C.muted,
                          letterSpacing: "0.4px",
                          marginBottom: 6,
                        }}
                      >
                        Liberación asociada
                      </div>
                      <div
                        style={{
                          background: "#eaf3fc",
                          border: "1px solid #a8cef0",
                          borderRadius: 4,
                          padding: "8px 10px",
                          fontSize: 11,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: C.primary }}>
                          {lib.TV_Brand} {lib.TV_Model}
                          {lib.TV_Size ? ` ${lib.TV_Size}"` : ""}
                        </div>
                        <div style={{ color: C.muted, marginTop: 2 }}>
                          Inspector: {lib.ReleaseEnteredBy}
                        </div>
                        <div style={{ color: C.muted }}>Línea: {lib.ProductionLineName}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helper ──────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 6,
        alignItems: "flex-start",
        fontSize: 12,
      }}
    >
      <span
        style={{
          color: "#888",
          fontWeight: 600,
          flexShrink: 0,
          minWidth: 90,
        }}
      >
        {label}
      </span>
      <span style={{ color: "#111", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}
