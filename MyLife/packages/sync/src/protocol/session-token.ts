/**
 * Live-session rendezvous token (Plan 29 Phase 0, seamless auto-connect).
 *
 * A paired device must be able to dial a live sync session with NO typed
 * phrase. Today the live-session token is one global human-typed phrase
 * (`sync-core.ts` `buildRendezvousToken`); that cannot power automatic dialing
 * and it never rotates, so a relay could build a long-lived pair identifier.
 *
 * This derives a per-pairing session token deterministically from the pairing
 * shared secret and the current UTC day, so:
 *   - both ends compute the same token with no coordination and no input, and
 *   - the token ROTATES daily, so the relay sees a fresh opaque 64-hex value
 *     each UTC day and cannot correlate a mailbox/session to a long-lived pair.
 *
 * The derivation clones the existing mailbox-token HKDF family (NC-5: no new
 * cryptography). Its signing domain string is DISTINCT from every other token
 * derivation, so a session token can never collide with a mailbox token, a
 * friend-code token, or a community join token (NC-2).
 */

import { hexToBytes } from '../encryption/keys';
import { hkdf, sha512Hex } from '../node/hkdf';

/**
 * Distinct HKDF info domain for the live-session token. Must never equal the
 * mailbox (`meerkat-mailbox-token-v1`) or any other token domain (NC-2).
 */
const SESSION_TOKEN_DOMAIN = 'meerkat-live-session-v1';

/** One UTC-day rung, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The UTC day bucket (`YYYY-MM-DD`) for a millisecond timestamp. The bucket is
 * the rotation period: a token derived with a given bucket is valid for that
 * whole UTC day on both ends.
 */
export function utcDayBucket(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * Derive the live-session rendezvous token for a pairing on a given UTC day.
 * Deterministic on both ends (same pairing secret + same bucket => same token),
 * opaque to the relay, and unlinkable across days.
 */
export function deriveSessionRendezvousToken(
  pairSharedSecretHex: string,
  dayBucket: string,
): string {
  const ikm = hexToBytes(pairSharedSecretHex);
  const info = `${SESSION_TOKEN_DOMAIN}:${dayBucket}`;
  return sha512Hex(hkdf(ikm, info)).slice(0, 64);
}

/**
 * The dialer's candidate tokens for "now": today's bucket first, then
 * yesterday's. The previous-bucket fallback is the clock-skew window so a dial
 * that straddles a UTC midnight boundary (or a peer whose clock lags a few
 * minutes) still meets on a shared token. Ordered [today, yesterday]; the
 * listener listens on today's token.
 */
export function sessionTokenCandidates(pairSharedSecretHex: string, nowMs: number): string[] {
  const today = deriveSessionRendezvousToken(pairSharedSecretHex, utcDayBucket(nowMs));
  const yesterday = deriveSessionRendezvousToken(pairSharedSecretHex, utcDayBucket(nowMs - DAY_MS));
  // De-dupe defensively (identical only if the two buckets collide, which they
  // never do for a DAY_MS step, but a caller could pass an odd clock).
  return today === yesterday ? [today] : [today, yesterday];
}
