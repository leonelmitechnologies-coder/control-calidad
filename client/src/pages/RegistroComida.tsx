import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { useConfirm } from "../context/ConfirmContext";
import { useNotify } from "../context/NotifyContext";
import { useIsMobile } from "../hooks/useIsMobile";

// Actualiza el componente cada `ms` milisegundos
function useInterval(ms: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Colaborador {
  id: number;
  nombre_completo: string;
  area: string;
  puesto: string;
  turno: string;
  foto_filename: string;
  foto_url: string | null;
  nfc_id: string;
}

interface Registro {
  id: number;
  colaborador_id: number;
  fecha: string;
  hora_registro: string;
  turno: string;
  tipo_movimiento: "salida_comedor" | "entrada_produccion";
  observaciones: string;
  registrado_por: string;
  created_at: string;
  nombre_completo: string;
  area: string;
  puesto: string;
  turno_colaborador: string;
  foto_filename: string;
  foto_url: string | null;
}

interface ListResponse {
  data: Registro[];
  total: number;
  desde: string;
  hasta: string;
}

const TURNOS = ["Matutino", "Vespertino", "Nocturno"];
const nfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j?.error ?? msg; } catch { /**/ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOf(rango: "semanal" | "mensual", ref: string): string {
  const d = new Date(ref + "T12:00:00");
  if (rango === "semanal") {
    const day = d.getDay(); // 0=dom
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
  } else {
    d.setDate(1);
  }
  return d.toISOString().slice(0, 10);
}

function endOf(rango: "semanal" | "mensual", ref: string): string {
  const d = new Date(ref + "T12:00:00");
  if (rango === "semanal") {
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
  } else {
    d.setMonth(d.getMonth() + 1, 0);
  }
  return d.toISOString().slice(0, 10);
}

function labelTipo(tipo: string) {
  return tipo === "salida_comedor" ? "SALIDA COMEDOR" : "ENTRADA PRODUCCIÓN";
}
function colorTipo(tipo: string) {
  return tipo === "salida_comedor"
    ? { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" }
    : { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" };
}
function iconTipo(tipo: string) {
  return tipo === "salida_comedor" ? "🍽️" : "🏭";
}

// ── Lógica de viajes (pares salida → entrada) ─────────────────────────────────

interface Viaje {
  colaborador_id: number;
  nombre_completo: string;
  foto_url: string | null;
  area: string;
  salida: Registro;
  entrada: Registro | null; // null = aún en comedor
}

function armarViajes(registros: Registro[]): Viaje[] {
  // Agrupa por colaborador, ordena por hora
  const por: Record<number, Registro[]> = {};
  for (const r of registros) {
    if (!por[r.colaborador_id]) por[r.colaborador_id] = [];
    por[r.colaborador_id].push(r);
  }
  const viajes: Viaje[] = [];
  for (const lista of Object.values(por)) {
    lista.sort((a, b) => a.hora_registro.localeCompare(b.hora_registro));
    let i = 0;
    while (i < lista.length) {
      const r = lista[i];
      if (r.tipo_movimiento === "salida_comedor") {
        const sig = lista[i + 1];
        const entrada = sig?.tipo_movimiento === "entrada_produccion" ? sig : null;
        viajes.push({
          colaborador_id: r.colaborador_id,
          nombre_completo: r.nombre_completo,
          foto_url: r.foto_url,
          area: r.area,
          salida: r,
          entrada,
        });
        i += entrada ? 2 : 1;
      } else {
        i++;
      }
    }
  }
  // Orden: primero los que siguen fuera (entrada=null), luego por hora de salida desc
  return viajes.sort((a, b) => {
    if (!a.entrada && b.entrada) return -1;
    if (a.entrada && !b.entrada) return 1;
    return b.salida.hora_registro.localeCompare(a.salida.hora_registro);
  });
}

// Minutos transcurridos desde fecha "YYYY-MM-DD" + hora "HH:MM:SS"
function minutosDesde(fecha: string, hora: string): number {
  const dt = new Date(`${fecha}T${hora}`);
  return Math.floor((Date.now() - dt.getTime()) / 60000);
}

function formatMinutos(mins: number): string {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function semaforo(mins: number): { bg: string; color: string; border: string } {
  if (mins < 45) return { bg: "#f0fdf4", color: "#15803d", border: "#86efac" };
  if (mins < 60) return { bg: "#fffbeb", color: "#b45309", border: "#fcd34d" };
  return { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" };
}

function Initials({ name, size = 36 }: { name: string; size?: number }) {
  const i = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.36, fontWeight: 700, color: "#475569" }}>{i}</span>
    </div>
  );
}

function Avatar({ url, name, size = 36 }: { url?: string | null; name: string; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return <Initials name={name} size={size} />;
}

// ── NFC Scanner View ──────────────────────────────────────────────────────────

type NfcStatus = "idle" | "scanning" | "success" | "error" | "not-found";

interface ScanResult {
  registro: Registro;
}

function ScannerView() {
  const notify = useNotify();
  const [status, setStatus] = useState<NfcStatus>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const ndefRef = useRef<any>(null);

  // Manual fallback state
  const [showManual, setShowManual] = useState(false);
  const [manualColabId, setManualColabId] = useState("");
  const [manualTipo, setManualTipo] = useState("salida_comedor");
  const [manualTurno, setManualTurno] = useState("");
  const [search, setSearch] = useState("");

  const { data: colaboradores = [] } = useQuery<Colaborador[]>({
    queryKey: ["registro-comida-colaboradores"],
    queryFn: () => apiFetch(`${API_BASE_URL}/api/registro-comida/colaboradores`),
    staleTime: 60_000,
  });

  const escaneoMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch<Registro>(`${API_BASE_URL}/api/registro-comida/escaneo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      setResult({ registro: data });
      setStatus("success");
      setTimeout(() => { setStatus("idle"); setResult(null); }, 4000);
    },
    onError: (err: any) => {
      const msg = err.message ?? "Error al registrar";
      if (msg.includes("no encontrado")) {
        setStatus("not-found");
        setErrorMsg("Tag NFC no asociado a ningún colaborador.");
      } else {
        setStatus("error");
        setErrorMsg(msg);
      }
      setTimeout(() => setStatus("idle"), 3500);
    },
  });

  const manualMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch<Registro>(`${API_BASE_URL}/api/registro-comida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      setResult({ registro: data });
      setStatus("success");
      setManualColabId("");
      setTimeout(() => { setStatus("idle"); setResult(null); }, 4000);
    },
    onError: (err: any) => {
      notify(err.message ?? "Error al registrar.", "error");
    },
  });

  const startScan = async () => {
    if (!nfcSupported) return;
    setStatus("scanning");
    setResult(null);
    setErrorMsg("");
    try {
      const ndef = new (window as any).NDEFReader();
      ndefRef.current = ndef;
      await ndef.scan();
      ndef.addEventListener("reading", (event: any) => {
        const nfc_id = event.serialNumber || "";
        escaneoMutation.mutate({ nfc_id, fecha: hoy() });
      });
    } catch {
      setStatus("error");
      setErrorMsg("Permiso denegado o NFC no disponible.");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const cancelScan = () => {
    setStatus("idle");
    ndefRef.current = null;
  };

  const filtrados = colaboradores.filter((c) =>
    !search || c.nombre_completo.toLowerCase().includes(search.toLowerCase()) || c.area.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 500, margin: "0 auto" }}>

      {/* ── Bloque NFC — siempre visible ── */}
      <div style={{ marginBottom: 24 }}>
        {/* Estado: idle o no soportado */}
        {status === "idle" && (
          nfcSupported ? (
            <button
              onClick={startScan}
              style={{
                width: "100%", padding: "28px 20px", fontSize: 18, fontWeight: 700,
                background: "#0d2b4e", color: "#fff", border: "none", cursor: "pointer",
                borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
              }}
            >
              <span style={{ fontSize: 34 }}>📡</span>
              <span>Escanear NFC<br /><span style={{ fontSize: 12, fontWeight: 400, opacity: 0.75 }}>Marca salida o entrada automáticamente</span></span>
            </button>
          ) : (
            <div style={{ padding: "22px 20px", background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: 6, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📡</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#374151", marginBottom: 4 }}>Escaneo NFC</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Solo disponible en <strong>Android Chrome</strong> con NFC activado.<br />
                En este dispositivo usa el registro manual de abajo.
              </div>
            </div>
          )
        )}

        {/* Estado: escaneando */}
        {status === "scanning" && (
          <div style={{ padding: "28px 20px", background: "#eff6ff", border: "2px solid #3b82f6", borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>📡</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>Acerca el tag NFC…</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>El dispositivo está listo para leer</div>
            <button onClick={cancelScan} style={{ background: "none", border: "1px solid #9ca3af", padding: "6px 18px", cursor: "pointer", color: "#6b7280", fontSize: 13, borderRadius: 4 }}>
              Cancelar
            </button>
          </div>
        )}

        {/* Estado: éxito */}
        {status === "success" && result && <ScanResultCard registro={result.registro} />}

        {/* Estado: error */}
        {(status === "error" || status === "not-found") && (
          <div style={{ padding: "22px 20px", background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 4 }}>
              {status === "not-found" ? "Tag no registrado" : "Error de escaneo"}
            </div>
            <div style={{ fontSize: 13, color: "#7f1d1d" }}>{errorMsg}</div>
          </div>
        )}
      </div>

      {/* ── Registro manual (colapsable) ── */}
      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 0", background: "none", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700, color: "#374151",
          }}
        >
          <span>Registro manual</span>
          <span style={{ fontSize: 18, lineHeight: 1, color: "#9ca3af" }}>{showManual ? "▲" : "▼"}</span>
        </button>

        {showManual && (
          <div style={{ paddingBottom: 12 }}>
            {/* Dropdown colaborador */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Colaborador</label>
              <select value={manualColabId} onChange={(e) => setManualColabId(e.target.value)}>
                <option value="">— Seleccionar colaborador —</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.nombre_completo} — {c.area}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Tipo</label>
              <select value={manualTipo} onChange={(e) => setManualTipo(e.target.value)}>
                <option value="salida_comedor">Salida al comedor</option>
                <option value="entrada_produccion">Entrada a producción</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-primario"
              style={{ width: "100%" }}
              disabled={!manualColabId || manualMutation.isPending}
              onClick={() => {
                if (!manualColabId) return;
                manualMutation.mutate({
                  colaborador_id: parseInt(manualColabId),
                  fecha: hoy(),
                  tipo_movimiento: manualTipo,
                  turno: manualTurno,
                });
              }}
            >
              {manualMutation.isPending ? "Registrando…" : "Registrar"}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

function ScanResultCard({ registro }: { registro: Registro }) {
  const col = colorTipo(registro.tipo_movimiento);
  return (
    <div style={{ padding: "20px 16px", background: col.bg, border: `2px solid ${col.border}`, borderRadius: 8, marginBottom: 16 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{iconTipo(registro.tipo_movimiento)}</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: col.color, marginBottom: 4 }}>
        {labelTipo(registro.tipo_movimiento)}
      </div>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{registro.nombre_completo}</div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{registro.area} — {registro.hora_registro}</div>
    </div>
  );
}

// ── Historial View ────────────────────────────────────────────────────────────

type Rango = "diario" | "semanal" | "mensual";

function ViajeCard({ v, onDelete }: { v: Viaje; onDelete: (id: number, nombre: string) => void }) {
  useInterval(30000); // re-render cada 30s para actualizar el timer
  const mins = v.entrada ? null : minutosDesde(v.salida.fecha, v.salida.hora_registro);
  const sem = mins !== null ? semaforo(mins) : null;

  return (
    <div className="tabla-card">
      <div className="tabla-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar url={v.foto_url} name={v.nombre_completo} size={38} />
          <div style={{ minWidth: 0 }}>
            <div className="tabla-card-title">{v.nombre_completo}</div>
            <div className="tabla-card-meta">{v.area}</div>
          </div>
        </div>
        {sem ? (
          <span style={{ background: sem.bg, color: sem.color, border: `1px solid ${sem.border}`, padding: "4px 10px", fontSize: 13, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
            {formatMinutos(mins!)}
          </span>
        ) : (
          <span style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", padding: "3px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            ✓ Regresó
          </span>
        )}
      </div>
      <div className="tabla-card-row">
        <div className="tabla-card-field">
          <span className="tabla-card-label">🍽️ Salida</span>
          <span className="tabla-card-value">{v.salida.hora_registro.slice(0, 5)}</span>
        </div>
        <div className="tabla-card-field">
          <span className="tabla-card-label">🏭 Regreso</span>
          <span className="tabla-card-value">{v.entrada ? v.entrada.hora_registro.slice(0, 5) : "—"}</span>
        </div>
        {v.entrada && (
          <div className="tabla-card-field">
            <span className="tabla-card-label">Tiempo</span>
            <span className="tabla-card-value">{formatMinutos(minutosDesde(v.salida.fecha, v.salida.hora_registro) - minutosDesde(v.entrada.fecha, v.entrada.hora_registro))}</span>
          </div>
        )}
      </div>
      <div className="tabla-card-actions">
        <button type="button" className="btn-accion rojo" onClick={() => onDelete(v.salida.id, v.nombre_completo)}>Eliminar salida</button>
        {v.entrada && <button type="button" className="btn-accion rojo" onClick={() => onDelete(v.entrada!.id, v.nombre_completo)}>Eliminar entrada</button>}
      </div>
    </div>
  );
}

function EnCemedorLive({ viajes }: { viajes: Viaje[] }) {
  useInterval(30000);
  const enComedor = viajes.filter((v) => !v.entrada);
  if (enComedor.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
        🍽️ En comedor ahora ({enComedor.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {enComedor.map((v) => {
          const mins = minutosDesde(v.salida.fecha, v.salida.hora_registro);
          const sem = semaforo(mins);
          return (
            <div key={v.salida.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: sem.bg, border: `1px solid ${sem.border}`, borderLeft: `4px solid ${sem.color}` }}>
              <Avatar url={v.foto_url} name={v.nombre_completo} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#111" }}>{v.nombre_completo}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Salió a las {v.salida.hora_registro.slice(0, 5)}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: sem.color }}>{formatMinutos(mins)}</div>
                <div style={{ fontSize: 10, color: sem.color }}>{mins >= 60 ? "⚠️ Límite superado" : mins >= 45 ? "⏰ Próximo al límite" : "✓ En tiempo"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistorialView() {
  const confirm = useConfirm();
  const notify = useNotify();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const [rango, setRango] = useState<Rango>("diario");
  const [refDate, setRefDate] = useState(hoy());

  const desde = rango === "diario" ? refDate : startOf(rango, refDate);
  const hasta = rango === "diario" ? refDate : endOf(rango, refDate);
  const esHoy = refDate === hoy() && rango === "diario";

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["registro-comida", desde, hasta],
    queryFn: () => apiFetch(`${API_BASE_URL}/api/registro-comida?fecha_inicio=${desde}&fecha_fin=${hasta}`),
    refetchInterval: esHoy ? 30000 : false, // auto-refresh solo para hoy
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`${API_BASE_URL}/api/registro-comida/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registro-comida"] });
      notify("Registro eliminado.", "success");
    },
    onError: (err: any) => notify(err.message ?? "Error.", "error"),
  });

  const handleDelete = async (id: number, nombre: string) => {
    const ok = await confirm({ title: "Eliminar registro", message: `¿Eliminar el registro de ${nombre}?` });
    if (ok) deleteMutation.mutate(id);
  };

  const navDate = (dir: -1 | 1) => {
    const d = new Date(refDate + "T12:00:00");
    if (rango === "diario") d.setDate(d.getDate() + dir);
    else if (rango === "semanal") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setRefDate(d.toISOString().slice(0, 10));
  };

  const registros = data?.data ?? [];
  const viajes = armarViajes(registros);
  const enComedor = viajes.filter((v) => !v.entrada).length;
  const completados = viajes.filter((v) => v.entrada).length;

  return (
    <div>
      {/* ── Tabs rango ── */}
      <div style={{ display: "flex", marginBottom: 12, border: "1px solid #d1d5db", borderRadius: 6, overflow: "hidden" }}>
        {(["diario", "semanal", "mensual"] as Rango[]).map((r) => (
          <button key={r} onClick={() => setRango(r)} style={{ flex: 1, padding: isMobile ? "8px 4px" : "7px 16px", fontSize: isMobile ? 12 : 13, fontWeight: rango === r ? 700 : 400, background: rango === r ? "#0d2b4e" : "#fff", color: rango === r ? "#fff" : "#374151", border: "none", borderRight: "1px solid #d1d5db", cursor: "pointer" }}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Navegación fecha ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <button onClick={() => navDate(-1)} style={{ background: "#f3f4f6", border: "1px solid #d1d5db", padding: "6px 12px", cursor: "pointer", fontSize: 16, borderRadius: 4, flexShrink: 0 }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {rango === "diario" ? (
            <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} style={{ width: "100%", fontSize: 13, padding: "6px 8px" }} />
          ) : (
            <div style={{ fontSize: 12, color: "#374151", textAlign: "center", padding: "6px 0" }}>{desde} → {hasta}</div>
          )}
        </div>
        <button onClick={() => navDate(1)} style={{ background: "#f3f4f6", border: "1px solid #d1d5db", padding: "6px 12px", cursor: "pointer", fontSize: 16, borderRadius: 4, flexShrink: 0 }}>›</button>
        <button onClick={() => setRefDate(hoy())} style={{ fontSize: 12, background: "#fff", border: "1px solid #d1d5db", padding: "6px 10px", cursor: "pointer", color: "#6b7280", borderRadius: 4, flexShrink: 0 }}>Hoy</button>
      </div>

      {/* ── Stats ── */}
      {!isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "🍽️ En comedor", value: enComedor, bg: enComedor > 0 ? "#fffbeb" : "#f8fafc", color: enComedor > 0 ? "#b45309" : "#374151" },
            { label: "✓ Completados", value: completados, bg: "#f0fdf4", color: "#15803d" },
            { label: "Total salidas", value: viajes.length, bg: "#f8fafc", color: "#374151" },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, border: "1px solid #e5e7eb", padding: "8px 6px", textAlign: "center", borderRadius: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="vacio">Cargando…</div>
      ) : registros.length === 0 ? (
        <div className="vacio card">Sin registros para este período.</div>
      ) : (
        <>
          {/* ── En comedor ahora (solo hoy) ── */}
          {esHoy && <EnCemedorLive viajes={viajes} />}

          {/* ── Tabla de viajes ── */}
          {isMobile ? (
            <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
              <div className="tabla-cards">
                {viajes.map((v) => <ViajeCard key={v.salida.id} v={v} onDelete={handleDelete} />)}
              </div>
            </div>
          ) : (
            <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
              <div className="tabla-wrap">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Colaborador</th>
                      <th>🍽️ Salida</th>
                      <th>🏭 Regreso</th>
                      <th>Tiempo</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {viajes.map((v, i) => {
                      const mins = v.entrada
                        ? minutosDesde(v.salida.fecha, v.salida.hora_registro) - minutosDesde(v.entrada.fecha, v.entrada.hora_registro)
                        : minutosDesde(v.salida.fecha, v.salida.hora_registro);
                      const sem = v.entrada ? { bg: "#f8fafc", color: "#374151", border: "#e5e7eb" } : semaforo(mins);
                      return (
                        <tr key={v.salida.id}>
                          <td style={{ color: "#999", fontSize: 11 }}>{i + 1}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar url={v.foto_url} name={v.nombre_completo} size={28} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{v.nombre_completo}</div>
                                <div style={{ fontSize: 11, color: "#777" }}>{v.area}</div>
                              </div>
                            </div>
                          </td>
                          <td className="font-mono" style={{ fontSize: 13 }}>{v.salida.hora_registro.slice(0, 5)}</td>
                          <td className="font-mono" style={{ fontSize: 13 }}>{v.entrada ? v.entrada.hora_registro.slice(0, 5) : <span style={{ color: "#9ca3af" }}>—</span>}</td>
                          <td>
                            <span style={{ background: sem.bg, color: sem.color, border: `1px solid ${sem.border}`, padding: "2px 8px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                              {formatMinutos(mins)}
                            </span>
                          </td>
                          <td>
                            {v.entrada
                              ? <span style={{ color: "#15803d", fontSize: 12, fontWeight: 600 }}>✓ Regresó</span>
                              : <span style={{ color: sem.color, fontSize: 12, fontWeight: 600 }}>{mins >= 60 ? "⚠️ Excedido" : mins >= 45 ? "⏰ Por llegar" : "En comedor"}</span>
                            }
                          </td>
                          <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                            <button type="button" className="btn-accion rojo" onClick={() => handleDelete(v.salida.id, v.nombre_completo)} style={{ marginRight: 4 }}>↑ Sal.</button>
                            {v.entrada && <button type="button" className="btn-accion rojo" onClick={() => handleDelete(v.entrada!.id, v.nombre_completo)}>↓ Ent.</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type Vista = "scanner" | "historial";

export default function RegistroComida() {
  const [vista, setVista] = useState<Vista>("scanner");

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "#0d2b4e" }}>Registro de Comida</h1>
        <div style={{ display: "flex", gap: 0 }}>
          {(["scanner", "historial"] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              style={{
                padding: "8px 18px", fontSize: 13, fontWeight: vista === v ? 700 : 400,
                background: vista === v ? "#0d2b4e" : "#fff",
                color: vista === v ? "#fff" : "#374151",
                border: `1px solid ${vista === v ? "#0d2b4e" : "#d1d5db"}`,
                cursor: "pointer",
              }}
            >
              {v === "scanner" ? "📡 Escáner" : "📋 Historial"}
            </button>
          ))}
        </div>
      </div>

      {vista === "scanner" ? <ScannerView /> : <HistorialView />}
    </div>
  );
}
