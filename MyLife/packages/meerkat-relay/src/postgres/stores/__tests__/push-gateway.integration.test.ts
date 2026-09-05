/**
 * Live-PostgreSQL push gateway integration (Plan 42 P4).
 *
 * Env-gated (MEERKAT_TEST_POSTGRES_URL + MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS).
 * Drives ONE wake end to end through PushGatewayService over the REAL PostgreSQL push
 * stores (registration, token, capability, attempt) and a FakeProviderAdapter: register
 * an install (token encrypted via the AES-256-GCM keyring), mint a capability, enqueue a
 * wake, run the fenced drain, and assert the attempt reached provider_accepted with the
 * opaque payload forwarded verbatim and no plaintext in the stored rows (NC-42.3).
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../../migrate';
import {
  calculateMigrationChecksum,
  MEERKAT_POSTGRES_MIGRATIONS,
  type MeerkatPostgresMigration,
} from '../../migrations';
import { PUSH_LIFECYCLE_SQL } from '../../migrations/0005-push-lifecycle';
import { PostgresStoreContext } from '../../store-context';
import { PostgresPushAttemptStore, PostgresPushRegistrationStore } from '../push-stores';
import { AesGcmPushTokenCipher } from '../../../push-token-cipher';
import { FakeProviderAdapter } from '../../../push-providers';
import { PushGatewayService, randomToken } from '../../../push-gateway';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;
const DAY = 24 * 60 * 60 * 1000;

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

describePostgres('push gateway over live PostgreSQL push stores', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_push_gateway_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;
  let gateway: PushGatewayService;
  let adapter: FakeProviderAdapter;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Push gateway integration requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 4, application_name: 'meerkat-push-gateway-integration' });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool, { migrations, targetVersion: 5 });
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE push.attempts, push.registration_tokens,
        push.capabilities, push.registrations, ops.idempotency_results
    `);
    const context = new PostgresStoreContext(pool);
    adapter = new FakeProviderAdapter({ provider: 'apns', outcomes: [{ kind: 'accepted', providerReference: 'apns-live-1' }] });
    gateway = new PushGatewayService({
      registrations: new PostgresPushRegistrationStore(context),
      attempts: new PostgresPushAttemptStore(context),
      cipher: new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: randomBytes(32) }], activeVersion: 1 }),
      adapters: { apns: adapter },
    });
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('drives one wake to provider_accepted through the real stores', async () => {
    const registrationId = randomToken();
    const registrationSecret = randomToken();
    const providerToken = 'a'.repeat(64);
    const registered = await gateway.registerInstallation({
      registrationId, registrationSecret, provider: 'apns', providerToken,
      tokenTtlMs: 14 * DAY, registrationTtlMs: 30 * DAY, idempotencyKey: randomUUID(),
    });
    expect(registered.status).toBe('ok');

    const capability = randomToken();
    const minted = await gateway.mintCapability({
      registrationId, registrationSecret, capability, scope: 'sync_wake', ttlMs: 7 * DAY, idempotencyKey: randomUUID(),
    });
    expect(minted.status).toBe('ok');

    const payload = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
    const wake = await gateway.enqueueWake({
      capability, scope: 'sync_wake', payload, urgency: 'high', idempotencyKey: randomUUID(),
    });
    expect(wake.status).toBe('accepted');
    const attemptId = wake.status === 'accepted' ? wake.attemptId : '';

    const processed = await gateway.drainOnce();
    expect(processed).toBe(1);
    // The adapter received the decrypted provider token and the opaque payload verbatim.
    expect(adapter.calls[0]?.token).toBe(providerToken);
    expect([...adapter.calls[0]!.payload]).toEqual([...payload]);

    const status = await gateway.getAttemptStatus({ attemptId, capability });
    expect(status?.providerStatus).toBe('provider_accepted');
    expect(status?.terminal).toBe(true);

    // NC-42.3: the persisted attempt row carries no plaintext token, no payload, and
    // no capability plaintext - only hashes and provider metadata.
    const rows = await pool.query<{ provider_reference: string | null; capability_hash: Buffer }>(
      `SELECT provider_reference, capability_hash FROM push.attempts WHERE attempt_id = $1`,
      [attemptId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.provider_reference).toBe('apns-live-1');
    const dump = JSON.stringify(rows.rows[0]);
    expect(dump).not.toContain(providerToken);
    expect(dump).not.toContain(capability);
    expect(dump).not.toContain('cafebabe');
  });

  it('reports provider_rejected and invalidates the token on an unregistered rejection', async () => {
    adapter = new FakeProviderAdapter({ provider: 'apns', outcomes: [{ kind: 'rejected', reasonClass: 'token_unregistered' }] });
    const context = new PostgresStoreContext(pool);
    gateway = new PushGatewayService({
      registrations: new PostgresPushRegistrationStore(context),
      attempts: new PostgresPushAttemptStore(context),
      cipher: new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: randomBytes(32) }], activeVersion: 1 }),
      adapters: { apns: adapter },
    });
    const registrationId = randomToken();
    const registrationSecret = randomToken();
    await gateway.registerInstallation({
      registrationId, registrationSecret, provider: 'apns', providerToken: 'b'.repeat(64),
      tokenTtlMs: 14 * DAY, registrationTtlMs: 30 * DAY, idempotencyKey: randomUUID(),
    });
    const capability = randomToken();
    await gateway.mintCapability({
      registrationId, registrationSecret, capability, scope: 'sync_wake', ttlMs: 7 * DAY, idempotencyKey: randomUUID(),
    });
    const wake = await gateway.enqueueWake({
      capability, scope: 'sync_wake', payload: new Uint8Array([1]), urgency: 'high', idempotencyKey: randomUUID(),
    });
    const attemptId = wake.status === 'accepted' ? wake.attemptId : '';
    await gateway.drainOnce();

    const status = await gateway.getAttemptStatus({ attemptId, capability });
    expect(status?.providerStatus).toBe('provider_rejected');
    // The token generation is now invalidated in the store.
    const tokens = await pool.query<{ state: string }>(
      `SELECT state FROM push.registration_tokens WHERE token_generation = 1`,
    );
    expect(tokens.rows.every((row) => row.state === 'invalidated')).toBe(true);
  });
});
