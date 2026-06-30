/**
 * FilterBar
 *
 * Search input (debounced 500ms), Puesto dropdown, and Estatus radio filter
 * for the Organigrama QC module.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PUESTOS = ['Ingeniero de Calidad', 'Supervisor de Calidad', 'Tecnico de Calidad', 'Especialista de Calidad', 'Inspector de Calidad'] as const;
export type PuestoFilter = (typeof PUESTOS)[number] | '';

export type EstatusFilter = 'todos' | 'activo' | 'inactivo';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FilterBarProps {
  onSearchChange:  (value: string) => void;
  onPuestoChange:  (value: PuestoFilter) => void;
  onEstatusChange: (value: EstatusFilter) => void;
  puesto:  PuestoFilter;
  estatus: EstatusFilter;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilterBar({
  onSearchChange,
  onPuestoChange,
  onEstatusChange,
  puesto,
  estatus,
}: FilterBarProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(inputValue.trim());
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, onSearchChange]);

  const ESTATUS_OPTIONS: { value: EstatusFilter; label: string }[] = [
    { value: 'todos',    label: t('organigrama.filtro_todos') },
    { value: 'activo',   label: t('organigrama.estatus.activo') },
    { value: 'inactivo', label: t('organigrama.estatus.inactivo') },
  ];

  return (
    <div className="filtros">
      {/* Search */}
      <div style={{ flex: 1, minWidth: 180 }}>
        <label>{t('organigrama.filtro_buscar')}</label>
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('organigrama.filtro_buscar_placeholder')}
            style={{ paddingLeft: 32 }}
          />
          {/* Search icon */}
          <svg
            className="absolute pointer-events-none"
            style={{ left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#aaa' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Puesto filter */}
      <div style={{ minWidth: 160 }}>
        <label>{t('organigrama.form.puesto')}</label>
        <select
          value={puesto}
          onChange={(e) => onPuestoChange(e.target.value as PuestoFilter)}
        >
          <option value="">{t('organigrama.filtro_todos_puestos')}</option>
          {PUESTOS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Estatus radio */}
      <div>
        <label>{t('organigrama.form.estatus')}</label>
        <div
          className="flex items-center gap-3"
          style={{ padding: '9px 12px', border: '1px solid #e2e2e2', background: '#fff' }}
        >
          {ESTATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                fontSize: 13,
                color: '#111',
                textTransform: 'none',
                fontWeight: 400,
                marginBottom: 0,
              }}
            >
              <input
                type="radio"
                name="estatus-filter"
                value={opt.value}
                checked={estatus === opt.value}
                onChange={() => onEstatusChange(opt.value)}
                style={{ width: 'auto', accentColor: '#0d2b4e' }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
