import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresHumanityStore } from '../stores/humanity-store';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTestEnabled = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString ? describe.sequential : describe.skip;

describePostgres('PostgresHumanityStore multi-instance integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_humanity_${suffix}`;
  let adminPool: Pool | undefined;
  let firstPool: Pool | undefined;
  let secondPool: Pool | undefined;
  let first: PostgresHumanityStore;
  let second: PostgresHumanityStore;

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
    firstPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-humanity-integration-a',
      max: 2,
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-humanity-integration-b',
      max: 2,
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool);
    first = new PostgresHumanityStore(new PostgresStoreContext(firstPool));
    second = new PostgresHumanityStore(new PostgresStoreContext(secondPool));
  });

  afterAll(async () => {
    await firstPool?.end().catch(() => undefined);
    await secondPool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('lets one database instance consume a challenge and preserves the expiry reason', async () => {
    const now = Date.now();
    const id = `challenge-${randomUUID()}`;
    const challenge = {
      kind: 'turnstile' as const,
      nonce: randomUUID(),
      issuedAt: new Date(now).toISOString(),
      expiresAtMs: now + 60_000,
    };
    await first.putChallenge(id, challenge);

    const results = await Promise.all([
      first.consumeChallenge(id, now),
      second.consumeChallenge(id, now),
    ]);
    expect(results.filter((result) => result !== null)).toHaveLength(1);
    expect(results.find((result) => result !== null)).toEqual({ challenge, expired: false });

    const expiredId = `challenge-${randomUUID()}`;
    const expired = {
      ...challenge,
      issuedAt: new Date(now - 120_000).toISOString(),
      expiresAtMs: now - 60_000,
    };
    await first.putChallenge(expiredId, expired);
    // The supplied local time deliberately says "not expired". PostgreSQL time is
    // authoritative and must still classify the consumed challenge as expired.
    await expect(second.consumeChallenge(expiredId, 0)).resolves.toEqual({
      challenge: expired,
      expired: true,
    });
  });

  it('lets one database instance consume the final daily issuance allowance', async () => {
    const keyHash = randomUUID().replaceAll('-', '').padEnd(64, '0');
    const dayBucket = Math.floor(Date.now() / 86_400_000);
    await expect(first.tryIncrementIssuanceCount(keyHash, dayBucket, 2)).resolves.toBe(true);

    const results = await Promise.all(Array.from(
      { length: 20 },
      (_, index) => (index % 2 === 0 ? first : second)
        .tryIncrementIssuanceCount(keyHash, dayBucket, 2),
    ));

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(second.getIssuanceCount(keyHash, dayBucket)).resolves.toBe(2);
  });

  it('lets one database instance spend a token hash', async () => {
    const tokenHash = randomUUID().replaceAll('-', '').padEnd(64, 'a');
    const expiresAtMs = Date.now() + 60_000;
    const results = await Promise.all(Array.from(
      { length: 20 },
      (_, index) => (index % 2 === 0 ? first : second).trySpend(tokenHash, expiresAtMs),
    ));

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(first.isSpent(tokenHash)).resolves.toBe(true);
  });

  it('atomically replays registration redemption across database instances', async () => {
    const input = {
      attemptId: randomUUID().replaceAll('-', '').padEnd(64, 'a'),
      requestDigest: randomUUID().replaceAll('-', '').padEnd(64, 'b'),
      tokenHash: randomUUID().replaceAll('-', '').padEnd(64, 'c'),
      expiresAtMs: Date.now() + 60_000,
      allowCreate: true,
    };
    const outcomes = await Promise.all(Array.from(
      { length: 20 },
      (_, index) => (index % 2 === 0 ? first : second).redeemRegistrationAttempt(input),
    ));
    expect(outcomes.filter((outcome) => outcome === 'spent')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === 'replayed')).toHaveLength(19);

    const differentTokenHash = randomUUID().replaceAll('-', '').padEnd(64, 'd');
    await expect(second.redeemRegistrationAttempt({
      ...input,
      requestDigest: randomUUID().replaceAll('-', '').padEnd(64, 'e'),
      tokenHash: differentTokenHash,
    })).resolves.toBe('attempt_conflict');
    await expect(first.isSpent(differentTokenHash)).resolves.toBe(false);
    await expect(second.redeemRegistrationAttempt({ ...input, allowCreate: false }))
      .resolves.toBe('replayed');

    const receipt = await firstPool!.query<{ result: { ok: boolean } }>(
      'SELECT result FROM humanity.registration_redemptions WHERE attempt_id = $1',
      [input.attemptId],
    );
    expect(receipt.rows).toEqual([{ result: { ok: true } }]);
  });

  it('uses database time for pruning and rejects corrupt JSON projections', async () => {
    const tokenHash = randomUUID().replaceAll('-', '').padEnd(64, 'b');
    await firstPool!.query(
      `INSERT INTO humanity.spent_tokens (token_hash, expires_at)
       VALUES ($1, clock_timestamp() + interval '100 milliseconds')`,
      [tokenHash],
    );
    await firstPool!.query('SELECT pg_sleep(0.15)');
    await first.prune(Number.MIN_SAFE_INTEGER);
    await expect(second.isSpent(tokenHash)).resolves.toBe(false);

    const corruptId = `challenge-${randomUUID()}`;
    await firstPool!.query(
      `INSERT INTO humanity.challenges (
         challenge_id, kind, nonce, issued_at, expires_at, payload
       ) VALUES ($1, 'turnstile', 'nonce', clock_timestamp(), clock_timestamp() + interval '1 minute', '{}')`,
      [corruptId],
    );
    await expect(first.getChallenge(corruptId)).rejects.toThrow(/columns and payload do not match/u);
  });
});
