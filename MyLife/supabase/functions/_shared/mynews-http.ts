// MyNews function envelopes: must stay shape-compatible with the client
// FunctionEnvelope<T> in modules/mynews/src/data/cloud.ts.

import {
  tagLogOutcome,
  withRequestLog,
  type RequestLogDeps,
  type RequestLogOptions,
} from './mynews-observability.ts';

export function jsonOk<T>(data: T): Response {
  // The outcome tag is a non-enumerable Symbol property on the Response object:
  // the serialized bytes, status, and headers are identical to an untagged
  // response, so structured logging cannot change what a client sees.
  return tagLogOutcome(
    new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    'ok',
  );
}

export function jsonError(error: string, status = 400, detail?: string): Response {
  return tagLogOutcome(
    new Response(JSON.stringify({ ok: false, error, ...(detail ? { detail } : {}) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    error,
  );
}

/**
 * Serve wrapper: any error a handler throws becomes the opaque 'internal'
 * envelope. The thrown message is logged server-side and never reaches the
 * client. Every mynews Deno.serve bootstrap must wrap its handler with this.
 *
 * It also emits exactly one structured JSON log line per request (WP11), which
 * is why `options` is required: a log line without a function name and an action
 * cannot be used to operate the service. Multi-action functions declare their
 * default action here and refine it with `annotateRequestLog` once the body is
 * parsed.
 */
export function serveEnvelope(
  handler: (req: Request) => Promise<Response>,
  options: RequestLogOptions,
  logDeps?: RequestLogDeps,
): (req: Request) => Promise<Response> {
  // Logging wraps the catch, not the other way round, so the line records the
  // response the client actually received (including the 'internal' 500).
  return withRequestLog(
    options,
    async (req) => {
      try {
        return await handler(req);
      } catch (error) {
        console.error('mynews handler error', error);
        return jsonError('internal', 500);
      }
    },
    logDeps,
  );
}

/**
 * Extract the JWT subject from the Authorization header. The Supabase
 * platform verifies the JWT before invoking the function (verify_jwt on);
 * handlers parse the payload only, mirroring the BestChef broker pattern.
 */
export function parseJwtSub(req: Request): string | null {
  return parseJwtClaims(req)?.sub ?? null;
}

/**
 * Claims the gateway already verified. `iat` is the token's issue time in
 * seconds, or null when the token carries none.
 *
 * Honesty note for callers that gate on `iat`: a small age proves the ACCESS
 * TOKEN is fresh, which happens on a normal silent refresh as well as on a real
 * re-authentication. It is a fresh-session signal, not proof the human re-typed
 * a credential. Destructive actions must pair it with a typed confirmation and a
 * cancellable grace window rather than treat it as reauthentication.
 */
export function parseJwtClaims(req: Request): { sub: string; iat: number | null } | null {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
    const iat =
      typeof payload.iat === 'number' && Number.isFinite(payload.iat) ? payload.iat : null;
    return { sub: payload.sub, iat };
  } catch {
    return null;
  }
}
