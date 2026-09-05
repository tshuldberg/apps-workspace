// Plan 38 Phase 5 (MOBILE): the hub browse glue against the REAL data layer.
// Exercises the personal-workspace resolution, per-library summaries, cross-
// library On Deck / Recently added, verified tag batching, the metadata edit
// (no reseal), and the held-on-device set -- all through createLibrary /
// addLibraryItem / setLibraryProgress, not fixtures.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  InMemoryNodeStore,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  ensureShareIntakeTables,
  ensureSyncBootstrap,
  generateDeviceIdentity,
  type DeviceIdentity,
} from '@mylife/sync';
import { ensureSyncSchema } from '../(root)/data/sync-core';
import { ensureCommunityTables } from '../(root)/data/community-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import {
  addLibraryItem,
  addLibraryItemTag,
  createLibrary,
  getLibraryItem,
  setLibraryProgress,
} from '../(root)/data/library-store-core';
import {
  canCurateLibrary,
  editLibraryItemMetadata,
  ensurePersonalWorkspace,
  getPersonalWorkspaceId,
  heldContentIds,
  libraryDisplayName,
  listAllWorkspaceItems,
  listLibrarySummaries,
  progressByItem,
  setPersonalLibraryName,
  verifiedTagsByItem,
} from '../(root)/data/library-hub-core';
import { buildOnDeck, buildRecentlyAdded } from '../(root)/data/library-view-core';

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

function bytes(n: number, seed = 5): Uint8Array {
  return new Uint8Array(Array.from({ length: n }, (_, i) => (i * seed + 1) % 251));
}

describe('personal workspace resolution', () => {
  it('finds the auto-created personal workspace for this device', () => {
    expect(getPersonalWorkspaceId(db.adapter, identity.publicKey)).toBe(personalId);
    expect(getPersonalWorkspaceId(db.adapter, 'someone-else')).toBeNull();
  });
});

// Regression for the mobile "New library is a silent no-op" defect: the Meerkat
// node boots its OWN identity via ensureSyncSchema and NEVER runs
// ensureSyncBootstrap, so no personal workspace exists until ensurePersonalWorkspace
// creates one. This block reproduces that real boot (schema only, no bootstrap
// workspace) -- the file's default harness masks the bug by bootstrapping one.
describe('ensurePersonalWorkspace (Meerkat-node boot, no ensureSyncBootstrap)', () => {
  it('creates the personal workspace + owner membership and is idempotent', () => {
    const fresh = createInMemoryTestDatabase();
    try {
      // The real Meerkat-node boot: sync schema + mk_/cm_ tables, but NO
      // ensureSyncBootstrap (so no personal workspace is auto-created).
      ensureSyncSchema(fresh.adapter);
      ensureMeerkatTables(fresh.adapter);
      ensureCommunityTables(fresh.adapter);
      const nodeIdentity = generateDeviceIdentity('MeerkatNode');
      // The real boot state: no personal workspace yet.
      expect(getPersonalWorkspaceId(fresh.adapter, nodeIdentity.publicKey)).toBeNull();

      const id = ensurePersonalWorkspace(fresh.adapter, nodeIdentity, '2026-08-24T00:00:00.000Z');
      expect(id).toBe(getPersonalWorkspaceId(fresh.adapter, nodeIdentity.publicKey));
      expect(id).not.toBeNull();

      // An owner membership row exists so the store's author-allowed predicate passes.
      const members = fresh.adapter.query<{ role: string; removed_at: string | null }>(
        'SELECT role, removed_at FROM sync_workspace_members WHERE workspace_id = ? AND device_id = ?',
        [id, nodeIdentity.publicKey],
      );
      expect(members).toEqual([{ role: 'owner', removed_at: null }]);

      // Idempotent: a second call returns the same id and does not duplicate rows.
      expect(ensurePersonalWorkspace(fresh.adapter, nodeIdentity, '2026-08-25T00:00:00.000Z')).toBe(id);
      const count = fresh.adapter.query<{ n: number }>(
        "SELECT COUNT(*) AS n FROM sync_workspaces WHERE workspace_type = 'personal' AND created_by_device_id = ?",
        [nodeIdentity.publicKey],
      );
      expect(count[0]!.n).toBe(1);

      // The "New library" path is now reachable: createLibrary succeeds against the id.
      const lib = createLibrary(fresh.adapter, nodeIdentity, { workspaceId: id, name: 'Movies', mediaType: 'movie' });
      expect(lib.channelId).toBeTruthy();
      expect(listLibrarySummaries(fresh.adapter, id).map((s) => s.config.channelId)).toContain(lib.channelId);
    } finally {
      fresh.close();
    }
  });
});

