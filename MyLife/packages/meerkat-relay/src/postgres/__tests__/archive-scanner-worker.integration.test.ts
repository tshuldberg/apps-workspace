import { createHash, randomUUID } from 'node:crypto';
import {
  createArchiveJob,
  createPublication,
  generateDeviceIdentity,
  type SignedArchiveJob,
} from '@mylife/sync';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HashSetAbuseScanner } from '../../abuse-scan';
import { FakeMalwareScanner, UnavailableMalwareScanner } from '../../archive-malware-scan';
import {
  ArchiveScannerWorker,
  type QuarantineByteSource,
} from '../../archive-scanner-worker';
import { InMemoryNcmecReportQueueStore, NcmecReportQueue } from '../../ncmec-queue';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresArchiveLifecycleStore } from '../stores/archive-lifecycle-store';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;
const OWNER_HASH = 'd'.repeat(64);

function bytesFor(seed: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) out[i] = (seed + i) % 256;
  return out;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function signedJob(): SignedArchiveJob {
  const now = new Date().toISOString();
  const owner = generateDeviceIdentity(`scanner-owner-${randomUUID()}`);
  const publication = createPublication(owner, {
    kind: 'channel',
    communityId: `community-${randomUUID()}`,
    channelId: 'general',
    postId: null,
    title: 'PostgreSQL scanner archive',
    description: 'Scanner worker integration fixture.',
    category: 'technology',
    contentId: `content-${randomUUID()}`,
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
      provenance: 'Created by the scanner integration fixture owner.',
      consentAt: now,
    },
    now,
  });
}

interface Prepared {
  jobId: string;
  publicationId: string;
  objects: Array<{ objectIndex: number; quarantineKey: string; objectHash: string; bytes: Uint8Array }>;
}

