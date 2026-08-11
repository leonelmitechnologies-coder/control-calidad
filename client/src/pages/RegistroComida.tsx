import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
}

interface RegistroComida {
  id: number;
  colaborador_id: number;
  fecha: string;
  hora_registro: string;
  turno: string;
  observaciones: string;
  registrado_por: string;
  created_at: string;
  nombre_completo: string;
  area: string;
  puesto: string;
  turno_colaborador: string;
  foto_filename: string;
}

interface ListResponse {
  data: RegistroComida[];
  total: number;
  fecha: string;
}

const TURNOS = ["Matutino", "Vespertino", "Nocturno"];

// ── API ───────────────────────────────────────────────────────────────────────

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

// ── Modal Registro ────────────────────────────────────────────────────────────

interface ModalProps {
  fecha: string;
  onClose: () => void;
  onSaved: () => void;
}

function ModalRegistro({ fecha, onClose, onSaved }: ModalProps) {
  const notify = useNotify();
  const [colaboradorId, setColaboradorId] = useState("");
  const [turno, setTurno] = useState("");
  const [horaRegistro, setHoraRegistro] = useState(
    new Date().toTimeString().slice(0, 5),
  );
  const [observaciones, setObservaciones] = useState("");
  const [search, setSearch] = useState("");

  const { data: colaboradores = [], isLoading: loadingColab } = useQuery<Colaborador[]>({
    queryKey: ["registro-comida-colaboradores"],
    queryFn: () => apiFetch(`${API_BASE_URL}/api/registro-comida/colaboradores`),
    staleTime: 60_000,
  });

  const filtrados = colaboradores.filter((c) =>
    c.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
    c.area.toLowerCase().includes(search.toLowerCase()),
  );

  const mutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch(`${API_BASE_URL}/api/registro-comida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      notify("Registro guardado correctamente.", "success");
      onSaved();
    },
    onError: (err: any) => notify(err.message ?? "Error al guardar.", "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorId) { notify("Selecciona un colaborador.", "warning"); return; }
    mutation.mutate({ colaborador_id: parseInt(colaboradorId), fecha, hora_registro: horaRegistro, turno, observaciones });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg" style={{ border: "1px solid #e2e2e2", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="p-5" style={{ borderBottom: "1px solid #e2e2e2" }}>
          <div className="modal-titulo">Registrar Comida — {fecha}</div>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {/* Buscar colaborador */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Buscar colaborador</label>
            <input
              type="text"
              placeholder="Nombre o área…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Lista de colaboradores */}
          <div style={{ border: "1px solid #e2e2e2", maxHeight: 200, overflowY: "auto", marginBottom: 16 }}>
            {loadingColab ? (
              <div className="vacio" style={{ padding: 16 }}>Cargando colaboradores…</div>
            ) : filtrados.length === 0 ? (
              <div className="vacio" style={{ padding: 16 }}>Sin resultados.</div>
            ) : (
              filtrados.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setColaboradorId(String(c.id))}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f0f0f0",
                    background: colaboradorId === String(c.id) ? "#e8f0fd" : "transparent",
                    borderLeft: colaboradorId === String(c.id) ? "3px solid #0d2b4e" : "3px solid transparent",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre_completo}</div>
                  <div style={{ fontSize: 11, color: "#777" }}>{c.area} — {c.puesto}</div>
                </div>
              ))
            )}
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Turno</label>
              <select value={turno} onChange={(e) => setTurno(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Hora de registro</label>
              <input
                type="time"
                value={horaRegistro}
                onChange={(e) => setHoraRegistro(e.target.value)}
              />
            </div>
            <div className="form-group full">
              <label>Observaciones</label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
        </form>

        <div className="btn-grupo" style={{ padding: "12px 20px", borderTop: "1px solid #e2e2e2", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primario"
            disabled={mutation.isPending || !colaboradorId}
            onClick={(e) => { e.preventDefault(); if (!colaboradorId) { notify("Selecciona un colaborador.", "warning"); return; } mutation.mutate({ colaborador_id: parseInt(colaboradorId), fecha, hora_registro: horaRegistro, turno, observaciones }); }}
          >
            {mutation.isPending ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function RegistroComida() {
  const notify = useNotify();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const [turnoFiltro, setTurnoFiltro] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["registro-comida", fecha, turnoFiltro],
    queryFn: () => {
      const qs = new URLSearchParams({ fecha });
      if (turnoFiltro) qs.set("turno", turnoFiltro);
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

  const registros = data?.data ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "#0d2b4e" }}>Registro de Comida</h1>
        <button className="btn btn-primario" onClick={() => setShowModal(true)}>
          + Registrar entrada
        </button>
      </div>

      {/* Filtros */}
      <div className="filtros mb-4">
        <div className="form-group" style={{ flex: "0 0 auto" }}>
          <label style={{ marginBottom: 3 }}>Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={{ width: "auto" }}
          />
        </div>
        <div className="form-group" style={{ flex: "0 0 auto" }}>
          <label style={{ marginBottom: 3 }}>Turno</label>
          <select value={turnoFiltro} onChange={(e) => setTurnoFiltro(e.target.value)} style={{ width: "auto", minWidth: 150 }}>
            <option value="">Todos los turnos</option>
            {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 13, color: "#777", alignSelf: "flex-end", paddingBottom: 2 }}>
          {isLoading ? "Cargando…" : `${data?.total ?? 0} registro${(data?.total ?? 0) !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="vacio">Cargando…</div>
      ) : registros.length === 0 ? (
        <div className="vacio card">Sin registros para esta fecha.</div>
      ) : isMobile ? (
        /* ── Tarjetas móvil ── */
        <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
          <div className="tabla-cards">
            {registros.map((r, i) => (
              <div key={r.id} className="tabla-card">
                <div className="tabla-card-header">
                  <div style={{ minWidth: 0 }}>
                    <div className="tabla-card-meta">#{i + 1} · {r.hora_registro}</div>
                    <div className="tabla-card-title">{r.nombre_completo}</div>
                  </div>
                  {r.turno && (
                    <span style={{ background: "#e8f0fd", color: "#0d2b4e", padding: "2px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {r.turno}
                    </span>
                  )}
                </div>
                <div className="tabla-card-row">
                  <div className="tabla-card-field">
                    <span className="tabla-card-label">Área</span>
                    <span className="tabla-card-value">{r.area || "—"}</span>
                  </div>
                  <div className="tabla-card-field">
                    <span className="tabla-card-label">Puesto</span>
                    <span className="tabla-card-value">{r.puesto || "—"}</span>
                  </div>
                </div>
                {r.observaciones && (
                  <div className="tabla-card-field" style={{ marginBottom: 4 }}>
                    <span className="tabla-card-label">Observaciones</span>
                    <span className="tabla-card-value wrap">{r.observaciones}</span>
                  </div>
                )}
                <div className="tabla-card-actions">
                  <button type="button" className="btn-accion rojo" onClick={() => handleDelete(r.id, r.nombre_completo)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Tabla desktop ── */
        <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Colaborador</th>
                  <th>Área</th>
                  <th>Puesto</th>
                  <th>Turno</th>
                  <th>Hora</th>
                  <th>Registrado por</th>
                  <th>Observaciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ color: "#999", fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.nombre_completo}</td>
                    <td className="whitespace-nowrap">{r.area || "—"}</td>
                    <td className="whitespace-nowrap">{r.puesto || "—"}</td>
                    <td className="whitespace-nowrap">
                      {r.turno ? (
                        <span style={{ background: "#e8f0fd", color: "#0d2b4e", padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                          {r.turno}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="whitespace-nowrap font-mono" style={{ fontSize: 12 }}>{r.hora_registro}</td>
                    <td className="whitespace-nowrap" style={{ fontSize: 12, color: "#777" }}>{r.registrado_por}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "#555" }}>
                      {r.observaciones || "—"}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn-accion rojo" onClick={() => handleDelete(r.id, r.nombre_completo)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ModalRegistro
          fecha={fecha}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ["registro-comida"] });
          }}
        />
      )}
    </div>
  );
}
