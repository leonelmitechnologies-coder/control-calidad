import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { useConfirm } from "../context/ConfirmContext";
import { useNotify } from "../context/NotifyContext";
import { useIsMobile } from "../hooks/useIsMobile";

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
            {/* Buscador */}
            <div className="form-group" style={{ marginBottom: 10 }}>
              <input type="text" placeholder="Buscar colaborador…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {/* Lista */}
            <div style={{ border: "1px solid #e2e2e2", maxHeight: 220, overflowY: "auto", marginBottom: 12 }}>
              {filtrados.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: "#999", textAlign: "center" }}>Sin resultados.</div>
              ) : (
                filtrados.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setManualColabId(String(c.id))}
                    style={{
                      padding: "8px 14px", cursor: "pointer", borderBottom: "1px solid #f0f0f0",
                      background: manualColabId === String(c.id) ? "#e8f0fd" : "transparent",
                      borderLeft: `3px solid ${manualColabId === String(c.id) ? "#0d2b4e" : "transparent"}`,
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <Avatar url={c.foto_url} name={c.nombre_completo} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre_completo}</div>
                      <div style={{ fontSize: 11, color: "#777" }}>{c.area} — {c.puesto}</div>
                    </div>
                  </div>
                ))
              )}
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

function HistorialView() {
  const confirm = useConfirm();
  const notify = useNotify();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const [rango, setRango] = useState<Rango>("diario");
  const [refDate, setRefDate] = useState(hoy());
  const [turnoFiltro, setTurnoFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");

  const desde = rango === "diario" ? refDate : startOf(rango, refDate);
  const hasta = rango === "diario" ? refDate : endOf(rango, refDate);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["registro-comida", desde, hasta, turnoFiltro, tipoFiltro],
    queryFn: () => {
      const qs = new URLSearchParams({ fecha_inicio: desde, fecha_fin: hasta });
      if (turnoFiltro) qs.set("turno", turnoFiltro);
      if (tipoFiltro) qs.set("tipo_movimiento", tipoFiltro);
      return apiFetch(`${API_BASE_URL}/api/registro-comida?${qs}`);
    },
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
  const salidas = registros.filter((r) => r.tipo_movimiento === "salida_comedor").length;
  const entradas = registros.filter((r) => r.tipo_movimiento === "entrada_produccion").length;

  const rangoLabel = rango === "diario" ? refDate : `${desde} → ${hasta}`;

  return (
    <div>
      {/* ── Tabs rango ── */}
      <div style={{ display: "flex", marginBottom: 12, border: "1px solid #d1d5db", borderRadius: 6, overflow: "hidden" }}>
        {(["diario", "semanal", "mensual"] as Rango[]).map((r) => (
          <button
            key={r}
            onClick={() => setRango(r)}
            style={{
              flex: 1, padding: isMobile ? "8px 4px" : "7px 16px",
              fontSize: isMobile ? 12 : 13, fontWeight: rango === r ? 700 : 400,
              background: rango === r ? "#0d2b4e" : "#fff",
              color: rango === r ? "#fff" : "#374151",
              border: "none", borderRight: "1px solid #d1d5db",
              cursor: "pointer",
            }}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Navegación de fecha — todo en una fila ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => navDate(-1)}
          style={{ background: "#f3f4f6", border: "1px solid #d1d5db", padding: "6px 12px", cursor: "pointer", fontSize: 16, borderRadius: 4, flexShrink: 0 }}
        >‹</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {rango === "diario" ? (
            <input
              type="date"
              value={refDate}
              onChange={(e) => setRefDate(e.target.value)}
              style={{ width: "100%", fontSize: 13, padding: "6px 8px" }}
            />
          ) : (
            <div style={{ fontSize: 12, color: "#374151", textAlign: "center", padding: "6px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {desde} → {hasta}
            </div>
          )}
        </div>

        <button
          onClick={() => navDate(1)}
          style={{ background: "#f3f4f6", border: "1px solid #d1d5db", padding: "6px 12px", cursor: "pointer", fontSize: 16, borderRadius: 4, flexShrink: 0 }}
        >›</button>

        <button
          onClick={() => setRefDate(hoy())}
          style={{ fontSize: 12, background: "#fff", border: "1px solid #d1d5db", padding: "6px 10px", cursor: "pointer", color: "#6b7280", borderRadius: 4, flexShrink: 0 }}
        >Hoy</button>
      </div>

      {/* ── Filtros compactos en una fila ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3, textTransform: "uppercase" }}>Tipo</div>
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            style={{ width: "100%", fontSize: 13, padding: "6px 8px" }}
          >
            <option value="">Todos</option>
            <option value="salida_comedor">🍽️ Salida</option>
            <option value="entrada_produccion">🏭 Entrada</option>
          </select>
        </div>
      </div>

      {/* ── Stats compactas en una fila ── */}
      {!isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Total", value: registros.length, bg: "#f8fafc", color: "#374151" },
            { label: "🍽️ Salidas", value: salidas, bg: "#fef2f2", color: "#dc2626" },
            { label: "🏭 Entradas", value: entradas, bg: "#f0fdf4", color: "#16a34a" },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, border: "1px solid #e5e7eb", padding: "8px 6px", textAlign: "center", borderRadius: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Contenido */}
      {isLoading ? (
        <div className="vacio">Cargando…</div>
      ) : registros.length === 0 ? (
        <div className="vacio card">Sin registros para este período.</div>
      ) : isMobile ? (
        <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
          <div className="tabla-cards">
            {registros.map((r, i) => {
              const col = colorTipo(r.tipo_movimiento);
              return (
                <div key={r.id} className="tabla-card">
                  <div className="tabla-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Avatar url={r.foto_url} name={r.nombre_completo} size={38} />
                      <div style={{ minWidth: 0 }}>
                        <div className="tabla-card-meta">#{i + 1} · {r.fecha} · {r.hora_registro}</div>
                        <div className="tabla-card-title">{r.nombre_completo}</div>
                      </div>
                    </div>
                    <span style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}`, padding: "3px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {iconTipo(r.tipo_movimiento)} {labelTipo(r.tipo_movimiento)}
                    </span>
                  </div>
                  <div className="tabla-card-row">
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Área</span>
                      <span className="tabla-card-value">{r.area || "—"}</span>
                    </div>
                  </div>
                  <div className="tabla-card-actions">
                    <button type="button" className="btn-accion rojo" onClick={() => handleDelete(r.id, r.nombre_completo)}>Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Colaborador</th>
                  <th>Tipo</th>
                  <th>Hora</th>
                  <th>Fecha</th>
                  <th>Registrado por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => {
                  const col = colorTipo(r.tipo_movimiento);
                  return (
                    <tr key={r.id}>
                      <td style={{ color: "#999", fontSize: 11 }}>{i + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar url={r.foto_url} name={r.nombre_completo} size={28} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.nombre_completo}</div>
                            <div style={{ fontSize: 11, color: "#777" }}>{r.area}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}`, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {iconTipo(r.tipo_movimiento)} {labelTipo(r.tipo_movimiento)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap font-mono" style={{ fontSize: 12 }}>{r.hora_registro}</td>
                      <td className="whitespace-nowrap" style={{ fontSize: 12, color: "#777" }}>{r.fecha}</td>
                      <td className="whitespace-nowrap" style={{ fontSize: 12, color: "#777" }}>{r.registrado_por}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn-accion rojo" onClick={() => handleDelete(r.id, r.nombre_completo)}>Eliminar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
