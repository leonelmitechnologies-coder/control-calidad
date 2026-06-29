/**
 * SkuAutocomplete
 * Input + dropdown for looking up SKU records from /api/catalogo-sku.
 *
 * Features:
 *  - 300 ms debounce before API call
 *  - Cache: repeated identical queries skip the network
 *  - Max 10 results in dropdown
 *  - Keyboard navigation: ArrowUp/Down, Enter to select, Escape to close
 *  - "Sin resultados" placeholder when API returns empty
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../utils/api-client';
import type { SkuRecord } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface SkuAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (sku: SkuRecord) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface SkuApiResponse {
  data: SkuRecord[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SkuAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled = false,
}: SkuAutocompleteProps) {
  const { t } = useTranslation();

  const [open, setOpen]           = useState(false);
  const [results, setResults]     = useState<SkuRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [focusIdx, setFocusIdx]   = useState(-1);

  // Simple in-memory cache: query → results
  const cache = useRef<Map<string, SkuRecord[]>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);

  // ── Search ────────────────────────────────────────────────────────────────

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Cache hit
    if (cache.current.has(trimmed)) {
      setResults(cache.current.get(trimmed)!);
      setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const res = await apiGet<SkuApiResponse>('/api/catalogo-sku', { q: trimmed });
      const rows = (res?.data ?? []).slice(0, 10);
      cache.current.set(trimmed, rows);
      setResults(rows);
      setOpen(true);
    } catch {
      setResults([]);
      setOpen(true); // still open to show "Sin resultados"
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Input change with debounce ────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange(text);
    setFocusIdx(-1);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(text), 300);
  };

  // ── Item selection ────────────────────────────────────────────────────────

  const handleSelect = (record: SkuRecord) => {
    onChange(record.sku);
    onSelect(record);
    setOpen(false);
    setFocusIdx(-1);
    inputRef.current?.blur();
  };

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusIdx >= 0 && focusIdx < results.length) {
        handleSelect(results[focusIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setFocusIdx(-1);
    }
  };

  // ── Close dropdown when clicking outside ─────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => value.trim().length > 0 && results.length > 0 && setOpen(true)}
        placeholder={placeholder ?? t('sku.search')}
        disabled={disabled}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={[
          'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
          'placeholder-gray-400 shadow-sm',
          'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
          loading ? 'pr-8' : '',
        ].join(' ')}
      />

      {/* Loading spinner inside input */}
      {loading && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          <svg
            className="h-4 w-4 animate-spin text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </span>
      )}

      {/* Dropdown */}
      {open && !disabled && (
        <ul
          role="listbox"
          className={[
            'absolute z-50 mt-1 w-full overflow-auto rounded-md border border-gray-200',
            'bg-white shadow-lg',
            'max-h-60 text-sm',
          ].join(' ')}
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-gray-500 italic select-none">
              {t('sku.notfound')}
            </li>
          ) : (
            results.map((record, idx) => (
              <li
                key={record.id}
                role="option"
                aria-selected={idx === focusIdx}
                onMouseDown={(e) => {
                  // prevent blur before click
                  e.preventDefault();
                  handleSelect(record);
                }}
                onMouseEnter={() => setFocusIdx(idx)}
                className={[
                  'cursor-pointer px-3 py-2 transition-colors',
                  idx === focusIdx ? 'bg-blue-50 text-blue-700' : 'text-gray-800 hover:bg-gray-50',
                ].join(' ')}
              >
                <span className="font-medium">{record.sku}</span>
                <span className="mx-1 text-gray-400">—</span>
                <span className="text-gray-600">
                  {[record.marca, record.modelo].filter(Boolean).join(' ')}
                  {record.pulgada ? ` (${record.pulgada})` : ''}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
