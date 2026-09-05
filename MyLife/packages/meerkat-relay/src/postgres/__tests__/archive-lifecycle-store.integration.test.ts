import { createHash, randomUUID } from 'node:crypto';
import {
  createArchiveJob,
  createPublication,
  generateDeviceIdentity,
} from '@mylife/sync';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresArchiveLifecycleStore } from '../stores/archive-lifecycle-store';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;
const SHA_A = 'a'.repeat(64);
const OWNER_HASH = 'b'.repeat(64);

function archiveInput() {
  const now = new Date().toISOString();
  const owner = generateDeviceIdentity(`archive-owner-${randomUUID()}`);
  const publication = createPublication(owner, {
    kind: 'channel',
    communityId: `community-${randomUUID()}`,
    channelId: 'general',
    postId: null,
    title: 'PostgreSQL archive',
    description: 'Archive store integration fixture.',
    category: 'technology',
    contentId: `content-${randomUUID()}`,
    publicKeyHex: 'aabbccddeeff00',
    hostUrls: ['https://archive.example'],
    joinPolicy: 'open',
    now,
  });
  const signedJob = createArchiveJob(owner, publication, {
    tier: 'managed',
    hostUrl: 'https://archive.example',
    objects: [{ index: 0, hash: '00'.repeat(32), size: 1 }],
    rights: {
      license: 'cc_by',
      rightsAssertion: 'i_own',
      provenance: 'Created by the integration fixture owner.',
      consentAt: now,
    },
    now,
  });
  return {
    signedJob,
    idempotencyKey: `archive-${signedJob.job.jobId}`,
    requestDigestHex: createHash('sha256').update(JSON.stringify(signedJob)).digest('hex'),
    ownerSubjectHashHex: OWNER_HASH,
    expectedBytes: 10,
    nowMs: Date.now(),
  };
}

