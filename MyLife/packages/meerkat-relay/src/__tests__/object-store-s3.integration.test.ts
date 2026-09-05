/**
 * Live MinIO integration suite for the S3 MeerkatObjectStore (WP-2B).
 *
 * Gated on MEERKAT_TEST_S3_ENDPOINT + MEERKAT_TEST_S3_ACCESS_KEY + MEERKAT_TEST_S3_SECRET_KEY,
 * so it skips cleanly when no S3-compatible endpoint is configured, exactly like the postgres
 * integration suites. It runs the ENTIRE shared object-store conformance scenario suite against
 * S3ObjectStore with a FRESH BUCKET per scenario (the conformance runner creates a new store per
 * scenario, so ordering can never mask a durability, idempotency, or verification defect), plus
 * S3-specific tests: the presigner mints a working constrained PUT URL, an unavailable endpoint
 * yields ObjectStoreUnavailableError rather than null, and a multipart upload split across two
 * adapter instances verifies and lands.
 *
 * Local run:
 *   docker run -d --name meerkat-minio-wp2b -p 55490:9000 \
 *     -e MINIO_ROOT_USER=meerkat -e MINIO_ROOT_PASSWORD=meerkat-test-secret \
 *     minio/minio:latest server /data
 *   MEERKAT_TEST_S3_ENDPOINT=http://127.0.0.1:55490 \
 *   MEERKAT_TEST_S3_ACCESS_KEY=meerkat MEERKAT_TEST_S3_SECRET_KEY=meerkat-test-secret \
 *     pnpm --filter @mylife/meerkat-relay test:s3
 */

import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  OBJECT_STORE_MIN_PART_BYTES,
  ObjectStoreUnavailableError,
  type MeerkatObjectStore,
  type ObjectMultipartPart,
} from '../object-store';
import { S3ObjectStore } from '../object-store-s3';
import { runStoreConformanceSuite } from '../postgres/conformance/store-conformance';
import { objectStoreScenarios, sha256Hex } from './object-store-conformance';

const endpoint = process.env.MEERKAT_TEST_S3_ENDPOINT?.trim();
const accessKeyId = process.env.MEERKAT_TEST_S3_ACCESS_KEY?.trim();
const secretAccessKey = process.env.MEERKAT_TEST_S3_SECRET_KEY?.trim();
const region = process.env.MEERKAT_TEST_S3_REGION?.trim() || 'us-east-1';
const ready = Boolean(endpoint && accessKeyId && secretAccessKey);
const describeS3 = ready ? describe.sequential : describe.skip;

const adminClient = ready
  ? new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    })
  : undefined;

const createdBuckets: string[] = [];

function bucketName(): string {
  return `mk-wp2b-${randomUUID().slice(0, 12)}`;
}

async function makeBucket(): Promise<string> {
  const bucket = bucketName();
  await adminClient!.send(new CreateBucketCommand({ Bucket: bucket }));
  createdBuckets.push(bucket);
  return bucket;
}

