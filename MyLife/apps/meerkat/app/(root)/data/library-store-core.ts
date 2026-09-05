// Plan 38 Phase 3: the db + node-store orchestration for the library layer
// (MOBILE). This is the sealing/persistence glue -- the pure signing + read
// models live in library-data-core.ts (byte-locked twin); this file wires them
// to the SQLite tables (cm_library_*), the epoch keys, and the NodeStore. It is
// the native counterpart of apps/meerkat-web/src/lib/library-store.ts (a
// structural twin, like community-identity-media.ts / community-banner.ts): the
// two share the pure core, so a logic change lands in library-data-core once and
// both surfaces inherit it.
//
// Personal-first (amendment B.5): every function works with ZERO communities.
// For the auto-created personal workspace there is NO community descriptor --
// the library config is SELF-signed and verified against the workspace's
// created_by device, and an item author is "allowed" iff it is an active device
// of the workspace. The community path verifies config against the descriptor
// owner and gates item authors through evaluateChannelPost.
//
// Honesty: sealing needs a workspace epoch key. addLibraryItem mints the
// personal workspace's first epoch on demand (ensureWorkspaceEpoch); for a
// community with no epoch it fails with an honest error rather than faking one.

import type { DatabaseAdapter } from '@mylife/db';
import {
  createGroupCommit,
  evaluateChannelPost,
  fetchFromStore,
  getCommunity,
  getCurrentEpochKey,
  pinShare,
  reviseCommunity,
  sealLibraryObject,
  unpinShare,
  unwrapLibraryObjectKeyForDevice,
  upsertCommunity,
  wrapLibraryObjectKey,
  type CommunityChannel,
  type CommunityDescriptor,
  type DeviceIdentity,
  type GroupMemberKey,
  type NodeStore,
  type PinClass,
  type RecordKeyWrapChange,
  type SealedShare,
  type WorkspaceMemberRole,
} from '@mylife/sync';
import {
  evictToBudget,
  parseStorageBudget,
  serializeStorageBudget,
  pinKey,
  wouldExceedBudget,
  LIBRARY_STORAGE_BUDGET_SETTING_KEY,
  STORAGE_BUDGET_EXCEEDED_ERROR,
  type EvictionPlan,
  type LibraryPinPolicy,
  type LibraryPinStore,
} from './library-storage-core';
import {
  getSharePayloads,
  routeShareIntake,
} from '@mylife/sync';
import {
  CM_LIBRARIES_TABLE,
  CM_LIBRARY_ITEMS_TABLE,
  CM_LIBRARY_COLLECTIONS_TABLE,
  CM_LIBRARY_COLLECTION_ITEMS_TABLE,
  CM_LIBRARY_SMART_RULES_TABLE,
  CM_LIBRARY_TAGS_TABLE,
  CM_LIBRARY_PROGRESS_TABLE,
} from './community-core';
import {
  MEDIA_TYPE_REGISTRY,
  validateLibraryItemMetadata,
  type KnownMediaType,
} from './library-metadata-core';
import {
  collectionItemEventFromRow,
  collectionItemEventToRow,
  createCollectionItemEvent,
  createLibraryCollectionEvent,
  createLibraryConfigEvent,
  createLibraryItemEvent,
  createLibraryTagEvent,
  createSmartRuleEvent,
  findDedupItemByContentCid,
  generateLibraryLocalId,
  libraryCollectionEventFromRow,
  libraryCollectionEventToRow,
  libraryConfigEventFromRow,
  libraryConfigEventToRow,
  libraryItemEventFromRow,
  libraryItemEventToRow,
  libraryTagEventFromRow,
  libraryTagEventToRow,
  resolveVerifiedCollectionItemIds,
  resolveVerifiedCollections,
  resolveVerifiedLibraryItems,
  resolveVerifiedSmartRules,
  resolveVerifiedTagsForItem,
  smartRuleEventFromRow,
  smartRuleEventToRow,
  verifyLibraryConfigEvent,
  verifyLibraryItemEvent,
  type CollectionItemEvent,
  type LibraryCollectionEvent,
  type LibraryConfigEvent,
  type LibraryItemEvent,
  type LibraryTagEvent,
  type ResolvedLibraryItem,
  type SmartRuleEvent,
} from './library-data-core';
import {
  deriveTitleFromFilename,
  extractLocalMetadata,
} from './library-extract-core';
import {
  ENRICHMENT_PROVIDERS,
  enrichmentProviderKeySettingKey,
  isEnrichmentProvider,
  type EnrichmentProvider,
} from './library-enrich-core';
import { probeContainer, type ProbeContainerFn } from './library-probe';

/** The sealed-object name given to library content/cover blobs (not user-visible). */
const CONTENT_OBJECT_NAME = 'library-content';
const COVER_OBJECT_NAME = 'library-cover';

// ---------------------------------------------------------------------------
// Workspace context: personal (self-signed) vs community (owner-signed).
// ---------------------------------------------------------------------------

export type LibraryWorkspaceKind = 'personal' | 'community';

export interface LibraryWorkspaceContext {
  kind: LibraryWorkspaceKind;
  workspaceId: string;
  /** The device the library CONFIG must be signed by (owner / personal creator). */
  configSigner: string;
  /** Present only for communities. */
  descriptor?: CommunityDescriptor;
}

interface WorkspaceRow {
  workspace_type: string;
  created_by_device_id: string;
}

/** Resolve whether a workspace is a community (has a descriptor) or the personal one. */
export function libraryWorkspaceContext(
  db: DatabaseAdapter,
  workspaceId: string,
): LibraryWorkspaceContext | null {
  const community = getCommunity(db, workspaceId);
  if (community) {
    return {
      kind: 'community',
      workspaceId,
      configSigner: community.descriptor.ownerDeviceId,
      descriptor: community.descriptor,
    };
  }
  const rows = db.query<WorkspaceRow>(
    'SELECT workspace_type, created_by_device_id FROM sync_workspaces WHERE id = ? LIMIT 1',
    [workspaceId],
  );
  const row = rows[0];
  if (!row || row.workspace_type !== 'personal') return null;
  return { kind: 'personal', workspaceId, configSigner: row.created_by_device_id };
}

function isActiveWorkspaceDevice(db: DatabaseAdapter, workspaceId: string, deviceId: string): boolean {
  const rows = db.query<{ removed_at: string | null }>(
    'SELECT removed_at FROM sync_workspace_members WHERE workspace_id = ? AND device_id = ? LIMIT 1',
    [workspaceId, deviceId],
  );
  return rows.length > 0 && rows[0]!.removed_at === null;
}

/**
 * The read-time "was this author allowed to write here?" predicate:
 *   - community: evaluateChannelPost against the descriptor at read time,
 *   - personal: an active device of the workspace.
 */
function authorAllowedPredicate(
  db: DatabaseAdapter,
  ctx: LibraryWorkspaceContext,
  channelId: string,
): (authorDeviceId: string) => boolean {
  if (ctx.kind === 'community' && ctx.descriptor) {
    const descriptor = ctx.descriptor;
    return (author) => evaluateChannelPost(descriptor, author, channelId).allowed;
  }
  return (author) => isActiveWorkspaceDevice(db, ctx.workspaceId, author);
}

// ---------------------------------------------------------------------------
// Epoch: mint the personal workspace's first epoch on demand.
// ---------------------------------------------------------------------------

export interface EpochKey {
  epoch: number;
  secret: Uint8Array;
}

