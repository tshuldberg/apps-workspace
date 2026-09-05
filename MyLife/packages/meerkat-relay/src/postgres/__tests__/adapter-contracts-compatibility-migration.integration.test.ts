import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresArchiveLifecycleStore } from '../stores/archive-lifecycle-store';
import { PostgresHostedStorageMetadataStore } from '../stores/hosted-storage-metadata-store';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;

describePostgres('adapter-contract compatibility migration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_adapter_compat_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;

  const pushAttemptId = randomUUID();
  const leasedArchiveJobId = randomUUID();
  const pinnedArchiveJobId = randomUUID();
  const leasedPublicationId = `legacy-publication-${randomUUID()}`;
  const leasedContentId = `legacy-content-${randomUUID()}`;
  const pinnedPublicationId = `legacy-publication-${randomUUID()}`;
  const pinnedContentId = `legacy-content-${randomUUID()}`;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Adapter compatibility tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 4 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool, { targetVersion: 2 });

    await pool.query(
      `INSERT INTO push.registrations (
         registration_id_hash, registration_secret_hash, platform, token_ciphertext,
         token_key_version, token_generation, expires_at
       ) VALUES (
         decode(repeat('11', 32), 'hex'), decode(repeat('12', 32), 'hex'),
         'apns', decode('abcd', 'hex'), 1, 1, clock_timestamp() + interval '30 days'
       )`,
    );
    await pool.query(
      `INSERT INTO push.capabilities (
         capability_hash, registration_id_hash, scope, expires_at
       ) VALUES (
         decode(repeat('13', 32), 'hex'), decode(repeat('11', 32), 'hex'),
         'sync_wake', clock_timestamp() + interval '7 days'
       )`,
    );
    await pool.query(
      `INSERT INTO push.attempts (
         attempt_id, capability_hash, idempotency_key, provider, provider_status, state,
         lease_owner, leased_until, attempt_count
       ) VALUES (
         $1, decode(repeat('13', 32), 'hex'), 'legacy-active-lease', 'apns', 'pending',
         'leased', 'legacy-push-worker', clock_timestamp() + interval '1 hour', 3
       )`,
      [pushAttemptId],
    );

    await pool.query(
      `INSERT INTO archive.jobs (
         job_id, idempotency_key, publication_id, content_id, owner_subject_hash,
         tier, status, rights_json, rights_signature, expected_bytes, received_bytes,
         lease_owner, leased_until, attempt_count
       ) VALUES (
         $1, $2, $3, $4, decode(repeat('21', 16), 'hex'), 'self_hosted',
         'quarantined', '{}'::jsonb, 'legacy-rights-signature', 1, 1,
         'legacy-archive-worker', clock_timestamp() + interval '1 hour', 3
       )`,
      [leasedArchiveJobId, randomUUID(), leasedPublicationId, leasedContentId],
    );
    await pool.query(
      `INSERT INTO archive.jobs (
         job_id, idempotency_key, publication_id, content_id, owner_subject_hash,
         tier, status, rights_json, rights_signature, expected_bytes, received_bytes
       ) VALUES (
         $1, $2, $3, $4, decode(repeat('22', 16), 'hex'), 'managed',
         'pinned', '{}'::jsonb, 'legacy-rights-signature', 1, 1
       )`,
      [pinnedArchiveJobId, randomUUID(), pinnedPublicationId, pinnedContentId],
    );
    await pool.query(
      `INSERT INTO archive.objects (
         content_id, object_index, object_hash, object_bytes, quarantine_key,
         durable_key, storage_checksum, status
       ) VALUES ($1, 0, $2, 1, $3, $4, $2, 'durable')`,
      [pinnedContentId, 'ab'.repeat(32), `quarantine/${pinnedContentId}/0`,
        `durable/${pinnedContentId}/0`],
    );
    await pool.query(
      `INSERT INTO archive.objects (
         content_id, object_index, object_hash, object_bytes, quarantine_key, status
       ) VALUES ($1, 0, 'legacy-object-hash', 0, '', 'quarantined')`,
      [leasedContentId],
    );
    await pool.query(
      `INSERT INTO archive.pins (
         publication_id, content_id, host_id, state, last_verified_at
       ) VALUES ($1, $2, 'legacy-host', 'active', clock_timestamp())`,
      [pinnedPublicationId, pinnedContentId],
    );

    await pool.query(
      `INSERT INTO hosted.storage_tenants (
         subject_id, cap_bytes, committed_bytes
       ) VALUES ('legacy-tenant', 100, 10)`,
    );
    await pool.query(
      `INSERT INTO hosted.storage_objects (
         subject_id, content_id, block_index, object_key, checksum, size_bytes, version_id
       ) VALUES (
         'legacy-tenant', 'legacy-content', 0, 'legacy-tenant/legacy-content/0',
         $1, 10, 'legacy-version-1'
       )`,
      ['cd'.repeat(32)],
    );
    await pool.query(
      `INSERT INTO hosted.storage_objects (
         subject_id, content_id, block_index, object_key, checksum, size_bytes, version_id
       ) VALUES (
         'legacy-tenant', 'legacy-incompatible', 0,
         'legacy-tenant/legacy-incompatible/0', 'legacy-checksum', 0, NULL
       )`,
    );

    await runPostgresMigrations(pool, { targetVersion: 6 });
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('revokes unfenced legacy leases without losing pending work', async () => {
    const push = await pool.query<{
      state: string;
      provider_status: string;
      lease_owner: string | null;
      leased_until: Date | null;
      fencing_token: string;
      last_error_code: string;
    }>(
      `SELECT state, provider_status, lease_owner, leased_until,
         fencing_token::text, last_error_code
       FROM push.attempts WHERE attempt_id = $1`,
      [pushAttemptId],
    );
    expect(push.rows[0]).toEqual({
      state: 'retryable',
      provider_status: 'unknown',
      lease_owner: null,
      leased_until: null,
      fencing_token: '4',
      last_error_code: 'lease_revoked_for_fencing_upgrade',
    });
    const stalePushCommit = await pool.query(
      `UPDATE push.attempts SET state = 'succeeded'
       WHERE attempt_id = $1 AND lease_owner = 'legacy-push-worker'`,
      [pushAttemptId],
    );
    expect(stalePushCommit.rowCount).toBe(0);

    const archive = await pool.query<{
      status: string;
      lease_owner: string | null;
      leased_until: Date | null;
      fencing_token: string;
      last_error_code: string;
    }>(
      `SELECT status, lease_owner, leased_until, fencing_token::text, last_error_code
       FROM archive.jobs WHERE job_id = $1`,
      [leasedArchiveJobId],
    );
    expect(archive.rows[0]).toEqual({
      status: 'quarantined',
      lease_owner: null,
      leased_until: null,
      fencing_token: '4',
      last_error_code: 'lease_revoked_for_fencing_upgrade',
    });
    const staleArchiveCommit = await pool.query(
      `UPDATE archive.jobs SET status = 'approved'
       WHERE job_id = $1 AND lease_owner = 'legacy-archive-worker'`,
      [leasedArchiveJobId],
    );
    expect(staleArchiveCommit.rowCount).toBe(0);
  });

  it('backfills an explicit safe policy for every legacy hosted tenant', async () => {
    const store = new PostgresHostedStorageMetadataStore(new PostgresStoreContext(pool));
    const tenant = await store.getTenant('legacy-tenant');
    expect(tenant).toMatchObject({
      subjectId: 'legacy-tenant',
      capBytes: 100,
      committedBytes: 10,
      policy: {
        policyVersion: 1,
        maxObjectBytes: 100,
        maxObjectCount: 100,
        maxConcurrentReservations: 32,
        reservationTtlSeconds: 3600,
        retentionDays: 0,
      },
    });
    await expect(store.provisionTenant({
      subjectId: 'legacy-tenant',
      capBytes: 100,
      policy: tenant!.policy,
    })).resolves.toMatchObject({ status: 'replayed' });
    await expect(store.getObject('legacy-tenant', 'legacy-content', 0))
      .resolves.toMatchObject({ versionId: 'legacy-version-1', sizeBytes: 10 });
    await expect(store.getObject('legacy-tenant', 'legacy-incompatible', 0))
      .resolves.toBeNull();
    await expect(store.getLegacyReadiness()).resolves.toEqual({
      legacyObjects: 1,
      legacyBytes: 0,
    });
  });

  it('reads legacy archive identity honestly while excluding it from claim and serve paths', async () => {
    const store = new PostgresArchiveLifecycleStore(new PostgresStoreContext(pool));
    await expect(store.getJob(leasedArchiveJobId)).resolves.toMatchObject({
      jobId: leasedArchiveJobId,
      status: 'quarantined',
      signedJob: null,
      requestDigestHex: null,
      identityStatus: 'legacy_unbound',
    });
    await expect(store.claimJobs({
      workerId: 'verified-worker',
      eligibleStatuses: ['quarantined'],
      limit: 10,
      leaseMs: 60_000,
      nowMs: Date.now(),
    })).resolves.toEqual([]);
    await expect(store.isServeable(pinnedPublicationId, 'legacy-host')).resolves.toBe(false);
    await expect(store.listActiveHosts(pinnedPublicationId)).resolves.toEqual({
      records: [],
      nextCursor: null,
    });
    await expect(store.listObjects(leasedArchiveJobId)).resolves.toEqual([
      expect.objectContaining({
        contentId: leasedContentId,
        objectBytes: 0,
        objectHash: 'legacy-object-hash',
        quarantineKey: '',
        metadataStatus: 'legacy_unbound',
      }),
    ]);
    await expect(store.getLegacyReadiness()).resolves.toEqual({
      legacyJobs: 2,
      legacyLeases: 0,
      legacyActivePins: 1,
      legacyObjects: 2,
      legacyObjectContents: 2,
    });
  });

  it('rejects oversized NCMEC payloads at the database boundary', async () => {
    await expect(pool.query(
      `INSERT INTO moderation.ncmec_reports (
         report_id, status, payload, detected_at
       ) VALUES ('oversized-ncmec-report', 'queued', $1::jsonb, clock_timestamp())`,
      [JSON.stringify({ evidence: 'x'.repeat(65_536) })],
    )).rejects.toMatchObject({ code: '23514' });
  });
});
