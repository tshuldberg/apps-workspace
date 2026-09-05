import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  CompletePushAttemptInput,
  EncryptedPushProviderToken,
  RegisterPushInstallationInput,
} from '../../../push-store';
import { runPostgresMigrations } from '../../migrate';
import {
  calculateMigrationChecksum,
  MEERKAT_POSTGRES_MIGRATIONS,
  type MeerkatPostgresMigration,
} from '../../migrations';
import { PUSH_LIFECYCLE_SQL } from '../../migrations/0005-push-lifecycle';
import {
  PostgresStoreContext,
  PostgresStoreUnavailableError,
} from '../../store-context';
import {
  PostgresPushAttemptStore,
  PostgresPushRegistrationStore,
} from '../push-stores';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const pushMigration: MeerkatPostgresMigration = {
  version: 5,
  name: 'push_lifecycle',
  sql: PUSH_LIFECYCLE_SQL,
  execution: 'transactional',
  checksum: calculateMigrationChecksum(5, 'push_lifecycle', PUSH_LIFECYCLE_SQL),
};

const migrations = [
  ...MEERKAT_POSTGRES_MIGRATIONS.filter((migration) => migration.version <= 4),
  pushMigration,
] as const;

function hash(index: number): string {
  return index.toString(16).padStart(64, '0');
}

function attemptId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function encryptedToken(index: number): EncryptedPushProviderToken {
  return {
    ciphertext: new Uint8Array([0x80, index & 0xff, 0xff, (index ^ 0xaa) & 0xff]),
    keyVersion: 7,
  };
}

function idempotency(index: number, nowMs = Date.now()) {
  return {
    idempotencyKey: hash(100_000 + index),
    requestDigestHex: hash(200_000 + index),
    idempotencyExpiresAtMs: nowMs + DAY,
    nowMs,
  };
}