/**
 * This device's current epoch key for a workspace, minting the PERSONAL
 * workspace's first epoch on demand (a solo personal workspace has one member:
 * this device). For a community with no epoch this returns null -- minting a
 * community epoch is the owner's job at creation, never a side effect here.
 */
export function ensureWorkspaceEpoch(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  workspaceId: string,
  recordChange?: RecordKeyWrapChange,
  now?: string,
): EpochKey | null {
  const existing = getCurrentEpochKey(db, workspaceId, identity);
  if (existing) return existing;
  const rows = db.query<WorkspaceRow>(
    'SELECT workspace_type, created_by_device_id FROM sync_workspaces WHERE id = ? LIMIT 1',
    [workspaceId],
  );
  const row = rows[0];
  if (!row || row.workspace_type !== 'personal' || row.created_by_device_id !== identity.publicKey) {
    return null;
  }
  // getCurrentEpochKey already returned null (no READABLE key). The personal
  // workspace bootstraps with current_key_version = 1 but NO key wrap, so we mint
  // regardless of the version claim: createGroupCommit advances to the next epoch
  // and writes this device's wrap.
  const members: GroupMemberKey[] = db
    .query<{ device_id: string }>(
      'SELECT device_id FROM sync_workspace_members WHERE workspace_id = ? AND removed_at IS NULL',
      [workspaceId],
    )
    .filter((m) => m.device_id === identity.publicKey)
    .map(() => ({ deviceId: identity.publicKey, dhPublicKey: identity.dhPublicKey }));
  if (members.length === 0) return null;
  createGroupCommit(db, { workspaceId, committer: identity, members, recordChange, now });
  return getCurrentEpochKey(db, workspaceId, identity);
}

// ---------------------------------------------------------------------------
// Generic signed-row insert (INSERT OR REPLACE by PK) + change record.
// ---------------------------------------------------------------------------

function insertSignedRow(
  db: DatabaseAdapter,
  table: string,
  rowId: string,
  row: Record<string, unknown>,
  recordChange?: RecordKeyWrapChange,
): void {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  db.execute(
    `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    cols.map((c) => row[c]),
  );
  recordChange?.(table, 'INSERT', rowId, row);
}

// ---------------------------------------------------------------------------
// Libraries.
// ---------------------------------------------------------------------------

export interface CreateLibraryArgs {
  workspaceId: string;
  name: string;
  mediaType: KnownMediaType;
  sortDefault?: string;
  /** Community only: roles allowed to curate (item/collection CRUD) in this channel. */
  postRoles?: WorkspaceMemberRole[];
}

export interface CreateLibraryOptions {
  recordChange?: RecordKeyWrapChange;
  now?: string;
}

/**
 * Create a library. Community: OWNER-only -- appends ONE kind:'library' channel
 * via a single reviseCommunity revision AND writes the owner-signed cm_libraries
 * row on the same save. Personal: a self-signed cm_libraries row under a freshly
 * generated library channel id (no descriptor exists; the personal workspace is
 * the boundary).
 */
export function createLibrary(
  db: DatabaseAdapter,
  actor: DeviceIdentity,
  args: CreateLibraryArgs,
  options: CreateLibraryOptions = {},
): LibraryConfigEvent {
  const ctx = libraryWorkspaceContext(db, args.workspaceId);
  if (!ctx) throw new Error('That workspace is not on this device.');
  if (!MEDIA_TYPE_REGISTRY[args.mediaType]) throw new Error('Unknown library media type.');
  const sortDefault = args.sortDefault ?? MEDIA_TYPE_REGISTRY[args.mediaType].defaultSort;
  const now = options.now ?? new Date().toISOString();
  const channelId = generateLibraryLocalId('lib');

  if (ctx.kind === 'community') {
    if (ctx.configSigner !== actor.publicKey) {
      throw new Error('Only the community owner can create a library.');
    }
    const community = getCommunity(db, args.workspaceId)!;
    const channel: CommunityChannel = {
      id: channelId,
      name: args.name,
      kind: 'library',
      ...(args.postRoles ? { postRoles: args.postRoles } : {}),
    };
    const revised = reviseCommunity(
      actor,
      { descriptor: community.descriptor, signature: community.signature },
      { channels: [...community.descriptor.channels, channel] },
      now,
    );
    const config = createLibraryConfigEvent(actor, {
      id: channelId,
      communityId: args.workspaceId,
      channelId,
      mediaType: args.mediaType,
      sortDefault,
      createdAt: now,
      updatedAt: now,
    });
    // upsertCommunity persists the new signed descriptor locally; the descriptor
    // gossips to members through the existing revision path (not recordChange).
    // The cm_libraries row DOES record for replication.
    upsertCommunity(db, revised, actor.publicKey);
    insertSignedRow(db, CM_LIBRARIES_TABLE, config.id, libraryConfigEventToRow(config), options.recordChange);
    return config;
  }

  // Personal: self-signed, verified against the workspace creator (== this device).
  if (ctx.configSigner !== actor.publicKey) {
    throw new Error('Only this device can create a personal library here.');
  }
  const config = createLibraryConfigEvent(actor, {
    id: channelId,
    communityId: args.workspaceId,
    channelId,
    mediaType: args.mediaType,
    sortDefault,
    createdAt: now,
    updatedAt: now,
  });
  insertSignedRow(db, CM_LIBRARIES_TABLE, config.id, libraryConfigEventToRow(config), options.recordChange);
  return config;
}

/** All verified library configs in a workspace (personal or community). */
export function listLibraries(db: DatabaseAdapter, workspaceId: string): LibraryConfigEvent[] {
  const ctx = libraryWorkspaceContext(db, workspaceId);
  if (!ctx) return [];
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARIES_TABLE} WHERE community_id = ?`,
    [workspaceId],
  );
  const out: LibraryConfigEvent[] = [];
  for (const row of rows) {
    const event = libraryConfigEventFromRow(row);
    if (event && verifyLibraryConfigEvent(event, ctx.configSigner)) out.push(event);
  }
  return out;
}

