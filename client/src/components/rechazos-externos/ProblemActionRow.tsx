/**
 * ProblemActionRow — fila de descripción de problema (sin acción correctiva;
 * las acciones se capturan por departamento en ReForm).
 */

import { useTranslation } from 'react-i18next';

interface ProblemActionRowProps {
  index:       number;
  descripcion: string;
  onChange:    (index: number, value: string) => void;
  onRemove:    (index: number) => void;
  canRemove:   boolean;
  error?:      string;
  disabled?:   boolean;
}

export default function ProblemActionRow({
  index,
  descripcion,
  onChange,
  onRemove,
  canRemove,
  error,
  disabled = false,
}: ProblemActionRowProps) {
  const { t } = useTranslation();
  const num = index + 1;

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e2e2', padding: '14px', marginBottom: 8 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0d2b4e' }}>
          {t('rechazos_externos.form.problem_label', { num })}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disabled}
            className="btn btn-peligro"
            style={{ fontSize: 12, padding: '3px 10px' }}
          >
            {t('rechazos_externos.form.remove_problem')}
          </button>
        )}
      </div>

      <div>
        <label>
          {t('rechazos_externos.form.problem_description')}
          <span style={{ color: '#c0392b', marginLeft: 2 }}>*</span>
        </label>
        <textarea
          rows={3}
          value={descripcion}
          onChange={(e) => onChange(index, e.target.value)}
          disabled={disabled}
          placeholder={t('rechazos_externos.form.problem_description_placeholder')}
          style={error ? { borderColor: '#c0392b' } : undefined}
        />
        {error && <span className="form-error">{error}</span>}
      </div>
    </div>
  );
}
