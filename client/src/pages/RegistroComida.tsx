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

// Fecha local del dispositivo en formato YYYY-MM-DD (no UTC)
function hoy(): string {
  return new Date().toLocaleDateString("en-CA"); // en-CA da YYYY-MM-DD
}

// Hora local del dispositivo en formato HH:MM (24h, para enviar al servidor)
function localHora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Convierte "HH:MM" o "HH:MM:SS" a formato 12h con AM/PM
function formatHora12(hora: string): string {
  const raw = String(hora ?? "").slice(0, 5);
  const [hStr, mStr] = raw.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return raw || "—";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
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

interface ResultadoViajes {
  viajes: Viaje[];
  huerfanos: Registro[]; // entrada_produccion sin salida_comedor previa
}

function armarViajes(registros: Registro[]): ResultadoViajes {
  const por: Record<number, Registro[]> = {};
  for (const r of registros) {
    if (!por[r.colaborador_id]) por[r.colaborador_id] = [];
    por[r.colaborador_id].push(r);
  }
  const viajes: Viaje[] = [];
  const huerfanos: Registro[] = [];
  for (const lista of Object.values(por)) {
    lista.sort((a, b) => (a.hora_registro ?? "").localeCompare(b.hora_registro ?? ""));
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
        // entrada_produccion sin salida previa → huérfano visible y editable
        huerfanos.push(r);
        i++;
      }
    }
  }
  viajes.sort((a, b) => {
    if (!a.entrada && b.entrada) return -1;
    if (a.entrada && !b.entrada) return 1;
    return (b.salida.hora_registro ?? "").localeCompare(a.salida.hora_registro ?? "");
  });
  return { viajes, huerfanos };
}

// Parsea fecha (puede ser "YYYY-MM-DD" o "YYYY-MM-DDTHH:MM:SS.sssZ" cuando pg serializa DATE)
// y hora (puede incluir microsegundos "HH:MM:SS.ffffff") a un Date válido.
function parseHora(fecha: string, hora: string): Date {
  const d = String(fecha ?? "").slice(0, 10); // siempre "YYYY-MM-DD"
  const h = String(hora ?? "00:00:00").slice(0, 8).padEnd(8, ":00"); // "HH:MM:SS"
  return new Date(`${d}T${h}`);
}

