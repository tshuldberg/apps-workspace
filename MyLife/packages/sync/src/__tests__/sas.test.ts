/**
 * MK-017 -- five-emoji SAS derivation. The same shared key must produce the
 * same emoji on both endpoints (so two honest peers can compare), and a
 * different key must produce a different string (so a MITM holding two distinct
 * keys is caught when the two legs render differently).
 */

import { describe, it, expect } from 'vitest';
import { deriveSas, sasMatches, sasFingerprint, SAS_EMOJI } from '../protocol/sas';

const key = (n: number) => new Uint8Array(32).fill(n);

describe('SAS_EMOJI alphabet', () => {
  it('has 64 entries (6 bits per emoji)', () => {
    expect(SAS_EMOJI).toHaveLength(64);
  });
  it('has no duplicates', () => {
    expect(new Set(SAS_EMOJI).size).toBe(64);
  });
});

describe('deriveSas (MK-017)', () => {
  it('is deterministic: the same key yields the same five emoji', () => {
    const a = deriveSas(key(7));
    const b = deriveSas(key(7));
    expect(a.indices).toEqual(b.indices);
    expect(a.emoji).toEqual(b.emoji);
  });

  it('produces exactly five emoji, each from the alphabet, indices in 0..63', () => {
    const sas = deriveSas(key(1));
    expect(sas.emoji).toHaveLength(5);
    expect(sas.indices).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(sas.indices[i]).toBeGreaterThanOrEqual(0);
      expect(sas.indices[i]).toBeLessThan(64);
      expect(sas.emoji[i]).toBe(SAS_EMOJI[sas.indices[i]!]);
    }
  });

  it('is symmetric: both endpoints sharing the key compute the same SAS', () => {
    // Two "devices" independently derive from the same session key.
    const initiatorView = deriveSas(key(42));
    const responderView = deriveSas(key(42));
    expect(sasMatches(initiatorView, responderView)).toBe(true);
  });

  it('a different key (the MITM second leg) yields a different SAS', () => {
    const honest = deriveSas(key(42));
    const mitm = deriveSas(key(43));
    expect(sasMatches(honest, mitm)).toBe(false);
  });

  it('sasFingerprint is a stable, comparable string of the indices', () => {
    const sas = deriveSas(key(9));
    expect(sasFingerprint(sas)).toBe(sas.indices.join('-'));
    expect(sasFingerprint(deriveSas(key(9)))).toBe(sasFingerprint(sas));
  });

  it('sasMatches compares indices, not rendered emoji', () => {
    expect(sasMatches({ indices: [1, 2, 3, 4, 5] }, { indices: [1, 2, 3, 4, 5] })).toBe(true);
    expect(sasMatches({ indices: [1, 2, 3, 4, 5] }, { indices: [1, 2, 3, 4, 6] })).toBe(false);
  });
});
