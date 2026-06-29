/**
 * Validation helper functions
 * Each function returns true when the value is valid, false otherwise.
 */

/**
 * Returns true when value is non-null, non-undefined and not an empty/whitespace-only string.
 */
export function validateRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Returns true for a syntactically valid e-mail address.
 * Uses the standard HTML5 e-mail regex (RFC 5322 simplified).
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // Standard HTML5 email pattern
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Returns true for Mexican phone numbers.
 * Accepts formats: 10 digits, +52 prefix, parentheses, spaces, dashes.
 * Examples: 5512345678, (55) 1234-5678, +52 55 1234 5678
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  // Strip all non-digit characters except leading +
  const stripped = phone.replace(/[\s\-().]/g, '').replace(/^\+52/, '');
  // Must end up with 10 digits
  return /^\d{10}$/.test(stripped);
}

/**
 * Returns true when value is a parseable, non-NaN date.
 * Accepts Date objects and date strings (ISO 8601 recommended).
 */
export function validateDate(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  return !isNaN(d.getTime());
}

/**
 * Returns true when value (trimmed) has at least `min` characters.
 */
export function validateMinLength(value: string, min: number): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.trim().length >= min;
}

/**
 * Returns true when value (trimmed) has at most `max` characters.
 */
export function validateMaxLength(value: string, max: number): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.trim().length <= max;
}

/**
 * Returns true when value falls within [min, max] (inclusive).
 */
export function validateRange(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}

/**
 * Returns true when value matches the supplied regex.
 */
export function validatePattern(value: string, pattern: RegExp): boolean {
  if (!value || typeof value !== 'string') return false;
  return pattern.test(value);
}
