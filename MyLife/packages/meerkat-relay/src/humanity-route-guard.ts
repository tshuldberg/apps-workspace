/**
 * Reusable humanity middleware for node:http routes (Plan 24 P3 completion,
 * Plan 39 P7). Wraps the pure checkHumanityGate seam into the (req, res) shape
 * every service in this package uses, so each consumer enforces IDENTICALLY:
 *
 *  - the community node's public register + submit gates (already wired);
 *  - PERSONA-SESSION ISSUANCE (Plan 39 Track A): issuing a session IS a
 *    shared-network account action and MUST spend one single-use humanity token.
 *    The persona-session HTTP route consumes this guard on its issuance
 *    endpoint; a session must never be minted without a verified redeem.
 *
 * Fail-closed on every path (mirrors checkHumanityGate): a guard configured
 * without a pinned service key or redeem client refuses with 500; a missing/
 * malformed/invalid/expired token is 401; a replayed (already spent) token is
 * 409; an unreachable humanity service is 503. It never logs the token.
 *
 * NC-P1: apply this ONLY to public/shared-network routes. Private mesh routes
 * (identity, pairing, LAN sync, private communities, DMs) never consult it.
 */

import type http from 'node:http';
import {
  checkHumanityGate,
  type HumanityGatePolicy,
  type HumanityGateResult,
} from '@mylife/sync';

/** Default header carrying the wire humanity token. */
export const HUMANITY_HEADER = 'x-mk-humanity';

export interface HumanityRouteGuardOptions {
  /**
   * The pure gate policy: pinned service public key + redeem client. Passing
   * `required: false` is ONLY for private/local flows, which should not mount
   * this guard at all; a mounted guard is expected to be required.
   */
  policy: HumanityGatePolicy;
  /** Header carrying the wire humanity token. Defaults to x-mk-humanity. */
  header?: string;
  /** Counts/paths only; never the token. */
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

export type HumanityRouteGuard = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  feature: string,
) => Promise<boolean>;

function headerValue(req: http.IncomingMessage, name: string): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

/**
 * Build the guard. Returns true when the request may proceed; otherwise the
 * response has already been sent (401/409/500/503 with a machine-readable
 * reason) and the route must return.
 */
export function createHumanityRouteGuard(options: HumanityRouteGuardOptions): HumanityRouteGuard {
  const header = (options.header ?? HUMANITY_HEADER).toLowerCase();
  const log = options.log ?? (() => {});
  return async (req, res, feature) => {
    const token = headerValue(req, header);
    let result: HumanityGateResult;
    try {
      result = await checkHumanityGate(token, options.policy);
    } catch {
      // checkHumanityGate never throws by contract; belt-and-suspenders.
      result = { ok: false, reason: 'service_unreachable', status: 503 };
    }
    if (result.ok) return true;
    // already_spent is a REPLAY and surfaces as 409 (matches the register gate),
    // not the pure gate's 401, so clients can distinguish "get a new token".
    const status = result.reason === 'already_spent' ? 409 : result.status;
    log('humanity_reject', { feature, reason: result.reason });
    sendJson(res, status, { reason: `humanity_${result.reason}` });
    return false;
  };
}
