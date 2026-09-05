/**
 * Lightweight email shape validation for client-side gating only.
 *
 * Used by Settings recovery email + sign-in link inputs to reject obviously
 * malformed addresses (B-002). This is intentionally a permissive regex and
 * is not a substitute for server-side validation.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailShape(value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return EMAIL_PATTERN.test(trimmed);
}
