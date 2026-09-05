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
import { createHostedAuthBearer } from '../hosted-auth';

describe('createHostedAuthBearer function quality gate', () => {
  beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));

  it('mints a three-part bearer bound to the identity and expiry', () => {
    const identity = generateDeviceIdentity('Gate device');
    const token = createHostedAuthBearer(identity, 10_000, 2_000);
    expect(token.split('.').slice(0, 2)).toEqual([identity.publicKey, '12000']);
    expect(token.split('.')[2]).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it('passes deterministic lifetime fuzz invariants', async () => {
    const identity = generateDeviceIdentity('Fuzz device');
    await runDeterministicFuzz({
      label: 'createHostedAuthBearer fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => ({ now: randomInt(rng, 0, 2_000_000_000), ttl: randomInt(rng, 1, 60_000) }),
      assertCase: ({ now, ttl }) => {
        const [subject, expiresAt, signature] = createHostedAuthBearer(identity, now, ttl).split('.');
        expect(subject).toBe(identity.publicKey);
        expect(expiresAt).toBe(String(now + ttl));
        expect(signature).toMatch(/^[A-Za-z0-9_-]+$/u);
      },
    });
  });

  it('stays within constant complexity slope budget', async () => {
    const identity = generateDeviceIdentity('Slope device');
    await assertComplexitySlope({
      label: 'createHostedAuthBearer',
      sizes: [250, 500, 1000],
      expected: 'constant',
      setup: (size) => size,
      run: (now) => createHostedAuthBearer(identity, now, 60_000),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    const identity = generateDeviceIdentity('Memory device');
    await assertMemoryBudget({
      label: 'createHostedAuthBearer',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 1_000,
      run: (now) => createHostedAuthBearer(identity, now, 60_000),
    });
  });
});
