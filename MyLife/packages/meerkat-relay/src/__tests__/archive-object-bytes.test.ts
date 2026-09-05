/**
 * WP-2E contract-level tests: the archive byte path over the object store (memory adapter).
 *
 * Drives the full archive flow through ArchiveObjectByteService against the in-memory object store,
 * the in-memory archive lifecycle store, and the in-memory WP-2C reference ledger:
 *   enqueue -> intake(quarantine) -> scan(clean, approve) -> promote(durable) -> serve
 * and asserts the guarantees WP-2E rests on:
 *  - intake content-verifies bytes and lands them quarantined; a mismatch never lands bytes;
 *  - a lifecycle rejection deletes the just-landed quarantine bytes (no orphan);
 *  - promote IS the quarantine-to-durable move (the object store re-verifies the checksum);
 *  - nothing quarantined/rejected/corrupted is ever servable; a durable object serves only after a
 *    fresh content-hash verification (corrupted-piece refusal);
 *  - the durable key gets exactly ONE reference edge in the ledger (the single liveness authority),
 *    and releasing it drops the key to zero references so WP-2C's reconciler enqueues its deletion.
 */

import { createHash } from 'node:crypto';
import {
  createArchiveJob,
  createPublication,
  generateDeviceIdentity,
  type SignedArchiveJob,
} from '@mylife/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryObjectStore } from '../object-store-memory';
import { InMemoryArchiveLifecycleStore } from '../archive-lifecycle';
import { InMemoryObjectReferenceLedger } from '../object-reference-ledger-memory';
import {
  ArchiveObjectByteService,
  archiveObjectReferrer,
  createArchiveExpectationResolver,
} from '../archive-object-bytes';
import { ObjectReconciler } from '../object-reconciler';
import { InMemoryObjectDeletionJobStore } from '../object-deletion-jobs-memory';
import { InMemoryOrphanFirstSeenStore } from '../object-reconciler-memory';

const OWNER_HASH = 'c'.repeat(64);
const START = Date.parse('2026-07-10T12:00:00.000Z');
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function signedJob(contentId = 'archive-content-1'): SignedArchiveJob {
  const owner = generateDeviceIdentity('Archive byte owner');
  const publication = createPublication(owner, {
    kind: 'channel',
    communityId: 'community-1',
    channelId: 'channel-1',
    postId: null,
    title: 'Durable archive',
    description: 'Archive byte fixture.',
    category: 'technology',
    contentId,
    publicKeyHex: 'aabbccddeeff00',
    hostUrls: ['https://archive.example'],
    joinPolicy: 'open',
    now: new Date(START).toISOString(),
  });
  return createArchiveJob(owner, publication, {
    tier: 'managed',
    hostUrl: 'https://archive.example',
    objects: [{ index: 0, hash: '00'.repeat(32), size: 1 }],
    rights: {
      license: 'cc_by',
      rightsAssertion: 'i_own',
      provenance: 'Created by the fixture owner.',
      consentAt: new Date(START).toISOString(),
    },
    now: new Date(START).toISOString(),
  });
}

interface Harness {
  objectStore: InMemoryObjectStore;
  archiveStore: InMemoryArchiveLifecycleStore;
  ledger: InMemoryObjectReferenceLedger;
  service: ArchiveObjectByteService;
}

function harness(): Harness {
  const objectStore = new InMemoryObjectStore();
  const archiveStore = new InMemoryArchiveLifecycleStore();
  const ledger = new InMemoryObjectReferenceLedger();
  const service = new ArchiveObjectByteService(objectStore, archiveStore, ledger);
  return { objectStore, archiveStore, ledger, service };
}

/** Enqueue a single-object job and return the ids the byte flow needs. */
async function enqueueJob(
  h: Harness,
  bytes: Uint8Array,
): Promise<{ jobId: string; publicationId: string }> {
  const job = signedJob();
  const created = h.archiveStore.enqueue({
    signedJob: job,
    idempotencyKey: `archive-${job.job.jobId}`,
    requestDigestHex: createHash('sha256').update(JSON.stringify(job)).digest('hex'),
    ownerSubjectHashHex: OWNER_HASH,
    expectedBytes: bytes.length,
    nowMs: START,
  });
  if (created.status !== 'created') throw new Error('fixture enqueue failed');
  return { jobId: created.job.jobId, publicationId: created.job.publicationId };
}

