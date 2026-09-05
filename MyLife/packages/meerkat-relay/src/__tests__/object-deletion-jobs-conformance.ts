import { expect } from 'vitest';
import type { StoreConformanceScenario } from '../postgres/conformance/store-conformance';
import type { ObjectDeletionJobStore } from '../object-deletion-jobs';

const KEY = 'objects/todelete';
const NOW = 1_000_000;

/**
 * Behavioral contract every ObjectDeletionJobStore adapter must satisfy: idempotent
 * enqueue, single-winner fenced claim, retry rescheduling, poison, and stale-lease
 * rejection. Run against a fresh store per scenario.
 */
export const objectDeletionJobScenarios:
  readonly StoreConformanceScenario<ObjectDeletionJobStore>[] = [
  {
    name: 'enqueues a pending job idempotently per key',
    async run(store) {
      const first = await store.enqueue(KEY, NOW);
      expect(first.status).toBe('enqueued');
      expect(first.job).toMatchObject({ objectKey: KEY, state: 'pending', attempt: 0 });
      const second = await store.enqueue(KEY, NOW + 10);
      expect(second.status).toBe('already_pending');
    },
  },
  {
    name: 'a single claim wins a due job and bumps attempt + fencing token',
    async run(store) {
      await store.enqueue(KEY, NOW);
      const leases = await store.claim({ owner: 'worker-a', limit: 10, leaseMs: 60_000, nowMs: NOW });
      expect(leases).toHaveLength(1);
      expect(leases[0]).toMatchObject({ objectKey: KEY, owner: 'worker-a', attempt: 1 });
      // A second immediate claim finds nothing: the job is leased and unexpired.
      const empty = await store.claim({ owner: 'worker-b', limit: 10, leaseMs: 60_000, nowMs: NOW + 1 });
      expect(empty).toEqual([]);
    },
  },
  {
    name: 'complete under a live lease is terminal; re-enqueue after delete is idempotent',
    async run(store) {
      await store.enqueue(KEY, NOW);
      const [lease] = await store.claim({ owner: 'worker-a', limit: 1, leaseMs: 60_000, nowMs: NOW });
      const done = await store.complete({ lease: lease!, versionId: 'v3', nowMs: NOW + 100 });
      expect(done).toEqual({ status: 'committed', job: expect.objectContaining({ state: 'deleted', versionId: 'v3' }) });
      const again = await store.enqueue(KEY, NOW + 200);
      expect(again.status).toBe('already_deleted');
    },
  },
  {
    name: 'a stale worker cannot complete after its lease is re-claimed (fencing)',
    async run(store) {
      await store.enqueue(KEY, NOW);
      const [stale] = await store.claim({ owner: 'worker-a', limit: 1, leaseMs: 1_000, nowMs: NOW });
      // Lease expires; a second worker re-claims and gets a higher fencing token.
      const [fresh] = await store.claim({ owner: 'worker-b', limit: 1, leaseMs: 60_000, nowMs: NOW + 5_000 });
      expect(fresh!.fencingToken).toBeGreaterThan(stale!.fencingToken);
      // The stale worker's completion is rejected.
      await expect(store.complete({ lease: stale!, versionId: 'v1', nowMs: NOW + 6_000 }))
        .resolves.toEqual({ status: 'lease_lost' });
      // The fresh worker still commits.
      await expect(store.complete({ lease: fresh!, versionId: 'v2', nowMs: NOW + 6_100 }))
        .resolves.toMatchObject({ status: 'committed' });
    },
  },
  {
    name: 'reschedule returns the job to pending with a future next-attempt and records the error',
    async run(store) {
      await store.enqueue(KEY, NOW);
      const [lease] = await store.claim({ owner: 'worker-a', limit: 1, leaseMs: 60_000, nowMs: NOW });
      const retried = await store.reschedule({
        lease: lease!,
        delayMs: 30_000,
        error: 'transient object store error',
        nowMs: NOW + 100,
      });
      expect(retried).toMatchObject({
        status: 'committed',
        job: expect.objectContaining({ state: 'pending', lastError: 'transient object store error' }),
      });
      // Not yet due at the reschedule instant.
      const early = await store.claim({ owner: 'worker-b', limit: 1, leaseMs: 60_000, nowMs: NOW + 200 });
      expect(early).toEqual([]);
      // Due after the delay: re-claimable, and attempt has advanced.
      const [next] = await store.claim({ owner: 'worker-b', limit: 1, leaseMs: 60_000, nowMs: NOW + 40_000 });
      expect(next!.attempt).toBe(2);
    },
  },
  {
    name: 'poison is a terminal finding surfaced by listPoison',
    async run(store) {
      await store.enqueue(KEY, NOW);
      const [lease] = await store.claim({ owner: 'worker-a', limit: 1, leaseMs: 60_000, nowMs: NOW });
      await store.poison({ lease: lease!, error: 'permanent failure', nowMs: NOW + 100 });
      const page = await store.listPoison({ limit: 10 });
      expect(page.jobs.map((job) => job.objectKey)).toEqual([KEY]);
      expect(page.jobs[0]).toMatchObject({ state: 'poison', lastError: 'permanent failure' });
      // A poison job is not re-claimable.
      const claimed = await store.claim({ owner: 'worker-b', limit: 10, leaseMs: 60_000, nowMs: NOW + 200 });
      expect(claimed).toEqual([]);
    },
  },
  {
    name: 'an expired lease is re-claimable for crash recovery',
    async run(store) {
      await store.enqueue(KEY, NOW);
      await store.claim({ owner: 'crashed', limit: 1, leaseMs: 1_000, nowMs: NOW });
      const recovered = await store.claim({ owner: 'recoverer', limit: 1, leaseMs: 60_000, nowMs: NOW + 5_000 });
      expect(recovered).toHaveLength(1);
      expect(recovered[0]!.owner).toBe('recoverer');
    },
  },
  {
    name: 'validates keys, owners, and error strings at the boundary',
    async run(store) {
      await expect(store.enqueue('bad key spaces', NOW)).rejects.toThrow(/valid object key/);
      await expect(store.claim({ owner: '', limit: 1, leaseMs: 1_000, nowMs: NOW }))
        .rejects.toThrow(/owner/);
      await store.enqueue(KEY, NOW);
      const [lease] = await store.claim({ owner: 'worker-a', limit: 1, leaseMs: 60_000, nowMs: NOW });
      await expect(store.reschedule({ lease: lease!, delayMs: 1_000, error: '   ', nowMs: NOW + 1 }))
        .rejects.toThrow(/error/);
    },
  },
];
