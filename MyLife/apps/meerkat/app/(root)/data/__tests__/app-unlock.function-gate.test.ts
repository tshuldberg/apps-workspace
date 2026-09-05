import { describe, expect, it, vi } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  LOG_LEVEL: { WARN: 'WARN' },
}));

import { mintMobileAppUnlockLink } from '../app-unlock';

const identity = { publicKey: 'device-public-key' } as never;

describe('mintMobileAppUnlockLink function quality gate', () => {
  it('fails closed before native purchase access when no hosted service exists', async () => {
    await expect(mintMobileAppUnlockLink(identity, '')).resolves.toEqual({
      ok: false,
      error: 'A connection server is not configured.',
    });
  });

  it('passes deterministic empty-configuration fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'mintMobileAppUnlockLink fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => ' '.repeat(randomInt(rng, 0, 500)),
      assertCase: async (apiUrl) => {
        const result = await mintMobileAppUnlockLink(identity, apiUrl);
        expect(result).toEqual({ ok: false, error: 'A connection server is not configured.' });
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'mintMobileAppUnlockLink',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => ' '.repeat(size),
      run: (apiUrl) => mintMobileAppUnlockLink(identity, apiUrl),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'mintMobileAppUnlockLink',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => ' '.repeat(1000),
      run: (apiUrl) => mintMobileAppUnlockLink(identity, apiUrl),
    });
  });
});
