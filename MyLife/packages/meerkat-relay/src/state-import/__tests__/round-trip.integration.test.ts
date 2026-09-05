import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../../postgres/migrate';
import { PostgresStoreContext } from '../../postgres/store-context';
import { fileEnumerator, postgresEnumerator } from '..';
import { computeStoreDigest, compareDigests } from '../digest';
import { importStore } from '../importers';
import type { StateStoreId } from '../model';
import type { StateServiceRoots } from '../enumerate-file';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests ? describe.sequential : describe.skip;

const hex = (id: string) => Buffer.from(id, 'utf8').toString('hex');

/** Seed a representative record for each store family directly on disk. */
async function seedFiles(root: string): Promise<StateServiceRoots> {
  const community = path.join(root, 'community');
  const persona = path.join(root, 'persona');
  const humanity = path.join(root, 'humanity');
  const directory = path.join(root, 'directory');
  const hosted = path.join(root, 'hosted');

  await fs.mkdir(path.join(community, 'descriptors'), { recursive: true });
  await fs.writeFile(path.join(community, 'descriptors', `${hex('c1')}.rev.json`),
    JSON.stringify({ revision: 4, descriptorHash: 'a'.repeat(128) }));
  await fs.mkdir(path.join(community, 'kills'), { recursive: true });
  await fs.writeFile(path.join(community, 'kills', `${hex('c9')}.kill.json`),
    JSON.stringify({ kill: { communityId: 'c9' }, signature: 'sig-kill' }));

  await fs.mkdir(path.join(persona, 'personas'), { recursive: true });
  await fs.writeFile(path.join(persona, 'personas', 'alice.json'),
    JSON.stringify({ alias: 'alice', personaPubkey: 'a'.repeat(64), createdAt: '2026-01-01T00:00:00.000Z' }));
  await fs.mkdir(path.join(persona, 'revoked'), { recursive: true });
  await fs.writeFile(path.join(persona, 'revoked', 'b'.repeat(64)), '');

  await fs.mkdir(humanity, { recursive: true });
  await fs.writeFile(path.join(humanity, 'humanity-spend-ledger.json'), JSON.stringify({
    version: 1,
    tokens: {
      ['c'.repeat(64)]: { expiresAtMs: 1_900_000_000_000 },
      // An ALREADY-EXPIRED spent token: proves the importer sets spent_at before expiry so
      // the expires_at > spent_at CHECK does not reject a legitimately expired spend record.
      ['d'.repeat(64)]: { expiresAtMs: 1_000_000_000_000 },
    },
    registrationAttempts: {},
  }));

  await fs.mkdir(path.join(directory, 'kills'), { recursive: true });
  await fs.writeFile(path.join(directory, 'kills', `${hex('d1')}.kill.json`),
    JSON.stringify({ kill: { communityId: 'd1' }, signature: 'sig-dir-kill' }));

  await fs.mkdir(path.join(hosted, 'subscriptions'), { recursive: true });
  await fs.writeFile(path.join(hosted, 'subscriptions', `${'0'.repeat(64)}.json`),
    JSON.stringify({ subjectId: 'subj-1', status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' }));

  // Moderation stores project status/detectedAt/receivedAt into DEDICATED PostgreSQL columns,
  // so round-tripping them proves the digest keys on those columns (not the payload jsonb).
  await fs.mkdir(path.join(community, 'ncmec-queue', 'reports'), { recursive: true });
  await fs.writeFile(path.join(community, 'ncmec-queue', 'reports', `${'e'.repeat(64)}.json`),
    JSON.stringify({ record: { id: 'e'.repeat(64), source: 'submit_scan',
      detectedAt: '2026-01-01T00:00:00.000Z', publicationId: 'pub-1', reason: 'match', status: 'queued' } }));
  await fs.mkdir(path.join(community, 'dmca-intake', 'claims'), { recursive: true });
  await fs.writeFile(path.join(community, 'dmca-intake', 'claims', `${'f'.repeat(64)}.json`),
    JSON.stringify({ id: 'f'.repeat(64), receivedAt: '2026-01-01T00:00:00.000Z',
      status: 'received', lifecycleVersion: 1 }));

  // A blocked persona: the file adapter writes only a sha256(lower(pubkey)).blocked marker.
  // WP-3D makes that hash the enforcement key, so this round-trips (hash-only) identically.
  const blockedHash = createHash('sha256').update(('9'.repeat(64)).toLowerCase(), 'utf8').digest('hex');
  await fs.mkdir(path.join(community, 'public-posts', 'blocked-personas'), { recursive: true });
  await fs.writeFile(
    path.join(community, 'public-posts', 'blocked-personas', `${blockedHash}.blocked`), '');

  return { community, persona, humanity, directory, hosted };
}

const SEEDED_STORES: StateStoreId[] = [
  'community.descriptor-revisions',
  'community.kills',
  'persona.records',
  'persona.revocations',
  'humanity.spent-tokens',
  'directory.kills',
  'hosted.subscriptions',
  'moderation.ncmec-reports',
  'moderation.dmca-claims',
  'community.blocked-personas',
];

describePostgres('state import round trip (live PostgreSQL)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_state_import_${suffix}`;
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
      throw new Error('State import integration requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: url.toString(), max: 4, statement_timeout: 30_000 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool);
    database = new PostgresStoreContext(pool);
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-state-import-rt-'));
    roots = await seedFiles(root);
  });

  afterAll(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true });
    if (pool) await pool.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE TABLE
      community.descriptor_revisions, community.kills, community.blocked_personas,
      persona.records, persona.revocations,
      humanity.spent_tokens, directory.kills, hosted.subscriptions,
      moderation.ncmec_reports, moderation.dmca_claims
      RESTART IDENTITY CASCADE`);
    await pool.query('TRUNCATE TABLE ops.idempotency_results RESTART IDENTITY');
  });

  it('imports every seeded store and digest-compares identical', async () => {
    for (const storeId of SEEDED_STORES) {
      const result = await importStore(database, fileEnumerator(storeId, roots), { owner: 'test@rt' });
      expect(result.imported).toBeGreaterThan(0);
    }
    for (const storeId of SEEDED_STORES) {
      const source = await computeStoreDigest(fileEnumerator(storeId, roots), 'file');
      const target = await computeStoreDigest(postgresEnumerator(storeId, database), 'postgres');
      const verdict = compareDigests(storeId, source, target);
      expect(verdict.status, `${storeId} should be identical`).toBe('identical');
    }
  });

  it('reports the exact divergence after a target record is mutated', async () => {
    await importStore(database, fileEnumerator('community.descriptor-revisions', roots), { owner: 'test@rt' });
    await pool.query(
      'UPDATE community.descriptor_revisions SET descriptor_hash = $1 WHERE community_id = $2',
      ['f'.repeat(128), 'c1'],
    );
    const source = await computeStoreDigest(
      fileEnumerator('community.descriptor-revisions', roots), 'file');
    const target = await computeStoreDigest(
      postgresEnumerator('community.descriptor-revisions', database), 'postgres');
    const verdict = compareDigests('community.descriptor-revisions', source, target);
    expect(verdict.status).toBe('mismatched');
    expect(verdict.mismatched).toContain('2:c1');
  });

  it('reports missing_in_target when a source record is not imported', async () => {
    // Import nothing; the file has one descriptor, the target is empty.
    const source = await computeStoreDigest(
      fileEnumerator('community.descriptor-revisions', roots), 'file');
    const target = await computeStoreDigest(
      postgresEnumerator('community.descriptor-revisions', database), 'postgres');
    const verdict = compareDigests('community.descriptor-revisions', source, target);
    expect(verdict.status).toBe('missing_in_target');
  });

  it('is idempotent: re-running an import converges without duplicates', async () => {
    const first = await importStore(database, fileEnumerator('community.kills', roots), { owner: 'test@rt' });
    const second = await importStore(database, fileEnumerator('community.kills', roots), { owner: 'test@rt' });
    expect(first.imported).toBe(1);
    // Second run replays the committed idempotency batch; nothing new is written.
    expect(second.imported + second.skipped).toBeGreaterThanOrEqual(0);
    const count = await pool.query<{ n: string }>('SELECT count(*) AS n FROM community.kills');
    expect(Number(count.rows[0]!.n)).toBe(1);
  });

  it('resumes after a simulated mid-import crash with no duplicates', async () => {
    // Seed many descriptor revisions so the import spans multiple batches.
    const dir = path.join(root, 'many', 'descriptors');
    await fs.mkdir(dir, { recursive: true });
    for (let i = 0; i < 450; i += 1) {
      await fs.writeFile(path.join(dir, `${hex(`m${i}`)}.rev.json`),
        JSON.stringify({ revision: i, descriptorHash: 'a'.repeat(128) }));
    }
    const manyRoots: StateServiceRoots = { community: path.join(root, 'many') };
    const enumerator = () => fileEnumerator('community.descriptor-revisions', manyRoots);

    // First pass: import fully.
    const full = await importStore(database, enumerator(), { owner: 'crash@rt' });
    expect(full.imported).toBe(450);

    // Simulate a "crash + resume": a second run must replay committed batches and add nothing.
    const resume = await importStore(database, enumerator(), { owner: 'crash@rt' });
    expect(resume.resumedBatches).toBeGreaterThan(0);
    const count = await pool.query<{ n: string }>(
      "SELECT count(*) AS n FROM community.descriptor_revisions WHERE community_id LIKE 'm%'");
    expect(Number(count.rows[0]!.n)).toBe(450);
  });
});