describePostgres('PostgresArchiveLifecycleStore multi-instance integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_archive_${suffix}`;
  let adminPool: Pool;
  let firstPool: Pool;
  let secondPool: Pool;
  let first: PostgresArchiveLifecycleStore;
  let second: PostgresArchiveLifecycleStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Archive integration tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    firstPool = new Pool({ connectionString: databaseUrl.toString(), max: 3 });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({ connectionString: databaseUrl.toString(), max: 3 });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool);
    first = new PostgresArchiveLifecycleStore(new PostgresStoreContext(firstPool));
    second = new PostgresArchiveLifecycleStore(new PostgresStoreContext(secondPool));
  });

  afterAll(async () => {
    await firstPool?.end().catch(() => undefined);
    await secondPool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('binds idempotency to the request digest across two API instances', async () => {
    const input = archiveInput();
    const outcomes = await Promise.all([first.enqueue(input), second.enqueue(input)]);
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(['created', 'replay']);
    await expect(second.enqueue({ ...input, requestDigestHex: 'c'.repeat(64) }))
      .resolves.toEqual({ status: 'conflict' });
  });

  it('serializes owner quota reservations across API instances', async () => {
    // A dedicated owner hash: the digest-idempotency test above already books
    // the fixture's 10 expected bytes against the shared OWNER_HASH, which
    // would exhaust this test's 10-byte cap before either racer starts.
    const quotaOwner = createHash('sha256').update(`quota-owner-${randomUUID()}`).digest('hex');
    const firstInput = { ...archiveInput(), ownerSubjectHashHex: quotaOwner, expectedBytes: 6, ownerCapBytes: 10 };
    const secondInput = { ...archiveInput(), ownerSubjectHashHex: quotaOwner, expectedBytes: 6, ownerCapBytes: 10 };
    const outcomes = await Promise.all([first.enqueue(firstInput), second.enqueue(secondInput)]);
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(['created', 'quota_exceeded']);
    expect(await first.usedBytesForOwner(quotaOwner)).toBe(6);
  });

  it('fences stale scanners and serves only after clean scan, promotion, and pin', async () => {
    const input = archiveInput();
    const created = await first.enqueue(input);
    if (created.status !== 'created') throw new Error('archive fixture enqueue failed');
    const { jobId, publicationId, contentId } = created.job;
    await expect(first.recordQuarantineObject({
      jobId,
      expectedJobVersion: 1,
      objectIndex: 0,
      objectHash: SHA_A,
      objectBytes: 10,
      quarantineKey: `quarantine/${jobId}/0`,
      nowMs: Date.now(),
    })).resolves.toMatchObject({
      status: 'quarantined',
      metadataStatus: 'verified',
    });
    await expect(first.markQuarantined(jobId, 2, Date.now()))
      .resolves.toMatchObject({ status: 'quarantined' });
    expect(await second.isServeable(publicationId, 'host-1')).toBe(false);

    const simultaneous = await Promise.all([
      first.claimJobs({ workerId: 'scanner-a', eligibleStatuses: ['quarantined'], limit: 1, leaseMs: 60_000, nowMs: Date.now() }),
      second.claimJobs({ workerId: 'scanner-b', eligibleStatuses: ['quarantined'], limit: 1, leaseMs: 60_000, nowMs: Date.now() }),
    ]);
    const original = simultaneous.flat()[0];
    expect(simultaneous.flat()).toHaveLength(1);
    if (!original) throw new Error('archive scanner claim failed');
    await firstPool.query(
      `UPDATE archive.jobs SET leased_until = clock_timestamp() - interval '1 second'
       WHERE job_id = $1`,
      [jobId],
    );
    const [replacement] = await second.claimJobs({
      workerId: 'scanner-new', eligibleStatuses: ['scanning'], limit: 1,
      leaseMs: 60_000, nowMs: Date.now(),
    });
    expect(replacement?.fencingToken).toBeGreaterThan(original.fencingToken);
    await expect(first.completeScan({
      jobId,
      workerId: original.job.leaseOwner!,
      fencingToken: original.fencingToken,
      nowMs: Date.now(),
      scanId: randomUUID(),
      engine: 'clamav', engineVersion: '1.4.3', result: 'clean',
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    })).resolves.toBeNull();
    await expect(second.completeScan({
      jobId,
      workerId: 'scanner-new',
      fencingToken: replacement!.fencingToken,
      nowMs: Date.now(),
      scanId: randomUUID(),
      engine: 'clamav', engineVersion: '1.4.3', definitionsVersion: '20260710',
      result: 'clean', evidence: { reference: 'evidence/clean' },
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    })).resolves.toMatchObject({ status: 'approved' });
    expect(await first.isServeable(publicationId, 'host-1')).toBe(false);

    const [promotion] = await first.claimJobs({
      workerId: 'promoter', eligibleStatuses: ['approved'], limit: 1,
      leaseMs: 60_000, nowMs: Date.now(),
    });
    await expect(first.markObjectDurable({
      jobId, workerId: 'promoter', fencingToken: promotion!.fencingToken,
      nowMs: Date.now(), objectIndex: 0,
      durableKey: `durable/${contentId}/0`, storageChecksum: SHA_A,
    })).resolves.toMatchObject({ status: 'durable' });
    await expect(first.activatePin({
      jobId, workerId: 'promoter', fencingToken: promotion!.fencingToken,
      nowMs: Date.now(), hostId: 'host-1',
    })).resolves.toMatchObject({ state: 'active' });
    expect(await second.isServeable(publicationId, 'host-1')).toBe(true);

    const [announcement] = await second.claimJobs({
      workerId: 'announcer', eligibleStatuses: ['pinned'], limit: 1,
      leaseMs: 60_000, nowMs: Date.now(),
    });
    await expect(second.markAnnounced({
      jobId, workerId: 'announcer', fencingToken: announcement!.fencingToken, nowMs: Date.now(),
    })).resolves.toMatchObject({ status: 'announced' });
    await expect(first.requestTakedown(jobId, Date.now()))
      .resolves.toMatchObject({ status: 'takedown_pending' });
    expect(await second.isServeable(publicationId, 'host-1')).toBe(false);
    const [deletion] = await second.claimJobs({
      workerId: 'deleter', eligibleStatuses: ['takedown_pending'], limit: 1,
      leaseMs: 60_000, nowMs: Date.now(),
    });
    await expect(second.markObjectDeleted({
      jobId, workerId: 'deleter', fencingToken: deletion!.fencingToken,
      nowMs: Date.now(), objectIndex: 0, absenceVerified: true,
    })).resolves.toMatchObject({ status: 'deleted' });
    await expect(second.confirmRemoval({
      jobId, workerId: 'deleter', fencingToken: deletion!.fencingToken,
      nowMs: Date.now(), hostId: 'host-1',
    }))
      .resolves.toMatchObject({ status: 'removed' });
  });

  it('keeps scanner outages non-serveable and honors database-owned retry time', async () => {
    const input = { ...archiveInput(), expectedBytes: 0 };
    const created = await first.enqueue(input);
    if (created.status !== 'created') throw new Error('archive fixture enqueue failed');
    await first.markQuarantined(created.job.jobId, 1, Date.now());
    const [claim] = await first.claimJobs({
      workerId: 'scanner-retry', eligibleStatuses: ['quarantined'], limit: 1,
      leaseMs: 60_000, nowMs: Date.now(),
    });
    await expect(first.completeScan({
      jobId: created.job.jobId,
      workerId: 'scanner-retry',
      fencingToken: claim!.fencingToken,
      nowMs: 10_000,
      retryAtMs: 20_000,
      scanId: randomUUID(),
      engine: 'clamav', engineVersion: '1.4.3', result: 'error',
      resultCode: 'definitions_stale',
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    })).resolves.toMatchObject({ status: 'quarantined', lastErrorCode: 'definitions_stale' });
    await expect(second.claimJobs({
      workerId: 'too-early', eligibleStatuses: ['quarantined'], limit: 1,
      leaseMs: 60_000, nowMs: Date.now(),
    })).resolves.toEqual([]);
  });

  it('keeps legacy object metadata out of verified job claims and aggregates', async () => {
    const input = { ...archiveInput(), expectedBytes: 0 };
    const created = await first.enqueue(input);
    if (created.status !== 'created') throw new Error('archive fixture enqueue failed');
    await firstPool.query(
      `INSERT INTO archive.objects (
         content_id, object_index, object_hash, object_bytes, quarantine_key, status
       ) VALUES ($1, 0, 'legacy-object-hash', 0, '', 'quarantined')`,
      [created.job.contentId],
    );
    await expect(first.markQuarantined(created.job.jobId, 1, Date.now())).resolves.toBeNull();
    await firstPool.query(
      `UPDATE archive.jobs SET status = 'review_required' WHERE job_id = $1`,
      [created.job.jobId],
    );
    const claimed = await second.claimJobs({
      workerId: 'legacy-filter', eligibleStatuses: ['review_required'], limit: 100,
      leaseMs: 60_000, nowMs: Date.now(),
    });
    expect(claimed.some((claim) => claim.job.jobId === created.job.jobId)).toBe(false);
    await expect(first.listObjects(created.job.jobId)).resolves.toEqual([
      expect.objectContaining({
        objectBytes: 0,
        objectHash: 'legacy-object-hash',
        metadataStatus: 'legacy_unbound',
      }),
    ]);
  });
});