// Minutos transcurridos desde fecha+hora hasta ahora
function minutosDesde(fecha: string, hora: string): number {
  const t = parseHora(fecha, hora).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

// Duración entre dos registros en minutos
function duracionMinutos(salida: Registro, entrada: Registro): number {
  const tSal = parseHora(salida.fecha, salida.hora_registro).getTime();
  const tEnt = parseHora(entrada.fecha, entrada.hora_registro).getTime();
  if (isNaN(tSal) || isNaN(tEnt)) return 0;
  return Math.max(0, Math.floor((tEnt - tSal) / 60000));
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

// ── Dropdown custom (evita el picker nativo de Android) ──────────────────────

interface SelectOpt { value: string; label: string }

function CustomSelect({ value, onChange, options, placeholder, searchable }: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOpt[];
  placeholder?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setQ(""); return; }
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    if (searchable) setTimeout(() => searchRef.current?.focus(), 50);
    return () => document.removeEventListener("mousedown", close);
  }, [open, searchable]);

  const selected = options.find((o) => o.value === value);
  const filtered = searchable && q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", padding: "9px 12px",
          background: "#fff", border: "1px solid #d1d5db", borderRadius: 4,
          textAlign: "left", cursor: "pointer", fontSize: 14,
          color: selected ? "#111827" : "#9ca3af",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: open ? "0 0 0 2px #93c5fd" : "none",
          outline: "none",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selected?.label ?? placeholder ?? "Seleccionar…"}
        </span>
        <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, marginLeft: 6 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 200,
          background: "#fff", border: "1px solid #d1d5db", borderRadius: 4,
          boxShadow: "0 6px 16px rgba(0,0,0,0.12)", maxHeight: 300, overflowY: "auto",
        }}>
          {searchable && (
            <div style={{ padding: "8px", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, background: "#fff" }}>
              <input
                ref={searchRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar…"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%", padding: "7px 10px", fontSize: 13,
                  border: "1px solid #d1d5db", borderRadius: 4, outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
          {placeholder && !q && (
            <div
              onClick={() => { onChange(""); setOpen(false); }}
              style={{ padding: "10px 12px", fontSize: 13, color: "#9ca3af", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
            >
              {placeholder}
            </div>
          )}
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "#9ca3af" }}>Sin resultados</div>
          ) : filtered.map((o) => (
            <div
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                padding: "10px 12px", fontSize: 13, cursor: "pointer",
                background: o.value === value ? "#eff6ff" : "transparent",
                color: o.value === value ? "#1d4ed8" : "#111827",
                fontWeight: o.value === value ? 600 : 400,
                borderBottom: "1px solid #f9fafb",
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

// Módulo-level: persisten aunque el componente se desmonte (cambio de tab)
let _nfcLastScanTs = 0;
let _nfcScanning = false;

type NfcStatus = "idle" | "scanning" | "error" | "not-found";

function ScannerView() {
  const notify = useNotify();
  const qc = useQueryClient();
  const [status, setStatus] = useState<NfcStatus>("idle");
  const [lastResult, setLastResult] = useState<Registro | null>(null);
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

  const todayStr = hoy();
  const { data: estadoHoy } = useQuery<{
    ultimoTipo: string | null;
    tieneSalida: boolean;
    tieneEntrada: boolean;
    cicloCompleto: boolean;
    tipo_sugerido: "salida_comedor" | "entrada_produccion";
  }>({
    queryKey: ["registro-comida-estado", manualColabId, todayStr],
    queryFn: () => apiFetch(`${API_BASE_URL}/api/registro-comida/estado-hoy/${manualColabId}?fecha=${todayStr}`),
    enabled: !!manualColabId,
    staleTime: 5000,
  });

  useEffect(() => {
    if (estadoHoy) setManualTipo(estadoHoy.tipo_sugerido);
  }, [estadoHoy]);

  const escaneoMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch<Registro>(`${API_BASE_URL}/api/registro-comida/escaneo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["registro-comida"] });
      qc.invalidateQueries({ queryKey: ["registro-comida-estado"] });
      setLastResult(data);
      setStatus("idle");
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
      qc.invalidateQueries({ queryKey: ["registro-comida"] });
      qc.invalidateQueries({ queryKey: ["registro-comida-estado"] });
      setLastResult(data);
      setManualColabId("");
    },
    onError: (err: any) => {
      notify(err.message ?? "Error al registrar.", "error");
    },
  });

  const startScan = async () => {
    if (!nfcSupported) return;
    setStatus("scanning");
    setErrorMsg("");
    try {
      const ndef = new (window as any).NDEFReader();
      ndefRef.current = ndef;
      await ndef.scan();
      ndef.addEventListener("reading", (event: any) => {
        // Guard 1: variable de módulo — no se resetea al cambiar de tab
        if (_nfcScanning) return;
        // Guard 2: cooldown de 3s entre escaneos válidos
        const now = Date.now();
        if (now - _nfcLastScanTs < 3000) return;
        _nfcScanning = true;
        _nfcLastScanTs = now;
        const nfc_id = event.serialNumber || "";
        escaneoMutation.mutate(
          { nfc_id, fecha: hoy(), hora: localHora() },
          { onSettled: () => { _nfcScanning = false; } },
        );
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

      {/* ── Último registro (persiste hasta descartar o nuevo escaneo) ── */}
      {lastResult && (
        <ScanResultCard registro={lastResult} onDismiss={() => setLastResult(null)} />
      )}

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
              <CustomSelect
                value={manualColabId}
                onChange={setManualColabId}
                placeholder="— Seleccionar colaborador —"
                searchable
                options={colaboradores.map((c) => ({ value: String(c.id), label: `${c.nombre_completo} — ${c.area}` }))}
              />
            </div>

            {estadoHoy?.cicloCompleto ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 4, padding: "10px 12px", fontSize: 13, color: "#15803d", fontWeight: 600 }}>
                ✓ Ciclo completo — este colaborador ya tiene salida y entrada registradas para hoy.
              </div>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Tipo</label>
                  <CustomSelect
                    value={manualTipo}
                    onChange={setManualTipo}
                    options={[
                      ...(!manualColabId || !estadoHoy?.tieneSalida
                        ? [{ value: "salida_comedor", label: "🍽️ Salida al comedor" }]
                        : []),
                      { value: "entrada_produccion", label: "🏭 Entrada a producción" },
                    ]}
                  />
                  {estadoHoy?.tieneSalida && !estadoHoy?.cicloCompleto && (
                    <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
                      ⚡ Ya tiene salida registrada — solo se puede registrar entrada a producción
                    </div>
                  )}
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
                      hora_registro: localHora(),
                      tipo_movimiento: manualTipo,
                      turno: manualTurno,
                    });
                  }}
                >
                  {manualMutation.isPending ? "Registrando…" : "Registrar"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

function ScanResultCard({ registro, onDismiss }: { registro: Registro; onDismiss: () => void }) {
  useInterval(30000);
  const esSalida = registro.tipo_movimiento === "salida_comedor";
  const mins = esSalida ? minutosDesde(registro.fecha, registro.hora_registro) : null;
  const sem = mins !== null ? semaforo(mins) : { bg: "#f0fdf4", color: "#15803d", border: "#86efac" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
      background: sem.bg, border: `1px solid ${sem.border}`, borderLeft: `4px solid ${sem.color}`,
      borderRadius: 6, marginBottom: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{registro.nombre_completo}</div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {registro.area} · {esSalida ? "Salió" : "Regresó"} a las {formatHora12(registro.hora_registro)}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {esSalida && mins !== null ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, color: sem.color }}>{formatMinutos(mins)}</div>
            <div style={{ fontSize: 10, color: sem.color }}>
              {mins >= 60 ? "⚠️ Excedió el límite" : mins >= 45 ? "⏰ Próximo al límite" : "✓ En tiempo"}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>✓ Regresó</div>
        )}
      </div>
      <button type="button" onClick={onDismiss}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af", padding: "0 0 0 6px", flexShrink: 0, lineHeight: 1 }}>
        ✕
      </button>
    </div>
  );
}

// ── Edición inline de tipo ────────────────────────────────────────────────────

function TipoEditable({ registro, onSaved }: { registro: Registro; onSaved: () => void }) {
  const notify = useNotify();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(registro.tipo_movimiento);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/registro-comida/${registro.id}/tipo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_movimiento: valor }),
      });
      setEditando(false);
      onSaved();
    } catch (err: any) {
      notify(err.message ?? "Error al guardar el tipo.", "error");
    } finally {
      setGuardando(false);
    }
  };

  if (editando) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <select value={valor} onChange={(e) => setValor(e.target.value as "salida_comedor" | "entrada_produccion")} style={{ fontSize: 12, padding: "2px 4px" }}>
          <option value="salida_comedor">🍽️ Salida comedor</option>
          <option value="entrada_produccion">🏭 Entrada producción</option>
        </select>
        <button type="button" onClick={guardar} disabled={guardando}
          style={{ background: "#0d2b4e", color: "#fff", border: "none", padding: "2px 8px", fontSize: 12, cursor: "pointer" }}>
          {guardando ? "…" : "✓"}
        </button>
        <button type="button" onClick={() => setEditando(false)}
          style={{ background: "none", border: "1px solid #d1d5db", padding: "2px 6px", fontSize: 12, cursor: "pointer", color: "#6b7280" }}>
          ✕
        </button>
      </span>
    );
  }

  const col = colorTipo(registro.tipo_movimiento);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}`, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
        {iconTipo(registro.tipo_movimiento)} {labelTipo(registro.tipo_movimiento)}
      </span>
      <button type="button" onClick={() => setEditando(true)}
        title="Cambiar tipo"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", padding: "0 2px", lineHeight: 1 }}>
        ✎
      </button>
    </span>
  );
}

// ── Card para registro huérfano ───────────────────────────────────────────────

function RegistroHuerfanoCard({ r, onDelete, onRefresh }: { r: Registro; onDelete: (id: number, nombre: string) => void; onRefresh: () => void }) {
  return (
    <div className="tabla-card" style={{ borderLeft: "4px solid #f59e0b", background: "#fffbeb" }}>
      <div className="tabla-card-header">
        <div style={{ minWidth: 0 }}>
          <div className="tabla-card-title">{r.nombre_completo}</div>
          <div className="tabla-card-meta">{r.area}</div>
        </div>
        <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", padding: "3px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          ⚠️ Sin par
        </span>
      </div>
      <div className="tabla-card-row">
        <div className="tabla-card-field">
          <span className="tabla-card-label">Tipo</span>
          <TipoEditable registro={r} onSaved={onRefresh} />
        </div>
        <div className="tabla-card-field">
          <span className="tabla-card-label">Hora</span>
          <HoraEditable registro={r} onSaved={onRefresh} />
        </div>
      </div>
      <div className="tabla-card-actions">
        <button type="button" className="btn-accion rojo" onClick={() => onDelete(r.id, r.nombre_completo)}>Eliminar</button>
      </div>
    </div>
  );
}

// ── Historial View ────────────────────────────────────────────────────────────

type Rango = "diario" | "semanal" | "mensual";

// ── Edición inline de hora ────────────────────────────────────────────────────

function HoraEditable({ registro, onSaved }: { registro: Registro; onSaved: () => void }) {
  const notify = useNotify();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState((registro.hora_registro ?? "00:00").slice(0, 5));
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/registro-comida/${registro.id}/hora`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hora_registro: valor }),
      });
      setEditando(false);
      onSaved();
    } catch (err: any) {
      notify(err.message ?? "Error al guardar la hora.", "error");
    } finally {
      setGuardando(false);
    }
  };

  if (editando) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <input
          type="time"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          style={{ fontSize: 13, padding: "2px 4px", width: 90 }}
        />
        <button type="button" onClick={guardar} disabled={guardando}
          style={{ background: "#0d2b4e", color: "#fff", border: "none", padding: "2px 8px", fontSize: 12, cursor: "pointer" }}>
          {guardando ? "…" : "✓"}
        </button>
        <button type="button" onClick={() => setEditando(false)}
          style={{ background: "none", border: "1px solid #d1d5db", padding: "2px 6px", fontSize: 12, cursor: "pointer", color: "#6b7280" }}>
          ✕
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{formatHora12(registro.hora_registro)}</span>
      <button type="button" onClick={() => setEditando(true)}
        title="Editar hora"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", padding: "0 2px", lineHeight: 1 }}>
        ✎
      </button>
    </span>
  );
}

// ── ViajeCard ─────────────────────────────────────────────────────────────────

function ViajeCard({ v, onDeletePair, onRefresh }: { v: Viaje; onDeletePair: (ids: number[], nombre: string) => void; onRefresh: () => void }) {
  useInterval(30000);
  const mins = v.entrada ? null : minutosDesde(v.salida.fecha, v.salida.hora_registro);
  const sem = mins !== null ? semaforo(mins) : null;

  return (
    <div className="tabla-card" style={{ borderLeft: sem ? `4px solid ${sem.color}` : `4px solid #86efac` }}>
      <div className="tabla-card-header">
        <div style={{ minWidth: 0 }}>
          <div className="tabla-card-title">{v.nombre_completo}</div>
          <div className="tabla-card-meta">{v.area}</div>
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
          <HoraEditable registro={v.salida} onSaved={onRefresh} />
        </div>
        <div className="tabla-card-field">
          <span className="tabla-card-label">🏭 Regreso</span>
          {v.entrada
            ? <HoraEditable registro={v.entrada} onSaved={onRefresh} />
            : <span style={{ color: "#9ca3af" }}>—</span>}
        </div>
        {v.entrada && (
          <div className="tabla-card-field">
            <span className="tabla-card-label">Tiempo</span>
            <span className="tabla-card-value">{formatMinutos(duracionMinutos(v.salida, v.entrada))}</span>
          </div>
        )}
      </div>
      <div className="tabla-card-actions">
        <button type="button" className="btn-accion rojo" onClick={() => onDeletePair([v.salida.id, ...(v.entrada ? [v.entrada.id] : [])], v.nombre_completo)}>Eliminar visita</button>
      </div>
    </div>
  );
}

// ── En comedor (live) ─────────────────────────────────────────────────────────

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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#111" }}>{v.nombre_completo}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{v.area} · Salió a las {formatHora12(v.salida.hora_registro)}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: sem.color }}>{formatMinutos(mins)}</div>
                <div style={{ fontSize: 10, color: sem.color }}>
                  {mins >= 60 ? "⚠️ Excedió el límite" : mins >= 45 ? "⏰ Próximo al límite" : "✓ En tiempo"}
                </div>
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
    refetchInterval: esHoy ? 10000 : false, // auto-refresh cada 10s solo para hoy
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

  const deletePairMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch(`${API_BASE_URL}/api/registro-comida/par`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registro-comida"] });
      notify("Visita eliminada.", "success");
    },
    onError: (err: any) => notify(err.message ?? "Error.", "error"),
  });

  const handleDelete = async (id: number, nombre: string) => {
    const ok = await confirm({ title: "Eliminar registro", message: `¿Eliminar el registro de ${nombre}?` });
    if (ok) deleteMutation.mutate(id);
  };

  const handleDeletePair = async (ids: number[], nombre: string) => {
    const count = ids.length;
    const ok = await confirm({ title: "Eliminar visita", message: `¿Eliminar ${count === 2 ? "los 2 registros" : "el registro"} de ${nombre}?` });
    if (ok) deletePairMutation.mutate(ids);
  };

  const navDate = (dir: -1 | 1) => {
    const d = new Date(refDate + "T12:00:00");
    if (rango === "diario") d.setDate(d.getDate() + dir);
    else if (rango === "semanal") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setRefDate(d.toISOString().slice(0, 10));
  };

  const registros = data?.data ?? [];
  const { viajes, huerfanos } = armarViajes(registros);
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
          {viajes.length > 0 && (isMobile ? (
            <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
              <div className="tabla-cards">
                {viajes.map((v) => <ViajeCard key={v.salida.id} v={v} onDeletePair={handleDeletePair} onRefresh={() => qc.invalidateQueries({ queryKey: ["registro-comida"] })} />)}
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
                        ? duracionMinutos(v.salida, v.entrada)
                        : minutosDesde(v.salida.fecha, v.salida.hora_registro);
                      const sem = v.entrada ? { bg: "#f8fafc", color: "#374151", border: "#e5e7eb" } : semaforo(mins);
                      return (
                        <tr key={v.salida.id}>
                          <td style={{ color: "#999", fontSize: 11 }}>{i + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{v.nombre_completo}</div>
                            <div style={{ fontSize: 11, color: "#777" }}>{v.area}</div>
                          </td>
                          <td><HoraEditable registro={v.salida} onSaved={() => qc.invalidateQueries({ queryKey: ["registro-comida"] })} /></td>
                          <td>{v.entrada ? <HoraEditable registro={v.entrada} onSaved={() => qc.invalidateQueries({ queryKey: ["registro-comida"] })} /> : <span style={{ color: "#9ca3af" }}>—</span>}</td>
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
                            <button type="button" className="btn-accion rojo" onClick={() => handleDeletePair([v.salida.id, ...(v.entrada ? [v.entrada.id] : [])], v.nombre_completo)}>Eliminar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* ── Registros sin par (huérfanos) ── */}
          {huerfanos.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                ⚠️ Registros sin par ({huerfanos.length})
                <span style={{ fontSize: 11, fontWeight: 400, color: "#b45309" }}>— Cambia el tipo o elimínalos para limpiar el historial</span>
              </div>
              {isMobile ? (
                <div className="tabla-cards">
                  {huerfanos.map((r) => (
                    <RegistroHuerfanoCard key={r.id} r={r} onDelete={handleDelete} onRefresh={() => qc.invalidateQueries({ queryKey: ["registro-comida"] })} />
                  ))}
                </div>
              ) : (
                <div style={{ border: "1px solid #fcd34d", background: "#fffbeb" }}>
                  <div className="tabla-wrap">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Colaborador</th>
                          <th>Tipo</th>
                          <th>Hora</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {huerfanos.map((r) => (
                          <tr key={r.id} style={{ background: "#fffbeb" }}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.nombre_completo}</div>
                              <div style={{ fontSize: 11, color: "#777" }}>{r.area}</div>
                            </td>
                            <td><TipoEditable registro={r} onSaved={() => qc.invalidateQueries({ queryKey: ["registro-comida"] })} /></td>
                            <td><HoraEditable registro={r} onSaved={() => qc.invalidateQueries({ queryKey: ["registro-comida"] })} /></td>
                            <td>
                              <button type="button" className="btn-accion rojo" onClick={() => handleDelete(r.id, r.nombre_completo)}>Eliminar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
