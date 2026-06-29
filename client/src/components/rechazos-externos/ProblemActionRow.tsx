/**
 * ProblemActionRow
 * Repeating form row for one problem + corrective action pair.
 *
 * Props:
 *   index       — 0-based index (displayed as 1-based in the label)
 *   descripcion — problem description text
 *   accion      — corrective action text
 *   onChange    — called with (field, value) when either textarea changes
 *   onRemove    — called when "Quitar" is clicked
 *   canRemove   — false when this is the only row (min 1 enforced)
 *   errors      — optional { descripcion?, accion? } error messages
 */

import { useTranslation } from 'react-i18next';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProblemActionRowProps {
  index: number;
  descripcion: string;
  accion: string;
  onChange: (index: number, field: 'descripcion' | 'accion', value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  errors?: { descripcion?: string; accion?: string };
  disabled?: boolean;
}

// ── Textarea helper ───────────────────────────────────────────────────────────

function textareaClass(hasError: boolean) {
  return [
    'block w-full rounded-md border px-3 py-2 text-sm shadow-sm resize-none',
    'focus:outline-none focus:ring-2 focus:ring-blue-500',
    hasError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300',
  ].join(' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProblemActionRow({
  index,
  descripcion,
  accion,
  onChange,
  onRemove,
  canRemove,
  errors = {},
  disabled = false,
}: ProblemActionRowProps) {
  const { t } = useTranslation();
  const num = index + 1;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t('rechazos_externos.form.problem_label', { num })}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disabled}
            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-40"
            aria-label={t('rechazos_externos.form.remove_problem')}
          >
            {t('rechazos_externos.form.remove_problem')}
          </button>
        )}
      </div>

      {/* Problem description */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          {t('rechazos_externos.form.problem_description')}
          <span className="ml-0.5 text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          value={descripcion}
          onChange={(e) => onChange(index, 'descripcion', e.target.value)}
          disabled={disabled}
          placeholder={t('rechazos_externos.form.problem_description_placeholder')}
          className={textareaClass(!!errors.descripcion)}
        />
        {errors.descripcion && (
          <p className="mt-1 text-xs text-red-600">{errors.descripcion}</p>
        )}
      </div>

      {/* Corrective action */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          {t('rechazos_externos.form.corrective_action')}
          <span className="ml-0.5 text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          value={accion}
          onChange={(e) => onChange(index, 'accion', e.target.value)}
          disabled={disabled}
          placeholder={t('rechazos_externos.form.corrective_action_placeholder')}
          className={textareaClass(!!errors.accion)}
        />
        {errors.accion && (
          <p className="mt-1 text-xs text-red-600">{errors.accion}</p>
        )}
      </div>
    </div>
  );
}
