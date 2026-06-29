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

import { useTranslation } from 'react-i18next';
import type { Recepcion } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface TipoSelectorProps {
  value: Recepcion['tipo'];
  onChange: (value: Recepcion['tipo']) => void;
  /** Whether the field is disabled (e.g. in read-only detail view) */
  disabled?: boolean;
}

// ── Options ───────────────────────────────────────────────────────────────────

const OPTIONS: { value: Recepcion['tipo']; labelKey: string }[] = [
  { value: 'Import', labelKey: 'recepciones.tipos.import' },
  { value: 'Export', labelKey: 'recepciones.tipos.export' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TipoSelector({ value, onChange, disabled = false }: TipoSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-3" role="radiogroup" aria-label={t('recepciones.form.tipo')}>
      {OPTIONS.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={[
              'flex items-center gap-2 cursor-pointer select-none',
              'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
              isSelected
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              disabled ? 'cursor-not-allowed opacity-60' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <input
              type="radio"
              className="sr-only" // visually hidden; pill style provides the affordance
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