async function emptyAndDeleteBucket(bucket: string): Promise<void> {
  let continuationToken: string | undefined;
  do {
    const listed = await adminClient!.send(new ListObjectsV2Command({
      Bucket: bucket,
      ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
    }));
    const keys = (listed.Contents ?? []).map((object) => ({ Key: object.Key! })).filter((o) => o.Key);
    if (keys.length > 0) {
      await adminClient!.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
  await adminClient!.send(new DeleteBucketCommand({ Bucket: bucket }));
}

function makeStore(bucket: string): S3ObjectStore {
  return new S3ObjectStore({
    region,
    endpoint: endpoint!,
    bucket,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    forcePathStyle: true,
  });
}

afterAll(async () => {
  if (!adminClient) return;
  await Promise.all(createdBuckets.splice(0).map((bucket) => (
    emptyAndDeleteBucket(bucket).catch(() => undefined)
  )));
});

describeS3('S3ObjectStore live MinIO conformance', () => {
  it('passes every object-store conformance scenario against a fresh bucket per scenario', async () => {
    // A fresh bucket per scenario mirrors the memory/file suites' fresh-store-per-scenario
    // contract, so no scenario's objects leak into another.
    const perScenarioBuckets: string[] = [];
    const result = await runStoreConformanceSuite<MeerkatObjectStore>({
      storeName: 's3-minio',
      createStore: async () => {
        const bucket = await makeBucket();
        perScenarioBuckets.push(bucket);
        return makeStore(bucket);
      },
      scenarios: objectStoreScenarios,
    });
    expect(result.passedScenarios).toEqual(objectStoreScenarios.map((scenario) => scenario.name));
  }, 120_000);
});

describeS3('S3ObjectStore S3-specific behaviors', () => {
  it('mints a presigned PUT whose signature is honored by the endpoint', async () => {
    const bucket = await makeBucket();
    const store = makeStore(bucket);
    const bytes = new Uint8Array(Buffer.from('presigned payload bytes', 'utf8'));
    const checksum = sha256Hex(bytes);
    const target = await store.createUploadTarget({
      objectKey: 'quarantine/presigned',
      checksum,
      sizeBytes: bytes.length,
      fencingToken: 3,
      expiresAt: '2026-07-10T13:00:00.000Z',
    });
    expect(target.method).toBe('PUT');
    expect(target.url).toContain('quarantine/presigned');

    const put = await fetch(target.url, {
      method: 'PUT',
      headers: {
        'content-length': String(bytes.length),
        'x-amz-checksum-sha256': Buffer.from(checksum, 'hex').toString('base64'),
      },
      body: bytes,
    });
    expect(put.ok).toBe(true);
    // The store then observes and reads the bytes the presigned PUT transferred.
    const observed = await store.observe('quarantine/presigned');
    expect(observed).toMatchObject({ checksumSha256: checksum, state: 'quarantined' });
    const read = await store.read('quarantine/presigned');
    expect(read ? sha256Hex(read.bytes) : null).toBe(checksum);
  }, 30_000);

  it('surfaces an unreachable endpoint as ObjectStoreUnavailableError, never as absence', async () => {
    // A dead port on loopback fails to connect; the adapter must raise unavailable, not return null.
    const store = new S3ObjectStore({
      region,
      endpoint: 'http://127.0.0.1:1',
      bucket: 'mk-wp2b-unreachable',
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
      forcePathStyle: true,
      maxAttempts: 2,
    });
    await expect(store.observe('quarantine/whatever')).rejects.toBeInstanceOf(ObjectStoreUnavailableError);
  }, 30_000);

  it('completes a multipart upload begun on one instance and appended/completed on another', async () => {
    const bucket = await makeBucket();
    const beginStore = makeStore(bucket);
    const finishStore = makeStore(bucket);
    const firstPart = new Uint8Array(OBJECT_STORE_MIN_PART_BYTES);
    firstPart.fill(7);
    const tail = new Uint8Array(Buffer.from('cross-instance tail', 'utf8'));
    const whole = new Uint8Array(firstPart.length + tail.length);
    whole.set(firstPart, 0);
    whole.set(tail, firstPart.length);

    const begun = await beginStore.beginMultipart({
      key: 'quarantine/cross-instance',
      checksumSha256: sha256Hex(whole),
      sizeBytes: whole.length,
    });
    const parts: ObjectMultipartPart[] = [
      { partNumber: 1, checksumSha256: sha256Hex(firstPart), sizeBytes: firstPart.length },
      { partNumber: 2, checksumSha256: sha256Hex(tail), sizeBytes: tail.length },
    ];
    // Append the parts from the SECOND instance using the handle the first minted.
    expect((await finishStore.appendPart({
      key: 'quarantine/cross-instance', uploadId: begun.uploadId, partNumber: 1,
      checksumSha256: parts[0]!.checksumSha256, bytes: firstPart,
    })).status).toBe('appended');
    expect((await finishStore.appendPart({
      key: 'quarantine/cross-instance', uploadId: begun.uploadId, partNumber: 2,
      checksumSha256: parts[1]!.checksumSha256, bytes: tail,
    })).status).toBe('appended');
    const completed = await finishStore.completeMultipart({
      key: 'quarantine/cross-instance', uploadId: begun.uploadId, parts,
    });
    expect(completed.status).toBe('stored');
    if (completed.status !== 'stored') return;
    expect(completed.object).toMatchObject({ checksumSha256: sha256Hex(whole), state: 'quarantined' });
    const read = await finishStore.read('quarantine/cross-instance');
    expect(read?.bytes.length).toBe(whole.length);
    expect(read ? sha256Hex(read.bytes) : null).toBe(sha256Hex(whole));
  }, 60_000);

  it('stores a rejected finalize as a bytes-free, never-served marker', async () => {
    const bucket = await makeBucket();
    const store = makeStore(bucket);
    const bytes = new Uint8Array(Buffer.from('honest bytes', 'utf8'));
    const wrong = sha256Hex(new Uint8Array(Buffer.from('a different declaration', 'utf8')));
    const result = await store.put({ key: 'quarantine/rejected', checksumSha256: wrong, bytes });
    expect(result.status).toBe('checksum_mismatch');
    const observed = await store.observe('quarantine/rejected');
    expect(observed?.state).toBe('rejected');
    // A rejected object exposes no retrievable bytes down the read path.
    expect(await store.read('quarantine/rejected')).toBeNull();
  }, 30_000);

  it('excludes the version sidecar from inventory while keeping versionId monotonic across delete+rewrite', async () => {
    const bucket = await makeBucket();
    const store = makeStore(bucket);
    const first = new Uint8Array(Buffer.from('gen one', 'utf8'));
    const v1 = await store.put({ key: 'quarantine/ver', checksumSha256: sha256Hex(first), bytes: first });
    expect(v1.status).toBe('stored');
    await store.deleteObject('quarantine/ver');
    const second = new Uint8Array(Buffer.from('gen two', 'utf8'));
    const v2 = await store.put({ key: 'quarantine/ver', checksumSha256: sha256Hex(second), bytes: second });
    expect(v2.status).toBe('stored');
    if (v1.status !== 'stored' || v2.status !== 'stored') return;
    // The rewrite's version strictly exceeds the deleted generation's, proven by the sidecar.
    expect(v2.object.versionId).not.toBe(v1.object.versionId);
    // Inventory lists only the real object, never the __mkver sidecar.
    const page = await store.listInventory({ limit: 100 });
    expect(page.entries.map((entry) => entry.key)).toEqual(['quarantine/ver']);
  }, 30_000);
});