/** The verified config for a single library channel, or null. */
export function getLibrary(db: DatabaseAdapter, channelId: string): LibraryConfigEvent | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARIES_TABLE} WHERE id = ? LIMIT 1`,
    [channelId],
  );
  const row = rows[0];
  if (!row) return null;
  const event = libraryConfigEventFromRow(row);
  if (!event) return null;
  const ctx = libraryWorkspaceContext(db, event.communityId);
  if (!ctx) return null;
  return verifyLibraryConfigEvent(event, ctx.configSigner) ? event : null;
}

// ---------------------------------------------------------------------------
// Items: seal, sign, insert; verified-only read model; tombstone + unpin.
// ---------------------------------------------------------------------------

/** Build the { manifest, manifestSignature, sealedChunkIds } JSON the signed row carries. */
function itemManifestJson(share: SealedShare): string {
  const ordered = [...share.sealedChunks].sort((a, b) => a.index - b.index);
  return JSON.stringify({
    manifest: share.manifest,
    manifestSignature: share.manifestSignature,
    sealedChunkIds: ordered.map((chunk) => chunk.sealedId),
  });
}

/** A per-surface resize seam: downscale cover bytes to a ~300px thumbnail. */
export type ResizeCover = (
  coverBytes: Uint8Array,
) => Promise<{ bytes: Uint8Array; mimeType: string } | null>;

export interface AddLibraryItemArgs {
  channelId: string;
  workspaceId: string;
  bytes: Uint8Array;
  title: string;
  mimeType?: string | null;
  sortTitle?: string | null;
  year?: number | null;
  durationMs?: number | null;
  /** Typed per media_type; defaults to {} (validated against the library type). */
  metadata?: Record<string, unknown>;
  metadataSource?: string;
  coverBytes?: Uint8Array | null;
}

export interface AddLibraryItemOptions {
  recordChange?: RecordKeyWrapChange;
  /** Reserved for the Phase 5 thumbnail path; plumbed, unused until thumb keying lands. */
  resizeCover?: ResizeCover;
  now?: string;
}

export interface AddLibraryItemResult {
  item: LibraryItemEvent;
  deduped: boolean;
}

/**
 * Seal + author a library item. Within-workspace dedup (C.2 / amendment 9): if a
 * verified non-tombstoned item in the SAME workspace already holds this content
 * id, its sealed blocks are reused and the DEK is re-wrapped under the current
 * epoch (no reseal-pinning), returning deduped: true. The content id is a
 * plaintext-Merkle root, so this is queried ONLY within the workspace, never
 * across workspaces (a plaintext-equality oracle guard).
 */
export async function addLibraryItem(
  db: DatabaseAdapter,
  store: NodeStore,
  actor: DeviceIdentity,
  args: AddLibraryItemArgs,
  options: AddLibraryItemOptions = {},
): Promise<AddLibraryItemResult> {
  const config = getLibrary(db, args.channelId);
  if (!config || config.communityId !== args.workspaceId) {
    throw new Error('That library is not on this device.');
  }
  const ctx = libraryWorkspaceContext(db, args.workspaceId);
  if (!ctx) throw new Error('That workspace is not on this device.');
  const allowed = authorAllowedPredicate(db, ctx, args.channelId);
  if (!allowed(actor.publicKey)) {
    throw new Error('You are not allowed to add items to this library.');
  }
  const metadataJson = JSON.stringify(args.metadata ?? {});
  const validated = validateForType(config.mediaType, metadataJson);
  if (!validated) throw new Error('That item metadata is not valid for this library type.');

  const epoch = ensureWorkspaceEpoch(db, actor, args.workspaceId, options.recordChange, options.now)
    ?? getCurrentEpochKey(db, args.workspaceId, actor);
  if (!epoch) {
    throw new Error('This device has no encryption key for this workspace yet.');
  }

  const sealed = sealLibraryObject(args.bytes, {
    workspaceId: args.workspaceId,
    epoch: epoch.epoch,
    epochSecret: epoch.secret,
    name: CONTENT_OBJECT_NAME,
    identity: actor,
    ...(options.now ? { createdAt: options.now } : {}),
  });

  // Dedup within THIS workspace only.
  const existing = listRawWorkspaceItems(db, args.workspaceId);
  const dup = findDedupItemByContentCid(existing, sealed.contentId);
  let deduped = false;
  let contentCid = sealed.contentId;
  let wrappedKey = sealed.wrappedKey;
  let manifestJson = itemManifestJson(sealed.share);

  if (dup) {
    const dek = unwrapLibraryObjectKeyForDevice(db, actor, args.workspaceId, dup.keyEpoch, dup.wrappedKey);
    if (dek) {
      // Reuse the existing pinned blocks; re-wrap the SAME DEK under the current epoch.
      wrappedKey = wrapLibraryObjectKey(dek, epoch.secret, args.workspaceId, epoch.epoch);
      dek.fill(0);
      contentCid = dup.contentCid;
      manifestJson = dup.manifestJson;
      deduped = true;
    }
  }
  if (!deduped) {
    // 'authored' pin under the workspace sealing context (never auto-evicted).
    await pinShare(store, sealed.share, args.workspaceId, 'authored');
  }

  // Cover (optional): its own sealed object + wrapped key.
  let coverCid: string | null = null;
  let coverWrappedKey: string | null = null;
  if (args.coverBytes && args.coverBytes.length > 0) {
    const coverSealed = sealLibraryObject(args.coverBytes, {
      workspaceId: args.workspaceId,
      epoch: epoch.epoch,
      epochSecret: epoch.secret,
      name: COVER_OBJECT_NAME,
      identity: actor,
      ...(options.now ? { createdAt: options.now } : {}),
    });
    await pinShare(store, coverSealed.share, args.workspaceId, 'authored');
    coverCid = coverSealed.contentId;
    coverWrappedKey = coverSealed.wrappedKey;
  }

  const item = createLibraryItemEvent(actor, {
    communityId: args.workspaceId,
    channelId: args.channelId,
    contentCid,
    coverCid,
    // thumb_wrapped_key has no column yet (Phase 5): a separately-keyed thumbnail
    // cannot be persisted, so thumbCid stays null until that schema lands.
    thumbCid: null,
    keyEpoch: epoch.epoch,
    wrappedKey,
    coverWrappedKey,
    manifestJson,
    title: args.title,
    sortTitle: args.sortTitle ?? null,
    year: args.year ?? null,
    durationMs: args.durationMs ?? null,
    sizeBytes: args.bytes.length,
    mimeType: args.mimeType ?? null,
    metadataJson,
    metadataSource: args.metadataSource ?? 'local',
    updatedAt: options.now,
  });
  insertSignedRow(db, CM_LIBRARY_ITEMS_TABLE, item.id, libraryItemEventToRow(item), options.recordChange);
  return { item, deduped };
}

/** Validate metadata for a media type; returns false only on a hard invalid (unknown type is OK). */
function validateForType(mediaType: KnownMediaType, metadataJson: string): boolean {
  const parse = validateLibraryItemMetadata(mediaType, metadataJson);
  return parse.status !== 'invalid';
}

/** Raw parsed (unverified) items of one workspace -- dedup + tombstone-refcount use this. */
function listRawWorkspaceItems(db: DatabaseAdapter, workspaceId: string): LibraryItemEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARY_ITEMS_TABLE} WHERE community_id = ?`,
    [workspaceId],
  );
  const out: LibraryItemEvent[] = [];
  for (const row of rows) {
    const event = libraryItemEventFromRow(row);
    // Dedup/refcount honesty: only trust rows whose signature verifies.
    if (event && verifyLibraryItemEvent(event)) out.push(event);
  }
  return out;
}

/** The verified-only item read model for a library channel. */
export function listLibraryItems(db: DatabaseAdapter, channelId: string): ResolvedLibraryItem[] {
  const config = getLibrary(db, channelId);
  if (!config) return [];
  const ctx = libraryWorkspaceContext(db, config.communityId);
  if (!ctx) return [];
  const allowed = authorAllowedPredicate(db, ctx, channelId);
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARY_ITEMS_TABLE} WHERE channel_id = ?`,
    [channelId],
  );
  const events: LibraryItemEvent[] = [];
  for (const row of rows) {
    const event = libraryItemEventFromRow(row);
    if (event) events.push(event);
  }
  return resolveVerifiedLibraryItems(events, config.mediaType, allowed);
}

/** The winning verified item by id, or null (used for tombstone + open). */
export function getLibraryItem(db: DatabaseAdapter, itemId: string): LibraryItemEvent | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARY_ITEMS_TABLE} WHERE id = ? LIMIT 1`,
    [itemId],
  );
  const row = rows[0];
  if (!row) return null;
  const event = libraryItemEventFromRow(row);
  if (!event || !verifyLibraryItemEvent(event)) return null;
  return event;
}

