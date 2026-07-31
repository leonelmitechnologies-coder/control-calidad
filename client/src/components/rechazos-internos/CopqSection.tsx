/**
 * CopqSection
 *
 * Dedicated section for the COPQ (Cost of Poor Quality) auto-fill logic.
 *
 * Responsibilities:
 *   - Defecto <select> dropdown (all 11 RI_DEFECTOS entries)
 *   - On defecto change: auto-fill actividad_realizar + costo_no_calidad from RI_DEFECTOS
 *   - Both auto-filled fields are read-only unless manual override is active
 *   - Manual Override checkbox: unlocks fields; on uncheck restores original mapping values
 *   - Visual mapping badge: "Defecto → Actividad → Costo"
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFECTO_NAMES, getCopqMapping, RI_DEFECTOS } from "../../data/copq-mapping";
import { formatCurrency } from "../../utils/formatters";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CopqValues {
  defecto: string;
  actividad_realizar: string;
  costo_no_calidad: number;
  manual_override: boolean;
}

interface CopqSectionProps {
  values: CopqValues;
  onChange: (updated: CopqValues) => void;
  errors?: {
    defecto?: string;
    actividad_realizar?: string;
    costo_no_calidad?: string;
  };
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CopqSection({
  values,
  onChange,
  errors = {},
  disabled = false,
}: CopqSectionProps) {
  const { t } = useTranslation();

  // Track "original" COPQ values from the mapping so manual override can revert
  const [originalActividad, setOriginalActividad] = useState("");
  const [originalCosto, setOriginalCosto] = useState(0);

  // Sync originals when defecto changes
  useEffect(() => {
    const entry = getCopqMapping(values.defecto);
    if (entry) {
      setOriginalActividad(entry.actividad);
      setOriginalCosto(entry.costo);
    } else {
      setOriginalActividad("");
      setOriginalCosto(0);
    }
  }, [values.defecto]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleDefectoChange(defecto: string) {
    const entry = getCopqMapping(defecto);
    if (entry) {
      onChange({
        ...values,
        defecto,
        actividad_realizar: entry.actividad,
        costo_no_calidad: entry.costo,
        manual_override: false, // reset override on new defecto
      });
    } else {
      onChange({
        ...values,
        defecto,
        actividad_realizar: "",
        costo_no_calidad: 0,
        manual_override: false,
      });
    }
  }

  function handleActividadChange(actividad_realizar: string) {
    onChange({ ...values, actividad_realizar });
  }

  function handleCostoChange(raw: string) {
    const parsed = parseFloat(raw);
    onChange({ ...values, costo_no_calidad: isNaN(parsed) ? 0 : parsed });
  }

  function handleOverrideChange(checked: boolean) {
    if (!checked) {
      // Revert to original COPQ values from mapping
      const entry = getCopqMapping(values.defecto);
      onChange({
        ...values,
        manual_override: false,
        actividad_realizar: entry ? entry.actividad : originalActividad,
        costo_no_calidad: entry ? entry.costo : originalCosto,
      });
    } else {
      onChange({ ...values, manual_override: true });
    }
  }

  const isLocked = !values.manual_override;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Defecto select */}
      <div style={{ marginBottom: 12 }}>
        <label>
          {t("rechazos_internos.form.defecto")}
          <span style={{ color: "#c0392b", marginLeft: 2 }}>*</span>
        </label>
        <select
          id="ri-defecto"
          value={values.defecto}
          onChange={(e) => handleDefectoChange(e.target.value)}
          disabled={disabled}
          style={errors.defecto ? { borderColor: "#c0392b" } : undefined}
        >
          <option value="">— Seleccionar defecto —</option>
          {DEFECTO_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {errors.defecto && <span className="form-error">{errors.defecto}</span>}
      </div>

      {/* Actividad Realizar */}
      <div style={{ marginBottom: 12 }}>
        <label>
          {t("rechazos_internos.form.actividad_realizar")}
          <span style={{ color: "#c0392b", marginLeft: 2 }}>*</span>
        </label>
        <textarea
          id="ri-actividad"
          rows={2}
          value={values.actividad_realizar}
          onChange={(e) => handleActividadChange(e.target.value)}
          readOnly={isLocked}
          disabled={disabled}
          style={{
            ...(isLocked ? { background: "#f4f6f9", color: "#777", cursor: "not-allowed" } : {}),
            ...(errors.actividad_realizar ? { borderColor: "#c0392b" } : {}),
          }}
        />
        {errors.actividad_realizar && (
          <span className="form-error">{errors.actividad_realizar}</span>
        )}
      </div>

      {/* Costo No Calidad */}
      <div style={{ marginBottom: 12 }}>
        <label>
          {t("rechazos_internos.form.costo_no_calidad")}
          <span style={{ color: "#c0392b", marginLeft: 2 }}>*</span>
        </label>
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#777",
              pointerEvents: "none",
              fontSize: 13,
            }}
          >
            $
          </span>
          <input
            id="ri-costo"
            type="number"
            step="0.01"
            min="0"
            value={values.costo_no_calidad}
            onChange={(e) => handleCostoChange(e.target.value)}
            readOnly={isLocked}
            disabled={disabled}
            style={{
              paddingLeft: 22,
              paddingRight: 48,
              ...(isLocked ? { background: "#f4f6f9", color: "#777", cursor: "not-allowed" } : {}),
              ...(errors.costo_no_calidad ? { borderColor: "#c0392b" } : {}),
            }}
          />
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              fontWeight: 600,
              color: "#777",
              pointerEvents: "none",
            }}
          >
            MXN
          </span>
        </div>
        {/* Formatted display */}
        {values.costo_no_calidad > 0 && (
          <p style={{ marginTop: 4, fontSize: 12, color: "#0d2b4e", fontWeight: 700 }}>
            {formatCurrency(values.costo_no_calidad)}
          </p>
        )}
        {errors.costo_no_calidad && <span className="form-error">{errors.costo_no_calidad}</span>}
      </div>

      {/* Manual Override checkbox */}
      <div
        style={{
          background: "#fffbf0",
          border: "1px solid #e2e2e2",
          padding: "10px 14px",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <input
          id="ri-manual-override"
          type="checkbox"
          checked={values.manual_override}
          onChange={(e) => handleOverrideChange(e.target.checked)}
          disabled={disabled || !values.defecto}
          style={{
            width: "auto",
            marginTop: 2,
            cursor: disabled || !values.defecto ? "not-allowed" : "pointer",
          }}
        />
        <label
          htmlFor="ri-manual-override"
          style={{
            cursor: "pointer",
            margin: 0,
            textTransform: "none",
            fontSize: 13,
            fontWeight: 600,
            color: "#856404",
            letterSpacing: 0,
          }}
        >
          {t("rechazos_internos.form.manual_override")}
          <span
            style={{ display: "block", fontSize: 11, fontWeight: 400, color: "#777", marginTop: 2 }}
          >
            Desbloquea los campos de actividad y costo para edición manual. Al desmarcar, los
            valores originales del COPQ se restauran.
          </span>
        </label>
      </div>
    </div>
  );
}
