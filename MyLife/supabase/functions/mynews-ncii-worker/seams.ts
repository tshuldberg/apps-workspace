/**
 * NCII pipeline integration seams (Plan 39 T10). These are the vendor
 * integration points a founder-ops step wires. They are DELIBERATELY
 * unimplemented pending a vendor selection, with safe, honest defaults:
 *
 *   - matchNciiHash: given an NCII case, ask a known-NCII/CSAM hash-matching
 *     vendor (StopNCII / PhotoDNA / NCMEC hash list) whether the target media
 *     matches a known-abuse hash. DEFAULT (no vendor configured): returns
 *     { kind: 'unconfigured' }, which the worker maps to hash_match_status
 *     'pending' -> human review. It NEVER returns a fabricated 'match' or
 *     'no_match', and a real 'match' NEVER auto-clears a case.
 *
 *   - reportCsamToNcmec: for a confirmed-CSAM case, file a report to the NCMEC
 *     CyberTipline and return the reference. DEFAULT (no creds configured):
 *     returns { ncmecRef: null }. It NEVER fabricates a CyberTipline reference.
 *
 * The env keys below are the founder-ops wiring points. Until they are set the
 * seams stay in their safe default and the human-review + fail-closed removal
 * path carries the case.
 */

export type NciiHashVerdict =
  | { kind: 'match'; source: string }
  | { kind: 'no_match'; source: string }
  | { kind: 'error'; detail: string }
  | { kind: 'unconfigured' };

/** Founder-ops env keys (unset by default). */
export const ENV_HASH_VENDOR_URL = 'MYNEWS_NCII_HASH_VENDOR_URL';
export const ENV_HASH_VENDOR_KEY = 'MYNEWS_NCII_HASH_VENDOR_KEY';
export const ENV_NCMEC_ENDPOINT = 'MYNEWS_NCMEC_CYBERTIPLINE_URL';
export const ENV_NCMEC_CREDENTIALS = 'MYNEWS_NCMEC_CYBERTIPLINE_CREDENTIALS';

interface NciiCaseLike {
  id: string;
  targetKind: string;
  targetId: string;
}

/**
 * Hash-match seam. SAFE DEFAULT: when no vendor is configured, returns
 * 'unconfigured' (the worker treats this as 'pending' / human review). This is
 * the integration point for a real StopNCII/PhotoDNA call; do NOT return a
 * fabricated verdict here. When founder-ops wires the vendor, replace the body
 * below the guard with a real fetch to the vendor and map its response to
 * 'match' | 'no_match' | 'error'.
 */
export async function matchNciiHash(
  _caseRow: NciiCaseLike,
  env: (key: string) => string | undefined,
): Promise<NciiHashVerdict> {
  const url = env(ENV_HASH_VENDOR_URL);
  const key = env(ENV_HASH_VENDOR_KEY);
  if (!url || !key) {
    // No vendor wired: human review, never an auto-verdict.
    return { kind: 'unconfigured' };
  }
  // Founder-ops vendor integration goes here. Until it is implemented we do NOT
  // fabricate a verdict: an env-configured-but-unimplemented state is an honest
  // 'error' so the case still escalates to a human rather than silently passing.
  return {
    kind: 'error',
    detail: 'NCII hash-match vendor endpoint configured but the client is not implemented yet.',
  };
}

/**
 * NCMEC CyberTipline seam. SAFE DEFAULT: when no creds are configured, returns
 * { ncmecRef: null } (no report filed, no fabricated reference). This is the
 * integration point for a real CyberTipline submission; do NOT fabricate a
 * reference here. When founder-ops wires the creds, replace the body below the
 * guard with a real submission and return the CyberTipline reference id.
 */
export async function reportCsamToNcmec(
  _caseRow: NciiCaseLike,
  env: (key: string) => string | undefined,
): Promise<{ ncmecRef: string | null }> {
  const endpoint = env(ENV_NCMEC_ENDPOINT);
  const credentials = env(ENV_NCMEC_CREDENTIALS);
  if (!endpoint || !credentials) {
    // No creds wired: record nothing rather than a fake reference.
    return { ncmecRef: null };
  }
  // Founder-ops CyberTipline integration goes here. Until implemented, return
  // null: a confirmed-CSAM case still escalates to a human and the missing
  // report is visible (ncmec_ref stays null), never faked.
  return { ncmecRef: null };
}
