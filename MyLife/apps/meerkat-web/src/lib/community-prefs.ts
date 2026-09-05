// community-prefs.ts (web twin of the mobile mk_community_prefs helpers).
//
// Plan 38 Phase 2 (G4): device-local per-community list organization. These rows
// live in mk_community_prefs, which is OUTSIDE every sync prefix map, so this
// organization is "Only on this device" and never travels to any peer. The
// helpers are pure DB accessors (no React) so the rail ordering and the organize
// dialog can be tested under Node and cannot drift from the mobile source.

import type { DatabaseAdapter } from '@mylife/db';

export interface CommunityPrefRow {
  communityId: string;
  pinned: boolean;
  /** Manual sort key; null keeps the community in its default list position. */
  sortIndex: number | null;
  /** Optional folder label; null / '' = ungrouped. */
  folder: string | null;
}

interface RawPrefRow {
  community_id: string;
  pinned: number;
  sort_index: number | null;
  folder: string | null;
}

function fromRaw(r: RawPrefRow): CommunityPrefRow {
  return {
    communityId: r.community_id,
    pinned: r.pinned === 1,
    sortIndex: r.sort_index,
    folder: r.folder && r.folder.trim() ? r.folder : null,
  };
}

/** Every stored community pref row (device-local). */
export function listCommunityPrefs(db: DatabaseAdapter): CommunityPrefRow[] {
  return db
    .query<RawPrefRow>('SELECT community_id, pinned, sort_index, folder FROM mk_community_prefs')
    .map(fromRaw);
}

/** The pref row for one community, or a default (unpinned, ungrouped) row. */
export function getCommunityPrefs(db: DatabaseAdapter, communityId: string): CommunityPrefRow {
  const rows = db.query<RawPrefRow>(
    'SELECT community_id, pinned, sort_index, folder FROM mk_community_prefs WHERE community_id = ?',
    [communityId],
  );
  return rows[0]
    ? fromRaw(rows[0])
    : { communityId, pinned: false, sortIndex: null, folder: null };
}

export interface CommunityPrefsPatch {
  pinned?: boolean;
  sortIndex?: number | null;
  folder?: string | null;
}

/** Merge a partial change into a community's pref row (upsert). */
export function setCommunityPrefs(
  db: DatabaseAdapter,
  communityId: string,
  patch: CommunityPrefsPatch,
): void {
  const current = getCommunityPrefs(db, communityId);
  const pinned = patch.pinned ?? current.pinned;
  const sortIndex = patch.sortIndex !== undefined ? patch.sortIndex : current.sortIndex;
  const folderRaw = patch.folder !== undefined ? patch.folder : current.folder;
  const folder = folderRaw && folderRaw.trim() ? folderRaw.trim() : null;
  db.execute(
    'INSERT OR REPLACE INTO mk_community_prefs (community_id, pinned, sort_index, folder) VALUES (?, ?, ?, ?)',
    [communityId, pinned ? 1 : 0, sortIndex, folder],
  );
}