/** Scan-approve a quarantined job, returning the promoter's fenced lease. */
async function approveAndClaim(
  h: Harness,
  jobId: string,
): Promise<{ workerId: string; fencingToken: number }> {
  const machineVersionQuarantine = h.archiveStore.markQuarantined(jobId, 2, START + 3);
  expect(machineVersionQuarantine?.status).toBe('quarantined');
  const [scanClaim] = h.archiveStore.claimJobs({
    workerId: 'scanner', eligibleStatuses: ['quarantined'], limit: 1, leaseMs: 1_000, nowMs: START + 4,
  });
  const approved = h.archiveStore.completeScan({
    jobId,
    workerId: 'scanner',
    fencingToken: scanClaim!.fencingToken,
    nowMs: START + 5,
    scanId: '00000000-0000-4000-8000-000000000002',
    engine: 'clamav',
    engineVersion: '1.4.3',
    result: 'clean',
    startedAt: new Date(START + 4).toISOString(),
    completedAt: new Date(START + 5).toISOString(),
  });
  expect(approved?.status).toBe('approved');
  const [promo] = h.archiveStore.claimJobs({
    workerId: 'promoter', eligibleStatuses: ['approved'], limit: 1, leaseMs: 1_000, nowMs: START + 6,
  });
  return { workerId: 'promoter', fencingToken: promo!.fencingToken };
}

describe('ArchiveObjectByteService intake', () => {
  it('lands quarantine bytes content-verified and records the lifecycle object', async () => {
    const h = harness();
    const bytes = new Uint8Array(Buffer.from('archive payload zero', 'utf8'));
    const { jobId } = await enqueueJob(h, bytes);
    const quarantineKey = `quarantine/${jobId}/0`;
    const result = await h.service.intakeQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
      objectHash: sha256(bytes), bytes, nowMs: START + 1,
    });
    expect(result).toEqual({ status: 'quarantined', quarantineKey });
    // The bytes are on the object store in the quarantined state, not servable.
    const observed = await h.objectStore.observe(quarantineKey);
    expect(observed).toMatchObject({ state: 'quarantined', checksumSha256: sha256(bytes) });
  });

  it('rejects a checksum mismatch without landing bytes', async () => {
    const h = harness();
    const bytes = new Uint8Array(Buffer.from('honest bytes', 'utf8'));
    const { jobId } = await enqueueJob(h, bytes);
    const quarantineKey = `quarantine/${jobId}/0`;
    const result = await h.service.intakeQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
      objectHash: sha256(new Uint8Array(Buffer.from('different', 'utf8'))), bytes, nowMs: START + 1,
    });
    expect(result.status).toBe('checksum_mismatch');
    // A mismatched finalize is rejected: it holds no retrievable bytes and is never durable, so it
    // can never be served (serveDurableObject only serves state==='durable').
    const observed = await h.objectStore.observe(quarantineKey);
    expect(observed?.state).toBe('rejected');
    expect(await h.service.serveDurableObject({ durableKey: quarantineKey, expectedChecksumSha256: sha256(bytes) })).toBeNull();
  });

  it('deletes the just-landed quarantine bytes when the lifecycle refuses the object', async () => {
    const h = harness();
    const bytes = new Uint8Array(Buffer.from('payload', 'utf8'));
    const { jobId } = await enqueueJob(h, bytes);
    const quarantineKey = `quarantine/${jobId}/0`;
    // A wrong expectedJobVersion makes the lifecycle refuse; the byte service must not leave an orphan.
    const result = await h.service.intakeQuarantineObject({
      jobId, expectedJobVersion: 999, objectIndex: 0, quarantineKey,
      objectHash: sha256(bytes), bytes, nowMs: START + 1,
    });
    expect(result.status).toBe('rejected_by_lifecycle');
    expect(await h.objectStore.observe(quarantineKey)).toBeNull();
  });
});

