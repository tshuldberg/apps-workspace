/**
 * WP-2D composition unit tests: the typed object-store runtime-config block fails closed in
 * first-party mode, the S3 store is built from mounted-secret FILES (never plain env), and the
 * object-store-backed ingest store honors the resumable byte boundary against the memory adapter
 * (proving the composition without any live S3). Self-host file mode is unaffected: its
 * object-store backend is `file` and no S3 store is constructed.
 */

import http from 'node:http';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  issueMeerkatHostedEntitlement,
  MEERKAT_HOSTED_RELAY_FEATURE,
} from '@mylife/entitlements/server';
import { resolveMeerkatStoreRuntimeConfig } from '../postgres/runtime-config';
import { createHostedObjectStore, createS3ObjectStoreFromRuntimeConfig } from '../object-store-config';
import { InMemoryObjectStore } from '../object-store-memory';
import { ObjectStoreStorageIngestStore } from '../storage-ingest-store-object';
import { HostedObjectStoreAdapter } from '../object-store-hosted-adapter';
import { createStorageIngestHandler, type StorageIngestOptions } from '../storage-ingest';
import type { MeerkatHostedSubject } from '../hosted-api';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('object-store runtime-config block', () => {
  const s3Env = {
    MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
    MEERKAT_STORE_BACKEND: 'postgres',
    MEERKAT_POSTGRES_URL: 'postgresql://hosted:pw@db.example.test/meerkat',
    MEERKAT_POSTGRES_SSL_MODE: 'verify-full',
    MEERKAT_POSTGRES_SSL_CA_FILE: '/run/secrets/postgres-ca.pem',
    MEERKAT_OBJECT_STORE_BACKEND: 's3',
    MEERKAT_OBJECT_STORE_ENDPOINT: 'https://s3.example.test',
    MEERKAT_OBJECT_STORE_REGION: 'us-east-1',
    MEERKAT_OBJECT_STORE_BUCKET: 'meerkat-hosted',
    MEERKAT_OBJECT_STORE_ACCESS_KEY_FILE: '/run/secrets/object-store-access-key',
    MEERKAT_OBJECT_STORE_SECRET_KEY_FILE: '/run/secrets/object-store-secret-key',
  } as const;

  const resolve = (env: Record<string, string | undefined>): ReturnType<typeof resolveMeerkatStoreRuntimeConfig> =>
    resolveMeerkatStoreRuntimeConfig({ service: 'hosted', env, requireObjectStore: true });

  it('omits the object-store block entirely when the caller does not require it', () => {
    // Services with no byte path (persona, verification, ...) never pass requireObjectStore, so
    // their config is unchanged and carries no objectStore field even if the env happens to set it.
    const config = resolveMeerkatStoreRuntimeConfig({
      service: 'persona',
      env: { MEERKAT_DEPLOYMENT_PROFILE: 'self-host', MEERKAT_STORE_BACKEND: 'file', DATA_DIR: '/tmp/persona' },
    });
    expect(config.objectStore).toBeUndefined();
  });

  it('defaults to the file object-store backend for self-host and requires no s3 vars', () => {
    const config = resolveMeerkatStoreRuntimeConfig({
      service: 'hosted',
      env: { MEERKAT_DEPLOYMENT_PROFILE: 'self-host', MEERKAT_STORE_BACKEND: 'file', DATA_DIR: '/tmp/hosted' },
      requireObjectStore: true,
    });
    expect(config.objectStore).toEqual({ backend: 'file' });
  });

  it('fails closed in first-party mode naming each missing object-store var in turn', () => {
    const drop = (key: keyof typeof s3Env): Record<string, string | undefined> => {
      const env: Record<string, string | undefined> = { ...s3Env };
      delete env[key];
      return env;
    };
    expect(() => resolve(drop('MEERKAT_OBJECT_STORE_ENDPOINT'))).toThrow('MEERKAT_OBJECT_STORE_ENDPOINT is required');
    expect(() => resolve(drop('MEERKAT_OBJECT_STORE_REGION'))).toThrow('MEERKAT_OBJECT_STORE_REGION is required');
    expect(() => resolve(drop('MEERKAT_OBJECT_STORE_BUCKET'))).toThrow('MEERKAT_OBJECT_STORE_BUCKET is required');
    expect(() => resolve(drop('MEERKAT_OBJECT_STORE_ACCESS_KEY_FILE'))).toThrow('MEERKAT_OBJECT_STORE_ACCESS_KEY_FILE is required');
    expect(() => resolve(drop('MEERKAT_OBJECT_STORE_SECRET_KEY_FILE'))).toThrow('MEERKAT_OBJECT_STORE_SECRET_KEY_FILE is required');
  });

  it('refuses first-party mode with the file object-store backend', () => {
    expect(() => resolve({ ...s3Env, MEERKAT_OBJECT_STORE_BACKEND: 'file' }))
      .toThrow('First-party Meerkat services require the s3 object-store backend');
  });

  it('resolves a complete s3 config carrying only FILE paths, never plain-env credentials', () => {
    const config = resolve(s3Env);
    expect(config.objectStore).toEqual({
      backend: 's3',
      s3: {
        endpoint: 'https://s3.example.test',
        region: 'us-east-1',
        bucket: 'meerkat-hosted',
        accessKeyIdFile: '/run/secrets/object-store-access-key',
        secretAccessKeyFile: '/run/secrets/object-store-secret-key',
        forcePathStyle: true,
        allowInsecureHttp: false,
      },
    });
  });

  it('refuses a production http endpoint without the explicit insecure opt-in', () => {
    expect(() => resolve({ ...s3Env, MEERKAT_OBJECT_STORE_ENDPOINT: 'http://s3.internal.test' }))
      .toThrow('require https://');
    const opted = resolve({
      ...s3Env,
      MEERKAT_OBJECT_STORE_ENDPOINT: 'http://s3.internal.test',
      MEERKAT_OBJECT_STORE_ALLOW_INSECURE_HTTP: 'true',
    });
    expect(opted.objectStore?.s3?.allowInsecureHttp).toBe(true);
  });
});

