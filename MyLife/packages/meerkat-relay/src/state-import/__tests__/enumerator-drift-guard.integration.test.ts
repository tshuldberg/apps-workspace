import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../../postgres/migrate';
import { PostgresStoreContext } from '../../postgres/store-context';
import { PostgresCommunityDescriptorStore, PostgresKillStore, PostgresPublicPostStore } from '../../postgres/stores/community-stores';
import { PostgresHumanityStore } from '../../postgres/stores/humanity-store';
import { PostgresPersonaRegistryStore } from '../../postgres/stores/persona-registry-store';
import { PostgresMeerkatBillingStore } from '../../postgres/stores/hosted-billing-store';
import { PostgresOperatorConsoleStore } from '../../postgres/stores/operator-console-store';
import { PostgresNcmecReportQueueStore } from '../../postgres/stores/ncmec-queue-store';
import { PostgresDmcaIntakeStore } from '../../postgres/stores/dmca-intake-store';
import { PostgresObjectReferenceLedger } from '../../postgres/stores/object-reference-store';
import { PostgresObjectDeletionJobStore } from '../../postgres/stores/object-deletion-store';
import { createPersonaClaim, generatePublicPersona } from '@mylife/sync';
import { fileEnumerator, postgresEnumerator } from '..';
import { importStore } from '../importers';
import type { StateRecord, StateStoreId } from '../model';
import type { StateServiceRoots } from '../enumerate-file';

/**
 * Drift guard: for every raw-SQL enumerator, prove the raw SELECT agrees with the store
 * adapter's own read method. Each raw enumerator duplicates table knowledge outside the
 * store; if a schema change moves a column, the raw SELECT and the contract read diverge
 * and this test fails LOUDLY instead of the digest silently reading wrong fields. Every
 * enumerator keeps an explicit column list (no SELECT *) so this comparison is meaningful.
 */

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests ? describe.sequential : describe.skip;

const hex = (id: string) => Buffer.from(id, 'utf8').toString('hex');

async function enumerateOne(storeId: StateStoreId, database: PostgresStoreContext): Promise<StateRecord> {
  const records: StateRecord[] = [];
  for await (const record of postgresEnumerator(storeId, database).enumerate()) records.push(record);
  expect(records, `${storeId} should enumerate exactly one seeded record`).toHaveLength(1);
  return records[0]!;
}

async function importOne(
  storeId: StateStoreId,
  database: PostgresStoreContext,
  roots: StateServiceRoots,
): Promise<void> {
  const result = await importStore(database, fileEnumerator(storeId, roots), { owner: 'drift@guard' });
  expect(result.imported, `${storeId} should import its seeded record`).toBe(1);
}

