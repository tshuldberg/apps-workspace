// Plan 38 Phase 2 (web, G4): device-local Communities-list prefs round trip.
// The mk_community_prefs row (pin / manual sort / folder) persists and reads back
// unchanged, merges partial patches, and normalizes blank folders to null.

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ensureMeerkatTables } from '../schema';
import { getCommunityPrefs, listCommunityPrefs, setCommunityPrefs } from '../community-prefs';

let testDb: InMemoryTestDatabase | null = null;
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function freshDb(): InMemoryTestDatabase['adapter'] {
  testDb = createInMemoryTestDatabase();
  ensureMeerkatTables(testDb.adapter);
  return testDb.adapter;
}

describe('community prefs round trip', () => {
  it('defaults to unpinned + ungrouped for an unknown community', () => {
    const db = freshDb();
    expect(getCommunityPrefs(db, 'nope')).toEqual({
      communityId: 'nope',
      pinned: false,
      sortIndex: null,
      folder: null,
    });
    expect(listCommunityPrefs(db)).toEqual([]);
  });

  it('persists and merges partial patches without clobbering other fields', () => {
    const db = freshDb();
    setCommunityPrefs(db, 'c1', { pinned: true });
    setCommunityPrefs(db, 'c1', { folder: 'Family' });
    setCommunityPrefs(db, 'c1', { sortIndex: 3 });

    expect(getCommunityPrefs(db, 'c1')).toEqual({
      communityId: 'c1',
      pinned: true,
      sortIndex: 3,
      folder: 'Family',
    });
  });

  it('normalizes a blank folder to null and can clear a pin', () => {
    const db = freshDb();
    setCommunityPrefs(db, 'c2', { pinned: true, folder: '   ' });
    let row = getCommunityPrefs(db, 'c2');
    expect(row.folder).toBeNull();
    expect(row.pinned).toBe(true);

    setCommunityPrefs(db, 'c2', { pinned: false, folder: null });
    row = getCommunityPrefs(db, 'c2');
    expect(row.pinned).toBe(false);
    expect(row.folder).toBeNull();
  });

  it('lists every stored community pref', () => {
    const db = freshDb();
    setCommunityPrefs(db, 'a', { pinned: true });
    setCommunityPrefs(db, 'b', { folder: 'Work' });
    const rows = listCommunityPrefs(db).sort((x, y) => x.communityId.localeCompare(y.communityId));
    expect(rows.map((r) => r.communityId)).toEqual(['a', 'b']);
    expect(rows[0]).toEqual({ communityId: 'a', pinned: true, sortIndex: null, folder: null });
    expect(rows[1]).toEqual({ communityId: 'b', pinned: false, sortIndex: null, folder: 'Work' });
  });
});