describePostgres('PostgresArchiveLifecycleStore scanner worker integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_scanner_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;
  let store: PostgresArchiveLifecycleStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Scanner integration tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 4 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool);
    store = new PostgresArchiveLifecycleStore(new PostgresStoreContext(pool));
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  async function prepareQuarantined(objectSeeds: readonly number[] = [7, 13]): Promise<Prepared> {
    const job = signedJob();
    const created = await store.enqueue({
      signedJob: job,
      idempotencyKey: `archive-${job.job.jobId}`,
      requestDigestHex: createHash('sha256').update(JSON.stringify(job)).digest('hex'),
      ownerSubjectHashHex: OWNER_HASH,
      expectedBytes: objectSeeds.reduce((total, seed) => total + (seed % 5) + 4, 0),
      nowMs: Date.now(),
    });
    if (created.status !== 'created') throw new Error('fixture enqueue failed');
    const { jobId, publicationId } = created.job;
    const objects: Prepared['objects'] = [];
    let version = 1;
    for (let index = 0; index < objectSeeds.length; index += 1) {
      const seed = objectSeeds[index]!;
      const bytes = bytesFor(seed, (seed % 5) + 4);
      const objectHash = sha256Hex(bytes);
      const quarantineKey = `quarantine/${jobId}/${index}`;
      const recorded = await store.recordQuarantineObject({
        jobId, expectedJobVersion: version, objectIndex: index, objectHash,
        objectBytes: bytes.length, quarantineKey, nowMs: Date.now(),
      });
      if (!recorded) throw new Error('fixture quarantine object failed');
      objects.push({ objectIndex: index, quarantineKey, objectHash, bytes });
      version += 1;
    }
    const quarantined = await store.markQuarantined(jobId, version, Date.now());
    if (quarantined?.status !== 'quarantined') throw new Error('fixture markQuarantined failed');
    return { jobId, publicationId, objects };
  }

  function byteSource(prepared: Prepared): QuarantineByteSource {
    const byKey = new Map(prepared.objects.map((o) => [o.quarantineKey, o.bytes]));
    return async ({ quarantineKey }) => byKey.get(quarantineKey) ?? null;
  }

  async function promoteAndPin(prepared: Prepared): Promise<'active' | 'refused'> {
    const [claim] = await store.claimJobs({
      workerId: 'pinner', eligibleStatuses: ['approved'], limit: 1, leaseMs: 30_000, nowMs: Date.now(),
    });
    if (!claim) return 'refused';
    for (const object of prepared.objects) {
      await store.markObjectDurable({
        jobId: prepared.jobId, workerId: 'pinner', fencingToken: claim.fencingToken,
        objectIndex: object.objectIndex, durableKey: `durable/${prepared.jobId}/${object.objectIndex}`,
        storageChecksum: object.objectHash, nowMs: Date.now(),
      });
    }
    const pin = await store.activatePin({
      jobId: prepared.jobId, workerId: 'pinner', fencingToken: claim.fencingToken,
      hostId: 'host-1', nowMs: Date.now(),
    });
    return pin?.state === 'active' ? 'active' : 'refused';
  }

  it('drives a full quarantine -> scan -> approve -> pin with the fake scanner', async () => {
    const prepared = await prepareQuarantined();
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-a', store,
      malwareScanner: new FakeMalwareScanner(),
      abuseScanner: new HashSetAbuseScanner(),
      readQuarantineBytes: byteSource(prepared),
    });

    // Unscanned: the approved-only pin path is refused.
    expect(await promoteAndPin(prepared)).toBe('refused');

    const tick = await worker.runOnce();
    expect(tick.outcomes).toContainEqual({ jobId: prepared.jobId, decision: 'clean' });
    expect((await store.getJob(prepared.jobId))?.status).toBe('approved');

    expect(await promoteAndPin(prepared)).toBe('active');
    expect(await store.isServeable(prepared.publicationId, 'host-1')).toBe(true);
  });

  it('rejects a malware-hit job and never lets it pin', async () => {
    const prepared = await prepareQuarantined();
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-a', store,
      malwareScanner: new FakeMalwareScanner({ knownBadObjectHashes: [prepared.objects[0]!.objectHash] }),
      abuseScanner: new HashSetAbuseScanner(),
      readQuarantineBytes: byteSource(prepared),
    });
    const tick = await worker.runOnce();
    expect(tick.outcomes).toContainEqual({ jobId: prepared.jobId, decision: 'malware' });
    expect((await store.getJob(prepared.jobId))?.status).toBe('rejected');
    expect(await promoteAndPin(prepared)).toBe('refused');
  });

  it('rejects an abuse-hash-hit job, enqueues NCMEC evidence, and never pins', async () => {
    const prepared = await prepareQuarantined();
    const ncmecQueue = new NcmecReportQueue(new InMemoryNcmecReportQueueStore());
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-a', store,
      malwareScanner: new FakeMalwareScanner(),
      abuseScanner: new HashSetAbuseScanner([prepared.objects[1]!.objectHash]),
      readQuarantineBytes: byteSource(prepared),
      ncmecQueue,
    });
    const tick = await worker.runOnce();
    expect(tick.outcomes).toContainEqual({ jobId: prepared.jobId, decision: 'abuse_hash_match' });
    expect((await store.getJob(prepared.jobId))?.status).toBe('rejected');
    expect(await ncmecQueue.counts()).toMatchObject({ queued: 1 });
    expect(await promoteAndPin(prepared)).toBe('refused');
  });

  it('fails an unconfigured malware scanner closed: quarantined + retryable, never approved', async () => {
    const prepared = await prepareQuarantined();
    const worker = new ArchiveScannerWorker({
      workerId: 'scanner-a', store,
      malwareScanner: new UnavailableMalwareScanner(),
      abuseScanner: new HashSetAbuseScanner(),
      readQuarantineBytes: byteSource(prepared),
      retryMs: 30_000,
    });
    expect(worker.readinessState()).toBe('fail_closed');
    const tick = await worker.runOnce();
    expect(tick.outcomes).toContainEqual({ jobId: prepared.jobId, decision: 'error' });
    const job = await store.getJob(prepared.jobId);
    expect(job?.status).toBe('quarantined');
    expect(job?.lastErrorCode).toBe('malware_scanner_unavailable');
    expect(await promoteAndPin(prepared)).toBe('refused');
  });
});
