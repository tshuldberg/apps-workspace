import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import {
  calculateMigrationChecksum,
  MEERKAT_POSTGRES_MIGRATIONS,
  type MeerkatPostgresMigration,
} from '../migrations';
import { PUSH_LIFECYCLE_SQL } from '../migrations/0005-push-lifecycle';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;

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

describePostgres('push lifecycle v5 migration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_push_migration_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Push migration tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 3 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool, { migrations, targetVersion: 4 });
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('backfills a non-first legacy token generation without fabricating attempt authority', async () => {
    const registrationIdHash = '11'.repeat(32);
    const registrationSecretHash = '22'.repeat(32);
    const capabilityHash = '33'.repeat(32);
    const attemptId = randomUUID();
    await pool.query(
      `INSERT INTO push.registrations (
         registration_id_hash, registration_secret_hash, platform, token_ciphertext,
         token_key_version, token_generation, expires_at
       ) VALUES (decode($1, 'hex'), decode($2, 'hex'), 'apns', decode('abcd', 'hex'), 7, 3,
         clock_timestamp() + interval '30 days')`,
      [registrationIdHash, registrationSecretHash],
    );
    await pool.query(
      `INSERT INTO push.capabilities (capability_hash, registration_id_hash, scope, expires_at)
       VALUES (decode($1, 'hex'), decode($2, 'hex'), 'sync_wake',
         clock_timestamp() + interval '7 days')`,
      [capabilityHash, registrationIdHash],
    );
    await pool.query(
      `INSERT INTO push.attempts (
         attempt_id, capability_hash, idempotency_key, provider, provider_status, state
       ) VALUES ($1, decode($2, 'hex'), 'legacy-device-looking-key', 'apns',
         'provider_rejected', 'queued')`,
      [attemptId, capabilityHash],
    );

    await expect(runPostgresMigrations(pool, { migrations, targetVersion: 5 })).resolves.toEqual({
      previousVersion: 4,
      currentVersion: 5,
      appliedVersions: [5],
    });
    const token = await pool.query<{
      token_generation: string;
      state: string;
    }>(
      `SELECT token_generation, state FROM push.registration_tokens
       WHERE registration_id_hash = decode($1, 'hex')`,
      [registrationIdHash],
    );
    expect(token.rows[0]).toEqual({ token_generation: '3', state: 'active' });
    const attempt = await pool.query<{
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
      [attemptId],
    );
    expect(attempt.rows[0]).toMatchObject({
      registration_id_hash: null,
      token_generation: null,
      request_digest_bytes: null,
      idempotency_key: 'legacy-device-looking-key',
      idempotency_hash_bytes: 32,
      address_binding_state: 'legacy_unbound',
      provider_status: 'pending',
      completed_at: null,
    });

    const defaultState = await pool.query<{ column_default: string | null }>(
      `SELECT column_default FROM information_schema.columns
       WHERE table_schema = 'push' AND table_name = 'attempts'
         AND column_name = 'token_generation'`,
    );
    expect(defaultState.rows[0]?.column_default).toBeNull();
    await expect(pool.query(
      `INSERT INTO push.registration_tokens (
         registration_id_hash, token_generation, token_ciphertext, token_key_version,
         state, expires_at
       ) VALUES (decode($1, 'hex'), 4, decode('cafe', 'hex'), 8, 'active',
         clock_timestamp() + interval '30 days')`,
      [registrationIdHash],
    )).rejects.toMatchObject({ code: '23505' });
  });
});
