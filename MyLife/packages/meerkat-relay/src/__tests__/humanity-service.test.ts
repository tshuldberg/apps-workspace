import { describe, expect, it } from 'vitest';
import {
  HumanityService,
  InMemoryHumanityStore,
  humanityRegistrationRedemptionDigest,
  humanityServiceKeypairFromEnv,
  resolveHumanityLimits,
  type HumanityVerifier,
} from '../humanity-service';
import { StubHumanityVerifier } from '../humanity-verifiers';
import {
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  serializeHumanityToken,
  verifyHumanityToken,
} from '@mylife/sync';

const NOW = Date.parse('2026-07-05T00:00:00.000Z');
const serviceKeys = humanityServiceKeypairFromSeed('a'.repeat(64));

function deterministicBytes(): (length: number) => Uint8Array {
  let counter = 1;
  return (length: number) => {
    const out = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      out[index] = counter & 0xff;
      counter += 1;
    }
    return out;
  };
}

function verifier(attestationKeyId = 'device-key'): HumanityVerifier {
  return {
    kind: 'turnstile',
    isProductionSafe: true,
    verify: async () => ({ ok: true, attestationKeyId }),
  };
}

function service(overrides: Partial<ConstructorParameters<typeof HumanityService>[0]> = {}): HumanityService {
  return new HumanityService({
    signingKeypair: serviceKeys,
    verifiers: [verifier()],
    now: () => NOW,
    randomBytes: deterministicBytes(),
    ...overrides,
  });
}

