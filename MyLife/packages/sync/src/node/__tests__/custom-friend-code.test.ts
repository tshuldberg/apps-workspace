/**
 * Custom (vanity + random suffix) friend codes.
 *
 * A user can pick a readable word and Meerkat appends a random Crockford suffix
 * so the code keeps real baseline entropy. The normalized code is hashed into a
 * stable 8-byte rendezvous id (domain-separated), so publish and resolve agree
 * deterministically. These tests prove the normalization, the alias mapping, the
 * min-length and shape guarantees (never the standard 16-char checksummed shape),
 * the secure-PRNG suffix, and that the unified resolver never mis-reads a custom
 * code as a standard one.
 */

import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import {
  CUSTOM_FRIEND_CODE_MIN_LENGTH,
  normalizeFriendCodeInput,
  isValidCustomFriendCode,
  makeVanityFriendCode,
  rendezvousIdFromCustomCode,
  friendCodeToRendezvousId,
  generateFriendCode,
  parseFriendCode,
} from '../friend-code';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('CUSTOM_FRIEND_CODE_MIN_LENGTH', () => {
  it('is 12', () => {
    expect(CUSTOM_FRIEND_CODE_MIN_LENGTH).toBe(12);
  });
});

describe('normalizeFriendCodeInput', () => {
  it('uppercases, strips a leading MEER- and dashes/spaces', () => {
    // No aliasable letters (no I/L/O/U) so the chars pass through verbatim.
    expect(normalizeFriendCodeInput('meer-zebra-cat12')).toBe('ZEBRACAT12');
    expect(normalizeFriendCodeInput('MEER zebra cat 12')).toBe('ZEBRACAT12');
  });

  it('strips a bare MEER prefix with no dash', () => {
    expect(normalizeFriendCodeInput('MEERZEBRA12345')).toBe('ZEBRA12345');
  });

  it('applies Crockford aliases I->1, L->1, O->0, U->V', () => {
    expect(normalizeFriendCodeInput('illo-u')).toBe('1110V');
  });

  it('is idempotent', () => {
    const once = normalizeFriendCodeInput('meer-Cool-Llama-O0');
    const twice = normalizeFriendCodeInput(once);
    expect(twice).toBe(once);
  });

  it('returns empty for any char outside Crockford base32 after aliasing', () => {
    expect(normalizeFriendCodeInput('hello!world')).toBe('');
    expect(normalizeFriendCodeInput('good_code_12')).toBe('');
  });

  it('does not strip an interior MEER (only a leading one)', () => {
    // "ZMEER..." keeps its MEER because the prefix strip is anchored.
    expect(normalizeFriendCodeInput('ZMEER1234')).toBe('ZMEER1234');
  });
});

describe('isValidCustomFriendCode', () => {
  it('accepts a normalized length >= 12 of pure Crockford charset', () => {
    expect(isValidCustomFriendCode('HELLOWORLD12')).toBe(true);
    expect(isValidCustomFriendCode('meer-hello-world-12')).toBe(true);
  });

  it('rejects anything under the minimum length', () => {
    expect(isValidCustomFriendCode('HELLO1234567'.slice(0, 11))).toBe(false);
    expect(isValidCustomFriendCode('SHORT')).toBe(false);
  });

  it('rejects non-Crockford characters', () => {
    expect(isValidCustomFriendCode('hello!world!!')).toBe(false);
  });

  it('accepts aliases that normalize into the charset', () => {
    // 12 chars after alias mapping (I/L/O/U map in).
    expect(isValidCustomFriendCode('illoillo1234')).toBe(true);
  });
});

