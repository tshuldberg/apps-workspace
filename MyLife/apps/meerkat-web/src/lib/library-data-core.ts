// Plan 38 Phase 3: the pure library data model -- signed row types + their
// sign/verify/serialize logic and the verified-only read-model resolvers. This
// is the WEB twin of apps/meerkat/app/(root)/data/library-data-core.ts (the
// mobile source of truth); the two are byte-identical below this header,
// parity-locked by scripts/check-meerkat-parity.mjs.
//
// This module owns the SIGNING and VERIFICATION for the library layer and owns
// NO storage and NO transport. It mirrors community-identity.ts: every row type
// carries a domain-tagged canonical form, is signed by its author, and is
// verified fail-closed at read time (an unverifiable row renders NOTHING). The
// db + node-store orchestration (createLibrary, addLibraryItem, ...) lives in
// the per-surface glue (community-core.ts / meerkat-data.ts) and calls into
// these pure functions.
//
// Row-author rules (enforced by the glue via the expectedSigner it passes and
// the isAuthorAllowed predicate it supplies):
//   - cm_libraries (config): OWNER-signed for a community (verify against the
//     descriptor owner) or SELF-signed for the personal workspace (verify
//     against the workspace's created_by device). One row per library, keyed by
//     the library channel id, LWW by updatedAt.
//   - cm_library_items / collections / collection_items / smart_rules / tags:
//     CURATOR-signed. verifyLibraryItemEvent proves the signature + structure;
//     WHETHER the author was allowed to post (community: evaluateChannelPost at
//     read time; personal: a device of the workspace) is a separate predicate
//     the resolver applies, so this pure layer never needs membership state.

import {
  bytesToHex,
  extractSigningPrivateKeyHex,
  hexToBytes,
  generateSyncRandomBytes,
  signMessage,
  verifySignature,
  type DeviceIdentity,
} from '@mylife/sync';
import { validateLibraryItemMetadata, type KnownMediaType } from './library-metadata-core';

const encoder = new TextEncoder();

/** Caps (characters unless noted). Generous but bounded -- a signed row is hostile input. */
export const LIBRARY_NAME_MAX_CHARS = 120;
export const LIBRARY_TITLE_MAX_CHARS = 512;
export const LIBRARY_SORT_TITLE_MAX_CHARS = 512;
export const LIBRARY_TAG_MAX_CHARS = 64;
export const LIBRARY_COLLECTION_NAME_MAX_CHARS = 120;
export const LIBRARY_METADATA_SOURCE_MAX_CHARS = 128;
export const LIBRARY_MIME_TYPE_MAX_CHARS = 255;
/** The sealed-object manifest JSON scales with chunk count; cap it for sanity only. */
export const LIBRARY_MANIFEST_JSON_MAX_CHARS = 8 * 1024 * 1024;

const CONTENT_ID_PATTERN = /^[0-9a-f]{16,128}$/;
const WRAPPED_KEY_PATTERN = /^[0-9a-f]{96,512}$/;
const SORT_DEFAULT_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;

/** The known media types a library config may declare (mirrors the registry keys). */
export const LIBRARY_MEDIA_TYPES: readonly KnownMediaType[] = [
  'movie', 'show', 'music', 'photo', 'book', 'document', 'custom',
];

function isLibraryMediaType(value: unknown): value is KnownMediaType {
  return typeof value === 'string' && (LIBRARY_MEDIA_TYPES as readonly string[]).includes(value);
}

function normalizeText(value: string | null | undefined, maxChars: number): string | null {
  const trimmed = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, maxChars);
}

function isCleanToken(value: string, maxChars: number): boolean {
  if (!value || value.length > maxChars) return false;
  if (/\s/.test(value)) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\u007f]/.test(value);
}

