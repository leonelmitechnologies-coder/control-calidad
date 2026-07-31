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

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SkuRecord } from "../types";
import { apiGet } from "../utils/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

interface SkuAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (sku: SkuRecord) => void;
  placeholder?: string;
  disabled?: boolean;
}

type SkuApiResponse = SkuRecord[] | { data: SkuRecord[] };

// ── Component ─────────────────────────────────────────────────────────────────

export default function SkuAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled = false,
}: SkuAutocompleteProps) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SkuRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);

  // Simple in-memory cache: query → results
  const cache = useRef<Map<string, SkuRecord[]>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const res = await apiGet<SkuApiResponse>("/api/catalogo-sku", { q: trimmed });
      const rows = (Array.isArray(res) ? res : (res?.data ?? [])).slice(0, 25);
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

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusIdx >= 0 && focusIdx < results.length) {
        handleSelect(results[focusIdx]);
      }
    } else if (e.key === "Escape") {
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
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => value.trim().length > 0 && results.length > 0 && setOpen(true)}
        placeholder={placeholder ?? t("sku.search")}
        disabled={disabled}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
        style={loading ? { paddingRight: 32 } : undefined}
      />

      {/* Loading spinner inside input */}
      {loading && (
        <span
          style={{
            pointerEvents: "none",
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          <svg
            className="animate-spin"
            style={{ height: 16, width: 16, color: "#aaa" }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              style={{ opacity: 0.25 }}
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              style={{ opacity: 0.75 }}
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
          style={{
            position: "fixed",
            zIndex: 9999,
            background: "#fff",
            border: "1px solid #e2e2e2",
            borderTop: "none",
            maxHeight: 260,
            overflowY: "auto",
            margin: 0,
            padding: 0,
            listStyle: "none",
            width: containerRef.current?.getBoundingClientRect().width ?? "auto",
            left: containerRef.current?.getBoundingClientRect().left ?? 0,
            top: containerRef.current?.getBoundingClientRect().bottom ?? 0,
          }}
        >
          {results.length === 0 ? (
            <li
              key="no-results"
              style={{
                padding: "8px 12px",
                fontSize: 13,
                color: "#777",
                fontStyle: "italic",
                userSelect: "none",
              }}
            >
              {t("sku.notfound")}
            </li>
          ) : (
            results.map((record, idx) => (
              <li
                key={record.sku}
                role="option"
                aria-selected={idx === focusIdx}
                onMouseDown={(e) => {
                  // prevent blur before click
                  e.preventDefault();
                  handleSelect(record);
                }}
                onMouseEnter={() => setFocusIdx(idx)}
                style={{
                  padding: "8px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  borderBottom: "1px solid #e2e2e2",
                  background: idx === focusIdx ? "#f0f4f9" : "#fff",
                  color: "#111",
                }}
              >
                <span style={{ fontWeight: 600 }}>{record.sku}</span>
                <span style={{ margin: "0 4px", color: "#aaa" }}>—</span>
                <span style={{ color: "#444" }}>
                  {[record.marca, record.modelo].filter(Boolean).join(" ")}
                  {record.pulgada ? ` (${record.pulgada})` : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
