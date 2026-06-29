/**
 * FilterBar
 *
 * Search input (debounced 500ms), Puesto dropdown, and Estatus radio filter
 * for the Organigrama QC module.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PUESTOS = ['Jefe QC', 'Supervisor QC', 'Inspector', 'Otro'] as const;
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
    <div className="flex flex-wrap items-end gap-3">
      {/* Search */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('organigrama.filtro_buscar')}
        </label>
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('organigrama.filtro_buscar_placeholder')}
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {/* Search icon */}
          <svg
            className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none"
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
      <div className="min-w-[160px]">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('organigrama.form.puesto')}
        </label>
        <select
          value={puesto}
          onChange={(e) => onPuestoChange(e.target.value as PuestoFilter)}
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('organigrama.filtro_todos_puestos')}</option>
          {PUESTOS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Estatus radio */}
      <div>
        <p className="block text-xs font-medium text-gray-600 mb-1">
          {t('organigrama.form.estatus')}
        </p>
        <div className="flex items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm">
          {ESTATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700 select-none"
            >
              <input
                type="radio"
                name="estatus-filter"
                value={opt.value}
                checked={estatus === opt.value}
                onChange={() => onEstatusChange(opt.value)}
                className="h-3.5 w-3.5 accent-blue-600"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
