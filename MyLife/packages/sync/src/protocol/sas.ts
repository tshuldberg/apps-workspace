/**
 * Short Authentication String (SAS) verification (plan 14, MK-017).
 *
 * Trust-on-first-use pins a key, but it cannot tell whether the key you pinned
 * on first contact truly belongs to your friend or to a man-in-the-middle who
 * was present from the start. SAS closes that gap with a human cross-check: both
 * devices derive five emojis from material they provably share -- the session's
 * authenticated key -- and the two people compare them out of band (in person,
 * over a call). A MITM relaying two separate sessions holds two different keys,
 * so its two legs render two different emoji strings and the mismatch is seen.
 *
 * Required before a sensitive module may replicate at shared_workspace scope;
 * the gate lives in inbound-policy.ts (enforced in the engine, not just the UI).
 *
 * Pure: deterministic from the shared key, no DB, no I/O.
 */

import nacl from 'tweetnacl';

/**
 * 64 visually distinct, widely-rendered emoji. 64 = 6 bits each, so five emoji
 * carry 30 bits (~1 in a billion) -- enough that a MITM cannot feasibly grind a
 * key whose SAS collides with the honest one within a live handshake.
 */
export const SAS_EMOJI: readonly string[] = [
  '🐶', '🐱', '🦁', '🐴', '🦄', '🐮', '🐷', '🐸',
  '🐵', '🐔', '🐧', '🦉', '🦅', '🐺', '🐗', '🦌',
  '🦓', '🦒', '🐘', '🐫', '🐳', '🐬', '🐟', '🐙',
  '🦋', '🐌', '🐝', '🐞', '🌸', '🌻', '🌲', '🌵',
  '🍀', '🍎', '🍌', '🍓', '🍒', '🍑', '🍍', '🌽',
  '🍔', '🍕', '🍩', '🍪', '🎂', '☕', '🍷', '⚽',
  '🏀', '🎸', '🎺', '🎻', '🎲', '🚗', '🚀', '⛵',
  '⏰', '💡', '📷', '🔑', '🔔', '⭐', '🌈', '🔥',
];

const SAS_LENGTH = 5;
const DOMAIN = 'meerkat-sas-v1';

/** Concatenate two byte arrays. */
function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export interface SasResult {
  /** The five emoji to display. */
  emoji: string[];
  /** The five 0-63 indices (for storage/audit, locale-independent). */
  indices: number[];
}

/**
 * Derive the five-emoji SAS from a shared session key. Both endpoints pass the
 * same key and get the same emoji; a MITM with a different key gets different
 * emoji. Domain-separated so the SAS can never collide with any other use of the
 * key.
 */
export function deriveSas(sharedKey: Uint8Array): SasResult {
  const digest = nacl.hash(concat(new TextEncoder().encode(DOMAIN), sharedKey));
  const indices: number[] = [];
  // One emoji per byte, masked to 6 bits. Five bytes is plenty of a 64-byte hash.
  for (let i = 0; i < SAS_LENGTH; i++) {
    indices.push(digest[i]! & 0x3f);
  }
  return { emoji: indices.map((i) => SAS_EMOJI[i]!), indices };
}

/** Stable string form of a SAS (its indices), for equality + storage. */
export function sasFingerprint(result: Pick<SasResult, 'indices'>): string {
  return result.indices.join('-');
}

/** True if two SAS results are identical (compare indices, not rendered emoji). */
export function sasMatches(a: Pick<SasResult, 'indices'>, b: Pick<SasResult, 'indices'>): boolean {
  return a.indices.length === b.indices.length && a.indices.every((v, i) => v === b.indices[i]);
}
