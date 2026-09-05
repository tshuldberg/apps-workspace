import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  InMemoryNcmecReportQueueStore,
  NcmecReportQueue,
  FakeNcmecFilingClient,
  UnavailableNcmecFilingClient,
  type NcmecReportQueueStore,
  type NcmecReportRecord,
} from '../ncmec-queue';
import { FileNcmecReportQueueStore } from '../ncmec-queue-store-file';
import { NcmecFilingWorker } from '../ncmec-filing-worker';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-ncmec-filing-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true })));
});

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

/** Enqueue a well-formed submit_scan report through the queue so the id is stable + valid. */
async function enqueueScanReport(store: NcmecReportQueueStore, hash = HASH_A): Promise<NcmecReportRecord> {
  const queue = new NcmecReportQueue(store);
  return queue.enqueueScanHit({ publicationId: 'pub-1', matchedBlobHashes: [hash] });
}

interface Clock { nowMs: number; }

function fixedClock(clock: Clock): () => number {
  return () => clock.nowMs;
}

const storeFactories: Array<{ name: string; create: () => Promise<NcmecReportQueueStore> }> = [
  { name: 'memory', create: async () => new InMemoryNcmecReportQueueStore() },
  { name: 'file', create: async () => new FileNcmecReportQueueStore(await temporaryDirectory()) },
];

