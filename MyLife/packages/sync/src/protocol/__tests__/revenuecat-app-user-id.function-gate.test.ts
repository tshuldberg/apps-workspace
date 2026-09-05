import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  generateDeviceIdentity,
} from '../../index';
import {
  createRevenueCatAppUserId,
  verifyRevenueCatAppUserId,
} from '../hosted-auth';

describe('createRevenueCatAppUserId function quality gate', () => {
  beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));

  it('is stable, private, and verifiable by the public device identity', () => {
    const identity = generateDeviceIdentity('Purchase gate');
    const appUserId = createRevenueCatAppUserId(identity);
    expect(appUserId).toHaveLength(86);
    expect(appUserId).not.toContain(identity.publicKey);
    expect(createRevenueCatAppUserId(identity)).toBe(appUserId);
    expect(verifyRevenueCatAppUserId(identity.publicKey, appUserId)).toBe(true);
  });

  it('passes deterministic identity-label fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createRevenueCatAppUserId fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng, index) => `Device ${index} ${randomInt(rng, 0, 1_000_000)}`,
      assertCase: (label) => {
        const identity = generateDeviceIdentity(label);
        const appUserId = createRevenueCatAppUserId(identity);
        expect(appUserId).toMatch(/^[A-Za-z0-9_-]{86}$/u);
        expect(verifyRevenueCatAppUserId(identity.publicKey, appUserId)).toBe(true);
      },
    });
  });

  it('stays within constant complexity slope budget', async () => {
    const identity = generateDeviceIdentity('Slope device');
    await assertComplexitySlope({
      label: 'createRevenueCatAppUserId',
      sizes: [250, 500, 1000],
      expected: 'constant',
      setup: () => identity,
      run: createRevenueCatAppUserId,
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    const identity = generateDeviceIdentity('Memory device');
    await assertMemoryBudget({
      label: 'createRevenueCatAppUserId',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => identity,
      run: createRevenueCatAppUserId,
    });
  });
});
