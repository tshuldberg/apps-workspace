import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  InMemoryNodeStore,
  configureSyncPrng,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createSealedShare,
  ensureMeerkatPinnedTables,
  fetchFromStore,
  generateDeviceIdentity,
  hasConfiguredSyncPrng,
  loadSealedShare,
  pinShare,
  unpinShare,
  type DeviceIdentity,
  type SealedShare,
} from '@mylife/sync';
import { createBrowserDatabaseAdapter } from '../browser-database-adapter';
import {
  BrowserNodeStore,
  createBlockBackend,
  isOpfsAvailable,
} from '../browser-node-store';
import { ensureMeerkatTables } from '../../schema';
import { nodeLocateFile, resetDurableLayer } from './helpers';

const locateFile = nodeLocateFile();

// Real crypto: configure the WebCrypto PRNG + an in-memory secret store so we can
// seal genuine shares and prove the @mylife/sync engine helpers drop in unchanged
// against BrowserNodeStore (the IndexedDB block backend, since OPFS is absent in
// Node).
function ensureCrypto(): void {
  if (!hasConfiguredSyncPrng()) {
    configureSyncPrng((n) => globalThis.crypto.getRandomValues(new Uint8Array(n)));
  }
  configureSyncSecretStore(createInMemorySyncSecretStore());
}

async function makeStore() {
  const db = await createBrowserDatabaseAdapter({ locateFile });
  ensureMeerkatTables(db);
  // OPFS is absent in Node, so createBlockBackend() returns the IndexedDB
  // fallback; assert that so the test documents which path it exercises.
  expect(isOpfsAvailable()).toBe(false);
  const store = new BrowserNodeStore(db, createBlockBackend());
  return { db, store };
}

function makeShare(identity: DeviceIdentity, name: string, body: string): {
  share: SealedShare;
  linkKey: Uint8Array;
} {
  // Tiny chunk size forces a 2-chunk manifest so stats/block counts are non-trivial.
  return createSealedShare(new TextEncoder().encode(body), {
    name,
    identity,
    chunkSize: 8,
  });
}

