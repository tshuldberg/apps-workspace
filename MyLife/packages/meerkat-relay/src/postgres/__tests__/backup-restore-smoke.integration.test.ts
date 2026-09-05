import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { renderMeerkatRoleGrants, MEERKAT_DATABASE_ROLES } from '../roles';
import { PostgresStoreContext } from '../store-context';
import { PostgresBackupStore } from '../backup-store';
import {
  buildBackupSnapshot,
  compareRestoreAgainstSnapshot,
  buildProofDigests,
  computeRpoSeconds,
  computeRtoSeconds,
  evaluateBackupFreshness,
} from '../backup-evidence';
import { importStore } from '../../state-import/importers';
import { fileEnumerator } from '../../state-import/enumerate-file';
import { digestAllStores } from '../../state-import';
import type { StateStoreId } from '../../state-import';
import type { StateServiceRoots } from '../../state-import';
import {
  digestPostgresBackupProofStores,
  POSTGRES_BACKUP_PROOF_STORE_IDS,
} from '../backup-proof-inventory';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests ? describe.sequential : describe.skip;

const hex = (id: string) => Buffer.from(id, 'utf8').toString('hex');

const SEEDED_STORES: StateStoreId[] = [
  'community.descriptor-revisions',
  'persona.records',
  'hosted.subscriptions',
];

