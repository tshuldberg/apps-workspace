/**
 * WP-43B pin reconciliation tests.
 *
 * Reconciles a hosted seeder's SERVING index against durable pin INTENT recorded in the archive
 * lifecycle store, over the real in-memory substrate. Proves drift repair in both directions, the
 * loud missing-bytes finding (never a silent serve), fenced single-winner, and cursor resume.
 */

import { describe, expect, it } from 'vitest';
import {
  ArchivePinReconciler,
  LeasedArchivePinReconciler,
  InMemoryPinReconcileCursorStore,
  type PinBytesPresenceProbe,
  type PinReconcileFinding,
} from '../archive-pin-reconciler';
import type { ReconcilerLease, ReconcilerLeaseProvider } from '../object-reconciler-leased';
import {
  drivePinnedJob,
  pinHarness,
  FakeServingIndex,
  HOST_ID,
  START,
  type PinHarness,
} from './support/archive-pin-fixtures';

/** Bytes present iff the durable key is referenced AND observable in the object store. */
function presenceProbe(h: PinHarness): PinBytesPresenceProbe {
  return async (pin) => {
    const key = `durable/${pin.contentId}/0`;
    const referenced = await h.ledger.isReferenced(key);
    const observed = await h.objectStore.observe(key);
    return referenced && observed !== null && observed.state === 'durable';
  };
}

function findingsByOutcome(findings: PinReconcileFinding[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of findings) (out[f.outcome] ??= []).push(f.publicationId);
  return out;
}

describe('ArchivePinReconciler intent-vs-serving drift', () => {
  it('adds a serving entry for an active pin whose bytes are present but not yet served', async () => {
    const h = pinHarness();
    const pinned = await drivePinnedJob(h, { contentId: 'content-a', suffix: 'a' });
    const serving = new FakeServingIndex(); // seeder was NOT yet serving this pin (crash before add)
    const reconciler = new ArchivePinReconciler(h.archiveStore, serving, presenceProbe(h));

    const result = await reconciler.run({ hostId: HOST_ID, maxEntries: 100, pageSize: 50 });

    expect(result.outcomeCounts.serving_added).toBe(1);
    expect(serving.snapshot()).toEqual([pinned.publicationId]);
    // A second run is a no-op: now healthy.
    const second = await reconciler.run({ hostId: HOST_ID, maxEntries: 100, pageSize: 50 });
    expect(second.outcomeCounts.healthy).toBe(1);
    expect(second.findings).toHaveLength(0);
  });

  it('removes a serving entry for a pin whose intent is no longer active (takedown residue)', async () => {
    const h = pinHarness();
    const pinned = await drivePinnedJob(h, { contentId: 'content-b', suffix: 'b' });
    // Intent flips to removing via a takedown request; the serving index still lists it (restart).
    await h.archiveStore.requestTakedown(pinned.jobId, START + 100);
    const serving = new FakeServingIndex([pinned.publicationId]);
    const reconciler = new ArchivePinReconciler(h.archiveStore, serving, presenceProbe(h));

    const result = await reconciler.run({ hostId: HOST_ID, maxEntries: 100, pageSize: 50 });

    expect(result.outcomeCounts.serving_removed).toBe(1);
    expect(serving.snapshot()).toEqual([]);
  });

  it('surfaces a loud pin_bytes_missing finding and never serves an active pin with absent bytes', async () => {
    const h = pinHarness();
    const pinned = await drivePinnedJob(h, { contentId: 'content-c', suffix: 'c' });
    // Simulate lost durable bytes: delete the object store bytes out from under an active pin.
    await h.objectStore.deleteObject(pinned.durableKey);
    const serving = new FakeServingIndex([pinned.publicationId]);
    const reconciler = new ArchivePinReconciler(h.archiveStore, serving, presenceProbe(h));

    const result = await reconciler.run({ hostId: HOST_ID, maxEntries: 100, pageSize: 50 });

    expect(result.outcomeCounts.pin_bytes_missing).toBe(1);
    expect(findingsByOutcome(result.findings).pin_bytes_missing).toEqual([pinned.publicationId]);
    // Never silently served: the serving entry is removed because the bytes are gone.
    expect(serving.snapshot()).toEqual([]);
  });

  it('removes a serving orphan that has no pin record at all', async () => {
    const h = pinHarness();
    const serving = new FakeServingIndex(['ghost-publication']);
    const reconciler = new ArchivePinReconciler(h.archiveStore, serving, presenceProbe(h));

    const orphans = await reconciler.findServingOrphans({
      hostId: HOST_ID, maxEntries: 100, pageSize: 50,
    });

    expect(orphans.findings.map((f) => f.outcome)).toEqual(['serving_orphan_removed']);
    expect(serving.snapshot()).toEqual([]);
  });

  it('leaves a serving entry whose active pin does exist (orphan scan is precise)', async () => {
    const h = pinHarness();
    const pinned = await drivePinnedJob(h, { contentId: 'content-d', suffix: 'd' });
    const serving = new FakeServingIndex([pinned.publicationId]);
    const reconciler = new ArchivePinReconciler(h.archiveStore, serving, presenceProbe(h));

    const orphans = await reconciler.findServingOrphans({
      hostId: HOST_ID, maxEntries: 100, pageSize: 50,
    });

    expect(orphans.findings).toHaveLength(0);
    expect(serving.snapshot()).toEqual([pinned.publicationId]);
  });
});

