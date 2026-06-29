/**
 * ContainerFields
 *
 * Grouped form section for container information:
 * - Número de Contenedor (required)
 * - Tipo de Contenedor (select, required)
 * - Peso Total (decimal, required, kg)
 * - Volumen Cúbico (decimal, required, m³)
 */

import { useTranslation } from 'react-i18next';

// ── Constants ─────────────────────────────────────────────────────────────────

export const TIPOS_CONTENEDOR = [
  '20ft',
  '40ft',
  '40ft HC',
  '45ft',
  '48ft',
  '53ft',
  'LTL',
  'FTL',
] as const;

export type TipoContenedor = (typeof TIPOS_CONTENEDOR)[number];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContainerValues {
  numero_contenedor: string;
  tipo_contenedor: string;
  peso_total: number | '';
  volumen_cubico: number | '';
}

type ContainerErrors = Partial<Record<keyof ContainerValues, string>>;

interface ContainerFieldsProps {
  values: ContainerValues;
  errors?: ContainerErrors;
  onChange: (values: ContainerValues) => void;
  disabled?: boolean;
}

// ── Input class helper ────────────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-md border px-3 py-2 text-sm shadow-sm',
    'focus:outline-none focus:ring-2 focus:ring-blue-400',
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-300',
  ].join(' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContainerFields({
  values,
  errors = {},
  onChange,
  disabled = false,
}: ContainerFieldsProps) {
  const { t } = useTranslation();

  function set<K extends keyof ContainerValues>(key: K, val: ContainerValues[K]) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div className="space-y-4">
      {/* Número de Contenedor + Tipo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Número de Contenedor */}
        <div>
          <label htmlFor="ls-num-contenedor" className="block text-sm font-medium text-gray-700 mb-1">
            {t('liberacion_shipping.form.numero_contenedor')} <span className="text-red-500">*</span>
          </label>
          <input
            id="ls-num-contenedor"
            type="text"
            value={values.numero_contenedor}
            onChange={(e) => set('numero_contenedor', e.target.value)}
            placeholder="Ej. TCKU1234567"
            disabled={disabled}
            className={inputCls(!!errors.numero_contenedor)}
          />
          {errors.numero_contenedor && (
            <p className="mt-1 text-xs text-red-600">{errors.numero_contenedor}</p>
          )}
        </div>

        {/* Tipo de Contenedor */}
        <div>
          <label htmlFor="ls-tipo-contenedor" className="block text-sm font-medium text-gray-700 mb-1">
            {t('liberacion_shipping.form.tipo_contenedor')} <span className="text-red-500">*</span>
          </label>
          <select
            id="ls-tipo-contenedor"
            value={values.tipo_contenedor}
            onChange={(e) => set('tipo_contenedor', e.target.value)}
            disabled={disabled}
            className={inputCls(!!errors.tipo_contenedor)}
          >
            <option value="">— Seleccionar —</option>
            {TIPOS_CONTENEDOR.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
          {errors.tipo_contenedor && (
            <p className="mt-1 text-xs text-red-600">{errors.tipo_contenedor}</p>
          )}
        </div>
      </div>

      {/* Peso Total + Volumen Cúbico */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Peso Total */}
        <div>
          <label htmlFor="ls-peso" className="block text-sm font-medium text-gray-700 mb-1">
            {t('liberacion_shipping.form.peso_total')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="ls-peso"
              type="number"
              min="0"
              step="0.01"
              value={values.peso_total}
              onChange={(e) => set('peso_total', e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="0.00"
              disabled={disabled}
              className={inputCls(!!errors.peso_total)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              kg
            </span>
          </div>
          {errors.peso_total && (
            <p className="mt-1 text-xs text-red-600">{errors.peso_total}</p>
          )}
        </div>

        {/* Volumen Cúbico */}
        <div>
          <label htmlFor="ls-volumen" className="block text-sm font-medium text-gray-700 mb-1">
            {t('liberacion_shipping.form.volumen_cubico')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="ls-volumen"
              type="number"
              min="0"
              step="0.01"
              value={values.volumen_cubico}
              onChange={(e) => set('volumen_cubico', e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="0.00"
              disabled={disabled}
              className={inputCls(!!errors.volumen_cubico)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              m³
            </span>
          </div>
          {errors.volumen_cubico && (
            <p className="mt-1 text-xs text-red-600">{errors.volumen_cubico}</p>
          )}
        </div>
      </div>
    </div>
  );
}
