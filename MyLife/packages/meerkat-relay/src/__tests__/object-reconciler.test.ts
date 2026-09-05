import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemoryObjectStore } from '../object-store-memory';
import { InMemoryObjectReferenceLedger } from '../object-reference-ledger-memory';
import { InMemoryObjectDeletionJobStore } from '../object-deletion-jobs-memory';
import {
  ObjectReconciler,
  type ReferencedExpectation,
} from '../object-reconciler';
import { LeasedObjectReconciler, type ReconcilerLease } from '../object-reconciler-leased';
import {
  InMemoryOrphanFirstSeenStore,
  InMemoryReconcileCursorStore,
} from '../object-reconciler-memory';

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const GRACE_MS = 60_000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const NOW = 10_000_000;

async function putDurable(store: InMemoryObjectStore, key: string, text: string): Promise<string> {
  const bytes = new Uint8Array(Buffer.from(text, 'utf8'));
  const quarantineKey = `quarantine/${key}`;
  await store.put({ key: quarantineKey, checksumSha256: sha256Hex(bytes), bytes });
  await store.promote({
    quarantineKey,
    durableKey: key,
    expectedChecksumSha256: sha256Hex(bytes),
  });
  return sha256Hex(bytes);
}

function harness(resolver?: (key: string) => Promise<ReferencedExpectation | null>) {
  const objectStore = new InMemoryObjectStore();
  const referenceLedger = new InMemoryObjectReferenceLedger();
  const deletionJobs = new InMemoryObjectDeletionJobStore();
  const orphanFirstSeen = new InMemoryOrphanFirstSeenStore();
  const reconciler = new ObjectReconciler(
    objectStore,
    referenceLedger,
    deletionJobs,
    orphanFirstSeen,
    resolver ?? (async () => null),
  );
  return { objectStore, referenceLedger, deletionJobs, orphanFirstSeen, reconciler };
}

const runInput = (nowMs: number) => ({
  maxEntries: 1_000,
  pageSize: 100,
  graceWindowMs: GRACE_MS,
  retentionWindowMs: RETENTION_MS,
  nowMs,
});

