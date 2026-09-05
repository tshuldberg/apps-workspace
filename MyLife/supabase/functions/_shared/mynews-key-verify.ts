// MyNews signing-key resolution for the verify path (plan 48 WP6, design
// docs/designs/mynews-key-custody.md "Verify-path change").
//
// Before WP6 every handler resolved a signer with getProfileIdByPubkey, a
// lookup against the single denormalized head column. That had two problems
// once keys can rotate:
//
//   1. It cannot see co-active DEVICE keys, so a second device would be told
//      'no-profile' even though its key is legitimately on the chain.
//   2. It cannot tell a REVOKED key from an unknown one. A journalist whose
//      device was stolen and whose key was revoked would be told to "register a
//      profile", which is both false and useless: the honest answer is that this
//      key no longer signs, and here is how to recover.
//
// Both handlers and readers now go through the chain. A revoked signer gets the
// typed 'key-revoked' error; an unknown one still gets 'no-profile'.
//
// Historical writes stay verifiable: revoking a key never invalidates what it
// already signed, because verification of stored rows is chain membership plus
// the recorded verified_key_id, never a time window and never the current head.

import { jsonError, parseJwtClaims } from './mynews-http.ts';
import type { KeyResolution, MyNewsStore } from './mynews-store.ts';

/**
 * Maximum access-token age accepted for a step-up custody action, in seconds.
 * Pinned to REAUTH_MAX_TOKEN_AGE_SECONDS in mynews-account/index.ts by a drift
 * test: two different step-up windows in one product would be a bug, and the
 * looser one would silently become the real security boundary.
 *
 * Honesty note, the same one mynews-account carries: a small iat proves the
 * ACCESS TOKEN is fresh, which a silent refresh also achieves. It is a
 * fresh-session signal, not proof a human re-typed a credential. That is exactly
 * why the custody design pairs it with a possession proof from a key the
 * attacker does not hold, a time lock, and a keyless cancel path. Never treat
 * freshness alone as authorization for a custody transition.
 */
export const CUSTODY_STEP_UP_MAX_TOKEN_AGE_SECONDS = 10 * 60;

/** Small allowance for clock skew on a token minted just ahead of us. */
const CLOCK_SKEW_ALLOWANCE_SECONDS = 60;

/**
 * Is the caller's token fresh enough for a step-up custody action? A token with
 * no `iat` cannot be aged, so it fails closed.
 */
export function hasFreshSession(req: Request, nowMs: number): boolean {
  const claims = parseJwtClaims(req);
  if (!claims || claims.iat === null) return false;
  const ageSeconds = Math.floor(nowMs / 1000) - claims.iat;
  return (
    ageSeconds <= CUSTODY_STEP_UP_MAX_TOKEN_AGE_SECONDS &&
    ageSeconds >= -CLOCK_SKEW_ALLOWANCE_SECONDS
  );
}

/** Typed error a revoked signer receives. Surfaced verbatim to the client. */
export const KEY_REVOKED_ERROR = 'key-revoked' as const;

export const KEY_REVOKED_DETAIL =
  'this signing key was rotated or revoked and can no longer author new writes';

export type SignerResolution =
  | {
      ok: true;
      profileId: string;
      /** nw_profile_keys row id: the authoritative "which key verified this". */
      keyId: string;
      kind: 'primary' | 'device';
    }
  | { ok: false; response: Response };

/**
 * Resolve a signing pubkey to its profile and chain row, or to the Response the
 * handler should return. `noProfileDetail` lets each handler keep the exact
 * wording it already had for the unknown-key case.
 */
export async function resolveSigningKey(
  store: MyNewsStore,
  pubkey: string,
  noProfileDetail?: string,
): Promise<SignerResolution> {
  let resolution: KeyResolution;
  try {
    resolution = await store.resolveActiveKey(pubkey);
  } catch (error) {
    // Fail closed. A resolver that cannot answer cannot prove the key is live,
    // and accepting a write on an unproven key is exactly the hole WP6 closes.
    console.error('mynews key resolution failed', error);
    return {
      ok: false,
      response: jsonError('key-unavailable', 503, 'key verification is temporarily unavailable'),
    };
  }

  if (resolution.verdict === 'active' && resolution.profileId && resolution.keyId) {
    return {
      ok: true,
      profileId: resolution.profileId,
      keyId: resolution.keyId,
      kind: resolution.kind ?? 'primary',
    };
  }
  if (resolution.verdict === 'revoked') {
    return { ok: false, response: jsonError(KEY_REVOKED_ERROR, 403, KEY_REVOKED_DETAIL) };
  }
  return { ok: false, response: jsonError('no-profile', 403, noProfileDetail) };
}
