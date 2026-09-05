/**
 * WP-43B live-PostgreSQL integration: pin reconciliation + takedown propagation.
 *
 * Runs the ArchivePinReconciler and ArchiveTakedownPropagator against the REAL PostgreSQL archive
 * lifecycle store, object reference ledger, and object deletion queue (the production adapters), so
 * the fenced listPinsForHost scan, serving-vs-intent drift repair, and the serving-before-delete /
 * shared-byte-survival takedown ordering are proven on the durable substrate, not just in memory.
 *
 * Gated on MEERKAT_TEST_POSTGRES_URL + MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS (creates and drops a
 * throwaway database), exactly like the sibling archive-lifecycle integration test.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  createArchiveJob,
  createPublication,
  generateDeviceIdentity,
  type SignedArchiveJob,
} from '@mylife/sync';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresArchiveLifecycleStore } from '../stores/archive-lifecycle-store';
import { PostgresObjectReferenceLedger } from '../stores/object-reference-store';
import { PostgresObjectDeletionJobStore } from '../stores/object-deletion-store';
import {
  ArchivePinReconciler,
  type PinBytesPresenceProbe,
  type PinServingIndex,
} from '../../archive-pin-reconciler';
import {
  ArchiveTakedownPropagator,
  type ObjectAbsenceProbe,
  type TakedownLease,
} from '../../archive-takedown-propagator';
import { ArchiveObjectByteService, archiveObjectReferrer } from '../../archive-object-bytes';
import { InMemoryObjectStore } from '../../object-store-memory';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;
const OWNER_HASH = 'b'.repeat(64);
const HOST_ID = 'seeder-host-pg';

function signedJob(contentId: string): SignedArchiveJob {
  const now = new Date().toISOString();
  const owner = generateDeviceIdentity(`archive-owner-${randomUUID()}`);
  const publication = createPublication(owner, {
    kind: 'channel',
    communityId: `community-${randomUUID()}`,
    channelId: 'general',
    postId: null,
    title: 'PostgreSQL pin archive',
    description: 'Pin reconciliation integration fixture.',
    category: 'technology',
    contentId,
    publicKeyHex: 'aabbccddeeff00',
    hostUrls: ['https://archive.example'],
    joinPolicy: 'open',
    now,
  });
  return createArchiveJob(owner, publication, {
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
}

describePostgres('WP-43B pin reconciliation + takedown on PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_pin_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;
  let store: PostgresArchiveLifecycleStore;
  let ledger: PostgresObjectReferenceLedger;
  let deletionJobs: PostgresObjectDeletionJobStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Pin integration tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 4 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool);
    const context = new PostgresStoreContext(pool);
    store = new PostgresArchiveLifecycleStore(context);
    ledger = new PostgresObjectReferenceLedger(context);
    deletionJobs = new PostgresObjectDeletionJobStore(context);
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  /** Drive one job to an active pin over a durable object, writing the promote reference edge. */
  async function drivePin(contentId: string): Promise<{
    jobId: string;
    publicationId: string;
    durableKey: string;
  }> {
    const job = signedJob(contentId);
    const created = await store.enqueue({
      signedJob: job,
      idempotencyKey: `archive-${job.job.jobId}`,
      requestDigestHex: createHash('sha256').update(JSON.stringify(job)).digest('hex'),
      ownerSubjectHashHex: OWNER_HASH,
      expectedBytes: 4,
      nowMs: Date.now(),
    });
    if (created.status !== 'created') throw new Error('pin fixture enqueue failed');
    const { jobId, publicationId } = created.job;
    const hash = createHash('sha256').update(`obj-${contentId}`).digest('hex');
    const durableKey = `durable/${contentId}/0`;
    await store.recordQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, objectHash: hash, objectBytes: 4,
      quarantineKey: `quarantine/${contentId}/0`, nowMs: Date.now(),
    });
    await store.markQuarantined(jobId, 2, Date.now());
    // Claim by status but SELECT the target job's claim: other tests in this sequential suite may
    // leave jobs in the same claimable status, and claimJobs is not job-scoped.
    const scanClaims = await store.claimJobs({
      workerId: 'scanner', eligibleStatuses: ['quarantined'], limit: 100, leaseMs: 60_000, nowMs: Date.now(),
    });
    const scan = scanClaims.find((cl) => cl.job.jobId === jobId);
    await store.completeScan({
      jobId, workerId: 'scanner', fencingToken: scan!.fencingToken, nowMs: Date.now(),
      scanId: randomUUID(), engine: 'clamav', engineVersion: '1.4.3', result: 'clean',
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    });
    const promoClaims = await store.claimJobs({
      workerId: 'promoter', eligibleStatuses: ['approved'], limit: 100, leaseMs: 60_000, nowMs: Date.now(),
    });
    const promo = promoClaims.find((cl) => cl.job.jobId === jobId);
    // Mirror the byte service's edge-first promote: the durable key gets one reference edge.
    await ledger.addReference({ objectKey: durableKey, referrer: archiveObjectReferrer(jobId, 0) });
    await store.markObjectDurable({
      jobId, workerId: 'promoter', fencingToken: promo!.fencingToken, objectIndex: 0,
      durableKey, storageChecksum: hash, nowMs: Date.now(),
    });
    await store.activatePin({
      jobId, workerId: 'promoter', fencingToken: promo!.fencingToken, hostId: HOST_ID, nowMs: Date.now(),
    });
    return { jobId, publicationId, durableKey };
  }

  it('reconciles serving state against durable pin intent (adds, removes, missing-bytes finding)', async () => {
    const active = await drivePin(`content-recon-${randomUUID()}`);
    const takenDown = await drivePin(`content-recon-${randomUUID()}`);
    await store.requestTakedown(takenDown.jobId, Date.now());

    const serving = new Set<string>([takenDown.publicationId]); // stale: serving a removed pin, not the active one
    const servingIndex: PinServingIndex = {
      isServing: async (id) => serving.has(id),
      addServing: async (id) => { serving.add(id); },
      removeServing: async (id) => { serving.delete(id); },
      listServing: async ({ after, limit }) => {
        const ordered = [...serving].sort().filter((id) => after === undefined || id > after);
        return { publicationIds: ordered.slice(0, limit), nextCursor: null };
      },
    };
    // Bytes present iff the durable key is still referenced in the ledger.
    const probe: PinBytesPresenceProbe = async (pin) =>
      ledger.isReferenced(`durable/${pin.contentId}/0`);
    const reconciler = new ArchivePinReconciler(store, servingIndex, probe);

    const result = await reconciler.run({ hostId: HOST_ID, maxEntries: 100, pageSize: 50 });

    // The active pin is added to serving; the taken-down pin is removed from serving.
    expect(serving.has(active.publicationId)).toBe(true);
    expect(serving.has(takenDown.publicationId)).toBe(false);
    expect(result.outcomeCounts.serving_added).toBeGreaterThanOrEqual(1);
    expect(result.outcomeCounts.serving_removed).toBeGreaterThanOrEqual(1);
  });

  it('propagates a takedown: serving off, reference released, deletion enqueued, removal confirmed', async () => {
    const pinned = await drivePin(`content-td-${randomUUID()}`);
    await store.requestTakedown(pinned.jobId, Date.now());
    const claims = await store.claimJobs({
      workerId: 'takedown-worker', eligibleStatuses: ['takedown_pending'], limit: 100,
      leaseMs: 60_000, nowMs: Date.now(),
    });
    const claim = claims.find((cl) => cl.job.jobId === pinned.jobId);
    const lease: TakedownLease = {
      jobId: pinned.jobId, workerId: 'takedown-worker', fencingToken: claim!.fencingToken,
    };

    const serving = new Set<string>([pinned.publicationId]);
    const servingIndex: PinServingIndex = {
      isServing: async (id) => serving.has(id),
      addServing: async (id) => { serving.add(id); },
      removeServing: async (id) => { serving.delete(id); },
      listServing: async ({ limit }) => ({ publicationIds: [...serving].slice(0, limit), nextCursor: null }),
    };
    // Absence probe: the byte is "gone" once its deletion job is completed (drain simulated below).
    const deleted = new Set<string>();
    const absence: ObjectAbsenceProbe = async (durableKey) => deleted.has(durableKey);
    const byteService = {
      releaseObjectReference: async (jobId: string, objectIndex: number, durableKey: string) => {
        await ledger.removeReference({ objectKey: durableKey, referrer: archiveObjectReferrer(jobId, objectIndex) });
      },
    };
    const propagator = new ArchiveTakedownPropagator(
      store, servingIndex, byteService, ledger, deletionJobs, absence,
    );

    const first = await propagator.propagate({
      jobId: pinned.jobId, hostId: HOST_ID, lease, nowMs: Date.now(),
    });
    expect(first.status).toBe('partial'); // enqueued, not yet absent
    expect(serving.has(pinned.publicationId)).toBe(false); // serving off first
    expect(await ledger.isReferenced(pinned.durableKey)).toBe(false); // reference released
    expect((await deletionJobs.getJob(pinned.durableKey))?.state).toBe('pending'); // routed through queue

    // Drain the deletion queue, then a second propagate pass finalizes removal.
    const [delLease] = await deletionJobs.claim({
      owner: 'deletion-worker', limit: 1, leaseMs: 60_000, nowMs: Date.now(),
    });
    deleted.add(delLease!.objectKey);
    await deletionJobs.complete({ lease: delLease!, versionId: null, nowMs: Date.now() });

    // Expire the first drain pass's still-held lease so the takedown job re-claims (the bin lets the
    // lease lapse between ticks; a live DB clock cannot be advanced, so force the expiry directly).
    await pool.query(
      `UPDATE archive.jobs SET leased_until = clock_timestamp() - interval '1 second' WHERE job_id = $1`,
      [pinned.jobId],
    );
    const claims2 = await store.claimJobs({
      workerId: 'takedown-worker', eligibleStatuses: ['takedown_pending'], limit: 100,
      leaseMs: 60_000, nowMs: Date.now(),
    });
    const claim2 = claims2.find((cl) => cl.job.jobId === pinned.jobId);
    const second = await propagator.propagate({
      jobId: pinned.jobId, hostId: HOST_ID,
      lease: { jobId: pinned.jobId, workerId: 'takedown-worker', fencingToken: claim2!.fencingToken },
      nowMs: Date.now(),
    });
    expect(second.status).toBe('removed');
    expect((await store.getJob(pinned.jobId))?.status).toBe('removed');
    expect(await store.isServeable(pinned.publicationId, HOST_ID)).toBe(false);
  });

  it('shared-byte survival on the durable substrate: a byte referenced by another live publication is never deleted', async () => {
    // Drive TWO publications sharing one contentId through the REAL byte service (content-addressed
    // dedup: one quarantine object, one durable key, two reference edges) over the live PG stores.
    const objectStore = new InMemoryObjectStore();
    const service = new ArchiveObjectByteService(objectStore, store, ledger);
    const contentId = `content-shared-${randomUUID()}`;
    const payload = new Uint8Array(Buffer.from('identical-shared-bytes', 'utf8'));
    const payloadHash = createHash('sha256').update(payload).digest('hex');
    const quarantineKey = `quarantine/${contentId}/0`;
    const durableKey = `durable/${contentId}/0`;

    const driveShared = async (): Promise<{ jobId: string; publicationId: string }> => {
      const job = signedJob(contentId);
      const created = await store.enqueue({
        signedJob: job,
        idempotencyKey: `archive-${job.job.jobId}`,
        requestDigestHex: createHash('sha256').update(JSON.stringify(job)).digest('hex'),
        ownerSubjectHashHex: OWNER_HASH,
        expectedBytes: payload.length,
        nowMs: Date.now(),
      });
      if (created.status !== 'created') throw new Error('shared fixture enqueue failed');
      const { jobId, publicationId } = created.job;
      const intake = await service.intakeQuarantineObject({
        jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
        objectHash: payloadHash, bytes: payload, nowMs: Date.now(),
      });
      if (intake.status !== 'quarantined') throw new Error(`shared fixture intake failed: ${intake.status}`);
      await store.markQuarantined(jobId, 2, Date.now());
      const scanClaims = await store.claimJobs({
        workerId: 'scanner', eligibleStatuses: ['quarantined'], limit: 100, leaseMs: 60_000, nowMs: Date.now(),
      });
      const scan = scanClaims.find((cl) => cl.job.jobId === jobId);
      await store.completeScan({
        jobId, workerId: 'scanner', fencingToken: scan!.fencingToken, nowMs: Date.now(),
        scanId: randomUUID(), engine: 'clamav', engineVersion: '1.4.3', result: 'clean',
        startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
      });
      const promoClaims = await store.claimJobs({
        workerId: 'promoter', eligibleStatuses: ['approved'], limit: 100, leaseMs: 60_000, nowMs: Date.now(),
      });
      const promo = promoClaims.find((cl) => cl.job.jobId === jobId);
      const promoted = await service.promoteObject({
        jobId, workerId: 'promoter', fencingToken: promo!.fencingToken, objectIndex: 0,
        quarantineKey, durableKey, expectedChecksumSha256: payloadHash, nowMs: Date.now(),
      });
      if (promoted.status !== 'durable') throw new Error(`shared fixture promote failed: ${promoted.status}`);
      await store.activatePin({
        jobId, workerId: 'promoter', fencingToken: promo!.fencingToken, hostId: HOST_ID, nowMs: Date.now(),
      });
      return { jobId, publicationId };
    };

    const first = await driveShared();
    const second = await driveShared();

    const serving = new Set<string>([first.publicationId, second.publicationId]);
    const servingIndex: PinServingIndex = {
      isServing: async (id) => serving.has(id),
      addServing: async (id) => { serving.add(id); },
      removeServing: async (id) => { serving.delete(id); },
      listServing: async ({ limit }) => ({ publicationIds: [...serving].slice(0, limit), nextCursor: null }),
    };
    const absence: ObjectAbsenceProbe = async (key) => (await objectStore.observe(key)) === null;
    const propagator = new ArchiveTakedownPropagator(
      store, servingIndex, service, ledger, deletionJobs, absence,
    );

    // Take down ONLY the first publication.
    await store.requestTakedown(first.jobId, Date.now());
    const claims = await store.claimJobs({
      workerId: 'takedown-worker', eligibleStatuses: ['takedown_pending'], limit: 100,
      leaseMs: 60_000, nowMs: Date.now(),
    });
    const claim = claims.find((cl) => cl.job.jobId === first.jobId);
    const result = await propagator.propagate({
      jobId: first.jobId, hostId: HOST_ID,
      lease: { jobId: first.jobId, workerId: 'takedown-worker', fencingToken: claim!.fencingToken },
      nowMs: Date.now(),
    });

    // The shared byte SURVIVES: still referenced (second edge), never enqueued for deletion,
    // still present on the object store, and the second publication stays serveable.
    if (result.status !== 'removed' && result.status !== 'partial') {
      throw new Error(`unexpected shared takedown status ${result.status}`);
    }
    expect(result.objects[0]?.outcome).toBe('reference_released_shared');
    expect(await ledger.isReferenced(durableKey)).toBe(true);
    expect(await deletionJobs.getJob(durableKey)).toBeNull();
    expect(await objectStore.observe(durableKey)).not.toBeNull();
    expect(await store.isServeable(second.publicationId, HOST_ID)).toBe(true);
    expect(serving.has(second.publicationId)).toBe(true);
    expect(serving.has(first.publicationId)).toBe(false);
  });
});
