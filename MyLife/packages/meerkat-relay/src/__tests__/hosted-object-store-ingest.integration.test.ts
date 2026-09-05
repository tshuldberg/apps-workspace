/**
 * Live MinIO end-to-end for the hosted first-party byte path (Plan 44 WP-2D).
 *
 * Gated on MEERKAT_TEST_S3_ENDPOINT + MEERKAT_TEST_S3_ACCESS_KEY + MEERKAT_TEST_S3_SECRET_KEY, so
 * it skips cleanly when no S3-compatible endpoint is configured (like the postgres/S3 suites).
 *
 * Two things are proven against a REAL S3 store:
 *  1. THE REAL HOSTED BIN composes the object store: booted in self-host mode with an explicit s3
 *     object-store backend (self-host is the only profile hermetically bootable here because
 *     first-party forces verify-full PostgreSQL TLS, which the local fixture lacks), it reports
 *     byteStorageBackend: 's3', reads its credentials from mounted-secret FILES, never logs the
 *     secret, and stops cleanly (disposing the S3 client).
 *  2. THE RESUMABLE BYTE PROTOCOL over the object store behaves byte-for-byte as the file store,
 *     driven through the real /api/storage/upload handler against ObjectStoreStorageIngestStore:
 *     per-block sha256 verify, cap refusal BEFORE write, resume via the stored-block bitfield, and
 *     restart-survival of usage accounting (a fresh store instance sees the same used bytes because
 *     usedBytes is derived from the object store's own durable inventory, not an in-memory counter).
 *
 * Local run:
 *   MEERKAT_TEST_S3_ENDPOINT=http://127.0.0.1:55490 MEERKAT_TEST_S3_ACCESS_KEY=meerkat \
 *   MEERKAT_TEST_S3_SECRET_KEY=meerkat-test-secret \
 *     pnpm --filter @mylife/meerkat-relay test:s3-hosted
 */

import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import http from 'node:http';
import {
  issueMeerkatHostedEntitlement,
  MEERKAT_HOSTED_RELAY_FEATURE,
} from '@mylife/entitlements/server';
import { S3ObjectStore } from '../object-store-s3';
import { ObjectStoreStorageIngestStore } from '../storage-ingest-store-object';
import { createStorageIngestHandler, type StorageIngestOptions } from '../storage-ingest';
import type { MeerkatHostedSubject } from '../hosted-api';

const endpoint = process.env.MEERKAT_TEST_S3_ENDPOINT?.trim();
const accessKeyId = process.env.MEERKAT_TEST_S3_ACCESS_KEY?.trim();
const secretAccessKey = process.env.MEERKAT_TEST_S3_SECRET_KEY?.trim();
const region = process.env.MEERKAT_TEST_S3_REGION?.trim() || 'us-east-1';
const ready = Boolean(endpoint && accessKeyId && secretAccessKey);
const describeS3 = ready ? describe.sequential : describe.skip;

const require = createRequire(import.meta.url);
const tsxCli = ready ? require.resolve('tsx/cli') : '';
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const hostedBin = path.join(packageRoot, 'bin/meerkat-hosted-service.mjs');

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const adminClient = ready
  ? new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! } })
  : undefined;
const createdBuckets: string[] = [];
const tempDirs: string[] = [];

