/**
 * NcForm — Modal form for creating or editing a No Conformidad
 *
 * Props:
 *   isOpen    - controls visibility
 *   isEditing - true = edit mode (pre-populated), false = create mode
 *   data      - existing NC data when editing
 *   onSubmit  - called with form values on valid submit
 *   onCancel  - called when user cancels
 *
 * Validates all required fields before calling onSubmit.
 * Uses a portal so it always renders above the page content.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { NoConformidad } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const AREAS = ['Recepción', 'Almacén', 'Inspección', 'Expedición', 'Otros'] as const;
const TIPOS = ['Defecto', 'Proceso', 'Documentación'] as const;
const SEVERIDADES = ['Crítica', 'Mayor', 'Menor'] as const;

// ── Form state shape ──────────────────────────────────────────────────────────

export interface FormValues {
  hora: string;
  area: string;
  tipo: string;
  descripcion: string;
  severidad: string;
  responsable: string;
  accion: string;
}

const EMPTY_FORM: FormValues = {
  hora: '',
  area: '',
  tipo: '',
  descripcion: '',
  severidad: '',
  responsable: '',
  accion: '',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface NcFormProps {
  isOpen: boolean;
  isEditing: boolean;
  data?: NoConformidad | null;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NcForm({
  isOpen,
  isEditing,
  data,
  onSubmit,
  onCancel,
  submitting = false,
}: NcFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Populate form when opening in edit mode
  useEffect(() => {
    if (isOpen) {
      if (isEditing && data) {
        setValues({
          hora:        (data.hora ?? '').slice(0, 5),
          area:        data.area ?? '',
          tipo:        data.tipo ?? '',
          descripcion: data.descripcion ?? '',
          severidad:   data.severidad ?? '',
          responsable: data.responsable ?? '',
          accion:      data.accion ?? '',
        });
      } else {
        setValues({ ...EMPTY_FORM, hora: new Date().toTimeString().slice(0, 5) });
      }
      setErrors({});
    }
  }, [isOpen, isEditing, data]);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function set(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormValues, string>> = {};
    const required: (keyof FormValues)[] = [
      'hora', 'area', 'tipo', 'descripcion', 'severidad', 'responsable', 'accion',
    ];
    for (const field of required) {
      if (!values[field]?.trim()) {
        newErrors[field] = t('forms.required_field');
      }
    }
    if (values.descripcion.length > 500) {
      newErrors.descripcion = 'Máximo 500 caracteres';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(values);
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  const title = isEditing
    ? `${t('nc.edit')} No Conformidad${data ? ` #${data.id}` : ''}`
    : t('nc.add');

  // ── Render ─────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nc-form-title"
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        className="
          relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto
          bg-white rounded-xl shadow-2xl
          animate-in zoom-in-95 duration-200
        "
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 id="nc-form-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-4">

            {/* Fecha + Hora (side by side) */}
            <div className="grid grid-cols-2 gap-4">
              {/* Fecha — read only, auto from server */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('nc.form.fecha')}
                </label>
                <input
                  type="text"
                  value={new Date().toLocaleDateString('es-MX')}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              {/* Hora */}
              <div>
                <label htmlFor="nc-hora" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('nc.form.hora')} <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  id="nc-hora"
                  type="time"
                  value={values.hora}
                  onChange={(e) => set('hora', e.target.value)}
                  className={`
                    w-full px-3 py-2 text-sm border rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-blue-400
                    ${errors.hora ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                  `}
                />
                {errors.hora && <p className="mt-1 text-xs text-red-600">{errors.hora}</p>}
              </div>
            </div>

            {/* Área */}
            <div>
              <label htmlFor="nc-area" className="block text-sm font-medium text-gray-700 mb-1">
                {t('nc.form.area')} <span className="text-red-500">*</span>
              </label>
              <select
                id="nc-area"
                value={values.area}
                onChange={(e) => set('area', e.target.value)}
                className={`
                  w-full px-3 py-2 text-sm border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-400
                  ${errors.area ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                `}
              >
                <option value="">— Seleccionar área —</option>
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {errors.area && <p className="mt-1 text-xs text-red-600">{errors.area}</p>}
            </div>

            {/* Tipo */}
            <div>
              <label htmlFor="nc-tipo" className="block text-sm font-medium text-gray-700 mb-1">
                {t('nc.form.tipo')} <span className="text-red-500">*</span>
              </label>
              <select
                id="nc-tipo"
                value={values.tipo}
                onChange={(e) => set('tipo', e.target.value)}
                className={`
                  w-full px-3 py-2 text-sm border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-400
                  ${errors.tipo ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                `}
              >
                <option value="">— Seleccionar tipo —</option>
                {TIPOS.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </select>
              {errors.tipo && <p className="mt-1 text-xs text-red-600">{errors.tipo}</p>}
            </div>

            {/* Severidad */}
            <div>
              <label htmlFor="nc-severidad" className="block text-sm font-medium text-gray-700 mb-1">
                {t('nc.form.severidad')} <span className="text-red-500">*</span>
              </label>
              <select
                id="nc-severidad"
                value={values.severidad}
                onChange={(e) => set('severidad', e.target.value)}
                className={`
                  w-full px-3 py-2 text-sm border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-400
                  ${errors.severidad ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                `}
              >
                <option value="">— Seleccionar severidad —</option>
                {SEVERIDADES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.severidad && (
                <p className="mt-1 text-xs text-red-600">{errors.severidad}</p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label htmlFor="nc-descripcion" className="block text-sm font-medium text-gray-700 mb-1">
                {t('nc.form.descripcion')} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="nc-descripcion"
                rows={3}
                value={values.descripcion}
                onChange={(e) => set('descripcion', e.target.value)}
                maxLength={500}
                placeholder="Descripción detallada de la no conformidad…"
                className={`
                  w-full px-3 py-2 text-sm border rounded-lg resize-none
                  focus:outline-none focus:ring-2 focus:ring-blue-400
                  ${errors.descripcion ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                `}
              />
              <div className="flex justify-between mt-1">
                {errors.descripcion
                  ? <p className="text-xs text-red-600">{errors.descripcion}</p>
                  : <span />}
                <span className="text-xs text-gray-400">
                  {values.descripcion.length}/500
                </span>
              </div>
            </div>

            {/* Responsable */}
            <div>
              <label htmlFor="nc-responsable" className="block text-sm font-medium text-gray-700 mb-1">
                {t('nc.form.responsable')} <span className="text-red-500">*</span>
              </label>
              <input
                id="nc-responsable"
                type="text"
                value={values.responsable}
                onChange={(e) => set('responsable', e.target.value)}
                placeholder="Nombre del responsable"
                className={`
                  w-full px-3 py-2 text-sm border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-400
                  ${errors.responsable ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                `}
              />
              {errors.responsable && (
                <p className="mt-1 text-xs text-red-600">{errors.responsable}</p>
              )}
            </div>

            {/* Acción correctiva */}
            <div>
              <label htmlFor="nc-accion" className="block text-sm font-medium text-gray-700 mb-1">
                {t('nc.form.accion')} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="nc-accion"
                rows={3}
                value={values.accion}
                onChange={(e) => set('accion', e.target.value)}
                placeholder="Descripción de la acción correctiva…"
                className={`
                  w-full px-3 py-2 text-sm border rounded-lg resize-none
                  focus:outline-none focus:ring-2 focus:ring-blue-400
                  ${errors.accion ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                `}
              />
              {errors.accion && <p className="mt-1 text-xs text-red-600">{errors.accion}</p>}
            </div>

          </div>

          {/* Footer actions */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center gap-2"
            >
              {submitting && (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isEditing ? 'Actualizar' : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