/** A random, stable, non-secret local id. Signatures bind it; it is never a capability. */
export function generateLibraryLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${bytesToHex(generateSyncRandomBytes(6))}`;
}

// ---------------------------------------------------------------------------
// cm_libraries: owner/self-signed library config (one row per library channel).
// ---------------------------------------------------------------------------

export interface LibraryConfigEvent {
  version: 1;
  id: string; // = the library channel id
  communityId: string; // the workspace id (community or personal)
  channelId: string; // equals id; carried for the engine's row-level gates
  mediaType: KnownMediaType;
  sortDefault: string;
  createdAt: string;
  updatedAt: string;
  signedBy: string;
  signature: string;
}

export interface LibraryConfigInput {
  id: string;
  communityId: string;
  channelId: string;
  mediaType: KnownMediaType;
  sortDefault: string;
  createdAt?: string;
  updatedAt?: string;
}

function canonicalLibraryConfig(e: Omit<LibraryConfigEvent, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-library-config-v1',
    e.version, e.id, e.communityId, e.channelId, e.mediaType, e.sortDefault,
    e.createdAt, e.updatedAt, e.signedBy,
  ]));
}

export function createLibraryConfigEvent(
  signer: DeviceIdentity,
  input: LibraryConfigInput,
): LibraryConfigEvent {
  if (!input.id || !input.communityId || !input.channelId) {
    throw new Error('A library id, community id, and channel id are required.');
  }
  if (input.id !== input.channelId) throw new Error('A library id must equal its channel id.');
  if (!isLibraryMediaType(input.mediaType)) throw new Error('Unknown library media type.');
  const sortDefault = input.sortDefault.trim();
  if (!SORT_DEFAULT_PATTERN.test(sortDefault)) throw new Error('Invalid default sort key.');
  const now = new Date().toISOString();
  const unsigned: Omit<LibraryConfigEvent, 'signature'> = {
    version: 1,
    id: input.id,
    communityId: input.communityId,
    channelId: input.channelId,
    mediaType: input.mediaType,
    sortDefault,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    signedBy: signer.publicKey,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(signer.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalLibraryConfig(unsigned)));
  return { ...unsigned, signature };
}

/** Verify a config row against its expected signer (community owner OR personal-workspace device). */
export function verifyLibraryConfigEvent(event: LibraryConfigEvent, expectedSigner: string): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.id || !event.communityId || event.channelId !== event.id) return false;
  if (!expectedSigner || event.signedBy !== expectedSigner) return false;
  if (!isLibraryMediaType(event.mediaType)) return false;
  if (!SORT_DEFAULT_PATTERN.test(event.sortDefault)) return false;
  if (!event.createdAt || !event.updatedAt) return false;
  try {
    const { signature, ...unsigned } = event;
    return verifySignature(event.signedBy, canonicalLibraryConfig(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function libraryConfigEventToRow(e: LibraryConfigEvent): Record<string, unknown> {
  return {
    id: e.id,
    community_id: e.communityId,
    channel_id: e.channelId,
    media_type: e.mediaType,
    sort_default: e.sortDefault,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
    signed_by: e.signedBy,
    signature: e.signature,
  };
}

export function libraryConfigEventFromRow(data: Record<string, unknown>): LibraryConfigEvent | null {
  const id = rowStr(data.id); const communityId = rowStr(data.community_id);
  const channelId = rowStr(data.channel_id); const mediaType = rowStr(data.media_type);
  const sortDefault = rowStr(data.sort_default); const createdAt = rowStr(data.created_at);
  const updatedAt = rowStr(data.updated_at); const signedBy = rowStr(data.signed_by);
  const signature = rowStr(data.signature);
  if (!id || !communityId || !channelId || !mediaType || !sortDefault || !createdAt
    || !updatedAt || !signedBy || !signature) return null;
  if (!isLibraryMediaType(mediaType)) return null;
  return {
    version: 1, id, communityId, channelId, mediaType, sortDefault, createdAt, updatedAt, signedBy, signature,
  };
}

// ---------------------------------------------------------------------------
// cm_library_items: curator-signed metadata over a sealed blob (+ cover/thumb).
// ---------------------------------------------------------------------------

export interface LibraryItemEvent {
  version: 1;
  id: string;
  communityId: string;
  channelId: string;
  contentCid: string;
  coverCid: string | null;
  thumbCid: string | null;
  keyEpoch: number;
  wrappedKey: string;
  coverWrappedKey: string | null;
  manifestJson: string;
  title: string;
  sortTitle: string | null;
  year: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  mimeType: string | null;
  metadataJson: string;
  metadataSource: string;
  authorDeviceId: string;
  updatedAt: string;
  tombstone: boolean;
  signature: string;
}

export interface LibraryItemInput {
  id?: string;
  communityId: string;
  channelId: string;
  contentCid: string;
  coverCid?: string | null;
  thumbCid?: string | null;
  keyEpoch: number;
  wrappedKey: string;
  coverWrappedKey?: string | null;
  manifestJson: string;
  title: string;
  sortTitle?: string | null;
  year?: number | null;
  durationMs?: number | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  metadataJson: string;
  metadataSource: string;
  updatedAt?: string;
  tombstone?: boolean;
}

function canonicalLibraryItem(e: Omit<LibraryItemEvent, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-library-item-v1',
    e.version, e.id, e.communityId, e.channelId, e.contentCid, e.coverCid, e.thumbCid,
    e.keyEpoch, e.wrappedKey, e.coverWrappedKey, e.manifestJson, e.title, e.sortTitle,
    e.year, e.durationMs, e.sizeBytes, e.mimeType, e.metadataJson, e.metadataSource,
    e.updatedAt, e.tombstone, e.authorDeviceId,
  ]));
}

function nullableInt(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) ? value : null;
}

export function createLibraryItemEvent(author: DeviceIdentity, input: LibraryItemInput): LibraryItemEvent {
  if (!input.communityId || !input.channelId) throw new Error('An item needs a community and channel id.');
  const title = normalizeText(input.title, LIBRARY_TITLE_MAX_CHARS);
  if (!title) throw new Error('An item title is required.');
  if (!CONTENT_ID_PATTERN.test(input.contentCid)) throw new Error('Invalid content id.');
  if (!WRAPPED_KEY_PATTERN.test(input.wrappedKey)) throw new Error('Invalid wrapped key.');
  if (!Number.isInteger(input.keyEpoch) || input.keyEpoch < 1) throw new Error('Invalid key epoch.');
  if (!input.manifestJson || input.manifestJson.length > LIBRARY_MANIFEST_JSON_MAX_CHARS) {
    throw new Error('Invalid item manifest.');
  }
  const tombstone = input.tombstone === true;
  const unsigned: Omit<LibraryItemEvent, 'signature'> = {
    version: 1,
    id: input.id ?? generateLibraryLocalId('litem'),
    communityId: input.communityId,
    channelId: input.channelId,
    contentCid: input.contentCid.toLowerCase(),
    coverCid: input.coverCid ? input.coverCid.toLowerCase() : null,
    thumbCid: input.thumbCid ? input.thumbCid.toLowerCase() : null,
    keyEpoch: input.keyEpoch,
    wrappedKey: input.wrappedKey.toLowerCase(),
    coverWrappedKey: input.coverWrappedKey ? input.coverWrappedKey.toLowerCase() : null,
    manifestJson: input.manifestJson,
    title,
    sortTitle: normalizeText(input.sortTitle, LIBRARY_SORT_TITLE_MAX_CHARS),
    year: nullableInt(input.year),
    durationMs: nullableInt(input.durationMs),
    sizeBytes: nullableInt(input.sizeBytes),
    mimeType: normalizeText(input.mimeType, LIBRARY_MIME_TYPE_MAX_CHARS),
    metadataJson: input.metadataJson,
    metadataSource: normalizeText(input.metadataSource, LIBRARY_METADATA_SOURCE_MAX_CHARS) ?? 'local',
    authorDeviceId: author.publicKey,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    tombstone,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(author.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalLibraryItem(unsigned)));
  return { ...unsigned, signature };
}

/** Signature + structural verification (NOT the author-allowed check; the resolver does that). */
export function verifyLibraryItemEvent(event: LibraryItemEvent): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.id || !event.communityId || !event.channelId || !event.authorDeviceId) return false;
  if (typeof event.tombstone !== 'boolean') return false;
  if (!event.updatedAt) return false;
  if (event.tombstone) {
    // A tombstone still carries the sealing fields (so it round-trips), but must
    // parse; nothing extra is required beyond a valid signature.
  } else {
    if (!CONTENT_ID_PATTERN.test(event.contentCid)) return false;
    if (!WRAPPED_KEY_PATTERN.test(event.wrappedKey)) return false;
    if (event.coverCid !== null && !CONTENT_ID_PATTERN.test(event.coverCid)) return false;
    if (event.coverWrappedKey !== null && !WRAPPED_KEY_PATTERN.test(event.coverWrappedKey)) return false;
    if (event.thumbCid !== null && !CONTENT_ID_PATTERN.test(event.thumbCid)) return false;
    if (!Number.isInteger(event.keyEpoch) || event.keyEpoch < 1) return false;
    if (!event.title || event.title.length > LIBRARY_TITLE_MAX_CHARS) return false;
    if (!event.manifestJson || event.manifestJson.length > LIBRARY_MANIFEST_JSON_MAX_CHARS) return false;
    if (!isCleanToken(event.metadataSource, LIBRARY_METADATA_SOURCE_MAX_CHARS)) return false;
  }
  try {
    const { signature, ...unsigned } = event;
    return verifySignature(event.authorDeviceId, canonicalLibraryItem(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function libraryItemEventToRow(e: LibraryItemEvent): Record<string, unknown> {
  return {
    id: e.id,
    community_id: e.communityId,
    channel_id: e.channelId,
    content_cid: e.contentCid,
    cover_cid: e.coverCid,
    thumb_cid: e.thumbCid,
    key_epoch: e.keyEpoch,
    wrapped_key: e.wrappedKey,
    cover_wrapped_key: e.coverWrappedKey,
    manifest_json: e.manifestJson,
    title: e.title,
    sort_title: e.sortTitle,
    year: e.year,
    duration_ms: e.durationMs,
    size_bytes: e.sizeBytes,
    mime_type: e.mimeType,
    metadata_json: e.metadataJson,
    metadata_source: e.metadataSource,
    author_device_id: e.authorDeviceId,
    signature: e.signature,
    updated_at: e.updatedAt,
    tombstone: e.tombstone ? 1 : 0,
  };
}

export function libraryItemEventFromRow(data: Record<string, unknown>): LibraryItemEvent | null {
  const id = rowStr(data.id); const communityId = rowStr(data.community_id);
  const channelId = rowStr(data.channel_id); const contentCid = rowStr(data.content_cid);
  const wrappedKey = rowStr(data.wrapped_key); const manifestJson = rowStr(data.manifest_json);
  const title = rowStr(data.title); const metadataJson = rowStr(data.metadata_json);
  const metadataSource = rowStr(data.metadata_source); const authorDeviceId = rowStr(data.author_device_id);
  const signature = rowStr(data.signature); const updatedAt = rowStr(data.updated_at);
  if (id === undefined || communityId === undefined || channelId === undefined
    || contentCid === undefined || wrappedKey === undefined || manifestJson === undefined
    || title === undefined || metadataJson === undefined || metadataSource === undefined
    || authorDeviceId === undefined || signature === undefined || updatedAt === undefined) return null;
  if (!id || !communityId || !channelId || !authorDeviceId || !signature || !updatedAt) return null;
  const keyEpoch = typeof data.key_epoch === 'number' ? data.key_epoch : Number.NaN;
  if (!Number.isInteger(keyEpoch)) return null;
  const tRaw = data.tombstone;
  if (tRaw !== 0 && tRaw !== 1 && typeof tRaw !== 'boolean') return null;
  return {
    version: 1,
    id, communityId, channelId,
    contentCid: contentCid ?? '',
    coverCid: rowStrOrNull(data.cover_cid),
    thumbCid: rowStrOrNull(data.thumb_cid),
    keyEpoch,
    wrappedKey: wrappedKey ?? '',
    coverWrappedKey: rowStrOrNull(data.cover_wrapped_key),
    manifestJson: manifestJson ?? '',
    title: title ?? '',
    sortTitle: rowStrOrNull(data.sort_title),
    year: rowIntOrNull(data.year),
    durationMs: rowIntOrNull(data.duration_ms),
    sizeBytes: rowIntOrNull(data.size_bytes),
    mimeType: rowStrOrNull(data.mime_type),
    metadataJson: metadataJson ?? '',
    metadataSource: metadataSource ?? 'local',
    authorDeviceId,
    updatedAt,
    tombstone: tRaw === true || tRaw === 1,
    signature,
  };
}

/**
 * The verified-only item read model for one library. An item survives only if:
 *   - its signature + structure verify,
 *   - its author is allowed (isAuthorAllowed: community membership / personal device),
 *   - its metadata validates for the library's media type (an UNKNOWN media type
 *     rides through with a marker so the browse UI renders a generic list),
 *   - it is not the losing side of an LWW conflict, and is not a tombstone.
 * Rows are keyed by id; the highest (updatedAt, id) wins, and a winning tombstone
 * drops the item entirely.
 */
export interface ResolvedLibraryItem {
  event: LibraryItemEvent;
  mediaType: KnownMediaType;
  metadataUnknownType: boolean;
}

export function resolveVerifiedLibraryItems(
  events: readonly LibraryItemEvent[],
  mediaType: string,
  isAuthorAllowed: (authorDeviceId: string) => boolean,
): ResolvedLibraryItem[] {
  const winners = new Map<string, LibraryItemEvent>();
  for (const event of events) {
    if (!verifyLibraryItemEvent(event)) continue;
    if (!isAuthorAllowed(event.authorDeviceId)) continue;
    const prev = winners.get(event.id);
    if (!prev || event.updatedAt > prev.updatedAt
      || (event.updatedAt === prev.updatedAt && event.id > prev.id)) {
      winners.set(event.id, event);
    }
  }
  const out: ResolvedLibraryItem[] = [];
  for (const event of winners.values()) {
    if (event.tombstone) continue;
    const parse = validateLibraryItemMetadata(mediaType, event.metadataJson);
    if (parse.status === 'invalid') continue;
    if (parse.status === 'unknown_type') {
      out.push({ event, mediaType: 'custom', metadataUnknownType: true });
    } else {
      out.push({ event, mediaType: parse.mediaType, metadataUnknownType: false });
    }
  }
  return out;
}

/**
 * Within-workspace dedup decision (C.2 / Codex amendment 9). Given the CURRENT
 * verified non-tombstoned items of ONE workspace and a candidate content id,
 * return the existing item that already holds that sealed blob, or null. The
 * caller MUST have scoped `existing` to the same workspace; this never reasons
 * across workspaces (a plaintext-equality oracle guard lives in the glue query).
 */
export function findDedupItemByContentCid(
  existing: readonly LibraryItemEvent[],
  contentCid: string,
): LibraryItemEvent | null {
  const target = contentCid.toLowerCase();
  for (const item of existing) {
    if (!item.tombstone && item.contentCid.toLowerCase() === target) return item;
  }
  return null;
}

// ---------------------------------------------------------------------------
// cm_library_collections + membership + smart rules: curator-signed.
// ---------------------------------------------------------------------------

export interface LibraryCollectionEvent {
  version: 1;
  id: string;
  communityId: string;
  channelId: string;
  name: string;
  pinned: boolean;
  authorDeviceId: string;
  updatedAt: string;
  tombstone: boolean;
  signature: string;
}

export interface LibraryCollectionInput {
  id?: string;
  communityId: string;
  channelId: string;
  name: string;
  pinned?: boolean;
  updatedAt?: string;
  tombstone?: boolean;
}

function canonicalCollection(e: Omit<LibraryCollectionEvent, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-library-collection-v1',
    e.version, e.id, e.communityId, e.channelId, e.name, e.pinned, e.updatedAt, e.tombstone, e.authorDeviceId,
  ]));
}

export function createLibraryCollectionEvent(
  author: DeviceIdentity,
  input: LibraryCollectionInput,
): LibraryCollectionEvent {
  const name = normalizeText(input.name, LIBRARY_COLLECTION_NAME_MAX_CHARS);
  if (!input.tombstone && !name) throw new Error('A collection name is required.');
  const unsigned: Omit<LibraryCollectionEvent, 'signature'> = {
    version: 1,
    id: input.id ?? generateLibraryLocalId('lcol'),
    communityId: input.communityId,
    channelId: input.channelId,
    name: name ?? '',
    pinned: input.pinned === true,
    authorDeviceId: author.publicKey,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    tombstone: input.tombstone === true,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(author.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalCollection(unsigned)));
  return { ...unsigned, signature };
}

export function verifyLibraryCollectionEvent(event: LibraryCollectionEvent): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.id || !event.communityId || !event.channelId || !event.authorDeviceId || !event.updatedAt) return false;
  if (typeof event.tombstone !== 'boolean' || typeof event.pinned !== 'boolean') return false;
  if (!event.tombstone && (!event.name || event.name.length > LIBRARY_COLLECTION_NAME_MAX_CHARS)) return false;
  try {
    const { signature, ...unsigned } = event;
    return verifySignature(event.authorDeviceId, canonicalCollection(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function libraryCollectionEventToRow(e: LibraryCollectionEvent): Record<string, unknown> {
  return {
    id: e.id, community_id: e.communityId, channel_id: e.channelId, name: e.name,
    pinned: e.pinned ? 1 : 0, author_device_id: e.authorDeviceId,
    signature: e.signature, updated_at: e.updatedAt, tombstone: e.tombstone ? 1 : 0,
  };
}

export function libraryCollectionEventFromRow(data: Record<string, unknown>): LibraryCollectionEvent | null {
  const id = rowStr(data.id); const communityId = rowStr(data.community_id);
  const channelId = rowStr(data.channel_id); const name = rowStr(data.name);
  const authorDeviceId = rowStr(data.author_device_id); const signature = rowStr(data.signature);
  const updatedAt = rowStr(data.updated_at);
  if (!id || !communityId || !channelId || !authorDeviceId || !signature || !updatedAt) return null;
  const tRaw = data.tombstone; const pRaw = data.pinned;
  if (tRaw !== 0 && tRaw !== 1 && typeof tRaw !== 'boolean') return null;
  return {
    version: 1, id, communityId, channelId, name: name ?? '',
    pinned: pRaw === true || pRaw === 1,
    authorDeviceId, updatedAt, tombstone: tRaw === true || tRaw === 1, signature,
  };
}

export function resolveVerifiedCollections(
  events: readonly LibraryCollectionEvent[],
  isAuthorAllowed: (authorDeviceId: string) => boolean,
): LibraryCollectionEvent[] {
  const winners = new Map<string, LibraryCollectionEvent>();
  for (const event of events) {
    if (!verifyLibraryCollectionEvent(event)) continue;
    if (!isAuthorAllowed(event.authorDeviceId)) continue;
    const prev = winners.get(event.id);
    if (!prev || event.updatedAt > prev.updatedAt
      || (event.updatedAt === prev.updatedAt && event.id > prev.id)) {
      winners.set(event.id, event);
    }
  }
  return [...winners.values()].filter((e) => !e.tombstone);
}

export interface CollectionItemEvent {
  version: 1;
  id: string;
  communityId: string;
  channelId: string;
  collectionId: string;
  itemId: string;
  authorDeviceId: string;
  updatedAt: string;
  tombstone: boolean;
  signature: string;
}

export interface CollectionItemInput {
  id?: string;
  communityId: string;
  channelId: string;
  collectionId: string;
  itemId: string;
  updatedAt?: string;
  tombstone?: boolean;
}

function canonicalCollectionItem(e: Omit<CollectionItemEvent, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-library-collection-item-v1',
    e.version, e.id, e.communityId, e.channelId, e.collectionId, e.itemId,
    e.updatedAt, e.tombstone, e.authorDeviceId,
  ]));
}

export function createCollectionItemEvent(author: DeviceIdentity, input: CollectionItemInput): CollectionItemEvent {
  if (!input.collectionId || !input.itemId) throw new Error('A collection membership needs a collection and item id.');
  const unsigned: Omit<CollectionItemEvent, 'signature'> = {
    version: 1,
    id: input.id ?? generateLibraryLocalId('lcoli'),
    communityId: input.communityId,
    channelId: input.channelId,
    collectionId: input.collectionId,
    itemId: input.itemId,
    authorDeviceId: author.publicKey,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    tombstone: input.tombstone === true,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(author.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalCollectionItem(unsigned)));
  return { ...unsigned, signature };
}

export function verifyCollectionItemEvent(event: CollectionItemEvent): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.id || !event.communityId || !event.channelId || !event.collectionId
    || !event.itemId || !event.authorDeviceId || !event.updatedAt) return false;
  if (typeof event.tombstone !== 'boolean') return false;
  try {
    const { signature, ...unsigned } = event;
    return verifySignature(event.authorDeviceId, canonicalCollectionItem(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function collectionItemEventToRow(e: CollectionItemEvent): Record<string, unknown> {
  return {
    id: e.id, community_id: e.communityId, channel_id: e.channelId,
    collection_id: e.collectionId, item_id: e.itemId, author_device_id: e.authorDeviceId,
    signature: e.signature, updated_at: e.updatedAt, tombstone: e.tombstone ? 1 : 0,
  };
}

export function collectionItemEventFromRow(data: Record<string, unknown>): CollectionItemEvent | null {
  const id = rowStr(data.id); const communityId = rowStr(data.community_id);
  const channelId = rowStr(data.channel_id); const collectionId = rowStr(data.collection_id);
  const itemId = rowStr(data.item_id); const authorDeviceId = rowStr(data.author_device_id);
  const signature = rowStr(data.signature); const updatedAt = rowStr(data.updated_at);
  if (!id || !communityId || !channelId || !collectionId || !itemId || !authorDeviceId
    || !signature || !updatedAt) return null;
  const tRaw = data.tombstone;
  if (tRaw !== 0 && tRaw !== 1 && typeof tRaw !== 'boolean') return null;
  return {
    version: 1, id, communityId, channelId, collectionId, itemId, authorDeviceId,
    updatedAt, tombstone: tRaw === true || tRaw === 1, signature,
  };
}

export function resolveVerifiedCollectionItemIds(
  events: readonly CollectionItemEvent[],
  collectionId: string,
  isAuthorAllowed: (authorDeviceId: string) => boolean,
): string[] {
  const winners = new Map<string, CollectionItemEvent>();
  for (const event of events) {
    if (event.collectionId !== collectionId) continue;
    if (!verifyCollectionItemEvent(event)) continue;
    if (!isAuthorAllowed(event.authorDeviceId)) continue;
    const prev = winners.get(event.id);
    if (!prev || event.updatedAt > prev.updatedAt
      || (event.updatedAt === prev.updatedAt && event.id > prev.id)) {
      winners.set(event.id, event);
    }
  }
  const itemIds = new Set<string>();
  for (const event of winners.values()) {
    if (!event.tombstone) itemIds.add(event.itemId);
  }
  return [...itemIds];
}

export interface SmartRuleEvent {
  version: 1;
  id: string;
  communityId: string;
  channelId: string;
  collectionId: string;
  ruleType: string;
  ruleJson: string;
  authorDeviceId: string;
  updatedAt: string;
  tombstone: boolean;
  signature: string;
}

export interface SmartRuleInput {
  id?: string;
  communityId: string;
  channelId: string;
  collectionId: string;
  ruleType: string;
  ruleJson: string;
  updatedAt?: string;
  tombstone?: boolean;
}

function canonicalSmartRule(e: Omit<SmartRuleEvent, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-library-smart-rule-v1',
    e.version, e.id, e.communityId, e.channelId, e.collectionId, e.ruleType, e.ruleJson,
    e.updatedAt, e.tombstone, e.authorDeviceId,
  ]));
}

export function createSmartRuleEvent(author: DeviceIdentity, input: SmartRuleInput): SmartRuleEvent {
  if (!input.collectionId || !input.ruleType) throw new Error('A smart rule needs a collection id and rule type.');
  const unsigned: Omit<SmartRuleEvent, 'signature'> = {
    version: 1,
    id: input.id ?? generateLibraryLocalId('lrule'),
    communityId: input.communityId,
    channelId: input.channelId,
    collectionId: input.collectionId,
    ruleType: input.ruleType,
    ruleJson: input.ruleJson,
    authorDeviceId: author.publicKey,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    tombstone: input.tombstone === true,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(author.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalSmartRule(unsigned)));
  return { ...unsigned, signature };
}

export function verifySmartRuleEvent(event: SmartRuleEvent): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.id || !event.communityId || !event.channelId || !event.collectionId
    || !event.ruleType || !event.authorDeviceId || !event.updatedAt) return false;
  if (typeof event.tombstone !== 'boolean') return false;
  if (typeof event.ruleJson !== 'string') return false;
  try {
    const { signature, ...unsigned } = event;
    return verifySignature(event.authorDeviceId, canonicalSmartRule(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function smartRuleEventToRow(e: SmartRuleEvent): Record<string, unknown> {
  return {
    id: e.id, community_id: e.communityId, channel_id: e.channelId, collection_id: e.collectionId,
    rule_type: e.ruleType, rule_json: e.ruleJson, author_device_id: e.authorDeviceId,
    signature: e.signature, updated_at: e.updatedAt, tombstone: e.tombstone ? 1 : 0,
  };
}

export function smartRuleEventFromRow(data: Record<string, unknown>): SmartRuleEvent | null {
  const id = rowStr(data.id); const communityId = rowStr(data.community_id);
  const channelId = rowStr(data.channel_id); const collectionId = rowStr(data.collection_id);
  const ruleType = rowStr(data.rule_type); const ruleJson = rowStr(data.rule_json);
  const authorDeviceId = rowStr(data.author_device_id); const signature = rowStr(data.signature);
  const updatedAt = rowStr(data.updated_at);
  if (!id || !communityId || !channelId || !collectionId || !ruleType || ruleJson === undefined
    || !authorDeviceId || !signature || !updatedAt) return null;
  const tRaw = data.tombstone;
  if (tRaw !== 0 && tRaw !== 1 && typeof tRaw !== 'boolean') return null;
  return {
    version: 1, id, communityId, channelId, collectionId, ruleType, ruleJson: ruleJson ?? '',
    authorDeviceId, updatedAt, tombstone: tRaw === true || tRaw === 1, signature,
  };
}

export function resolveVerifiedSmartRules(
  events: readonly SmartRuleEvent[],
  collectionId: string,
  isAuthorAllowed: (authorDeviceId: string) => boolean,
): SmartRuleEvent[] {
  const winners = new Map<string, SmartRuleEvent>();
  for (const event of events) {
    if (event.collectionId !== collectionId) continue;
    if (!verifySmartRuleEvent(event)) continue;
    if (!isAuthorAllowed(event.authorDeviceId)) continue;
    const prev = winners.get(event.id);
    if (!prev || event.updatedAt > prev.updatedAt
      || (event.updatedAt === prev.updatedAt && event.id > prev.id)) {
      winners.set(event.id, event);
    }
  }
  return [...winners.values()].filter((e) => !e.tombstone);
}

// ---------------------------------------------------------------------------
// cm_library_tags: curator-signed add-only tag set (PK item_id, tag). Removal
// support (a tombstone column) is a later-phase schema addition; this phase
// signs + verifies tag additions and lists the verified set.
// ---------------------------------------------------------------------------

export interface LibraryTagEvent {
  version: 1;
  itemId: string;
  communityId: string;
  channelId: string;
  tag: string;
  addedByDeviceId: string;
  addedWall: string;
  addedCounter: number;
  signature: string;
}

export interface LibraryTagInput {
  itemId: string;
  communityId: string;
  channelId: string;
  tag: string;
  addedWall?: string;
  addedCounter?: number;
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().slice(0, LIBRARY_TAG_MAX_CHARS);
}

function canonicalTag(e: Omit<LibraryTagEvent, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-library-tag-v1',
    e.version, e.itemId, e.communityId, e.channelId, e.tag, e.addedWall, e.addedCounter, e.addedByDeviceId,
  ]));
}

export function createLibraryTagEvent(author: DeviceIdentity, input: LibraryTagInput): LibraryTagEvent {
  const tag = normalizeTag(input.tag);
  if (!tag) throw new Error('A tag is required.');
  if (!input.itemId) throw new Error('A tag needs an item id.');
  const unsigned: Omit<LibraryTagEvent, 'signature'> = {
    version: 1,
    itemId: input.itemId,
    communityId: input.communityId,
    channelId: input.channelId,
    tag,
    addedByDeviceId: author.publicKey,
    addedWall: input.addedWall ?? new Date().toISOString(),
    addedCounter: Number.isInteger(input.addedCounter) ? (input.addedCounter as number) : 0,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(author.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalTag(unsigned)));
  return { ...unsigned, signature };
}

export function verifyLibraryTagEvent(event: LibraryTagEvent): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.itemId || !event.communityId || !event.channelId || !event.tag || !event.addedByDeviceId) return false;
  if (!event.addedWall || !Number.isInteger(event.addedCounter)) return false;
  if (event.tag !== normalizeTag(event.tag) || event.tag.length > LIBRARY_TAG_MAX_CHARS) return false;
  try {
    const { signature, ...unsigned } = event;
    return verifySignature(event.addedByDeviceId, canonicalTag(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function libraryTagEventToRow(e: LibraryTagEvent): Record<string, unknown> {
  return {
    item_id: e.itemId, community_id: e.communityId, channel_id: e.channelId, tag: e.tag,
    added_by_device_id: e.addedByDeviceId, added_wall: e.addedWall, added_counter: e.addedCounter,
    signature: e.signature,
  };
}

export function libraryTagEventFromRow(data: Record<string, unknown>): LibraryTagEvent | null {
  const itemId = rowStr(data.item_id); const communityId = rowStr(data.community_id);
  const channelId = rowStr(data.channel_id); const tag = rowStr(data.tag);
  const addedByDeviceId = rowStr(data.added_by_device_id); const addedWall = rowStr(data.added_wall);
  const signature = rowStr(data.signature);
  if (!itemId || !communityId || !channelId || !tag || !addedByDeviceId || !addedWall || !signature) return null;
  const counter = typeof data.added_counter === 'number' ? data.added_counter : Number.NaN;
  if (!Number.isInteger(counter)) return null;
  return { version: 1, itemId, communityId, channelId, tag, addedByDeviceId, addedWall, addedCounter: counter, signature };
}

export function resolveVerifiedTagsForItem(
  events: readonly LibraryTagEvent[],
  itemId: string,
  isAuthorAllowed: (authorDeviceId: string) => boolean,
): string[] {
  const tags = new Set<string>();
  for (const event of events) {
    if (event.itemId !== itemId) continue;
    if (!verifyLibraryTagEvent(event)) continue;
    if (!isAuthorAllowed(event.addedByDeviceId)) continue;
    tags.add(event.tag);
  }
  return [...tags].sort();
}

// ---------------------------------------------------------------------------
// Row-field readers (shared).
// ---------------------------------------------------------------------------

function rowStr(value: unknown): string | undefined {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : undefined;
}

function rowStrOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

function rowIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  return null;
}
