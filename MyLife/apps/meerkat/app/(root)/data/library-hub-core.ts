// Plan 38 Phase 5 (MOBILE): the db/store glue the browse screens need on top of
// the verified read models in library-store-core (which this only reads from).
// Kept OUT of the pure library-view-core twin because these touch SQLite + the
// NodeStore; the pure composition/On-Deck/Recently-added logic lives there and is
// consumed by both this file's callers and the web twin.

import type { DatabaseAdapter } from '@mylife/db';
import {
  evaluateChannelPost,
  type DeviceIdentity,
  type NodeStore,
} from '@mylife/sync';
import {
  createLibraryItemEvent,
  libraryItemEventToRow,
  libraryTagEventFromRow,
  verifyLibraryTagEvent,
  resolveVerifiedTagsForItem,
  type LibraryConfigEvent,
  type ResolvedLibraryItem,
} from './library-data-core';
import {
  getLibrary,
  getLibraryItem,
  libraryWorkspaceContext,
  listLibraries,
  listLibraryItems,
} from './library-store-core';
import { getCommunity } from '@mylife/sync';
import { CM_LIBRARY_ITEMS_TABLE, CM_LIBRARY_TAGS_TABLE } from './community-core';
import { getSetting, setSetting } from './db';
import type { LibraryProgressLite } from './library-view-core';

/**
 * A library's user-visible name. Community libraries read it from the signed
 * descriptor channel (owner-controlled). Personal libraries have no descriptor and
 * the signed config carries no name, so a personal library's name is a DEVICE-LOCAL
 * label in mk_settings (honest: a personal library name is not shared today).
 */
const LIBRARY_NAME_SETTING_PREFIX = 'library_name:';

const MEDIA_FALLBACK_NAME: Record<string, string> = {
  movie: 'Movies', show: 'Shows', music: 'Music', photo: 'Photos',
  book: 'Books', document: 'Documents', custom: 'Library',
};

/** Persist the device-local display name for a personal library. */
export function setPersonalLibraryName(db: DatabaseAdapter, channelId: string, name: string): void {
  setSetting(db, `${LIBRARY_NAME_SETTING_PREFIX}${channelId}`, name);
}

/** Resolve a library's display name from the descriptor (community) or the local label (personal). */
export function libraryDisplayName(db: DatabaseAdapter, config: LibraryConfigEvent): string {
  const community = getCommunity(db, config.communityId);
  if (community) {
    const channel = community.descriptor.channels.find((ch) => ch.id === config.channelId);
    if (channel?.name) return channel.name;
  }
  const local = getSetting(db, `${LIBRARY_NAME_SETTING_PREFIX}${config.channelId}`);
  return local?.trim() || MEDIA_FALLBACK_NAME[config.mediaType] || 'Library';
}

export interface EditLibraryMetadataPatch {
  title?: string;
  sortTitle?: string | null;
  year?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Re-author an item's metadata WITHOUT re-sealing its content (the sealed blocks,
 * keys, and content id are preserved verbatim; only the signed descriptive fields
 * change). LWW: the fresh updatedAt wins on every device. The data layer has no
 * edit-without-reseal entry point, so this composes the exported signer directly.
 * Caller must gate on curator/author; the write records for replication.
 */
