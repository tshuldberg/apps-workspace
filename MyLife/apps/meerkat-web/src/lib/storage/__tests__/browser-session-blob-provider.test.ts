import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  blobContentHash,
  configureSyncPrng,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  hasConfiguredSyncPrng,
} from '@mylife/sync';
import { createBrowserDatabaseAdapter } from '../browser-database-adapter';
import { BrowserBlobStore } from '../browser-blob-store';
import { ensureMeerkatTables, ensureSyncSchema } from '../../schema';
import { nodeLocateFile, resetDurableLayer } from './helpers';

const locateFile = nodeLocateFile();
const MODULE_ID = 'community';

// Real crypto: configure the WebCrypto PRNG + an in-memory secret store so the
// @mylife/sync blob helpers (blobContentHash, insertBlob/getBlob/deleteBlob) drop
// in unchanged against a real BrowserBlobStore over fake-indexeddb.
function ensureCrypto(): void {
  if (!hasConfiguredSyncPrng()) {
    configureSyncPrng((n) => globalThis.crypto.getRandomValues(new Uint8Array(n)));
  }
  configureSyncSecretStore(createInMemorySyncSecretStore());
}

async function makeStore() {
  const db = await createBrowserDatabaseAdapter({ locateFile });
  ensureMeerkatTables(db);
  ensureSyncSchema(db); // creates sync_blobs via createSyncTables
  const store = new BrowserBlobStore(db);
  return { db, store };
}

describe('BrowserBlobStore (SessionBlobProvider conformance)', () => {
  beforeAll(() => {
    ensureCrypto();
  });

  beforeEach(async () => {
    await resetDurableLayer();
  });

  it('round-trips raw bytes: putLocal -> get returns the exact bytes; has is true', async () => {
    const { store } = await makeStore();
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 7, 42]);
    const meta = await store.putLocal(bytes, { moduleId: MODULE_ID, mimeType: 'application/octet-stream' });

    expect(meta.hash).toBe(blobContentHash(bytes));
    expect(meta.size).toBe(bytes.length);
    expect(meta.moduleId).toBe(MODULE_ID);

    const got = await store.get(meta.hash);
    expect(got).not.toBeNull();
    expect(Array.from(got!)).toEqual(Array.from(bytes));
    expect(await store.has(meta.hash)).toBe(true);
  });

  it('returns null/false for an unknown hash', async () => {
    const { store } = await makeStore();
    const unknown = 'f'.repeat(128);
    expect(await store.get(unknown)).toBeNull();
    expect(await store.has(unknown)).toBe(false);
  });

  it('FAILS LOUD: put(hash, wrongBytes) where the content hash does not match throws', async () => {
    const { store } = await makeStore();
    const realBytes = new Uint8Array([1, 2, 3, 4]);
    const wrongBytes = new Uint8Array([9, 9, 9, 9]);
    const hash = blobContentHash(realBytes);
    expect(blobContentHash(wrongBytes)).not.toBe(hash);

    await expect(
      store.put(hash, wrongBytes, { moduleId: MODULE_ID, mimeType: null }),
    ).rejects.toThrow(/hash mismatch/i);

    // Nothing should have been written for the claimed hash.
    expect(await store.has(hash)).toBe(false);
  });

  it('removeLocal at refCount 1 frees the bytes; afterwards has=false and get=null', async () => {
    const { store } = await makeStore();
    const bytes = new Uint8Array([10, 20, 30, 40, 50]);
    const { hash } = await store.putLocal(bytes, { moduleId: MODULE_ID });

    const result = await store.removeLocal(hash);
    expect(result.freed).toBe(true);
    if (result.freed) {
      expect(result.remainingRefs).toBe(0);
    }
    expect(await store.has(hash)).toBe(false);
    expect(await store.get(hash)).toBeNull();
  });

  it('clearAll removes every raw plaintext blob byte in the browser store', async () => {
    const { store } = await makeStore();
    const first = await store.putLocal(new Uint8Array([1, 2, 3]), { moduleId: MODULE_ID });
    const second = await store.putLocal(new Uint8Array([4, 5, 6]), { moduleId: MODULE_ID });

    await store.clearAll();

    expect(await store.get(first.hash)).toBeNull();
    expect(await store.get(second.hash)).toBeNull();
    expect(await store.has(first.hash)).toBe(false);
    expect(await store.has(second.hash)).toBe(false);
  });

  it('previewDataUri returns a data: URI for an image mime and null otherwise', async () => {
    const { store } = await makeStore();
    const bytes = new TextEncoder().encode('hello blob');
    const { hash } = await store.putLocal(bytes, { moduleId: MODULE_ID, mimeType: 'image/png' });

    const uri = await store.previewDataUri(hash, 'image/png');
    expect(uri).not.toBeNull();
    const expectedB64 = Buffer.from(bytes).toString('base64');
    expect(uri).toBe(`data:image/png;base64,${expectedB64}`);

    expect(await store.previewDataUri('f'.repeat(128), 'image/png')).toBeNull();

    // Defense-in-depth clamp: a non-image (or scripty) mime never yields a data URI,
    // so a future non-<img> caller cannot obtain a data:text/html sink.
    expect(await store.previewDataUri(hash, 'text/plain')).toBeNull();
    expect(await store.previewDataUri(hash, 'text/html')).toBeNull();
    expect(await store.previewDataUri(hash, 'application/javascript')).toBeNull();
    // The mime-parameter tail is stripped; only the normalized type is honored.
    expect(await store.previewDataUri(hash, 'image/png; charset=utf-8')).toBe(
      `data:image/png;base64,${expectedB64}`,
    );
  });
});
