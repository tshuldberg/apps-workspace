/**
 * Error-code hygiene for query-param banners. Pages must never echo raw
 * user-controlled query text inside a trusted banner (review finding:
 * crafted links could show arbitrary copy to moderators). Machine error
 * codes pass through; anything else collapses to a generic code.
 */

const SAFE_ERROR_CODE = /^[a-z0-9_.:-]{1,120}$/i;

export function sanitizeErrorCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return SAFE_ERROR_CODE.test(raw) ? raw : 'unexpected_error';
}
