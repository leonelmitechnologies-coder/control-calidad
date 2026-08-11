/**
 * AQL — Registro de Inspección con Checklist dinámico
 * Fiel al monolito: checklist libre, 2 fotos estrictas, estado auto-calculado
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import SkuAutocomplete from "../components/SkuAutocomplete";
import { API_BASE_URL } from "../config/api";
import { useConfirm } from "../context/ConfirmContext";
import { useNotify } from "../context/NotifyContext";
import { useIsMobile } from "../hooks/useIsMobile";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  item_number: number;
  descripcion: string;
  estado: "pass" | "fail";
}

interface AqlRecord {
  id: number;
  fecha_registro: string;
  order_id?: string;
  license_plate?: string;
  sku?: string;
  marca?: string;
  modelo?: string;
  pulgada?: string;
  descripcion?: string;
  lote?: string;
  muestra_total?: number;
  defectos_encontrados?: number;
  observaciones?: string;
  estado_aql?: string;
  inspector?: string;
  registrado_por?: string;
  foto_lpn_filename?: string;
  foto_pantalla_filename?: string;
  foto_lpn_url?: string;
  foto_pantalla_url?: string;
  checklist?: ChecklistItem[];
}

interface AqlListResponse {
  data: AqlRecord[];
  total: number;
  page: number;
  pageSize: number;
  counts: { todas: number; aceptado: number; rechazado: number };
}

type TabEstado = "Todas" | "Aceptado" | "Rechazado";

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

// ── Foto Zone ─────────────────────────────────────────────────────────────────

interface FotoZoneProps {
  label: string;
  file: File | null;
  existingUrl: string;
  onSelect: (f: File) => void;
  onRemove: () => void;
}

function FotoZone({ label, file, existingUrl, onSelect, onRemove }: FotoZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tieneImg = !!(file || existingUrl);
  const previewUrl = file ? URL.createObjectURL(file) : existingUrl;

  return (
    <div>
      <p style={{ fontSize: "11px", fontWeight: "600", marginBottom: "8px" }}>
        {label} <span style={{ color: "#d00" }}>*</span>
      </p>
      <div
        style={{
          border: tieneImg ? "2px solid #4caf50" : "2px dashed #ccc",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          minHeight: "120px",
          justifyContent: "center",
          cursor: tieneImg ? "default" : "pointer",
        }}
        onClick={() => !tieneImg && inputRef.current?.click()}
      >
        {tieneImg ? (
          <div style={{ position: "relative" }}>
            <img
              src={previewUrl}
              alt={label}
              style={{ height: "96px", width: "auto", objectFit: "cover" }}
            />
            <button
              type="button"
              style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                background: "#d32f2f",
                color: "#fff",
                border: "none",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span style={{ fontSize: "11px", color: "#aaa", textAlign: "center" }}>
            Haz clic para seleccionar
            <br />
            {label}
          </span>
        )}
        {!tieneImg && (
          <button
            type="button"
            className="btn btn-secundario"
            style={{ fontSize: "11px" }}
            onClick={() => inputRef.current?.click()}
          >
            Seleccionar foto
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── Modal Formulario ──────────────────────────────────────────────────────────

interface FormModalProps {
  record: AqlRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

function FormModal({ record, onClose, onSaved }: FormModalProps) {
  const notify = useNotify();
  const [saving, setSaving] = useState(false);

  const [fecha, setFecha] = useState(
    record?.fecha_registro
      ? String(record.fecha_registro).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [orderId, setOrderId] = useState(record?.order_id ?? record?.license_plate ?? "");
  const [sku, setSku] = useState(record?.sku ?? "");
  const [marca, setMarca] = useState(record?.marca ?? "");
  const [modelo, setModelo] = useState(record?.modelo ?? "");
  const [pulgada, setPulgada] = useState(record?.descripcion ?? "");
  const [descripcion, setDescripcion] = useState(record?.pulgada ?? "");
  const [lote, setLote] = useState(record?.lote ?? "");
  const [muestra, setMuestra] = useState(
    record?.muestra_total != null ? String(record.muestra_total) : "",
  );
  const [defectos, setDefectos] = useState(
    record?.defectos_encontrados != null ? String(record.defectos_encontrados) : "0",
  );
  const [observaciones, setObservaciones] = useState(record?.observaciones ?? "");

  const estado = parseInt(defectos) === 0 ? "Aceptado" : "Rechazado";

  const [checklist, setChecklist] = useState<ChecklistItem[]>(() =>
    record?.checklist?.length
      ? record.checklist
      : [{ item_number: 1, descripcion: "", estado: "pass" }],
  );

  const addItem = () => {
    const next = (checklist[checklist.length - 1]?.item_number ?? 0) + 1;
    setChecklist((prev) => [...prev, { item_number: next, descripcion: "", estado: "pass" }]);
  };

  const removeItem = (idx: number) => {
    if (checklist.length <= 1) {
      notify("Debe haber al menos 1 item en el checklist.", "warning");
      return;
    }
    setChecklist((prev) =>
      prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, item_number: i + 1 })),
    );
  };

  const updateItem = (idx: number, field: keyof ChecklistItem, val: string) => {
    setChecklist((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  };

  const [fotoLpn, setFotoLpn] = useState<File | null>(null);
  const [fotoPantalla, setFotoPantalla] = useState<File | null>(null);
  const [lpnExistente, setLpnExistente] = useState(record?.foto_lpn_url ?? "");
  const [pantallaExistente, setPantallaExistente] = useState(record?.foto_pantalla_url ?? "");

  const fotosListas = !!(fotoLpn || lpnExistente) && !!(fotoPantalla || pantallaExistente);

  const handleSkuSelect = (data: {
    sku: string;
    marca?: string;
    modelo?: string;
    pulgada?: string;
    descripcion?: string;
  }) => {
    setSku(data.sku);
    if (data.marca) setMarca(data.marca);
    if (data.modelo) setModelo(data.modelo);
    // BD tiene pulgada/descripcion invertidas: la columna "descripcion" guarda la pulgada real y viceversa
    if (data.descripcion) setPulgada(data.descripcion);
    if (data.pulgada) setDescripcion(data.pulgada);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fotosListas) {
      notify("Se requieren exactamente 2 fotos (LPN + Pantalla) para guardar.", "error");
      return;
    }
    if (!muestra || parseInt(muestra) < 1) {
      notify("Muestra Total debe ser al menos 1.", "error");
      return;
    }

    setSaving(true);
    try {
      const body = {
        fecha_registro: fecha,
        order_id: orderId.trim(),
        sku: sku.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        // Invertimos al guardar para mantener formato de BD (descripcion col = pulgada, pulgada col = descripcion)
        pulgada: descripcion.trim(),
        descripcion: pulgada.trim(),
        lote: lote.trim(),
        muestra_total: parseInt(muestra),
        defectos_encontrados: parseInt(defectos) || 0,
        observaciones: observaciones.trim(),
        checklist,
      };

      let reg: AqlRecord;
      if (record?.id) {
        reg = await apiFetch<AqlRecord>(`${API_BASE_URL}/api/aql/${record.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        reg = await apiFetch<AqlRecord>(`${API_BASE_URL}/api/aql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (fotoLpn) {
        const fd = new FormData();
        fd.append("foto", fotoLpn);
        const r = await fetch(`${API_BASE_URL}/api/aql/${reg.id}/foto-lpn`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!r.ok) notify("La foto de LPN no pudo subirse.", "warning");
      }
      if (fotoPantalla) {
        const fd = new FormData();
        fd.append("foto", fotoPantalla);
        const r = await fetch(`${API_BASE_URL}/api/aql/${reg.id}/foto-pantalla`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!r.ok) notify("La foto de Pantalla no pudo subirse.", "warning");
      }

      notify(record?.id ? "Registro AQL actualizado." : "Registro AQL creado.", "success");
      onSaved();
    } catch (err: any) {
      notify(err.message ?? "Error al guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto"
        style={{ border: "1px solid #e2e2e2" }}
      >
        <div className="p-6">
          <div className="modal-titulo">
            {record ? `Editar Registro AQL #${record.id}` : "Nuevo Registro AQL"}
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="seccion-titulo">Información de Inspección</div>
              <div className="form-grid" style={{ marginTop: "10px" }}>
                <div>
                  <label>
                    Fecha <span style={{ color: "#d00" }}>*</span>
                  </label>
                  <input
                    type="date"
                    className="w-full"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>
                    Order ID <span style={{ color: "#d00" }}>*</span>
                  </label>
                  <input
                    className="w-full"
                    placeholder="Ej. ORD-2026-001"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>SKU</label>
                  <SkuAutocomplete value={sku} onChange={setSku} onSelect={handleSkuSelect} />
                </div>
                <div>
                  <label>Marca</label>
                  <input
                    className="w-full"
                    style={{ background: "#f8f8f8" }}
                    value={marca}
                    readOnly
                    placeholder="Auto-llenado por SKU"
                  />
                </div>
                <div>
                  <label>Modelo</label>
                  <input
                    className="w-full"
                    style={{ background: "#f8f8f8" }}
                    value={modelo}
                    readOnly
                    placeholder="Auto-llenado por SKU"
                  />
                </div>
                <div>
                  <label>Pulgada</label>
                  <input
                    className="w-full"
                    style={{ background: "#f8f8f8" }}
                    value={pulgada}
                    readOnly
                    placeholder="Auto-llenado por SKU"
                  />
                </div>
                <div className="full">
                  <label>Descripción</label>
                  <input
                    className="w-full"
                    style={{ background: "#f8f8f8" }}
                    value={descripcion}
                    readOnly
                    placeholder="Auto-llenado por SKU"
                  />
                </div>
                <div>
                  <label>Lote</label>
                  <input
                    className="w-full"
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="seccion-titulo">Parámetros de Muestra</div>
              <div className="form-grid" style={{ marginTop: "10px" }}>
                <div>
                  <label>
                    Muestra Total <span style={{ color: "#d00" }}>*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full"
                    value={muestra}
                    onChange={(e) => setMuestra(e.target.value)}
                    placeholder="Ej. 100"
                    required
                  />
                </div>
                <div>
                  <label>
                    Defectos Encontrados <span style={{ color: "#d00" }}>*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full"
                    value={defectos}
                    onChange={(e) => setDefectos(e.target.value)}
                    required
                  />
                </div>
                <div className="full">
                  <label>Observaciones</label>
                  <textarea
                    className="w-full"
                    rows={2}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Observaciones opcionales"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="seccion-titulo">Resultado</div>
              <div className="flex items-center gap-3" style={{ marginTop: "10px" }}>
                <span style={{ fontSize: "13px", color: "#555" }}>
                  Estado calculado automáticamente:
                </span>
                <span
                  className={
                    estado === "Aceptado" ? "badge badge-cerrada" : "badge badge-rechazada"
                  }
                >
                  {estado}
                </span>
              </div>
            </div>

            <div>
              <div className="seccion-titulo">Checklist de Inspección</div>
              <div className="tabla-wrap" style={{ marginTop: "10px" }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th style={{ width: "50px" }}>Item #</th>
                      <th>Descripción Artículo</th>
                      <th style={{ width: "140px" }}>Estado</th>
                      <th style={{ width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklist.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: "center", fontWeight: "600", fontSize: "12px" }}>
                          {item.item_number}
                        </td>
                        <td>
                          <input
                            className="w-full"
                            placeholder="Descripción del artículo"
                            value={item.descripcion}
                            onChange={(e) => updateItem(idx, "descripcion", e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="flex gap-3">
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name={`aql-estado-${idx}`}
                                value="pass"
                                checked={item.estado === "pass"}
                                onChange={() => updateItem(idx, "estado", "pass")}
                              />{" "}
                              OK
                            </label>
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name={`aql-estado-${idx}`}
                                value="fail"
                                checked={item.estado === "fail"}
                                onChange={() => updateItem(idx, "estado", "fail")}
                              />{" "}
                              Defecto
                            </label>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="btn-accion rojo"
                            style={{ visibility: checklist.length > 1 ? "visible" : "hidden" }}
                            onClick={() => removeItem(idx)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="btn btn-secundario"
                style={{ marginTop: "8px" }}
                onClick={addItem}
              >
                + Agregar Item
              </button>
            </div>

            <div>
              <div className="seccion-titulo">Fotografías</div>
              <p
                style={{ fontSize: "11px", color: "#c00", fontWeight: "600", margin: "8px 0 12px" }}
              >
                Se requieren exactamente 2 fotos (LPN + Pantalla) para poder guardar.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FotoZone
                  label="Foto de LPN"
                  file={fotoLpn}
                  existingUrl={lpnExistente}
                  onSelect={(f) => {
                    setFotoLpn(f);
                    setLpnExistente("");
                  }}
                  onRemove={() => {
                    setFotoLpn(null);
                    setLpnExistente("");
                  }}
                />
                <FotoZone
                  label="Foto de Pantalla / Screen"
                  file={fotoPantalla}
                  existingUrl={pantallaExistente}
                  onSelect={(f) => {
                    setFotoPantalla(f);
                    setPantallaExistente("");
                  }}
                  onRemove={() => {
                    setFotoPantalla(null);
                    setPantallaExistente("");
                  }}
                />
              </div>
              {!fotosListas && (
                <p className="form-error" style={{ marginTop: "8px" }}>
                  Se requieren exactamente 2 fotos (LPN + Pantalla)
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2" style={{ borderTop: "1px solid #e2e2e2" }}>
              <button type="button" className="btn btn-secundario" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !fotosListas}
                className="btn btn-primario"
                style={{ opacity: saving || !fotosListas ? 0.6 : 1 }}
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
  record: AqlRecord;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}

function DetalleModal({ record, onClose, onEdit, onDeleted }: DetalleModalProps) {
  const notify = useNotify();
  const confirm = useConfirm();
  const [lightbox, setLightbox] = useState("");

  const eliminar = async () => {
    const ok = await confirm({
      title: "Eliminar registro AQL",
      message: `¿Eliminar AQL #${record.id}? Esta acción no se puede deshacer.`,
    });
    if (!ok) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/aql/${record.id}`, { method: "DELETE" });
      notify("Registro eliminado.", "success");
      onDeleted();
    } catch (err: any) {
      notify(err.message ?? "Error.", "error");
    }
  };

  const aceptado = record.estado_aql === "Aceptado";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto"
          style={{ border: "1px solid #e2e2e2" }}
        >
          <div className="p-6 space-y-4">
            <div className="modal-titulo">Detalle AQL #{record.id}</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Fecha</span>
                {String(record.fecha_registro).slice(0, 10)}
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Order ID</span>
                {record.order_id ?? record.license_plate ?? "—"}
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>SKU</span>
                {record.sku ?? "—"}
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Marca</span>
                {record.marca ?? "—"}
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Modelo</span>
                {record.modelo ?? "—"}
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Pulgada</span>
                {record.pulgada ?? "—"}
              </div>
              <div className="col-span-2">
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                  Descripción
                </span>
                {record.descripcion ?? "—"}
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>Lote</span>
                {record.lote ?? "—"}
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                  Muestra Total
                </span>
                {record.muestra_total ?? "—"}
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                  Defectos Encontrados
                </span>
                {record.defectos_encontrados ?? "—"}
              </div>
              {record.observaciones && (
                <div className="col-span-2">
                  <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                    Observaciones
                  </span>
                  {record.observaciones}
                </div>
              )}
              <div className="col-span-2">
                <span
                  style={{ fontSize: "11px", color: "#aaa", display: "block", marginBottom: "4px" }}
                >
                  Resultado
                </span>
                <span className={aceptado ? "badge badge-cerrada" : "badge badge-rechazada"}>
                  {record.estado_aql}
                </span>
              </div>
              {record.inspector && (
                <div>
                  <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                    Inspector
                  </span>
                  {record.inspector}
                </div>
              )}
              {record.registrado_por && (
                <div>
                  <span style={{ fontSize: "11px", color: "#aaa", display: "block" }}>
                    Registrado por
                  </span>
                  {record.registrado_por}
                </div>
              )}
            </div>

            {record.checklist?.length ? (
              <div>
                <div className="seccion-titulo">Checklist de Inspección</div>
                <div className="tabla-wrap" style={{ marginTop: "8px" }}>
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th style={{ width: "50px" }}>Item #</th>
                        <th>Descripción</th>
                        <th style={{ width: "96px" }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.checklist.map((item) => (
                        <tr key={item.item_number}>
                          <td style={{ textAlign: "center", fontWeight: "600", fontSize: "12px" }}>
                            {item.item_number}
                          </td>
                          <td>{item.descripcion || "—"}</td>
                          <td>
                            <span
                              className={
                                item.estado === "pass"
                                  ? "badge badge-cerrada"
                                  : "badge badge-rechazada"
                              }
                            >
                              {item.estado === "pass" ? "OK" : "Defecto"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div>
              <div className="seccion-titulo">Fotografías</div>
              {record.foto_lpn_url || record.foto_pantalla_url ? (
                <div className="flex gap-4 flex-wrap" style={{ marginTop: "8px" }}>
                  {record.foto_lpn_url && (
                    <div style={{ textAlign: "center" }}>
                      <img
                        src={record.foto_lpn_url}
                        alt="LPN"
                        style={{
                          height: "96px",
                          width: "auto",
                          objectFit: "cover",
                          cursor: "pointer",
                        }}
                        onClick={() => setLightbox(record.foto_lpn_url!)}
                      />
                      <small
                        style={{
                          display: "block",
                          fontSize: "11px",
                          color: "#aaa",
                          marginTop: "4px",
                        }}
                      >
                        LPN
                      </small>
                    </div>
                  )}
                  {record.foto_pantalla_url && (
                    <div style={{ textAlign: "center" }}>
                      <img
                        src={record.foto_pantalla_url}
                        alt="Pantalla"
                        style={{
                          height: "96px",
                          width: "auto",
                          objectFit: "cover",
                          cursor: "pointer",
                        }}
                        onClick={() => setLightbox(record.foto_pantalla_url!)}
                      />
                      <small
                        style={{
                          display: "block",
                          fontSize: "11px",
                          color: "#aaa",
                          marginTop: "4px",
                        }}
                      >
                        Pantalla
                      </small>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "12px", color: "#aaa", marginTop: "8px" }}>
                  Sin fotografías en este registro.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: "1px solid #e2e2e2" }}>
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
      {lightbox && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightbox("")}
        >
          <button
            style={{
              position: "absolute",
              top: "16px",
              right: "20px",
              color: "#fff",
              fontSize: "36px",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => setLightbox("")}
          >
            ×
          </button>
          <img
            src={lightbox}
            alt=""
            style={{ maxWidth: "92vw", maxHeight: "88vh" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const TABS: TabEstado[] = ["Todas", "Aceptado", "Rechazado"];

export default function Aql() {
  const notify = useNotify();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabEstado>("Todas");
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailRec, setDetailRec] = useState<AqlRecord | null>(null);
  const [editRec, setEditRec] = useState<AqlRecord | null>(null);
  const [showForm, setShowForm] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebSearch(val);
      setPage(1);
    }, 500);
  };

  const listUrl = (() => {
    const qs = new URLSearchParams({ estado: tab, page: String(page), limit: String(PAGE_SIZE) });
    if (debSearch.trim()) qs.set("search", debSearch.trim());
    return `${API_BASE_URL}/api/aql?${qs}`;
  })();

  const { data, isLoading } = useQuery<AqlListResponse>({
    queryKey: ["aql", tab, debSearch, page],
    queryFn: () => apiFetch(listUrl),
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["aql"] });
  }, [qc]);

  const openNew = () => {
    setEditRec(null);
    setShowForm(true);
  };
  const openEdit = (r: AqlRecord) => {
    setDetailRec(null);
    setEditRec(r);
    setShowForm(true);
  };

  const records = data?.data ?? [];
  const total = data?.total ?? 0;
  const counts = data?.counts ?? { todas: 0, aceptado: 0, rechazado: 0 };
  const totalPag = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isMobile = useIsMobile();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Registro de AQL</h1>
        <div className="filtros">
          <input
            style={{ width: "224px" }}
            placeholder="Buscar por Order ID, SKU…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button className="btn btn-primario" onClick={openNew}>
            + Nuevo AQL
          </button>
        </div>
      </div>

      {/* Tabs de estado */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => {
          const cnt =
            t === "Todas" ? counts.todas : t === "Aceptado" ? counts.aceptado : counts.rechazado;
          const activo = tab === t;
          return (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
              style={{
                padding: "6px 16px",
                fontSize: "13px",
                border: "1px solid #e2e2e2",
                background: activo ? "#0d2b4e" : "#fff",
                color: activo ? "#fff" : "#333",
                cursor: "pointer",
              }}
            >
              {t}{" "}
              <span style={{ marginLeft: "4px", fontSize: "11px", opacity: 0.75 }}>({cnt})</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="vacio">Cargando...</p>
      ) : records.length === 0 ? (
        <p className="vacio">Sin registros AQL.</p>
      ) : isMobile ? (
        /* ── Vista de tarjetas (móvil) ── */
        <div style={{ border: "1px solid #e2e2e2", background: "#fff" }}>
          <div className="tabla-cards">
            {records.map((r, i) => {
              const aceptado = r.estado_aql === "Aceptado";
              const tieneFotos = !!(r.foto_lpn_url && r.foto_pantalla_url);
              return (
                <div key={r.id} className="tabla-card" onClick={() => setDetailRec(r)}>
                  {/* Header: Order ID + Estado */}
                  <div className="tabla-card-header">
                    <div style={{ minWidth: 0 }}>
                      <div className="tabla-card-meta">
                        #{(page - 1) * PAGE_SIZE + i + 1} · {String(r.fecha_registro).slice(0, 10)}
                      </div>
                      <div className="tabla-card-title">{r.order_id ?? r.license_plate ?? "—"}</div>
                    </div>
                    <span className={aceptado ? "badge badge-cerrada" : "badge badge-rechazada"} style={{ flexShrink: 0 }}>
                      {r.estado_aql ?? "—"}
                    </span>
                  </div>

                  {/* SKU + Marca */}
                  <div className="tabla-card-row">
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">SKU</span>
                      <span className="tabla-card-value">{r.sku ?? "—"}</span>
                    </div>
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Marca</span>
                      <span className="tabla-card-value">{r.marca ?? "—"}</span>
                    </div>
                  </div>

                  {/* Lote + Muestra */}
                  <div className="tabla-card-row">
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Lote</span>
                      <span className="tabla-card-value">{r.lote ?? "—"}</span>
                    </div>
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Muestra</span>
                      <span className="tabla-card-value">{r.muestra_total ?? "—"}</span>
                    </div>
                  </div>

                  {/* Defectos + Fotos */}
                  <div className="tabla-card-row" style={{ marginBottom: 0 }}>
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Defectos</span>
                      <span className="tabla-card-value" style={{ color: (r.defectos_encontrados ?? 0) > 0 ? "#c62828" : "#222" }}>
                        {r.defectos_encontrados ?? "—"}
                      </span>
                    </div>
                    <div className="tabla-card-field">
                      <span className="tabla-card-label">Fotos</span>
                      <span style={{ fontWeight: "bold", fontSize: 13, color: tieneFotos ? "#2e7d32" : "#c62828" }}>
                        {tieneFotos ? "✓ OK" : "✗ Falta"}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="tabla-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-accion" onClick={() => setDetailRec(r)}>Ver</button>
                    <button className="btn-accion" onClick={() => openEdit(r)}>Editar</button>
                    <button className="btn-accion rojo" onClick={async () => {
                      const ok = await confirm({ title: "Eliminar", message: `¿Eliminar AQL #${r.id}?` });
                      if (ok) {
                        try {
                          await apiFetch(`${API_BASE_URL}/api/aql/${r.id}`, { method: "DELETE" });
                          refresh();
                        } catch (err: any) {
                          notify(err.message ?? "Error.", "error");
                        }
                      }
                    }}>Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPag > 1 && (
            <div className="paginador">
              <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>← Anterior</button>
                <span style={{ padding: "0 8px" }}>{page} / {totalPag}</span>
                <button onClick={() => setPage(p => Math.min(totalPag, p + 1))} disabled={page >= totalPag}>Siguiente →</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Vista de tabla (desktop) ── */
        <>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Order ID</th>
                  <th>SKU</th>
                  <th>Marca</th>
                  <th>Lote</th>
                  <th style={{ textAlign: "right" }}>Muestra</th>
                  <th style={{ textAlign: "right" }}>Defectos</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "center" }}>Fotos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => {
                  const aceptado = r.estado_aql === "Aceptado";
                  const tieneFotos = !!(r.foto_lpn_url && r.foto_pantalla_url);
                  return (
                    <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setDetailRec(r)}>
                      <td style={{ color: "#aaa" }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td>{String(r.fecha_registro).slice(0, 10)}</td>
                      <td>{r.order_id ?? r.license_plate ?? "—"}</td>
                      <td>{r.sku ?? "—"}</td>
                      <td>{r.marca ?? "—"}</td>
                      <td>{r.lote ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{r.muestra_total ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{r.defectos_encontrados ?? "—"}</td>
                      <td>
                        <span className={aceptado ? "badge badge-cerrada" : "badge badge-rechazada"}>
                          {r.estado_aql ?? "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: "bold", color: tieneFotos ? "#2e7d32" : "#c62828" }}>
                          {tieneFotos ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button className="btn-accion" onClick={() => setDetailRec(r)}>Ver</button>{" "}
                        <button className="btn-accion" onClick={() => openEdit(r)}>Editar</button>{" "}
                        <button className="btn-accion rojo" onClick={async () => {
                          const ok = await confirm({ title: "Eliminar", message: `¿Eliminar AQL #${r.id}?` });
                          if (ok) {
                            try {
                              await apiFetch(`${API_BASE_URL}/api/aql/${r.id}`, { method: "DELETE" });
                              refresh();
                            } catch (err: any) {
                              notify(err.message ?? "Error.", "error");
                            }
                          }
                        }}>Eliminar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPag > 1 && (
            <div className="paginador">
              {Array.from({ length: totalPag }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPag || Math.abs(p - page) <= 2)
                .map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={p === page ? "activo" : ""}>
                    {p}
                  </button>
                ))}
            </div>
          )}
        </>
      )}

      {detailRec && (
        <DetalleModal
          record={detailRec}
          onClose={() => setDetailRec(null)}
          onEdit={() => openEdit(detailRec)}
          onDeleted={() => {
            setDetailRec(null);
            refresh();
          }}
        />
      )}
      {showForm && (
        <FormModal
          record={editRec}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
