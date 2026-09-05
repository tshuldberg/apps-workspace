/**
 * Near-duplicate signatures for flood detection (plan 48 WP8).
 *
 * engines/dupes.ts already collapses near-duplicate EDIT SUGGESTIONS against
 * the open suggestions on one article, comparing structured diffs. That is a
 * different question from the one screening asks: is this author posting the
 * same prose over and over across different articles, comments, and threads.
 * So this module works on plain text and produces a small, storable signature
 * that later submissions are compared against without re-reading old bodies.
 *
 * The hash is seeded from config, never from a clock or a random source, so the
 * same bytes and the same seed always produce the same signature.
 */

import { SCREENING_SIGNATURE_VERSION, type ScreeningSignature } from './types';

/** Deterministic 32-bit mix. FNV-1a with a seeded basis. */
export function seededHash(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Word shingles of the given width. Fewer words than the width yields one shingle. */
export function shingles(tokens: readonly string[], width: number): string[] {
  if (tokens.length === 0) return [];
  if (tokens.length <= width) return [tokens.join(' ')];
  const out: string[] = [];
  for (let i = 0; i + width <= tokens.length; i++) {
    out.push(tokens.slice(i, i + width).join(' '));
  }
  return out;
}

/**
 * Minhash signature: for each slot, the minimum hash of every shingle under
 * that slot's derived seed. Empty text yields an all-zero signature, which
 * compares as identical to other empty text and is never a flood signal on its
 * own (the caller requires floodMinMatches distinct prior posts).
 */
export function buildSignature(
  tokens: readonly string[],
  options: { seed: number; shingleWidth: number; slots: number },
): ScreeningSignature {
  const grams = shingles(tokens, options.shingleWidth);
  const slots: number[] = [];
  for (let slot = 0; slot < options.slots; slot++) {
    const slotSeed = (options.seed + Math.imul(slot, 0x9e3779b1)) >>> 0;
    let min = 0xffffffff;
    for (const gram of grams) {
      const hashed = seededHash(gram, slotSeed);
      if (hashed < min) min = hashed;
    }
    slots.push(grams.length === 0 ? 0 : min);
  }
  return { version: SCREENING_SIGNATURE_VERSION, seed: options.seed, slots };
}

/**
 * Slot-wise agreement, an estimate of Jaccard similarity over the shingle
 * sets. Signatures built with a different version or seed are not comparable
 * and return 0 rather than a misleading number.
 */
export function signatureSimilarity(a: ScreeningSignature, b: ScreeningSignature): number {
  if (a.version !== b.version || a.seed !== b.seed) return 0;
  if (a.slots.length === 0 || a.slots.length !== b.slots.length) return 0;
  let equal = 0;
  for (let i = 0; i < a.slots.length; i++) if (a.slots[i] === b.slots[i]) equal++;
  return equal / a.slots.length;
}

/** Recent signatures at or above the similarity threshold. */
export function countFloodMatches(
  candidate: ScreeningSignature,
  recent: readonly ScreeningSignature[],
  threshold: number,
): number {
  let matches = 0;
  for (const prior of recent) {
    if (signatureSimilarity(candidate, prior) >= threshold) matches++;
  }
  return matches;
}
