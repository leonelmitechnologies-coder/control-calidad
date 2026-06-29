/**
 * Data formatting helpers
 * Uses date-fns for date operations (already in node_modules).
 */

import { format as dateFnsFormat, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Currency ─────────────────────────────────────────────────────────────────

/**
 * Format a number as currency.
 * @param amount   Numeric amount
 * @param currency ISO currency code (default: 'MXN')
 * @returns        "$1,234.56 MXN"
 */
export function formatCurrency(amount: number, currency = 'MXN'): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '—';
  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  // Intl already includes the currency symbol; append the code for MXN clarity
  return currency === 'MXN' ? formatted : `${formatted} ${currency}`;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

/**
 * Format a date value.
 * @param date   Date object, ISO string, or timestamp
 * @param fmt    date-fns format string (default: 'yyyy-MM-dd')
 * @returns      Formatted date string, or '—' on invalid input
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  fmt = 'yyyy-MM-dd',
): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : (typeof date === 'string' ? parseISO(date) : new Date(date));
  if (!isValid(d)) return '—';
  return dateFnsFormat(d, fmt, { locale: es });
}

/**
 * Format a date-time value.
 * @param date  Date object, ISO string, or timestamp
 * @returns     "dd/MM/yyyy HH:mm"
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

/**
 * Format just the time portion of a date.
 * @param date  Date object, ISO string, or timestamp
 * @returns     "HH:mm"
 */
export function formatTime(date: Date | string | number | null | undefined): string {
  return formatDate(date, 'HH:mm');
}

// ── Phone ─────────────────────────────────────────────────────────────────────

/**
 * Format a 10-digit Mexican phone number.
 * Input: "5512345678"  →  Output: "(55) 1234-5678"
 * Non-standard inputs are returned as-is.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '').replace(/^52/, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// ── File size ─────────────────────────────────────────────────────────────────

/**
 * Convert a byte count to a human-readable string.
 * @param bytes  Number of bytes
 * @returns      e.g. "1.4 MB", "512 KB", "800 B"
 */
export function formatFileSize(bytes: number): string {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

// ── Numbers ───────────────────────────────────────────────────────────────────

/**
 * Format a plain number with thousand separators.
 * @param value      Number to format
 * @param decimals   Decimal places (default: 0)
 */
export function formatNumber(value: number, decimals = 0): string {
  if (typeof value !== 'number' || isNaN(value)) return '—';
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