/** Seed a small representative fixture on disk. */
async function seedFiles(root: string): Promise<StateServiceRoots> {
  const community = path.join(root, 'community');
  const persona = path.join(root, 'persona');
  const hosted = path.join(root, 'hosted');
  await fs.mkdir(path.join(community, 'descriptors'), { recursive: true });
  await fs.writeFile(path.join(community, 'descriptors', `${hex('c1')}.rev.json`),
    JSON.stringify({ revision: 4, descriptorHash: 'a'.repeat(128) }));
  await fs.mkdir(path.join(persona, 'personas'), { recursive: true });
  await fs.writeFile(path.join(persona, 'personas', 'alice.json'),
    JSON.stringify({ alias: 'alice', personaPubkey: 'a'.repeat(64), createdAt: '2026-01-01T00:00:00.000Z' }));
  await fs.mkdir(path.join(hosted, 'subscriptions'), { recursive: true });
  await fs.writeFile(path.join(hosted, 'subscriptions', `${'0'.repeat(64)}.json`),
    JSON.stringify({ subjectId: 'subj-1', status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' }));
  return { community, persona, hosted };
}

async function importFixture(database: PostgresStoreContext, roots: StateServiceRoots): Promise<void> {
  for (const storeId of SEEDED_STORES) {
    await importStore(database, fileEnumerator(storeId, roots), { owner: 'backup-smoke@test' });
  }
}

async function seedPostgresOnlyProofState(database: PostgresStoreContext): Promise<void> {
  await database.query(
    `INSERT INTO hosted.storage_tenants (
       subject_id, cap_bytes, reserved_bytes, committed_bytes, updated_at
     ) VALUES ('backup-proof-subject', 1000000, 0, 0, '2026-07-10T00:00:00.000Z')`,
  );
  await database.query(
    `INSERT INTO hosted.storage_api_objects (
       subject_id, object_id, encrypted_bytes, ciphertext_hash, data_class,
       total_blocks, version, created_at
     ) VALUES (
       'backup-proof-subject', 'manifest-object', 42, $1, 'backup_manifest',
       1, 'v1', '2026-07-10T00:01:00.000Z'
     )`,
    ['a'.repeat(128)],
  );
  await database.query(
    `INSERT INTO hosted.storage_backup_locators (
       subject_id, backup_id, format_version, encrypted_manifest_hash,
       created_at, manifest_object_id, recorded_at
     ) VALUES (
       'backup-proof-subject', 'backup-proof-1', 1, $1,
       '2026-07-10T00:02:00.000Z', 'manifest-object', '2026-07-10T00:03:00.000Z'
     )`,
    ['b'.repeat(128)],
  );
  await database.query(
    `INSERT INTO hosted.oauth_vaults (
       vault_id, provider, subject_id, encrypted_refresh_token, wrapped_data_key,
       nonce, account_hint, scopes, created_at
     ) VALUES (
       'backup-proof-vault', 'google', 'backup-proof-subject', $1, $2,
       $3, 'backup@example.test', ARRAY['drive.read'], '2026-07-10T00:04:00.000Z'
     )`,
    [Buffer.alloc(16, 0x11), Buffer.alloc(32, 0x22), Buffer.alloc(12, 0x33)],
  );
}

async function digestBackupState(database: PostgresStoreContext) {
  const [portable, postgresOnly] = await Promise.all([
    digestAllStores('postgres', {}, { database }, SEEDED_STORES),
    digestPostgresBackupProofStores(database),
  ]);
  return { ...portable, ...postgresOnly };
}

describePostgres('backup restore-smoke (live PostgreSQL)', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const sourceDb = `meerkat_test_backup_src_${suffix}`;
  const restoredDb = `meerkat_test_backup_dst_${suffix}`;
  let adminPool: Pool;
  let sourcePool: Pool;
  let restoredPool: Pool;
  let source: PostgresStoreContext;
  let restored: PostgresStoreContext;
  let root: string;
  let roots: StateServiceRoots;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Backup smoke integration requires a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${sourceDb}"`);
    await adminPool.query(`CREATE DATABASE "${restoredDb}"`);
    const urlFor = (db: string): string => {
      const url = new URL(connectionString!);
      url.pathname = `/${db}`;
      return url.toString();
    };
    sourcePool = new Pool({ connectionString: urlFor(sourceDb), max: 4, statement_timeout: 30_000 });
    sourcePool.on('error', () => undefined);
    restoredPool = new Pool({ connectionString: urlFor(restoredDb), max: 4, statement_timeout: 30_000 });
    restoredPool.on('error', () => undefined);
    await runPostgresMigrations(sourcePool);
    await runPostgresMigrations(restoredPool);
    source = new PostgresStoreContext(sourcePool);
    restored = new PostgresStoreContext(restoredPool);
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-backup-smoke-'));
    roots = await seedFiles(root);
    // The "source" DB and the "restored" DB both import the identical fixture: the restored
    // DB stands in for a provider restore of the source into a scratch environment.
    await importFixture(source, roots);
    await importFixture(restored, roots);
    await seedPostgresOnlyProofState(source);
    await seedPostgresOnlyProofState(restored);
  });

  afterAll(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true }).catch(() => undefined);
    await sourcePool?.end().catch(() => undefined);
    await restoredPool?.end().catch(() => undefined);
    await adminPool.query(`DROP DATABASE IF EXISTS "${sourceDb}" WITH (FORCE)`).catch(() => undefined);
    await adminPool.query(`DROP DATABASE IF EXISTS "${restoredDb}" WITH (FORCE)`).catch(() => undefined);
    await adminPool.end().catch(() => undefined);
  });

  async function captureSnapshot() {
    const now = await source.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    const capturedAt = now.rows[0]!.now.toISOString();
    const perStore = await digestBackupState(source);
    return buildBackupSnapshot({ capturedAt, releaseSha: 'release-abc', digestRole: 'meerkat_backup_digest', perStore });
  }

  it('records a verified proof when the restored digests match the reference', async () => {
    const snapshot = await captureSnapshot();
    const startedAt = Date.now();
    const restoredDigests = await digestBackupState(restored);
    const comparison = compareRestoreAgainstSnapshot(snapshot, restoredDigests);
    expect(comparison.verified).toBe(true);

    const proofId = `proof-${randomUUID()}`;
    const store = new PostgresBackupStore(source);
    const result = await store.recordRestoreProof({
      proofId,
      sourceBackupId: `backup-${randomUUID()}`,
      releaseSha: 'release-abc',
      restoredAt: new Date().toISOString(),
      rpoSeconds: computeRpoSeconds(snapshot.capturedAt, '2026-07-10T00:00:00.000Z'),
      rtoSeconds: computeRtoSeconds(Date.now() - startedAt),
      semanticDigests: buildProofDigests(snapshot, restoredDigests).digests,
      verified: true,
    }, 'smoke-a@test');
    expect(result.status).toBe('recorded');
    if (result.status !== 'recorded') throw new Error('not recorded');
    expect(result.proof.verified).toBe(true);
    expect((result.proof.semanticDigests as Record<string, unknown>).identicalStores)
      .toBe(SEEDED_STORES.length + POSTGRES_BACKUP_PROOF_STORE_IDS.length);
  });

  it('a replayed proof id reports the DURABLE row, never re-labeling recorded evidence', async () => {
    const store = new PostgresBackupStore(source);
    const proofId = `proof-${randomUUID()}`;
    const base = {
      proofId,
      sourceBackupId: `backup-${randomUUID()}`,
      releaseSha: 'release-abc',
      restoredAt: new Date().toISOString(),
      rpoSeconds: 0,
      rtoSeconds: 1,
      semanticDigests: { note: 'first recording, unverified' },
      verified: false,
    };
    const first = await store.recordRestoreProof(base, 'replay-a@test');
    expect(first.status).toBe('recorded');
    // Replay the same proof id claiming verified=true: the durable row must stand.
    const replay = await store.recordRestoreProof({ ...base, verified: true }, 'replay-b@test');
    expect(replay.status).toBe('duplicate');
    if (replay.status !== 'duplicate') throw new Error('not duplicate');
    expect(replay.existing.verified).toBe(false);
  });

  it('records verified=false with the divergence when one restored record is mutated', async () => {
    const snapshot = await captureSnapshot();
    // Mutate one record in the restored copy so its digest diverges from the reference.
    await restoredPool.query(
      'UPDATE community.descriptor_revisions SET descriptor_hash = $1 WHERE community_id = $2',
      ['f'.repeat(128), 'c1'],
    );
    const restoredDigests = await digestBackupState(restored);
    const comparison = compareRestoreAgainstSnapshot(snapshot, restoredDigests);
    expect(comparison.verified).toBe(false);
    expect(comparison.divergences.some((d) => d.storeId === 'community.descriptor-revisions')).toBe(true);

    const proofId = `proof-${randomUUID()}`;
    const store = new PostgresBackupStore(source);
    const result = await store.recordRestoreProof({
      proofId,
      sourceBackupId: `backup-${randomUUID()}`,
      releaseSha: 'release-abc',
      restoredAt: new Date().toISOString(),
      rpoSeconds: 0,
      rtoSeconds: 1,
      semanticDigests: buildProofDigests(snapshot, restoredDigests).digests,
      verified: false,
    }, 'smoke-b@test');
    expect(result.status).toBe('recorded');
    if (result.status !== 'recorded') throw new Error('not recorded');
    expect(result.proof.verified).toBe(false);
    const digests = result.proof.semanticDigests as Record<string, unknown>;
    expect(Array.isArray(digests.divergences)).toBe(true);

    // Restore the mutated record so later tests see a consistent restored copy.
    await restoredPool.query(
      'UPDATE community.descriptor_revisions SET descriptor_hash = $1 WHERE community_id = $2',
      ['a'.repeat(128), 'c1'],
    );
  });

  it('detects divergence in a PostgreSQL-only durable proof table', async () => {
    const snapshot = await captureSnapshot();
    await restoredPool.query(
      `UPDATE hosted.storage_api_objects
       SET version = 'v2'
       WHERE subject_id = 'backup-proof-subject' AND object_id = 'manifest-object'`,
    );
    const restoredDigests = await digestBackupState(restored);
    const comparison = compareRestoreAgainstSnapshot(snapshot, restoredDigests);

    expect(comparison.verified).toBe(false);
    expect(comparison.divergences).toContainEqual(expect.objectContaining({
      storeId: 'hosted.storage-api-objects',
      reason: 'rollup_mismatch',
    }));

    await restoredPool.query(
      `UPDATE hosted.storage_api_objects
       SET version = 'v1'
       WHERE subject_id = 'backup-proof-subject' AND object_id = 'manifest-object'`,
    );
  });

  it('freshness evaluates the recorded verified proof as fresh, and an aged/absent one as stale/fail', async () => {
    // Record a dedicated fresh, low-RPO verified proof so the verdict is driven by this row,
    // not whichever earlier proof happened to carry a wide RPO.
    const store = new PostgresBackupStore(source);
    const proofId = `proof-fresh-${randomUUID()}`;
    await store.recordRestoreProof({
      proofId,
      sourceBackupId: `backup-${randomUUID()}`,
      releaseSha: 'release-abc',
      restoredAt: new Date().toISOString(),
      rpoSeconds: 10,
      rtoSeconds: 1,
      semanticDigests: { note: 'fresh proof for freshness test' },
      verified: true,
    }, 'freshness@test');
    const latest = (await store.listRecentProofs(50)).find((p) => p.proofId === proofId);
    expect(latest, 'expected the freshly recorded verified proof').toBeTruthy();
    if (!latest) throw new Error('no verified proof');

    const thresholds = { maxProofAgeSeconds: 7 * 24 * 60 * 60, maxRpoSeconds: 24 * 60 * 60 };
    const freshInput = {
      latest: {
        proofId: latest.proofId,
        restoredAt: latest.restoredAt,
        verified: latest.verified,
        rpoSeconds: latest.rpoSeconds,
        rtoSeconds: latest.rtoSeconds,
      },
      now: new Date().toISOString(),
      thresholds,
    };
    expect(evaluateBackupFreshness(freshInput).verdict).toBe('ok');

    // An aged proof (restoredAt far in the past) is stale -> fail (exit 2).
    expect(evaluateBackupFreshness({
      ...freshInput,
      latest: { ...freshInput.latest, restoredAt: '2026-01-01T00:00:00.000Z' },
    }).verdict).toBe('fail');
    // An absent verified proof is a hard fail (NC-44.3).
    expect(evaluateBackupFreshness({ ...freshInput, latest: null }).verdict).toBe('fail');
  });

  it('fences two concurrent smokes on the same proof id (one recorded, one contended)', async () => {
    const snapshot = await captureSnapshot();
    const restoredDigests = await digestBackupState(restored);
    const comparison = compareRestoreAgainstSnapshot(snapshot, restoredDigests);
    const proofId = `proof-${randomUUID()}`;
    const proof = {
      proofId,
      sourceBackupId: `backup-${randomUUID()}`,
      releaseSha: 'release-abc',
      restoredAt: new Date().toISOString(),
      rpoSeconds: 0,
      rtoSeconds: 1,
      semanticDigests: buildProofDigests(snapshot, restoredDigests).digests,
      verified: comparison.verified,
    };
    const storeA = new PostgresBackupStore(source);
    const storeB = new PostgresBackupStore(new PostgresStoreContext(sourcePool));
    const [a, b] = await Promise.all([
      storeA.recordRestoreProof(proof, 'racer-a@test'),
      storeB.recordRestoreProof(proof, 'racer-b@test'),
    ]);
    const statuses = [a.status, b.status].sort();
    // Either the two serialized (recorded + duplicate) or one was refused the lease (contended).
    expect(
      (statuses[0] === 'contended' && (statuses[1] === 'recorded' || statuses[1] === 'contended')) ||
        (statuses[0] === 'duplicate' && statuses[1] === 'recorded'),
    ).toBe(true);
  });

  it('grants meerkat_backup_digest SELECT but never INSERT/UPDATE/DELETE on the digest set', async () => {
    const rolesSuffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const schemaOwner = `meerkat_owner_${rolesSuffix}`;
    const grantDb = `meerkat_test_backup_grants_${rolesSuffix}`;
    const roles = MEERKAT_DATABASE_ROLES.map((role) => ({ ...role, name: `${role.name}_${rolesSuffix}` }));
    const digestRole = `meerkat_backup_digest_${rolesSuffix}`;
    let grantPool: Pool | undefined;
    const created: string[] = [];
    try {
      await adminPool.query(`CREATE ROLE "${schemaOwner}" NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
      created.push(schemaOwner);
      for (const role of roles) {
        await adminPool.query(`CREATE ROLE "${role.name}" NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
        created.push(role.name);
      }
      await adminPool.query(`CREATE DATABASE "${grantDb}" OWNER "${schemaOwner}"`);
      const url = new URL(connectionString!);
      url.pathname = `/${grantDb}`;
      grantPool = new Pool({ connectionString: url.toString(), options: `-c role=${schemaOwner}`, max: 2 });
      grantPool.on('error', () => undefined);
      await runPostgresMigrations(grantPool);
      await grantPool.query(renderMeerkatRoleGrants(schemaOwner, roles));

      const can = await grantPool.query<{
        can_select: boolean;
        can_insert: boolean;
        can_update: boolean;
        can_delete: boolean;
        can_select_storage_api: boolean;
        can_update_storage_api: boolean;
        can_select_oauth_vault: boolean;
        can_update_oauth_vault: boolean;
        can_select_proof: boolean;
        can_insert_proof: boolean;
      }>(`
        SELECT
          has_table_privilege($1, 'persona.records', 'SELECT') AS can_select,
          has_table_privilege($1, 'persona.records', 'INSERT') AS can_insert,
          has_table_privilege($1, 'persona.records', 'UPDATE') AS can_update,
          has_table_privilege($1, 'persona.records', 'DELETE') AS can_delete,
          has_table_privilege($1, 'hosted.storage_api_objects', 'SELECT') AS can_select_storage_api,
          has_table_privilege($1, 'hosted.storage_api_objects', 'UPDATE') AS can_update_storage_api,
          has_table_privilege($1, 'hosted.oauth_vaults', 'SELECT') AS can_select_oauth_vault,
          has_table_privilege($1, 'hosted.oauth_vaults', 'UPDATE') AS can_update_oauth_vault,
          has_table_privilege($1, 'ops.backup_restore_proofs', 'SELECT') AS can_select_proof,
          has_table_privilege($1, 'ops.backup_restore_proofs', 'INSERT') AS can_insert_proof
      `, [digestRole]);
      expect(can.rows[0]).toEqual({
        can_select: true,
        can_insert: false,
        can_update: false,
        can_delete: false,
        can_select_storage_api: true,
        can_update_storage_api: false,
        can_select_oauth_vault: true,
        can_update_oauth_vault: false,
        // The digest role is NOT the proof writer: it cannot even read the proof tables.
        can_select_proof: false,
        can_insert_proof: false,
      });
    } finally {
      await grantPool?.end().catch(() => undefined);
      await adminPool.query(`DROP DATABASE IF EXISTS "${grantDb}" WITH (FORCE)`).catch(() => undefined);
      for (const role of created) await adminPool.query(`DROP ROLE IF EXISTS "${role}"`).catch(() => undefined);
    }
  });
});
