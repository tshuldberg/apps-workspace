import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../../postgres/migrate';
import { PostgresStoreContext } from '../../postgres/store-context';
import { PostgresPublicPostStore } from '../../postgres/stores/community-stores';
import { FilePublicPostStore } from '../../public-post-store-file';
import { fileEnumerator, postgresEnumerator } from '..';
import { importStore, isNonImportable } from '../importers';
import { computeStoreDigest, compareDigests } from '../digest';
import type { StateServiceRoots } from '../enumerate-file';

/**
 * WP-3D security-critical guarantee: a persona blocked in file mode must STILL be
 * blocked after the block list is imported into PostgreSQL. The file adapter keeps
 * only sha256(lower(pubkey)); migration 9 made that hash the PostgreSQL enforcement
 * key, so the block imports as a hash-only row and enforcement (which hashes the
 * incoming pubkey) still refuses the persona. A cutover must NEVER silently unblock.
 */

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests ? describe.sequential : describe.skip;

const PUBKEY = 'a'.repeat(64);
const hashOf = (pubkey: string) => createHash('sha256').update(pubkey.toLowerCase(), 'utf8').digest('hex');

describePostgres('blocked-persona cutover (WP-3D)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_blocked_persona_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;
  let database: PostgresStoreContext;
  let root: string;
  let roots: StateServiceRoots;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('WP-3D test requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: url.toString(), max: 4, statement_timeout: 30_000 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool);
    database = new PostgresStoreContext(pool);
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-wp3d-'));
    roots = { community: path.join(root, 'community') };
  });

  afterAll(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true });
    if (pool) await pool.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE community.blocked_personas RESTART IDENTITY');
    await pool.query('TRUNCATE TABLE ops.idempotency_results RESTART IDENTITY');
  });

  it('blocked-personas is no longer non-importable', () => {
    expect(isNonImportable('community.blocked-personas')).toBe(false);
  });

  it('a file-mode block stays enforced after import (never silently unblocked)', async () => {
    // Block the persona through the REAL file adapter (writes only the sha256 marker).
    const fileStore = new FilePublicPostStore(path.join(root, 'community', 'public-posts'));
    await fileStore.blockPersona(PUBKEY);
    expect(await fileStore.isPersonaBlocked(PUBKEY)).toBe(true);

    // Import the block list into PostgreSQL.
    const result = await importStore(
      database, fileEnumerator('community.blocked-personas', roots), { owner: 'wp3d@test' });
    expect(result.nonImportable).toBe(false);
    expect(result.imported).toBe(1);

    // Enforcement in PostgreSQL still refuses the persona, hashing the raw pubkey to the key.
    const pgStore = new PostgresPublicPostStore(database);
    expect(await pgStore.isPersonaBlocked(PUBKEY)).toBe(true);

    // The imported row is hash-only (raw pubkey unknown from a one-way marker).
    const row = await pool.query<{ persona_pubkey: string | null; persona_pubkey_hash: string }>(
      'SELECT persona_pubkey, persona_pubkey_hash FROM community.blocked_personas');
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]!.persona_pubkey).toBeNull();
    expect(row.rows[0]!.persona_pubkey_hash).toBe(hashOf(PUBKEY));
  });

  it('a runtime block and an imported block converge on the same hash key', async () => {
    const pgStore = new PostgresPublicPostStore(database);
    // Runtime block writes both the raw pubkey and the hash.
    await pgStore.blockPersona(PUBKEY);
    const afterRuntime = await pool.query<{ persona_pubkey: string | null }>(
      'SELECT persona_pubkey FROM community.blocked_personas WHERE persona_pubkey_hash = $1', [hashOf(PUBKEY)]);
    expect(afterRuntime.rows[0]!.persona_pubkey).toBe(PUBKEY);

    // Re-importing the same block (hash-only) must NOT duplicate; the hash is the conflict key.
    const fileStore = new FilePublicPostStore(path.join(root, 'community', 'public-posts'));
    await fileStore.blockPersona(PUBKEY);
    await importStore(database, fileEnumerator('community.blocked-personas', roots), { owner: 'wp3d@test' });
    const count = await pool.query<{ n: string }>('SELECT count(*) AS n FROM community.blocked_personas');
    expect(Number(count.rows[0]!.n)).toBe(1);
    expect(await pgStore.isPersonaBlocked(PUBKEY)).toBe(true);
  });

  it('digest-compares identical across backends for the block list', async () => {
    const fileStore = new FilePublicPostStore(path.join(root, 'community', 'public-posts'));
    await fileStore.blockPersona(PUBKEY);
    await fileStore.blockPersona('b'.repeat(64));
    await importStore(database, fileEnumerator('community.blocked-personas', roots), { owner: 'wp3d@test' });

    const source = await computeStoreDigest(fileEnumerator('community.blocked-personas', roots), 'file');
    const target = await computeStoreDigest(
      postgresEnumerator('community.blocked-personas', database), 'postgres');
    const verdict = compareDigests('community.blocked-personas', source, target);
    expect(verdict.status).toBe('identical');
    expect(verdict.sourceCount).toBe(2);
  });

  it('a mutation of the target block list is detected by the digest gate', async () => {
    const fileStore = new FilePublicPostStore(path.join(root, 'community', 'public-posts'));
    await fileStore.blockPersona(PUBKEY);
    await importStore(database, fileEnumerator('community.blocked-personas', roots), { owner: 'wp3d@test' });

    // Simulate a silent unblock in the target: the digest MUST catch it.
    await pool.query('DELETE FROM community.blocked_personas');
    const source = await computeStoreDigest(fileEnumerator('community.blocked-personas', roots), 'file');
    const target = await computeStoreDigest(
      postgresEnumerator('community.blocked-personas', database), 'postgres');
    const verdict = compareDigests('community.blocked-personas', source, target);
    expect(verdict.status).toBe('missing_in_target');
    expect(verdict.missingInTarget).toContain(`64:${hashOf(PUBKEY)}`);
  });
});

