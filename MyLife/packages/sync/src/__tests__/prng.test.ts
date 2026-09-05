import { afterEach, describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import {
  configureSyncPrng,
  configureSyncPrngFromGlobalCrypto,
  generateSyncRandomBytes,
  generateSyncRandomInt,
  hasConfiguredSyncPrng,
} from '../encryption/prng';

afterEach(() => {
  configureSyncPrngFromGlobalCrypto();
});

describe('sync PRNG configuration', () => {
  it('uses injected bytes for tweetnacl random generation', () => {
    let nextByte = 1;
    configureSyncPrng((byteCount) => (
      Uint8Array.from({ length: byteCount }, () => nextByte++)
    ));

    expect(nacl.randomBytes(4)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(hasConfiguredSyncPrng()).toBe(true);
  });

  it('throws when the injected source returns too few bytes', () => {
    configureSyncPrng(() => new Uint8Array([1]));

    expect(() => nacl.randomBytes(2)).toThrow('Sync PRNG returned 1 bytes for 2 requested bytes');
  });

  it('configures from global crypto when getRandomValues is available', () => {
    const expected = typeof globalThis.crypto?.getRandomValues === 'function';

    expect(configureSyncPrngFromGlobalCrypto()).toBe(expected);
  });

  it('exposes configured random bytes to sync consumers', () => {
    configureSyncPrng((byteCount) => Uint8Array.from({ length: byteCount }, (_, index) => index + 5));

    expect(generateSyncRandomBytes(4)).toEqual(new Uint8Array([5, 6, 7, 8]));
    expect(() => generateSyncRandomBytes(0)).toThrow('positive safe integer');
  });

  it('generates a bounded integer and rejects modulo-biased samples', () => {
    let calls = 0;
    configureSyncPrng(() => {
      calls += 1;
      return calls === 1
        ? new Uint8Array([255, 255, 255, 255])
        : new Uint8Array([0, 0, 0, 7]);
    });

    expect(generateSyncRandomInt(10)).toBe(7);
    expect(calls).toBe(2);
    expect(() => generateSyncRandomInt(0)).toThrow('between 1 and 2^32');
  });
});