describe('ArchivePinReconciler cursor resume', () => {
  it('resumes across a bounded run without rescanning or dropping a pin', async () => {
    const h = pinHarness();
    const pins = [];
    for (const suffix of ['p1', 'p2', 'p3']) {
      pins.push(await drivePinnedJob(h, { contentId: `content-${suffix}`, suffix }));
    }
    const serving = new FakeServingIndex();
    const reconciler = new ArchivePinReconciler(h.archiveStore, serving, presenceProbe(h));

    const first = await reconciler.run({ hostId: HOST_ID, maxEntries: 2, pageSize: 2 });
    expect(first.entriesScanned).toBe(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await reconciler.run({
      hostId: HOST_ID, after: first.nextCursor!, maxEntries: 2, pageSize: 2,
    });
    expect(second.nextCursor).toBeNull();
    // Every pin ends up served exactly once, none skipped.
    expect(serving.snapshot().sort()).toEqual(pins.map((p) => p.publicationId).sort());
    expect(first.outcomeCounts.serving_added + second.outcomeCounts.serving_added).toBe(3);
  });
});

describe('LeasedArchivePinReconciler fencing', () => {
  function fakeLeaseProvider(): ReconcilerLeaseProvider & { held: Map<string, ReconcilerLease> } {
    const held = new Map<string, ReconcilerLease>();
    return {
      held,
      async claimJobLease(input) {
        const key = `${input.queue}:${input.jobId}`;
        if (held.has(key)) return null; // already leased => contended
        const lease: ReconcilerLease = {
          queue: input.queue, jobId: input.jobId, owner: input.owner, attempt: 1,
          fencingToken: 1, acquiredAt: new Date(START).toISOString(),
          leasedUntil: new Date(START + input.leaseMs).toISOString(),
        };
        held.set(key, lease);
        return lease;
      },
      async renewJobLease(lease) {
        return held.has(`${lease.queue}:${lease.jobId}`) ? lease : null;
      },
      async releaseJobLease(lease) {
        return held.delete(`${lease.queue}:${lease.jobId}`);
      },
    };
  }

  it('runs under a fenced lease and repairs drift end to end', async () => {
    const h = pinHarness();
    const pinned = await drivePinnedJob(h, { contentId: 'content-lease', suffix: 'lease' });
    const serving = new FakeServingIndex();
    const reconciler = new ArchivePinReconciler(h.archiveStore, serving, presenceProbe(h));
    const leased = new LeasedArchivePinReconciler(
      reconciler, fakeLeaseProvider(), new InMemoryPinReconcileCursorStore(),
    );

    const result = await leased.runOnce({
      scanId: 'pin-scan-1', hostId: HOST_ID, owner: 'reconciler-1',
      leaseMs: 5_000, maxEntries: 100, pageSize: 50,
    });

    expect(result.status).toBe('ran');
    if (result.status !== 'ran') throw new Error('unreachable');
    expect(result.pin.outcomeCounts.serving_added).toBe(1);
    expect(serving.snapshot()).toEqual([pinned.publicationId]);
  });

  it('gives only one winner when two reconcilers race the same scan id', async () => {
    const h = pinHarness();
    await drivePinnedJob(h, { contentId: 'content-race', suffix: 'race' });
    const provider = fakeLeaseProvider();
    // Pre-hold the lease so the reconciler's claim is contended.
    await provider.claimJobLease({
      queue: 'archive.pin.reconcile', jobId: 'pin-scan-race', owner: 'other', leaseMs: 10_000,
    });
    const serving = new FakeServingIndex();
    const reconciler = new ArchivePinReconciler(h.archiveStore, serving, presenceProbe(h));
    const leased = new LeasedArchivePinReconciler(
      reconciler, provider, new InMemoryPinReconcileCursorStore(),
    );

    const result = await leased.runOnce({
      scanId: 'pin-scan-race', hostId: HOST_ID, owner: 'reconciler-2',
      leaseMs: 5_000, maxEntries: 100, pageSize: 50,
    });

    expect(result.status).toBe('contended');
    expect(serving.snapshot()).toEqual([]); // the contended loser did nothing
  });

  it('persists the cursor under the lease so a crashed run resumes', async () => {
    const h = pinHarness();
    for (const suffix of ['c1', 'c2', 'c3']) {
      await drivePinnedJob(h, { contentId: `content-${suffix}`, suffix });
    }
    const serving = new FakeServingIndex();
    const reconciler = new ArchivePinReconciler(h.archiveStore, serving, presenceProbe(h));
    const cursors = new InMemoryPinReconcileCursorStore();
    const leased = new LeasedArchivePinReconciler(reconciler, fakeLeaseProvider(), cursors);

    const first = await leased.runOnce({
      scanId: 'pin-scan-resume', hostId: HOST_ID, owner: 'reconciler-1',
      leaseMs: 5_000, maxEntries: 2, pageSize: 2,
    });
    expect(first.status).toBe('ran');
    const saved = await cursors.loadCursor('pin-scan-resume');
    expect(saved?.pinCursor).not.toBeNull();

    const second = await leased.runOnce({
      scanId: 'pin-scan-resume', hostId: HOST_ID, owner: 'reconciler-1',
      leaseMs: 5_000, maxEntries: 2, pageSize: 2,
    });
    expect(second.status).toBe('ran');
    expect(serving.snapshot()).toHaveLength(3);
  });
});
