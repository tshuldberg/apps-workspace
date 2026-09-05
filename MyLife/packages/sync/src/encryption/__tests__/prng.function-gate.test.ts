import { afterEach, describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  configureSyncPrng,
  configureSyncPrngFromGlobalCrypto,
  generateSyncRandomBytes,
  generateSyncRandomInt,
  hasConfiguredSyncPrng,
} from '../prng';

afterEach(() => {
  configureSyncPrngFromGlobalCrypto();
});

describe('sync random consumer helpers function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    configureSyncPrng((byteCount) => Uint8Array.from({ length: byteCount }, (_, index) => index + 1));

    expect(generateSyncRandomBytes(4)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(generateSyncRandomInt(256)).toBe(4);
  });

  it('passes deterministic bounded-integer fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'generateSyncRandomInt fuzz',
      iterations: 200,
      seed: 43,
      makeCase: (rng) => ({
        bound: randomInt(rng, 1, 1_000_000),
        bytes: [0, ...Array.from({ length: 3 }, () => randomInt(rng, 0, 255))],
      }),
      assertCase: async ({ bound, bytes }) => {
        configureSyncPrng(() => Uint8Array.from(bytes));
        const sample = generateSyncRandomInt(bound);
        expect(sample).toBeGreaterThanOrEqual(0);
        expect(sample).toBeLessThan(bound);
      },
    });
  });

  it('stays within constant-time complexity slope budget for accepted samples', async () => {
    configureSyncPrng(() => new Uint8Array([0, 0, 0, 1]));
    await assertComplexitySlope({
      label: 'generateSyncRandomInt',
      sizes: [250, 500, 1000],
      expected: 'constant',
      setup: () => 2_000_000_000,
      run: async (bound) => {
        generateSyncRandomInt(bound);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    configureSyncPrng((byteCount) => new Uint8Array(byteCount).fill(1));
    await assertMemoryBudget({
      label: 'generateSyncRandomBytes',
      repeats: 200,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 32,
      run: async (byteCount) => {
        generateSyncRandomBytes(byteCount);
      },
    });
  });
});

describe('configureSyncPrng function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    configureSyncPrng((byteCount) => (
      Uint8Array.from({ length: byteCount }, (_, index) => index + 1)
    ));

    expect(nacl.randomBytes(4)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(hasConfiguredSyncPrng()).toBe(true);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'configureSyncPrng fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 1, 64);
        return Array.from({ length: size }, () => randomInt(rng, 0, 255));
      },
      assertCase: async (input) => {
        configureSyncPrng((byteCount) => (
          Uint8Array.from({ length: byteCount }, (_, index) => input[index % input.length]!)
        ));

        const sample = nacl.randomBytes(input.length * 2);
        expect(Array.from(sample)).toEqual([...input, ...input]);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'configureSyncPrng',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => size,
      run: async (input) => {
        configureSyncPrng((byteCount) => new Uint8Array(byteCount + input).slice(input));
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'configureSyncPrng',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 32,
      run: async (input) => {
        configureSyncPrng((byteCount) => new Uint8Array(byteCount + input).slice(input));
      },
    });
  });
});