/**
 * Open a verified item's content bytes from the local store. Null when this
 * device cannot unwrap the epoch (not a member / pre-join) or the sealed blocks
 * are not local yet -- the caller shows the honest fetch/locked state, never a
 * fake buffer. Verification binds the sealed object to the item author.
 */
/**
 * Whether this device actually holds the item's sealed content blocks (Plan 38
 * Phase 7, transport honesty). Reads the sealedChunkIds off the signed manifest
 * and confirms every block is present in the local node store. A community item
 * whose blocks have not arrived yet returns false, so the UI can say plainly that
 * it will come from a member on the next sync -- never claim a local copy that is
 * not here. Total: a malformed manifest or a missing block yields false.
 */
export async function isLibraryItemContentHeld(store: NodeStore, item: LibraryItemEvent): Promise<boolean> {
  if (item.tombstone) return false;
  let sealedChunkIds: unknown;
  try {
    sealedChunkIds = (JSON.parse(item.manifestJson) as { sealedChunkIds?: unknown }).sealedChunkIds;
  } catch {
    return false;
  }
  if (!Array.isArray(sealedChunkIds) || sealedChunkIds.length === 0) return false;
  for (const id of sealedChunkIds) {
    if (typeof id !== 'string') return false;
    if (!(await store.hasBlock(id))) return false;
  }
  return true;
}

export async function openLibraryItemContent(
  db: DatabaseAdapter,
  store: NodeStore,
  identity: DeviceIdentity,
  item: LibraryItemEvent,
): Promise<Uint8Array | null> {
  if (item.tombstone) return null;
  const dek = unwrapLibraryObjectKeyForDevice(
    db, identity, item.communityId, item.keyEpoch, item.wrappedKey,
  );
  if (!dek) return null;
  try {
    const result = await fetchFromStore(
      store, item.contentCid, dek, { expectedAuthor: item.authorDeviceId }, item.communityId,
    );
    return result.ok ? result.content : null;
  } finally {
    dek.fill(0);
  }
}

export interface TombstoneLibraryItemOptions {
  recordChange?: RecordKeyWrapChange;
  now?: string;
}

/**
 * Tombstone an item (author or a curator). Re-signs the SAME item id as a
 * tombstone (LWW wins), then unpins the sealed blocks ONLY when NO other
 * non-tombstoned item in the workspace still references the same content id
 * (refcounted unpin). A dedup-shared blob survives until its last referrer goes.
 */
export async function tombstoneLibraryItem(
  db: DatabaseAdapter,
  store: NodeStore,
  actor: DeviceIdentity,
  itemId: string,
  options: TombstoneLibraryItemOptions = {},
): Promise<LibraryItemEvent | null> {
  const item = getLibraryItem(db, itemId);
  if (!item) return null;
  const ctx = libraryWorkspaceContext(db, item.communityId);
  if (!ctx) return null;
  const allowed = authorAllowedPredicate(db, ctx, item.channelId);
  const isAuthor = item.authorDeviceId === actor.publicKey;
  if (!isAuthor && !allowed(actor.publicKey)) {
    throw new Error('You are not allowed to remove this item.');
  }
  const tomb = createLibraryItemEvent(actor, {
    id: item.id,
    communityId: item.communityId,
    channelId: item.channelId,
    contentCid: item.contentCid,
    coverCid: item.coverCid,
    thumbCid: item.thumbCid,
    keyEpoch: item.keyEpoch,
    wrappedKey: item.wrappedKey,
    coverWrappedKey: item.coverWrappedKey,
    manifestJson: item.manifestJson,
    title: item.title,
    metadataJson: item.metadataJson,
    metadataSource: item.metadataSource,
    tombstone: true,
    updatedAt: options.now,
  });
  insertSignedRow(db, CM_LIBRARY_ITEMS_TABLE, tomb.id, libraryItemEventToRow(tomb), options.recordChange);

  // Refcounted unpin: is the content still referenced by a live item?
  const stillReferenced = listRawWorkspaceItems(db, item.communityId)
    .some((other) => !other.tombstone && other.contentCid === item.contentCid);
  if (!stillReferenced) {
    await unpinShare(store, item.contentCid, item.communityId);
    if (item.coverCid) {
      const coverStillReferenced = listRawWorkspaceItems(db, item.communityId)
        .some((other) => !other.tombstone && other.coverCid === item.coverCid);
      if (!coverStillReferenced) await unpinShare(store, item.coverCid, item.communityId);
    }
  }
  return tomb;
}

// ---------------------------------------------------------------------------
// Collections + membership + smart rules.
// ---------------------------------------------------------------------------

export function createLibraryCollection(
  db: DatabaseAdapter,
  actor: DeviceIdentity,
  args: { channelId: string; workspaceId: string; name: string; pinned?: boolean },
  options: { recordChange?: RecordKeyWrapChange; now?: string } = {},
): LibraryCollectionEvent {
  requireCurator(db, actor, args.workspaceId, args.channelId);
  const event = createLibraryCollectionEvent(actor, {
    communityId: args.workspaceId,
    channelId: args.channelId,
    name: args.name,
    pinned: args.pinned,
    updatedAt: options.now,
  });
  insertSignedRow(db, CM_LIBRARY_COLLECTIONS_TABLE, event.id, libraryCollectionEventToRow(event), options.recordChange);
  return event;
}

export function listLibraryCollections(db: DatabaseAdapter, channelId: string): LibraryCollectionEvent[] {
  const config = getLibrary(db, channelId);
  if (!config) return [];
  const ctx = libraryWorkspaceContext(db, config.communityId);
  if (!ctx) return [];
  const allowed = authorAllowedPredicate(db, ctx, channelId);
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARY_COLLECTIONS_TABLE} WHERE channel_id = ?`,
    [channelId],
  );
  const events: LibraryCollectionEvent[] = [];
  for (const row of rows) {
    const event = libraryCollectionEventFromRow(row);
    if (event) events.push(event);
  }
  return resolveVerifiedCollections(events, allowed);
}

export function addItemToCollection(
  db: DatabaseAdapter,
  actor: DeviceIdentity,
  args: { channelId: string; workspaceId: string; collectionId: string; itemId: string },
  options: { recordChange?: RecordKeyWrapChange; now?: string } = {},
): CollectionItemEvent {
  requireCurator(db, actor, args.workspaceId, args.channelId);
  const event = createCollectionItemEvent(actor, {
    communityId: args.workspaceId,
    channelId: args.channelId,
    collectionId: args.collectionId,
    itemId: args.itemId,
    updatedAt: options.now,
  });
  insertSignedRow(db, CM_LIBRARY_COLLECTION_ITEMS_TABLE, event.id, collectionItemEventToRow(event), options.recordChange);
  return event;
}

export function listCollectionItemIds(db: DatabaseAdapter, channelId: string, collectionId: string): string[] {
  const config = getLibrary(db, channelId);
  if (!config) return [];
  const ctx = libraryWorkspaceContext(db, config.communityId);
  if (!ctx) return [];
  const allowed = authorAllowedPredicate(db, ctx, channelId);
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARY_COLLECTION_ITEMS_TABLE} WHERE channel_id = ? AND collection_id = ?`,
    [channelId, collectionId],
  );
  const events: CollectionItemEvent[] = [];
  for (const row of rows) {
    const event = collectionItemEventFromRow(row);
    if (event) events.push(event);
  }
  return resolveVerifiedCollectionItemIds(events, collectionId, allowed);
}