function registrationInput(index: number): RegisterPushInstallationInput {
  const nowMs = Date.now();
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

function failingContext(): PostgresStoreContext {
  const failure = new Error('database unavailable');
  const pool = {
    query: async () => { throw failure; },
    connect: async () => { throw failure; },
  } as unknown as Pool;
  return new PostgresStoreContext(pool);
}

describe('PostgreSQL push outage mapping', () => {
  it('fails registration reads explicitly when PostgreSQL is unavailable', async () => {
    // Arrange
    const store = new PostgresPushRegistrationStore(failingContext());

    // Act and assert
    await expect(store.stats(Date.now())).rejects.toBeInstanceOf(PostgresStoreUnavailableError);
  });

  it('fails attempt claims explicitly when PostgreSQL is unavailable', async () => {
    // Arrange
    const store = new PostgresPushAttemptStore(failingContext());

    // Act and assert
    await expect(store.claim({
      owner: 'worker',
      limit: 1,
      leaseMs: HOUR,
      nowMs: Date.now(),
    })).rejects.toBeInstanceOf(PostgresStoreUnavailableError);
  });

  it('rejects an impossible provider outcome before touching PostgreSQL', async () => {
    // Arrange
    const store = new PostgresPushAttemptStore(failingContext());
    const invalid = {
      attemptId: attemptId(999),
      owner: 'worker',
      fencingToken: 1,
      outcome: { state: 'succeeded', providerStatus: 'provider_rejected' },
      nowMs: Date.now(),
    } as unknown as CompletePushAttemptInput;

    // Act and assert
    await expect(store.complete(invalid)).rejects.toThrow(/require provider_accepted/);
  });
});

describePostgres('PostgreSQL push stores on two PostgreSQL 17 pools', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_push_store_${suffix}`;
  let adminPool: Pool;
  let firstPool: Pool;
  let secondPool: Pool;
  let firstRegistrations: PostgresPushRegistrationStore;
  let secondRegistrations: PostgresPushRegistrationStore;
  let firstAttempts: PostgresPushAttemptStore;
  let secondAttempts: PostgresPushAttemptStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Push integration tests require a meerkat_ci or meerkat_test database');
    }
    const version = await adminPool.query<{ version_num: string }>(
      `SELECT current_setting('server_version_num') AS version_num`,
    );
    expect(Number(version.rows[0]?.version_num)).toBeGreaterThanOrEqual(170_000);
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    const poolOptions = {
      connectionString: databaseUrl.toString(),
      max: 4,
      statement_timeout: 30_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    };
    firstPool = new Pool({ ...poolOptions, application_name: 'meerkat-push-integration-a' });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({ ...poolOptions, application_name: 'meerkat-push-integration-b' });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool, { migrations, targetVersion: 5 });
    firstRegistrations = new PostgresPushRegistrationStore(
      new PostgresStoreContext(firstPool),
    );
    secondRegistrations = new PostgresPushRegistrationStore(
      new PostgresStoreContext(secondPool),
    );
    firstAttempts = new PostgresPushAttemptStore(new PostgresStoreContext(firstPool));
    secondAttempts = new PostgresPushAttemptStore(new PostgresStoreContext(secondPool));
  });

  beforeEach(async () => {
    await firstPool.query(`
      TRUNCATE TABLE push.attempts, push.registration_tokens,
        push.capabilities, push.registrations, ops.idempotency_results
    `);
  });

  afterAll(async () => {
    await firstPool?.end().catch(() => undefined);
    await secondPool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  async function registerWithCapability(index: number) {
    const registration = registrationInput(index);
    const registered = await firstRegistrations.register(registration);
    expect(registered.status).toBe('applied');
    const capabilityHash = hash(10_000 + index);
    const capability = await firstRegistrations.mintCapability({
      ...idempotency(10_000 + index),
      registrationIdHash: registration.registrationIdHash,
      registrationSecretHash: registration.registrationSecretHash,
      capabilityHash,
      scope: 'sync_wake',
      expiresAtMs: Date.now() + 7 * DAY,
    });
    expect(capability.status).toBe('applied');
    return { registration, capabilityHash };
  }

  it('keeps request-bound idempotency and projections free of plaintext or identity', async () => {
    // Arrange
    const input = registrationInput(1);

    // Act
    const created = await firstRegistrations.register(input);
    const replayed = await secondRegistrations.register(input);
    const conflict = await secondRegistrations.register({
      ...input,
      requestDigestHex: hash(999_001),
    });
    const persisted = await firstPool.query<{
      registration: Record<string, unknown>;
      token: Record<string, unknown>;
      idempotency_result: Record<string, unknown>;
    }>(
      `SELECT to_jsonb(r) AS registration, to_jsonb(t) AS token, i.result AS idempotency_result
       FROM push.registrations AS r
       JOIN push.registration_tokens AS t USING (registration_id_hash)
       JOIN ops.idempotency_results AS i
         ON i.scope = 'push.registration.register' AND i.idempotency_key = $2
       WHERE r.registration_id_hash = decode($1, 'hex')`,
      [input.registrationIdHash, input.idempotencyKey],
    );

    // Assert
    expect(created.status).toBe('applied');
    expect(replayed.status).toBe('replay');
    expect(conflict).toEqual({ status: 'conflict' });
    if (created.status !== 'applied') return;
    expect(created.value).not.toHaveProperty('registrationSecretHash');
    expect(created.value.tokenGenerations[0]).not.toHaveProperty('encryptedToken');
    const durableJson = JSON.stringify(persisted.rows[0]);
    expect(durableJson).toContain('token_ciphertext');
    expect(durableJson).not.toContain('plaintextToken');
    expect(durableJson).not.toContain('deviceId');
    expect(durableJson).not.toContain('communityId');
    expect(durableJson).not.toContain('messageId');
    expect(durableJson).not.toContain('opaquePayload');
  });

  it('serializes overlapping rotations and projects a retiring fallback after invalidation', async () => {
    // Arrange
    const { registration, capabilityHash } = await registerWithCapability(2);
    const nowMs = Date.now();
    const rotation = (index: number) => ({
      ...idempotency(20_000 + index, nowMs),
      registrationIdHash: registration.registrationIdHash,
      registrationSecretHash: registration.registrationSecretHash,
      encryptedToken: encryptedToken(index),
      tokenGeneration: 2,
      tokenExpiresAtMs: nowMs + 20 * DAY,
      overlapMs: HOUR,
    });

    // Act
    const rotations = await Promise.all([
      firstRegistrations.rotateToken(rotation(21)),
      secondRegistrations.rotateToken(rotation(22)),
    ]);
    const duringOverlap = await firstRegistrations.resolveCapability({
      capabilityHash,
      scope: 'sync_wake',
      nowMs: Date.now(),
    });
    const invalidated = await secondRegistrations.invalidateProviderToken({
      registrationIdHash: registration.registrationIdHash,
      tokenGeneration: 2,
      reason: 'invalid_token',
      nowMs: Date.now(),
    });
    const fallback = await firstRegistrations.resolveCapability({
      capabilityHash,
      scope: 'sync_wake',
      nowMs: Date.now(),
    });
    const legacy = await firstPool.query<{ token_generation: string }>(
      `SELECT token_generation FROM push.registrations
       WHERE registration_id_hash = decode($1, 'hex')`,
      [registration.registrationIdHash],
    );

    // Assert
    expect(rotations.filter((result) => result.status === 'applied')).toHaveLength(1);
    expect(rotations.filter((result) => result.status === 'conflict')).toHaveLength(1);
    expect(duringOverlap?.deliverableTokens.map((token) => token.tokenGeneration)).toEqual([2, 1]);
    expect(invalidated.status).toBe('applied');
    expect(fallback?.deliverableTokens.map((token) => token.tokenGeneration)).toEqual([1]);
    expect(legacy.rows[0]?.token_generation).toBe('1');
  });

  it('keeps registration pages exact and revokes a registration as one atomic boundary', async () => {
    // Arrange
    const registrations = [];
    for (let index = 6; index < 10; index += 1) {
      const input = registrationInput(index);
      registrations.push(input);
      await firstRegistrations.register(input);
      await firstPool.query(
        `UPDATE push.registrations
         SET created_at = $2::timestamptz
         WHERE registration_id_hash = decode($1, 'hex')`,
        [input.registrationIdHash, `2026-07-10T12:00:00.123${index}00Z`],
      );
    }
    const target = registrations[0]!;
    const capabilityHash = hash(60_000);
    await firstRegistrations.mintCapability({
      ...idempotency(60_001),
      registrationIdHash: target.registrationIdHash,
      registrationSecretHash: target.registrationSecretHash,
      capabilityHash,
      scope: 'sync_wake',
      expiresAtMs: Date.now() + DAY,
    });
    const firstPage = await firstRegistrations.listRegistrations({ limit: 2 });
    const secondPage = await secondRegistrations.listRegistrations({
      limit: 2,
      before: firstPage.nextCursor!,
    });
    // getRegistration: exact O(1) by-hash read on both pools; unknown = null.
    const fetched = await secondRegistrations.getRegistration(target.registrationIdHash);
    expect(fetched?.registrationIdHash).toBe(target.registrationIdHash);
    expect(fetched?.tokenGenerations.length).toBeGreaterThan(0);
    expect(await firstRegistrations.getRegistration('e'.repeat(64))).toBeNull();
    const revokeInput = {
      ...idempotency(60_002),
      registrationIdHash: target.registrationIdHash,
      registrationSecretHash: target.registrationSecretHash,
    };

    // Act
    const revoked = await firstRegistrations.revokeRegistration(revokeInput);
    const replayed = await secondRegistrations.revokeRegistration({
      ...revokeInput,
      nowMs: Date.now(),
    });
    const resolution = await secondRegistrations.resolveCapability({
      capabilityHash,
      scope: 'sync_wake',
      nowMs: Date.now(),
    });
    const stats = await firstRegistrations.stats(Date.now());
    await firstPool.query(
      `UPDATE ops.idempotency_results
       SET expires_at = clock_timestamp() - interval '1 second'
       WHERE scope LIKE 'push.registration.%' OR scope LIKE 'push.capability.%'`,
    );
    const pruneNow = Date.now() + 1_000;
    const pruned = await secondRegistrations.prune({
      nowMs: pruneNow,
      retainedUntilMs: pruneNow,
      idempotencyRetainedUntilMs: pruneNow,
      limit: 2,
    });

    // Assert
    expect(new Set([...firstPage.records, ...secondPage.records]
      .map((registration) => registration.registrationIdHash)).size).toBe(4);
    expect(firstPage.records[0]?.createdAt).toMatch(/\.\d{6}Z$/u);
    expect(revoked.status).toBe('applied');
    expect(replayed.status).toBe('replay');
    expect(resolution).toBeNull();
    expect(stats.activeRegistrations).toBe(3);
    expect(stats.activeCapabilities).toBe(0);
    expect(stats.invalidatedTokens).toBe(1);
    expect(pruned.registrations + pruned.capabilities + pruned.tokens
      + pruned.idempotencyRecords).toBeLessThanOrEqual(2);
  });

  it('gives concurrent workers disjoint claims and binds attempt replays to request digests', async () => {
    // Arrange
    const { capabilityHash } = await registerWithCapability(3);
    const firstInput = {
      ...idempotency(30_001),
      attemptId: attemptId(1),
      capabilityHash,
      provider: 'apns' as const,
      tokenGeneration: 1,
    };
    const duplicate = await Promise.all([
      firstAttempts.enqueue(firstInput),
      secondAttempts.enqueue(firstInput),
    ]);
    for (let index = 2; index <= 8; index += 1) {
      await firstAttempts.enqueue({
        ...idempotency(30_000 + index),
        attemptId: attemptId(index),
        capabilityHash,
        provider: 'apns',
        tokenGeneration: 1,
      });
    }

    // Act
    const digestConflict = await secondAttempts.enqueue({
      ...firstInput,
      requestDigestHex: hash(999_003),
    });
    const [firstClaims, secondClaims] = await Promise.all([
      firstAttempts.claim({ owner: 'worker-a', limit: 4, leaseMs: HOUR, nowMs: 0 }),
      secondAttempts.claim({ owner: 'worker-b', limit: 4, leaseMs: HOUR, nowMs: 0 }),
    ]);

    // Assert
    expect(duplicate.map((result) => result.status).sort()).toEqual(['created', 'replay']);
    expect(digestConflict).toEqual({ status: 'conflict' });
    const firstIds = new Set(firstClaims.map((attempt) => attempt.attemptId));
    const secondIds = new Set(secondClaims.map((attempt) => attempt.attemptId));
    expect(firstClaims).toHaveLength(4);
    expect(secondClaims).toHaveLength(4);
    expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(8);
    const wrongProof = await firstAttempts.getStatus({
      attemptId: firstInput.attemptId,
      capabilityHash: hash(999_004),
    });
    const cancelled = await secondAttempts.cancelByCapability({
      capabilityHash,
      reasonCode: 'capability_revoked',
      nowMs: Date.now(),
      limit: 8,
    });
    expect(wrongProof).toBeNull();
    expect(cancelled).toBe(8);
    expect((await firstAttempts.stats(Date.now())).cancelled).toBe(8);

    await firstPool.query(
      `UPDATE ops.idempotency_results
       SET expires_at = clock_timestamp() - interval '1 second'
       WHERE scope = 'push.attempt.enqueue' AND idempotency_key = $1`,
      [firstInput.idempotencyKey],
    );
    const reuseNow = Date.now();
    const reusedAfterExpiry = await firstAttempts.enqueue({
      ...firstInput,
      attemptId: attemptId(9),
      requestDigestHex: hash(999_005),
      nowMs: reuseNow,
      idempotencyExpiresAtMs: reuseNow + DAY,
    });
    expect(reusedAfterExpiry.status).toBe('created');
  });

  it('fences reclaimed workers, uses DB retry time, and never claims delivery', async () => {
    // Arrange
    const { capabilityHash } = await registerWithCapability(4);
    const input = {
      ...idempotency(40_001),
      attemptId: attemptId(20),
      capabilityHash,
      provider: 'apns' as const,
      tokenGeneration: 1,
    };
    await firstAttempts.enqueue(input);
    const [original] = await firstAttempts.claim({
      owner: 'old-worker', limit: 1, leaseMs: HOUR, nowMs: 0,
    });
    const renewed = await firstAttempts.renew({
      attemptId: input.attemptId,
      owner: 'old-worker',
      fencingToken: original!.fencingToken,
      leaseMs: HOUR,
      nowMs: 0,
    });
    await firstPool.query(
      `UPDATE push.attempts SET leased_until = clock_timestamp() - interval '1 second'
       WHERE attempt_id = $1::uuid`,
      [input.attemptId],
    );

    // Act
    const [replacement] = await secondAttempts.claim({
      owner: 'new-worker', limit: 1, leaseMs: HOUR, nowMs: 0,
    });
    const stale = await firstAttempts.complete({
      attemptId: input.attemptId,
      owner: 'old-worker',
      fencingToken: original!.fencingToken,
      outcome: { state: 'succeeded', providerStatus: 'provider_accepted' },
      nowMs: Date.now(),
    });
    const completed = await secondAttempts.complete({
      attemptId: input.attemptId,
      owner: 'new-worker',
      fencingToken: replacement!.fencingToken,
      outcome: {
        state: 'succeeded',
        providerStatus: 'provider_accepted',
        providerReference: 'provider-request-20',
      },
      nowMs: Date.now(),
    });
    const status = await firstAttempts.getStatus({
      attemptId: input.attemptId,
      capabilityHash,
    });

    // Assert
    expect(renewed.status).toBe('applied');
    expect(replacement!.fencingToken).toBeGreaterThan(original!.fencingToken);
    expect(stale).toEqual({ status: 'stale' });
    expect(completed.status).toBe('applied');
    expect(status).toMatchObject({
      providerStatus: 'provider_accepted',
      providerReference: 'provider-request-20',
      terminal: true,
    });
    expect(JSON.stringify(status)).not.toContain('delivered');

    const retryInput = {
      ...idempotency(40_002),
      attemptId: attemptId(21),
      capabilityHash,
      provider: 'apns' as const,
      tokenGeneration: 1,
    };
    await firstAttempts.enqueue(retryInput);
    const [retryClaim] = await firstAttempts.claim({
      owner: 'retry-worker', limit: 1, leaseMs: HOUR, nowMs: 0,
    });
    await firstAttempts.complete({
      attemptId: retryInput.attemptId,
      owner: 'retry-worker',
      fencingToken: retryClaim!.fencingToken,
      outcome: {
        state: 'retryable', providerStatus: 'unknown',
        errorCode: 'provider_timeout', retryAtMs: Date.now() + HOUR,
      },
      nowMs: Date.now(),
    });
    await expect(secondAttempts.claim({
      owner: 'too-early', limit: 1, leaseMs: HOUR, nowMs: Date.now() + 2 * HOUR,
    })).resolves.toEqual([]);
    await firstPool.query(
      `UPDATE push.attempts SET next_attempt_at = clock_timestamp() - interval '1 second'
       WHERE attempt_id = $1::uuid`,
      [retryInput.attemptId],
    );
    const [retried] = await secondAttempts.claim({
      owner: 'retry-worker-2', limit: 1, leaseMs: HOUR, nowMs: 0,
    });
    expect(retried).toMatchObject({
      attemptId: retryInput.attemptId,
      providerStatus: 'pending',
      attemptCount: 2,
    });
  });

  it('keeps pages and retention work bounded while preserving live idempotency', async () => {
    // Arrange
    const { capabilityHash } = await registerWithCapability(5);
    for (let index = 30; index < 34; index += 1) {
      await firstAttempts.enqueue({
        ...idempotency(50_000 + index),
        attemptId: attemptId(index),
        capabilityHash,
        provider: 'apns',
        tokenGeneration: 1,
      });
    }
    const claims = await firstAttempts.claim({
      owner: 'retention-worker', limit: 4, leaseMs: HOUR, nowMs: 0,
    });
    for (const claim of claims) {
      await firstAttempts.complete({
        attemptId: claim.attemptId,
        owner: 'retention-worker',
        fencingToken: claim.fencingToken,
        outcome: { state: 'succeeded', providerStatus: 'provider_accepted' },
        nowMs: Date.now(),
      });
    }
    for (let index = 30; index < 34; index += 1) {
      await firstPool.query(
        `UPDATE push.attempts
         SET created_at = $2::timestamptz
         WHERE attempt_id = $1::uuid`,
        [attemptId(index), `2026-07-10T12:00:00.123${index - 30}00Z`],
      );
    }
    const exactOrder = await firstPool.query<{ attempt_id: string; created_at: string }>(
      `SELECT attempt_id::text AS attempt_id,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
       FROM push.attempts ORDER BY created_at DESC, attempt_id DESC`,
    );
    const firstPage = await firstAttempts.list({ limit: 2 });
    const secondPage = await secondAttempts.list({ limit: 2, before: firstPage.nextCursor! });
    await firstPool.query(
      `UPDATE ops.idempotency_results
       SET expires_at = clock_timestamp() - interval '1 second'
       WHERE scope = 'push.attempt.enqueue'`,
    );

    // Act
    const nowMs = Date.now() + 1_000;
    const pruned = await secondAttempts.prune({
      nowMs,
      completedBeforeMs: nowMs,
      idempotencyRetainedUntilMs: nowMs,
      limit: 2,
    });
    const secondPrune = await secondAttempts.prune({
      nowMs,
      completedBeforeMs: nowMs,
      idempotencyRetainedUntilMs: nowMs,
      limit: 2,
    });
    const thirdPrune = await secondAttempts.prune({
      nowMs,
      completedBeforeMs: nowMs,
      idempotencyRetainedUntilMs: nowMs,
      limit: 2,
    });
    const stats = await firstAttempts.stats(Date.now());

    // Assert
    expect(exactOrder.rows).toEqual([
      { attempt_id: attemptId(33), created_at: '2026-07-10T12:00:00.123300Z' },
      { attempt_id: attemptId(32), created_at: '2026-07-10T12:00:00.123200Z' },
      { attempt_id: attemptId(31), created_at: '2026-07-10T12:00:00.123100Z' },
      { attempt_id: attemptId(30), created_at: '2026-07-10T12:00:00.123000Z' },
    ]);
    expect([...firstPage.records, ...secondPage.records]
      .map((attempt) => attempt.attemptId)).toEqual([
        attemptId(33), attemptId(32), attemptId(31), attemptId(30),
      ]);
    expect(firstPage.records[0]?.createdAt).toMatch(/\.\d{6}Z$/u);
    expect(pruned.attempts + pruned.idempotencyRecords).toBeLessThanOrEqual(2);
    expect(secondPrune.attempts + secondPrune.idempotencyRecords).toBeLessThanOrEqual(2);
    expect(thirdPrune.attempts).toBe(2);
    expect(stats.total).toBe(2);
  });
});
