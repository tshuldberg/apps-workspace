import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import {
  PostgresPushAttemptStore,
  PostgresPushRegistrationStore,
} from '../stores/push-stores';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;
const DAY = 24 * 60 * 60 * 1000;

function hash(index: number): string {
  return index.toString(16).padStart(64, '0');
}

describePostgres('push mixed-version rolling deploy: old writer after full migration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_push_mixed_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;
  let registrations: PostgresPushRegistrationStore;
  let attempts: PostgresPushAttemptStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Push mixed-version tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({
      connectionString: databaseUrl.toString(),
      max: 4,
      statement_timeout: 30_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
      application_name: 'meerkat-push-mixed-version',
    });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool);
    const context = new PostgresStoreContext(pool);
    registrations = new PostgresPushRegistrationStore(context);
    attempts = new PostgresPushAttemptStore(context);
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('preserves an old writer legacy attempt at the raw layer while excluding it from every store path', async () => {
    // An old (pre-v5) writer inserts only the pre-v5 attempt columns after the
    // schema is fully migrated. The row is inspectable at the raw SQL layer
    // (original lookup key, NULL authority, derived idempotency hash,
    // legacy_unbound), but the store adapter excludes it from every public read
    // and never claims it; a new adapter-inserted attempt on the same database
    // remains fully visible and claimable.
    const registrationIdHash = hash(0xa1);
    const registrationSecretHash = hash(0xb2);
    const legacyCapabilityHash = hash(0xc3);
    const legacyIdempotencyKey = 'legacy-device-looking-key-42';
    const legacyAttemptId = randomUUID();
    const nowMs = Date.now();

    await pool.query(
      `INSERT INTO push.registrations (
         registration_id_hash, registration_secret_hash, platform, token_ciphertext,
         token_key_version, token_generation, expires_at
       ) VALUES (decode($1, 'hex'), decode($2, 'hex'), 'apns', decode('abcd', 'hex'), 7, 1,
         clock_timestamp() + interval '30 days')`,
      [registrationIdHash, registrationSecretHash],
    );
    await pool.query(
      `INSERT INTO push.capabilities (capability_hash, registration_id_hash, scope, expires_at)
       VALUES (decode($1, 'hex'), decode($2, 'hex'), 'sync_wake',
         clock_timestamp() + interval '7 days')`,
      [legacyCapabilityHash, registrationIdHash],
    );
    await pool.query(
      `INSERT INTO push.attempts (
         attempt_id, capability_hash, idempotency_key, provider, provider_status, state
       ) VALUES ($1, decode($2, 'hex'), $3, 'apns', 'provider_rejected', 'queued')`,
      [legacyAttemptId, legacyCapabilityHash, legacyIdempotencyKey],
    );

    const raw = await pool.query<{
      registration_id_hash: string | null;
      token_generation: string | null;
      request_digest_bytes: number | null;
      idempotency_key: string;
      idempotency_hash_bytes: number;
      address_binding_state: string;
      provider_status: string;
      completed_at: Date | null;
    }>(
      `SELECT encode(registration_id_hash, 'hex') AS registration_id_hash,
         token_generation, octet_length(request_digest) AS request_digest_bytes,
         idempotency_key, octet_length(idempotency_key_hash) AS idempotency_hash_bytes,
         address_binding_state, provider_status, completed_at
       FROM push.attempts WHERE attempt_id = $1`,
      [legacyAttemptId],
    );
    expect(raw.rows[0]).toMatchObject({
      registration_id_hash: null,
      token_generation: null,
      request_digest_bytes: null,
      idempotency_key: legacyIdempotencyKey,
      idempotency_hash_bytes: 32,
      address_binding_state: 'legacy_unbound',
      provider_status: 'pending',
      completed_at: null,
    });

    expect(await attempts.getStatus({
      attemptId: legacyAttemptId,
      capabilityHash: legacyCapabilityHash,
    })).toBeNull();
    const listedBefore = await attempts.list();
    expect(listedBefore.records).toHaveLength(0);
    const statsBefore = await attempts.stats(nowMs);
    expect(statsBefore).toMatchObject({ queued: 0, total: 0 });

    const boundRegistration = registrationInput();
    const registered = await registrations.register(boundRegistration);
    expect(registered.status).toBe('applied');
    const boundCapabilityHash = hash(0xd4);
    const minted = await registrations.mintCapability({
      idempotencyKey: hash(0x2001),
      requestDigestHex: hash(0x2002),
      idempotencyExpiresAtMs: nowMs + DAY,
      nowMs,
      registrationIdHash: boundRegistration.registrationIdHash,
      registrationSecretHash: boundRegistration.registrationSecretHash,
      capabilityHash: boundCapabilityHash,
      scope: 'sync_wake',
      expiresAtMs: nowMs + 7 * DAY,
    });
    expect(minted.status).toBe('applied');
    const boundAttemptId = randomUUID();
    const enqueued = await attempts.enqueue({
      idempotencyKey: hash(0x3001),
      requestDigestHex: hash(0x3002),
      idempotencyExpiresAtMs: nowMs + DAY,
      nowMs,
      attemptId: boundAttemptId,
      capabilityHash: boundCapabilityHash,
      provider: 'apns',
      tokenGeneration: 1,
    });
    expect(enqueued.status).toBe('created');

    const status = await attempts.getStatus({
      attemptId: boundAttemptId,
      capabilityHash: boundCapabilityHash,
    });
    expect(status).not.toBeNull();
    const listedAfter = await attempts.list();
    expect(listedAfter.records.map((record) => record.attemptId)).toEqual([boundAttemptId]);
    const statsAfter = await attempts.stats(nowMs);
    expect(statsAfter).toMatchObject({ queued: 1, total: 1 });

    const claimed = await attempts.claim({
      owner: 'mixed-version-worker',
      limit: 10,
      leaseMs: DAY,
      nowMs,
    });
    expect(claimed.map((record) => record.attemptId)).toEqual([boundAttemptId]);

    await pool.query(
      `UPDATE push.attempts
       SET next_attempt_at = clock_timestamp() - interval '1 hour',
           leased_until = clock_timestamp() - interval '1 hour'
       WHERE attempt_id = $1::uuid`,
      [boundAttemptId],
    );
    const reclaimed = await attempts.claim({
      owner: 'mixed-version-worker',
      limit: 10,
      leaseMs: DAY,
      nowMs: nowMs + DAY,
    });
    expect(reclaimed.map((record) => record.attemptId)).toEqual([boundAttemptId]);

    const legacyStillRaw = await pool.query<{
      address_binding_state: string;
      idempotency_key: string;
      state: string;
    }>(
      `SELECT address_binding_state, idempotency_key, state
       FROM push.attempts WHERE attempt_id = $1`,
      [legacyAttemptId],
    );
    expect(legacyStillRaw.rows[0]).toEqual({
      address_binding_state: 'legacy_unbound',
      idempotency_key: legacyIdempotencyKey,
      state: 'queued',
    });
  });

  function registrationInput() {
    const nowMs = Date.now();
    return {
      idempotencyKey: hash(0x1001),
      requestDigestHex: hash(0x1002),
      idempotencyExpiresAtMs: nowMs + DAY,
      nowMs,
      registrationIdHash: hash(0xe5),
      registrationSecretHash: hash(0xf6),
      provider: 'apns' as const,
      encryptedToken: { ciphertext: new Uint8Array([0x80, 0x11, 0xff, 0x22]), keyVersion: 7 },
      tokenGeneration: 1 as const,
      tokenExpiresAtMs: nowMs + 14 * DAY,
      registrationExpiresAtMs: nowMs + 30 * DAY,
    };
  }
});
