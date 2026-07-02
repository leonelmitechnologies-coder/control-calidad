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

const AREAS = ['Produccion', 'Almacen', 'Logistica', 'Administracion', 'Mantenimiento', 'Calidad', 'Ventas', 'Otro'] as const;
const TIPOS = ['Producto no conforme', 'Proceso fuera de parametro', 'Documentacion incorrecta', 'Equipo defectuoso', 'Incumplimiento de procedimiento', 'Proveedor', 'Otro'] as const;
const SEVERIDADES = ['Alta', 'Media', 'Baja'] as const;

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
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white"
        style={{ border: '1px solid #e2e2e2' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 bg-white flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #e2e2e2' }}
        >
          <div id="nc-form-title" className="modal-titulo" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            {title}
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#777', lineHeight: 1 }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5">

            {/* Fecha + Hora (side by side) */}
            <div className="form-grid" style={{ marginBottom: 14 }}>
              {/* Fecha — read only, auto from server */}
              <div className="form-group">
                <label>{t('nc.form.fecha')}</label>
                <input
                  type="text"
                  value={new Date().toLocaleDateString('es-MX')}
                  readOnly
                  style={{ background: '#f4f6f9', color: '#777', cursor: 'not-allowed' }}
                />
              </div>

              {/* Hora */}
              <div className="form-group">
                <label htmlFor="nc-hora">{t('nc.form.hora')} *</label>
                <input
                  ref={firstInputRef}
                  id="nc-hora"
                  type="time"
                  value={values.hora}
                  onChange={(e) => set('hora', e.target.value)}
                />
                {errors.hora && <span className="form-error">{errors.hora}</span>}
              </div>
            </div>

            {/* Área */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label htmlFor="nc-area">{t('nc.form.area')} *</label>
              <select
                id="nc-area"
                value={values.area}
                onChange={(e) => set('area', e.target.value)}
              >
                <option value="">— Seleccionar área —</option>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              {errors.area && <span className="form-error">{errors.area}</span>}
            </div>

            {/* Tipo */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label htmlFor="nc-tipo">{t('nc.form.tipo')} *</label>
              <select
                id="nc-tipo"
                value={values.tipo}
                onChange={(e) => set('tipo', e.target.value)}
              >
                <option value="">— Seleccionar tipo —</option>
                {TIPOS.map((tp) => (
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
              {errors.tipo && <span className="form-error">{errors.tipo}</span>}
            </div>

            {/* Severidad */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label htmlFor="nc-severidad">{t('nc.form.severidad')} *</label>
              <select
                id="nc-severidad"
                value={values.severidad}
                onChange={(e) => set('severidad', e.target.value)}
              >
                <option value="">— Seleccionar severidad —</option>
                {SEVERIDADES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.severidad && <span className="form-error">{errors.severidad}</span>}
            </div>

            {/* Descripción */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label htmlFor="nc-descripcion">{t('nc.form.descripcion')} *</label>
              <textarea
                id="nc-descripcion"
                rows={3}
                value={values.descripcion}
                onChange={(e) => set('descripcion', e.target.value)}
                maxLength={500}
                placeholder="Descripción detallada de la no conformidad…"
              />
              <div className="flex justify-between" style={{ marginTop: 4 }}>
                {errors.descripcion
                  ? <span className="form-error">{errors.descripcion}</span>
                  : <span />}
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  {values.descripcion.length}/500
                </span>
              </div>
            </div>

            {/* Responsable */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label htmlFor="nc-responsable">{t('nc.form.responsable')} *</label>
              <input
                id="nc-responsable"
                type="text"
                value={values.responsable}
                onChange={(e) => set('responsable', e.target.value)}
                placeholder="Nombre del responsable"
              />
              {errors.responsable && <span className="form-error">{errors.responsable}</span>}
            </div>

            {/* Acción correctiva */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label htmlFor="nc-accion">{t('nc.form.accion')} *</label>
              <textarea
                id="nc-accion"
                rows={3}
                value={values.accion}
                onChange={(e) => set('accion', e.target.value)}
                placeholder="Descripción de la acción correctiva…"
              />
              {errors.accion && <span className="form-error">{errors.accion}</span>}
            </div>

          </div>

          {/* Footer actions */}
          <div
            className="sticky bottom-0 bg-white flex justify-end px-6 py-4"
            style={{ borderTop: '1px solid #e2e2e2' }}
          >
            <div className="btn-grupo" style={{ marginTop: 0 }}>
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="btn btn-secundario"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primario"
              >
                {isEditing ? 'Actualizar' : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
