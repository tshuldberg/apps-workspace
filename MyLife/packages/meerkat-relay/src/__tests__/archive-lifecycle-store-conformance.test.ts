import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createArchiveJob,
  createPublication,
  generateDeviceIdentity,
  type SignedArchiveJob,
} from '@mylife/sync';
import { afterEach, describe, expect, it } from 'vitest';
import {
  InMemoryArchiveLifecycleStore,
  type ArchiveLifecycleStore,
} from '../archive-lifecycle';
import { FileArchiveLifecycleStore } from '../archive-lifecycle-store-file';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const OWNER_HASH = 'c'.repeat(64);
const START = Date.parse('2026-07-10T12:00:00.000Z');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )));
});

function signedJob(contentId = 'archive-content-1'): SignedArchiveJob {
  const owner = generateDeviceIdentity('Archive lifecycle owner');
  const publication = createPublication(owner, {
    kind: 'channel',
    communityId: 'community-1',
    channelId: 'channel-1',
    postId: null,
    title: 'Durable archive',
    description: 'Archive lifecycle fixture.',
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

async function fileStore(): Promise<FileArchiveLifecycleStore> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-archive-store-'));
  temporaryDirectories.push(directory);
  return new FileArchiveLifecycleStore(directory);
}

function createInput(job = signedJob()) {
  return {
    signedJob: job,
    idempotencyKey: `archive-${job.job.jobId}`,
    requestDigestHex: createHash('sha256').update(JSON.stringify(job)).digest('hex'),
    ownerSubjectHashHex: OWNER_HASH,
    expectedBytes: 10,
    nowMs: START,
  };
}

async function runCleanLifecycle(store: ArchiveLifecycleStore): Promise<{
  jobId: string;
  publicationId: string;
  hostId: string;
}> {
  const input = createInput();
  const created = await store.enqueue(input);
  expect(created.status).toBe('created');
  if (created.status !== 'created') throw new Error('fixture enqueue failed');
  const { jobId, publicationId } = created.job;

  expect(await store.isServeable(publicationId, 'host-1')).toBe(false);
  expect(await store.recordQuarantineObject({
    jobId,
    expectedJobVersion: 1,
    objectIndex: 0,
    objectHash: SHA_A,
    objectBytes: 4,
    quarantineKey: `quarantine/${jobId}/0`,
    nowMs: START + 1,
  })).toMatchObject({ metadataStatus: 'verified' });
  expect(await store.recordQuarantineObject({
    jobId,
    expectedJobVersion: 2,
    objectIndex: 1,
    objectHash: SHA_B,
    objectBytes: 6,
    quarantineKey: `quarantine/${jobId}/1`,
    nowMs: START + 2,
  })).not.toBeNull();
  const quarantined = await store.markQuarantined(jobId, 3, START + 3);
  expect(quarantined?.status).toBe('quarantined');
  expect(await store.isServeable(publicationId, 'host-1')).toBe(false);

  const [firstClaim] = await store.claimJobs({
    workerId: 'scanner-a', eligibleStatuses: ['quarantined'], limit: 1,
    leaseMs: 100, nowMs: START + 4,
  });
  expect(firstClaim?.job.status).toBe('scanning');
  const [reclaimed] = await store.claimJobs({
    workerId: 'scanner-b', eligibleStatuses: ['scanning'], limit: 1,
    leaseMs: 1_000, nowMs: START + 105,
  });
  expect(reclaimed?.fencingToken).toBe((firstClaim?.fencingToken ?? 0) + 1);

  const stale = await store.completeScan({
    jobId,
    workerId: 'scanner-a',
    fencingToken: firstClaim!.fencingToken,
    nowMs: START + 106,
    scanId: '00000000-0000-4000-8000-000000000001',
    engine: 'clamav',
    engineVersion: '1.4.3',
    definitionsVersion: '20260710',
    result: 'clean',
    startedAt: new Date(START + 4).toISOString(),
    completedAt: new Date(START + 100).toISOString(),
  });
  expect(stale).toBeNull();

  const approved = await store.completeScan({
    jobId,
    workerId: 'scanner-b',
    fencingToken: reclaimed!.fencingToken,
    nowMs: START + 107,
    scanId: '00000000-0000-4000-8000-000000000002',
    engine: 'clamav',
    engineVersion: '1.4.3',
    definitionsVersion: '20260710',
    result: 'clean',
    evidence: { reference: 'evidence/scan-clean' },
    startedAt: new Date(START + 105).toISOString(),
    completedAt: new Date(START + 106).toISOString(),
  });
  expect(approved?.status).toBe('approved');
  expect(await store.isServeable(publicationId, 'host-1')).toBe(false);

  const [promotion] = await store.claimJobs({
    workerId: 'promoter-1', eligibleStatuses: ['approved'], limit: 1,
    leaseMs: 1_000, nowMs: START + 108,
  });
  for (const [objectIndex, storageChecksum] of [[0, SHA_A], [1, SHA_B]] as const) {
    expect(await store.markObjectDurable({
      jobId,
      workerId: 'promoter-1',
      fencingToken: promotion!.fencingToken,
      nowMs: START + 109 + objectIndex,
      objectIndex,
      durableKey: `durable/${input.signedJob.job.contentId}/${objectIndex}`,
      storageChecksum,
    })).not.toBeNull();
  }
  expect(await store.activatePin({
    jobId,
    workerId: 'promoter-1',
    fencingToken: promotion!.fencingToken,
    nowMs: START + 112,
    hostId: 'host-1',
  })).toMatchObject({ state: 'active' });
  expect(await store.isServeable(publicationId, 'host-1')).toBe(true);

  const [announcement] = await store.claimJobs({
    workerId: 'announcer-1', eligibleStatuses: ['pinned'], limit: 1,
    leaseMs: 1_000, nowMs: START + 113,
  });
  expect((await store.markAnnounced({
    jobId,
    workerId: 'announcer-1',
    fencingToken: announcement!.fencingToken,
    nowMs: START + 114,
  }))?.status).toBe('announced');
  return { jobId, publicationId, hostId: 'host-1' };
}

/**
 * Drive one single-object job to an active pin on `host-1` with a DISTINCT content id, so several
 * pins can coexist for the pin-reconciliation listing tests. Uses the suffix to derive unique
 * content, scan id, and object hash, avoiding the shared-content dedup path.
 */
async function drivePin(
  store: ArchiveLifecycleStore,
  suffix: string,
): Promise<{ jobId: string; publicationId: string }> {
  const job = signedJob(`content-${suffix}`);
  const created = await store.enqueue({
    signedJob: job,
    idempotencyKey: `archive-${job.job.jobId}`,
    requestDigestHex: createHash('sha256').update(JSON.stringify(job)).digest('hex'),
    ownerSubjectHashHex: OWNER_HASH,
    expectedBytes: 4,
    nowMs: START,
  });
  if (created.status !== 'created') throw new Error('drivePin enqueue failed');
  const { jobId, publicationId } = created.job;
  const hash = createHash('sha256').update(`obj-${suffix}`).digest('hex');
  await store.recordQuarantineObject({
    jobId, expectedJobVersion: 1, objectIndex: 0, objectHash: hash, objectBytes: 4,
    quarantineKey: `quarantine/content-${suffix}/0`, nowMs: START + 1,
  });
  await store.markQuarantined(jobId, 2, START + 2);
  const [scan] = await store.claimJobs({
    workerId: 'scanner', eligibleStatuses: ['quarantined'], limit: 1, leaseMs: 5_000, nowMs: START + 3,
  });
  const scanTail = createHash('sha256').update(`scan-${suffix}`).digest('hex').slice(0, 12);
  await store.completeScan({
    jobId, workerId: 'scanner', fencingToken: scan!.fencingToken, nowMs: START + 4,
    scanId: `00000000-0000-4000-8000-${scanTail}`,
    engine: 'clamav', engineVersion: '1.4.3', result: 'clean',
    startedAt: new Date(START + 3).toISOString(), completedAt: new Date(START + 4).toISOString(),
  });
  const [promo] = await store.claimJobs({
    workerId: 'promoter', eligibleStatuses: ['approved'], limit: 1, leaseMs: 5_000, nowMs: START + 5,
  });
  await store.markObjectDurable({
    jobId, workerId: 'promoter', fencingToken: promo!.fencingToken, objectIndex: 0,
    durableKey: `durable/content-${suffix}/0`, storageChecksum: hash, nowMs: START + 6,
  });
  await store.activatePin({
    jobId, workerId: 'promoter', fencingToken: promo!.fencingToken, hostId: 'host-1', nowMs: START + 7,
  });
  return { jobId, publicationId };
}

describe.each([
  ['memory', async (): Promise<ArchiveLifecycleStore> => new InMemoryArchiveLifecycleStore()],
  ['file', async (): Promise<ArchiveLifecycleStore> => fileStore()],
] as const)('archive lifecycle %s conformance', (_name, factory) => {
  it('keeps quarantine private, fences stale workers, and serves only a clean durable pin', async () => {
    const store = await factory();
    await runCleanLifecycle(store);
  });

  it('replays only the same request digest and never double counts an object replay', async () => {
    const store = await factory();
    const input = createInput();
    const created = await store.enqueue(input);
    const replay = await store.enqueue(input);
    expect(created.status).toBe('created');
    expect(replay.status).toBe('replay');
    expect((await store.enqueue({ ...input, requestDigestHex: SHA_B })).status).toBe('conflict');
    if (created.status !== 'created') throw new Error('fixture enqueue failed');
    const object = {
      jobId: created.job.jobId,
      expectedJobVersion: 1,
      objectIndex: 0,
      objectHash: SHA_A,
      objectBytes: 10,
      quarantineKey: `quarantine/${created.job.jobId}/0`,
      nowMs: START + 1,
    };
    expect(await store.recordQuarantineObject(object)).not.toBeNull();
    const afterFirst = await store.getJob(created.job.jobId);
    expect(await store.recordQuarantineObject({
      ...object,
      expectedJobVersion: afterFirst!.lifecycleVersion,
      nowMs: START + 2,
    })).toMatchObject({ objectBytes: 10 });
    expect((await store.getJob(created.job.jobId))?.receivedBytes).toBe(10);
  });

  it('charges owner quota once per live job and releases it only after durable removal', async () => {
    const store = await factory();
    const firstInput = createInput(signedJob('quota-content-1'));
    const secondInput = { ...createInput(signedJob('quota-content-2')), expectedBytes: 5 };
    const first = await store.enqueue(firstInput);
    await store.enqueue(firstInput);
    await store.enqueue(secondInput);
    expect(await store.usedBytesForOwner(OWNER_HASH)).toBe(15);
    expect(await store.usedBytesForOwner('invalid')).toBe(0);
    if (first.status !== 'created') throw new Error('quota fixture enqueue failed');
    await store.requestTakedown(first.job.jobId, START + 1);
    expect(await store.usedBytesForOwner(OWNER_HASH)).toBe(15);
    const [claim] = await store.claimJobs({
      workerId: 'quota-remover', eligibleStatuses: ['takedown_pending'], limit: 1,
      leaseMs: 1_000, nowMs: START + 2,
    });
    await store.confirmRemoval({
      jobId: first.job.jobId,
      workerId: 'quota-remover',
      fencingToken: claim!.fencingToken,
      hostId: null,
      nowMs: START + 3,
    });
    expect(await store.usedBytesForOwner(OWNER_HASH)).toBe(5);
  });

  it('reserves owner quota atomically and still permits an idempotent replay', async () => {
    const store = await factory();
    const first = { ...createInput(signedJob('quota-race-1')), expectedBytes: 6, ownerCapBytes: 10 };
    const second = { ...createInput(signedJob('quota-race-2')), expectedBytes: 6, ownerCapBytes: 10 };
    const results = await Promise.all([store.enqueue(first), store.enqueue(second)]);
    expect(results.map((result) => result.status).sort()).toEqual(['created', 'quota_exceeded']);
    const accepted = results[0]?.status === 'created' ? first : second;
    await expect(Promise.resolve(store.enqueue(accepted))).resolves.toMatchObject({ status: 'replay' });
    expect(await store.usedBytesForOwner(OWNER_HASH)).toBe(6);
  });

  it('disables serving in the same takedown mutation before deletion completes', async () => {
    const store = await factory();
    const { jobId, publicationId, hostId } = await runCleanLifecycle(store);
    const requested = await store.requestTakedown(jobId, START + 200);
    expect(requested?.status).toBe('takedown_pending');
    expect((await store.requestTakedown(jobId, START + 201))?.lifecycleVersion)
      .toBe(requested?.lifecycleVersion);
    expect(await store.isServeable(publicationId, hostId)).toBe(false);
    const [deletion] = await store.claimJobs({
      workerId: 'deleter-1', eligibleStatuses: ['takedown_pending'], limit: 1,
      leaseMs: 1_000, nowMs: START + 202,
    });
    for (const object of await store.listObjects(jobId)) {
      expect(await store.markObjectDeleted({
        jobId,
        workerId: 'deleter-1',
        fencingToken: deletion!.fencingToken,
        nowMs: START + 203,
        objectIndex: object.objectIndex,
        absenceVerified: true,
      })).toMatchObject({ status: 'deleted' });
    }
    expect((await store.confirmRemoval({
      jobId,
      workerId: 'deleter-1',
      fencingToken: deletion!.fencingToken,
      nowMs: START + 204,
      hostId,
    }))?.status).toBe('removed');
  });

  it('retains shared content bytes while another live publication references them', async () => {
    const store = await factory();
    const first = await runCleanLifecycle(store);
    const secondInput = createInput(signedJob('archive-content-1'));
    const second = await store.enqueue(secondInput);
    if (second.status !== 'created') throw new Error('second archive fixture enqueue failed');
    expect(await store.recordQuarantineObject({
      jobId: second.job.jobId,
      expectedJobVersion: 1,
      objectIndex: 0,
      objectHash: SHA_A,
      objectBytes: 4,
      quarantineKey: `quarantine/${first.jobId}/0`,
      nowMs: START + 150,
    })).toMatchObject({ status: 'durable' });
    expect((await store.markQuarantined(
      second.job.jobId,
      2,
      START + 151,
    ))?.status).toBe('quarantined');

    await store.requestTakedown(first.jobId, START + 200);
    const [deletion] = await store.claimJobs({
      workerId: 'shared-deleter', eligibleStatuses: ['takedown_pending'], limit: 1,
      leaseMs: 1_000, nowMs: START + 201,
    });
    expect(await store.markObjectDeleted({
      jobId: first.jobId,
      workerId: 'shared-deleter',
      fencingToken: deletion!.fencingToken,
      nowMs: START + 202,
      objectIndex: 0,
      absenceVerified: false,
    })).toMatchObject({ status: 'shared', object: { status: 'durable' } });
    expect((await store.confirmRemoval({
      jobId: first.jobId,
      workerId: 'shared-deleter',
      fencingToken: deletion!.fencingToken,
      nowMs: START + 203,
      hostId: first.hostId,
    }))?.status).toBe('removed');
    expect((await store.listObjects(second.job.jobId)).every((object) => object.status === 'durable'))
      .toBe(true);
  });

  it('keeps scanner errors non-serveable and schedules a bounded retry', async () => {
    const store = await factory();
    const input = { ...createInput(), expectedBytes: 0 };
    const created = await store.enqueue(input);
    if (created.status !== 'created') throw new Error('fixture enqueue failed');
    const quarantined = await store.markQuarantined(created.job.jobId, 1, START + 1);
    expect(quarantined?.status).toBe('quarantined');
    const [claim] = await store.claimJobs({
      workerId: 'scanner-a', eligibleStatuses: ['quarantined'], limit: 1,
      leaseMs: 1_000, nowMs: START + 2,
    });
    const retryAtMs = START + 10_000;
    expect((await store.completeScan({
      jobId: created.job.jobId,
      workerId: 'scanner-a',
      fencingToken: claim!.fencingToken,
      nowMs: START + 3,
      scanId: '00000000-0000-4000-8000-000000000003',
      engine: 'clamav',
      engineVersion: '1.4.3',
      result: 'error',
      resultCode: 'definitions_stale',
      startedAt: new Date(START + 2).toISOString(),
      completedAt: new Date(START + 3).toISOString(),
      retryAtMs,
    }))?.nextAttemptAtMs).toBe(retryAtMs);
    expect(await store.claimJobs({
      workerId: 'scanner-b', eligibleStatuses: ['quarantined'], limit: 1,
      leaseMs: 1_000, nowMs: START + 9_999,
    })).toEqual([]);
  });

  it('bounds object cardinality, zero-byte rows, and scan evidence metadata', async () => {
    const store = await factory();
    const input = { ...createInput(), expectedBytes: 1 };
    const created = await store.enqueue(input);
    if (created.status !== 'created') throw new Error('fixture enqueue failed');
    await expect(Promise.resolve().then(() => store.recordQuarantineObject({
      jobId: created.job.jobId,
      expectedJobVersion: 1,
      objectIndex: 100_000,
      objectHash: SHA_A,
      objectBytes: 1,
      quarantineKey: `quarantine/${created.job.jobId}/overflow`,
      nowMs: START + 1,
    }))).rejects.toThrow('archive object index');
    await expect(Promise.resolve().then(() => store.recordQuarantineObject({
      jobId: created.job.jobId,
      expectedJobVersion: 1,
      objectIndex: 0,
      objectHash: SHA_A,
      objectBytes: 0,
      quarantineKey: `quarantine/${created.job.jobId}/zero`,
      nowMs: START + 1,
    }))).rejects.toThrow('archive object bytes');
    await store.recordQuarantineObject({
      jobId: created.job.jobId,
      expectedJobVersion: 1,
      objectIndex: 0,
      objectHash: SHA_A,
      objectBytes: 1,
      quarantineKey: `quarantine/${created.job.jobId}/0`,
      nowMs: START + 1,
    });
    await store.markQuarantined(created.job.jobId, 2, START + 2);
    const [claim] = await store.claimJobs({
      workerId: 'scanner-bounds', eligibleStatuses: ['quarantined'], limit: 1,
      leaseMs: 1_000, nowMs: START + 3,
    });
    await expect(Promise.resolve().then(() => store.completeScan({
      jobId: created.job.jobId,
      workerId: 'scanner-bounds',
      fencingToken: claim!.fencingToken,
      nowMs: START + 4,
      scanId: '00000000-0000-4000-8000-000000000004',
      engine: 'clamav',
      engineVersion: '1.4.3',
      result: 'clean',
      evidence: { reference: 'x'.repeat(70_000) },
      startedAt: new Date(START + 3).toISOString(),
      completedAt: new Date(START + 4).toISOString(),
    }))).rejects.toThrow('archive scan evidence');
  });

  it('lists a host\'s pins for reconciliation, including non-active states', async () => {
    const store = await factory();
    const { jobId, publicationId } = await drivePin(store, 'r1');

    // The active pin is enumerated for this host.
    const active = await store.listPinsForHost('host-1', { limit: 10 });
    expect(active.records.map((pin) => pin.publicationId)).toContain(publicationId);
    expect(active.records.find((pin) => pin.publicationId === publicationId)?.state).toBe('active');
    // A different host sees none of it.
    expect((await store.listPinsForHost('other-host', { limit: 10 })).records).toHaveLength(0);

    // The byte-presence probe path: objects are listable by content id (no jobId needed).
    const byContent = await store.listObjectsForContent(`content-r1`);
    expect(byContent).toHaveLength(1);
    expect(byContent[0]?.status).toBe('durable');

    // After a takedown the same pin is still listed (now removing) -- the reconciler needs both.
    await store.requestTakedown(jobId, START + 200);
    const afterTakedown = await store.listPinsForHost('host-1', { limit: 10 });
    expect(afterTakedown.records.find((pin) => pin.publicationId === publicationId)?.state)
      .toBe('removing');
  });

  it('pages listPinsForHost with a stable publicationId cursor', async () => {
    const store = await factory();
    const created: string[] = [];
    for (const suffix of ['p1', 'p2', 'p3']) {
      created.push((await drivePin(store, suffix)).publicationId);
    }
    const first = await store.listPinsForHost('host-1', { limit: 2 });
    expect(first.records).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await store.listPinsForHost('host-1', { limit: 2, cursor: first.nextCursor! });
    const seen = [...first.records, ...second.records].map((pin) => pin.publicationId);
    expect(new Set(seen).size).toBe(3);
    expect(seen.sort()).toEqual([...created].sort());
  });
});

describe('FileArchiveLifecycleStore multiprocess guarantees', () => {
  it('allows only one file-store instance to claim a live lease', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-archive-race-'));
    temporaryDirectories.push(directory);
    const first = new FileArchiveLifecycleStore(directory);
    const second = new FileArchiveLifecycleStore(directory);
    const input = { ...createInput(), expectedBytes: 0 };
    const created = await first.enqueue(input);
    if (created.status !== 'created') throw new Error('fixture enqueue failed');
    await first.markQuarantined(created.job.jobId, 1, START + 1);
    const claims = await Promise.all([
      first.claimJobs({ workerId: 'a', eligibleStatuses: ['quarantined'], limit: 1, leaseMs: 1000, nowMs: START + 2 }),
      second.claimJobs({ workerId: 'b', eligibleStatuses: ['quarantined'], limit: 1, leaseMs: 1000, nowMs: START + 2 }),
    ]);
    expect(claims.flat()).toHaveLength(1);
  });

  it('fails closed when the durable ledger is corrupt', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-archive-corrupt-'));
    temporaryDirectories.push(directory);
    await fs.writeFile(path.join(directory, 'archive-lifecycle.json'), '{broken', 'utf8');
    await expect(new FileArchiveLifecycleStore(directory).getJob('a'.repeat(32)))
      .rejects.toThrow('archive ledger is corrupt');
  });
});
