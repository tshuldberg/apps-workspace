/**
 * Bounded server-side fetch (plan 48 WP10).
 *
 * Every outbound request from this app carried the platform default timeout,
 * which on Node means "until the socket gives up". One slow Supabase read could
 * therefore hold a request-scoped render open long enough to exhaust the
 * server's concurrency, turning a degraded dependency into a full outage of the
 * site. Each fetch now carries its own deadline.
 *
 * Pure factory (no `process.env`, no framework imports) so the wrapper is
 * unit-tested directly.
 */

/**
 * Read deadline for PostgREST reads that block a page render. Deliberately
 * short: an SSR reader is waiting, and a slow answer is worth less than a fast
 * honest outage notice.
 */
export const CLOUD_READ_TIMEOUT_MS = 4_000;

/**
 * Deadline for edge-function calls that carry a user's own action (report,
 * DMCA notice, auth). Longer than a read because the caller submitted work and
 * would rather wait than retype it, and because these run cold-start-prone
 * functions.
 */
export const CLOUD_WRITE_TIMEOUT_MS = 10_000;

/** Deadline for Supabase Auth calls (token refresh, OTP send, OTP verify). */
export const AUTH_TIMEOUT_MS = 8_000;

/**
 * Wraps a fetch implementation so every call gets an abort deadline.
 *
 * A caller-supplied signal is honoured, not replaced: the two are combined so
 * an upstream cancellation still cancels, and the deadline still fires. A timed
 * out or aborted fetch rejects, which the loaders classify as an outage.
 */
export function createBoundedFetch(
  timeoutMs: number,
  base: typeof fetch = fetch,
): typeof fetch {
  return function boundedFetch(input, init) {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    return base(input, { ...init, signal });
  };
}
