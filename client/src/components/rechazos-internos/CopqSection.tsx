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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RI_DEFECTOS, DEFECTO_NAMES, getCopqMapping } from '../../data/copq-mapping';
import { formatCurrency } from '../../utils/formatters';

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
  const [originalActividad, setOriginalActividad] = useState('');
  const [originalCosto, setOriginalCosto] = useState(0);

  // Sync originals when defecto changes
  useEffect(() => {
    const entry = getCopqMapping(values.defecto);
    if (entry) {
      setOriginalActividad(entry.actividad);
      setOriginalCosto(entry.costo);
    } else {
      setOriginalActividad('');
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
        costo_no_calidad:   entry.costo,
        manual_override:    false, // reset override on new defecto
      });
    } else {
      onChange({
        ...values,
        defecto,
        actividad_realizar: '',
        costo_no_calidad:   0,
        manual_override:    false,
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
        manual_override:    false,
        actividad_realizar: entry ? entry.actividad : originalActividad,
        costo_no_calidad:   entry ? entry.costo    : originalCosto,
      });
    } else {
      onChange({ ...values, manual_override: true });
    }
  }

  const isLocked = !values.manual_override;
  const mappingEntry = getCopqMapping(values.defecto);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('rechazos_internos.form.defecto')} & COPQ
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Defecto select */}
      <div>
        <label htmlFor="ri-defecto" className="block text-sm font-medium text-gray-700 mb-1">
          {t('rechazos_internos.form.defecto')} <span className="text-red-500">*</span>
        </label>
        <select
          id="ri-defecto"
          value={values.defecto}
          onChange={(e) => handleDefectoChange(e.target.value)}
          disabled={disabled}
          className={[
            'w-full rounded-md border px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-400',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            errors.defecto ? 'border-red-400 bg-red-50' : 'border-gray-300',
          ].join(' ')}
        >
          <option value="">— Seleccionar defecto —</option>
          {DEFECTO_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {errors.defecto && (
          <p className="mt-1 text-xs text-red-600">{errors.defecto}</p>
        )}
      </div>

      {/* COPQ Mapping badge — only shown when a defecto is selected */}
      {mappingEntry && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
          <p className="font-medium text-blue-800 mb-1">
            {t('rechazos_internos.copq.auto_filled')}
          </p>
          <p className="text-blue-700 leading-relaxed">
            <span className="font-semibold">{t('rechazos_internos.form.defecto')}:</span>{' '}
            {values.defecto}
            {' → '}
            <span className="font-semibold">{t('rechazos_internos.form.actividad_realizar')}:</span>{' '}
            {mappingEntry.actividad}
            {' → '}
            <span className="font-semibold text-blue-900">
              {formatCurrency(mappingEntry.costo)}
            </span>
          </p>
          {values.manual_override && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {t('rechazos_internos.copq.manual_mode')}
            </span>
          )}
        </div>
      )}

      {/* Actividad Realizar */}
      <div>
        <label htmlFor="ri-actividad" className="block text-sm font-medium text-gray-700 mb-1">
          {t('rechazos_internos.form.actividad_realizar')} <span className="text-red-500">*</span>
          {isLocked && mappingEntry && (
            <span className="ml-2 text-xs font-normal text-gray-400 italic">
              ({t('rechazos_internos.copq.auto_filled')})
            </span>
          )}
        </label>
        <textarea
          id="ri-actividad"
          rows={2}
          value={values.actividad_realizar}
          onChange={(e) => handleActividadChange(e.target.value)}
          readOnly={isLocked}
          disabled={disabled}
          className={[
            'w-full rounded-md border px-3 py-2 text-sm shadow-sm resize-none',
            'focus:outline-none focus:ring-2 focus:ring-blue-400',
            'disabled:cursor-not-allowed',
            isLocked
              ? 'bg-gray-50 text-gray-600 border-gray-200 cursor-not-allowed'
              : 'border-gray-300 bg-white',
            errors.actividad_realizar ? 'border-red-400 bg-red-50' : '',
          ].join(' ')}
        />
        {errors.actividad_realizar && (
          <p className="mt-1 text-xs text-red-600">{errors.actividad_realizar}</p>
        )}
      </div>

      {/* Costo No Calidad */}
      <div>
        <label htmlFor="ri-costo" className="block text-sm font-medium text-gray-700 mb-1">
          {t('rechazos_internos.form.costo_no_calidad')} <span className="text-red-500">*</span>
          {isLocked && mappingEntry && (
            <span className="ml-2 text-xs font-normal text-gray-400 italic">
              ({t('rechazos_internos.copq.auto_filled')})
            </span>
          )}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
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
            className={[
              'w-full rounded-md border pl-7 pr-12 py-2 text-sm shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-400',
              'disabled:cursor-not-allowed',
              isLocked
                ? 'bg-gray-50 text-gray-600 border-gray-200 cursor-not-allowed'
                : 'border-gray-300 bg-white',
              errors.costo_no_calidad ? 'border-red-400 bg-red-50' : '',
            ].join(' ')}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">
            MXN
          </span>
        </div>
        {/* Formatted display */}
        {values.costo_no_calidad > 0 && (
          <p className="mt-1 text-xs text-blue-600 font-medium">
            {formatCurrency(values.costo_no_calidad)}
          </p>
        )}
        {errors.costo_no_calidad && (
          <p className="mt-1 text-xs text-red-600">{errors.costo_no_calidad}</p>
        )}
      </div>

      {/* Manual Override checkbox */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <input
          id="ri-manual-override"
          type="checkbox"
          checked={values.manual_override}
          onChange={(e) => handleOverrideChange(e.target.checked)}
          disabled={disabled || !values.defecto}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
        />
        <label htmlFor="ri-manual-override" className="flex-1 cursor-pointer">
          <span className="block text-sm font-medium text-amber-800">
            {t('rechazos_internos.form.manual_override')}
          </span>
          <span className="block text-xs text-amber-600 mt-0.5">
            Desbloquea los campos de actividad y costo para edición manual.
            Al desmarcar, los valores originales del COPQ se restauran.
          </span>
        </label>
      </div>

    </div>
  );
}