export function createSmartRule(
  db: DatabaseAdapter,
  actor: DeviceIdentity,
  args: { channelId: string; workspaceId: string; collectionId: string; ruleType: string; rule: Record<string, unknown> },
  options: { recordChange?: RecordKeyWrapChange; now?: string } = {},
): SmartRuleEvent {
  requireCurator(db, actor, args.workspaceId, args.channelId);
  const event = createSmartRuleEvent(actor, {
    communityId: args.workspaceId,
    channelId: args.channelId,
    collectionId: args.collectionId,
    ruleType: args.ruleType,
    ruleJson: JSON.stringify(args.rule ?? {}),
    updatedAt: options.now,
  });
  insertSignedRow(db, CM_LIBRARY_SMART_RULES_TABLE, event.id, smartRuleEventToRow(event), options.recordChange);
  return event;
}

export function listSmartRules(db: DatabaseAdapter, channelId: string, collectionId: string): SmartRuleEvent[] {
  const config = getLibrary(db, channelId);
  if (!config) return [];
  const ctx = libraryWorkspaceContext(db, config.communityId);
  if (!ctx) return [];
  const allowed = authorAllowedPredicate(db, ctx, channelId);
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARY_SMART_RULES_TABLE} WHERE channel_id = ? AND collection_id = ?`,
    [channelId, collectionId],
  );
  const events: SmartRuleEvent[] = [];
  for (const row of rows) {
    const event = smartRuleEventFromRow(row);
    if (event) events.push(event);
  }
  return resolveVerifiedSmartRules(events, collectionId, allowed);
}

// ---------------------------------------------------------------------------
// Tags (add-only signed set).
// ---------------------------------------------------------------------------

export function addLibraryItemTag(
  db: DatabaseAdapter,
  actor: DeviceIdentity,
  args: { channelId: string; workspaceId: string; itemId: string; tag: string },
  options: { recordChange?: RecordKeyWrapChange; now?: string } = {},
): LibraryTagEvent {
  requireCurator(db, actor, args.workspaceId, args.channelId);
  const event = createLibraryTagEvent(actor, {
    itemId: args.itemId,
    communityId: args.workspaceId,
    channelId: args.channelId,
    tag: args.tag,
    ...(options.now ? { addedWall: options.now } : {}),
  });
  const row = libraryTagEventToRow(event);
  insertSignedRow(db, CM_LIBRARY_TAGS_TABLE, `${event.itemId}:${event.tag}`, row, options.recordChange);
  return event;
}

export function listLibraryItemTags(db: DatabaseAdapter, channelId: string, itemId: string): string[] {
  const config = getLibrary(db, channelId);
  if (!config) return [];
  const ctx = libraryWorkspaceContext(db, config.communityId);
  if (!ctx) return [];
  const allowed = authorAllowedPredicate(db, ctx, channelId);
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARY_TAGS_TABLE} WHERE channel_id = ? AND item_id = ?`,
    [channelId, itemId],
  );
  const events: LibraryTagEvent[] = [];
  for (const row of rows) {
    const event = libraryTagEventFromRow(row);
    if (event) events.push(event);
  }
  return resolveVerifiedTagsForItem(events, itemId, allowed);
}

/** Curator gate shared by the write paths: author must be allowed to write here. */
function requireCurator(db: DatabaseAdapter, actor: DeviceIdentity, workspaceId: string, channelId: string): void {
  const ctx = libraryWorkspaceContext(db, workspaceId);
  if (!ctx) throw new Error('That workspace is not on this device.');
  const allowed = authorAllowedPredicate(db, ctx, channelId);
  if (!allowed(actor.publicKey)) throw new Error('You are not allowed to curate this library.');
}

// ---------------------------------------------------------------------------
// Progress (personal_replica: your own paired devices only; never a community).
// ---------------------------------------------------------------------------

export interface LibraryProgress {
  positionMs: number;
  completed: boolean;
  updatedAt: string;
}

export function getLibraryProgress(db: DatabaseAdapter, itemId: string): LibraryProgress | null {
  const rows = db.query<{ position_ms: number; completed: number; updated_at: string }>(
    `SELECT position_ms, completed, updated_at FROM ${CM_LIBRARY_PROGRESS_TABLE} WHERE id = ? LIMIT 1`,
    [itemId],
  );
  const row = rows[0];
  if (!row) return null;
  return { positionMs: row.position_ms, completed: row.completed === 1, updatedAt: row.updated_at };
}

export function setLibraryProgress(
  db: DatabaseAdapter,
  itemId: string,
  args: { positionMs: number; completed?: boolean; communityId?: string | null; now?: string },
  recordChange?: RecordKeyWrapChange,
): void {
  const updatedAt = args.now ?? new Date().toISOString();
  const row = {
    id: itemId,
    community_id: args.communityId ?? null,
    position_ms: Math.max(0, Math.floor(args.positionMs)),
    completed: args.completed ? 1 : 0,
    updated_at: updatedAt,
  };
  insertSignedRow(db, CM_LIBRARY_PROGRESS_TABLE, itemId, row, recordChange);
}

// ---------------------------------------------------------------------------
// Ingestion adapters (data-level; the UI wave calls these).
// ---------------------------------------------------------------------------

export interface IngestBaseArgs {
  channelId: string;
  workspaceId: string;
  title: string;
  mimeType?: string | null;
  metadata?: Record<string, unknown>;
  metadataSource?: string;
  /** Original file name; drives local filename extraction when no metadata is passed. */
  fileName?: string;
  /** Per-contributor location consent (D.7). Absent/false strips EXIF GPS at ingest. */
  preserveLocation?: boolean;
}

/** Ingest options that also carry the container/ID3 probe seam (injectable for tests). */
export interface LibraryIngestOptions extends AddLibraryItemOptions {
  /** Container/ID3 probe (defaults to the per-surface seam; null-safe, Expo-Go safe). */
  probe?: ProbeContainerFn;
}

/** The local-extraction result folded into the fields addLibraryItem consumes. */
interface ResolvedIngestMetadata {
  bytes: Uint8Array;
  title: string;
  sortTitle: string | null;
  year: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  metadataSource: string;
  gpsStripped: boolean;
}

/**
 * Run local metadata extraction for an intake path (design decision 5: never
 * contacts the network). When the caller passes EXPLICIT metadata it is honored
 * verbatim with no extraction and no byte rewrite; otherwise the filename parser,
 * optional NFO sidecar, and JPEG EXIF reader compose usable metadata, the photo
 * GPS strip may rewrite the bytes (unless preserveLocation), and the container
 * probe seam gap-fills duration/dimensions when a native prober is present.
 */
