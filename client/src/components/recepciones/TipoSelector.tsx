/**
 * TipoSelector — Radio button group for Import / Export selection.
 *
 * Renders two mutually-exclusive pill-style radio buttons.
 * Works as a controlled component: value + onChange mirror the
 * Recepcion['tipo'] field.
 *
 * Usage:
 *   <TipoSelector value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} />
 */

import { useTranslation } from "react-i18next";
import type { Recepcion } from "../../types";

// ── Props ─────────────────────────────────────────────────────────────────────

interface TipoSelectorProps {
  value: Recepcion["tipo"];
  onChange: (value: Recepcion["tipo"]) => void;
  /** Whether the field is disabled (e.g. in read-only detail view) */
  disabled?: boolean;
}

// ── Options ───────────────────────────────────────────────────────────────────

const OPTIONS: { value: Recepcion["tipo"]; labelKey: string }[] = [
  { value: "Import", labelKey: "recepciones.tipos.import" },
  { value: "Export", labelKey: "recepciones.tipos.export" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TipoSelector({ value, onChange, disabled = false }: TipoSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-3" role="radiogroup" aria-label={t("recepciones.form.tipo")}>
      {OPTIONS.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <label
            key={opt.value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: disabled ? "not-allowed" : "pointer",
              userSelect: "none",
              border: isSelected ? "2px solid #0d2b4e" : "1px solid #e2e2e2",
              padding: isSelected ? "7px 15px" : "8px 16px",
              background: isSelected ? "#edf2f7" : "#fff",
              color: isSelected ? "#0d2b4e" : "#555",
              fontSize: 13,
              fontWeight: isSelected ? 700 : 400,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <input
              type="radio"
              className="sr-only"
              name="tipo"
              value={opt.value}
              checked={isSelected}
              disabled={disabled}
              onChange={() => !disabled && onChange(opt.value)}
            />
            {t(opt.labelKey)}
          </label>
        );
      })}
    </div>
  );
}
