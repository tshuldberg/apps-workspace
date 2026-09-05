/**
 * Live MinIO integration for the archive byte path (Plan 44 WP-2E).
 *
 * Gated on MEERKAT_TEST_S3_ENDPOINT + MEERKAT_TEST_S3_ACCESS_KEY + MEERKAT_TEST_S3_SECRET_KEY, so it
 * skips cleanly when no S3 endpoint is configured. It drives the full archive flow through
 * ArchiveObjectByteService against a REAL S3 object store (the same code first-party uses):
 * intake(quarantine) -> promote(durable) -> serve, and asserts on live S3 that nothing quarantined
 * is servable, promote is the checksum-verified quarantine-to-durable move, a durable object serves
 * only after a fresh content hash verification, and a corrupted/durable-key overwrite is refused.
 *
 * Local run:
 *   MEERKAT_TEST_S3_ENDPOINT=http://127.0.0.1:55490 MEERKAT_TEST_S3_ACCESS_KEY=meerkat \
 *   MEERKAT_TEST_S3_SECRET_KEY=meerkat-test-secret pnpm --filter @mylife/meerkat-relay test:s3-archive
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  createArchiveJob,
  createPublication,
  generateDeviceIdentity,
  type SignedArchiveJob,
} from '@mylife/sync';
import { afterAll, describe, expect, it } from 'vitest';
import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { S3ObjectStore } from '../object-store-s3';
import { InMemoryArchiveLifecycleStore } from '../archive-lifecycle';
import { InMemoryObjectReferenceLedger } from '../object-reference-ledger-memory';
import { ArchiveObjectByteService, archiveObjectReferrer } from '../archive-object-bytes';

const endpoint = process.env.MEERKAT_TEST_S3_ENDPOINT?.trim();
const accessKeyId = process.env.MEERKAT_TEST_S3_ACCESS_KEY?.trim();
const secretAccessKey = process.env.MEERKAT_TEST_S3_SECRET_KEY?.trim();
const region = process.env.MEERKAT_TEST_S3_REGION?.trim() || 'us-east-1';
const ready = Boolean(endpoint && accessKeyId && secretAccessKey);
const describeS3 = ready ? describe.sequential : describe.skip;

const START = Date.parse('2026-07-10T12:00:00.000Z');
const OWNER_HASH = 'c'.repeat(64);
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const adminClient = ready
  ? new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! } })
  : undefined;
const createdBuckets: string[] = [];

async function makeBucket(): Promise<string> {
  const bucket = `mk-wp2e-${randomUUID().slice(0, 12)}`;
  await adminClient!.send(new CreateBucketCommand({ Bucket: bucket }));
  createdBuckets.push(bucket);
  return bucket;
}

async function emptyAndDeleteBucket(bucket: string): Promise<void> {
  let token: string | undefined;
  do {
    const listed = await adminClient!.send(new ListObjectsV2Command({ Bucket: bucket, ...(token ? { ContinuationToken: token } : {}) }));
    const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key);
    if (keys.length > 0) await adminClient!.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
  await adminClient!.send(new DeleteBucketCommand({ Bucket: bucket }));
}

function s3Store(bucket: string): S3ObjectStore {
  return new S3ObjectStore({ region, endpoint: endpoint!, bucket, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, forcePathStyle: true });
}

function signedJob(contentId: string): SignedArchiveJob {
  const owner = generateDeviceIdentity('Archive S3 owner');
  const publication = createPublication(owner, {
    kind: 'channel', communityId: 'community-1', channelId: 'channel-1', postId: null,
    title: 'Durable archive', description: 'Archive S3 fixture.', category: 'technology',
    contentId, publicKeyHex: 'aabbccddeeff00', hostUrls: ['https://archive.example'],
    joinPolicy: 'open', now: new Date(START).toISOString(),
  });
  return createArchiveJob(owner, publication, {
    tier: 'managed', hostUrl: 'https://archive.example',
    objects: [{ index: 0, hash: '00'.repeat(32), size: 1 }],
    rights: { license: 'cc_by', rightsAssertion: 'i_own', provenance: 'Fixture owner.', consentAt: new Date(START).toISOString() },
    now: new Date(START).toISOString(),
  });
}

afterAll(async () => {
  if (!adminClient) return;
  await Promise.all(createdBuckets.splice(0).map((b) => emptyAndDeleteBucket(b).catch(() => undefined)));
});

describeS3('archive byte path over live MinIO', () => {
  it('runs intake -> promote -> serve on live S3 with verify-before-serve and one reference edge', async () => {
    const bucket = await makeBucket();
    const objectStore = s3Store(bucket);
    const archiveStore = new InMemoryArchiveLifecycleStore();
    const ledger = new InMemoryObjectReferenceLedger();
    const service = new ArchiveObjectByteService(objectStore, archiveStore, ledger);

    const bytes = new Uint8Array(Buffer.from('durable archive over live s3', 'utf8'));
    const job = signedJob('archive-content-s3');
    const created = await archiveStore.enqueue({
      signedJob: job, idempotencyKey: `archive-${job.job.jobId}`,
      requestDigestHex: sha256(new Uint8Array(Buffer.from(JSON.stringify(job), 'utf8'))),
      ownerSubjectHashHex: OWNER_HASH, expectedBytes: bytes.length, nowMs: START,
    });
    if (created.status !== 'created') throw new Error('enqueue failed');
    const jobId = created.job.jobId;
    const quarantineKey = `quarantine/${jobId}/0`;
    const durableKey = `durable/${jobId}/0`;

    const intake = await service.intakeQuarantineObject({
      jobId, expectedJobVersion: 1, objectIndex: 0, quarantineKey,
      objectHash: sha256(bytes), bytes, nowMs: START + 1,
    });
    expect(intake.status).toBe('quarantined');
    // Nothing quarantined is servable off the durable key.
    expect(await service.serveDurableObject({ durableKey, expectedChecksumSha256: sha256(bytes) })).toBeNull();

    // Approve + claim a promoter lease.
    await archiveStore.markQuarantined(jobId, 2, START + 3);
    const [scan] = await archiveStore.claimJobs({ workerId: 'scanner', eligibleStatuses: ['quarantined'], limit: 1, leaseMs: 1_000, nowMs: START + 4 });
    await archiveStore.completeScan({
      jobId, workerId: 'scanner', fencingToken: scan!.fencingToken, nowMs: START + 5,
      scanId: '00000000-0000-4000-8000-000000000009', engine: 'clamav', engineVersion: '1.4.3',
      result: 'clean', startedAt: new Date(START + 4).toISOString(), completedAt: new Date(START + 5).toISOString(),
    });
    const [promo] = await archiveStore.claimJobs({ workerId: 'promoter', eligibleStatuses: ['approved'], limit: 1, leaseMs: 1_000, nowMs: START + 6 });

    const promoted = await service.promoteObject({
      jobId, workerId: 'promoter', fencingToken: promo!.fencingToken, objectIndex: 0,
      quarantineKey, durableKey, expectedChecksumSha256: sha256(bytes), nowMs: START + 7,
    });
    expect(promoted).toEqual({ status: 'durable', durableKey, storageChecksum: sha256(bytes) });

    // The durable object serves off live S3, verified.
    const served = await service.serveDurableObject({ durableKey, expectedChecksumSha256: sha256(bytes) });
    expect(served ? sha256(served) : null).toBe(sha256(bytes));
    // A wrong expected checksum is refused before any byte is served.
    expect(await service.serveDurableObject({
      durableKey, expectedChecksumSha256: sha256(new Uint8Array(Buffer.from('wrong', 'utf8'))),
    })).toBeNull();
    // Single reference authority: exactly one edge for the durable key; the quarantine key is gone.
    expect(await ledger.listReferrers(durableKey)).toEqual([archiveObjectReferrer(jobId, 0)]);
    expect(await objectStore.observe(quarantineKey)).toBeNull();
  }, 60_000);

  it('refuses to promote when the quarantine bytes do not match the expected checksum', async () => {
    const bucket = await makeBucket();
    const objectStore = s3Store(bucket);
    const service = new ArchiveObjectByteService(objectStore, new InMemoryArchiveLifecycleStore(), new InMemoryObjectReferenceLedger());
    // Land a quarantine object honestly, then attempt a promote with a WRONG expected checksum.
    const bytes = new Uint8Array(Buffer.from('honest quarantine bytes', 'utf8'));
    const quarantineKey = 'quarantine/mismatch/0';
    const durableKey = 'durable/mismatch/0';
    const put = await objectStore.put({ key: quarantineKey, checksumSha256: sha256(bytes), bytes });
    expect(put.status).toBe('stored');
    const promoted = await service.promoteObject({
      jobId: 'a'.repeat(32), workerId: 'promoter', fencingToken: 1, objectIndex: 0,
      quarantineKey, durableKey, expectedChecksumSha256: sha256(new Uint8Array(Buffer.from('not these', 'utf8'))), nowMs: START + 7,
    });
    expect(promoted.status).toBe('checksum_mismatch');
    // The durable key was never written on a checksum mismatch.
    expect(await objectStore.observe(durableKey)).toBeNull();
  }, 60_000);
});