describe('BrowserNodeStore (NodeStore conformance)', () => {
  let identity: DeviceIdentity;

  beforeAll(() => {
    ensureCrypto();
    identity = generateDeviceIdentity('web-node');
  });

  beforeEach(async () => {
    await resetDurableLayer();
  });

  it('round-trips blocks: put/get/has/delete + null on missing', async () => {
    const { store } = await makeStore();
    await store.putBlock({ sealedId: 'a'.repeat(16), payload: 'nonce.cipher' });
    expect(await store.hasBlock('a'.repeat(16))).toBe(true);
    expect(await store.getBlock('a'.repeat(16))).toBe('nonce.cipher');
    expect(await store.getBlock('b'.repeat(16))).toBeNull();
    expect(await store.hasBlock('b'.repeat(16))).toBe(false);

    await store.deleteBlock('a'.repeat(16));
    expect(await store.hasBlock('a'.repeat(16))).toBe(false);
  });

  it('CRUDs manifests with pinned_at DESC ordering', async () => {
    const { store } = await makeStore();
    const first = makeShare(identity, 'first', 'the quick brown fox');
    const second = makeShare(identity, 'second', 'jumps over the lazy dog');

    const m1 = await pinShare(store, first.share);
    // Force a later pinnedAt so DESC ordering is deterministic.
    const m2record = { ...(await pinShare(store, second.share)) };
    m2record.pinnedAt = new Date(Date.now() + 1000).toISOString();
    await store.putManifest(m2record);

    expect(await store.getManifest(m1.contentId)).not.toBeNull();
    const list = await store.listManifests();
    expect(list[0]?.contentId).toBe(m2record.contentId);
    expect(list.map((m) => m.contentId).sort()).toEqual(
      [m1.contentId, m2record.contentId].sort(),
    );

    await store.deleteManifest(m1.contentId);
    expect(await store.getManifest(m1.contentId)).toBeNull();
  });

  it('reports stats matching InMemoryNodeStore for the same pinned share', async () => {
    const { store } = await makeStore();
    const memory = new InMemoryNodeStore();
    const { share } = makeShare(identity, 'doc', 'a longer body that spans several chunks');

    await pinShare(store, share);
    await pinShare(memory, share);

    const browserStats = await store.stats();
    const memoryStats = await memory.stats();
    expect(browserStats.blockCount).toBe(memoryStats.blockCount);
    expect(browserStats.manifestCount).toBe(memoryStats.manifestCount);
    // Both sum payload string lengths, so totals are identical.
    expect(browserStats.totalBytes).toBe(memoryStats.totalBytes);
    expect(browserStats.manifestCount).toBe(1);
    expect(browserStats.blockCount).toBeGreaterThan(1);
  });

  it('coexists across two contexts and refcounts blocks on unpin (Plan 38 D.4)', async () => {
    const { store } = await makeStore();
    const { share, linkKey } = makeShare(identity, 'obj', 'a longer body that spans several chunks');
    const chunkIds = share.sealedChunks.map((c) => c.sealedId);
    expect(chunkIds.length).toBeGreaterThan(1);

    await pinShare(store, share, 'default');
    await pinShare(store, share, 'ws-b');

    expect(await store.getManifest(share.manifest.contentId, 'default')).not.toBeNull();
    expect(await store.getManifest(share.manifest.contentId, 'ws-b')).not.toBeNull();
    for (const id of chunkIds) expect(await store.blockRefCount(id)).toBe(2);
    const two = await store.stats();
    expect(two.manifestCount).toBe(2);
    expect(two.blockCount).toBe(chunkIds.length); // physical blocks, deduped

    // Unpin one context: the other manifest + blocks survive.
    await unpinShare(store, share.manifest.contentId, 'default');
    expect(await store.getManifest(share.manifest.contentId, 'default')).toBeNull();
    expect(await store.getManifest(share.manifest.contentId, 'ws-b')).not.toBeNull();
    for (const id of chunkIds) {
      expect(await store.blockRefCount(id)).toBe(1);
      expect(await store.hasBlock(id)).toBe(true);
    }
    const opened = await fetchFromStore(store, share.manifest.contentId, linkKey, undefined, 'ws-b');
    expect(opened.ok).toBe(true);

    // Unpin the last context: blocks are freed.
    await unpinShare(store, share.manifest.contentId, 'ws-b');
    for (const id of chunkIds) {
      expect(await store.blockRefCount(id)).toBe(0);
      expect(await store.hasBlock(id)).toBe(false);
    }
    const none = await store.stats();
    expect(none.manifestCount).toBe(0);
    expect(none.blockCount).toBe(0);
  });

  it('migrates a pre-pin_context mk_pinned in place, preserving rows (Plan 38 D.4)', async () => {
    const db = await createBrowserDatabaseAdapter({ locateFile });
    // Simulate an upgraded install: the OLD content_id-PK mk_pinned with a row.
    db.execute(`
      CREATE TABLE mk_pinned (
        content_id TEXT PRIMARY KEY,
        name TEXT NOT NULL, size INTEGER NOT NULL, scope TEXT NOT NULL,
        author_public_key TEXT NOT NULL, manifest_signature TEXT NOT NULL,
        sealed_chunk_ids TEXT NOT NULL, manifest_json TEXT NOT NULL,
        total_bytes INTEGER NOT NULL DEFAULT 0, pinned_at TEXT NOT NULL
      )`);
    db.execute(
      `INSERT INTO mk_pinned
         (content_id, name, size, scope, author_public_key, manifest_signature,
          sealed_chunk_ids, manifest_json, total_bytes, pinned_at)
       VALUES ('cid-1', 'doc', 3, 'device_local', 'pub', 'sig', '["blk-a","blk-b"]', '{}', 30, '2026-07-01T00:00:00.000Z')`,
    );

    ensureMeerkatPinnedTables(db);
    // Idempotent second pass.
    ensureMeerkatPinnedTables(db);

    const rows = db.query<{ content_id: string; pin_context: string; pin_class: string }>(
      `SELECT content_id, pin_context, pin_class FROM mk_pinned`,
    );
    expect(rows).toEqual([{ content_id: 'cid-1', pin_context: 'default', pin_class: 'explicit' }]);
    expect(db.query<{ c: number }>(`SELECT COUNT(*) AS c FROM mk_pinned_blocks`)[0]!.c).toBe(2);
  });

  it('lets @mylife/sync engine helpers (pinShare/loadSealedShare/fetchFromStore) drop in unchanged', async () => {
    const { store } = await makeStore();
    const { share, linkKey } = makeShare(identity, 'roundtrip', 'decrypt me end to end');

    await pinShare(store, share);

    const reloaded = await loadSealedShare(store, share.manifest.contentId);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.manifest.contentId).toBe(share.manifest.contentId);

    const opened = await fetchFromStore(store, share.manifest.contentId, linkKey, {
      expectedAuthor: identity.publicKey,
    });
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(new TextDecoder().decode(opened.content)).toBe('decrypt me end to end');
    }
  });
});
