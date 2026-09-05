/**
 * Plan 51 P1: PostgreSQL account-store + credential-bridge integration tests.
 *
 * Guarded by MEERKAT_TEST_POSTGRES_URL (+ MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS)
 * like persona-registry-store.integration.test.ts. Proves against a real database:
 *  - the one-per-epoch quota conflict (INSERT ... ON CONFLICT DO NOTHING rowCount);
 *  - account deletion cascades entitlements + issuance rows (FK ON DELETE CASCADE);
 *  - credential.revocations idempotency (a repeated revoke is already_revoked).
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresAccountStore } from '../stores/account-store';
import { PostgresCredentialBridgeStore } from '../stores/credential-bridge-store';
import type { AccountRecord } from '../../account-store';
import { AccountService } from '../../account-service';
import { credentialEpochWindow, finalizeBlindCredential, prepareBlindCredentialRequest, verifyBlindCredential } from '@mylife/sync';
import { generateEpochKeyPair, sealEpochPrivateKey } from '../../blind-credential-server';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTestEnabled = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString ? describe.sequential : describe.skip;

function requireAccount(account: AccountRecord | null): AccountRecord {
  if (!account) throw new Error('account setup was unexpectedly blocked');
  return account;
}

describePostgres('PostgresAccountStore + PostgresCredentialBridgeStore integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_account_${suffix}`;
  let adminPool: Pool | undefined;
  let pool: Pool | undefined;
  let accountStore: PostgresAccountStore;
  let bridgeStore: PostgresCredentialBridgeStore;
  let legacyAccountId: string;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    const currentName = current.rows[0]?.name ?? '';
    if (!destructiveTestEnabled || !/^meerkat_(?:ci|test)(?:_|$)/u.test(currentName)) {
      throw new Error(
        'Destructive PostgreSQL integration tests require MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS=true and a meerkat_ci or meerkat_test database',
      );
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-account-integration',
      max: 2,
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool, { targetVersion: 19 });
    const legacy = await pool.query<{ account_id: string }>(
      "INSERT INTO account.accounts (provider, provider_subject, created_day) VALUES ('apple', $1, '2026-09-01') RETURNING account_id",
      [`legacy-${suffix}`],
    );
    legacyAccountId = legacy.rows[0]!.account_id;
    await pool.query(
      "INSERT INTO account.credential_issuance (account_id, epoch, issued_day) VALUES ($1, 0, '2026-08-01'), ($1, 2, '2026-09-01')",
      [legacyAccountId],
    );
    await runPostgresMigrations(pool);
    const context = new PostgresStoreContext(pool);
    accountStore = new PostgresAccountStore(context);
    bridgeStore = new PostgresCredentialBridgeStore(context);
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  const nowMs = Date.UTC(2026, 8, 1);

  it('backfills the latest active issuance when upgrading schema 19 to 20', async () => {
    expect((await accountStore.getAccountById(legacyAccountId))?.latestIssuedEpoch).toBe(2);
    expect(await accountStore.recordIssuance(legacyAccountId, 3, nowMs)).toBe('already_issued');
    expect(await accountStore.recordIssuance(legacyAccountId, 3, nowMs, 0)).toBe('already_issued');
    expect(await accountStore.recordIssuance(legacyAccountId, 3, nowMs, 2)).toBe('recorded');
  });

  it('upserts an account idempotently by (provider, subject)', async () => {
    const first = requireAccount(await accountStore.upsertAccount({ provider: 'apple', providerSubject: `sub-${suffix}-1`, nowMs }));
    const second = requireAccount(await accountStore.upsertAccount({ provider: 'apple', providerSubject: `sub-${suffix}-1`, relayEmail: 'r@relay.test', nowMs }));
    expect(second.accountId).toBe(first.accountId);
    expect(second.relayEmail).toBe('r@relay.test'); // filled in on the later sign-in
    expect(second.humanVerifiedAt).toBeTruthy();
  });

  it('enforces the one-per-epoch quota via recordIssuance conflict', async () => {
    const account = requireAccount(await accountStore.upsertAccount({ provider: 'google', providerSubject: `sub-${suffix}-2`, nowMs }));
    expect(await accountStore.recordIssuance(account.accountId, 3, nowMs)).toBe('recorded');
    expect(await accountStore.recordIssuance(account.accountId, 3, nowMs)).toBe('already_issued');
    // An epoch transition must name the latest issuance, atomically.
    expect(await accountStore.recordIssuance(account.accountId, 4, nowMs)).toBe('already_issued');
    expect(await accountStore.recordIssuance(account.accountId, 4, nowMs, 3)).toBe('recorded');
  });

  it('cascades entitlements and issuance rows on account deletion', async () => {
    const providerSubject = `sub-${suffix}-3`;
    const account = requireAccount(await accountStore.upsertAccount({ provider: 'apple', providerSubject, nowMs }));
    await accountStore.recordEntitlement({ accountId: account.accountId, product: 'app_unlock', rail: 'apple', status: 'active', nowMs });
    await accountStore.recordIssuance(account.accountId, 5, nowMs);
    expect((await accountStore.getEntitlements(account.accountId)).length).toBe(1);

    await accountStore.deleteAccount({
      accountId: account.accountId,
      provider: 'apple',
      providerSubject,
      recreateAfterMs: nowMs + 60_000,
    });
    expect(await accountStore.getAccountById(account.accountId)).toBeNull();
    expect(await accountStore.getEntitlements(account.accountId)).toEqual([]);
    // The (account, epoch) issuance row cascaded away with the account. Prove it
    // by row absence: re-inserting via recordIssuance would (correctly) violate
    // the accounts FK, because issuance rows cannot exist without their account.
    const orphanIssuance = await pool!.query(
      'SELECT 1 FROM account.credential_issuance WHERE account_id = $1',
      [account.accountId],
    );
    expect(orphanIssuance.rows).toEqual([]);
    expect(await accountStore.upsertAccount({ provider: 'apple', providerSubject, nowMs })).toBeNull();
    const recreated = requireAccount(await accountStore.upsertAccount({ provider: 'apple', providerSubject, nowMs: nowMs + 60_000 }));
    expect(recreated.latestIssuedEpoch).toBe(5);
    expect(await accountStore.recordIssuance(recreated.accountId, 6, nowMs)).toBe('already_issued');
    expect(await accountStore.recordIssuance(recreated.accountId, 6, nowMs, 5)).toBe('recorded');
  });

  it('serializes different initial epochs across concurrent callers', async () => {
    const account = requireAccount(await accountStore.upsertAccount({ provider: 'apple', providerSubject: `continuity-${suffix}`, nowMs }));
    const results = await Promise.all([
      accountStore.recordIssuance(account.accountId, 8, nowMs),
      accountStore.recordIssuance(account.accountId, 9, nowMs),
    ]);
    expect(results.filter((result) => result === 'recorded')).toHaveLength(1);
  });

  it('replays only an identical blinded request without another quota row', async () => {
    const account = requireAccount(await accountStore.upsertAccount({ provider: 'apple', providerSubject: `replay-${suffix}`, nowMs }));
    const hash = 'a'.repeat(64);
    expect(await accountStore.recordIssuance(account.accountId, 3, nowMs, null, hash)).toBe('recorded');
    expect(await accountStore.recordIssuance(account.accountId, 3, nowMs, null, hash)).toBe('recorded');
    expect(await accountStore.recordIssuance(account.accountId, 3, nowMs, null, 'b'.repeat(64))).toBe('already_issued');
    const rows = await pool!.query('SELECT epoch FROM account.credential_issuance WHERE account_id = $1', [account.accountId]);
    expect(rows.rows).toEqual([{ epoch: 3 }]);
  });

  it('seals + reads an epoch signing key (idempotent put)', async () => {
    await accountStore.putSealedEpochKey(7, 'v1:sealed-a');
    await accountStore.putSealedEpochKey(7, 'v1:sealed-b'); // no-op; first write wins
    expect(await accountStore.getSealedEpochKey(7)).toBe('v1:sealed-a');
    expect(await accountStore.getSealedEpochKey(999)).toBeNull();
  });

  it('publishes an epoch key and revokes a serial idempotently on the bridge', async () => {
    const serial = 'a1'.repeat(32);
    await bridgeStore.publishEpochKey(9, 'PUBLIC-KEY-BASE64', nowMs, nowMs + 30 * 24 * 60 * 60 * 1000);
    expect(await bridgeStore.getEpochPublicKey(9)).toBe('PUBLIC-KEY-BASE64');
    expect(await bridgeStore.revokeSerial(serial, 9, 'operator_action')).toBe('revoked');
    expect(await bridgeStore.revokeSerial(serial, 9, 'operator_action')).toBe('already_revoked');
    expect(await bridgeStore.isSerialRevoked(serial)).toBe(true);
    expect(await bridgeStore.isSerialRevoked('b2'.repeat(32))).toBe(false);
  });

  it('equal target/predecessor cannot allocate a pass and only replays the matching account request', async () => {
    const account = requireAccount(await accountStore.upsertAccount({ provider: 'apple', providerSubject: `recover-only-${suffix}`, nowMs }));
    const hash = 'c'.repeat(64);
    expect(await accountStore.recordIssuance(account.accountId, 1, nowMs, 1, hash)).toBe('already_issued');
    expect(await accountStore.recordIssuance(account.accountId, 1, nowMs, null, hash)).toBe('recorded');
    expect(await accountStore.recordIssuance(account.accountId, 1, nowMs, 1, hash)).toBe('recorded');
    expect(await accountStore.recordIssuance(account.accountId, 1, nowMs, 1, 'd'.repeat(64))).toBe('already_issued');
    expect(await accountStore.recordIssuance(account.accountId, 2, nowMs, 2, hash)).toBe('already_issued');
    const count = await pool!.query<{ count: string }>('SELECT count(*) FROM account.credential_issuance WHERE account_id = $1', [account.accountId]);
    expect(Number(count.rows[0]!.count)).toBe(1);
  });

  it('independent issuer workers use the durable PostgreSQL epoch key winner', async () => {
    const epoch = 4;
    const issuerNow = credentialEpochWindow(epoch).notBeforeMs + 60_000;
    const secret = 'postgres-epoch-key-test-secret';
    let reads = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const workers = Array.from({ length: 2 }, () => {
      const context = new PostgresStoreContext(pool!);
      const store = new PostgresAccountStore(context);
      const racing = new Proxy(store, { get(target, property) {
        if (property === 'getSealedEpochKey') return async (keyEpoch: number) => {
          const key = await target.getSealedEpochKey(keyEpoch);
          if (++reads <= 2) {
            if (reads === 2) release();
            await barrier;
          }
          return key;
        };
        return Reflect.get(target, property);
      } });
      return new AccountService({ accountStore: racing, bridgeStore: new PostgresCredentialBridgeStore(context),
        epochKeySecret: secret, sessionSecret: 'postgres-session-test-secret', now: () => issuerNow,
        ssoVerifier: { verify: async () => ({ ok: true, provider: 'apple', subject: `key-race-${suffix}` }) },
      });
    });
    const keys = await Promise.all(workers.map((worker) => worker.getEpochKey(epoch)));
    expect(keys[0]).toEqual(keys[1]);
    const key = keys[0]!;
    if (!key.ok) throw new Error('key setup failed');
    expect(await bridgeStore.getEpochPublicKey(epoch)).toBe(key.publicKeySpkiDerBase64);
    const signedIn = await workers[1]!.signIn({ provider: 'apple', providerToken: 'fixture' });
    if (!signedIn.ok) throw new Error('sign-in failed');
    await accountStore.recordEntitlement({ accountId: signedIn.accountId, product: 'app_unlock', rail: 'apple', status: 'active', nowMs: issuerNow });
    const request = prepareBlindCredentialRequest(epoch, key.publicKeySpkiDerBase64, (size) => new Uint8Array(randomBytes(size)))!;
    const result = await workers[1]!.issueCredential({ token: signedIn.token, epoch, blindedMessageBase64: request.blindedMessageBase64 });
    if (!result.ok) throw new Error('issuance failed');
    const credential = finalizeBlindCredential(request.state, key.publicKeySpkiDerBase64, result.blindSignatureBase64)!;
    expect(verifyBlindCredential(credential, key.publicKeySpkiDerBase64, issuerNow)).toBe('ok');
  });

  it('recovers publication from the private key already persisted in PostgreSQL', async () => {
    const epoch = 5;
    const secret = 'postgres-recovery-test-secret';
    const pair = generateEpochKeyPair(epoch);
    const sealed = sealEpochPrivateKey(secret, pair.privateKeyPkcs8DerBase64);
    await accountStore.putSealedEpochKey(epoch, sealed);
    const issuer = new AccountService({ accountStore, bridgeStore, epochKeySecret: secret,
      sessionSecret: 'postgres-session-test-secret', now: () => credentialEpochWindow(epoch).notBeforeMs + 60_000,
      ssoVerifier: { verify: async () => ({ ok: false, reason: 'invalid' }) },
    });
    expect(await issuer.getEpochKey(epoch)).toEqual({ ok: true, epoch, publicKeySpkiDerBase64: pair.publicKeySpkiDerBase64 });
    expect(await accountStore.getSealedEpochKey(epoch)).toBe(sealed);
    expect(await bridgeStore.getEpochPublicKey(epoch)).toBe(pair.publicKeySpkiDerBase64);
  });

  it('checks flags, minor restrictions, entitlement status and current expiry in the quota transaction', async () => {
    const clock = { now: nowMs };
    const eligibility = { blockMinorIssuance: true, now: () => clock.now };
    for (const change of ['flag', 'minor', 'revoke', 'expire'] as const) {
      clock.now = nowMs;
      const account = requireAccount(await accountStore.upsertAccount({ provider: 'apple', providerSubject: `eligible-${change}-${suffix}`, nowMs }));
      await accountStore.recordEntitlement({ accountId: account.accountId, product: 'app_unlock', rail: 'apple', status: 'active', validUntil: new Date(nowMs + 1000).toISOString(), nowMs });
      if (change === 'flag') await accountStore.flagRenewal(account.accountId, 'fixture', nowMs);
      if (change === 'minor') await accountStore.setAgeStatus(account.accountId, 'store_minor', 'apple_store');
      if (change === 'revoke') await accountStore.recordEntitlement({ accountId: account.accountId, product: 'app_unlock', rail: 'apple', status: 'revoked', nowMs });
      if (change === 'expire') clock.now += 1000;
      expect(await accountStore.recordIssuance(account.accountId, 1, nowMs, null, 'a'.repeat(64), eligibility)).toBe('already_issued');
      expect((await accountStore.getAccountById(account.accountId))?.latestIssuedEpoch).toBeUndefined();
    }
    clock.now = nowMs;
    const clean = requireAccount(await accountStore.upsertAccount({ provider: 'apple', providerSubject: `eligible-replay-${suffix}`, nowMs }));
    await accountStore.recordEntitlement({ accountId: clean.accountId, product: 'app_unlock', rail: 'apple', status: 'active', nowMs });
    expect(await accountStore.recordIssuance(clean.accountId, 1, nowMs, null, 'b'.repeat(64), eligibility)).toBe('recorded');
    await accountStore.flagRenewal(clean.accountId, 'fixture', nowMs);
    expect(await accountStore.recordIssuance(clean.accountId, 1, nowMs, 1, 'b'.repeat(64), eligibility)).toBe('already_issued');
  });

});
