import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import {
  FilePushAttemptStore,
  FilePushRegistrationStore,
} from '../push-store-file';
import type {
  EncryptedPushProviderToken,
  RegisterPushInstallationInput,
} from '../push-store';

const NOW = Date.UTC(2026, 6, 10, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const temporaryDirectories: string[] = [];

function hash(index: number): string {
  return index.toString(16).padStart(64, '0');
}

function attemptId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function encryptedToken(index: number): EncryptedPushProviderToken {
  return {
    ciphertext: new Uint8Array([0x80, index, 0xff, index ^ 0xaa]),
    keyVersion: 7,
  };
}

function idempotency(index: number, nowMs = NOW) {
  return {
    idempotencyKey: hash(100_000 + index),
    requestDigestHex: hash(10_000 + index),
    idempotencyExpiresAtMs: nowMs + DAY,
    nowMs,
  };
}

function registrationInput(
  index: number,
  nowMs = NOW,
): RegisterPushInstallationInput {
  return {
    ...idempotency(index, nowMs),
    registrationIdHash: hash(index),
    registrationSecretHash: hash(1_000 + index),
    provider: 'apns',
    encryptedToken: encryptedToken(index),
    tokenGeneration: 1,
    tokenExpiresAtMs: nowMs + 14 * DAY,
    registrationExpiresAtMs: nowMs + 30 * DAY,
  };
}

async function temporaryDirectory(label: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), `meerkat-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true })));
});

describe('FilePushRegistrationStore', () => {
  it('accepts only encrypted token envelopes and persists no plaintext token field', async () => {
    // Arrange
    const directory = await temporaryDirectory('push-registration');
    const store = new FilePushRegistrationStore(directory);
    const input = registrationInput(1);

    // Act
    const created = await store.register(input);
    const raw = await fs.readFile(path.join(directory, 'push-registrations.json'), 'utf8');

    // Assert
    expectTypeOf<RegisterPushInstallationInput['encryptedToken']>()
      .toEqualTypeOf<EncryptedPushProviderToken>();
    expect(created.status).toBe('applied');
    if (created.status !== 'applied') return;
    expect(created.value).not.toHaveProperty('registrationSecretHash');
    expect(created.value.tokenGenerations[0]).not.toHaveProperty('encryptedToken');
    expect(raw).toContain('ciphertextBase64');
    expect(raw).not.toContain('plaintextToken');
    expect(raw).not.toContain('deviceId');
    expect(raw).not.toContain('communityId');
    expect(raw).not.toContain('messageId');
    expect(raw).not.toContain('opaquePayload');
  });

  it('binds idempotency keys to request digests', async () => {
    // Arrange
    const store = new FilePushRegistrationStore(
      await temporaryDirectory('push-registration-idempotency'),
    );
    const input = registrationInput(2);

    // Act
    const first = await store.register(input);
    const replay = await store.register(input);
    const conflict = await store.register({
      ...input,
      requestDigestHex: hash(20_002),
    });

    // Assert
    expect(first.status).toBe('applied');
    expect(replay.status).toBe('replay');
    expect(conflict).toEqual({ status: 'conflict' });
  });

  it('replays authenticated mutation results after later revocation', async () => {
    // Arrange
    const store = new FilePushRegistrationStore(
      await temporaryDirectory('push-registration-stable-idempotency'),
    );
    const input = registrationInput(21);
    await store.register(input);
    const rotation = {
      ...idempotency(210, NOW + 1),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
      encryptedToken: encryptedToken(21),
      tokenGeneration: 2,
      tokenExpiresAtMs: NOW + 20 * DAY,
      overlapMs: HOUR,
    };
    const mint = {
      ...idempotency(211, NOW + 1),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
      capabilityHash: hash(2_100),
      scope: 'sync_wake' as const,
      expiresAtMs: NOW + DAY,
    };
    await store.rotateToken(rotation);
    await store.mintCapability(mint);
    await store.revokeRegistration({
      ...idempotency(212, NOW + 2),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
    });

    // Act
    const replayedRotation = await store.rotateToken({ ...rotation, nowMs: NOW + 3 });
    const replayedMint = await store.mintCapability({ ...mint, nowMs: NOW + 3 });

    // Assert
    expect(replayedRotation.status).toBe('replay');
    expect(replayedMint.status).toBe('replay');
  });

  it('keeps provider-token generations overlapping during rotation', async () => {
    // Arrange
    const store = new FilePushRegistrationStore(
      await temporaryDirectory('push-registration-rotation'),
    );
    const input = registrationInput(3);
    await store.register(input);
    await store.mintCapability({
      ...idempotency(30),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
      capabilityHash: hash(300),
      scope: 'sync_wake',
      expiresAtMs: NOW + 10 * DAY,
    });

    // Act
    const rotated = await store.rotateToken({
      ...idempotency(31, NOW + 100),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
      encryptedToken: encryptedToken(33),
      tokenGeneration: 2,
      tokenExpiresAtMs: NOW + 20 * DAY,
      overlapMs: HOUR,
    });
    const duringOverlap = await store.resolveCapability({
      capabilityHash: hash(300),
      scope: 'sync_wake',
      nowMs: NOW + 200,
    });
    const afterOverlap = await store.resolveCapability({
      capabilityHash: hash(300),
      scope: 'sync_wake',
      nowMs: NOW + HOUR + 200,
    });

    // Assert
    expect(rotated.status).toBe('applied');
    expect(duringOverlap?.deliverableTokens.map((token) => token.tokenGeneration)).toEqual([2, 1]);
    expect(afterOverlap?.deliverableTokens.map((token) => token.tokenGeneration)).toEqual([2]);
  });

  it('serializes competing rotations across file-store instances', async () => {
    // Arrange
    const directory = await temporaryDirectory('push-registration-race');
    const first = new FilePushRegistrationStore(directory);
    const second = new FilePushRegistrationStore(directory);
    const input = registrationInput(4);
    await first.register(input);

    // Act
    const results = await Promise.all([
      first.rotateToken({
        ...idempotency(40, NOW + 1),
        registrationIdHash: input.registrationIdHash,
        registrationSecretHash: input.registrationSecretHash,
        encryptedToken: encryptedToken(41),
        tokenGeneration: 2,
        tokenExpiresAtMs: NOW + 20 * DAY,
        overlapMs: HOUR,
      }),
      second.rotateToken({
        ...idempotency(41, NOW + 1),
        registrationIdHash: input.registrationIdHash,
        registrationSecretHash: input.registrationSecretHash,
        encryptedToken: encryptedToken(42),
        tokenGeneration: 2,
        tokenExpiresAtMs: NOW + 20 * DAY,
        overlapMs: HOUR,
      }),
    ]);

    // Assert
    expect(results.filter((result) => result.status === 'applied')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'conflict')).toHaveLength(1);
    const [registration] = (await first.listRegistrations()).records;
    expect(registration?.tokenGenerations.map((token) => token.tokenGeneration)).toEqual([2, 1]);
  });

  it('authenticates mutations with the registration-secret hash', async () => {
    // Arrange
    const store = new FilePushRegistrationStore(
      await temporaryDirectory('push-registration-auth'),
    );
    const input = registrationInput(5);
    await store.register(input);

    // Act
    const result = await store.rotateToken({
      ...idempotency(50, NOW + 1),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: hash(999_999),
      encryptedToken: encryptedToken(51),
      tokenGeneration: 2,
      tokenExpiresAtMs: NOW + 20 * DAY,
      overlapMs: HOUR,
    });

    // Assert
    expect(result).toEqual({ status: 'unauthorized' });
    expect((await store.listRegistrations()).records[0]?.tokenGenerations).toHaveLength(1);
  });

  it('enforces capability scope, expiry, and revocation without identity fields', async () => {
    // Arrange
    const store = new FilePushRegistrationStore(
      await temporaryDirectory('push-capability'),
    );
    const input = registrationInput(6);
    await store.register(input);
    const capabilityHash = hash(600);
    const minted = await store.mintCapability({
      ...idempotency(60),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
      capabilityHash,
      scope: 'sync_wake',
      expiresAtMs: NOW + DAY,
    });

    // Act
    const wrongScope = await store.resolveCapability({
      capabilityHash,
      scope: 'call_wake',
      nowMs: NOW + 1,
    });
    const active = await store.resolveCapability({
      capabilityHash,
      scope: 'sync_wake',
      nowMs: NOW + 1,
    });
    const expired = await store.resolveCapability({
      capabilityHash,
      scope: 'sync_wake',
      nowMs: NOW + DAY,
    });
    await store.revokeCapability({
      ...idempotency(61, NOW + 2),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
      capabilityHash,
    });
    const revoked = await store.resolveCapability({
      capabilityHash,
      scope: 'sync_wake',
      nowMs: NOW + 3,
    });

    // Assert
    expect(minted.status).toBe('applied');
    expect(wrongScope).toBeNull();
    expect(active?.capability).not.toHaveProperty('deviceId');
    expect(active?.capability).not.toHaveProperty('communityId');
    expect(expired).toBeNull();
    expect(revoked).toBeNull();
  });

  it('falls back to a retiring generation when the provider invalidates the newest token', async () => {
    // Arrange
    const store = new FilePushRegistrationStore(
      await temporaryDirectory('push-provider-invalidation'),
    );
    const input = registrationInput(7);
    await store.register(input);
    const capabilityHash = hash(700);
    await store.mintCapability({
      ...idempotency(70),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
      capabilityHash,
      scope: 'sync_wake',
      expiresAtMs: NOW + DAY,
    });
    await store.rotateToken({
      ...idempotency(71, NOW + 1),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
      encryptedToken: encryptedToken(72),
      tokenGeneration: 2,
      tokenExpiresAtMs: NOW + 20 * DAY,
      overlapMs: HOUR,
    });

    // Act
    const invalidated = await store.invalidateProviderToken({
      registrationIdHash: input.registrationIdHash,
      tokenGeneration: 2,
      reason: 'invalid_token',
      nowMs: NOW + 2,
    });
    const resolved = await store.resolveCapability({
      capabilityHash,
      scope: 'sync_wake',
      nowMs: NOW + 3,
    });

    // Assert
    expect(invalidated.status).toBe('applied');
    expect(resolved?.deliverableTokens.map((token) => token.tokenGeneration)).toEqual([1]);
  });

  it('revokes a registration, every capability, and every token generation together', async () => {
    // Arrange
    const store = new FilePushRegistrationStore(
      await temporaryDirectory('push-registration-revoke'),
    );
    const input = registrationInput(8);
    const capabilityHash = hash(800);
    await store.register(input);
    await store.mintCapability({
      ...idempotency(80),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
      capabilityHash,
      scope: 'sync_wake',
      expiresAtMs: NOW + DAY,
    });

    // Act
    const revoked = await store.revokeRegistration({
      ...idempotency(81, NOW + 1),
      registrationIdHash: input.registrationIdHash,
      registrationSecretHash: input.registrationSecretHash,
    });
    const resolution = await store.resolveCapability({
      capabilityHash,
      scope: 'sync_wake',
      nowMs: NOW + 2,
    });
    const stats = await store.stats(NOW + 2);

    // Assert
    expect(revoked.status).toBe('applied');
    expect(resolution).toBeNull();
    expect(stats.activeRegistrations).toBe(0);
    expect(stats.activeCapabilities).toBe(0);
    expect(stats.invalidatedTokens).toBe(1);
  });

  it('reads one registration by hash (getRegistration), honest null on unknown', async () => {
    // Arrange
    const store = new FilePushRegistrationStore(
      await temporaryDirectory('push-registration-get'),
    );
    const input = registrationInput(21, NOW + 21);
    await store.register(input);

    // Act + Assert: the by-hash getter returns the exact record; an unknown
    // hash is an honest null and a malformed hash is rejected loudly.
    const found = await store.getRegistration(input.registrationIdHash);
    expect(found?.registrationIdHash).toBe(input.registrationIdHash);
    expect(found?.tokenGenerations).toHaveLength(1);
    expect(await store.getRegistration('f'.repeat(64))).toBeNull();
    expect(() => store.getRegistration('not-a-hash')).toThrow(TypeError);
  });

  it('provides stable bounded pages and bounded retention pruning', async () => {
    // Arrange
    const store = new FilePushRegistrationStore(
      await temporaryDirectory('push-registration-page'),
    );
    for (let index = 10; index < 14; index += 1) {
      await store.register(registrationInput(index, NOW + index));
    }

    // Act
    const firstPage = await store.listRegistrations({ limit: 2 });
    const secondPage = await store.listRegistrations({
      limit: 2,
      before: firstPage.nextCursor!,
    });
    const target = registrationInput(10, NOW + 10);
    await store.revokeRegistration({
      ...idempotency(500, NOW + DAY),
      registrationIdHash: target.registrationIdHash,
      registrationSecretHash: target.registrationSecretHash,
    });
    const pruned = await store.prune({
      nowMs: NOW + 100 * DAY,
      retainedUntilMs: NOW + 100 * DAY,
      idempotencyRetainedUntilMs: NOW + 100 * DAY,
      limit: 2,
    });

    // Assert
    const pageIds = [...firstPage.records, ...secondPage.records]
      .map((record) => record.registrationIdHash);
    expect(new Set(pageIds).size).toBe(4);
    expect(pruned.registrations + pruned.capabilities + pruned.tokens
      + pruned.idempotencyRecords).toBeLessThanOrEqual(2);
  });

  it('fails closed on corrupt durable state instead of re-registering over it', async () => {
    // Arrange
    const directory = await temporaryDirectory('push-registration-corrupt');
    const store = new FilePushRegistrationStore(directory);
    await fs.writeFile(path.join(directory, 'push-registrations.json'), '{broken', 'utf8');

    // Act and assert
    await expect(store.register(registrationInput(20))).rejects.toThrow(/state is corrupt/);
  });
});

const DEFAULT_ATTEMPT_CAPABILITY_HASH = hash(900_000);

function enqueueInput(
  index: number,
  nowMs = NOW,
  capabilityHash = DEFAULT_ATTEMPT_CAPABILITY_HASH,
) {
  return {
    ...idempotency(1_000 + index, nowMs),
    attemptId: attemptId(index),
    capabilityHash,
    provider: 'apns' as const,
    tokenGeneration: 1,
  };
}

async function attemptStoreFixture(
  label: string,
  capabilityHash = DEFAULT_ATTEMPT_CAPABILITY_HASH,
) {
  const directory = await temporaryDirectory(label);
  const registrations = new FilePushRegistrationStore(directory);
  const registration = registrationInput(900);
  await registrations.register(registration);
  await registrations.mintCapability({
    ...idempotency(900_000),
    registrationIdHash: registration.registrationIdHash,
    registrationSecretHash: registration.registrationSecretHash,
    capabilityHash,
    scope: 'sync_wake',
    expiresAtMs: NOW + 29 * DAY,
  });
  return {
    directory,
    registration,
    registrations,
    attempts: new FilePushAttemptStore(directory),
  };
}

describe('FilePushAttemptStore', () => {
  it('binds attempt idempotency to the request digest and persists no wake payload', async () => {
    // Arrange
    const { attempts: store, directory } = await attemptStoreFixture(
      'push-attempt-idempotency',
    );
    const input = enqueueInput(1);

    // Act
    const created = await store.enqueue(input);
    const replay = await store.enqueue(input);
    const conflict = await store.enqueue({ ...input, requestDigestHex: hash(55_001) });
    const raw = await fs.readFile(path.join(directory, 'push-attempts.json'), 'utf8');

    // Assert
    expect(created.status).toBe('created');
    expect(replay.status).toBe('replay');
    expect(conflict).toEqual({ status: 'conflict' });
    expect(raw).not.toContain('opaquePayload');
    expect(raw).not.toContain('deviceId');
    expect(raw).not.toContain('communityId');
    expect(raw).not.toContain('messageId');
  });

  it('gives concurrent workers disjoint stable claims across store instances', async () => {
    // Arrange
    const { attempts: first, directory } = await attemptStoreFixture('push-attempt-claim');
    const second = new FilePushAttemptStore(directory);
    for (let index = 10; index < 18; index += 1) await first.enqueue(enqueueInput(index));

    // Act
    const [firstClaims, secondClaims] = await Promise.all([
      first.claim({ owner: 'worker-a', limit: 4, leaseMs: HOUR, nowMs: NOW }),
      second.claim({ owner: 'worker-b', limit: 4, leaseMs: HOUR, nowMs: NOW }),
    ]);

    // Assert
    const firstIds = new Set(firstClaims.map((attempt) => attempt.attemptId));
    const secondIds = new Set(secondClaims.map((attempt) => attempt.attemptId));
    expect(firstClaims).toHaveLength(4);
    expect(secondClaims).toHaveLength(4);
    expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(8);
  });

  it('renews active leases and fences stale workers after reclamation', async () => {
    // Arrange
    const { attempts: first, directory } = await attemptStoreFixture('push-attempt-fence');
    const second = new FilePushAttemptStore(directory);
    const input = enqueueInput(20);
    await first.enqueue(input);
    const [initial] = await first.claim({
      owner: 'worker-a',
      limit: 1,
      leaseMs: 100,
      nowMs: NOW,
    });

    // Act
    const renewed = await first.renew({
      attemptId: input.attemptId,
      owner: 'worker-a',
      fencingToken: initial!.fencingToken,
      leaseMs: 100,
      nowMs: NOW + 50,
    });
    const [reclaimed] = await second.claim({
      owner: 'worker-b',
      limit: 1,
      leaseMs: HOUR,
      nowMs: NOW + 151,
    });
    const staleCompletion = await first.complete({
      attemptId: input.attemptId,
      owner: 'worker-a',
      fencingToken: initial!.fencingToken,
      outcome: { state: 'succeeded', providerStatus: 'provider_accepted' },
      nowMs: NOW + 152,
    });
    const currentCompletion = await second.complete({
      attemptId: input.attemptId,
      owner: 'worker-b',
      fencingToken: reclaimed!.fencingToken,
      outcome: { state: 'succeeded', providerStatus: 'provider_accepted' },
      nowMs: NOW + 152,
    });

    // Assert
    expect(renewed.status).toBe('applied');
    expect(reclaimed!.fencingToken).toBeGreaterThan(initial!.fencingToken);
    expect(staleCompletion).toEqual({ status: 'stale' });
    expect(currentCompletion.status).toBe('applied');
  });

  it('does not reclaim retries before their schedule and never labels acceptance delivered', async () => {
    // Arrange
    const { attempts: store } = await attemptStoreFixture('push-attempt-retry');
    const input = enqueueInput(30);
    await store.enqueue(input);
    const [claim] = await store.claim({ owner: 'worker', limit: 1, leaseMs: HOUR, nowMs: NOW });

    // Act
    await store.complete({
      attemptId: input.attemptId,
      owner: 'worker',
      fencingToken: claim!.fencingToken,
      outcome: {
        state: 'retryable',
        providerStatus: 'unknown',
        errorCode: 'provider_timeout',
        retryAtMs: NOW + 100,
      },
      nowMs: NOW + 1,
    });
    const early = await store.claim({ owner: 'worker', limit: 1, leaseMs: HOUR, nowMs: NOW + 99 });
    const [retry] = await store.claim({ owner: 'worker', limit: 1, leaseMs: HOUR, nowMs: NOW + 100 });
    await store.complete({
      attemptId: input.attemptId,
      owner: 'worker',
      fencingToken: retry!.fencingToken,
      outcome: {
        state: 'succeeded',
        providerStatus: 'provider_accepted',
        providerReference: 'provider-request-1',
      },
      nowMs: NOW + 101,
    });
    const status = await store.getStatus({
      attemptId: input.attemptId,
      capabilityHash: input.capabilityHash,
    });

    // Assert
    expect(early).toEqual([]);
    expect(retry!.attemptCount).toBe(2);
    expect(retry!.providerStatus).toBe('pending');
    expect(status).toMatchObject({
      providerStatus: 'provider_accepted',
      providerReference: 'provider-request-1',
      terminal: true,
    });
    expect(JSON.stringify(status)).not.toContain('delivered');
  });

  it('cancels queued and leased attempts when a capability is revoked', async () => {
    // Arrange
    const capabilityHash = hash(9_000);
    const { attempts: store } = await attemptStoreFixture(
      'push-attempt-cancel',
      capabilityHash,
    );
    const queued = enqueueInput(40, NOW, capabilityHash);
    const leased = enqueueInput(41, NOW, capabilityHash);
    await store.enqueue(queued);
    await store.enqueue(leased);
    const [lease] = await store.claim({ owner: 'worker', limit: 1, leaseMs: HOUR, nowMs: NOW });

    // Act
    const cancelled = await store.cancelByCapability({
      capabilityHash,
      reasonCode: 'capability_revoked',
      nowMs: NOW + 1,
      limit: 10,
    });
    const stale = await store.complete({
      attemptId: lease!.attemptId,
      owner: 'worker',
      fencingToken: lease!.fencingToken,
      outcome: { state: 'succeeded', providerStatus: 'provider_accepted' },
      nowMs: NOW + 2,
    });

    // Assert
    expect(cancelled).toBe(2);
    expect(stale).toEqual({ status: 'stale' });
    expect((await store.stats(NOW + 2)).cancelled).toBe(2);
  });

  it('keeps the capability proof on status lookups', async () => {
    // Arrange
    const { attempts: store } = await attemptStoreFixture('push-attempt-status');
    const input = enqueueInput(50);
    await store.enqueue(input);

    // Act
    const correct = await store.getStatus({
      attemptId: input.attemptId,
      capabilityHash: input.capabilityHash,
    });
    const wrong = await store.getStatus({
      attemptId: input.attemptId,
      capabilityHash: hash(99_999),
    });

    // Assert
    expect(correct?.providerStatus).toBe('unknown');
    expect(wrong).toBeNull();
  });

  it('keeps fencing tokens monotonic under repeated randomized retry races', async () => {
    // Arrange
    const { attempts: store } = await attemptStoreFixture('push-attempt-property');
    let seed = 0x5eed;
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed;
    };

    // Act
    for (let index = 60; index < 100; index += 1) {
      const input = enqueueInput(index, NOW + index);
      await store.enqueue(input);
      let nowMs = NOW + 1_000 + index;
      let previousFence = 0;
      const retries = random() % 4;
      for (let retry = 0; retry < retries; retry += 1) {
        const [claim] = await store.claim({ owner: `worker-${index}`, limit: 1, leaseMs: HOUR, nowMs });
        expect(claim!.fencingToken).toBeGreaterThan(previousFence);
        previousFence = claim!.fencingToken;
        await store.complete({
          attemptId: input.attemptId,
          owner: `worker-${index}`,
          fencingToken: claim!.fencingToken,
          outcome: {
            state: 'retryable',
            providerStatus: 'unknown',
            errorCode: 'transient_provider_error',
            retryAtMs: nowMs + 1,
          },
          nowMs,
        });
        nowMs += 1;
      }
      const [finalClaim] = await store.claim({ owner: `worker-${index}`, limit: 1, leaseMs: HOUR, nowMs });
      expect(finalClaim!.fencingToken).toBeGreaterThan(previousFence);
      await store.complete({
        attemptId: input.attemptId,
        owner: `worker-${index}`,
        fencingToken: finalClaim!.fencingToken,
        outcome: { state: 'succeeded', providerStatus: 'provider_accepted' },
        nowMs,
      });
    }

    // Assert
    const stats = await store.stats(NOW + DAY);
    expect(stats.succeeded).toBe(40);
    expect(stats.leased).toBe(0);
    expect(stats.retryable).toBe(0);
  });

  it('provides stable pages, bounded stats, and bounded retention pruning', async () => {
    // Arrange
    const { attempts: store } = await attemptStoreFixture('push-attempt-page');
    for (let index = 100; index < 104; index += 1) {
      await store.enqueue(enqueueInput(index, NOW + index));
    }
    const claimed = await store.claim({ owner: 'worker', limit: 4, leaseMs: HOUR, nowMs: NOW + 200 });
    for (const attempt of claimed) {
      await store.complete({
        attemptId: attempt.attemptId,
        owner: 'worker',
        fencingToken: attempt.fencingToken,
        outcome: { state: 'succeeded', providerStatus: 'provider_accepted' },
        nowMs: NOW + 201,
      });
    }

    // Act
    const firstPage = await store.list({ limit: 2 });
    const secondPage = await store.list({ limit: 2, before: firstPage.nextCursor! });
    const pruned = await store.prune({
      nowMs: NOW + 100 * DAY,
      completedBeforeMs: NOW + DAY,
      idempotencyRetainedUntilMs: NOW + 100 * DAY,
      limit: 2,
    });

    // Assert
    expect(new Set([...firstPage.records, ...secondPage.records]
      .map((attempt) => attempt.attemptId)).size).toBe(4);
    expect(pruned.attempts + pruned.idempotencyRecords).toBeLessThanOrEqual(2);
    expect((await store.stats(NOW + DAY)).total).toBeGreaterThanOrEqual(2);
  });

  it('fails closed on corrupt attempt state', async () => {
    // Arrange
    const { attempts: store, directory } = await attemptStoreFixture('push-attempt-corrupt');
    await fs.writeFile(path.join(directory, 'push-attempts.json'), '[]', 'utf8');

    // Act and assert
    await expect(store.enqueue(enqueueInput(200))).rejects.toThrow(/invalid shape/);
  });
});