describe('createS3ObjectStoreFromRuntimeConfig reads credentials from secret files', () => {
  it('reads both credential files and fails closed on an empty secret file', async () => {
    const files: Record<string, string> = {
      '/run/secrets/object-store-access-key': 'AKIAEXAMPLE\n',
      '/run/secrets/object-store-secret-key': 'super-secret-value\n',
    };
    const readTextFile = async (p: string): Promise<string> => {
      if (!(p in files)) throw new Error(`ENOENT ${p}`);
      return files[p]!;
    };
    const config = {
      backend: 's3' as const,
      s3: {
        endpoint: 'https://s3.example.test',
        region: 'us-east-1',
        bucket: 'meerkat-hosted',
        accessKeyIdFile: '/run/secrets/object-store-access-key',
        secretAccessKeyFile: '/run/secrets/object-store-secret-key',
        forcePathStyle: true,
        allowInsecureHttp: false,
      },
    };
    // A successful build proves both files are read and trimmed; the S3 client construction
    // validates the endpoint/region/bucket at the boundary.
    const store = await createS3ObjectStoreFromRuntimeConfig(config, { productionMode: true, readTextFile });
    expect(store).toBeDefined();
    store.destroy();

    // An empty secret file fails closed rather than building an empty credential.
    files['/run/secrets/object-store-secret-key'] = '   \n';
    await expect(createS3ObjectStoreFromRuntimeConfig(config, { productionMode: true, readTextFile }))
      .rejects.toThrow('secret access key secret file is empty');
  });
});