describePostgres('enumerator drift guard (raw SQL vs store contract read)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_drift_guard_${suffix}`;
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
      throw new Error('Drift guard requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: url.toString(), max: 4, statement_timeout: 30_000 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool);
    database = new PostgresStoreContext(pool);
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-drift-guard-'));
    roots = { community: path.join(root, 'community'), persona: path.join(root, 'persona'),
      humanity: path.join(root, 'humanity'), directory: path.join(root, 'directory'),
      hosted: path.join(root, 'hosted') };
  });

  afterAll(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true });
    if (pool) await pool.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE TABLE
      community.descriptor_revisions, community.kills, community.private_states,
      community.blocked_personas,
      humanity.spent_tokens, persona.records, hosted.subscriptions,
      moderation.triage, moderation.ncmec_reports, moderation.dmca_claims,
      ops.object_reference_keys, ops.object_reference_edges, ops.object_deletion_jobs,
      directory.publications
      RESTART IDENTITY CASCADE`);
    await pool.query('TRUNCATE TABLE ops.idempotency_results RESTART IDENTITY');
  });

  it('descriptor-revisions: raw SELECT matches getHighestRevision', async () => {
    const dir = path.join(root, 'community', 'descriptors');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${hex('c1')}.rev.json`),
      JSON.stringify({ revision: 7, descriptorHash: 'a'.repeat(128) }));
    await importOne('community.descriptor-revisions', database, roots);

    const raw = await enumerateOne('community.descriptor-revisions', database);
    const contract = await new PostgresCommunityDescriptorStore(database).getHighestRevision('c1');
    expect(raw.identity).toEqual(['c1']);
    expect((raw.digestPayload as { revision: number }).revision).toBe(contract!.revision);
    expect((raw.digestPayload as { descriptorHash: string }).descriptorHash).toBe(contract!.descriptorHash);
  });

  it('community.kills: raw SELECT matches isKilled/loadKilledCommunityIds', async () => {
    const dir = path.join(root, 'community', 'kills');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${hex('c9')}.kill.json`),
      JSON.stringify({ kill: { communityId: 'c9' }, signature: 'sig' }));
    await importOne('community.kills', database, roots);

    const raw = await enumerateOne('community.kills', database);
    const store = new PostgresKillStore(database);
    expect(raw.identity).toEqual(['c9']);
    expect(await store.isKilled('c9')).toBe(true);
    expect(await store.loadKilledCommunityIds()).toContain('c9');
  });

  it('community.blocked-personas: raw SELECT (hash column) matches isPersonaBlocked', async () => {
    // Block through the store contract (writes raw pubkey + hash), then confirm the raw
    // enumerator reads the same persona_pubkey_hash the contract enforces on.
    const pubkey = 'a'.repeat(64);
    const store = new PostgresPublicPostStore(database);
    await store.blockPersona(pubkey);

    const raw = await enumerateOne('community.blocked-personas', database);
    const hash = createHash('sha256').update(pubkey.toLowerCase(), 'utf8').digest('hex');
    expect(raw.identity).toEqual([hash]);
    expect(await store.isPersonaBlocked(pubkey)).toBe(true);
  });

  it('humanity.spent-tokens: raw SELECT matches isSpent', async () => {
    const humanity = path.join(root, 'humanity');
    await fs.mkdir(humanity, { recursive: true });
    const tokenHash = 'c'.repeat(64);
    await fs.writeFile(path.join(humanity, 'humanity-spend-ledger.json'),
      JSON.stringify({ version: 1, tokens: { [tokenHash]: { expiresAtMs: 1_900_000_000_000 } }, registrationAttempts: {} }));
    await importOne('humanity.spent-tokens', database, roots);

    const raw = await enumerateOne('humanity.spent-tokens', database);
    expect(raw.identity).toEqual([tokenHash]);
    expect(await new PostgresHumanityStore(database).isSpent(tokenHash)).toBe(true);
  });

  it('persona.records: raw SELECT matches getByAlias', async () => {
    // A valid signed persona record so getByAlias (which re-verifies the claim) succeeds.
    const persona = generatePublicPersona('alice');
    const humanityBinding = 'a'.repeat(128);
    const claim = createPersonaClaim({ persona, humanityBinding });
    const record = {
      version: 1, alias: 'alice', personaPubkey: persona.personaPubkey,
      humanityBinding, claim, createdAt: '2026-01-01T00:00:00.000Z',
    };
    const dir = path.join(root, 'persona', 'personas');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'alice.json'), JSON.stringify(record));
    await importOne('persona.records', database, roots);

    const raw = await enumerateOne('persona.records', database);
    const contract = await new PostgresPersonaRegistryStore(database).getByAlias('alice');
    expect(raw.identity).toEqual(['alice']);
    expect(contract!.alias).toBe('alice');
    expect(contract!.personaPubkey).toBe(persona.personaPubkey);
  });

  it('hosted.subscriptions: raw SELECT matches getSubscription', async () => {
    const dir = path.join(root, 'hosted', 'subscriptions');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${'0'.repeat(64)}.json`),
      JSON.stringify({ subjectId: 'subj-1', status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' }));
    await importOne('hosted.subscriptions', database, roots);

    const raw = await enumerateOne('hosted.subscriptions', database);
    const contract = await new PostgresMeerkatBillingStore(database).getSubscription('subj-1');
    expect(raw.identity).toEqual(['subj-1']);
    expect(contract!.subjectId).toBe('subj-1');
    expect(contract!.status).toBe('active');
  });

  it('moderation.triage: raw SELECT matches getTriage', async () => {
    const store = new PostgresOperatorConsoleStore(database);
    const reportKey = 'a'.repeat(64);
    await store.putTriage({ reportKey, status: 'reviewed', decidedAt: '2026-01-01T00:00:00.000Z', auditSeq: 1 });

    const raw = await enumerateOne('moderation.triage', database);
    const contract = await store.getTriage(reportKey);
    expect(raw.identity).toEqual([reportKey]);
    expect((raw.digestPayload as { status: string }).status).toBe(contract!.status);
  });

  it('moderation.ncmec-reports: raw SELECT matches get', async () => {
    const store = new PostgresNcmecReportQueueStore(database);
    const id = 'b'.repeat(64);
    await store.enqueue({ id, source: 'submit_scan', detectedAt: '2026-01-01T00:00:00.000Z',
      publicationId: 'pub-1', reason: 'match', status: 'queued' });

    const raw = await enumerateOne('moderation.ncmec-reports', database);
    const contract = await store.get(id);
    expect(raw.identity).toEqual([id]);
    expect((raw.digestPayload as { status: string }).status).toBe(contract!.status);
  });

  it('moderation.dmca-claims: raw SELECT matches get', async () => {
    const store = new PostgresDmcaIntakeStore(database);
    const id = 'd'.repeat(64);
    await store.create({
      id, receivedAt: '2026-01-01T00:00:00.000Z', status: 'received', lifecycleVersion: 1,
      workDescription: 'my work', claimedPostIds: ['post-1'], claimedUrls: [],
      claimant: { name: 'C', email: 'c@x.io', address: '1 St' },
      goodFaithStatement: true, accuracyStatement: true, signature: 'C',
    } as unknown as Parameters<typeof store.create>[0]);

    const raw = await enumerateOne('moderation.dmca-claims', database);
    const contract = await store.get(id);
    expect(raw.identity).toEqual([id]);
    expect((raw.digestPayload as { status: string }).status).toBe(contract!.status);
  });

  it('ops.object-reference-keys: raw SELECT matches referenceCount', async () => {
    const store = new PostgresObjectReferenceLedger(database);
    await store.addReference({ objectKey: 'objects/x', referrer: 'pub-1' });
    await store.addReference({ objectKey: 'objects/x', referrer: 'pub-2' });

    const raw = await enumerateOne('ops.object-reference-keys', database);
    expect(raw.identity).toEqual(['objects/x']);
    expect((raw.digestPayload as { referenceCount: number }).referenceCount)
      .toBe(await store.referenceCount('objects/x'));
  });

  it('ops.object-deletion-jobs: raw SELECT matches getJob', async () => {
    const store = new PostgresObjectDeletionJobStore(database);
    await store.enqueue('objects/y', 1000);

    const raw = await enumerateOne('ops.object-deletion-jobs', database);
    const contract = await store.getJob('objects/y');
    expect(raw.identity).toEqual(['objects/y']);
    expect((raw.digestPayload as { state: string }).state).toBe(contract!.state);
    expect((raw.digestPayload as { attempt: number }).attempt).toBe(contract!.attempt);
  });
});
