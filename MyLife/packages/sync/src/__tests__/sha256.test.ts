/**
 * The pure-JS SHA-256 must be BYTE-IDENTICAL to node:crypto, or RN clients and
 * Node hosts would compute different content hashes and history/catalog fetch
 * would silently fail verification. Proven on known vectors + random buffers.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { sha256Hex, sha256Bytes } from '../encryption/sha256';

const enc = (s: string) => new TextEncoder().encode(s);
const node = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

describe('sha256 (RN-safe, MK history fetch)', () => {
  it('matches the canonical NIST test vectors', () => {
    expect(sha256Hex(enc(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex(enc('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))
      .toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('is byte-identical to node:crypto across boundary lengths', () => {
    // Lengths around block (64) and length-pad (55/56) boundaries are where
    // padding bugs hide.
    for (const n of [0, 1, 55, 56, 57, 63, 64, 65, 100, 127, 128, 129, 255, 1000]) {
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = (i * 31 + 7) & 0xff;
      expect(sha256Hex(bytes)).toBe(node(bytes));
    }
  });

  it('is byte-identical to node:crypto on 200 random buffers', () => {
    for (let t = 0; t < 200; t++) {
      const n = (t * 53 + 13) % 4096;
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = (i * (t + 1) * 17 + t) & 0xff;
      expect(sha256Hex(bytes)).toBe(node(bytes));
    }
  });

  it('sha256Bytes returns 32 raw bytes consistent with the hex form', () => {
    const raw = sha256Bytes(enc('meerkat'));
    expect(raw).toHaveLength(32);
    expect(sha256Hex(enc('meerkat'))).toBe(Buffer.from(raw).toString('hex'));
  });
});