describe('ObjectReconciler crash-residue outcomes', () => {
  it('enqueues a durable orphan past the grace window for fenced deletion', async () => {
    const { objectStore, deletionJobs, reconciler } = harness();
    await putDurable(objectStore, 'durable/orphan', 'unreferenced durable bytes');
    // First seen now; still in grace -> left alone.
    const first = await reconciler.run(runInput(NOW));
    expect(first.outcomeCounts.in_grace).toBe(1);
    expect(await deletionJobs.getJob('durable/orphan')).toBeNull();
    // Past the grace window -> enqueued, not deleted inline.
    const second = await reconciler.run(runInput(NOW + GRACE_MS + 1));
    expect(second.findings).toHaveLength(1);
    expect(second.findings[0]).toMatchObject({ objectKey: 'durable/orphan', outcome: 'orphan_quarantined' });
    expect(await deletionJobs.getJob('durable/orphan')).toMatchObject({ state: 'pending' });
    // The durable bytes are NOT removed by the reconciler; the queue owns that.
    expect(await objectStore.observe('durable/orphan')).not.toBeNull();
  });

  it('sweeps a quarantined orphan older than the retention window', async () => {
    const { objectStore, reconciler } = harness();
    const bytes = new Uint8Array(Buffer.from('never promoted', 'utf8'));
    await objectStore.put({ key: 'quarantine/stale', checksumSha256: sha256Hex(bytes), bytes });
    // Record first-seen far in the past by running once, then advancing beyond retention.
    await reconciler.run(runInput(NOW));
    const swept = await reconciler.run(runInput(NOW + RETENTION_MS + 1));
    expect(swept.findings[0]).toMatchObject({ objectKey: 'quarantine/stale', outcome: 'orphan_swept' });
    expect(await objectStore.observe('quarantine/stale')).toBeNull();
  });

  it('leaves an in-grace-window orphan alone (an upload whose reference has not landed)', async () => {
    const { objectStore, deletionJobs, reconciler } = harness();
    await putDurable(objectStore, 'durable/fresh', 'just uploaded');
    const result = await reconciler.run(runInput(NOW));
    expect(result.findings).toHaveLength(0);
    expect(result.outcomeCounts.in_grace).toBe(1);
    expect(await deletionJobs.getJob('durable/fresh')).toBeNull();
  });

  it('reports drift when a referenced object checksum/size disagrees with the expectation', async () => {
    const expectations = new Map<string, ReferencedExpectation>();
    const { objectStore, referenceLedger, reconciler } = harness(
      async (key) => expectations.get(key) ?? null,
    );
    const checksum = await putDurable(objectStore, 'durable/drift', 'stored bytes');
    await referenceLedger.addReference({ objectKey: 'durable/drift', referrer: 'hosted:s c 0' });
    expectations.set('durable/drift', { checksumSha256: 'f'.repeat(64), sizeBytes: 999 });
    const result = await reconciler.run(runInput(NOW));
    expect(result.findings[0]).toMatchObject({
      objectKey: 'durable/drift',
      outcome: 'drift',
      detail: expect.objectContaining({ storeChecksum: checksum, expectedChecksum: 'f'.repeat(64) }),
    });
    // Drift is a finding only; the object is never auto-repaired or deleted.
    expect(await objectStore.observe('durable/drift')).not.toBeNull();
  });

  it('treats a referenced, present, matching object as healthy (no finding)', async () => {
    const expectations = new Map<string, ReferencedExpectation>();
    const { objectStore, referenceLedger, reconciler } = harness(
      async (key) => expectations.get(key) ?? null,
    );
    const bytes = new Uint8Array(Buffer.from('healthy bytes', 'utf8'));
    await putDurable(objectStore, 'durable/healthy', 'healthy bytes');
    await referenceLedger.addReference({ objectKey: 'durable/healthy', referrer: 'hosted:s c 0' });
    expectations.set('durable/healthy', { checksumSha256: sha256Hex(bytes), sizeBytes: bytes.length });
    const result = await reconciler.run(runInput(NOW));
    expect(result.findings).toHaveLength(0);
    expect(result.outcomeCounts.healthy).toBe(1);
  });

  it('flags a referenced-but-missing key as an explicit finding, never silently skipped', async () => {
    const { reconciler } = harness();
    const findings = await reconciler.findReferencedMissing(['durable/gone', 'durable/also-gone']);
    expect(findings.map((finding) => finding.outcome)).toEqual(['referenced_missing', 'referenced_missing']);
    expect(findings.map((finding) => finding.objectKey)).toEqual(['durable/gone', 'durable/also-gone']);
  });

  it('resumes a bounded scan from its cursor across runs', async () => {
    const { objectStore, reconciler } = harness();
    for (let index = 0; index < 5; index += 1) {
      await putDurable(objectStore, `durable/key-${index}`, `bytes ${index}`);
    }
    const first = await reconciler.run({ ...runInput(NOW), maxEntries: 2, pageSize: 2 });
    expect(first.entriesScanned).toBe(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await reconciler.run({
      ...runInput(NOW), maxEntries: 2, pageSize: 2, after: first.nextCursor ?? undefined,
    });
    expect(second.entriesScanned).toBe(2);
    expect(second.nextCursor?.key).not.toBe(first.nextCursor?.key);
  });
});

describe('LeasedObjectReconciler fencing', () => {
  class FakeLeaseProvider {
    private held: ReconcilerLease | null = null;
    claims = 0;

    async claimJobLease(input: { queue: string; jobId: string; owner: string; leaseMs: number }) {
      if (this.held) return null;
      this.claims += 1;
      this.held = {
        queue: input.queue,
        jobId: input.jobId,
        owner: input.owner,
        attempt: 1,
        fencingToken: this.claims,
        acquiredAt: new Date(NOW).toISOString(),
        leasedUntil: new Date(NOW + input.leaseMs).toISOString(),
      };
      return this.held;
    }

    async renewJobLease(lease: ReconcilerLease, leaseMs: number) {
      if (!this.held || this.held.fencingToken !== lease.fencingToken) return null;
      this.held = { ...this.held, leasedUntil: new Date(NOW + leaseMs).toISOString() };
      return this.held;
    }

    async releaseJobLease(lease: ReconcilerLease) {
      if (this.held && this.held.fencingToken === lease.fencingToken) {
        this.held = null;
        return true;
      }
      return false;
    }
  }

  it('runs one reconciler pass under a lease and persists the cursor', async () => {
    const { objectStore, reconciler } = harness();
    await putDurable(objectStore, 'durable/a', 'a');
    const leases = new FakeLeaseProvider();
    const cursors = new InMemoryReconcileCursorStore();
    const driver = new LeasedObjectReconciler(reconciler, leases, cursors);
    const result = await driver.runOnce({
      scanId: 'scan-1',
      owner: 'reconciler-1',
      leaseMs: 60_000,
      maxEntries: 1_000,
      pageSize: 100,
      graceWindowMs: GRACE_MS,
      retentionWindowMs: RETENTION_MS,
      nowMs: NOW,
    });
    expect(result.status).toBe('ran');
    // Lease was released after the run, so a subsequent run can re-claim.
    const again = await driver.runOnce({
      scanId: 'scan-1', owner: 'reconciler-1', leaseMs: 60_000, maxEntries: 1_000, pageSize: 100,
      graceWindowMs: GRACE_MS, retentionWindowMs: RETENTION_MS, nowMs: NOW + 1_000,
    });
    expect(again.status).toBe('ran');
  });

  it('returns contended when the lease is already held by another worker', async () => {
    const { reconciler } = harness();
    const leases = new FakeLeaseProvider();
    const cursors = new InMemoryReconcileCursorStore();
    // Pre-claim the lease so the driver cannot acquire it.
    await leases.claimJobLease({ queue: 'object.reconcile', jobId: 'scan-1', owner: 'other', leaseMs: 60_000 });
    const driver = new LeasedObjectReconciler(reconciler, leases, cursors);
    const result = await driver.runOnce({
      scanId: 'scan-1', owner: 'reconciler-1', leaseMs: 60_000, maxEntries: 1_000, pageSize: 100,
      graceWindowMs: GRACE_MS, retentionWindowMs: RETENTION_MS, nowMs: NOW,
    });
    expect(result.status).toBe('contended');
  });
});
