import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FakeNcmecFilingClient,
  NcmecReportQueue,
  UnavailableNcmecFilingClient,
} from '../../ncmec-queue';
import { NcmecFilingWorker } from '../../ncmec-filing-worker';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresNcmecReportQueueStore } from '../stores/ncmec-queue-store';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;

describePostgres('PostgresNcmecReportQueueStore filing worker integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_ncmecfile_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;
  let store: PostgresNcmecReportQueueStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('NCMEC filing integration tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 4 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool);
    store = new PostgresNcmecReportQueueStore(new PostgresStoreContext(pool));
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  async function enqueueScan(publicationId: string, hash: string): Promise<string> {
    const queue = new NcmecReportQueue(store);
    const record = await queue.enqueueScanHit({ publicationId, matchedBlobHashes: [hash] });
    return record.id;
  }

  it('files a valid queued record once and marks filed only on provider confirmation', async () => {
    const id = await enqueueScan(`pub-${randomUUID()}`, 'a'.repeat(64));
    const worker = new NcmecFilingWorker({
      workerId: 'filer-int',
      store,
      client: new FakeNcmecFilingClient(),
    });
    const tick = await worker.runOnce();
    const outcome = tick.outcomes.find((o) => o.id === id);
    expect(outcome?.decision).toBe('filed');
    const stored = await store.get(id);
    expect(stored?.status).toBe('filed');
    expect(stored?.providerRef).toMatch(/^ct-/);
    expect(stored?.filedAt).toBeTruthy();
    // Idempotent: a second run does not re-file it.
    const again = await worker.runOnce();
    expect(again.outcomes.find((o) => o.id === id)).toBeUndefined();
  });

  it('an unavailable client leaves the record queued (never a false filed)', async () => {
    const id = await enqueueScan(`pub-${randomUUID()}`, 'b'.repeat(64));
    const worker = new NcmecFilingWorker({
      workerId: 'filer-unavail',
      store,
      client: new UnavailableNcmecFilingClient(),
      baseRetryMs: 1,
    });
    await worker.runOnce();
    const stored = await store.get(id);
    expect(stored?.status).toBe('queued');
    expect(stored?.providerRef).toBeUndefined();
    expect(stored?.lastFilingErrorCode).toBe('client_unavailable');
  });

  it('a permanent failure escalates durably without a false filed', async () => {
    const id = await enqueueScan(`pub-${randomUUID()}`, 'c'.repeat(64));
    const worker = new NcmecFilingWorker({
      workerId: 'filer-perm',
      store,
      client: new FakeNcmecFilingClient({ permanentIds: [id] }),
    });
    await worker.runOnce();
    const stored = await store.get(id);
    expect(stored?.status).toBe('escalated');
    expect(stored?.providerRef).toBeUndefined();
  });

  it('a fenced double-claim commits exactly one filer', async () => {
    const id = await enqueueScan(`pub-${randomUUID()}`, 'd'.repeat(64));
    const nowMs = Date.now();
    const claimA = await store.claimQueuedForFiling({ owner: 'A', limit: 10, leaseMs: 50, nowMs });
    expect(claimA.find((c) => c.record.id === id)).toBeTruthy();
    // Wait for A's lease to expire, then B reclaims.
    await new Promise((resolve) => setTimeout(resolve, 80));
    const laterMs = Date.now();
    const claimB = await store.claimQueuedForFiling({ owner: 'B', limit: 10, leaseMs: 30_000, nowMs: laterMs });
    const bClaim = claimB.find((c) => c.record.id === id);
    expect(bClaim).toBeTruthy();
    const aClaim = claimA.find((c) => c.record.id === id)!;

    const stale = await store.completeFiling({
      owner: 'A', id, fencingToken: aClaim.fencingToken,
      resolution: { kind: 'filed', providerRef: 'ct-stale' }, nowMs: laterMs,
    });
    expect(stale).toBe('lease_lost');
    const live = await store.completeFiling({
      owner: 'B', id, fencingToken: bClaim!.fencingToken,
      resolution: { kind: 'filed', providerRef: 'ct-live' }, nowMs: laterMs,
    });
    expect(live).toBe('committed');
    expect((await store.get(id))?.providerRef).toBe('ct-live');
  });

  it('reports escalated in the status counts', async () => {
    const counts = await store.counts();
    expect(counts).toHaveProperty('escalated');
    expect(counts.total).toBeGreaterThanOrEqual(counts.filed + counts.escalated);
  });
});
