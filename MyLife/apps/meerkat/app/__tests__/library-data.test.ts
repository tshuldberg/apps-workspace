// Plan 38 Phase 3: the library substrate data layer, PERSONAL-FIRST.
//
// Every case here runs against the auto-created personal workspace with ZERO
// communities (amendment B.5), except the two that specifically exercise the
// community path (cross-workspace dedup guard, no-epoch honest failure). Asserts:
// the personal end-to-end (create library, add item, list verified, open content
// back, progress round trip); within-workspace dedup + NEVER cross-workspace;
// forged item/library rows excluded from reads; tombstone + refcounted unpin;
// the promote + share-intake ingestion paths; and the honest no-epoch failure.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  InMemoryNodeStore,
  configureSyncSecretStore,
  createCommunity,
  createInMemorySyncSecretStore,
  ensureShareIntakeTables,
  ensureSyncBootstrap,
  generateDeviceIdentity,
  stageShareIntake,
  type DeviceIdentity,
} from '@mylife/sync';
import { ensureCommunityTables, storeOwnedCommunity } from '../(root)/data/community-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import {
  createLibraryConfigEvent,
  createLibraryItemEvent,
  libraryConfigEventToRow,
  libraryItemEventToRow,
} from '../(root)/data/library-data-core';
import {
  addLibraryItem,
  createLibrary,
  getLibraryProgress,
  ingestFromShareIntake,
  listLibraries,
  listLibraryItems,
  openLibraryItemContent,
  promoteChannelFile,
  setLibraryProgress,
  tombstoneLibraryItem,
} from '../(root)/data/library-store-core';

let db: InMemoryTestDatabase;
let identity: DeviceIdentity;
let personalId: string;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  const boot = ensureSyncBootstrap(db.adapter);
  ensureMeerkatTables(db.adapter);
  ensureCommunityTables(db.adapter);
  ensureShareIntakeTables(db.adapter);
  identity = boot.identity;
  personalId = boot.personalWorkspace.id;
});

afterEach(() => db.close());

function bytesOf(length: number, seed = 7): Uint8Array {
  return new Uint8Array(Array.from({ length }, (_, i) => (i * seed + 3) % 251));
}

describe('personal library end-to-end', () => {
  it('creates a library, adds an item, lists it verified, opens content back, and rounds a progress trip', async () => {
    const store = new InMemoryNodeStore();
    const lib = createLibrary(db.adapter, identity, {
      workspaceId: personalId, name: 'Movies', mediaType: 'movie',
    });
    expect(listLibraries(db.adapter, personalId).map((l) => l.id)).toEqual([lib.id]);

    const bytes = bytesOf(2048);
    const { item, deduped } = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.id, workspaceId: personalId, bytes, title: 'Arrival',
      mimeType: 'video/mp4', metadata: { genres: ['sci-fi'] },
    });
    expect(deduped).toBe(false);

    const listed = listLibraryItems(db.adapter, lib.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.event.id).toBe(item.id);
    expect(listed[0]!.mediaType).toBe('movie');
    expect(listed[0]!.metadataUnknownType).toBe(false);

    const opened = await openLibraryItemContent(db.adapter, store, identity, item);
    expect(opened).not.toBeNull();
    expect(Array.from(opened!)).toEqual(Array.from(bytes));

    expect(getLibraryProgress(db.adapter, item.id)).toBeNull();
    setLibraryProgress(db.adapter, item.id, { positionMs: 4200, completed: false, communityId: personalId });
    expect(getLibraryProgress(db.adapter, item.id)).toEqual({ positionMs: 4200, completed: false, updatedAt: expect.any(String) });
  });

  it('adds an item with an unknown metadata type through the fail-safe marker', async () => {
    const store = new InMemoryNodeStore();
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Custom', mediaType: 'custom' });
    const { item } = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.id, workspaceId: personalId, bytes: bytesOf(512), title: 'Blob', metadata: { anything: true },
    });
    const listed = listLibraryItems(db.adapter, lib.id);
    expect(listed.map((r) => r.event.id)).toContain(item.id);
  });
});

