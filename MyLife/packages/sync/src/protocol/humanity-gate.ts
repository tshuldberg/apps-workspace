/**
 * Humanity enforcement gate (Plan 24, P3) -- the reusable, framework-agnostic decision
 * that turns a bearer HumanityToken into an allow/deny for a SHARED-network action.
 *
 * This is the SEAM other plans consume (Plan 26 open posting, Plan 22 hosted signup) and
 * the community node's route handlers adapt to their http req/res. It carries no http,
 * no db, and no app-UI import: it is a pure policy function over an injected verify key
 * and an injected redeem client, so every consumer enforces IDENTICALLY and no consumer
 * can accidentally relax the fail-closed posture.
 *
 * Fail-closed by construction (AC-2, AC-3, NC-4):
 *  - required=false -> ALWAYS allowed. Private/local flows (identity, pairing, LAN sync,
 *    private communities, DMs) pass a not-required policy, so verification never gates
 *    offline/local functionality.
 *  - required=true but the service public key is not pinned, OR no redeem client is wired
 *    -> not_configured (500). A gate that cannot check a signature or a double-spend must
 *    refuse, never wave the action through.
 *  - The token is VERIFIED locally against the pinned service key BEFORE the redeem call,
 *    so a malformed/forged/expired token never reaches (or pollutes) the spent store.
 *  - The redeem client's job is the server-side double-spend check. A spent token is
 *    rejected (already_spent). If the redeem client throws or reports the service is
 *    unreachable, the gate fails CLOSED (service_unreachable), it never fails open.
 */

import { parseHumanityToken, verifyHumanityToken } from './humanity-credential';

/** Outcome of the server-side double-spend redeem for a single token. */
export type HumanityRedeemOutcome =
  | { ok: true }
  | { ok: false; reason: 'already_spent' | 'invalid' | 'expired' | 'service_unreachable' };

/** A redeem client: records the token's spend server-side, or reports why it cannot. */
export type HumanityRedeemClient = (bearerToken: string) => Promise<HumanityRedeemOutcome>;

export interface HumanityGatePolicy {
  /**
   * Whether this action requires a humanity token. Private/local actions pass false and
   * are always allowed (NC-4). Only SHARED-network actions pass true.
   */
  required: boolean;
  /** The pinned verification-service Ed25519 PUBLIC key (hex). Required when required=true. */
  servicePublicKeyHex?: string;
  /**
   * The double-spend redeem client (usually an http POST to the verification service's
   * /humanity/redeem). Required when required=true: without it a double-spend cannot be
   * detected, so the gate refuses (not_configured) rather than accept a replayable token.
   */
  redeem?: HumanityRedeemClient;
  /** Injected clock (ms) for expiry checks. Defaults to Date.now. */
  nowMs?: () => number;
}

export type HumanityGateReason =
  | 'not_required'
  | 'not_configured'
  | 'missing'
  | 'malformed'
  | 'invalid'
  | 'expired'
  | 'already_spent'
  | 'service_unreachable';

export type HumanityGateResult =
  | { ok: true; reason: 'not_required' | 'verified' }
  | { ok: false; reason: HumanityGateReason; status: number };

/**
 * Decide whether a gated SHARED-network action may proceed given a bearer token.
 * Returns a structured result the http adapter maps to a status + honest copy; it never
 * throws (a thrown redeem client becomes service_unreachable, fail-closed).
 */
export async function checkHumanityGate(
  bearerToken: string | null | undefined,
  policy: HumanityGatePolicy,
): Promise<HumanityGateResult> {
  if (!policy.required) return { ok: true, reason: 'not_required' };

  if (!policy.servicePublicKeyHex || !policy.redeem) {
    // A required gate with no verify key or no double-spend client cannot enforce.
    return { ok: false, reason: 'not_configured', status: 500 };
  }

  const raw = bearerToken?.trim();
  if (!raw) return { ok: false, reason: 'missing', status: 401 };

  const token = parseHumanityToken(raw);
  if (!token) return { ok: false, reason: 'malformed', status: 401 };

  const nowMs = policy.nowMs?.() ?? Date.now();
  const verdict = verifyHumanityToken(token, policy.servicePublicKeyHex, nowMs);
  if (verdict === 'invalid') return { ok: false, reason: 'invalid', status: 401 };
  if (verdict === 'expired') return { ok: false, reason: 'expired', status: 401 };

  // Only a locally-valid token reaches the spent store (AC-2 double-spend check).
  let outcome: HumanityRedeemOutcome;
  try {
    outcome = await policy.redeem(raw);
  } catch {
    return { ok: false, reason: 'service_unreachable', status: 503 };
  }
  if (outcome.ok) return { ok: true, reason: 'verified' };
  if (outcome.reason === 'already_spent') return { ok: false, reason: 'already_spent', status: 401 };
  if (outcome.reason === 'service_unreachable') return { ok: false, reason: 'service_unreachable', status: 503 };
  // The service re-derived invalid/expired (e.g. a clock skew or a rotated key): treat as
  // the same client-facing rejection the local verify would have produced, fail-closed.
  return { ok: false, reason: outcome.reason, status: 401 };
}