describe('summaries + display names + cross-library rows', () => {
  it('summarizes libraries, names them locally, and aggregates On Deck / Recently added', async () => {
    const store = new InMemoryNodeStore();
    const movies = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Movies', mediaType: 'movie' });
    setPersonalLibraryName(db.adapter, movies.channelId, 'Movies');
    const music = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Music', mediaType: 'music' });
    setPersonalLibraryName(db.adapter, music.channelId, 'Music');

    const a = await addLibraryItem(db.adapter, store, identity, {
      channelId: movies.channelId, workspaceId: personalId, bytes: bytes(1024), title: 'Arrival',
      durationMs: 7_000_000,
    }, { now: '2026-01-01T00:00:00.000Z' });
    const b = await addLibraryItem(db.adapter, store, identity, {
      channelId: music.channelId, workspaceId: personalId, bytes: bytes(512, 9), title: 'Track',
      metadata: { artist: 'Someone' },
    }, { now: '2026-01-02T00:00:00.000Z' });

    const summaries = listLibrarySummaries(db.adapter, personalId);
    expect(summaries.map((s) => s.name).sort()).toEqual(['Movies', 'Music']);
    expect(summaries.reduce((n, s) => n + s.itemCount, 0)).toBe(2);
    expect(libraryDisplayName(db.adapter, movies)).toBe('Movies');

    // On Deck reads real progress; Recently added reads real HLCs.
    setLibraryProgress(db.adapter, a.item.id, { positionMs: 120_000 });
    const all = listAllWorkspaceItems(db.adapter, personalId);
    expect(all).toHaveLength(2);
    const deck = buildOnDeck(all, progressByItem(db.adapter));
    expect(deck.map((e) => e.item.event.id)).toEqual([a.item.id]);
    const recent = buildRecentlyAdded(all);
    expect(recent[0]!.event.id).toBe(b.item.id);
  });
});

describe('verified tags + edit-without-reseal + held set', () => {
  it('batches verified tags, edits metadata keeping the same content, and reports held content', async () => {
    const store = new InMemoryNodeStore();
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Movies', mediaType: 'movie' });
    const { item } = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.channelId, workspaceId: personalId, bytes: bytes(2048), title: 'Dune', year: 2021,
    });

    addLibraryItemTag(db.adapter, identity, { channelId: lib.channelId, workspaceId: personalId, itemId: item.id, tag: 'scifi' });
    const tagMap = verifiedTagsByItem(db.adapter, lib.channelId);
    expect(tagMap.get(item.id)).toEqual(['scifi']);

    expect(canCurateLibrary(db.adapter, identity.publicKey, personalId, lib.channelId)).toBe(true);

    const edited = editLibraryItemMetadata(db.adapter, identity, item.id, { title: 'Dune (2021)', year: 2021 }, undefined, '2026-02-01T00:00:00.000Z');
    expect(edited).toBe(true);
    const after = getLibraryItem(db.adapter, item.id)!;
    expect(after.title).toBe('Dune (2021)');
    expect(after.contentCid).toBe(item.contentCid); // same sealed content, no reseal

    const held = await heldContentIds(store, personalId);
    expect(held.has(item.contentCid)).toBe(true);
  });
});