async function makeBucket(): Promise<string> {
  const bucket = `mk-wp2d-${randomUUID().slice(0, 12)}`;
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

afterAll(async () => {
  if (adminClient) {
    await Promise.all(createdBuckets.splice(0).map((b) => emptyAndDeleteBucket(b).catch(() => undefined)));
  }
  await Promise.all(tempDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describeS3('hosted first-party byte path over live MinIO', () => {
  it('the REAL hosted bin composes an s3 byte path, reads FILE credentials, and never logs the secret', async () => {
    const bucket = await makeBucket();
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-hosted-s3-bin-'));
    tempDirs.push(dataDir);
    const secretDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-hosted-s3-secrets-'));
    tempDirs.push(secretDir);
    const accessKeyFile = path.join(secretDir, 'access-key');
    const secretKeyFile = path.join(secretDir, 'secret-key');
    await fs.writeFile(accessKeyFile, `${accessKeyId}\n`, 'utf8');
    await fs.writeFile(secretKeyFile, `${secretAccessKey}\n`, 'utf8');

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '0',
      HOST: '127.0.0.1',
      DATA_DIR: dataDir,
      MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
      MEERKAT_STORE_BACKEND: 'file',
      // Self-host explicitly opting into the s3 object-store backend (an operator self-hosting
      // against their own MinIO/S3). This exercises the identical byte-path composition the
      // first-party deploy uses, without the verify-full PostgreSQL TLS a first-party boot forces.
      MEERKAT_OBJECT_STORE_BACKEND: 's3',
      MEERKAT_OBJECT_STORE_ENDPOINT: endpoint,
      MEERKAT_OBJECT_STORE_REGION: region,
      MEERKAT_OBJECT_STORE_BUCKET: bucket,
      MEERKAT_OBJECT_STORE_ACCESS_KEY_FILE: accessKeyFile,
      MEERKAT_OBJECT_STORE_SECRET_KEY_FILE: secretKeyFile,
      MEERKAT_OBJECT_STORE_ALLOW_INSECURE_HTTP: 'true',
      ENTITLEMENT_SECRET: 'entitlement-secret-that-must-not-be-logged',
      WEBHOOK_SECRET: 'webhook-secret-that-must-not-be-logged',
      STRIPE_SECRET_KEY: 'sk_test_hosted_s3',
      STRIPE_MONTHLY_PRICE_ID: 'price_monthly_s3',
      STRIPE_APP_UNLOCK_PRICE_ID: 'price_unlock_s3',
      REVENUECAT_REST_API_KEY: 'revenuecat-secret-that-must-not-be-logged',
      MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
    };

    const child = spawn(process.execPath, [tsxCli, hostedBin], { cwd: packageRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const result = await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('hosted bin did not start/stop in time')); }, 20_000);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      let stopped = false;
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        if (!stopped && stdout.includes('"event":"ready"')) { stopped = true; child.kill('SIGTERM'); }
      });
      child.stderr.on('data', (chunk: string) => { stderr += chunk; });
      child.once('error', (error) => { clearTimeout(timeout); reject(error); });
      child.once('close', (status) => { clearTimeout(timeout); resolve({ status, stdout, stderr }); });
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const events = result.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(events).toContainEqual(expect.objectContaining({ event: 'ready', stateBackend: 'file', byteStorageBackend: 's3' }));
    expect(events).toContainEqual(expect.objectContaining({ event: 'shutdown', signal: 'SIGTERM' }));
    expect(result.stdout).not.toContain(secretAccessKey);
  }, 40_000);

  it('drives upload -> interrupt -> resume -> cap-refusal -> restart-survival through the real handler over live S3', async () => {
    const bucket = await makeBucket();
    const secret = 'hosted-s3-ingest-secret';
    const subject: MeerkatHostedSubject = { subjectId: 'subject-s3' };
    const prefix = 'tenants/subject-s3';
    // Blocks are single-shot puts (the ingest's per-request body guard defaults to 4 MB), so use a
    // modest block size. A cap just above two blocks means the third is refused BEFORE any write.
    const blockBytes = 64 * 1024;
    const capBytes = blockBytes * 2 + 1_024;

    const makeIngest = (): ObjectStoreStorageIngestStore => (
      new ObjectStoreStorageIngestStore({ store: s3Store(bucket), capBytes, keyPrefix: prefix })
    );
    const startHandler = async (ingest: ObjectStoreStorageIngestStore): Promise<{ url: string; close: () => Promise<void> }> => {
      const options: StorageIngestOptions = {
        entitlementSecret: secret,
        authorize: () => subject,
        resolveStore: () => ingest,
        hash: async (bytes) => sha256(bytes),
      };
      const server = http.createServer(createStorageIngestHandler(options));
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      return { url: `http://127.0.0.1:${port}/api/storage/upload`, close: () => new Promise<void>((r) => server.close(() => r())) };
    };
    const issued = await issueMeerkatHostedEntitlement({
      secret, features: [MEERKAT_HOSTED_RELAY_FEATURE, 'meerkat:hosted-storage'],
      issuedAt: '2026-07-10T00:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z',
    });
    const token = issued.token;
    const contentId = 'contentresumable';
    const totalBlocks = 3;
    const block = (fill: number): Uint8Array => { const b = new Uint8Array(blockBytes); b.fill(fill); return b; };
    const upload = async (url: string, index: number, bytes: Uint8Array): Promise<Response> => fetch(url, {
      method: 'POST',
      headers: {
        'x-mk-entitlement': token,
        'x-mk-content-id': contentId,
        'x-mk-block-index': String(index),
        'x-mk-total-blocks': String(totalBlocks),
        'x-mk-block-hash': sha256(bytes),
        'content-type': 'application/octet-stream',
      },
      body: bytes,
    });

    const first = await startHandler(makeIngest());
    try {
      // Upload block 0, then INTERRUPT (never send blocks 1-2 on this instance).
      const b0 = block(1);
      const r0 = await upload(first.url, 0, b0);
      expect(r0.status).toBe(200);
      const j0 = await r0.json() as { complete: boolean; stored: boolean[]; nextMissing: number | null };
      expect(j0.complete).toBe(false);
      expect(j0.stored).toEqual([true, false, false]);
      expect(j0.nextMissing).toBe(1);
    } finally {
      await first.close();
    }

    // RESTART: a fresh handler + fresh ingest store instance (new S3 store) must see block 0 as
    // already stored via the object store's DURABLE inventory (usage survives the restart).
    const second = await startHandler(makeIngest());
    try {
      // Resume: the client re-reads the bitfield and continues from block 1.
      const b1 = block(2);
      const r1 = await upload(second.url, 1, b1);
      expect(r1.status).toBe(200);
      const j1 = await r1.json() as { stored: boolean[]; nextMissing: number | null };
      expect(j1.stored).toEqual([true, true, false]);
      expect(j1.nextMissing).toBe(2);

      // Block 2 would exceed the cap: it must be refused with storage_cap BEFORE any write.
      const b2 = block(3);
      const r2 = await upload(second.url, 2, b2);
      expect(r2.status).toBe(413);
      const j2 = await r2.json() as { error: string; reason?: string };
      expect(j2.reason).toBe('storage_cap');
      // The refused block never landed on S3.
      const observed = await s3Store(bucket).observe(`${prefix}/${contentId}/2`);
      expect(observed).toBeNull();
    } finally {
      await second.close();
    }
  }, 60_000);
});