for (const factory of storeFactories) {
  describe(`${factory.name} NCMEC filing worker`, () => {
    it('claims under a lease, files once, and marks filed only on provider confirmation', async () => {
      const store = await factory.create();
      const report = await enqueueScanReport(store);
      const clock: Clock = { nowMs: 1_000 };
      const worker = new NcmecFilingWorker({
        workerId: 'filer-a',
        store,
        client: new FakeNcmecFilingClient(),
        now: fixedClock(clock),
        random: () => 0.5,
      });

      const tick = await worker.runOnce();
      expect(tick.claimed).toBe(1);
      expect(tick.outcomes).toEqual([
        { id: report.id, decision: 'filed', detail: expect.stringMatching(/^ct-/) },
      ]);

      const stored = await store.get(report.id);
      expect(stored?.status).toBe('filed');
      expect(stored?.providerRef).toMatch(/^ct-/);
      expect(stored?.filedAt).toBeTruthy();
      // A second tick finds nothing to file (idempotent: the record left `queued`).
      expect((await worker.runOnce()).claimed).toBe(0);
      const counts = await store.counts();
      expect(counts).toMatchObject({ filed: 1, queued: 0 });
    });

    it('an unavailable client never marks filed; the record stays queued', async () => {
      const store = await factory.create();
      const report = await enqueueScanReport(store);
      const clock: Clock = { nowMs: 5_000 };
      const worker = new NcmecFilingWorker({
        workerId: 'filer-a',
        store,
        client: new UnavailableNcmecFilingClient(),
        now: fixedClock(clock),
        random: () => 0,
      });
      expect(worker.readinessState()).toBe('fail_closed');

      const tick = await worker.runOnce();
      expect(tick.outcomes[0]?.decision).toBe('retry_scheduled');
      const stored = await store.get(report.id);
      expect(stored?.status).toBe('queued');
      expect(stored?.providerRef).toBeUndefined();
      expect(stored?.lastFilingErrorCode).toBe('client_unavailable');
    });

    it('a permanent failure escalates without a false filed', async () => {
      const store = await factory.create();
      const report = await enqueueScanReport(store);
      const clock: Clock = { nowMs: 2_000 };
      const worker = new NcmecFilingWorker({
        workerId: 'filer-a',
        store,
        client: new FakeNcmecFilingClient({ permanentIds: [report.id] }),
        now: fixedClock(clock),
        random: () => 0.5,
      });
      const tick = await worker.runOnce();
      expect(tick.outcomes[0]).toMatchObject({ decision: 'escalated' });
      const stored = await store.get(report.id);
      expect(stored?.status).toBe('escalated');
      expect(stored?.providerRef).toBeUndefined();
      expect((await store.counts()).escalated).toBe(1);
    });

    it('a transient failure reschedules with jittered backoff, then succeeds', async () => {
      const store = await factory.create();
      const report = await enqueueScanReport(store);
      const clock: Clock = { nowMs: 10_000 };
      // Flaky provider: fail transiently for the first attempt, then succeed.
      const worker = new NcmecFilingWorker({
        workerId: 'filer-a',
        store,
        client: new FakeNcmecFilingClient({ transientUntilAttempt: 1 }),
        baseRetryMs: 1_000,
        now: fixedClock(clock),
        random: () => 0.5, // +25% jitter deterministically
      });

      const first = await worker.runOnce();
      expect(first.outcomes[0]?.decision).toBe('retry_scheduled');
      expect((await store.get(report.id))?.status).toBe('queued');

      // Before the backoff elapses the record is not re-claimable.
      clock.nowMs = 10_500;
      expect((await worker.runOnce()).claimed).toBe(0);

      // After the backoff, it is claimed again and files.
      clock.nowMs = 20_000;
      const second = await worker.runOnce();
      expect(second.outcomes[0]?.decision).toBe('filed');
      expect((await store.get(report.id))?.status).toBe('filed');
    });

    it('escalates a persistently transient record at the attempt cap (never retries forever)', async () => {
      const store = await factory.create();
      const report = await enqueueScanReport(store);
      const clock: Clock = { nowMs: 0 };
      const worker = new NcmecFilingWorker({
        workerId: 'filer-a',
        store,
        client: new FakeNcmecFilingClient({ transientIds: [report.id] }),
        baseRetryMs: 1,
        maxAttempts: 3,
        now: fixedClock(clock),
        random: () => 0,
      });
      // Drive attempts until the cap escalates. Advance the clock past each backoff.
      let decision = '';
      for (let i = 0; i < 3; i += 1) {
        const tick = await worker.runOnce();
        decision = tick.outcomes[0]?.decision ?? '';
        clock.nowMs += 1_000_000;
      }
      expect(decision).toBe('escalated');
      expect((await store.get(report.id))?.status).toBe('escalated');
    });

    it('a fenced double-claim yields exactly one winner (stale worker cannot double-file)', async () => {
      const store = await factory.create();
      const report = await enqueueScanReport(store);
      const clock: Clock = { nowMs: 100 };

      // Worker A claims with a short lease.
      const claimA = await store.claimQueuedForFiling({ owner: 'A', limit: 1, leaseMs: 1_000, nowMs: clock.nowMs });
      expect(claimA).toHaveLength(1);

      // The lease expires; worker B reclaims (fencing token advances).
      clock.nowMs = 5_000;
      const claimB = await store.claimQueuedForFiling({ owner: 'B', limit: 1, leaseMs: 1_000, nowMs: clock.nowMs });
      expect(claimB).toHaveLength(1);
      expect(claimB[0]!.fencingToken).toBeGreaterThan(claimA[0]!.fencingToken);

      // Stale worker A tries to commit filed: rejected (lease lost).
      const staleCommit = await store.completeFiling({
        owner: 'A', id: report.id, fencingToken: claimA[0]!.fencingToken,
        resolution: { kind: 'filed', providerRef: 'ct-stale' }, nowMs: clock.nowMs,
      });
      expect(staleCommit).toBe('lease_lost');
      expect((await store.get(report.id))?.status).toBe('queued');

      // Live worker B commits filed: accepted.
      const liveCommit = await store.completeFiling({
        owner: 'B', id: report.id, fencingToken: claimB[0]!.fencingToken,
        resolution: { kind: 'filed', providerRef: 'ct-live' }, nowMs: clock.nowMs,
      });
      expect(liveCommit).toBe('committed');
      expect((await store.get(report.id))?.providerRef).toBe('ct-live');
    });

    it('escalates a record whose evidence is defective before contacting the provider', async () => {
      const store = await factory.create();
      // Hand-craft a queued record missing matched hashes (a legacy/corrupt row).
      const id = createHash('sha256').update('defective').digest('hex');
      const bad: NcmecReportRecord = {
        id,
        source: 'submit_scan',
        detectedAt: new Date(0).toISOString(),
        publicationId: 'pub-x',
        reason: 'abuse_hash_match',
        status: 'queued',
      };
      await store.enqueue(bad);
      let filed = false;
      const client = new FakeNcmecFilingClient();
      const spy = { file: async (r: NcmecReportRecord) => { filed = true; return client.file(r); }, state: 'configured' as const };
      const worker = new NcmecFilingWorker({ workerId: 'filer-a', store, client: spy, now: () => 1 });
      const tick = await worker.runOnce();
      expect(tick.outcomes[0]).toMatchObject({ decision: 'escalated', detail: 'missing_matched_hashes' });
      expect(filed).toBe(false);
    });
  });
}

describe('NCMEC filing worker guards', () => {
  it('rejects an invalid worker id', async () => {
    expect(() => new NcmecFilingWorker({
      workerId: 'bad id with spaces',
      store: new InMemoryNcmecReportQueueStore(),
      client: new FakeNcmecFilingClient(),
    })).toThrow(/worker id/u);
  });

  it('does not claim a report scheduled for a future retry', async () => {
    const store = new InMemoryNcmecReportQueueStore();
    await enqueueScanReport(store, HASH_B);
    const clock: Clock = { nowMs: 0 };
    const worker = new NcmecFilingWorker({
      workerId: 'filer-a',
      store,
      client: new FakeNcmecFilingClient({ transientUntilAttempt: 1 }),
      baseRetryMs: 100_000,
      now: fixedClock(clock),
      random: () => 0,
    });
    expect((await worker.runOnce()).outcomes[0]?.decision).toBe('retry_scheduled');
    // Still inside the backoff window.
    clock.nowMs = 1_000;
    expect((await worker.runOnce()).claimed).toBe(0);
  });
});
