import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresObjectReferenceLedger } from '../stores/object-reference-store';
import { PostgresObjectDeletionJobStore } from '../stores/object-deletion-store';
import {
  PostgresOrphanFirstSeenStore,
  PostgresReconcileCursorStore,
} from '../stores/object-reconciliation-store';
import { runStoreConformanceSuite } from '../conformance/store-conformance';
import { objectReferenceLedgerScenarios } from '../../__tests__/object-reference-ledger-conformance';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;

describePostgres('Plan 44 WP-2C object accounting PostgreSQL integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_objacct_${suffix}`;
  let adminPool: Pool;
  let firstPool: Pool;
  let secondPool: Pool;
  let firstContext: PostgresStoreContext;
  let secondContext: PostgresStoreContext;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Object accounting integration tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    firstPool = new Pool({ connectionString: databaseUrl.toString(), max: 3 });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({ connectionString: databaseUrl.toString(), max: 3 });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool);
    firstContext = new PostgresStoreContext(firstPool);
    secondContext = new PostgresStoreContext(secondPool);
  });

  afterAll(async () => {
    await firstPool?.end().catch(() => undefined);
    await secondPool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  beforeEach(async () => {
    await firstPool.query(`
      TRUNCATE ops.object_reference_edges, ops.object_reference_keys,
        ops.object_deletion_jobs, ops.object_deletion_audit,
        ops.object_orphan_sightings, ops.object_reconciliation_runs
    `);
  });

  it('passes every reference-ledger conformance scenario against PostgreSQL', async () => {
    const result = await runStoreConformanceSuite({
      storeName: 'postgres',
      createStore: async () => {
        await firstPool.query('TRUNCATE ops.object_reference_edges, ops.object_reference_keys');
        return new PostgresObjectReferenceLedger(firstContext);
      },
      scenarios: objectReferenceLedgerScenarios,
    });
    expect(result.passedScenarios).toEqual(objectReferenceLedgerScenarios.map((scenario) => scenario.name));
  });

  it('enqueues idempotently and claims a due job with a fresh fence (DB-clock semantics)', async () => {
    const store = new PostgresObjectDeletionJobStore(firstContext);
    const nowMs = Date.now();
    const enqueued = await store.enqueue('objects/due', nowMs);
    expect(enqueued.status).toBe('enqueued');
    expect((await store.enqueue('objects/due', nowMs)).status).toBe('already_pending');
    const [lease] = await store.claim({ owner: 'worker', limit: 5, leaseMs: 60_000, nowMs });
    expect(lease).toMatchObject({ objectKey: 'objects/due', owner: 'worker', attempt: 1 });
    // Re-claim immediately finds nothing: the lease is live and unexpired in DB time.
    expect(await store.claim({ owner: 'other', limit: 5, leaseMs: 60_000, nowMs })).toEqual([]);
  });

  it('reschedules a job into the future so it is not immediately re-claimable', async () => {
    const store = new PostgresObjectDeletionJobStore(firstContext);
    const nowMs = Date.now();
    await store.enqueue('objects/retry', nowMs);
    const [lease] = await store.claim({ owner: 'worker', limit: 1, leaseMs: 60_000, nowMs });
    await store.reschedule({ lease: lease!, delayMs: 3_600_000, error: 'transient', nowMs: nowMs + 10 });
    // next_attempt_at is an hour out in DB time, so an immediate claim finds nothing.
    expect(await store.claim({ owner: 'worker', limit: 1, leaseMs: 60_000, nowMs: nowMs + 20 })).toEqual([]);
    const job = await store.getJob('objects/retry');
    expect(job).toMatchObject({ state: 'pending', lastError: 'transient' });
  });

  it('recovers an expired lease for another worker', async () => {
    const store = new PostgresObjectDeletionJobStore(firstContext);
    const nowMs = Date.now();
    await store.enqueue('objects/crashed', nowMs);
    // A 1ms lease is already expired by the time the recovery claim runs.
    await store.claim({ owner: 'crashed', limit: 1, leaseMs: 1, nowMs });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const recovered = await store.claim({ owner: 'recoverer', limit: 1, leaseMs: 60_000, nowMs: nowMs + 20 });
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({ owner: 'recoverer', attempt: 2 });
  });

  it('keeps the reference count coherent under concurrent adders across two instances', async () => {
    const first = new PostgresObjectReferenceLedger(firstContext);
    const second = new PostgresObjectReferenceLedger(secondContext);
    const key = 'objects/concurrent';
    const outcomes = await Promise.all([
      first.addReference({ objectKey: key, referrer: 'ref-a' }),
      second.addReference({ objectKey: key, referrer: 'ref-b' }),
    ]);
    expect(outcomes.map((outcome) => outcome.status).every((status) => status === 'added')).toBe(true);
    await expect(first.referenceCount(key)).resolves.toBe(2);
    // The zero-marker constraint holds: removing both leaves an unreferenced-listed key.
    await first.removeReference({ objectKey: key, referrer: 'ref-a' });
    await second.removeReference({ objectKey: key, referrer: 'ref-b' });
    const page = await first.listUnreferenced({ limit: 10 });
    expect(page.entries.map((entry) => entry.objectKey)).toEqual([key]);
  });

  it('lets exactly one instance win a deletion lease and rejects the stale fence', async () => {
    const first = new PostgresObjectDeletionJobStore(firstContext);
    const second = new PostgresObjectDeletionJobStore(secondContext);
    const nowMs = Date.now();
    await first.enqueue('objects/fence', nowMs);
    const [claimedFirst, claimedSecond] = await Promise.all([
      first.claim({ owner: 'worker-a', limit: 1, leaseMs: 60_000, nowMs }),
      second.claim({ owner: 'worker-b', limit: 1, leaseMs: 60_000, nowMs }),
    ]);
    const winners = [...claimedFirst, ...claimedSecond];
    expect(winners).toHaveLength(1);
    const winner = winners[0]!;
    // A fabricated stale lease with a lower fencing token cannot commit.
    const staleResult = await first.complete({
      lease: { ...winner, fencingToken: winner.fencingToken - 1 },
      versionId: 'v1',
      nowMs: nowMs + 100,
    });
    expect(staleResult).toEqual({ status: 'lease_lost' });
    // The real winner commits and is terminal.
    await expect(first.complete({ lease: winner, versionId: 'v9', nowMs: nowMs + 200 }))
      .resolves.toMatchObject({ status: 'committed', job: expect.objectContaining({ state: 'deleted' }) });
  });

  it('poisons a job after its retry budget and surfaces it via listPoison', async () => {
    const store = new PostgresObjectDeletionJobStore(firstContext);
    const nowMs = Date.now();
    await store.enqueue('objects/poison', nowMs);
    const [lease] = await store.claim({ owner: 'worker', limit: 1, leaseMs: 60_000, nowMs });
    await store.poison({ lease: lease!, error: 'permanent failure', nowMs: nowMs + 100 });
    const page = await store.listPoison({ limit: 10 });
    expect(page.jobs.map((job) => job.objectKey)).toEqual(['objects/poison']);
    // An audit trail exists for the poison action.
    const audit = await firstPool.query<{ action: string }>(
      `SELECT action FROM ops.object_deletion_audit WHERE object_key = $1 ORDER BY audit_seq`,
      ['objects/poison'],
    );
    expect(audit.rows.map((row) => row.action)).toEqual(['enqueued', 'poisoned']);
  });

  it('records a durable orphan first-sighting and a resumable reconcile cursor', async () => {
    const firstSeen = new PostgresOrphanFirstSeenStore(firstContext);
    const cursors = new PostgresReconcileCursorStore(firstContext);
    const seenA = await firstSeen.firstSeen('objects/orphan', Date.now());
    // A second sighting returns the SAME instant (the clock is not reset).
    const seenB = await firstSeen.firstSeen('objects/orphan', Date.now() + 100_000);
    expect(seenB).toBe(seenA);
    await firstSeen.clear('objects/orphan');
    const afterClear = await firstSeen.firstSeen('objects/orphan', Date.now() + 200_000);
    expect(afterClear).toBeGreaterThanOrEqual(seenA);

    await cursors.saveCursor('scan-1', { key: 'objects/z' }, 5);
    await expect(cursors.loadCursor('scan-1')).resolves.toEqual({ key: 'objects/z' });
    await cursors.saveCursor('scan-1', null, 3);
    await expect(cursors.loadCursor('scan-1')).resolves.toBeNull();
    const run = await firstPool.query<{ entries_scanned: string }>(
      `SELECT entries_scanned FROM ops.object_reconciliation_runs WHERE scan_id = $1`,
      ['scan-1'],
    );
    expect(Number(run.rows[0]!.entries_scanned)).toBe(8);
  });
});