export function editLibraryItemMetadata(
  db: DatabaseAdapter,
  actor: DeviceIdentity,
  itemId: string,
  patch: EditLibraryMetadataPatch,
  recordChange?: (table: string, operation: 'INSERT', rowId: string, data: Record<string, unknown>) => void,
  now?: string,
): boolean {
  const existing = getLibraryItem(db, itemId);
  if (!existing || existing.tombstone) return false;
  const metadataJson = patch.metadata ? JSON.stringify(patch.metadata) : existing.metadataJson;
  const edited = createLibraryItemEvent(actor, {
    id: existing.id,
    communityId: existing.communityId,
    channelId: existing.channelId,
    contentCid: existing.contentCid,
    coverCid: existing.coverCid,
    thumbCid: existing.thumbCid,
    keyEpoch: existing.keyEpoch,
    wrappedKey: existing.wrappedKey,
    coverWrappedKey: existing.coverWrappedKey,
    manifestJson: existing.manifestJson,
    title: patch.title ?? existing.title,
    sortTitle: patch.sortTitle !== undefined ? patch.sortTitle : existing.sortTitle,
    year: patch.year !== undefined ? patch.year : existing.year,
    durationMs: existing.durationMs,
    sizeBytes: existing.sizeBytes,
    mimeType: existing.mimeType,
    metadataJson,
    metadataSource: existing.metadataSource,
    updatedAt: now,
  });
  const row = libraryItemEventToRow(edited);
  const cols = Object.keys(row);
  db.execute(
    `INSERT OR REPLACE INTO ${CM_LIBRARY_ITEMS_TABLE} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map((k) => row[k]),
  );
  recordChange?.(CM_LIBRARY_ITEMS_TABLE, 'INSERT', edited.id, row);
  return true;
}

/**
 * The auto-created personal workspace id for this device (bootstrap makes exactly
 * one: workspace_type = 'personal', created_by = this device). Null only before
 * bootstrap has run. This is the workspace the "My Library" hub browses.
 */
export function getPersonalWorkspaceId(db: DatabaseAdapter, deviceId: string): string | null {
  const rows = db.query<{ id: string }>(
    `SELECT id FROM sync_workspaces
       WHERE workspace_type = 'personal' AND created_by_device_id = ?
       ORDER BY created_at ASC LIMIT 1`,
    [deviceId],
  );
  return rows[0]?.id ?? null;
}

/**
 * Ensure the auto personal workspace exists for this device and return its id
 * (Plan 38 personal-first, MOBILE twin of meerkat-web's ensurePersonalWorkspace).
 * The Meerkat node boots its own app identity and never ran ensureSyncBootstrap,
 * so no personal workspace row exists; without this the "My Library" hub reads a
 * null workspace and "New library" is a silent no-op. Idempotent: writes the
 * sync_workspaces row + the owner-membership row (which the store's author-allowed
 * predicate checks) only when absent. The epoch key is minted lazily on first
 * ingest by ensureWorkspaceEpoch, so nothing here fabricates key material.
 */
export function ensurePersonalWorkspace(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  now: string = new Date().toISOString(),
): string {
  const existing = getPersonalWorkspaceId(db, identity.publicKey);
  const workspaceId = existing ?? `ws_personal_${now}_${identity.publicKey.slice(0, 8)}`;
  if (!existing) {
    db.execute(
      `INSERT INTO sync_workspaces
         (id, display_name, workspace_type, created_by_device_id, created_at, rotated_at, current_key_version, archived_at)
       VALUES (?, ?, 'personal', ?, ?, NULL, 1, NULL)`,
      [workspaceId, 'Personal Workspace', identity.publicKey, now],
    );
  }
  const members = db.query<{ removed_at: string | null }>(
    'SELECT removed_at FROM sync_workspace_members WHERE workspace_id = ? AND device_id = ? LIMIT 1',
    [workspaceId, identity.publicKey],
  );
  const activeMember = members.length > 0 && members[0]!.removed_at === null;
  if (!activeMember) {
    db.execute(
      `INSERT OR REPLACE INTO sync_workspace_members
         (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
       VALUES (?, ?, 'owner', ?, ?, NULL)`,
      [workspaceId, identity.publicKey, identity.publicKey, now],
    );
  }
  return workspaceId;
}

/**
 * The read-time author-allowed predicate for a channel, rebuilt from the same
 * inputs library-store-core uses: community authors gate through
 * evaluateChannelPost; personal authors are active workspace devices. Used to
 * resolve verified tags in a batch (the store exposes tags only per item).
 */
function authorAllowedFor(
  db: DatabaseAdapter,
  workspaceId: string,
  channelId: string,
): (authorDeviceId: string) => boolean {
  const ctx = libraryWorkspaceContext(db, workspaceId);
  if (ctx?.kind === 'community' && ctx.descriptor) {
    const descriptor = ctx.descriptor;
    return (author) => evaluateChannelPost(descriptor, author, channelId).allowed;
  }
  return (author) => {
    const rows = db.query<{ removed_at: string | null }>(
      'SELECT removed_at FROM sync_workspace_members WHERE workspace_id = ? AND device_id = ? LIMIT 1',
      [workspaceId, author],
    );
    return rows.length > 0 && rows[0]!.removed_at === null;
  };
}

/**
 * Whether an actor may curate a library channel (item/collection/tag CRUD): the
 * same read-time predicate the store's write paths enforce, exposed so the UI can
 * HIDE curator affordances (the data layer still enforces on write).
 */
export function canCurateLibrary(
  db: DatabaseAdapter,
  actorDeviceId: string,
  workspaceId: string,
  channelId: string,
): boolean {
  return authorAllowedFor(db, workspaceId, channelId)(actorDeviceId);
}

/**
 * Verified tags for EVERY item in a library, in one table scan (the browse tag
 * filter + facet need the whole set; per-item calls would be O(items) queries).
 * Only signature-valid, author-allowed tags survive, matching listLibraryItemTags.
 */
export function verifiedTagsByItem(
  db: DatabaseAdapter,
  channelId: string,
): Map<string, string[]> {
  const config = getLibrary(db, channelId);
  const out = new Map<string, string[]>();
  if (!config) return out;
  const allowed = authorAllowedFor(db, config.communityId, channelId);
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARY_TAGS_TABLE} WHERE channel_id = ?`,
    [channelId],
  );
  const byItem = new Map<string, ReturnType<typeof libraryTagEventFromRow>[]>();
  for (const row of rows) {
    const event = libraryTagEventFromRow(row);
    if (!event || !verifyLibraryTagEvent(event)) continue;
    const list = byItem.get(event.itemId) ?? [];
    list.push(event);
    byItem.set(event.itemId, list);
  }
  for (const [itemId, events] of byItem) {
    const tags = resolveVerifiedTagsForItem(
      events.filter((e): e is NonNullable<typeof e> => e !== null),
      itemId,
      allowed,
    );
    if (tags.length > 0) out.set(itemId, tags);
  }
  return out;
}

/** All device-local progress rows keyed by item id (one table scan). */
export function progressByItem(db: DatabaseAdapter): Map<string, LibraryProgressLite> {
  const rows = db.query<{ id: string; position_ms: number; completed: number; updated_at: string }>(
    `SELECT id, position_ms, completed, updated_at FROM cm_library_progress`,
  );
  const out = new Map<string, LibraryProgressLite>();
  for (const row of rows) {
    out.set(row.id, {
      positionMs: row.position_ms,
      completed: row.completed === 1,
      updatedAt: row.updated_at,
    });
  }
  return out;
}

/**
 * The set of content ids this device has actually sealed + pinned under a
 * workspace sealing context (the pin context IS the workspace id). Drives the
 * honest "Held on this device" badge: an item is held iff its contentCid is here.
 */
export async function heldContentIds(store: NodeStore, workspaceId: string): Promise<Set<string>> {
  const manifests = await store.listManifests(workspaceId);
  return new Set(manifests.map((m) => m.contentId));
}

export interface LibrarySummary {
  config: LibraryConfigEvent;
  name: string;
  itemCount: number;
}

/** Per-library summary rows for the hub home (verified item counts only). */
export function listLibrarySummaries(db: DatabaseAdapter, workspaceId: string): LibrarySummary[] {
  return listLibraries(db, workspaceId).map((config) => ({
    config,
    name: libraryDisplayName(db, config),
    itemCount: listLibraryItems(db, config.channelId).length,
  }));
}

/** Every verified item across all libraries of a workspace (hub-wide On Deck / Recently added). */
export function listAllWorkspaceItems(db: DatabaseAdapter, workspaceId: string): ResolvedLibraryItem[] {
  const out: ResolvedLibraryItem[] = [];
  for (const config of listLibraries(db, workspaceId)) {
    out.push(...listLibraryItems(db, config.channelId));
  }
  return out;
}