async function resolveLocalIngestMetadata(
  db: DatabaseAdapter,
  channelId: string,
  input: {
    bytes: Uint8Array;
    fileName: string;
    title?: string | null;
    mimeType?: string | null;
    explicitMetadata?: Record<string, unknown>;
    explicitMetadataSource?: string;
    preserveLocation?: boolean;
    nfoText?: string | null;
  },
  probe: ProbeContainerFn,
): Promise<ResolvedIngestMetadata> {
  const config = getLibrary(db, channelId);
  const mediaType = config?.mediaType ?? 'custom';
  if (input.explicitMetadata !== undefined) {
    const title = input.title && input.title.trim() ? input.title.trim() : deriveTitleFromFilename(input.fileName);
    return {
      bytes: input.bytes,
      title,
      sortTitle: null,
      year: null,
      durationMs: null,
      metadata: input.explicitMetadata,
      metadataSource: input.explicitMetadataSource ?? 'local',
      gpsStripped: false,
    };
  }
  const local = extractLocalMetadata({
    fileName: input.fileName,
    bytes: input.bytes,
    mediaType,
    preserveLocation: input.preserveLocation ?? false,
    nfoText: input.nfoText ?? null,
  });
  const metadata: Record<string, unknown> = { ...local.metadata };
  let durationMs = local.durationMs;
  try {
    const probed = await probe(input.bytes, input.mimeType ?? null);
    if (probed) {
      if (durationMs === null && typeof probed.durationMs === 'number') durationMs = probed.durationMs;
      if (metadata.width === undefined && typeof probed.width === 'number') metadata.width = probed.width;
      if (metadata.height === undefined && typeof probed.height === 'number') metadata.height = probed.height;
      if (metadata.artist === undefined && typeof probed.artist === 'string') metadata.artist = probed.artist;
      if (metadata.album === undefined && typeof probed.album === 'string') metadata.album = probed.album;
      if (metadata.trackNumber === undefined && typeof probed.trackNumber === 'number') metadata.trackNumber = probed.trackNumber;
    }
  } catch {
    // A probe failure is non-fatal: local extraction already returned usable metadata.
  }
  const title = input.title && input.title.trim() ? input.title.trim() : local.title;
  return {
    bytes: local.rewrittenBytes ?? input.bytes,
    title,
    sortTitle: local.sortTitle,
    year: local.year,
    durationMs,
    metadata,
    metadataSource: local.metadataSource,
    gpsStripped: local.gpsStripped,
  };
}

/** File picker: bytes are already in hand. Local extraction runs when no metadata is passed. */
export async function ingestFromFilePicker(
  db: DatabaseAdapter,
  store: NodeStore,
  actor: DeviceIdentity,
  args: IngestBaseArgs & { bytes: Uint8Array; coverBytes?: Uint8Array | null; nfoText?: string | null },
  options: LibraryIngestOptions = {},
): Promise<AddLibraryItemResult> {
  const resolved = await resolveLocalIngestMetadata(db, args.channelId, {
    bytes: args.bytes,
    fileName: args.fileName ?? args.title,
    title: args.title,
    mimeType: args.mimeType,
    explicitMetadata: args.metadata,
    explicitMetadataSource: args.metadataSource,
    preserveLocation: args.preserveLocation,
    nfoText: args.nfoText,
  }, options.probe ?? probeContainer);
  return addLibraryItem(db, store, actor, {
    channelId: args.channelId,
    workspaceId: args.workspaceId,
    bytes: resolved.bytes,
    title: resolved.title,
    mimeType: args.mimeType,
    sortTitle: resolved.sortTitle,
    year: resolved.year,
    durationMs: resolved.durationMs,
    metadata: resolved.metadata,
    metadataSource: resolved.metadataSource,
    coverBytes: args.coverBytes,
  }, options);
}

/** A per-surface reader for plaintext bytes held in the surface's blob store. */
export type ReadBlobBytes = (blobHash: string) => Promise<Uint8Array | null>;

/**
 * OS share intake: consume a staged mk_share_intake payload (bytes live in the
 * blob store, keyed by blob_hash) and seal it as a library item. The intake row
 * is then marked routed to the library channel (the library item is the source
 * of truth, not mk_share_intake.status).
 */
export async function ingestFromShareIntake(
  db: DatabaseAdapter,
  store: NodeStore,
  actor: DeviceIdentity,
  args: { intakeId: string; channelId: string; workspaceId: string; title?: string; metadata?: Record<string, unknown>; preserveLocation?: boolean },
  readBlob: ReadBlobBytes,
  options: LibraryIngestOptions = {},
): Promise<AddLibraryItemResult> {
  const payloads = getSharePayloads(db, args.intakeId);
  const filePayload = payloads.find((p) => p.blob_hash);
  if (!filePayload || !filePayload.blob_hash) {
    throw new Error('That shared item has no file to add to a library.');
  }
  const bytes = await readBlob(filePayload.blob_hash);
  if (!bytes) throw new Error('The shared file is not available on this device.');
  const resolved = await resolveLocalIngestMetadata(db, args.channelId, {
    bytes,
    fileName: args.title ?? filePayload.filename ?? 'Untitled',
    title: args.title,
    mimeType: filePayload.mime,
    explicitMetadata: args.metadata,
    preserveLocation: args.preserveLocation,
  }, options.probe ?? probeContainer);
  const result = await addLibraryItem(db, store, actor, {
    channelId: args.channelId,
    workspaceId: args.workspaceId,
    bytes: resolved.bytes,
    title: resolved.title,
    mimeType: filePayload.mime,
    sortTitle: resolved.sortTitle,
    year: resolved.year,
    durationMs: resolved.durationMs,
    metadata: resolved.metadata,
    metadataSource: resolved.metadataSource,
  }, options);
  routeShareIntake(db, args.intakeId, 'channel', args.channelId);
  return result;
}

/**
 * Promote a plaintext channel attachment (the Model-A raw blob store) into a
 * sealed library item -- the ONLY path from a plaintext attachment blob into a
 * sealed library object.
 */
export async function promoteChannelFile(
  db: DatabaseAdapter,
  store: NodeStore,
  actor: DeviceIdentity,
  args: { blobHash: string; channelId: string; workspaceId: string; title: string; fileName?: string; mimeType?: string | null; metadata?: Record<string, unknown>; preserveLocation?: boolean },
  readBlob: ReadBlobBytes,
  options: LibraryIngestOptions = {},
): Promise<AddLibraryItemResult> {
  const bytes = await readBlob(args.blobHash);
  if (!bytes) throw new Error('That file is not available on this device.');
  const resolved = await resolveLocalIngestMetadata(db, args.channelId, {
    bytes,
    fileName: args.fileName ?? args.title,
    title: args.title,
    mimeType: args.mimeType,
    explicitMetadata: args.metadata,
    preserveLocation: args.preserveLocation,
  }, options.probe ?? probeContainer);
  return addLibraryItem(db, store, actor, {
    channelId: args.channelId,
    workspaceId: args.workspaceId,
    bytes: resolved.bytes,
    title: resolved.title,
    mimeType: args.mimeType,
    sortTitle: resolved.sortTitle,
    year: resolved.year,
    durationMs: resolved.durationMs,
    metadata: resolved.metadata,
    metadataSource: resolved.metadataSource,
  }, options);
}

// ---------------------------------------------------------------------------
// Enrichment provider config (BYO-key, amendment D.8): curator-side ONLY, stored
// device-local in mk_settings. The pure query/parse of a provider lives in
// library-enrich-core; this is only the local key store the guided setup sheet
// reads and writes. The mk_settings SQL is inlined (not routed through the db
// helper module) so the store stays a byte-identical twin across both surfaces.
// ---------------------------------------------------------------------------

/** Which providers have a curator key configured on THIS device (never synced). */
export interface EnrichmentProviderConfig {
  provider: EnrichmentProvider;
  hasKey: boolean;
}

function readMkSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string | null }>('SELECT value FROM mk_settings WHERE key = ? LIMIT 1', [key]);
  return rows[0]?.value ?? null;
}

function writeMkSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute('INSERT OR REPLACE INTO mk_settings (key, value) VALUES (?, ?)', [key, value]);
}

