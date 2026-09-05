/**
 * WP-43B takedown propagation tests.
 *
 * Drives a terminal takedown across the serving index, the WP-2C reference ledger, and the deletion
 * queue over the real in-memory substrate. Proves the load-bearing guarantees:
 *  - the serving-index entry is removed BEFORE any byte deletion (NC-43.4);
 *  - a byte still referenced by another active publication SURVIVES (AC-43.5);
 *  - byte deletion is ROUTED THROUGH the WP-2C deletion queue, never inline;
 *  - the flow is restart-safe and idempotent.
 */

import { describe, expect, it } from 'vitest';
import { ArchiveTakedownPropagator, type ObjectAbsenceProbe } from '../archive-takedown-propagator';
import type { TakedownLease } from '../archive-takedown-propagator';
import {
  drivePinnedJob,
  pinHarness,
  FakeServingIndex,
  HOST_ID,
  START,
  type PinHarness,
} from './support/archive-pin-fixtures';

/**
 * Claim a fenced takedown lease over a SPECIFIC takedown_pending job. The bin drains all
 * takedown_pending jobs; the test targets one, so it claims the batch and returns the matching job's
 * fencing token (other claimed jobs simply hold a harmless lease for the test's duration).
 */
async function takedownLease(h: PinHarness, jobId: string, nowMs: number): Promise<TakedownLease> {
  const claims = await h.archiveStore.claimJobs({
    workerId: 'takedown-worker', eligibleStatuses: ['takedown_pending'], limit: 100,
    leaseMs: 10_000, nowMs,
  });
  const claim = claims.find((c) => c.job.jobId === jobId);
  if (!claim) throw new Error('takedown claim failed');
  return { jobId, workerId: 'takedown-worker', fencingToken: claim.fencingToken };
}

/** Absence is true iff the object store no longer observes the durable key. */
function absenceProbe(h: PinHarness): ObjectAbsenceProbe {
  return async (durableKey) => (await h.objectStore.observe(durableKey)) === null;
}

/** Simulate the deletion-queue worker removing the bytes for every enqueued key. */
async function drainDeletionQueue(h: PinHarness): Promise<string[]> {
  const drained: string[] = [];
  const leases = await h.deletionJobs.claim({
    owner: 'deletion-worker', limit: 100, leaseMs: 10_000, nowMs: START + 500,
  });
  for (const lease of leases) {
    await h.objectStore.deleteObject(lease.objectKey);
    await h.deletionJobs.complete({ lease, versionId: null, nowMs: START + 501 });
    drained.push(lease.objectKey);
  }
  return drained;
}

describe('ArchiveTakedownPropagator serving-before-delete ordering', () => {
  it('removes the serving entry before enqueuing any byte deletion', async () => {
    const h = pinHarness();
    const pinned = await drivePinnedJob(h, { contentId: 'content-td', suffix: 'td' });
    const serving = new FakeServingIndex([pinned.publicationId]);
    const events: string[] = [];
    // Wrap the serving index and deletion queue to record ordering.
    const trackingServing = {
      isServing: (id: string) => serving.isServing(id),
      addServing: (id: string) => serving.addServing(id),
      removeServing: async (id: string) => { events.push('serving_removed'); await serving.removeServing(id); },
      listServing: (i: { after?: string; limit: number }) => serving.listServing(i),
    };
    const trackingDeletion = {
      enqueue: async (key: string, nowMs: number) => {
        events.push('deletion_enqueued');
        return h.deletionJobs.enqueue(key, nowMs);
      },
    };
    const propagator = new ArchiveTakedownPropagator(
      h.archiveStore, trackingServing, h.service, h.ledger, trackingDeletion, absenceProbe(h),
    );

    const lease = await preTakedownAndLease(h, pinned.jobId);
    const result = await propagator.propagate({
      jobId: pinned.jobId, hostId: HOST_ID, lease, nowMs: START + 200,
    });

    expect(result.status).toBe('partial'); // bytes enqueued, not yet absent
    expect(events.indexOf('serving_removed')).toBeLessThan(events.indexOf('deletion_enqueued'));
    expect(serving.snapshot()).toEqual([]);
  });

  it('routes deletion through the queue (never inline) and finalizes after the queue drains', async () => {
    const h = pinHarness();
    const pinned = await drivePinnedJob(h, { contentId: 'content-q', suffix: 'q' });
    const serving = new FakeServingIndex([pinned.publicationId]);
    const propagator = new ArchiveTakedownPropagator(
      h.archiveStore, serving, h.service, h.ledger, h.deletionJobs, absenceProbe(h),
    );

    const lease = await preTakedownAndLease(h, pinned.jobId);
    const first = await propagator.propagate({
      jobId: pinned.jobId, hostId: HOST_ID, lease, nowMs: START + 200,
    });
    // First pass: bytes still present (not deleted inline), only enqueued.
    expect(first.status).toBe('partial');
    expect(await h.objectStore.observe(pinned.durableKey)).not.toBeNull();
    const jobDeletionKey = (await h.deletionJobs.getJob(pinned.durableKey));
    expect(jobDeletionKey?.state).toBe('pending');

    // The deletion queue worker removes the bytes, then a second propagate pass finalizes removal.
    // The first lease has expired (leaseMs 10000 from START+150), so the takedown job re-claims.
    const drained = await drainDeletionQueue(h);
    expect(drained).toEqual([pinned.durableKey]);
    const lease2 = await takedownLease(h, pinned.jobId, START + 20_000);
    const second = await propagator.propagate({
      jobId: pinned.jobId, hostId: HOST_ID, lease: lease2, nowMs: START + 20_100,
    });
    expect(second.status).toBe('removed');
    const job = await h.archiveStore.getJob(pinned.jobId);
    expect(job?.status).toBe('removed');
  });
});