describe('HumanityService core', () => {
  it('issues a one-time challenge and a signed wallet batch after verifier success', async () => {
    const svc = service({ limits: { batchSize: 3 } });
    const challenge = await svc.challenge('turnstile');
    expect(challenge.ok).toBe(true);
    if (!challenge.ok) throw new Error('challenge failed');

    const issued = await svc.issue({
      challengeId: challenge.challengeId,
      attestation: { token: 'ok' },
      clientIp: '203.0.113.10',
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) throw new Error('issue failed');
    expect(issued.tokens).toHaveLength(3);
    for (const token of issued.tokens) {
      expect(verifyHumanityToken(token, svc.publicKeyHex, NOW)).toBe('ok');
    }
  });

  it('consumes challenges on terminal outcomes', async () => {
    const badVerifier: HumanityVerifier = {
      kind: 'turnstile',
      isProductionSafe: true,
      verify: async () => ({ ok: false, reason: 'nope' }),
    };
    const svc = service({ verifiers: [badVerifier] });
    const challenge = await svc.challenge('turnstile');
    if (!challenge.ok) throw new Error('challenge failed');

    await expect(svc.issue({ challengeId: challenge.challengeId, attestation: {} })).resolves.toEqual({
      ok: false,
      reason: 'verification_failed',
    });
    await expect(svc.issue({ challengeId: challenge.challengeId, attestation: {} })).resolves.toEqual({
      ok: false,
      reason: 'unknown_challenge',
    });
  });

  it('lets exactly one concurrent issue consume a one-time challenge', async () => {
    const svc = service({ limits: { batchSize: 1 } });
    const challenge = await svc.challenge('turnstile');
    if (!challenge.ok) throw new Error('challenge failed');

    const results = await Promise.all(Array.from(
      { length: 20 },
      () => svc.issue({ challengeId: challenge.challengeId, attestation: {} }),
    ));

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.reason === 'unknown_challenge')).toHaveLength(19);
  });

  it('rejects a replayed token on redeem', async () => {
    const svc = service({ limits: { batchSize: 1 } });
    const challenge = await svc.challenge('turnstile');
    if (!challenge.ok) throw new Error('challenge failed');
    const issued = await svc.issue({ challengeId: challenge.challengeId, attestation: {} });
    if (!issued.ok) throw new Error('issue failed');
    const wire = serializeHumanityToken(issued.tokens[0]!);

    await expect(svc.redeem(wire)).resolves.toEqual({ ok: true });
    await expect(svc.redeem(wire)).resolves.toEqual({ ok: false, reason: 'already_spent' });
  });

  it('spends a token atomically under a concurrent redeem race (AC-2)', async () => {
    const svc = service({ limits: { batchSize: 1 } });
    const challenge = await svc.challenge('turnstile');
    if (!challenge.ok) throw new Error('challenge failed');
    const issued = await svc.issue({ challengeId: challenge.challengeId, attestation: {} });
    if (!issued.ok) throw new Error('issue failed');
    const wire = serializeHumanityToken(issued.tokens[0]!);

    // Fire many concurrent redeems of the SAME token. The old isSpent-then-markSpent
    // check-then-set could let two both pass; trySpend guarantees EXACTLY one winner.
    const results = await Promise.all(Array.from({ length: 20 }, () => svc.redeem(wire)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === 'already_spent')).toHaveLength(19);
  });

  it('replays one registration redemption and conflicts on attempt reuse', async () => {
    const svc = service();
    const tokens = issueHumanityTokenBatch({
      servicePrivateKeyHex: serviceKeys.privateKeyHex,
      count: 2,
      now: NOW,
      randomBytes: deterministicBytes(),
    });
    const attemptId = '1'.repeat(64);
    const firstWire = serializeHumanityToken(tokens[0]!);
    const firstDigest = humanityRegistrationRedemptionDigest(attemptId, tokens[0]!.tokenId);
    const input = { token: firstWire, attemptId, requestDigest: firstDigest };

    const results = await Promise.all(Array.from(
      { length: 20 },
      () => svc.redeemRegistration(input),
    ));
    expect(results.filter((result) => result.ok && !result.replayed)).toHaveLength(1);
    expect(results.filter((result) => result.ok && result.replayed)).toHaveLength(19);

    const secondWire = serializeHumanityToken(tokens[1]!);
    const secondDigest = humanityRegistrationRedemptionDigest(attemptId, tokens[1]!.tokenId);
    await expect(svc.redeemRegistration({
      token: secondWire,
      attemptId,
      requestDigest: secondDigest,
    })).resolves.toEqual({ ok: false, reason: 'attempt_conflict' });
    // The conflicting request did not burn its different token.
    await expect(svc.redeem(secondWire)).resolves.toEqual({ ok: true });
  });

  it('recovers a committed registration redemption after token expiry', async () => {
    let now = NOW;
    const svc = service({ now: () => now });
    const [token] = issueHumanityTokenBatch({
      servicePrivateKeyHex: serviceKeys.privateKeyHex,
      count: 1,
      ttlMs: 1_000,
      now,
      randomBytes: deterministicBytes(),
    });
    const attemptId = '2'.repeat(64);
    const input = {
      token: serializeHumanityToken(token!),
      attemptId,
      requestDigest: humanityRegistrationRedemptionDigest(attemptId, token!.tokenId),
    };
    await expect(svc.redeemRegistration(input)).resolves.toEqual({ ok: true, replayed: false });

    now += 2_000;
    await expect(svc.redeemRegistration(input)).resolves.toEqual({ ok: true, replayed: true });
    const differentAttempt = '3'.repeat(64);
    await expect(svc.redeemRegistration({
      ...input,
      attemptId: differentAttempt,
      requestDigest: humanityRegistrationRedemptionDigest(differentAttempt, token!.tokenId),
    })).resolves.toEqual({ ok: false, reason: 'expired' });
  });

  it('InMemoryHumanityStore.trySpend records once and reports the winner', () => {
    const store = new InMemoryHumanityStore();
    expect(store.trySpend('hash-a', NOW + 1000)).toBe(true);
    expect(store.trySpend('hash-a', NOW + 1000)).toBe(false);
    expect(store.isSpent('hash-a')).toBe(true);
    expect(store.isSpent('hash-b')).toBe(false);
  });

  it('caps issuance by attestation key and by IP window', async () => {
    const keyCapped = service({ limits: { maxBatchesPerKeyPerDay: 1 }, verifiers: [verifier('same-key')] });
    const c1 = await keyCapped.challenge('turnstile');
    const c2 = await keyCapped.challenge('turnstile');
    if (!c1.ok || !c2.ok) throw new Error('challenge failed');
    expect(await keyCapped.issue({ challengeId: c1.challengeId, attestation: {}, clientIp: '198.51.100.1' })).toMatchObject({ ok: true });
    expect(await keyCapped.issue({ challengeId: c2.challengeId, attestation: {}, clientIp: '198.51.100.2' })).toEqual({
      ok: false,
      reason: 'key_cap_exceeded',
    });

    const ipCapped = service({ limits: { maxIssuePerIpPerWindow: 1 }, verifiers: [verifier('k1')] });
    const i1 = await ipCapped.challenge('turnstile');
    const i2 = await ipCapped.challenge('turnstile');
    if (!i1.ok || !i2.ok) throw new Error('challenge failed');
    expect(await ipCapped.issue({ challengeId: i1.challengeId, attestation: {}, clientIp: '192.0.2.1' })).toMatchObject({ ok: true });
    expect(await ipCapped.issue({ challengeId: i2.challengeId, attestation: {}, clientIp: '192.0.2.1' })).toEqual({
      ok: false,
      reason: 'ip_rate_limited',
    });
  });

  it('lets exactly one concurrent issue consume the final key allowance', async () => {
    const svc = service({
      limits: { batchSize: 1, maxBatchesPerKeyPerDay: 1 },
      verifiers: [verifier('same-key')],
    });
    const first = await svc.challenge('turnstile');
    const second = await svc.challenge('turnstile');
    if (!first.ok || !second.ok) throw new Error('challenge failed');

    const results = await Promise.all([
      svc.issue({ challengeId: first.challengeId, attestation: {} }),
      svc.issue({ challengeId: second.challengeId, attestation: {} }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.reason === 'key_cap_exceeded')).toHaveLength(1);
  });

  it('prunes expired challenges, spent hashes, issuance buckets, and IP windows', async () => {
    let now = NOW;
    const store = new InMemoryHumanityStore();
    const svc = service({
      store,
      now: () => now,
      limits: { challengeTtlMs: 1000, tokenTtlMs: 1000, ipWindowMs: 1000, maxIssuePerIpPerWindow: 1 },
    });
    const challenge = await svc.challenge('turnstile');
    if (!challenge.ok) throw new Error('challenge failed');
    const issued = await svc.issue({ challengeId: challenge.challengeId, attestation: {}, clientIp: '203.0.113.7' });
    if (!issued.ok) throw new Error('issue failed');
    expect(await svc.stats()).toMatchObject({ spent: 0, issuanceKeys: 1, ipWindows: 1 });
    await svc.redeem(serializeHumanityToken(issued.tokens[0]!));
    expect(await svc.stats()).toMatchObject({ spent: 1 });

    now += 1001;
    await svc.sweep();
    expect(await svc.stats()).toMatchObject({ spent: 0, challenges: 0, ipWindows: 0 });
  });

  it('refuses non-production-safe verifiers in production mode', () => {
    expect(() => service({ verifiers: [new StubHumanityVerifier('turnstile')], productionMode: true })).toThrow(
      /non-production-safe/u,
    );
  });
});

describe('humanity service env helpers', () => {
  it('derives the service keypair from HUMANITY_SIGNING_KEY', () => {
    expect(humanityServiceKeypairFromEnv({ HUMANITY_SIGNING_KEY: 'a'.repeat(64) })).toEqual(serviceKeys);
  });

  it('clamps env-provided limits', () => {
    const limits = resolveHumanityLimits({
      HUMANITY_BATCH_SIZE: '9999',
      HUMANITY_TOKEN_TTL_MS: '1',
      HUMANITY_MAX_BATCHES_PER_KEY_PER_DAY: '2',
    });
    expect(limits.batchSize).toBe(256);
    expect(limits.tokenTtlMs).toBe(60_000);
    expect(limits.maxBatchesPerKeyPerDay).toBe(2);
  });
});