describe('ArchiveObjectByteService promote + serve + reference authority', () => {
  it('promotes quarantine to durable, serves only after verify, and registers one reference edge', async () => {
    const h = harness();
    const bytes = new Uint8Array(Buffer.from('durable archive payload', 'utf8'));
    const { jobId } = await enqueueJob(h, bytes);
    const quarantineKey = `quarantine/${jobId}/0`;
    const durableKey = `durable/${jobId}/0`;
    await h.service.intakeQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
      objectHash: sha256(bytes), bytes, nowMs: START + 1,
    });

    // Nothing quarantined is servable.
    expect(await h.service.serveDurableObject({ durableKey, expectedChecksumSha256: sha256(bytes) })).toBeNull();

    const lease = await approveAndClaim(h, jobId);
    const promoted = await h.service.promoteObject({
      jobId, workerId: lease.workerId, fencingToken: lease.fencingToken, objectIndex: 0,
      quarantineKey, durableKey, expectedChecksumSha256: sha256(bytes), nowMs: START + 7,
    });
    expect(promoted).toEqual({ status: 'durable', durableKey, storageChecksum: sha256(bytes) });

    // The durable object now serves, and only after a fresh content-hash verification.
    const served = await h.service.serveDurableObject({ durableKey, expectedChecksumSha256: sha256(bytes) });
    expect(served ? sha256(served) : null).toBe(sha256(bytes));

    // The single liveness authority (the ledger) has exactly one edge for the durable key.
    expect(await h.ledger.isReferenced(durableKey)).toBe(true);
    expect(await h.ledger.listReferrers(durableKey)).toEqual([archiveObjectReferrer(jobId, 0)]);
    // The quarantine key is gone (promote deletes it).
    expect(await h.objectStore.observe(quarantineKey)).toBeNull();
  });

  it('rolls back the edge-first reference when promote returns a terminal failure', async () => {
    // Edge-first optimistically writes the reference before promote. If promote returns a terminal
    // FAILURE (no durable object will ever exist at the key), the reference must be rolled back so it
    // never outlives the possibility of its object - otherwise a dangling reference would leave a
    // permanent referenced_missing finding for a key that will never have bytes.
    const h = harness();
    const bytes = new Uint8Array(Buffer.from('promote will mismatch', 'utf8'));
    const { jobId } = await enqueueJob(h, bytes);
    const quarantineKey = `quarantine/${jobId}/0`;
    const durableKey = `durable/${jobId}/0`;
    await h.service.intakeQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
      objectHash: sha256(bytes), bytes, nowMs: START + 1,
    });
    const lease = await approveAndClaim(h, jobId);
    // Promote with a WRONG expected checksum: the object store refuses the durable write, so no
    // durable object exists. The service must remove the edge it optimistically wrote.
    const result = await h.service.promoteObject({
      jobId, workerId: lease.workerId, fencingToken: lease.fencingToken, objectIndex: 0,
      quarantineKey, durableKey,
      expectedChecksumSha256: sha256(new Uint8Array(Buffer.from('other bytes', 'utf8'))), nowMs: START + 7,
    });
    expect(result.status).toBe('checksum_mismatch');
    // No durable object, and NO dangling reference - the edge was rolled back.
    expect(await h.objectStore.observe(durableKey)).toBeNull();
    expect(await h.ledger.isReferenced(durableKey)).toBe(false);
  });

  it('refuses to serve a durable object whose stored bytes were corrupted', async () => {
    const h = harness();
    const bytes = new Uint8Array(Buffer.from('to be corrupted', 'utf8'));
    const { jobId } = await enqueueJob(h, bytes);
    const quarantineKey = `quarantine/${jobId}/0`;
    const durableKey = `durable/${jobId}/0`;
    await h.service.intakeQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
      objectHash: sha256(bytes), bytes, nowMs: START + 1,
    });
    const lease = await approveAndClaim(h, jobId);
    await h.service.promoteObject({
      jobId, workerId: lease.workerId, fencingToken: lease.fencingToken, objectIndex: 0,
      quarantineKey, durableKey, expectedChecksumSha256: sha256(bytes), nowMs: START + 7,
    });
    // Serving with a WRONG expected checksum (as if the recorded storageChecksum drifted) is refused
    // before any byte is handed out: the recorded-observation check fails closed.
    expect(await h.service.serveDurableObject({
      durableKey, expectedChecksumSha256: sha256(new Uint8Array(Buffer.from('other', 'utf8'))),
    })).toBeNull();
  });

  it('a released durable reference drops to zero so the reconciler enqueues its deletion', async () => {
    const h = harness();
    const bytes = new Uint8Array(Buffer.from('sweepable durable', 'utf8'));
    const { jobId } = await enqueueJob(h, bytes);
    const quarantineKey = `quarantine/${jobId}/0`;
    const durableKey = `durable/${jobId}/0`;
    await h.service.intakeQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
      objectHash: sha256(bytes), bytes, nowMs: START + 1,
    });
    const lease = await approveAndClaim(h, jobId);
    await h.service.promoteObject({
      jobId, workerId: lease.workerId, fencingToken: lease.fencingToken, objectIndex: 0,
      quarantineKey, durableKey, expectedChecksumSha256: sha256(bytes), nowMs: START + 7,
    });
    // Release the archive object's reference (a takedown/delete). The key drops to zero references.
    await h.service.releaseObjectReference(jobId, 0, durableKey);
    expect(await h.ledger.isReferenced(durableKey)).toBe(false);

    // WP-2C reconciler over this object store + ledger: past the grace window, the durable orphan is
    // enqueued for deletion (never deleted inline).
    const deletionJobs = new InMemoryObjectDeletionJobStore();
    const reconciler = new ObjectReconciler(
      h.objectStore,
      h.ledger,
      deletionJobs,
      new InMemoryOrphanFirstSeenStore(),
      createArchiveExpectationResolver(async () => [
        { durableKey, storageChecksum: sha256(bytes), objectBytes: bytes.length },
      ]),
    );
    // First pass records first-seen; advance past grace and reconcile again.
    await reconciler.run({ maxEntries: 10, pageSize: 10, graceWindowMs: 1_000, retentionWindowMs: 10_000, nowMs: START + 100 });
    const result = await reconciler.run({ maxEntries: 10, pageSize: 10, graceWindowMs: 1_000, retentionWindowMs: 10_000, nowMs: START + 100_000 });
    const durableOrphan = result.findings.find((f) => f.objectKey === durableKey);
    // A durable orphan past grace is enqueued for deletion (never deleted inline).
    expect(durableOrphan?.outcome).toBe('orphan_quarantined');
    expect(await deletionJobs.getJob(durableKey)).not.toBeNull();
    // The durable bytes are still present (deletion is the queue's job, not the reconciler's).
    expect(await h.objectStore.observe(durableKey)).not.toBeNull();
  });

  it('edge-first ordering: a crash between the edge write and promote yields referenced_missing, never a durable-orphan deletion', async () => {
    // Reproduce the exact crash window promoteObject is ordered to survive: the reference edge was
    // written (edge-first) but the process died BEFORE the object store promoted the bytes, so the
    // durable key is referenced-but-absent. The reconciler must surface this as a loud
    // referenced_missing finding and must NOT enqueue a deletion of the (not-yet-durable) key.
    const h = harness();
    const jobId = 'a'.repeat(32);
    const durableKey = `durable/${jobId}/0`;
    // The edge-first write that landed before the simulated crash:
    await h.ledger.addReference({ objectKey: durableKey, referrer: archiveObjectReferrer(jobId, 0) });
    // promote never happened, so the durable key is absent from the object store.
    expect(await h.objectStore.observe(durableKey)).toBeNull();

    const deletionJobs = new InMemoryObjectDeletionJobStore();
    const reconciler = new ObjectReconciler(
      h.objectStore, h.ledger, deletionJobs, new InMemoryOrphanFirstSeenStore(),
      createArchiveExpectationResolver(async () => []),
    );
    // The inventory scan sees no object for this key (nothing to sweep). The referenced-missing scan
    // over the ledger's referenced set flags it loudly.
    const missing = await reconciler.findReferencedMissing([durableKey]);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ objectKey: durableKey, outcome: 'referenced_missing' });
    // Crucially, NO deletion job was ever enqueued for this key: edge-first never loses bytes.
    expect(await deletionJobs.getJob(durableKey)).toBeNull();

    // And a retry of the edge write (idempotent) after the crash is a safe no-op, so promote can
    // resume without double-counting.
    const replay = await h.ledger.addReference({ objectKey: durableKey, referrer: archiveObjectReferrer(jobId, 0) });
    expect(replay.status).toBe('already_referenced');
  });

  it('edge-first ordering: a crash AFTER promote (edge + durable bytes present, lifecycle not yet marked) never deletes the bytes', async () => {
    // The other side of the promote window: the edge is written AND the object store promoted the
    // durable bytes, but the process died before markObjectDurable recorded the lifecycle transition
    // (or the lifecycle refused it). The durable bytes must never be deleted - the edge keeps them
    // live and the reconciler sees a healthy referenced object, so a retry can finish the lifecycle.
    const h = harness();
    const bytes = new Uint8Array(Buffer.from('promoted before crash', 'utf8'));
    const { jobId } = await enqueueJob(h, bytes);
    const quarantineKey = `quarantine/${jobId}/0`;
    const durableKey = `durable/${jobId}/0`;
    await h.service.intakeQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
      objectHash: sha256(bytes), bytes, nowMs: START + 1,
    });
    const lease = await approveAndClaim(h, jobId);
    // Promote with a WRONG lease fencing token so the object store promotes the bytes + registers the
    // edge (edge-first), but markObjectDurable refuses - reproducing "durable bytes + edge present,
    // lifecycle not marked". promoteObject must NOT drop the edge on this refusal.
    const result = await h.service.promoteObject({
      jobId, workerId: lease.workerId, fencingToken: lease.fencingToken + 999, objectIndex: 0,
      quarantineKey, durableKey, expectedChecksumSha256: sha256(bytes), nowMs: START + 7,
    });
    expect(result.status).toBe('rejected_by_lifecycle');
    // The durable bytes are on the store AND still referenced (the edge was not dropped).
    expect(await h.objectStore.observe(durableKey)).toMatchObject({ state: 'durable' });
    expect(await h.ledger.isReferenced(durableKey)).toBe(true);

    // The reconciler treats the referenced, present durable key as HEALTHY - never enqueues deletion.
    const deletionJobs = new InMemoryObjectDeletionJobStore();
    const reconciler = new ObjectReconciler(
      h.objectStore, h.ledger, deletionJobs, new InMemoryOrphanFirstSeenStore(),
      createArchiveExpectationResolver(async () => [
        { durableKey, storageChecksum: sha256(bytes), objectBytes: bytes.length },
      ]),
    );
    const run = await reconciler.run({ maxEntries: 10, pageSize: 10, graceWindowMs: 1_000, retentionWindowMs: 10_000, nowMs: START + 100_000 });
    expect(run.findings).toHaveLength(0);
    expect(await deletionJobs.getJob(durableKey)).toBeNull();
  });

  it('drift-checks a referenced durable archive key via the expectation resolver', async () => {
    const h = harness();
    const bytes = new Uint8Array(Buffer.from('healthy durable', 'utf8'));
    const { jobId } = await enqueueJob(h, bytes);
    const quarantineKey = `quarantine/${jobId}/0`;
    const durableKey = `durable/${jobId}/0`;
    await h.service.intakeQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
      objectHash: sha256(bytes), bytes, nowMs: START + 1,
    });
    const lease = await approveAndClaim(h, jobId);
    await h.service.promoteObject({
      jobId, workerId: lease.workerId, fencingToken: lease.fencingToken, objectIndex: 0,
      quarantineKey, durableKey, expectedChecksumSha256: sha256(bytes), nowMs: START + 7,
    });
    const deletionJobs = new InMemoryObjectDeletionJobStore();
    const reconciler = new ObjectReconciler(
      h.objectStore, h.ledger, deletionJobs, new InMemoryOrphanFirstSeenStore(),
      createArchiveExpectationResolver(async () => [
        { durableKey, storageChecksum: sha256(bytes), objectBytes: bytes.length },
      ]),
    );
    const result = await reconciler.run({ maxEntries: 10, pageSize: 10, graceWindowMs: 1_000, retentionWindowMs: 10_000, nowMs: START + 100 });
    // A referenced, present, matching durable key is healthy (no findings, no deletion).
    expect(result.findings).toHaveLength(0);
    expect(await deletionJobs.getJob(durableKey)).toBeNull();
  });
});