/** The configured key for a provider (device-local), or null. */
export function getEnrichmentProviderKey(db: DatabaseAdapter, provider: EnrichmentProvider): string | null {
  if (!isEnrichmentProvider(provider)) return null;
  const value = readMkSetting(db, enrichmentProviderKeySettingKey(provider));
  return value && value.length > 0 ? value : null;
}

/** Set (or clear, with an empty string) a provider's curator key. Device-local only. */
export function setEnrichmentProviderKey(db: DatabaseAdapter, provider: EnrichmentProvider, key: string): void {
  if (!isEnrichmentProvider(provider)) throw new Error('Unknown enrichment provider.');
  writeMkSetting(db, enrichmentProviderKeySettingKey(provider), key.trim());
}

/** The curator-side enrichment config: per provider, whether a key is set here. */
export function getEnrichmentProviderConfig(db: DatabaseAdapter): EnrichmentProviderConfig[] {
  return ENRICHMENT_PROVIDERS.map((provider) => ({
    provider,
    hasKey: getEnrichmentProviderKey(db, provider) !== null,
  }));
}

// ===========================================================================
// Plan 38 C.7: pin-class taxonomy + per-library pin policy + device-wide storage
// budget + LRU eviction + last-copy honesty. All state here is DEVICE-LOCAL (mk_
// prefix / mk_pinned, outside MEERKAT_SYNC_PREFIXES) and never replicates: a
// member's storage arrangement is their own. The pure decision logic (eviction,
// budget parse, class summary) lives in library-storage-core.ts; this is the glue
// to the node store + mk_settings + the cm_library_items read model.
// ===========================================================================

/** A store that both seeds blocks and supports the C.7 pin-class/LRU surface. */
type LibraryStore = NodeStore & LibraryPinStore;

// The C.7 device-local DDL (mk_library_pin_policy, mk_library_kept) and the
// mk_pinned.last_used column live in the schema bootstrap (db.ts /schema.ts)
// alongside every other mk_ table, so there is no import cycle back into the
// schema module. This glue only reads/writes those tables.

// --- Per-library pin policy ------------------------------------------------

/**
 * This library's pin policy. Default depends on kind (the honest phone-friendly
 * default): personal libraries pin_all (your own files always stay), community
 * libraries fetch_on_demand (a big shared library must not brick a small phone).
 */
export function getLibraryPinPolicy(db: DatabaseAdapter, channelId: string): LibraryPinPolicy {
  const rows = db.query<{ policy: string }>(
    `SELECT policy FROM mk_library_pin_policy WHERE library_id = ? LIMIT 1`,
    [channelId],
  );
  const raw = rows[0]?.policy;
  if (raw === 'pin_all' || raw === 'fetch_on_demand') return raw;
  const config = getLibrary(db, channelId);
  if (!config) return 'pin_all';
  const ctx = libraryWorkspaceContext(db, config.communityId);
  return ctx?.kind === 'community' ? 'fetch_on_demand' : 'pin_all';
}

function writeLibraryPinPolicy(db: DatabaseAdapter, channelId: string, policy: LibraryPinPolicy, now: string): void {
  db.execute(
    `INSERT OR REPLACE INTO mk_library_pin_policy (library_id, policy, updated_at) VALUES (?, ?, ?)`,
    [channelId, policy, now],
  );
}

// --- Device storage budget -------------------------------------------------

/** The device-wide library storage budget in bytes, or null for unlimited. */
export function getStorageBudgetBytes(db: DatabaseAdapter): number | null {
  return parseStorageBudget(readMkSetting(db, LIBRARY_STORAGE_BUDGET_SETTING_KEY));
}

/**
 * Set the device storage budget and immediately reconcile: evict fetch_cache
 * (LRU) down to the new budget. Returns the plan so the caller can surface the
 * honest "kept items exceed the budget" error when the fit is impossible.
 */
export async function setStorageBudget(
  db: DatabaseAdapter,
  store: LibraryStore,
  bytes: number | null,
  now: string = new Date().toISOString(),
): Promise<EvictionPlan> {
  writeMkSetting(db, LIBRARY_STORAGE_BUDGET_SETTING_KEY, serializeStorageBudget(bytes));
  return runLibraryEviction(db, store, now);
}

// --- Explicit keep marker (device-local intent, distinct from pin_class) -----

