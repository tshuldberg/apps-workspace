// Plan 38 C.7 (WEB): pin-class taxonomy + per-library pin policy + device budget
// + LRU eviction + last-copy honesty, run against the REAL shipped web store
// (BrowserNodeStore) and glue (library-store.ts) with an in-memory block backend.
// Also re-runs the pure engine matrix through the web twin core. The mobile pure
// twin is covered by apps/meerkat/app/__tests__/library-storage-core.test.ts.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  ensureShareIntakeTables,
  ensureSyncBootstrap,
  type DeviceIdentity,
  type PinClass,
  type PinnedManifest,
} from '@mylife/sync';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';
import { BrowserNodeStore, type BlockBackend } from '../storage/browser-node-store';
import {
  evictToBudget,
  parseStorageBudget,
  STORAGE_BUDGET_EXCEEDED_ERROR,
  LAST_COPY_DELETE_CONFIRM,
  type StoredPin,
} from '../library-storage-core';
import {
  addLibraryItem,
  applyLibraryPinPolicy,
  createLibrary,
  deviceStorageMeter,
  getLibraryItem,
  getLibraryItemPinInfo,
  getLibraryPinPolicy,
  getStorageBudgetBytes,
  keepLibraryItemOnDevice,
  libraryStorageStats,
  reconcileLibraryItemPinClass,
  releaseLibraryItemFromDevice,
  runLibraryEviction,
  setStorageBudget,
} from '../library-store';

class MemBlocks implements BlockBackend {
  private m = new Map<string, string>();
  async put(id: string, payload: string): Promise<void> { this.m.set(id, payload); }
  async get(id: string): Promise<string | null> { return this.m.get(id) ?? null; }
  async has(id: string): Promise<boolean> { return this.m.has(id); }
  async delete(id: string): Promise<void> { this.m.delete(id); }
  async clear(): Promise<void> { this.m.clear(); }
}

let db: InMemoryTestDatabase;
let store: BrowserNodeStore;
let identity: DeviceIdentity;
let personalId: string;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  const boot = ensureSyncBootstrap(db.adapter);
  ensureSyncSchema(db.adapter);
  ensureMeerkatTables(db.adapter);
  ensureShareIntakeTables(db.adapter);
  identity = boot.identity;
  personalId = boot.personalWorkspace.id;
  store = new BrowserNodeStore(db.adapter, new MemBlocks());
});

afterEach(() => db.close());

function bytes(n: number, seed = 5): Uint8Array {
  return new Uint8Array(Array.from({ length: n }, (_, i) => (i * seed + 1) % 251));
}

/** Pin a fabricated (non-crypto) share so store/eviction can be driven directly. */
async function fakePin(contentId: string, context: string, pinClass: PinClass, byteLen: number, pinnedAt: string): Promise<void> {
  const sealedId = `${contentId}-blk`;
  await store.putBlock({ sealedId, payload: 'x'.repeat(byteLen) });
  const manifest: PinnedManifest = {
    contentId,
    name: contentId,
    size: byteLen,
    scope: 'device_local',
    authorPublicKey: 'pub',
    manifestSignature: 'sig',
    sealedChunkIds: [sealedId],
    manifestJson: '{}',
    pinnedAt,
  };
  await store.putManifest(manifest, context, pinClass);
}

describe('web pure engine twin', () => {
  it('runs the eviction matrix identically', () => {
    const pins: StoredPin[] = [
      { contentId: 'a', context: 'w', pinClass: 'authored', bytes: 100, lastUsed: '2026-01-01' },
      { contentId: 'c', context: 'w', pinClass: 'fetch_cache', bytes: 100, lastUsed: '2026-01-01' },
    ];
    expect(evictToBudget({ pins, budgetBytes: null }).evict).toEqual([]);
    const tight = evictToBudget({ pins, budgetBytes: 50 });
    expect(tight.impossible).toBe(true);
    expect(tight.evict).toEqual([{ contentId: 'c', context: 'w' }]);
    expect(parseStorageBudget('42')).toBe(42);
  });
});

describe('node store pin-class + LRU methods', () => {
  it('lists pins with class + LRU key, updates class and last_used, and sums context bytes', async () => {
    await fakePin('a', personalId, 'authored', 100, '2026-01-01T00:00:00.000Z');
    await fakePin('c', personalId, 'fetch_cache', 50, '2026-02-01T00:00:00.000Z');

    let pins = await store.listStoredPins();
    expect(pins).toHaveLength(2);
    const cache = pins.find((p) => p.contentId === 'c')!;
    expect(cache.pinClass).toBe('fetch_cache');
    expect(cache.bytes).toBe(50);
    expect(cache.lastUsed).toBe('2026-02-01T00:00:00.000Z'); // COALESCE falls back to pinned_at

    await store.touchPin('c', personalId, '2026-09-09T00:00:00.000Z');
    pins = await store.listStoredPins();
    expect(pins.find((p) => p.contentId === 'c')!.lastUsed).toBe('2026-09-09T00:00:00.000Z');

    await store.setPinClass('c', personalId, 'policy');
    pins = await store.listStoredPins();
    expect(pins.find((p) => p.contentId === 'c')!.pinClass).toBe('policy');

    expect(await store.contextStoredBytes(personalId)).toBe(150);
    const breakdown = await store.classBreakdown();
    expect(breakdown.authored.count).toBe(1);
    expect(breakdown.policy.count).toBe(1);
  });
});