describe('ObjectStoreStorageIngestStore over the memory adapter', () => {
  it('lands blocks, reports presence, and accounts used bytes against the cap', async () => {
    const store = new InMemoryObjectStore();
    const ingest = new ObjectStoreStorageIngestStore({ store, capBytes: 1_000, keyPrefix: 'tenants/subject-a' });

    expect(await ingest.usedBytes()).toBe(0);
    expect(await ingest.hasBlock('content-x', 0)).toBe(false);

    const block0 = new Uint8Array(Buffer.from('first block bytes', 'utf8'));
    await ingest.putBlock('content-x', 0, block0);
    expect(await ingest.hasBlock('content-x', 0)).toBe(true);
    expect(await ingest.getBlock('content-x', 0)).toEqual(block0);
    expect(await ingest.usedBytes()).toBe(block0.length);

    const block1 = new Uint8Array(Buffer.from('second block bytes', 'utf8'));
    await ingest.putBlock('content-x', 1, block1);
    const bitfield = await ingest.storedBitfield('content-x', 3);
    expect(bitfield).toEqual([true, true, false]);
    expect(await ingest.usedBytes()).toBe(block0.length + block1.length);

    // A second tenant sharing the same object store never sees the first tenant's bytes or usage.
    const other = new ObjectStoreStorageIngestStore({ store, capBytes: 1_000, keyPrefix: 'tenants/subject-b' });
    expect(await other.usedBytes()).toBe(0);
    expect(await other.hasBlock('content-x', 0)).toBe(false);
  });

  it('deletes one object or the full tenant prefix and decrements durable usage', async () => {
    const store = new InMemoryObjectStore();
    const ingest = new ObjectStoreStorageIngestStore({
      store,
      capBytes: 1_000,
      keyPrefix: 'tenants/delete-subject',
    });
    const other = new ObjectStoreStorageIngestStore({
      store,
      capBytes: 1_000,
      keyPrefix: 'tenants/other-subject',
    });
    const first = new Uint8Array(Buffer.from('first'));
    const second = new Uint8Array(Buffer.from('second'));
    const retained = new Uint8Array(Buffer.from('retained'));
    await ingest.usedBytes();
    await other.usedBytes();
    await ingest.putBlock('content-a', 0, first);
    await ingest.putBlock('content-b', 0, second);
    await other.putBlock('content-a', 0, retained);

    expect(await ingest.deleteContent('content-a')).toEqual({
      deletedBlocks: 1,
      deletedBytes: first.length,
    });
    expect(await ingest.usedBytes()).toBe(second.length);
    expect(await ingest.getBlock('content-a', 0)).toBeNull();
    expect(await other.getBlock('content-a', 0)).toEqual(retained);
    await expect(ingest.deleteContent('../escape')).rejects.toThrow('Invalid hosted storage content id');

    expect(await ingest.deleteAll()).toEqual({
      deletedBlocks: 1,
      deletedBytes: second.length,
    });
    expect(await ingest.usedBytes()).toBe(0);
    expect(await other.usedBytes()).toBe(retained.length);
  });

  it('sweeps the tenant prefix ONCE then keeps usedBytes O(1) via an in-process counter', async () => {
    const store = new InMemoryObjectStore();
    // Populate a second tenant to prove the sweep is prefix-SCOPED (its bytes never leak in).
    const noise = new ObjectStoreStorageIngestStore({ store, capBytes: 1_000_000, keyPrefix: 'tenants/noise' });
    await noise.usedBytes();
    for (let i = 0; i < 5; i += 1) await noise.putBlock('nc', i, new Uint8Array(Buffer.from(`noise-${i}`, 'utf8')));

    let listCalls = 0;
    const original = store.listInventory.bind(store);
    store.listInventory = ((arg: Parameters<typeof original>[0]) => { listCalls += 1; return original(arg); }) as typeof store.listInventory;

    const ingest = new ObjectStoreStorageIngestStore({ store, capBytes: 1_000_000, keyPrefix: 'tenants/subject-a' });
    const a0 = new Uint8Array(Buffer.from('alpha', 'utf8'));
    const a1 = new Uint8Array(Buffer.from('bravo', 'utf8'));
    // First cap check sweeps once; the noise tenant's bytes are excluded by the prefix.
    expect(await Promise.all([
      ingest.usedBytes(), ingest.usedBytes(), ingest.usedBytes(),
    ])).toEqual([0, 0, 0]);
    expect(listCalls).toBe(1);
    await ingest.putBlock('c', 0, a0);
    await ingest.putBlock('c', 1, a1);
    // usedBytes reflects the two stored blocks with NO further listInventory calls (O(1) counter).
    expect(await ingest.usedBytes()).toBe(a0.length + a1.length);
    expect(await ingest.usedBytes()).toBe(a0.length + a1.length);
    expect(listCalls).toBe(1);
  });

  it('restart (fresh instance) re-sweeps the durable prefix and recovers the exact usage', async () => {
    const store = new InMemoryObjectStore();
    const first = new ObjectStoreStorageIngestStore({ store, capBytes: 1_000, keyPrefix: 'tenants/restart' });
    const b0 = new Uint8Array(Buffer.from('persist-0', 'utf8'));
    const b1 = new Uint8Array(Buffer.from('persist-1', 'utf8'));
    await first.usedBytes();
    await first.putBlock('c', 0, b0);
    await first.putBlock('c', 1, b1);
    const before = await first.usedBytes();

    // A fresh instance over the same durable store (a restart) recomputes the identical usage from
    // the object store's own inventory, so the counter never resets to a wrong value.
    const restarted = new ObjectStoreStorageIngestStore({ store, capBytes: 1_000, keyPrefix: 'tenants/restart' });
    expect(await restarted.usedBytes()).toBe(before);
    expect(before).toBe(b0.length + b1.length);
  });

  it('putBlock fails closed (throws) when the object store does not store the block', async () => {
    // A store that reports a checksum_mismatch (never a stored) must surface as a throw, so the
    // wire protocol's per-block verify stays fail-closed and never reports a phantom success.
    const rejectingStore = {
      put: async () => ({ status: 'checksum_mismatch' as const, object: {
        key: 'k', checksumSha256: '0'.repeat(64), sizeBytes: 0, versionId: 'v1', state: 'rejected' as const,
      } }),
      observe: async () => null,
      listInventory: async () => ({ entries: [], nextCursor: null }),
    } as unknown as InMemoryObjectStore;
    const ingest = new ObjectStoreStorageIngestStore({ store: rejectingStore, capBytes: 1_000, keyPrefix: 'tenants/reject' });
    await ingest.usedBytes();
    await expect(ingest.putBlock('c', 0, new Uint8Array(Buffer.from('x', 'utf8'))))
      .rejects.toThrow('did not store block');
    // The counter did not advance on the failed put.
    expect(await ingest.usedBytes()).toBe(0);
  });

  it('drives the full resumable ingest handler end-to-end against the memory adapter', async () => {
    const secret = 'ingest-composition-secret';
    const store = new InMemoryObjectStore();
    const ingest = new ObjectStoreStorageIngestStore({ store, capBytes: 10_000, keyPrefix: 'tenants/subject-c' });
    const subject: MeerkatHostedSubject = { subjectId: 'subject-c' };
    const options: StorageIngestOptions = {
      entitlementSecret: secret,
      authorize: () => subject,
      resolveStore: () => ingest,
      hash: async (bytes) => sha256(bytes),
    };
    const handler = createStorageIngestHandler(options);
    const server = http.createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const issued = await issueMeerkatHostedEntitlement({
      secret,
      features: [MEERKAT_HOSTED_RELAY_FEATURE, 'meerkat:hosted-storage'],
      issuedAt: '2026-07-10T00:00:00.000Z',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    const token = issued.token;
    try {
      const block = new Uint8Array(Buffer.from('resumable payload', 'utf8'));
      const response = await fetch(`http://127.0.0.1:${port}/api/storage/upload`, {
        method: 'POST',
        headers: {
          'x-mk-entitlement': token,
          'x-mk-content-id': 'contentzero',
          'x-mk-block-index': '0',
          'x-mk-total-blocks': '1',
          'x-mk-block-hash': sha256(block),
          'content-type': 'application/octet-stream',
        },
        body: block,
      });
      expect(response.status).toBe(200);
      const body = await response.json() as { complete: boolean; stored: boolean[]; usedBytes: number };
      expect(body.complete).toBe(true);
      expect(body.stored).toEqual([true]);
      expect(body.usedBytes).toBe(block.length);
      // The bytes are genuinely on the object store under the tenant prefix.
      const observed = await store.observe('tenants/subject-c/contentzero/0');
      expect(observed).toMatchObject({ checksumSha256: sha256(block), state: 'quarantined' });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

describe('createHostedObjectStore', () => {
  it('wraps a store as the three-method HostedStorageObjectStore projection', () => {
    const store = new InMemoryObjectStore();
    const adapter = new HostedObjectStoreAdapter(store, {
      createUploadTarget: async () => ({
        objectKey: 'k', method: 'PUT', url: 'https://example.invalid', headers: {},
        expiresAt: '2026-07-10T13:00:00.000Z', fencingToken: 1,
      }),
    });
    expect(typeof adapter.observeObject).toBe('function');
    expect(typeof adapter.deleteObject).toBe('function');
    expect(typeof adapter.createUploadTarget).toBe('function');
    expect(typeof createHostedObjectStore).toBe('function');
  });
});