describe('within-workspace dedup, never cross-workspace', () => {
  it('reuses the sealed blob for the same content in the same workspace', async () => {
    const store = new InMemoryNodeStore();
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'M', mediaType: 'movie' });
    const bytes = bytesOf(3000, 11);
    const first = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.id, workspaceId: personalId, bytes, title: 'One',
    });
    const before = await store.stats();
    const second = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.id, workspaceId: personalId, bytes, title: 'Two',
    });
    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.item.contentCid).toBe(first.item.contentCid);
    // No new physical blocks pinned for the dedup.
    expect((await store.stats()).blockCount).toBe(before.blockCount);
    // Both items still open to the same bytes.
    const openedSecond = await openLibraryItemContent(db.adapter, store, identity, second.item);
    expect(Array.from(openedSecond!)).toEqual(Array.from(bytes));
  });

  it('does NOT dedup the same bytes across two different workspaces', async () => {
    const store = new InMemoryNodeStore();
    const community = createCommunity(identity, {
      name: 'Club', channels: [{ id: 'general', name: 'general' }], now: '2026-07-05T00:00:00.000Z',
    });
    storeOwnedCommunity(db.adapter, identity, community);
    const communityId = community.descriptor.communityId;

    const personalLib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'P', mediaType: 'document' });
    const communityLib = createLibrary(db.adapter, identity, { workspaceId: communityId, name: 'C', mediaType: 'document' });

    const bytes = bytesOf(1500, 5);
    const inPersonal = await addLibraryItem(db.adapter, store, identity, {
      channelId: personalLib.id, workspaceId: personalId, bytes, title: 'Same',
    });
    const inCommunity = await addLibraryItem(db.adapter, store, identity, {
      channelId: communityLib.id, workspaceId: communityId, bytes, title: 'Same',
    });
    // Same plaintext content id, but neither deduped the other (separate contexts).
    expect(inPersonal.deduped).toBe(false);
    expect(inCommunity.deduped).toBe(false);
    // Each opens in its own workspace context.
    expect(Array.from((await openLibraryItemContent(db.adapter, store, identity, inPersonal.item))!)).toEqual(Array.from(bytes));
    expect(Array.from((await openLibraryItemContent(db.adapter, store, identity, inCommunity.item))!)).toEqual(Array.from(bytes));
  });
});

describe('forged rows are excluded from reads', () => {
  it('drops an item signed by a non-member author', async () => {
    const store = new InMemoryNodeStore();
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'M', mediaType: 'movie' });
    const real = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.id, workspaceId: personalId, bytes: bytesOf(800), title: 'Real',
    });
    const stranger = generateDeviceIdentity('Stranger');
    const forged = createLibraryItemEvent(stranger, {
      communityId: personalId, channelId: lib.id, contentCid: real.item.contentCid,
      keyEpoch: real.item.keyEpoch, wrappedKey: real.item.wrappedKey, manifestJson: real.item.manifestJson,
      title: 'Forged', metadataJson: '{}', metadataSource: 'local',
    });
    const row = libraryItemEventToRow(forged);
    const cols = Object.keys(row);
    db.adapter.execute(
      `INSERT OR REPLACE INTO cm_library_items (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map((c) => row[c]),
    );
    const listedIds = listLibraryItems(db.adapter, lib.id).map((r) => r.event.id);
    expect(listedIds).toContain(real.item.id);
    expect(listedIds).not.toContain(forged.id);
  });

  it('drops a library config signed by a non-owner of the workspace', () => {
    const stranger = generateDeviceIdentity('Stranger');
    const forgedConfig = createLibraryConfigEvent(stranger, {
      id: 'lib_forged', communityId: personalId, channelId: 'lib_forged',
      mediaType: 'movie', sortDefault: 'title',
    });
    const row = libraryConfigEventToRow(forgedConfig);
    const cols = Object.keys(row);
    db.adapter.execute(
      `INSERT OR REPLACE INTO cm_libraries (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map((c) => row[c]),
    );
    expect(listLibraries(db.adapter, personalId)).toHaveLength(0);
  });
});