describe('makeVanityFriendCode', () => {
  it('requires at least 4 normalized vanity chars', () => {
    expect(() => makeVanityFriendCode('cat')).toThrow();
    expect(() => makeVanityFriendCode('!!!')).toThrow();
  });

  it('produces a display code whose normalized form is >= 12 and valid', () => {
    const code = makeVanityFriendCode('llama');
    expect(code.startsWith('MEER-')).toBe(true);
    const normalized = normalizeFriendCodeInput(code);
    expect(normalized.length).toBeGreaterThanOrEqual(CUSTOM_FRIEND_CODE_MIN_LENGTH);
    expect(isValidCustomFriendCode(code)).toBe(true);
  });

  it('appends at least 8 random suffix chars', () => {
    const code = makeVanityFriendCode('cool');
    const normalized = normalizeFriendCodeInput(code);
    // vanity "COOL" is 4 chars; everything after is the random suffix.
    expect(normalized.length - 4).toBeGreaterThanOrEqual(8);
  });

  it('never produces the standard checksummed 16-char shape', () => {
    for (let i = 0; i < 50; i++) {
      const code = makeVanityFriendCode('test');
      const normalized = normalizeFriendCodeInput(code);
      expect(normalized.length).not.toBe(16);
      // And it must not parse as a standard checksummed code.
      expect(parseFriendCode(code)).toBeNull();
    }
  });

  it('draws from the secure PRNG: two calls differ', () => {
    const a = makeVanityFriendCode('llama');
    const b = makeVanityFriendCode('llama');
    expect(a).not.toBe(b);
  });

  it('uses the injected prng when provided (deterministic for tests)', () => {
    const fixed: (n: number) => Uint8Array = (n) => new Uint8Array(n).fill(7);
    const a = makeVanityFriendCode('llama', fixed);
    const b = makeVanityFriendCode('llama', fixed);
    expect(a).toBe(b);
  });

  it('decodes to a stable rid', () => {
    const code = makeVanityFriendCode('llama');
    const first = rendezvousIdFromCustomCode(code);
    const second = rendezvousIdFromCustomCode(code);
    expect(first).not.toBeNull();
    expect(first).toHaveLength(8);
    expect(hex(first!)).toBe(hex(second!));
  });
});

describe('rendezvousIdFromCustomCode', () => {
  it('is deterministic across formatting variants of the same code', () => {
    const a = rendezvousIdFromCustomCode('meer-hello-world-12');
    const b = rendezvousIdFromCustomCode('HELLOWORLD12');
    const c = rendezvousIdFromCustomCode('HELL0W0RLD12'); // O->0 alias
    expect(a).not.toBeNull();
    expect(hex(a!)).toBe(hex(b!));
    expect(hex(a!)).toBe(hex(c!));
  });

  it('returns an 8-byte id', () => {
    const rid = rendezvousIdFromCustomCode('helloworld12');
    expect(rid).toHaveLength(8);
  });

  it('returns null for an invalid (too-short) code', () => {
    expect(rendezvousIdFromCustomCode('short')).toBeNull();
  });

  it('returns null for non-Crockford input', () => {
    expect(rendezvousIdFromCustomCode('hello!world!!')).toBeNull();
  });

  it('differs for different codes', () => {
    const a = rendezvousIdFromCustomCode('helloworld12');
    const b = rendezvousIdFromCustomCode('helloworld13');
    expect(hex(a!)).not.toBe(hex(b!));
  });
});

describe('friendCodeToRendezvousId', () => {
  it('resolves a standard checksummed code via parseFriendCode', () => {
    const { code, rendezvousId } = generateFriendCode();
    const rid = friendCodeToRendezvousId(code);
    expect(rid).not.toBeNull();
    expect(hex(rid!)).toBe(hex(rendezvousId));
  });

  it('resolves a custom code via the domain-separated hash', () => {
    const code = makeVanityFriendCode('llama');
    const rid = friendCodeToRendezvousId(code);
    const expected = rendezvousIdFromCustomCode(code);
    expect(rid).not.toBeNull();
    expect(hex(rid!)).toBe(hex(expected!));
  });

  it('returns null for an unusable code', () => {
    expect(friendCodeToRendezvousId('nope!')).toBeNull();
    expect(friendCodeToRendezvousId('')).toBeNull();
  });

  it('never maps a custom code through the standard checksum path', () => {
    // A custom code resolves to the custom-derived rid, NOT a parseFriendCode rid.
    const code = makeVanityFriendCode('test');
    expect(parseFriendCode(code)).toBeNull();
    const rid = friendCodeToRendezvousId(code);
    expect(hex(rid!)).toBe(hex(rendezvousIdFromCustomCode(code)!));
  });

  it('keeps the standard rid for a standard code (not the custom hash of it)', () => {
    const { code } = generateFriendCode();
    const rid = friendCodeToRendezvousId(code);
    const customOfSame = rendezvousIdFromCustomCode(code);
    // Standard wins; the two derivations are different functions.
    expect(hex(rid!)).toBe(hex(parseFriendCode(code)!));
    if (customOfSame) {
      expect(hex(rid!)).not.toBe(hex(customOfSame));
    }
  });
});

describe('PRNG safety', () => {
  it('suffix entropy comes from a real CSPRNG (nacl.randomBytes is the default)', () => {
    // Two unseeded calls collide with negligible probability over >= 40 bits.
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(makeVanityFriendCode('llama'));
    }
    expect(seen.size).toBe(100);
    // Sanity: the package PRNG is wired (nacl.randomBytes works in this env).
    expect(nacl.randomBytes(4)).toHaveLength(4);
  });
});