describePostgres('blocked-persona migration 9 backfill (WP-3D)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_blocked_backfill_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('WP-3D backfill test requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: url.toString(), max: 4, statement_timeout: 30_000 });
    pool.on('error', () => undefined);
  });

  afterAll(async () => {
    if (pool) await pool.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  it('backfills persona_pubkey_hash for pre-migration raw-pubkey rows', async () => {
    // Migrate only up to v8 (the pre-WP-3D raw-pubkey schema), seed raw-pubkey blocks the way
    // the old store did, then apply migration 9 and prove every existing block was preserved and
    // hashed to the correct enforcement key (so no production block is dropped by the rekey).
    await runPostgresMigrations(pool, { targetVersion: 8 });
    const pubkeys = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
    for (const pubkey of pubkeys) {
      await pool.query('INSERT INTO community.blocked_personas (persona_pubkey) VALUES ($1)', [pubkey]);
    }

    await runPostgresMigrations(pool);

    // Every prior row kept its raw pubkey AND now carries the correct hash.
    for (const pubkey of pubkeys) {
      const row = await pool.query<{ persona_pubkey: string; persona_pubkey_hash: string }>(
        'SELECT persona_pubkey, persona_pubkey_hash FROM community.blocked_personas WHERE persona_pubkey = $1',
        [pubkey]);
      expect(row.rows).toHaveLength(1);
      expect(row.rows[0]!.persona_pubkey_hash).toBe(hashOf(pubkey));
    }
    // Enforcement by hash finds every backfilled block.
    const store = new PostgresPublicPostStore(new PostgresStoreContext(pool));
    for (const pubkey of pubkeys) {
      expect(await store.isPersonaBlocked(pubkey)).toBe(true);
    }
  });
});