describe('tombstone + refcounted unpin', () => {
  it('unpins a solo item content on tombstone, but keeps dedup-shared content until the last referrer', async () => {
    const store = new InMemoryNodeStore();
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'M', mediaType: 'movie' });
    const bytes = bytesOf(2200, 13);
    const a = await addLibraryItem(db.adapter, store, identity, { channelId: lib.id, workspaceId: personalId, bytes, title: 'A' });
    const b = await addLibraryItem(db.adapter, store, identity, { channelId: lib.id, workspaceId: personalId, bytes, title: 'B' });
    expect(b.deduped).toBe(true);

    // Tombstone A: content is still referenced by B, so it stays pinned.
    await tombstoneLibraryItem(db.adapter, store, identity, a.item.id);
    expect(await store.getManifest(a.item.contentCid, personalId)).not.toBeNull();
    expect(listLibraryItems(db.adapter, lib.id).map((r) => r.event.id)).toEqual([b.item.id]);

    // Tombstone B: last referrer gone -> content unpinned.
    await tombstoneLibraryItem(db.adapter, store, identity, b.item.id);
    expect(await store.getManifest(b.item.contentCid, personalId)).toBeNull();
    expect(listLibraryItems(db.adapter, lib.id)).toHaveLength(0);
  });
});

describe('ingestion adapters', () => {
  it('promotes a plaintext attachment blob into a sealed library item', async () => {
    const store = new InMemoryNodeStore();
    const blobs = new Map<string, Uint8Array>();
    const bytes = bytesOf(1800, 17);
    blobs.set('blobhashA', bytes);
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Docs', mediaType: 'document' });

    const { item } = await promoteChannelFile(
      db.adapter, store, identity,
      { blobHash: 'blobhashA', channelId: lib.id, workspaceId: personalId, title: 'Promoted', mimeType: 'application/pdf' },
      async (hash) => blobs.get(hash) ?? null,
    );
    const opened = await openLibraryItemContent(db.adapter, store, identity, item);
    expect(Array.from(opened!)).toEqual(Array.from(bytes));
  });

  it('ingests a staged OS share into a library and routes the intake', async () => {
    const store = new InMemoryNodeStore();
    const blobs = new Map<string, Uint8Array>();
    const bytes = bytesOf(900, 19);
    blobs.set('sharehash', bytes);
    stageShareIntake(db.adapter, {
      id: 'intake1', source: 'ios_share_extension', createdAt: '2026-07-05T00:00:00.000Z',
      expiresAt: '2026-07-12T00:00:00.000Z',
      payloads: [{ id: 'p1', kind: 'file', mime: 'image/jpeg', filename: 'pic.jpg', byteLength: bytes.length, blobHash: 'sharehash' }],
    });
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Photos', mediaType: 'photo' });

    const { item } = await ingestFromShareIntake(
      db.adapter, store, identity,
      { intakeId: 'intake1', channelId: lib.id, workspaceId: personalId },
      async (hash) => blobs.get(hash) ?? null,
    );
    const opened = await openLibraryItemContent(db.adapter, store, identity, item);
    expect(Array.from(opened!)).toEqual(Array.from(bytes));
    const routed = db.adapter.query<{ status: string; dest_ref: string | null }>(
      'SELECT status, dest_ref FROM mk_share_intake WHERE id = ?', ['intake1'],
    );
    expect(routed[0]!.status).toBe('routed');
    expect(routed[0]!.dest_ref).toBe(lib.id);
  });
});

describe('honest failures', () => {
  it('throws an honest error when the workspace has no epoch key', async () => {
    const store = new InMemoryNodeStore();
    const community = createCommunity(identity, {
      name: 'NoKey', channels: [{ id: 'general', name: 'general' }], now: '2026-07-05T00:00:00.000Z',
    });
    storeOwnedCommunity(db.adapter, identity, community);
    const communityId = community.descriptor.communityId;
    const lib = createLibrary(db.adapter, identity, { workspaceId: communityId, name: 'X', mediaType: 'movie' });
    // Force a no-epoch state (a device that never received the community key).
    db.adapter.execute('UPDATE sync_workspaces SET current_key_version = 0 WHERE id = ?', [communityId]);
    await expect(
      addLibraryItem(db.adapter, store, identity, { channelId: lib.id, workspaceId: communityId, bytes: bytesOf(100), title: 'Z' }),
    ).rejects.toThrow(/no encryption key/i);
  });
});
