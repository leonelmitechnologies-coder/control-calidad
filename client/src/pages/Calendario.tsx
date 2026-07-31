/**
 * Calendario — Gestión de solicitudes de vacaciones/permisos
 * Fiel al monolito: grid mensual, tabs, festivos, saldo, gestión
 */

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { useConfirm } from "../context/ConfirmContext";
import { useNotify } from "../context/NotifyContext";
import { useAuth } from "../hooks/useAuth";

// ── Constants ─────────────────────────────────────────────────────────────────

const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const DIAS_SEM = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const TIPOS = ["Vacaciones", "Permiso", "Incapacidad", "Capacitación"];
const AREAS_FILTRO = ["Incoming", "Sorting", "FFT", "Paletizado", "Almacen", "Shipping"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Solicitud {
  id: number;
  colaborador_id: number;
  nombre_completo: string;
  area?: string;
  tipo: string;
  estatus: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_habiles: number;
  motivo?: string;
  aprobado_por?: string;
  observaciones?: string;
  motivo_rechazo?: string;
  registrado_por?: string;
}

interface Colaborador {
  id: number;
  nombre_completo: string;
  puesto?: string;
  area?: string;
  estatus: string;
}

interface Festivo {
  id: number;
  nombre: string;
  fecha: string;
  recurrente: boolean;
}

interface SaldoRow {
  colaborador_id: number;
  anio: number | string;
  dias_asignados: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error ?? j?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esFestivo(date: Date, festivos: Festivo[]): boolean {
  const m = date.getMonth() + 1,
    d = date.getDate(),
    iso = date.toISOString().slice(0, 10);
  return festivos.some((f) => {
    if (f.recurrente) {
      const fd = new Date(f.fecha + "T00:00:00");
      return fd.getMonth() + 1 === m && fd.getDate() === d;
    }
    return f.fecha.slice(0, 10) === iso;
  });
}

function festivoNombre(date: Date, festivos: Festivo[]): string {
  const m = date.getMonth() + 1,
    d = date.getDate(),
    iso = date.toISOString().slice(0, 10);
  const f = festivos.find((f) => {
    if (f.recurrente) {
      const fd = new Date(f.fecha + "T00:00:00");
      return fd.getMonth() + 1 === m && fd.getDate() === d;
    }
    return f.fecha.slice(0, 10) === iso;
  });
  return f?.nombre ?? "";
}

function diasHabiles(inicio: string, fin: string, festivos: Festivo[]): number {
  if (!inicio || !fin) return 0;
  let count = 0;
  const d = new Date(inicio + "T00:00:00");
  const fFin = new Date(fin + "T00:00:00");
  while (d <= fFin) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !esFestivo(d, festivos)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Colores tipo para el grid del calendario (pequeños chips, se mantiene Tailwind-free via inline)
const TIPO_BG: Record<string, { bg: string; color: string }> = {
  vacaciones: { bg: "#dbeafe", color: "#1d4ed8" },
  permiso: { bg: "#fef9c3", color: "#a16207" },
  incapacidad: { bg: "#fee2e2", color: "#b91c1c" },
  capacitacion: { bg: "#ede9fe", color: "#7c3aed" },
};

function chipStyle(tipo: string): React.CSSProperties {
  const key = tipo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
  const c = TIPO_BG[key] ?? { bg: "#f3f4f6", color: "#374151" };
  return {
    background: c.bg,
    color: c.color,
    fontSize: "10px",
    padding: "0 4px",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: "2px",
    cursor: "pointer",
  };
}

function badgeEstatus(estatus: string) {
  switch (estatus) {
    case "pendiente":
      return "badge badge-pendiente";
    case "aprobado":
      return "badge badge-cerrada";
    case "rechazado":
      return "badge badge-rechazada";
    default:
      return "badge";
  }
}

// ── Modal Formulario ──────────────────────────────────────────────────────────

interface FormModalProps {
  solicitud: Solicitud | null;
  colaboradores: Colaborador[];
  festivos: Festivo[];
  solicitudes: Solicitud[];
  onClose: () => void;
  onSaved: () => void;
}

function FormModal({
  solicitud,
  colaboradores,
  festivos,
  solicitudes,
  onClose,
  onSaved,
}: FormModalProps) {
  const notify = useNotify();
  const [saving, setSaving] = useState(false);
  const [colaboradorId, setColaboradorId] = useState(
    solicitud?.colaborador_id ? String(solicitud.colaborador_id) : "",
  );
  const [area, setArea] = useState(solicitud?.area ?? "");
  const [tipo, setTipo] = useState(solicitud?.tipo ?? "");
  const [estatus, setEstatus] = useState(solicitud?.estatus ?? "pendiente");
  const [fechaInicio, setFechaInicio] = useState(
    solicitud?.fecha_inicio ? String(solicitud.fecha_inicio).slice(0, 10) : "",
  );
  const [fechaFin, setFechaFin] = useState(
    solicitud?.fecha_fin ? String(solicitud.fecha_fin).slice(0, 10) : "",
  );
  const [motivo, setMotivo] = useState(solicitud?.motivo ?? "");
  const [errFecha, setErrFecha] = useState(false);
  const [warnSolap, setWarnSolap] = useState(false);

  const dias =
    fechaInicio && fechaFin && !errFecha ? diasHabiles(fechaInicio, fechaFin, festivos) : 0;

  const onColabChange = (id: string) => {
    setColaboradorId(id);
    const c = colaboradores.find((x) => x.id === parseInt(id));
    setArea(c?.area ?? "");
  };

  const recalcDias = (ini: string, fin: string) => {
    if (!ini || !fin) {
      setErrFecha(false);
      setWarnSolap(false);
      return;
    }
    if (fin < ini) {
      setErrFecha(true);
      setWarnSolap(false);
      return;
    }
    setErrFecha(false);
    const colabId = parseInt(colaboradorId);
    const editId = solicitud?.id;
    const solapa = solicitudes.some((s) => {
      if (editId && s.id === editId) return false;
      if (s.colaborador_id !== colabId) return false;
      if (s.estatus === "rechazado") return false;
      return ini <= s.fecha_fin.slice(0, 10) && fin >= s.fecha_inicio.slice(0, 10);
    });
    setWarnSolap(solapa);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errFecha) {
      notify("La fecha de fin no puede ser anterior a la fecha de inicio.", "error");
      return;
    }
    setSaving(true);
    try {
      const body = {
        colaborador_id: parseInt(colaboradorId),
        tipo,
        estatus,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        dias_habiles: dias,
        motivo,
      };
      if (solicitud?.id) {
        await apiFetch(`${API_BASE_URL}/api/calendario/${solicitud.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        notify("Solicitud actualizada.", "success");
      } else {
        await apiFetch(`${API_BASE_URL}/api/calendario`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        notify("Solicitud creada.", "success");
      }
      onSaved();
    } catch (err: any) {
      notify(err.message ?? "Error al guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg" style={{ border: "1px solid #e2e2e2" }}>
        <div className="p-6">
          <div className="modal-titulo">{solicitud ? "Editar Solicitud" : "Nueva Solicitud"}</div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="form-grid">
              <div className="full">
                <label>
                  Colaborador <span style={{ color: "#d00" }}>*</span>
                </label>
                <select
                  className="w-full"
                  value={colaboradorId}
                  onChange={(e) => onColabChange(e.target.value)}
                  required
                >
                  <option value="">Seleccionar colaborador</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre_completo} — {c.puesto}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Área</label>
                <input className="w-full" style={{ background: "#f8f8f8" }} value={area} readOnly />
              </div>
              <div>
                <label>
                  Tipo <span style={{ color: "#d00" }}>*</span>
                </label>
                <select
                  className="w-full"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Estatus</label>
                <select
                  className="w-full"
                  value={estatus}
                  onChange={(e) => setEstatus(e.target.value)}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>
              <div>
                <label>
                  Fecha inicio <span style={{ color: "#d00" }}>*</span>
                </label>
                <input
                  type="date"
                  className="w-full"
                  value={fechaInicio}
                  onChange={(e) => {
                    setFechaInicio(e.target.value);
                    recalcDias(e.target.value, fechaFin);
                  }}
                  required
                />
              </div>
              <div>
                <label>
                  Fecha fin <span style={{ color: "#d00" }}>*</span>
                </label>
                <input
                  type="date"
                  className="w-full"
                  value={fechaFin}
                  onChange={(e) => {
                    setFechaFin(e.target.value);
                    recalcDias(fechaInicio, e.target.value);
                  }}
                  required
                />
              </div>
              <div>
                <label>Días hábiles</label>
                <input
                  className="w-full"
                  style={{ background: "#f8f8f8" }}
                  value={dias ? `${dias} día(s)` : ""}
                  readOnly
                />
              </div>
              <div className="full">
                <label>Motivo</label>
                <input
                  className="w-full"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
            </div>
            {errFecha && (
              <p className="form-error">La fecha de fin no puede ser anterior a la de inicio.</p>
            )}
            {warnSolap && (
              <p style={{ fontSize: "12px", color: "#a16207" }}>
                Este colaborador ya tiene una solicitud en ese periodo.
              </p>
            )}
            <div className="flex gap-2 justify-end pt-2" style={{ borderTop: "1px solid #e2e2e2" }}>
              <button type="button" className="btn btn-secundario" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || errFecha}
                className="btn btn-primario"
                style={{ opacity: saving || errFecha ? 0.6 : 1 }}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Modal Detalle ─────────────────────────────────────────────────────────────

interface DetalleModalProps {
  sol: Solicitud;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}

function DetalleModal({ sol, onClose, onEdit, onRefresh }: DetalleModalProps) {
  const notify = useNotify();
  const confirm = useConfirm();
  const [pidRechazo, setPidRechazo] = useState(false);
  const [motivoRec, setMotivoRec] = useState("");

  const cambiarEstatus = async (estatus: string, obs = "") => {
    try {
      await apiFetch(`${API_BASE_URL}/api/calendario/${sol.id}/estatus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatus, observaciones: obs }),
      });
      notify(estatus === "aprobado" ? "Solicitud aprobada." : "Solicitud rechazada.", "success");
      onClose();
      onRefresh();
    } catch (err: any) {
      notify(err.message ?? "Error.", "error");
    }
  };

  const eliminar = async () => {
    const ok = await confirm({
      title: "Eliminar solicitud",
      message: "Se eliminará la solicitud de forma permanente.",
    });
    if (!ok) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/calendario/${sol.id}`, { method: "DELETE" });
      notify("Solicitud eliminada.", "success");
      onClose();
      onRefresh();
    } catch (err: any) {
      notify(err.message ?? "Error.", "error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md" style={{ border: "1px solid #e2e2e2" }}>
        <div className="p-6 space-y-3">
          <div className="modal-titulo">{sol.nombre_completo}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Área</span>
              {sol.area || "—"}
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Tipo</span>
              {sol.tipo}
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Estatus</span>
              <span className={badgeEstatus(sol.estatus)}>{sol.estatus}</span>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                Días hábiles
              </span>
              {sol.dias_habiles} día(s)
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Inicio</span>
              {String(sol.fecha_inicio).slice(0, 10)}
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Fin</span>
              {String(sol.fecha_fin).slice(0, 10)}
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                Registrado por
              </span>
              {sol.registrado_por || "—"}
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                Aprobado por
              </span>
              {sol.aprobado_por || "—"}
            </div>
            <div className="col-span-2">
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Motivo</span>
              {sol.motivo || "—"}
            </div>
            <div className="col-span-2">
              <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                Observaciones
              </span>
              {sol.motivo_rechazo || sol.observaciones || "—"}
            </div>
          </div>

          {pidRechazo && (
            <div
              style={{ border: "1px solid #e2e2e2", background: "#fffdf0", padding: "12px" }}
              className="space-y-2"
            >
              <p style={{ fontSize: "13px", fontWeight: "500" }}>Motivo del rechazo (opcional):</p>
              <input
                className="w-full"
                value={motivoRec}
                onChange={(e) => setMotivoRec(e.target.value)}
                autoFocus
              />
              <div className="btn-grupo">
                <button
                  className="btn btn-peligro"
                  onClick={() => cambiarEstatus("rechazado", motivoRec)}
                >
                  Confirmar rechazo
                </button>
                <button className="btn btn-secundario" onClick={() => setPidRechazo(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: "1px solid #e2e2e2" }}>
            {sol.estatus === "pendiente" && (
              <>
                <button className="btn btn-primario" onClick={() => cambiarEstatus("aprobado")}>
                  Aprobar
                </button>
                <button className="btn btn-peligro" onClick={() => setPidRechazo(true)}>
                  Rechazar
                </button>
              </>
            )}
            <button className="btn btn-secundario" onClick={onEdit}>
              Editar
            </button>
            <div className="flex-1" />
            <button className="btn btn-peligro" onClick={eliminar}>
              Eliminar
            </button>
            <button className="btn btn-secundario" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grid Calendario ───────────────────────────────────────────────────────────

interface CalGridProps {
  mes: number;
  anio: number;
  solicitudes: Solicitud[];
  festivos: Festivo[];
  filtroArea: string;
  filtroTipo: string;
  onDayClick: (iso: string) => void;
  onSolicitudClick: (id: number) => void;
}

function CalGrid({
  mes,
  anio,
  solicitudes,
  festivos,
  filtroArea,
  filtroTipo,
  onDayClick,
  onSolicitudClick,
}: CalGridProps) {
  const hoyIso = new Date().toISOString().slice(0, 10);
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);
  const startPad = primerDia.getDay();

  const cells: JSX.Element[] = [];

  // Headers de días
  DIAS_SEM.forEach((d) =>
    cells.push(
      <div
        key={`h${d}`}
        style={{
          textAlign: "center",
          fontSize: "11px",
          fontWeight: "600",
          color: "#777",
          padding: "4px 0",
        }}
      >
        {d}
      </div>,
    ),
  );

  // Celdas previas (mes anterior)
  for (let i = 0; i < startPad; i++) {
    const d = new Date(anio, mes, 1 - (startPad - i));
    cells.push(
      <div
        key={`pre${i}`}
        style={{
          minHeight: "80px",
          background: "#f8f8f8",
          padding: "4px",
          border: "1px solid #f0f0f0",
        }}
      >
        <span style={{ fontSize: "11px", color: "#ddd" }}>{d.getDate()}</span>
      </div>,
    );
  }

  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    const dateObj = new Date(anio, mes, dia);
    const iso = dateObj.toISOString().slice(0, 10);
    const dow = dateObj.getDay();
    const esHoy = iso === hoyIso;
    const esFin = dow === 0 || dow === 6;
    const esFest = esFestivo(dateObj, festivos);
    const festNom = festivoNombre(dateObj, festivos);

    let sols = solicitudes.filter((s) => {
      const ini = s.fecha_inicio.slice(0, 10),
        fin = s.fecha_fin.slice(0, 10);
      return iso >= ini && iso <= fin && s.estatus !== "rechazado";
    });
    if (filtroArea) sols = sols.filter((s) => s.area === filtroArea);
    if (filtroTipo) sols = sols.filter((s) => s.tipo === filtroTipo);

    const areaCounts: Record<string, number> = {};
    sols.forEach((s) => {
      areaCounts[s.area ?? ""] = (areaCounts[s.area ?? ""] || 0) + 1;
    });
    const hayConflicto = Object.values(areaCounts).some((v) => v >= 2);

    let cellBg = "#fff";
    let cellBorder = "1px solid #e2e2e2";
    if (esHoy) {
      cellBg = "#e8f0fb";
      cellBorder = "1px solid #0d2b4e";
    } else if (esFin) cellBg = "#f8f8f8";

    cells.push(
      <div
        key={iso}
        style={{
          minHeight: "80px",
          background: cellBg,
          border: cellBorder,
          padding: "4px",
          cursor: "pointer",
        }}
        onClick={() => onDayClick(iso)}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: "600",
            color: esHoy ? "#0d2b4e" : esFin ? "#aaa" : "#333",
          }}
        >
          {dia}
        </span>
        {esFest && (
          <div
            style={{
              fontSize: "10px",
              color: "#b45309",
              fontWeight: "600",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {festNom}
          </div>
        )}
        {sols.slice(0, 3).map((s) => (
          <span
            key={s.id}
            style={chipStyle(s.tipo)}
            onClick={(e) => {
              e.stopPropagation();
              onSolicitudClick(s.id);
            }}
            title={s.nombre_completo}
          >
            {s.nombre_completo.split(" ")[0]}
          </span>
        ))}
        {sols.length > 3 && (
          <span style={{ fontSize: "10px", color: "#aaa" }}>+{sols.length - 3} más</span>
        )}
        {hayConflicto && <div style={{ fontSize: "10px", color: "#c62828" }}>Conflicto</div>}
      </div>,
    );
  }

  const totalCeldas = startPad + ultimoDia.getDate();
  const resto = totalCeldas % 7 === 0 ? 0 : 7 - (totalCeldas % 7);
  for (let i = 1; i <= resto; i++) {
    cells.push(
      <div
        key={`post${i}`}
        style={{
          minHeight: "80px",
          background: "#f8f8f8",
          padding: "4px",
          border: "1px solid #f0f0f0",
        }}
      >
        <span style={{ fontSize: "11px", color: "#ddd" }}>{i}</span>
      </div>,
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
      {cells}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type TabKey = "calendario" | "mis" | "gestion" | "saldo" | "festivos";

export default function Calendario() {
  const notify = useNotify();
  const confirm = useConfirm();
  const { user } = useAuth();

  const [tab, setTab] = useState<TabKey>("calendario");

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [anio, setAnio] = useState(now.getFullYear());

  const [filtroArea, setFiltroArea] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [festivos, setFestivos] = useState<Festivo[]>([]);
  const [saldo, setSaldo] = useState<SaldoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailSol, setDetailSol] = useState<Solicitud | null>(null);
  const [editSol, setEditSol] = useState<Solicitud | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fechaInicialForm, setFechaInicialForm] = useState("");

  // Festivos form
  const [festNombre, setFestNombre] = useState("");
  const [festFecha, setFestFecha] = useState("");
  const [festRecurrente, setFestRecurrente] = useState(false);

  // Saldo edit
  const [saldoAnio, setSaldoAnio] = useState(anio);

  // Gestión filtros
  const [gestFiltroTipo, setGestFiltroTipo] = useState("");
  const [gestFiltroEstatus, setGestFiltroEstatus] = useState("");
  const [misFiltro, setMisFiltro] = useState("");

  // Modal editar saldo
  const [editSaldoState, setEditSaldoState] = useState<{
    colabId: number;
    nombre: string;
    actual: number;
  } | null>(null);
  const [editSaldoValor, setEditSaldoValor] = useState("");

  // Modal rechazar rápido
  const [rechazarState, setRechazarState] = useState<{ solicitudId: number } | null>(null);
  const [rechazarMotivo, setRechazarMotivo] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [sols, colabs, fests, saldos] = await Promise.all([
        apiFetch<Solicitud[]>(`${API_BASE_URL}/api/calendario`),
        apiFetch<Colaborador[]>(`${API_BASE_URL}/api/organigrama-qc`),
        apiFetch<Festivo[]>(`${API_BASE_URL}/api/calendario/festivos`),
        apiFetch<SaldoRow[]>(`${API_BASE_URL}/api/calendario/saldo`),
      ]);
      setSolicitudes(sols);
      setColaboradores(colabs.filter((c) => c.estatus === "activo"));
      setFestivos(fests);
      setSaldo(saldos);
    } catch (err: any) {
      notify(err.message ?? "Error cargando el calendario.", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarMes = (delta: number) => {
    setMes((prev) => {
      let m = prev + delta,
        a = anio;
      if (m > 11) {
        m = 0;
        a++;
      } else if (m < 0) {
        m = 11;
        a--;
      }
      setAnio(a);
      return m;
    });
  };

  const openNew = (fechaISO = "") => {
    setEditSol(null);
    setFechaInicialForm(fechaISO);
    setShowForm(true);
  };
  const openEdit = (s: Solicitud) => {
    setDetailSol(null);
    setEditSol(s);
    setFechaInicialForm("");
    setShowForm(true);
  };

  const agregarFestivo = async () => {
    if (!festNombre.trim() || !festFecha) {
      notify("Ingresa nombre y fecha del festivo.", "error");
      return;
    }
    try {
      await apiFetch(`${API_BASE_URL}/api/calendario/festivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: festNombre.trim(),
          fecha: festFecha,
          recurrente: festRecurrente,
        }),
      });
      setFestNombre("");
      setFestFecha("");
      setFestRecurrente(false);
      await cargar();
    } catch (err: any) {
      notify(err.message ?? "Error.", "error");
    }
  };

  const eliminarFestivo = async (id: number) => {
    const ok = await confirm({
      title: "Eliminar festivo",
      message: "¿Eliminar este festivo? Afecta el cálculo de días hábiles.",
    });
    if (!ok) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/calendario/festivos/${id}`, { method: "DELETE" });
      await cargar();
    } catch (err: any) {
      notify(err.message ?? "Error.", "error");
    }
  };

  const editarSaldo = (colabId: number, nombre: string, actual: number) => {
    setEditSaldoState({ colabId, nombre, actual });
    setEditSaldoValor(String(actual));
  };

  const confirmarEditarSaldo = async () => {
    if (!editSaldoState) return;
    const n = parseInt(editSaldoValor);
    if (isNaN(n) || n < 0) {
      notify("Ingresa un número válido (0 o mayor).", "error");
      return;
    }
    try {
      await apiFetch(`${API_BASE_URL}/api/calendario/saldo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaborador_id: editSaldoState.colabId,
          anio: saldoAnio,
          dias_asignados: n,
        }),
      });
      notify("Saldo actualizado correctamente.", "success");
      setEditSaldoState(null);
      await cargar();
    } catch (err: any) {
      notify(err.message ?? "Error.", "error");
    }
  };

  const aprobarRapido = async (id: number) => {
    const ok = await confirm({ title: "Aprobar solicitud", message: "¿Aprobar esta solicitud?" });
    if (!ok) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/calendario/${id}/estatus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatus: "aprobado", observaciones: "" }),
      });
      notify("Solicitud aprobada.", "success");
      await cargar();
    } catch (err: any) {
      notify(err.message ?? "Error.", "error");
    }
  };

  const rechazarRapido = (id: number) => {
    setRechazarState({ solicitudId: id });
    setRechazarMotivo("");
  };

  const confirmarRechazarRapido = async () => {
    if (!rechazarState) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/calendario/${rechazarState.solicitudId}/estatus`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatus: "rechazado", observaciones: rechazarMotivo }),
      });
      notify("Solicitud rechazada.", "success");
      setRechazarState(null);
      await cargar();
    } catch (err: any) {
      notify(err.message ?? "Error.", "error");
    }
  };

  const miColaborador = colaboradores.find((c) => c.nombre_completo === user?.name);
  const misSolicitudes = miColaborador
    ? solicitudes.filter(
        (s) =>
          s.colaborador_id === miColaborador.id && (misFiltro ? s.estatus === misFiltro : true),
      )
    : [];

  const gestionList = solicitudes
    .filter(
      (s) =>
        (!gestFiltroTipo || s.tipo === gestFiltroTipo) &&
        (!gestFiltroEstatus || s.estatus === gestFiltroEstatus),
    )
    .sort(
      (a, b) =>
        ["pendiente", "aprobado", "rechazado"].indexOf(a.estatus) -
        ["pendiente", "aprobado", "rechazado"].indexOf(b.estatus),
    );

  const TABS: { key: TabKey; label: string }[] = [
    { key: "calendario", label: "Calendario" },
    { key: "mis", label: "Mis Solicitudes" },
    { key: "gestion", label: "Gestión" },
    { key: "saldo", label: "Saldo de Vacaciones" },
    { key: "festivos", label: "Festivos" },
  ];

  if (loading) return <p className="vacio">Cargando...</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Calendario RRHH</h1>
        <button className="btn btn-primario" onClick={() => openNew()}>
          + Nueva solicitud
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: "16px",
          borderBottom: "2px solid #e2e2e2",
          overflowX: "auto",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              whiteSpace: "nowrap",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid #0d2b4e" : "2px solid transparent",
              marginBottom: "-2px",
              color: tab === t.key ? "#0d2b4e" : "#555",
              fontWeight: tab === t.key ? "600" : "400",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Calendario ── */}
      {tab === "calendario" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                className="btn btn-secundario"
                style={{ padding: "4px 10px" }}
                onClick={() => cambiarMes(-1)}
              >
                ←
              </button>
              <span
                style={{ fontWeight: "600", fontSize: "15px", width: "160px", textAlign: "center" }}
              >
                {MESES_ES[mes]} {anio}
              </span>
              <button
                className="btn btn-secundario"
                style={{ padding: "4px 10px" }}
                onClick={() => cambiarMes(1)}
              >
                →
              </button>
            </div>
            <div className="filtros">
              <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
                <option value="">Todas las áreas</option>
                {AREAS_FILTRO.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="">Todos los tipos</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex gap-2 flex-wrap">
            {TIPOS.map((t) => (
              <span
                key={t}
                style={{ ...chipStyle(t), display: "inline", padding: "2px 8px", fontSize: "11px" }}
              >
                {t}
              </span>
            ))}
            <span
              style={{
                background: "#fef3c7",
                color: "#b45309",
                fontSize: "11px",
                padding: "2px 8px",
              }}
            >
              Festivo
            </span>
          </div>

          <CalGrid
            mes={mes}
            anio={anio}
            solicitudes={solicitudes}
            festivos={festivos}
            filtroArea={filtroArea}
            filtroTipo={filtroTipo}
            onDayClick={(iso) => openNew(iso)}
            onSolicitudClick={(id) => {
              const s = solicitudes.find((x) => x.id === id);
              if (s) setDetailSol(s);
            }}
          />
        </div>
      )}

      {/* ── Tab: Mis Solicitudes ── */}
      {tab === "mis" && (
        <div className="space-y-3">
          <div className="filtros">
            <select value={misFiltro} onChange={(e) => setMisFiltro(e.target.value)}>
              <option value="">Todos los estatus</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
          {!miColaborador ? (
            <p className="vacio">
              No tienes solicitudes registradas. Tu usuario no está vinculado a un colaborador en el
              Organigrama QC.
            </p>
          ) : misSolicitudes.length === 0 ? (
            <p className="vacio">Sin solicitudes.</p>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Tipo</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th style={{ textAlign: "center" }}>Días</th>
                    <th>Estatus</th>
                    <th>Motivo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {misSolicitudes.map((s) => (
                    <tr key={s.id}>
                      <td>{s.nombre_completo}</td>
                      <td>{s.tipo}</td>
                      <td>{String(s.fecha_inicio).slice(0, 10)}</td>
                      <td>{String(s.fecha_fin).slice(0, 10)}</td>
                      <td style={{ textAlign: "center" }}>{s.dias_habiles}</td>
                      <td>
                        <span className={badgeEstatus(s.estatus)}>{s.estatus}</span>
                      </td>
                      <td style={{ color: "#555" }}>{s.motivo || "—"}</td>
                      <td>
                        <button className="btn-accion" onClick={() => setDetailSol(s)}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Gestión ── */}
      {tab === "gestion" && (
        <div className="space-y-3">
          <div className="filtros">
            <select value={gestFiltroTipo} onChange={(e) => setGestFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={gestFiltroEstatus}
              onChange={(e) => setGestFiltroEstatus(e.target.value)}
            >
              <option value="">Todos los estatus</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
          {gestionList.length === 0 ? (
            <p className="vacio">Sin solicitudes.</p>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Área</th>
                    <th>Tipo</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th style={{ textAlign: "center" }}>Días</th>
                    <th>Estatus</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gestionList.map((s) => (
                    <tr key={s.id}>
                      <td>{s.nombre_completo}</td>
                      <td>{s.area || "—"}</td>
                      <td>{s.tipo}</td>
                      <td>{String(s.fecha_inicio).slice(0, 10)}</td>
                      <td>{String(s.fecha_fin).slice(0, 10)}</td>
                      <td style={{ textAlign: "center" }}>{s.dias_habiles}</td>
                      <td>
                        <span className={badgeEstatus(s.estatus)}>{s.estatus}</span>
                      </td>
                      <td className="whitespace-nowrap">
                        {s.estatus === "pendiente" && (
                          <>
                            <button className="btn-accion" onClick={() => aprobarRapido(s.id)}>
                              Aprobar
                            </button>{" "}
                            <button
                              className="btn-accion rojo"
                              onClick={() => rechazarRapido(s.id)}
                            >
                              Rechazar
                            </button>{" "}
                          </>
                        )}
                        <button className="btn-accion" onClick={() => setDetailSol(s)}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Saldo de Vacaciones ── */}
      {tab === "saldo" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              className="btn btn-secundario"
              style={{ padding: "4px 10px" }}
              onClick={() => setSaldoAnio((y) => y - 1)}
            >
              ←
            </button>
            <span style={{ fontWeight: "600", width: "64px", textAlign: "center" }}>
              {saldoAnio}
            </span>
            <button
              className="btn btn-secundario"
              style={{ padding: "4px 10px" }}
              onClick={() => setSaldoAnio((y) => y + 1)}
            >
              →
            </button>
          </div>
          {colaboradores.length === 0 ? (
            <p className="vacio">Sin colaboradores activos.</p>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Área</th>
                    <th style={{ textAlign: "center" }}>Saldo Inicial</th>
                    <th style={{ textAlign: "center" }}>Días Utilizados</th>
                    <th style={{ textAlign: "center" }}>Saldo Pendiente</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradores.map((c) => {
                    const reg = saldo.find(
                      (s) => s.colaborador_id === c.id && parseInt(String(s.anio)) === saldoAnio,
                    );
                    const saldoInicial = reg ? parseInt(String(reg.dias_asignados)) : 0;
                    const diasUsados = solicitudes
                      .filter(
                        (s) =>
                          s.colaborador_id === c.id &&
                          s.tipo === "Vacaciones" &&
                          s.estatus === "aprobado" &&
                          s.fecha_inicio.slice(0, 4) === String(saldoAnio),
                      )
                      .reduce((sum, s) => sum + (s.dias_habiles || 0), 0);
                    const saldoPendiente = saldoInicial - diasUsados;
                    return (
                      <tr key={c.id}>
                        <td>{c.nombre_completo}</td>
                        <td>{c.area || "—"}</td>
                        <td style={{ textAlign: "center" }}>{saldoInicial}</td>
                        <td style={{ textAlign: "center" }}>{diasUsados}</td>
                        <td
                          style={{
                            textAlign: "center",
                            fontWeight: "bold",
                            color:
                              saldoPendiente < 0
                                ? "#c62828"
                                : saldoPendiente === 0
                                  ? "#aaa"
                                  : "#2e7d32",
                          }}
                        >
                          {saldoPendiente}
                        </td>
                        <td>
                          <button
                            className="btn-accion"
                            onClick={() => editarSaldo(c.id, c.nombre_completo, saldoInicial)}
                          >
                            Editar
                          </button>
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

      {/* ── Tab: Festivos ── */}
      {tab === "festivos" && (
        <div className="space-y-4">
          <div className="card">
            <div className="seccion-titulo">Agregar Festivo</div>
            <div className="form-grid" style={{ marginTop: "10px" }}>
              <div>
                <label>Nombre</label>
                <input
                  className="w-full"
                  value={festNombre}
                  onChange={(e) => setFestNombre(e.target.value)}
                  placeholder="Ej. Día de la Independencia"
                />
              </div>
              <div>
                <label>Fecha</label>
                <input
                  type="date"
                  className="w-full"
                  value={festFecha}
                  onChange={(e) => setFestFecha(e.target.value)}
                />
              </div>
              <div className="full">
                <label
                  className="flex items-center gap-2 cursor-pointer"
                  style={{ textTransform: "none", fontSize: "13px", color: "#333" }}
                >
                  <input
                    type="checkbox"
                    checked={festRecurrente}
                    onChange={(e) => setFestRecurrente(e.target.checked)}
                  />
                  Anual (se repite cada año en la misma fecha)
                </label>
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <button className="btn btn-primario" onClick={agregarFestivo}>
                Agregar festivo
              </button>
            </div>
          </div>

          {festivos.length === 0 ? (
            <p className="vacio">Sin festivos registrados.</p>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Nombre</th>
                    <th style={{ textAlign: "center" }}>Tipo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {festivos.map((f) => (
                    <tr key={f.id}>
                      <td>{f.fecha.slice(0, 10)}</td>
                      <td>{f.nombre}</td>
                      <td style={{ textAlign: "center", color: "#777" }}>
                        {f.recurrente ? "Anual" : "Una vez"}
                      </td>
                      <td>
                        <button className="btn-accion rojo" onClick={() => eliminarFestivo(f.id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {detailSol && (
        <DetalleModal
          sol={detailSol}
          onClose={() => setDetailSol(null)}
          onEdit={() => openEdit(detailSol)}
          onRefresh={cargar}
        />
      )}
      {showForm && (
        <FormModal
          solicitud={editSol}
          colaboradores={colaboradores}
          festivos={festivos}
          solicitudes={solicitudes}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            cargar();
          }}
        />
      )}

      {/* Modal: Editar saldo de vacaciones */}
      {editSaldoState && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm" style={{ border: "1px solid #e2e2e2" }}>
            <div className="p-6 space-y-4">
              <div className="modal-titulo">Editar saldo de vacaciones</div>
              <p style={{ fontSize: "13px", color: "#555" }}>
                Saldo inicial de vacaciones para <strong>{editSaldoState.nombre}</strong> en{" "}
                {saldoAnio}:
              </p>
              <input
                type="number"
                min={0}
                className="w-full"
                value={editSaldoValor}
                onChange={(e) => setEditSaldoValor(e.target.value)}
                autoFocus
              />
              <div
                className="flex gap-2 justify-end pt-2"
                style={{ borderTop: "1px solid #e2e2e2" }}
              >
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setEditSaldoState(null)}
                >
                  Cancelar
                </button>
                <button type="button" className="btn btn-primario" onClick={confirmarEditarSaldo}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rechazar rápido */}
      {rechazarState && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm" style={{ border: "1px solid #e2e2e2" }}>
            <div className="p-6 space-y-4">
              <div className="modal-titulo">Rechazar solicitud</div>
              <p style={{ fontSize: "13px", color: "#555" }}>Motivo del rechazo (opcional):</p>
              <input
                type="text"
                className="w-full"
                value={rechazarMotivo}
                onChange={(e) => setRechazarMotivo(e.target.value)}
                placeholder="Ej. Falta documentación"
                autoFocus
              />
              <div
                className="flex gap-2 justify-end pt-2"
                style={{ borderTop: "1px solid #e2e2e2" }}
              >
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setRechazarState(null)}
                >
                  Cancelar
                </button>
                <button type="button" className="btn btn-peligro" onClick={confirmarRechazarRapido}>
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