function isLibraryItemKept(db: DatabaseAdapter, contentId: string, context: string): boolean {
  const rows = db.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM mk_library_kept WHERE content_id = ? AND pin_context = ?`,
    [contentId, context],
  );
  return (rows[0]?.c ?? 0) > 0;
}

function markLibraryItemKept(db: DatabaseAdapter, contentId: string, context: string, now: string): void {
  db.execute(
    `INSERT OR REPLACE INTO mk_library_kept (content_id, pin_context, updated_at) VALUES (?, ?, ?)`,
    [contentId, context, now],
  );
}

function unmarkLibraryItemKept(db: DatabaseAdapter, contentId: string, context: string): void {
  db.execute(`DELETE FROM mk_library_kept WHERE content_id = ? AND pin_context = ?`, [contentId, context]);
}

// --- Pin-class reconcile (authoritative, avoids the engine receive default) ---

/**
 * Bring a held item's pin class in line with intent, so fetch_cache/policy are
 * assigned regardless of what class the receive path pinned it as. authored is
 * left untouched (this device made it); a user "kept" item stays explicit; any
 * other held item follows its library policy (pin_all -> policy, fetch_on_demand
 * -> fetch_cache). Not-held items are ignored.
 */
export async function reconcileLibraryItemPinClass(
  db: DatabaseAdapter,
  store: LibraryStore,
  item: LibraryItemEvent,
): Promise<void> {
  if (item.tombstone) return;
  const manifest = await store.getManifest(item.contentCid, item.communityId);
  if (!manifest) return;
  if (manifest.pinClass === 'authored') return;
  if (isLibraryItemKept(db, item.contentCid, item.communityId)) {
    if (manifest.pinClass !== 'explicit') await store.setPinClass(item.contentCid, item.communityId, 'explicit');
    return;
  }
  const target: PinClass =
    getLibraryPinPolicy(db, item.channelId) === 'pin_all' ? 'policy' : 'fetch_cache';
  if (manifest.pinClass !== target) await store.setPinClass(item.contentCid, item.communityId, target);
}

/** Reconcile every verified item of a library channel (called on library open). */
export async function reconcileLibraryPinClasses(
  db: DatabaseAdapter,
  store: LibraryStore,
  channelId: string,
): Promise<void> {
  for (const item of listRawChannelItems(db, channelId)) {
    await reconcileLibraryItemPinClass(db, store, item);
  }
}

// --- "Keep on this device" toggle (explicit pin / device-local release) ------

export interface LibraryItemPinInfo {
  held: boolean;
  pinClass: PinClass | null;
  kept: boolean;
}

/** The real held/class/kept state for the item detail toggle (store query, never a guess). */
export async function getLibraryItemPinInfo(
  db: DatabaseAdapter,
  store: LibraryStore,
  item: LibraryItemEvent,
): Promise<LibraryItemPinInfo> {
  const manifest = await store.getManifest(item.contentCid, item.communityId);
  return {
    held: !!manifest,
    pinClass: manifest?.pinClass ?? null,
    kept: isLibraryItemKept(db, item.contentCid, item.communityId),
  };
}

/**
 * "Keep on this device" ON: mark the item kept and protect its class from LRU
 * eviction (explicit), unless it is your own authored copy (already permanent).
 * Only works on content already held on this device; there is no always-on fetch.
 */
export async function keepLibraryItemOnDevice(
  db: DatabaseAdapter,
  store: LibraryStore,
  item: LibraryItemEvent,
  now: string = new Date().toISOString(),
): Promise<void> {
  const manifest = await store.getManifest(item.contentCid, item.communityId);
  if (!manifest) throw new Error('This item is not on this device yet.');
  markLibraryItemKept(db, item.contentCid, item.communityId, now);
  if (manifest.pinClass !== 'authored') {
    await store.setPinClass(item.contentCid, item.communityId, 'explicit');
  }
}

/**
 * "Keep on this device" OFF / remove copy: unmark kept and unpin THIS device's
 * copy of the content (and its cover) when no other live item still references it
 * (dedup refcount, same rule as tombstone). DEVICE-LOCAL: the item metadata row
 * stays; only this device's bytes go. The caller MUST show LAST_COPY_DELETE_CONFIRM
 * first -- Meerkat cannot know if other members still hold the file.
 */
export async function releaseLibraryItemFromDevice(
  db: DatabaseAdapter,
  store: LibraryStore,
  item: LibraryItemEvent,
): Promise<void> {
  unmarkLibraryItemKept(db, item.contentCid, item.communityId);
  const stillReferenced = listRawWorkspaceItems(db, item.communityId)
    .some((other) => !other.tombstone && other.id !== item.id && other.contentCid === item.contentCid);
  if (!stillReferenced) {
    await unpinShare(store, item.contentCid, item.communityId);
    if (item.coverCid) {
      const coverStillReferenced = listRawWorkspaceItems(db, item.communityId)
        .some((other) => !other.tombstone && other.coverCid === item.coverCid);
      if (!coverStillReferenced) await unpinShare(store, item.coverCid, item.communityId);
    }
  }
}

// --- Library policy flip (protect on pin_all, release on fetch_on_demand) -----

/**
 * Change a library's pin policy and reconcile this device's copies:
 *   - pin_all: promote the library's held cache pins to 'policy' (protected). If
 *     that would push the protected classes past the budget the flip is REFUSED
 *     with the honest STORAGE_BUDGET_EXCEEDED_ERROR (nothing is changed).
 *   - fetch_on_demand: this is the ONE case that evicts 'policy' blocks -- the
 *     library's non-authored, non-kept copies are dropped from this device. The
 *     caller shows LAST_COPY_DELETE_CONFIRM first.
 * Returns the post-change eviction plan.
 */
export async function applyLibraryPinPolicy(
  db: DatabaseAdapter,
  store: LibraryStore,
  channelId: string,
  policy: LibraryPinPolicy,
  now: string = new Date().toISOString(),
): Promise<EvictionPlan> {
  const config = getLibrary(db, channelId);
  if (!config) throw new Error('That library is not on this device.');
  const workspaceId = config.communityId;
  const items = listRawChannelItems(db, channelId);

  if (policy === 'pin_all') {
    const budget = getStorageBudgetBytes(db);
    const promote = new Set<string>();
    for (const item of items) {
      const manifest = await store.getManifest(item.contentCid, workspaceId);
      if (manifest && manifest.pinClass === 'fetch_cache') promote.add(pinKey(item.contentCid, workspaceId));
    }
    if (wouldExceedBudget({ pins: await store.listStoredPins(), budgetBytes: budget, promote })) {
      throw new Error(STORAGE_BUDGET_EXCEEDED_ERROR);
    }
    writeLibraryPinPolicy(db, channelId, policy, now);
    for (const item of items) {
      const manifest = await store.getManifest(item.contentCid, workspaceId);
      if (manifest && manifest.pinClass === 'fetch_cache') {
        await store.setPinClass(item.contentCid, workspaceId, 'policy');
      }
    }
    return runLibraryEviction(db, store, now);
  }

  // fetch_on_demand: drop this device's non-authored, non-kept copies now.
  writeLibraryPinPolicy(db, channelId, policy, now);
  for (const item of items) {
    if (isLibraryItemKept(db, item.contentCid, workspaceId)) continue;
    const manifest = await store.getManifest(item.contentCid, workspaceId);
    if (!manifest || manifest.pinClass === 'authored' || manifest.pinClass === 'explicit') continue;
    await releaseLibraryItemFromDevice(db, store, item);
  }
  return runLibraryEviction(db, store, now);
}

// --- Eviction runner -------------------------------------------------------

/**
 * Reconcile the store against the device budget: evict fetch_cache LRU-first
 * until under budget. Run opportunistically after fetches and on any budget or
 * policy change. Returns the plan (impossible=true when protected classes alone
 * exceed the budget, so the caller can surface the honest error).
 */
export async function runLibraryEviction(
  db: DatabaseAdapter,
  store: LibraryStore,
  _now: string = new Date().toISOString(),
): Promise<EvictionPlan> {
  const budgetBytes = getStorageBudgetBytes(db);
  const pins = await store.listStoredPins();
  const plan = evictToBudget({ pins, budgetBytes });
  for (const ref of plan.evict) {
    await unpinShare(store, ref.contentId, ref.context);
  }
  return plan;
}

/**
 * Record that library content was just used (opened / played) so LRU keeps the
 * freshest fetch_cache. A no-op on content not held here.
 */
export async function touchLibraryItemUse(
  store: LibraryStore,
  item: LibraryItemEvent,
  now: string = new Date().toISOString(),
): Promise<void> {
  await store.touchPin(item.contentCid, item.communityId, now);
}

// --- Stats card (C.2) + device meter --------------------------------------

export interface LibraryStorageStats {
  itemCount: number;
  /** Sum of signed size_bytes across verified items (LOGICAL bytes). */
  logicalBytes: number;
  /** Physical stored bytes for this workspace context (deduped per content id). */
  storedBytes: number;
}

/** The per-library stats card numbers (C.2): all from verified rows + real store stats. */
export async function libraryStorageStats(
  db: DatabaseAdapter,
  store: LibraryStore,
  channelId: string,
): Promise<LibraryStorageStats> {
  const config = getLibrary(db, channelId);
  if (!config) return { itemCount: 0, logicalBytes: 0, storedBytes: 0 };
  const items = listLibraryItems(db, channelId);
  const logicalBytes = items.reduce((sum, i) => sum + (i.event.sizeBytes ?? 0), 0);
  const storedBytes = await store.contextStoredBytes(config.communityId);
  return { itemCount: items.length, logicalBytes, storedBytes };
}

export interface DeviceStorageMeter {
  budgetBytes: number | null;
  storedBytes: number;
  breakdown: Record<PinClass, { count: number; bytes: number }>;
}

/** The device-wide storage meter for Settings: budget, total stored, per-class. */
export async function deviceStorageMeter(
  db: DatabaseAdapter,
  store: LibraryStore,
): Promise<DeviceStorageMeter> {
  const stats = await store.stats();
  return {
    budgetBytes: getStorageBudgetBytes(db),
    storedBytes: stats.totalBytes,
    breakdown: await store.classBreakdown(),
  };
}

/** Raw verified items of one library channel (channel-scoped counterpart of listRawWorkspaceItems). */
function listRawChannelItems(db: DatabaseAdapter, channelId: string): LibraryItemEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_LIBRARY_ITEMS_TABLE} WHERE channel_id = ?`,
    [channelId],
  );
  const out: LibraryItemEvent[] = [];
  for (const row of rows) {
    const event = libraryItemEventFromRow(row);
    if (event && verifyLibraryItemEvent(event)) out.push(event);
  }
  return out;
}