describe('ArchiveTakedownPropagator shared-byte survival', () => {
  it('does not delete bytes still referenced by another active publication', async () => {
    const h = pinHarness();
    // Two jobs share the SAME contentId, so they dedupe onto the same durable key.
    const first = await drivePinnedJob(h, {
      contentId: 'shared-content', suffix: 's1', payload: 'identical-shared-bytes',
    });
    const second = await drivePinnedJob(h, {
      contentId: 'shared-content', suffix: 's2', payload: 'identical-shared-bytes',
      clockBase: START + 10_000,
    });
    expect(first.durableKey).toBe(second.durableKey);
    const serving = new FakeServingIndex([first.publicationId, second.publicationId]);
    const propagator = new ArchiveTakedownPropagator(
      h.archiveStore, serving, h.service, h.ledger, h.deletionJobs, absenceProbe(h),
    );

    // Take down ONLY the first publication.
    const lease = await preTakedownAndLease(h, first.jobId);
    const result = await propagator.propagate({
      jobId: first.jobId, hostId: HOST_ID, lease, nowMs: START + 200,
    });

    // The shared byte survives: it is NOT enqueued for deletion and the object store still holds it.
    if (result.status !== 'removed' && result.status !== 'partial') {
      throw new Error(`unexpected takedown status ${result.status}`);
    }
    expect(result.objects[0]?.outcome).toBe('reference_released_shared');
    expect(await h.deletionJobs.getJob(first.durableKey)).toBeNull();
    expect(await h.objectStore.observe(second.durableKey)).not.toBeNull();
    // The second publication is still serveable.
    expect(await h.archiveStore.isServeable(second.publicationId, HOST_ID)).toBe(true);
    // The first publication is no longer served.
    expect(serving.snapshot()).toEqual([second.publicationId]);
  });

  it('deletes the shared byte only after the LAST publication is torn down', async () => {
    const h = pinHarness();
    const first = await drivePinnedJob(h, {
      contentId: 'last-content', suffix: 'l1', payload: 'identical-last-bytes',
    });
    const second = await drivePinnedJob(h, {
      contentId: 'last-content', suffix: 'l2', payload: 'identical-last-bytes',
      clockBase: START + 10_000,
    });
    const serving = new FakeServingIndex([first.publicationId, second.publicationId]);
    const propagator = new ArchiveTakedownPropagator(
      h.archiveStore, serving, h.service, h.ledger, h.deletionJobs, absenceProbe(h),
    );

    const lease1 = await preTakedownAndLease(h, first.jobId, START + 20_000);
    await propagator.propagate({ jobId: first.jobId, hostId: HOST_ID, lease: lease1, nowMs: START + 20_100 });
    // Still referenced by the second publication: not enqueued.
    expect(await h.deletionJobs.getJob(first.durableKey)).toBeNull();

    const lease2 = await preTakedownAndLease(h, second.jobId, START + 40_000);
    const result = await propagator.propagate({
      jobId: second.jobId, hostId: HOST_ID, lease: lease2, nowMs: START + 40_100,
    });
    // Now the LAST reference is gone: the byte is enqueued for deletion.
    if (result.status !== 'removed' && result.status !== 'partial') {
      throw new Error(`unexpected takedown status ${result.status}`);
    }
    expect(result.objects[0]?.outcome).toBe('reference_released_enqueued');
    expect((await h.deletionJobs.getJob(second.durableKey))?.state).toBe('pending');
  });
});

describe('ArchiveTakedownPropagator idempotency + restart', () => {
  it('is idempotent: a re-run after full removal reports removed without resurrecting', async () => {
    const h = pinHarness();
    const pinned = await drivePinnedJob(h, { contentId: 'content-idem', suffix: 'idem' });
    const serving = new FakeServingIndex([pinned.publicationId]);
    const propagator = new ArchiveTakedownPropagator(
      h.archiveStore, serving, h.service, h.ledger, h.deletionJobs, absenceProbe(h),
    );

    const lease = await preTakedownAndLease(h, pinned.jobId);
    await propagator.propagate({ jobId: pinned.jobId, hostId: HOST_ID, lease, nowMs: START + 200 });
    await drainDeletionQueue(h);
    const lease2 = await takedownLease(h, pinned.jobId, START + 20_000);
    const removed = await propagator.propagate({
      jobId: pinned.jobId, hostId: HOST_ID, lease: lease2, nowMs: START + 20_100,
    });
    expect(removed.status).toBe('removed');

    // A third run against the removed job is a no-op that reports removed (no resurrection).
    const again = await propagator.propagate({
      jobId: pinned.jobId, hostId: HOST_ID,
      lease: { jobId: pinned.jobId, workerId: 'takedown-worker', fencingToken: 1 },
      nowMs: START + 20_200,
    });
    expect(again.status).toBe('removed');
    expect(serving.snapshot()).toEqual([]);
    expect(await h.archiveStore.isServeable(pinned.publicationId, HOST_ID)).toBe(false);
  });
});

/**
 * Request the takedown (pins -> removing, job -> takedown_pending) then claim the fenced lease, the
 * same two steps the takedown bin performs before calling propagate. Kept out of propagate itself so
 * the tests exercise propagate over an already-pending job with a real lease.
 */
async function preTakedownAndLease(
  h: PinHarness,
  jobId: string,
  atMs = START + 100,
): Promise<TakedownLease> {
  await h.archiveStore.requestTakedown(jobId, atMs);
  return takedownLease(h, jobId, atMs + 50);
}
