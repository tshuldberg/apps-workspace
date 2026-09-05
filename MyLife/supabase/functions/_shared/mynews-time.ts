// Server-side createdAt bounds. The signature covers the original createdAt
// bytes, so this is a validation-only gate: it never rewrites the value or
// the canonical bytes. A hijacked or malicious client can otherwise back- or
// post-date a revision (metadata only, since corpus ordering keys off the
// integer rev), so the server rejects anything that is not a valid ISO date,
// too far in the future beyond a small clock-skew window, or implausibly old.

/** Accepts up to this much future skew to tolerate honest clock drift. */
export const CREATED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;
/** Anything before this is implausible for a live publish. */
export const CREATED_AT_FLOOR_MS = Date.UTC(2020, 0, 1);

/**
 * True when createdAt is a valid ISO timestamp within [floor, now + skew].
 * nowMs is injected via the handler's deps.now for testability.
 */
export function isCreatedAtInBounds(createdAt: string, nowMs: number): boolean {
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) return false;
  if (parsed < CREATED_AT_FLOOR_MS) return false;
  if (parsed > nowMs + CREATED_AT_FUTURE_SKEW_MS) return false;
  return true;
}
