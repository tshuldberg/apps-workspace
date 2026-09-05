import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

/**
 * Admin-key authentication for internal API routes.
 *
 * Routes like `/api/entitlements/issue` are only meant to be called by trusted
 * backends (billing webhook processor, provisioning workers). They gate on a
 * shared secret passed in an `x-*-key` header.
 *
 * This helper does the verification with `crypto.timingSafeEqual` so the
 * comparison is constant-time. A naive `provided !== expected` leaks the
 * secret byte-by-byte to a well-positioned attacker via response-time
 * analysis.
 *
 * Also verifies that the env-supplied expected secret is configured -- a
 * missing secret should fail closed (503) rather than silently comparing to
 * `undefined`.
 */

export interface AdminKeyCheckInput {
  /** The header value supplied by the caller (from request.headers.get). */
  provided: string | null | undefined;
  /** The expected secret, read from a trusted env var. */
  expected: string | null | undefined;
  /**
   * Optional label for the auth failure message. Defaults to "admin key".
   * Do NOT include the actual env var name or header name here -- the error
   * body is returned to the caller and must not enumerate internal secrets.
   */
  label?: string;
}

export type AdminKeyCheckResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

export function assertAdminKey(input: AdminKeyCheckInput): AdminKeyCheckResult {
  const label = input.label ?? 'admin key';

  if (!input.expected || input.expected.trim().length === 0) {
    // Fail closed: missing server secret means the route is not configured.
    // 503 (not 401) signals "server misconfiguration" to the caller.
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${label} is not configured on the server.` },
        { status: 503 },
      ),
    };
  }

  const provided = typeof input.provided === 'string' ? input.provided : '';
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(input.expected, 'utf8');

  // timingSafeEqual throws on length mismatch. Short-circuit without leaking
  // which length the caller would need to match; both paths return the same
  // response.
  if (providedBuffer.length !== expectedBuffer.length) {
    return {
      ok: false,
      response: NextResponse.json({ error: `Invalid ${label}.` }, { status: 401 }),
    };
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return {
      ok: false,
      response: NextResponse.json({ error: `Invalid ${label}.` }, { status: 401 }),
    };
  }

  return { ok: true };
}
