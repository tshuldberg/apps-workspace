/**
 * Constant-time worker secret comparison (audit L1).
 *
 * The BestChef worker functions (moderate_vote_proof, bestchef-delete-account,
 * bestchef-media-purge, bestchef-media-screening) previously compared the
 * caller-supplied worker secret with `!==`, a non-constant-time comparison
 * that leaks timing information proportional to the length of the matching
 * prefix. An attacker who can measure response latency could recover the
 * secret byte-by-byte.
 *
 * `timingSafeEqual` hashes both sides to a fixed-length digest (SHA-256)
 * before comparing, so the comparison time depends only on digest length,
 * never on the input strings themselves -- this also sidesteps the usual
 * requirement that both inputs be equal length, since supplied secrets are
 * attacker-controlled and may be any length.
 *
 * This module is consumed both by Deno (Supabase Edge Function runtime)
 * and Vitest (in-repo unit tests). It does not import Deno globals.
 */

async function sha256(input: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

/** XOR-accumulate over two equal-length byte arrays; branch-free. */
function xorEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Constant-time string equality check, safe for secret comparison.
 * Returns false for null/undefined on either side without short-circuiting
 * on length (both sides are hashed to a fixed-length digest first).
 */
export async function timingSafeEqual(
  supplied: string | null | undefined,
  expected: string | null | undefined,
): Promise<boolean> {
  if (supplied == null || expected == null) return false;

  const [suppliedDigest, expectedDigest] = await Promise.all([
    sha256(supplied),
    sha256(expected),
  ]);

  return xorEqual(suppliedDigest, expectedDigest);
}