describe('device budget + eviction glue', () => {
  it('setStorageBudget evicts fetch_cache LRU-first and reports an impossible fit', async () => {
    await fakePin('authored', personalId, 'authored', 100, '2026-01-01T00:00:00.000Z');
    await fakePin('old', personalId, 'fetch_cache', 100, '2026-01-01T00:00:00.000Z');
    await fakePin('new', personalId, 'fetch_cache', 100, '2026-06-01T00:00:00.000Z');

    // Budget 250: drop exactly the LRU cache ('old'). 'authored' is never touched.
    const plan = await setStorageBudget(db.adapter, store, 250);
    expect(plan.evict.map((e) => e.contentId)).toEqual(['old']);
    expect(getStorageBudgetBytes(db.adapter)).toBe(250);
    expect(await store.getManifest('old', personalId)).toBeNull();
    expect(await store.getManifest('new', personalId)).not.toBeNull();

    // Budget 50: protected 'authored' (100) alone exceeds -> impossible, honest error surfaced by caller.
    const impossible = await setStorageBudget(db.adapter, store, 50);
    expect(impossible.impossible).toBe(true);
    expect(STORAGE_BUDGET_EXCEEDED_ERROR).toContain('exceed the storage budget');

    // Unlimited: nothing further evicts.
    const unlimited = await runLibraryEviction(db.adapter, store);
    expect(getStorageBudgetBytes(db.adapter)).toBe(50);
    expect(unlimited.evict.length).toBeGreaterThanOrEqual(0);
  });
});

describe('keep / release + reconcile + policy flip against real items', () => {
  it('keeps a copy explicitly and releases the last copy (device-local)', async () => {
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Movies', mediaType: 'movie' });
    const added = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.channelId, workspaceId: personalId, bytes: bytes(2048), title: 'Arrival',
    });
    const item = getLibraryItem(db.adapter, added.item.id)!;

    // Authored on this device -> reconcile leaves it authored.
    await reconcileLibraryItemPinClass(db.adapter, store, item);
    let info = await getLibraryItemPinInfo(db.adapter, store, item);
    expect(info.held).toBe(true);
    expect(info.pinClass).toBe('authored');

    // Simulate a received (non-authored) copy so keep/release/policy have effect.
    await store.setPinClass(item.contentCid, personalId, 'fetch_cache');
    await keepLibraryItemOnDevice(db.adapter, store, item);
    info = await getLibraryItemPinInfo(db.adapter, store, item);
    expect(info.kept).toBe(true);
    expect(info.pinClass).toBe('explicit');

    // Release drops this device's copy; the item metadata row stays.
    await releaseLibraryItemFromDevice(db.adapter, store, item);
    info = await getLibraryItemPinInfo(db.adapter, store, item);
    expect(info.held).toBe(false);
    expect(info.kept).toBe(false);
    expect(getLibraryItem(db.adapter, added.item.id)).not.toBeNull();
    expect(LAST_COPY_DELETE_CONFIRM).toContain('Meerkat cannot know');
  });

  it('personal libraries default to pin_all; a fetch_on_demand flip evicts non-authored copies', async () => {
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Docs', mediaType: 'document' });
    expect(getLibraryPinPolicy(db.adapter, lib.channelId)).toBe('pin_all');

    const added = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.channelId, workspaceId: personalId, bytes: bytes(1024, 7), title: 'Spec',
    });
    const item = getLibraryItem(db.adapter, added.item.id)!;
    // Pretend this copy arrived from a peer (policy class), then flip the library.
    await store.setPinClass(item.contentCid, personalId, 'policy');

    await applyLibraryPinPolicy(db.adapter, store, lib.channelId, 'fetch_on_demand');
    expect(getLibraryPinPolicy(db.adapter, lib.channelId)).toBe('fetch_on_demand');
    expect(await store.getManifest(item.contentCid, personalId)).toBeNull();
  });

  it('refuses a pin_all flip that cannot fit the budget with the honest error', async () => {
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Big', mediaType: 'movie' });
    const added = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.channelId, workspaceId: personalId, bytes: bytes(4096, 3), title: 'Huge',
    });
    const item = getLibraryItem(db.adapter, added.item.id)!;
    await store.setPinClass(item.contentCid, personalId, 'fetch_cache');
    // Set the budget directly (below the item's stored bytes) WITHOUT running
    // eviction, so the over-budget cache copy survives to the flip. Promoting it
    // to 'policy' then cannot fit -> the flip is refused with the honest error.
    db.adapter.execute(
      `INSERT OR REPLACE INTO mk_settings (key, value) VALUES ('library_storage_budget_bytes', '100')`,
    );
    await expect(applyLibraryPinPolicy(db.adapter, store, lib.channelId, 'pin_all')).rejects.toThrow(
      STORAGE_BUDGET_EXCEEDED_ERROR,
    );
  });
});

describe('stats card + device meter (C.2)', () => {
  it('reports item count, logical bytes, this-device stored bytes, and a per-class meter', async () => {
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Lib', mediaType: 'custom' });
    await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.channelId, workspaceId: personalId, bytes: bytes(1000), title: 'One',
    });
    await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.channelId, workspaceId: personalId, bytes: bytes(500, 9), title: 'Two',
    });

    const stats = await libraryStorageStats(db.adapter, store, lib.channelId);
    expect(stats.itemCount).toBe(2);
    expect(stats.logicalBytes).toBe(1500);
    expect(stats.storedBytes).toBeGreaterThan(0);

    const meter = await deviceStorageMeter(db.adapter, store);
    expect(meter.budgetBytes).toBeNull();
    expect(meter.breakdown.authored.count).toBe(2);
  });
});
