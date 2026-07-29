import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import type { RechazosInterno, SkuRecord } from "../../types";
import ImageUpload from "../ImageUpload";
import SkuAutocomplete from "../SkuAutocomplete";
import CopqSection, { type CopqValues } from "./CopqSection";
import SignatureCaptureSection from "./SignatureCaptureSection";

// ── Constants ─────────────────────────────────────────────────────────────────

const ORIGENES = [
  "FFT Lineas",
  "FFT Paletizado",
  "Almacen",
  "Shipping B2B",
  "Shipping B2C",
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RiFormValues {
  fecha_registro: string;
  license_plate: string;
  sku: string;
  marca: string;
  modelo: string;
  pulgada: string;
  descripcion: string;
  defecto: string;
  actividad_realizar: string;
  costo_no_calidad: number;
  manual_override: boolean;
  origen_hallazgo: string;
  inspector: string;
  firma_digital: string;
  newFiles: File[];
}

type FieldErrors = Partial<
  Record<keyof Omit<RiFormValues, "newFiles" | "manual_override"> | "firma" | "general", string>
>;

interface RiFormProps {
  isOpen: boolean;
  isEditing: boolean;
  data?: RechazosInterno | null;
  onSubmit: (values: RiFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: RiFormValues = {
  fecha_registro: today(),
  license_plate: "",
  sku: "",
  marca: "",
  modelo: "",
  pulgada: "",
  descripcion: "",
  defecto: "",
  actividad_realizar: "",
  costo_no_calidad: 0,
  manual_override: false,
  origen_hallazgo: "",
  inspector: "",
  firma_digital: "",
  newFiles: [],
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RiForm({
  isOpen,
  isEditing,
  data,
  onSubmit,
  onCancel,
  submitting = false,
}: RiFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [values, setValues] = useState<RiFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showSigError, setShowSigError] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // ── Populate form on open ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && data) {
      setValues({
        fecha_registro: data.fecha_registro?.slice(0, 10) ?? today(),
        license_plate: data.license_plate ?? "",
        sku: data.sku ?? "",
        marca: data.marca ?? "",
        modelo: data.modelo ?? "",
        pulgada: data.pulgada ?? "",
        descripcion: data.descripcion ?? "",
        defecto: data.defecto ?? "",
        actividad_realizar: data.actividad_realizar ?? "",
        costo_no_calidad: Number(data.costo_no_calidad) || 0,
        manual_override: false,
        origen_hallazgo: data.origen_hallazgo ?? "",
        inspector: data.inspector ?? "",
        firma_digital: data.firma_digital ?? "",
        newFiles: [],
      });
    } else {
      setValues({ ...EMPTY_FORM, fecha_registro: today(), inspector: user?.name ?? "" });
    }

    setErrors({});
    setShowSigError(false);
  }, [isOpen, isEditing, data, user]);

  // Focus first field on open
  useEffect(() => {
    if (isOpen) setTimeout(() => firstInputRef.current?.focus(), 60);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  // ── Value helpers ─────────────────────────────────────────────────────────

  function set<K extends keyof RiFormValues>(field: K, val: RiFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSkuSelect(record: SkuRecord) {
    setValues((prev) => ({
      ...prev,
      sku: record.sku,
      marca: record.marca ?? "",
      modelo: record.modelo ?? "",
      pulgada: record.descripcion ?? "",
      descripcion: record.pulgada ?? "",
    }));
  }

  function handleCopqChange(copq: CopqValues) {
    setValues((prev) => ({
      ...prev,
      defecto: copq.defecto,
      actividad_realizar: copq.actividad_realizar,
      costo_no_calidad: copq.costo_no_calidad,
      manual_override: copq.manual_override,
    }));
    setErrors((prev) => ({
      ...prev,
      defecto: undefined,
      actividad_realizar: undefined,
      costo_no_calidad: undefined,
    }));
  }

  function handleFilesSelect(files: File[]) {
    setValues((prev) => ({ ...prev, newFiles: files }));
  }

  function handleSignature(dataUrl: string) {
    setValues((prev) => ({ ...prev, firma_digital: dataUrl }));
    if (dataUrl) setShowSigError(false);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!values.fecha_registro) e.fecha_registro = t("forms.required_field");
    if (!values.license_plate?.trim()) e.license_plate = t("forms.required_field");
    if (!values.defecto) e.defecto = t("forms.required_field");
    if (!values.actividad_realizar?.trim()) e.actividad_realizar = t("forms.required_field");
    if (!values.origen_hallazgo) e.origen_hallazgo = t("forms.required_field");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(values);
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  const copqValues: CopqValues = {
    defecto: values.defecto,
    actividad_realizar: values.actividad_realizar,
    costo_no_calidad: values.costo_no_calidad,
    manual_override: values.manual_override,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ri-form-title"
      className="fixed inset-0 z-[800] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.5)" }} aria-hidden="true" />

      <div
        className="relative z-10 w-full overflow-y-auto"
        style={{
          maxWidth: 680,
          maxHeight: "92vh",
          background: "#fff",
          border: "1px solid #e2e2e2",
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between"
          style={{ padding: "16px 24px", borderBottom: "2px solid #0d2b4e", background: "#fff" }}
        >
          <h2
            id="ri-form-title"
            className="modal-titulo"
            style={{ margin: 0, border: "none", paddingBottom: 0 }}
          >
            {isEditing ? `Rechazo Interno #${data?.id ?? ""} — Editar` : "Nuevo Rechazo Interno"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              fontSize: 18,
              color: "#777",
              cursor: "pointer",
              padding: "2px 6px",
            }}
            aria-label={t("common.cancel")}
          >
            &#10005;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ padding: "20px 24px" }}>
            {/* ── Main field grid ── */}
            <div className="form-grid" style={{ marginBottom: 16 }}>
              {/* Fecha */}
              <div>
                <label htmlFor="ri-fecha">
                  Fecha de Registro <span style={{ color: "#c0392b" }}>*</span>
                </label>
                <input
                  ref={firstInputRef}
                  id="ri-fecha"
                  type="date"
                  value={values.fecha_registro}
                  onChange={(e) => set("fecha_registro", e.target.value)}
                  required
                  style={errors.fecha_registro ? { borderColor: "#c0392b" } : undefined}
                />
                {errors.fecha_registro && (
                  <span className="form-error">{errors.fecha_registro}</span>
                )}
              </div>

              {/* License Plate */}
              <div>
                <label htmlFor="ri-lp">
                  License Plate <span style={{ color: "#c0392b" }}>*</span>
                </label>
                <input
                  id="ri-lp"
                  type="text"
                  value={values.license_plate}
                  onChange={(e) => set("license_plate", e.target.value.toUpperCase())}
                  placeholder="Ej. MT123456"
                  style={errors.license_plate ? { borderColor: "#c0392b" } : undefined}
                />
                {errors.license_plate && <span className="form-error">{errors.license_plate}</span>}
              </div>

              {/* SKU */}
              <div>
                <label htmlFor="ri-sku">SKU</label>
                <SkuAutocomplete
                  value={values.sku}
                  onChange={(text) => set("sku", text)}
                  onSelect={handleSkuSelect}
                  placeholder="Código de producto"
                />
              </div>

              {/* Marca */}
              <div>
                <label htmlFor="ri-marca">Marca</label>
                <input
                  id="ri-marca"
                  type="text"
                  value={values.marca}
                  onChange={(e) => set("marca", e.target.value)}
                  placeholder="Ej. Samsung"
                />
              </div>

              {/* Modelo */}
              <div>
                <label htmlFor="ri-modelo">Modelo</label>
                <input
                  id="ri-modelo"
                  type="text"
                  value={values.modelo}
                  onChange={(e) => set("modelo", e.target.value)}
                  placeholder="Ej. UN55TU8000"
                />
              </div>

              {/* Pulgada */}
              <div>
                <label htmlFor="ri-pulgada">Pulgada</label>
                <input
                  id="ri-pulgada"
                  type="text"
                  value={values.pulgada}
                  onChange={(e) => set("pulgada", e.target.value)}
                  placeholder='Ej. 55"'
                />
              </div>

              {/* Descripción — full width textarea */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="ri-desc">Descripción</label>
                <textarea
                  id="ri-desc"
                  rows={2}
                  value={values.descripcion}
                  onChange={(e) => set("descripcion", e.target.value)}
                  placeholder="Observaciones del producto"
                />
              </div>
            </div>

            {/* ── Defecto & COPQ ── */}
            <CopqSection
              values={copqValues}
              onChange={handleCopqChange}
              errors={{
                defecto: errors.defecto,
                actividad_realizar: errors.actividad_realizar,
                costo_no_calidad: errors.costo_no_calidad,
              }}
            />

            {/* ── Origen + Inspector ── */}
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div>
                <label htmlFor="ri-origen">
                  Origen de Hallazgo <span style={{ color: "#c0392b" }}>*</span>
                </label>
                <select
                  id="ri-origen"
                  value={values.origen_hallazgo}
                  onChange={(e) => set("origen_hallazgo", e.target.value)}
                  style={errors.origen_hallazgo ? { borderColor: "#c0392b" } : undefined}
                >
                  <option value="">— Seleccionar —</option>
                  {ORIGENES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {errors.origen_hallazgo && (
                  <span className="form-error">{errors.origen_hallazgo}</span>
                )}
              </div>

              <div>
                <label htmlFor="ri-inspector">Inspector</label>
                <input
                  id="ri-inspector"
                  type="text"
                  value={values.inspector}
                  readOnly
                  style={{ background: "#f4f6f9", color: "#777", cursor: "default" }}
                />
                {errors.inspector && <span className="form-error">{errors.inspector}</span>}
              </div>
            </div>

            {/* ── Fotos ── */}
            <div style={{ marginTop: 20 }}>
              <div className="seccion-titulo" style={{ marginBottom: 10 }}>
                Fotos del Producto
              </div>

              {isEditing && data?.images && data.images.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
                    Fotos existentes ({data.images.length})
                  </p>
                  <div className="grid grid-cols-4" style={{ gap: 8 }}>
                    {data.images.map((img) => (
                      <div
                        key={img.id}
                        style={{
                          aspectRatio: "1",
                          overflow: "hidden",
                          border: "1px solid #e2e2e2",
                          background: "#f4f6f9",
                        }}
                      >
                        <img
                          src={img.url}
                          alt={img.filename}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ImageUpload
                onFilesSelect={handleFilesSelect}
                maxFiles={5}
                label={`Agregar fotos nuevas (máx 5${isEditing && data?.images?.length ? `, ya tiene ${data.images.length}` : ""})`}
              />
            </div>

            {/* ── Firma ── */}
            <div style={{ marginTop: 20, marginBottom: 8 }}>
              <div className="seccion-titulo" style={{ marginBottom: 8 }}>
                Firma de Recibido
              </div>
              <p style={{ fontSize: 11, color: "#777", marginBottom: 6 }}>
                Firma del responsable de recibir el reproceso
              </p>
              <SignatureCaptureSection
                signature={values.firma_digital}
                onSignature={handleSignature}
                showError={showSigError}
              />
              {errors.firma && (
                <span className="form-error" style={{ marginTop: 6 }}>
                  {errors.firma}
                </span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="sticky bottom-0 z-10 flex items-center justify-between"
            style={{
              gap: 12,
              padding: "14px 24px",
              borderTop: "1px solid #e2e2e2",
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, color: "#777" }}>
              {values.firma_digital ? (
                <span style={{ color: "#2e7d32", fontWeight: 700 }}>Firma capturada</span>
              ) : (
                <span style={{ color: "#aaa" }}>Sin firma (opcional)</span>
              )}
            </div>
            <div className="btn-grupo">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="btn btn-secundario"
                style={submitting ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primario"
                style={submitting ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                {submitting && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      marginRight: 6,
                    }}
                  />
                )}
                {isEditing ? "Actualizar" : t("common.save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
