import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTestEnabled = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString ? describe.sequential : describe.skip;

describePostgres('registration saga migration v3 to v4', () => {
  const databaseName = `meerkat_test_saga_upgrade_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  let adminPool: Pool | undefined;
  let pool: Pool | undefined;

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
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 2 });
    pool.on('error', () => undefined);
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('adds replay and saga tables without rewriting existing identity state', async () => {
    await expect(runPostgresMigrations(pool!, { targetVersion: 3 })).resolves.toMatchObject({
      currentVersion: 3,
      appliedVersions: [1, 2, 3],
    });
    const tokenHash = 'a'.repeat(64);
    const personaPubkey = 'b'.repeat(64);
    await pool!.query(
      `INSERT INTO humanity.spent_tokens (token_hash, expires_at)
       VALUES ($1, clock_timestamp() + interval '1 day')`,
      [tokenHash],
    );
    await pool!.query(
      `INSERT INTO persona.records (alias, persona_pubkey, created_at, payload)
       VALUES ('upgradeuser', $1, clock_timestamp(), '{}')`,
      [personaPubkey],
    );

    await expect(runPostgresMigrations(pool!, { targetVersion: 4 })).resolves.toEqual({
      previousVersion: 3,
      currentVersion: 4,
      appliedVersions: [4],
    });
    const state = await pool!.query<{
      spent: string;
      personas: string;
      redemptions: string;
      attempts: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM humanity.spent_tokens) AS spent,
         (SELECT count(*)::text FROM persona.records) AS personas,
         to_regclass('humanity.registration_redemptions')::text AS redemptions,
         to_regclass('persona.registration_attempts')::text AS attempts`,
    );
    expect(state.rows[0]).toEqual({
      spent: '1',
      personas: '1',
      redemptions: 'humanity.registration_redemptions',
      attempts: 'persona.registration_attempts',
    });
  });
});
