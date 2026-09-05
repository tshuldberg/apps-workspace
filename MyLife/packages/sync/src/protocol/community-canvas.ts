/**
 * Community Canvas (Plan 56 section 3): the signed event vocabulary for the
 * member freeform creation layer. Four kinds, all on the cm_community_identity
 * spine (canonical bytes -> Ed25519 sign -> fail-closed verify -> deterministic
 * resolve; apply-time validators registered in SIGNED_ROW_VALIDATORS so a
 * forgery dies before INSERT; deletion only by signed tombstone):
 *
 *   - CanvasEvent          (cm_canvas, lww): the canvas registry row. One row
 *     per canvas; the row id IS the canvas id (creator-chosen, random hex).
 *     Signer authority depends on kind: commons/channel_topper/pixel_board are
 *     OWNER-signed; profile is signed by its subject member; post/page are
 *     member-signed (the Pages directory + promote-to-tab keep the tab bar an
 *     owner-curated surface, plan 13.6).
 *   - CanvasNodeEvent      (cm_canvas_nodes, lww): one row per placed object,
 *     AUTHOR-signed, per-object LWW via (version, versionNonce) -- the
 *     Excalidraw model (F5): higher version wins, ties break to the LOWER
 *     nonce, deterministic on every peer. Only the author edits a node; a
 *     tombstone may also come from the owner/an admin (curator_remove, 3.6).
 *     A node's sealed asset rides four dedicated columns; the manifest column
 *     is named asset_manifest_json so collectBlobRefs replicates its blocks
 *     with zero pipeline changes (3.1).
 *   - CanvasStrokeEvent    (cm_canvas_strokes, or_set): append-only freehand
 *     strokes; immutable; erasing is a NEW signed event whose erasesId names
 *     the target, valid from the stroke's author or the owner/an admin.
 *   - CanvasMarkEvent      (cm_canvas_counters, or_set): the honest
 *     interaction events of section 3.3 -- increment (counters), vote
 *     (polls), note (guestbooks). Every number shown derives from verified
 *     rows; nothing else exists.
 *
 * Section 10 caps that a validator can count are enforced at apply time here:
 * per-kind node caps, stroke caps, pages-per-member, the 120 events/member/
 * hour rate, and the byte caps on props/policy/payloads. The app-side
 * @mylife/meerkat-canvas package carries the same constants for the editor;
 * an app test asserts the two never drift.
 *
 * The sync package stays structurally minimal on payloads (bounded, parseable,
 * shape-checked); the type-exact per-node-type Zod boundary (F8) lives in the
 * app's canvas node registry, which renders the honest placeholder for
 * anything it cannot prove.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import { communityRole, getCommunity, type CommunityDescriptor } from './community';

const encoder = new TextEncoder();

// --- tables ---------------------------------------------------------------

export const COMMUNITY_CANVAS_TABLE = 'cm_canvas';
export const COMMUNITY_CANVAS_NODES_TABLE = 'cm_canvas_nodes';
export const COMMUNITY_CANVAS_STROKES_TABLE = 'cm_canvas_strokes';
export const COMMUNITY_CANVAS_MARKS_TABLE = 'cm_canvas_counters';

// --- caps (Plan 56 section 10; enforcement source for apply-time checks) ---

export const CANVAS_KINDS = ['commons', 'channel_topper', 'profile', 'post', 'pixel_board', 'page', 'thread_overlay'] as const;
export type CommunityCanvasKind = (typeof CANVAS_KINDS)[number];

export const CANVAS_LAYERS = ['background', 'structure', 'open'] as const;
export type CommunityCanvasLayer = (typeof CANVAS_LAYERS)[number];

/** Nodes per canvas by kind (pixel boards carry pixels in C3, never nodes). */
export const SYNC_CANVAS_NODE_CAPS: Record<CommunityCanvasKind, number> = {
  commons: 2000,
  channel_topper: 200,
  profile: 500,
  page: 800,
  post: 100,
  pixel_board: 0,
  // Feature 12: the sticker layer over one channel's conversation history
  // (subjectId = channelId; nodes anchor to a message via parentId).
  thread_overlay: 400,
};
export const SYNC_CANVAS_STROKE_CAP = 10_000;
export const SYNC_CANVAS_PAGES_PER_MEMBER_CAP = 20;
export const SYNC_CANVAS_EVENT_RATE_PER_HOUR = 120;
export const CANVAS_PROPS_MAX_CHARS = 8 * 1024;
export const CANVAS_POLICY_MAX_CHARS = 8 * 1024;
export const CANVAS_STROKE_MAX_CHARS = 32 * 1024;
export const CANVAS_MARK_NOTE_MAX_CHARS = 500;
export const CANVAS_MARK_OPTION_MAX = 31;

const ID_PATTERN = /^[0-9a-f]{16,64}$/;
const CONTENT_ID_PATTERN = /^[0-9a-f]{16,128}$/;
const WRAPPED_KEY_PATTERN = /^[0-9a-f]{96,512}$/;

/** Bounded, parseable, single-JSON-object string (structural gate only). */
function isBoundedJsonObject(value: string, maxChars: number): boolean {
  if (!value || value.length > maxChars) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

// ==========================================================================
// CanvasEvent (cm_canvas)
// ==========================================================================

export interface CommunityCanvasEvent {
  version: 1;
  /** The canvas identity (creator-chosen random hex; the row id). */
  id: string;
  communityId: string;
  kind: CommunityCanvasKind;
  /** Channel id (commons/topper), device id (profile), post id (post), or the canvas id itself (page). */
  subjectId: string;
  /** MkCanvasPolicy JSON (structural gate here; strict schema app-side). */
  policyJson: string | null;
  /** Monotonic per canvas; the highest VERIFIED revision wins at read. */
  revision: number;
  tombstone: boolean;
  updatedAt: string;
  signedBy: string;
  signature: string;
}

type UnsignedCanvasEvent = Omit<CommunityCanvasEvent, 'signature'>;

function canonicalCanvas(event: UnsignedCanvasEvent): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-canvas-v1',
    event.version,
    event.communityId,
    event.id,
    event.kind,
    event.subjectId,
    event.policyJson,
    event.revision,
    event.tombstone,
    event.updatedAt,
    event.signedBy,
  ]));
}

export interface CreateCanvasInput {
  id: string;
  communityId: string;
  kind: CommunityCanvasKind;
  subjectId: string;
  policyJson?: string | null;
  revision: number;
  tombstone?: boolean;
  updatedAt?: string;
}

export function createCanvasEvent(author: DeviceIdentity, input: CreateCanvasInput): CommunityCanvasEvent {
  if (!ID_PATTERN.test(input.id)) throw new Error('A canvas id must be 16-64 hex characters.');
  if (!input.communityId) throw new Error('A community id is required.');
  if (!(CANVAS_KINDS as readonly string[]).includes(input.kind)) throw new Error('Unknown canvas kind.');
  if (!input.subjectId || input.subjectId.length > 128) throw new Error('A canvas subject is required.');
  if (!Number.isInteger(input.revision) || input.revision < 1) throw new Error('Canvas revision must be a positive integer.');
  const tombstone = input.tombstone === true;
  const policyJson = tombstone ? null : (input.policyJson ?? null);
  if (policyJson !== null && !isBoundedJsonObject(policyJson, CANVAS_POLICY_MAX_CHARS)) {
    throw new Error('That canvas policy is too large or malformed.');
  }
  const unsigned: UnsignedCanvasEvent = {
    version: 1,
    id: input.id,
    communityId: input.communityId,
    kind: input.kind,
    subjectId: input.subjectId,
    policyJson,
    revision: input.revision,
    tombstone,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    signedBy: author.publicKey,
  };
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(author.privateKeyRef), canonicalCanvas(unsigned)));
  return { ...unsigned, signature };
}

/**
 * Verify a canvas registry event against the community descriptor. Fail-closed
 * on every structural, cap, authority, or signature violation. Authority by
 * kind: community-level kinds bind to the OWNER; a profile canvas binds to its
 * subject member; post/page bind to any current member (never a viewer).
 */
export function verifyCanvasEvent(event: CommunityCanvasEvent, descriptor: CommunityDescriptor): boolean {
  if (!event || event.version !== 1) return false;
  if (!ID_PATTERN.test(event.id ?? '')) return false;
  if (!event.communityId || event.communityId !== descriptor.communityId) return false;
  if (!(CANVAS_KINDS as readonly string[]).includes(event.kind)) return false;
  if (!event.subjectId || event.subjectId.length > 128) return false;
  if (!Number.isInteger(event.revision) || event.revision < 1) return false;
  if (typeof event.tombstone !== 'boolean') return false;
  if (!event.updatedAt || !event.signedBy) return false;
  if (event.tombstone) {
    if (event.policyJson !== null) return false;
  } else if (event.policyJson !== null && !isBoundedJsonObject(event.policyJson, CANVAS_POLICY_MAX_CHARS)) {
    return false;
  }
  const role = communityRole(descriptor, event.signedBy);
  if (role === null || role === 'viewer') return false;
  if (event.kind === 'commons' || event.kind === 'channel_topper' || event.kind === 'pixel_board') {
    if (event.signedBy !== descriptor.ownerDeviceId) return false;
  } else if (event.kind === 'profile') {
    if (event.signedBy !== event.subjectId) return false;
  }
  try {
    const { signature, ...unsigned } = event;
    return verifySignature(event.signedBy, canonicalCanvas(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function canvasEventToRow(event: CommunityCanvasEvent): Record<string, unknown> {
  return {
    id: event.id,
    community_id: event.communityId,
    kind: event.kind,
    subject_id: event.subjectId,
    policy_json: event.policyJson,
    revision: event.revision,
    tombstone: event.tombstone ? 1 : 0,
    updated_at: event.updatedAt,
    signed_by: event.signedBy,
    signature: event.signature,
  };
}

function rowString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : undefined;
}

export function canvasEventFromRow(data: Record<string, unknown>): CommunityCanvasEvent | null {
  const id = rowString(data.id);
  const communityId = rowString(data.community_id);
  const kind = rowString(data.kind);
  const subjectId = rowString(data.subject_id);
  const updatedAt = rowString(data.updated_at);
  const signedBy = rowString(data.signed_by);
  const signature = rowString(data.signature);
  if (!id || !communityId || !kind || !subjectId || !updatedAt || !signedBy || !signature) return null;
  const policyJson = rowString(data.policy_json);
  if (policyJson === undefined) return null;
  const revision = typeof data.revision === 'number' ? data.revision : Number.NaN;
  if (!Number.isInteger(revision)) return null;
  const tombstoneRaw = data.tombstone;
  if (tombstoneRaw !== 0 && tombstoneRaw !== 1 && typeof tombstoneRaw !== 'boolean') return null;
  if (!(CANVAS_KINDS as readonly string[]).includes(kind)) return null;
  return {
    version: 1,
    id,
    communityId,
    kind: kind as CommunityCanvasKind,
    subjectId,
    policyJson,
    revision,
    tombstone: tombstoneRaw === true || tombstoneRaw === 1,
    updatedAt,
    signedBy,
    signature,
  };
}

// ==========================================================================
// CanvasNodeEvent (cm_canvas_nodes)
// ==========================================================================

/** A node's sealed asset descriptor (all four present, or null; 3.1). */
export interface CanvasNodeAsset {
  cid: string;
  keyEpoch: number;
  wrappedKey: string;
  /** { manifest, manifestSignature, sealedChunkIds } JSON; feeds collectBlobRefs. */
  manifestJson: string;
}

export function isValidCanvasNodeAsset(asset: CanvasNodeAsset): boolean {
  if (!asset) return false;
  if (!CONTENT_ID_PATTERN.test(asset.cid)) return false;
  if (!Number.isInteger(asset.keyEpoch) || asset.keyEpoch < 1) return false;
  if (!WRAPPED_KEY_PATTERN.test(asset.wrappedKey)) return false;
  if (typeof asset.manifestJson !== 'string' || asset.manifestJson.length === 0) return false;
  if (asset.manifestJson.length > 32 * 1024) return false;
  try {
    const parsed = JSON.parse(asset.manifestJson) as {
      manifest?: { contentId?: unknown };
      manifestSignature?: unknown;
      sealedChunkIds?: unknown;
    };
    if (typeof parsed?.manifestSignature !== 'string') return false;
    if (!Array.isArray(parsed?.sealedChunkIds) || parsed.sealedChunkIds.length === 0) return false;
    if (!parsed.sealedChunkIds.every((s) => typeof s === 'string' && CONTENT_ID_PATTERN.test(s))) return false;
    if (parsed?.manifest?.contentId !== asset.cid) return false;
    return true;
  } catch {
    return false;
  }
}

export interface CommunityCanvasNodeEvent {
  version: 1;
  /** Stable node identity (creator-chosen random hex; the row id). */
  id: string;
  canvasId: string;
  communityId: string;
  authorDevice: string;
  nodeType: string;
  schemaVersion: number;
  propsJson: string;
  layer: CommunityCanvasLayer;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
  parentId: string | null;
  /** Per-object LWW clock (F5): higher wins; ties break to the LOWER nonce. */
  nodeVersion: number;
  versionNonce: number;
  asset: CanvasNodeAsset | null;
  tombstone: boolean;
  createdAt: string;
  updatedAt: string;
  signedBy: string;
  signature: string;
}

type UnsignedCanvasNodeEvent = Omit<CommunityCanvasNodeEvent, 'signature'>;

const NODE_TYPE_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const NUM_LIMIT = 1_000_000;

function boundedNumber(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function canonicalCanvasNode(event: UnsignedCanvasNodeEvent): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-canvas-node-v1',
    event.version,
    event.communityId,
    event.canvasId,
    event.id,
    event.authorDevice,
    event.nodeType,
    event.schemaVersion,
    event.propsJson,
    event.layer,
    [event.x, event.y, event.w, event.h, event.rotation, event.z],
    event.parentId,
    event.nodeVersion,
    event.versionNonce,
    event.asset
      ? [event.asset.cid, event.asset.keyEpoch, event.asset.wrappedKey, event.asset.manifestJson]
      : null,
    event.tombstone,
    event.createdAt,
    event.updatedAt,
    event.signedBy,
  ]));
}

export interface CreateCanvasNodeInput {
  id: string;
  canvasId: string;
  communityId: string;
  nodeType: string;
  schemaVersion: number;
  propsJson: string;
  layer: CommunityCanvasLayer;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  z?: number;
  parentId?: string | null;
  nodeVersion: number;
  versionNonce: number;
  asset?: CanvasNodeAsset | null;
  tombstone?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function createCanvasNodeEvent(author: DeviceIdentity, input: CreateCanvasNodeInput): CommunityCanvasNodeEvent {
  if (!ID_PATTERN.test(input.id)) throw new Error('A node id must be 16-64 hex characters.');
  if (!ID_PATTERN.test(input.canvasId)) throw new Error('A canvas id must be 16-64 hex characters.');
  if (!input.communityId) throw new Error('A community id is required.');
  if (!NODE_TYPE_PATTERN.test(input.nodeType)) throw new Error('Unknown node type shape.');
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion < 1) throw new Error('schemaVersion must be a positive integer.');
  if (!isBoundedJsonObject(input.propsJson, CANVAS_PROPS_MAX_CHARS)) throw new Error('Node props are too large or malformed.');
  if (!(CANVAS_LAYERS as readonly string[]).includes(input.layer)) throw new Error('Unknown canvas layer.');
  const asset = input.asset ?? null;
  if (asset !== null && !isValidCanvasNodeAsset(asset)) throw new Error('That node asset is malformed.');
  if (!Number.isInteger(input.nodeVersion) || input.nodeVersion < 1) throw new Error('nodeVersion must be a positive integer.');
  if (!Number.isInteger(input.versionNonce) || input.versionNonce < 0) throw new Error('versionNonce must be a non-negative integer.');
  // Mirror of the verify-side gate: signing a parentId that can never verify
  // would orphan the event on every device including this one.
  if (input.parentId !== undefined && input.parentId !== null && !ID_PATTERN.test(input.parentId)) {
    throw new Error('A parent id must be 16-64 hex characters.');
  }
  const now = new Date().toISOString();
  const unsigned: UnsignedCanvasNodeEvent = {
    version: 1,
    id: input.id,
    canvasId: input.canvasId,
    communityId: input.communityId,
    authorDevice: author.publicKey,
    nodeType: input.nodeType,
    schemaVersion: input.schemaVersion,
    propsJson: input.propsJson,
    layer: input.layer,
    x: input.x,
    y: input.y,
    w: input.w,
    h: input.h,
    rotation: input.rotation ?? 0,
    z: input.z ?? 0,
    parentId: input.parentId ?? null,
    nodeVersion: input.nodeVersion,
    versionNonce: input.versionNonce,
    asset,
    tombstone: input.tombstone === true,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    signedBy: author.publicKey,
  };
  for (const [value, min, max] of [
    [unsigned.x, -100_000, 100_000],
    [unsigned.y, -100_000, 100_000],
    [unsigned.w, 1, 20_000],
    [unsigned.h, 1, 20_000],
    [unsigned.rotation, -360, 360],
    [unsigned.z, -NUM_LIMIT, NUM_LIMIT],
  ] as const) {
    if (!boundedNumber(value, min, max)) throw new Error('Node geometry is out of bounds.');
  }
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(author.privateKeyRef), canonicalCanvasNode(unsigned)));
  return { ...unsigned, signature };
}

/**
 * Verify a node event. Fail-closed; binds authorDevice === signedBy so a
 * relayed row can never claim another member's authorship. Authority against
 * the canvas policy/layer is the VALIDATOR's job (it has the db); this checks
 * structure, bounds, and the signature.
 */
export function verifyCanvasNodeEvent(event: CommunityCanvasNodeEvent): boolean {
  if (!event || event.version !== 1) return false;
  if (!ID_PATTERN.test(event.id ?? '') || !ID_PATTERN.test(event.canvasId ?? '')) return false;
  if (!event.communityId || !event.createdAt || !event.updatedAt) return false;
  if (!event.authorDevice || event.authorDevice !== event.signedBy) return false;
  if (!NODE_TYPE_PATTERN.test(event.nodeType ?? '')) return false;
  if (!Number.isInteger(event.schemaVersion) || event.schemaVersion < 1) return false;
  if (!isBoundedJsonObject(event.propsJson ?? '', CANVAS_PROPS_MAX_CHARS)) return false;
  if (!(CANVAS_LAYERS as readonly string[]).includes(event.layer)) return false;
  if (event.parentId !== null && (typeof event.parentId !== 'string' || !ID_PATTERN.test(event.parentId))) return false;
  if (!Number.isInteger(event.nodeVersion) || event.nodeVersion < 1) return false;
  if (!Number.isInteger(event.versionNonce) || event.versionNonce < 0) return false;
  if (event.asset !== null && !isValidCanvasNodeAsset(event.asset)) return false;
  if (typeof event.tombstone !== 'boolean') return false;
  if (
    !boundedNumber(event.x, -100_000, 100_000)
    || !boundedNumber(event.y, -100_000, 100_000)
    || !boundedNumber(event.w, 1, 20_000)
    || !boundedNumber(event.h, 1, 20_000)
    || !boundedNumber(event.rotation, -360, 360)
    || !boundedNumber(event.z, -NUM_LIMIT, NUM_LIMIT)
  ) return false;
  try {
    const { signature, ...unsigned } = event;
    return verifySignature(event.signedBy, canonicalCanvasNode(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function canvasNodeEventToRow(event: CommunityCanvasNodeEvent): Record<string, unknown> {
  return {
    id: event.id,
    canvas_id: event.canvasId,
    community_id: event.communityId,
    author_device: event.authorDevice,
    node_type: event.nodeType,
    schema_version: event.schemaVersion,
    props_json: event.propsJson,
    layer: event.layer,
    x: event.x,
    y: event.y,
    w: event.w,
    h: event.h,
    rotation: event.rotation,
    z: event.z,
    parent_id: event.parentId,
    node_version: event.nodeVersion,
    version_nonce: event.versionNonce,
    asset_cid: event.asset?.cid ?? null,
    asset_key_epoch: event.asset?.keyEpoch ?? null,
    asset_wrapped_key: event.asset?.wrappedKey ?? null,
    // Named *_manifest_json so blob-transfer's collector replicates the sealed
    // asset blocks exactly like library items (3.1).
    asset_manifest_json: event.asset?.manifestJson ?? null,
    tombstone: event.tombstone ? 1 : 0,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
    signed_by: event.signedBy,
    signature: event.signature,
  };
}

export function canvasNodeEventFromRow(data: Record<string, unknown>): CommunityCanvasNodeEvent | null {
  const id = rowString(data.id);
  const canvasId = rowString(data.canvas_id);
  const communityId = rowString(data.community_id);
  const authorDevice = rowString(data.author_device);
  const nodeType = rowString(data.node_type);
  const propsJson = rowString(data.props_json);
  const layer = rowString(data.layer);
  const createdAt = rowString(data.created_at);
  const updatedAt = rowString(data.updated_at);
  const signedBy = rowString(data.signed_by);
  const signature = rowString(data.signature);
  if (!id || !canvasId || !communityId || !authorDevice || !nodeType || !propsJson || !layer
    || !createdAt || !updatedAt || !signedBy || !signature) return null;
  if (!(CANVAS_LAYERS as readonly string[]).includes(layer)) return null;
  const parentId = rowString(data.parent_id);
  if (parentId === undefined) return null;
  const numbers = [data.schema_version, data.x, data.y, data.w, data.h, data.rotation, data.z, data.node_version, data.version_nonce];
  if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const tombstoneRaw = data.tombstone;
  if (tombstoneRaw !== 0 && tombstoneRaw !== 1 && typeof tombstoneRaw !== 'boolean') return null;
  const assetCid = rowString(data.asset_cid);
  const assetWrapped = rowString(data.asset_wrapped_key);
  const assetManifest = rowString(data.asset_manifest_json);
  if (assetCid === undefined || assetWrapped === undefined || assetManifest === undefined) return null;
  const assetEpochRaw = data.asset_key_epoch;
  const assetFieldCount = [assetCid, assetWrapped, assetManifest].filter((v) => v !== null).length
    + (assetEpochRaw !== null && assetEpochRaw !== undefined ? 1 : 0);
  let asset: CanvasNodeAsset | null = null;
  if (assetFieldCount === 4) {
    if (typeof assetEpochRaw !== 'number' || !Number.isInteger(assetEpochRaw)) return null;
    asset = { cid: assetCid!, keyEpoch: assetEpochRaw, wrappedKey: assetWrapped!, manifestJson: assetManifest! };
  } else if (assetFieldCount !== 0) {
    return null; // partial asset = malformed (all-or-nothing)
  }
  return {
    version: 1,
    id,
    canvasId,
    communityId,
    authorDevice,
    nodeType,
    schemaVersion: data.schema_version as number,
    propsJson,
    layer: layer as CommunityCanvasLayer,
    x: data.x as number,
    y: data.y as number,
    w: data.w as number,
    h: data.h as number,
    rotation: data.rotation as number,
    z: data.z as number,
    parentId,
    nodeVersion: data.node_version as number,
    versionNonce: data.version_nonce as number,
    asset,
    tombstone: tombstoneRaw === true || tombstoneRaw === 1,
    createdAt,
    updatedAt,
    signedBy,
    signature,
  };
}

/**
 * The deterministic per-node merge (F5): from competing VERIFIED events for
 * the same node id, the higher nodeVersion wins; ties break to the LOWER
 * versionNonce; a final deterministic tie-break on updatedAt then signature
 * keeps every peer identical. Callers pass verified events only.
 */
export function mergeCanvasNodeEvents(
  a: CommunityCanvasNodeEvent,
  b: CommunityCanvasNodeEvent,
): CommunityCanvasNodeEvent {
  if (a.nodeVersion !== b.nodeVersion) return a.nodeVersion > b.nodeVersion ? a : b;
  if (a.versionNonce !== b.versionNonce) return a.versionNonce < b.versionNonce ? a : b;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return a.signature >= b.signature ? a : b;
}

// ==========================================================================
// CanvasStrokeEvent (cm_canvas_strokes)
// ==========================================================================

export interface CommunityCanvasStrokeEvent {
  version: 1;
  /** Content-addressed event id (hash of canonical bytes + signature). */
  id: string;
  canvasId: string;
  communityId: string;
  authorDevice: string;
  /** MkCanvasStrokePayload JSON, or null on an erase event. */
  strokeJson: string | null;
  /** Erase: the id of the stroke this event removes (author or owner/admin). */
  erasesId: string | null;
  createdAt: string;
  signedBy: string;
  signature: string;
}

type UnsignedStrokeEvent = Omit<CommunityCanvasStrokeEvent, 'id' | 'signature'>;
type SignedStrokeEventWithoutId = Omit<CommunityCanvasStrokeEvent, 'id'>;

function canonicalCanvasStroke(event: UnsignedStrokeEvent): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-canvas-stroke-v1',
    event.version,
    event.communityId,
    event.canvasId,
    event.authorDevice,
    event.strokeJson,
    event.erasesId,
    event.createdAt,
    event.signedBy,
  ]));
}

export function canvasStrokeEventId(event: SignedStrokeEventWithoutId): string {
  const { signature, ...unsigned } = event;
  const canonical = canonicalCanvasStroke(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

export interface CreateCanvasStrokeInput {
  canvasId: string;
  communityId: string;
  strokeJson?: string | null;
  erasesId?: string | null;
  createdAt?: string;
}

export function createCanvasStrokeEvent(author: DeviceIdentity, input: CreateCanvasStrokeInput): CommunityCanvasStrokeEvent {
  if (!ID_PATTERN.test(input.canvasId)) throw new Error('A canvas id must be 16-64 hex characters.');
  if (!input.communityId) throw new Error('A community id is required.');
  const strokeJson = input.strokeJson ?? null;
  const erasesId = input.erasesId ?? null;
  if ((strokeJson === null) === (erasesId === null)) {
    throw new Error('A stroke event carries exactly one of a stroke payload or an erase target.');
  }
  if (strokeJson !== null && !isBoundedJsonObject(strokeJson, CANVAS_STROKE_MAX_CHARS)) {
    throw new Error('That stroke is too large or malformed.');
  }
  if (erasesId !== null && !/^[0-9a-f]{32}$/.test(erasesId)) {
    throw new Error('An erase target must be a stroke event id.');
  }
  const unsigned: UnsignedStrokeEvent = {
    version: 1,
    canvasId: input.canvasId,
    communityId: input.communityId,
    authorDevice: author.publicKey,
    strokeJson,
    erasesId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    signedBy: author.publicKey,
  };
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(author.privateKeyRef), canonicalCanvasStroke(unsigned)));
  const withoutId = { ...unsigned, signature };
  return { ...withoutId, id: canvasStrokeEventId(withoutId) };
}

export function verifyCanvasStrokeEvent(event: CommunityCanvasStrokeEvent): boolean {
  if (!event || event.version !== 1) return false;
  if (!ID_PATTERN.test(event.canvasId ?? '')) return false;
  if (!event.communityId || !event.createdAt) return false;
  if (!event.authorDevice || event.authorDevice !== event.signedBy) return false;
  const strokeJson = event.strokeJson;
  const erasesId = event.erasesId;
  if ((strokeJson === null) === (erasesId === null)) return false;
  if (strokeJson !== null && !isBoundedJsonObject(strokeJson, CANVAS_STROKE_MAX_CHARS)) return false;
  if (erasesId !== null && !/^[0-9a-f]{32}$/.test(erasesId)) return false;
  if (event.id !== canvasStrokeEventId(event)) return false;
  try {
    const { id, signature, ...unsigned } = event;
    void id;
    return verifySignature(event.signedBy, canonicalCanvasStroke(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function canvasStrokeEventToRow(event: CommunityCanvasStrokeEvent): Record<string, unknown> {
  return {
    id: event.id,
    canvas_id: event.canvasId,
    community_id: event.communityId,
    author_device: event.authorDevice,
    stroke_json: event.strokeJson,
    erases_id: event.erasesId,
    created_at: event.createdAt,
    signed_by: event.signedBy,
    signature: event.signature,
  };
}

export function canvasStrokeEventFromRow(data: Record<string, unknown>): CommunityCanvasStrokeEvent | null {
  const id = rowString(data.id);
  const canvasId = rowString(data.canvas_id);
  const communityId = rowString(data.community_id);
  const authorDevice = rowString(data.author_device);
  const createdAt = rowString(data.created_at);
  const signedBy = rowString(data.signed_by);
  const signature = rowString(data.signature);
  if (!id || !canvasId || !communityId || !authorDevice || !createdAt || !signedBy || !signature) return null;
  const strokeJson = rowString(data.stroke_json);
  const erasesId = rowString(data.erases_id);
  if (strokeJson === undefined || erasesId === undefined) return null;
  return {
    version: 1,
    id,
    canvasId,
    communityId,
    authorDevice,
    strokeJson,
    erasesId,
    createdAt,
    signedBy,
    signature,
  };
}

/**
 * Resolve visible strokes: verified stroke events minus those erased by a
 * VERIFIED erase event whose signer is the stroke's author or the community
 * owner/an admin (curator moderation, 3.6). Deterministic; erases of unknown
 * strokes are inert.
 */
export function resolveCanvasStrokes(
  events: readonly CommunityCanvasStrokeEvent[],
  descriptor: CommunityDescriptor,
): CommunityCanvasStrokeEvent[] {
  const verified = events.filter((event) => verifyCanvasStrokeEvent(event));
  const byId = new Map(verified.map((event) => [event.id, event]));
  const erased = new Set<string>();
  for (const event of verified) {
    if (event.erasesId === null) continue;
    const target = byId.get(event.erasesId);
    if (!target) continue;
    const role = communityRole(descriptor, event.signedBy);
    const mayErase = event.signedBy === target.authorDevice || role === 'owner' || role === 'admin';
    if (mayErase) erased.add(target.id);
  }
  return verified
    .filter((event) => event.strokeJson !== null && !erased.has(event.id))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
}

// ==========================================================================
// CanvasMarkEvent (cm_canvas_counters): increment / vote / note (3.3)
// ==========================================================================

export const CANVAS_MARK_KINDS = ['increment', 'vote', 'note'] as const;
export type CommunityCanvasMarkKind = (typeof CANVAS_MARK_KINDS)[number];

export interface CommunityCanvasMarkEvent {
  version: 1;
  /** Content-addressed event id. */
  id: string;
  canvasId: string;
  communityId: string;
  /** The node this mark targets (a counter, poll, or guestbook node). */
  nodeId: string;
  kind: CommunityCanvasMarkKind;
  /** vote: the chosen option index; null otherwise. */
  option: number | null;
  /** note: the bounded visit note; null otherwise. */
  note: string | null;
  authorDevice: string;
  createdAt: string;
  signedBy: string;
  signature: string;
}

type UnsignedMarkEvent = Omit<CommunityCanvasMarkEvent, 'id' | 'signature'>;
type SignedMarkEventWithoutId = Omit<CommunityCanvasMarkEvent, 'id'>;

function canonicalCanvasMark(event: UnsignedMarkEvent): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-canvas-mark-v1',
    event.version,
    event.communityId,
    event.canvasId,
    event.nodeId,
    event.kind,
    event.option,
    event.note,
    event.authorDevice,
    event.createdAt,
    event.signedBy,
  ]));
}

export function canvasMarkEventId(event: SignedMarkEventWithoutId): string {
  const { signature, ...unsigned } = event;
  const canonical = canonicalCanvasMark(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

export interface CreateCanvasMarkInput {
  canvasId: string;
  communityId: string;
  nodeId: string;
  kind: CommunityCanvasMarkKind;
  option?: number | null;
  note?: string | null;
  createdAt?: string;
}

export function createCanvasMarkEvent(author: DeviceIdentity, input: CreateCanvasMarkInput): CommunityCanvasMarkEvent {
  if (!ID_PATTERN.test(input.canvasId)) throw new Error('A canvas id must be 16-64 hex characters.');
  if (!ID_PATTERN.test(input.nodeId)) throw new Error('A node id must be 16-64 hex characters.');
  if (!input.communityId) throw new Error('A community id is required.');
  if (!(CANVAS_MARK_KINDS as readonly string[]).includes(input.kind)) throw new Error('Unknown mark kind.');
  const option = input.option ?? null;
  const note = (input.note ?? null) === null ? null : String(input.note).trim();
  if (input.kind === 'vote') {
    if (!Number.isInteger(option) || (option as number) < 0 || (option as number) > CANVAS_MARK_OPTION_MAX) {
      throw new Error('A vote needs a valid option index.');
    }
    if (note !== null) throw new Error('A vote carries no note.');
  } else if (input.kind === 'note') {
    if (!note || note.length > CANVAS_MARK_NOTE_MAX_CHARS) throw new Error('A note must be 1-500 characters.');
    if (option !== null) throw new Error('A note carries no option.');
  } else {
    if (option !== null || note !== null) throw new Error('An increment carries no payload.');
  }
  const unsigned: UnsignedMarkEvent = {
    version: 1,
    canvasId: input.canvasId,
    communityId: input.communityId,
    nodeId: input.nodeId,
    kind: input.kind,
    option,
    note,
    authorDevice: author.publicKey,
    createdAt: input.createdAt ?? new Date().toISOString(),
    signedBy: author.publicKey,
  };
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(author.privateKeyRef), canonicalCanvasMark(unsigned)));
  const withoutId = { ...unsigned, signature };
  return { ...withoutId, id: canvasMarkEventId(withoutId) };
}

export function verifyCanvasMarkEvent(event: CommunityCanvasMarkEvent): boolean {
  if (!event || event.version !== 1) return false;
  if (!ID_PATTERN.test(event.canvasId ?? '') || !ID_PATTERN.test(event.nodeId ?? '')) return false;
  if (!event.communityId || !event.createdAt) return false;
  if (!event.authorDevice || event.authorDevice !== event.signedBy) return false;
  if (!(CANVAS_MARK_KINDS as readonly string[]).includes(event.kind)) return false;
  if (event.kind === 'vote') {
    if (!Number.isInteger(event.option) || (event.option as number) < 0 || (event.option as number) > CANVAS_MARK_OPTION_MAX) return false;
    if (event.note !== null) return false;
  } else if (event.kind === 'note') {
    if (typeof event.note !== 'string' || event.note.length === 0 || event.note.length > CANVAS_MARK_NOTE_MAX_CHARS) return false;
    if (event.option !== null) return false;
  } else if (event.option !== null || event.note !== null) {
    return false;
  }
  if (event.id !== canvasMarkEventId(event)) return false;
  try {
    const { id, signature, ...unsigned } = event;
    void id;
    return verifySignature(event.signedBy, canonicalCanvasMark(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function canvasMarkEventToRow(event: CommunityCanvasMarkEvent): Record<string, unknown> {
  return {
    id: event.id,
    canvas_id: event.canvasId,
    community_id: event.communityId,
    node_id: event.nodeId,
    kind: event.kind,
    option: event.option,
    note: event.note,
    author_device: event.authorDevice,
    created_at: event.createdAt,
    signed_by: event.signedBy,
    signature: event.signature,
  };
}

export function canvasMarkEventFromRow(data: Record<string, unknown>): CommunityCanvasMarkEvent | null {
  const id = rowString(data.id);
  const canvasId = rowString(data.canvas_id);
  const communityId = rowString(data.community_id);
  const nodeId = rowString(data.node_id);
  const kind = rowString(data.kind);
  const authorDevice = rowString(data.author_device);
  const createdAt = rowString(data.created_at);
  const signedBy = rowString(data.signed_by);
  const signature = rowString(data.signature);
  if (!id || !canvasId || !communityId || !nodeId || !kind || !authorDevice || !createdAt || !signedBy || !signature) return null;
  if (!(CANVAS_MARK_KINDS as readonly string[]).includes(kind)) return null;
  const optionRaw = data.option;
  const option = optionRaw === null || optionRaw === undefined
    ? null
    : (typeof optionRaw === 'number' && Number.isInteger(optionRaw) ? optionRaw : undefined);
  if (option === undefined) return null;
  const note = rowString(data.note);
  if (note === undefined) return null;
  return {
    version: 1,
    id,
    canvasId,
    communityId,
    nodeId,
    kind: kind as CommunityCanvasMarkKind,
    option,
    note,
    authorDevice,
    createdAt,
    signedBy,
    signature,
  };
}

// ==========================================================================
// Apply-time validators (registered in SIGNED_ROW_VALIDATORS)
// ==========================================================================

export type CanvasRowVerdict = { ok: true } | { ok: false; reason: string };

interface RowChange {
  table: string;
  rowId: string;
  operation: string;
  data: Record<string, unknown> | null | undefined;
}

function getDescriptor(db: DatabaseAdapter, communityId: string): CommunityDescriptor | null {
  return getCommunity(db, communityId)?.descriptor ?? null;
}

/** True when the author reached the hourly canvas-event budget (section 10: 120/member/hour). */
function overCanvasRate(db: DatabaseAdapter, communityId: string, author: string, nowIso: string): boolean {
  const cutoff = new Date(new Date(nowIso).getTime() - 60 * 60 * 1000).toISOString();
  let total = 0;
  for (const [table, column] of [
    [COMMUNITY_CANVAS_NODES_TABLE, 'updated_at'],
    [COMMUNITY_CANVAS_STROKES_TABLE, 'created_at'],
    [COMMUNITY_CANVAS_MARKS_TABLE, 'created_at'],
  ] as const) {
    try {
      const rows = db.query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${table} WHERE community_id = ? AND signed_by = ? AND ${column} >= ?`,
        [communityId, author, cutoff],
      );
      total += rows[0]?.n ?? 0;
    } catch {
      // A missing table (older schema mid-migration) fails OPEN for the count
      // only; the signature and authority gates above it still hold.
    }
  }
  return total >= SYNC_CANVAS_EVENT_RATE_PER_HOUR;
}

/** The layer the community's roles map onto (owner > admin(curator) > member). */
function roleSatisfiesLayer(role: string | null, layerRole: string): boolean {
  if (role === null || role === 'viewer') return false;
  if (layerRole === 'owner') return role === 'owner';
  if (layerRole === 'curator') return role === 'owner' || role === 'admin';
  return role === 'owner' || role === 'admin' || role === 'member';
}

function canvasPolicyFor(event: CommunityCanvasEvent | null): { layers: Record<string, string>; memberBuild: boolean } {
  const fallback = { layers: { background: 'owner', structure: 'curator', open: 'member' }, memberBuild: true };
  if (!event || event.policyJson === null) return fallback;
  try {
    const parsed = JSON.parse(event.policyJson) as { layers?: Record<string, string>; memberBuild?: boolean };
    return {
      layers: { ...fallback.layers, ...(parsed.layers ?? {}) },
      memberBuild: parsed.memberBuild !== false,
    };
  } catch {
    return fallback;
  }
}

export function validateCanvasRow(db: DatabaseAdapter, change: RowChange): CanvasRowVerdict {
  if (!change.data) return { ok: false, reason: 'canvas_row_malformed' };
  const event = canvasEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'canvas_row_malformed' };
  const descriptor = getDescriptor(db, event.communityId);
  if (!descriptor) return { ok: false, reason: 'canvas_community_unknown' };
  if (!verifyCanvasEvent(event, descriptor)) return { ok: false, reason: 'canvas_signature_invalid' };
  // The row id is the canvas identity; an update must keep the same canvas.
  if (change.rowId !== event.id) return { ok: false, reason: 'canvas_row_mismatch' };
  // A page canvas counts against its creator's pages-per-member cap.
  if (event.kind === 'page' && !event.tombstone) {
    try {
      const rows = db.query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${COMMUNITY_CANVAS_TABLE}
         WHERE community_id = ? AND kind = 'page' AND signed_by = ? AND tombstone = 0 AND id != ?`,
        [event.communityId, event.signedBy, event.id],
      );
      if ((rows[0]?.n ?? 0) >= SYNC_CANVAS_PAGES_PER_MEMBER_CAP) {
        return { ok: false, reason: 'canvas_pages_cap' };
      }
    } catch {
      // Missing table mid-migration: cap check skipped, signature gate held.
    }
  }
  return { ok: true };
}

export function validateCanvasNodeRow(db: DatabaseAdapter, change: RowChange): CanvasRowVerdict {
  if (!change.data) return { ok: false, reason: 'canvas_node_malformed' };
  const event = canvasNodeEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'canvas_node_malformed' };
  if (!verifyCanvasNodeEvent(event)) return { ok: false, reason: 'canvas_node_signature_invalid' };
  const descriptor = getDescriptor(db, event.communityId);
  if (!descriptor) return { ok: false, reason: 'canvas_node_community_unknown' };
  const role = communityRole(descriptor, event.signedBy);
  if (role === null || role === 'viewer') return { ok: false, reason: 'canvas_node_not_member' };
  // The canvas must exist and verify; its policy gates the layer. A missing
  // table or row fails CLOSED (the node re-arrives once the canvas lands).
  let canvas: CommunityCanvasEvent | null = null;
  try {
    const canvasRows = db.query<Record<string, unknown>>(
      `SELECT * FROM ${COMMUNITY_CANVAS_TABLE} WHERE id = ?`,
      [event.canvasId],
    );
    canvas = canvasRows[0] ? canvasEventFromRow(canvasRows[0]) : null;
  } catch {
    canvas = null;
  }
  if (!canvas || canvas.communityId !== event.communityId || canvas.tombstone) {
    return { ok: false, reason: 'canvas_node_canvas_unknown' };
  }
  if (!verifyCanvasEvent(canvas, descriptor)) return { ok: false, reason: 'canvas_node_canvas_unverified' };
  const policy = canvasPolicyFor(canvas);
  let existing: CommunityCanvasNodeEvent | null = null;
  try {
    const existingRows = db.query<Record<string, unknown>>(
      `SELECT * FROM ${COMMUNITY_CANVAS_NODES_TABLE} WHERE id = ?`,
      [event.id],
    );
    existing = existingRows[0] ? canvasNodeEventFromRow(existingRows[0]) : null;
  } catch {
    existing = null;
  }
  if (existing) {
    // Edits only by the author; a TOMBSTONE may also come from the owner or an
    // admin (curator_remove, 3.6) on the open layer.
    const isCuratorRemove = event.tombstone
      && (role === 'owner' || role === 'admin')
      && existing.layer === 'open';
    if (existing.authorDevice !== event.authorDevice && !isCuratorRemove) {
      return { ok: false, reason: 'canvas_node_author_mismatch' };
    }
    // LWW discipline: never accept a strictly older version for the same node.
    if (event.nodeVersion < existing.nodeVersion) {
      return { ok: false, reason: 'canvas_node_stale_version' };
    }
  } else {
    // New node: the author must satisfy the layer's role floor, and the open
    // layer honors the one-bit member-build toggle (feature 14).
    const layerRole = policy.layers[event.layer] ?? 'owner';
    if (!roleSatisfiesLayer(role, layerRole)) return { ok: false, reason: 'canvas_node_layer_denied' };
    if (event.layer === 'open' && !policy.memberBuild && role === 'member') {
      return { ok: false, reason: 'canvas_node_member_build_off' };
    }
    // Per-kind node cap, counted at apply (section 10 / 7.11).
    try {
      const rows = db.query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${COMMUNITY_CANVAS_NODES_TABLE} WHERE canvas_id = ? AND tombstone = 0`,
        [event.canvasId],
      );
      const cap = SYNC_CANVAS_NODE_CAPS[canvas.kind];
      if ((rows[0]?.n ?? 0) >= cap) return { ok: false, reason: 'canvas_node_cap' };
    } catch {
      // Missing table mid-migration: cap check skipped, signature gate held.
    }
    if (overCanvasRate(db, event.communityId, event.signedBy, event.updatedAt)) {
      return { ok: false, reason: 'canvas_rate_limited' };
    }
  }
  return { ok: true };
}

export function validateCanvasStrokeRow(db: DatabaseAdapter, change: RowChange): CanvasRowVerdict {
  if (!change.data) return { ok: false, reason: 'canvas_stroke_malformed' };
  const event = canvasStrokeEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'canvas_stroke_malformed' };
  if (!verifyCanvasStrokeEvent(event)) return { ok: false, reason: 'canvas_stroke_signature_invalid' };
  const descriptor = getDescriptor(db, event.communityId);
  if (!descriptor) return { ok: false, reason: 'canvas_stroke_community_unknown' };
  const role = communityRole(descriptor, event.signedBy);
  if (role === null || role === 'viewer') return { ok: false, reason: 'canvas_stroke_not_member' };
  try {
    const rows = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${COMMUNITY_CANVAS_STROKES_TABLE} WHERE canvas_id = ?`,
      [event.canvasId],
    );
    if ((rows[0]?.n ?? 0) >= SYNC_CANVAS_STROKE_CAP) return { ok: false, reason: 'canvas_stroke_cap' };
  } catch {
    // Missing table mid-migration: cap check skipped, signature gate held.
  }
  if (overCanvasRate(db, event.communityId, event.signedBy, event.createdAt)) {
    return { ok: false, reason: 'canvas_rate_limited' };
  }
  return { ok: true };
}

export function validateCanvasMarkRow(db: DatabaseAdapter, change: RowChange): CanvasRowVerdict {
  if (!change.data) return { ok: false, reason: 'canvas_mark_malformed' };
  const event = canvasMarkEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'canvas_mark_malformed' };
  if (!verifyCanvasMarkEvent(event)) return { ok: false, reason: 'canvas_mark_signature_invalid' };
  const descriptor = getDescriptor(db, event.communityId);
  if (!descriptor) return { ok: false, reason: 'canvas_mark_community_unknown' };
  const role = communityRole(descriptor, event.signedBy);
  if (role === null || role === 'viewer') return { ok: false, reason: 'canvas_mark_not_member' };
  if (overCanvasRate(db, event.communityId, event.signedBy, event.createdAt)) {
    return { ok: false, reason: 'canvas_rate_limited' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The Plaza pixel board (Plan 56 C3, features 6/18): one signed pixel event
// per placement on a pixel_board canvas. Pure or_set append -- the CURRENT
// board is the deterministic last-writer per cell and the FULL ordered history
// is the timelapse, both derived from the same verified rows. The palette is
// a CLOSED protocol-level list (F2: a pixel can never carry a free-form
// color) and the grid is bounded.
//
// Convergence architecture (codex adversarial review, 3 confirmed defects):
//   - The apply-time validator (validateCanvasPixelRow) keeps ONLY
//     ORDER-INDEPENDENT gates -- signature/authority, board exists+verifies,
//     in-grid, an ingest-only far-future clock reject, and a PER-MEMBER COUNT
//     storage cap (scoped by signer so one flooder cannot freeze the board).
//     It NO LONGER rate-rejects on a prior stored same-signer
//     placement: that check depended on delivery order, so which rows a device
//     stored diverged from peer to peer, and the resolver cannot rate-limit
//     what a device never stored (defect 3). With only order-independent gates
//     every validly-signed pixel converges on every device.
//   - createdAt is CANONICAL UTC only (isCanonicalUtcTimestamp), so the
//     resolver's `new Date(createdAt).getTime()` interval math is identical on
//     every peer -- a non-Z / local-time string used to resolve DIFFERENT
//     boards from the same events (defect 2).
//   - resolveCanvasPixels is the AUTHORITATIVE per-member interval collapse,
//     enforced deterministically at read over the converged set (defect 1's
//     immediate-paint half; the future half is closed by the ingest clock gate).
// ---------------------------------------------------------------------------

export const COMMUNITY_CANVAS_PIXELS_TABLE = 'cm_canvas_pixels';

/** The closed 16-color Plaza palette (r/place lineage), indexed by event colorIndex. */
export const SYNC_PIXEL_PALETTE = [
  '#FFFFFF', '#E4E4E4', '#888888', '#222222',
  '#FFA7D1', '#E50000', '#E59500', '#A06A42',
  '#E5D900', '#94E044', '#02BE01', '#00D3DD',
  '#0083C7', '#0000EA', '#CF6EE4', '#820080',
] as const;

export const SYNC_PIXEL_GRID_MAX = 512;
export const SYNC_PIXEL_GRID_DEFAULT = 128;
export const SYNC_PIXEL_MIN_INTERVAL_SECONDS = 30;

/**
 * Order-independent PER-MEMBER storage cap: the maximum stored pixel rows one
 * signer may hold on a single pixel_board (the COUNT is scoped by signed_by).
 * With the delivery-order-dependent per-member interval REJECT removed from
 * apply time (codex defect 3), this per-signer COUNT threshold is the ingest
 * DoS bound. A per-CANVAS cap would let ONE malicious member flood the whole
 * board to the ceiling and permanently freeze every honest member out; scoping
 * the count to the event's signer means a flooder only exhausts THEIR OWN
 * budget and never blocks anyone else.
 *
 * It is order-independent for each member's ACCEPTED sub-cap set -- every peer
 * accepts the same rows from a given signer until that signer holds this many,
 * so a legitimate board converges identically. Only once an INDIVIDUAL is driven
 * past this already-abusive personal ceiling may peers differ in WHICH of that
 * signer's surplus rows they retain, and by then that member is saturated and
 * the resolver still collapses their placements to one per interval. This
 * mirrors the per-canvas SYNC_CANVAS_STROKE_CAP / node-COUNT precedent (a plain
 * COUNT gate, honest about above-cap surplus divergence), just scoped per member.
 *
 * Set to the maximum grid cells (512*512 = 262144) so one member can at most
 * fill the entire board once over -- generous for any honest use (which touches
 * a tiny fraction of the board, rate-limited to one cell per interval) while
 * bounding a single member's storage to a full-board's worth of rows.
 */
export const SYNC_PIXEL_MAX_STORED_PER_MEMBER = SYNC_PIXEL_GRID_MAX * SYNC_PIXEL_GRID_MAX;

/**
 * The furthest into the future a pixel createdAt may sit AT INGEST. Mirrors the
 * generic inbound gate's MAX_INBOUND_CLOCK_SKEW_MS (5 min). This is a WALL-CLOCK
 * check, so it lives ONLY in validateCanvasPixelRow (ingest); verify/resolve
 * stay pure (they run inside the deterministic resolver on every device and may
 * never read Date.now()). Any peer whose clock is within this window of real
 * time drops a far-future flood, closing the future half of codex defect 1
 * without breaking convergence of the pure resolve path.
 */
export const SYNC_PIXEL_MAX_FUTURE_SKEW_MS = 5 * 60_000;

export interface CommunityCanvasPixelEvent {
  version: 1;
  /** Content-addressed event id. */
  id: string;
  canvasId: string;
  communityId: string;
  x: number;
  y: number;
  /** Index into SYNC_PIXEL_PALETTE (closed vocabulary, never a raw color). */
  colorIndex: number;
  authorDevice: string;
  createdAt: string;
  signedBy: string;
  signature: string;
}

type UnsignedPixelEvent = Omit<CommunityCanvasPixelEvent, 'id' | 'signature'>;
type SignedPixelEventWithoutId = Omit<CommunityCanvasPixelEvent, 'id'>;

function canonicalCanvasPixel(event: UnsignedPixelEvent): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-canvas-pixel-v1',
    event.version,
    event.communityId,
    event.canvasId,
    event.x,
    event.y,
    event.colorIndex,
    event.authorDevice,
    event.createdAt,
    event.signedBy,
  ]));
}

export function canvasPixelEventId(event: SignedPixelEventWithoutId): string {
  const { signature, ...unsigned } = event;
  const canonical = canonicalCanvasPixel(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

export interface CreateCanvasPixelInput {
  canvasId: string;
  communityId: string;
  x: number;
  y: number;
  colorIndex: number;
  createdAt?: string;
}

/**
 * A pixel createdAt usable in the DETERMINISTIC resolver: strictly the
 * canonical Date.toISOString() form. `new Date(t).getTime()` must return the
 * identical epoch ms on every peer, but a non-canonical value like
 * "2026-08-29T12:00:00" (no Z) parses in the reader's LOCAL time zone, so two
 * devices would compute different intervals and resolve DIFFERENT boards from
 * the SAME events (codex defect 2). Requiring the round-trip canonical form
 * makes the parse timezone-independent.
 *
 * PURE by design (no wall clock): verifyCanvasPixelEvent calls this INSIDE
 * resolveCanvasPixels on every device, so it may only enforce timestamp FORMAT.
 * The far-future REJECT (which needs Date.now()) lives at INGEST in
 * validateCanvasPixelRow, never here.
 */
function isCanonicalUtcTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString() === value;
}

export function createCanvasPixelEvent(author: DeviceIdentity, input: CreateCanvasPixelInput): CommunityCanvasPixelEvent {
  if (!ID_PATTERN.test(input.canvasId)) throw new Error('A canvas id must be 16-64 hex characters.');
  if (!input.communityId) throw new Error('A community id is required.');
  if (!Number.isInteger(input.x) || !Number.isInteger(input.y)
    || input.x < 0 || input.y < 0 || input.x >= SYNC_PIXEL_GRID_MAX || input.y >= SYNC_PIXEL_GRID_MAX) {
    throw new Error('Pixel coordinates must sit inside the board.');
  }
  if (!Number.isInteger(input.colorIndex) || input.colorIndex < 0 || input.colorIndex >= SYNC_PIXEL_PALETTE.length) {
    throw new Error('Unknown palette color.');
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!isCanonicalUtcTimestamp(createdAt)) {
    throw new Error('A pixel timestamp must be canonical UTC (Date.toISOString()).');
  }
  const unsigned: UnsignedPixelEvent = {
    version: 1,
    canvasId: input.canvasId,
    communityId: input.communityId,
    x: input.x,
    y: input.y,
    colorIndex: input.colorIndex,
    authorDevice: author.publicKey,
    createdAt,
    signedBy: author.publicKey,
  };
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(author.privateKeyRef), canonicalCanvasPixel(unsigned)));
  const withoutId = { ...unsigned, signature };
  return { ...withoutId, id: canvasPixelEventId(withoutId) };
}

/** Structural + signature verification (author-signed; the author must sign for themself). */
export function verifyCanvasPixelEvent(event: CommunityCanvasPixelEvent): boolean {
  if (!event || event.version !== 1) return false;
  if (!ID_PATTERN.test(event.canvasId ?? '')) return false;
  if (!event.communityId) return false;
  // Canonical UTC only (PURE, no wall clock): a non-canonical createdAt would
  // make the resolver's Date math timezone-dependent and diverge peers.
  if (!isCanonicalUtcTimestamp(event.createdAt)) return false;
  if (event.signedBy !== event.authorDevice) return false;
  if (!Number.isInteger(event.x) || !Number.isInteger(event.y)
    || event.x < 0 || event.y < 0 || event.x >= SYNC_PIXEL_GRID_MAX || event.y >= SYNC_PIXEL_GRID_MAX) {
    return false;
  }
  if (!Number.isInteger(event.colorIndex) || event.colorIndex < 0 || event.colorIndex >= SYNC_PIXEL_PALETTE.length) {
    return false;
  }
  if (event.id !== canvasPixelEventId(event)) return false;
  try {
    const { id, signature, ...unsigned } = event;
    void id;
    return verifySignature(event.signedBy, canonicalCanvasPixel(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function canvasPixelEventToRow(event: CommunityCanvasPixelEvent): Record<string, unknown> {
  return {
    id: event.id,
    canvas_id: event.canvasId,
    community_id: event.communityId,
    x: event.x,
    y: event.y,
    color_index: event.colorIndex,
    author_device: event.authorDevice,
    created_at: event.createdAt,
    signed_by: event.signedBy,
    signature: event.signature,
  };
}

export function canvasPixelEventFromRow(data: Record<string, unknown>): CommunityCanvasPixelEvent | null {
  const id = data.id;
  const canvasId = data.canvas_id;
  const communityId = data.community_id;
  const authorDevice = data.author_device;
  const createdAt = data.created_at;
  const signedBy = data.signed_by;
  const signature = data.signature;
  if (typeof id !== 'string' || typeof canvasId !== 'string' || typeof communityId !== 'string') return null;
  if (typeof authorDevice !== 'string' || typeof createdAt !== 'string' || typeof signedBy !== 'string' || typeof signature !== 'string') return null;
  const x = data.x;
  const y = data.y;
  const colorIndex = data.color_index;
  if (typeof x !== 'number' || !Number.isInteger(x)) return null;
  if (typeof y !== 'number' || !Number.isInteger(y)) return null;
  if (typeof colorIndex !== 'number' || !Number.isInteger(colorIndex)) return null;
  return { version: 1, id, canvasId, communityId, x, y, colorIndex, authorDevice, createdAt, signedBy, signature };
}

/**
 * The deterministic CURRENT board and timelapse. Verify + membership, then a
 * total (createdAt, id) order, then collapse each member's placements to one
 * per interval as a PURE FUNCTION of the verified set. The same ordered list IS
 * the timelapse (7.6: nothing shown that the history does not contain).
 *
 * This resolve-time pass is the AUTHORITATIVE limit on what RENDERS. It runs
 * over the CONVERGED set: because the apply-time validator keeps only
 * order-independent gates (no per-member interval reject), every device stores
 * the same validly-signed rows, and because verify forces canonical UTC the
 * `new Date(createdAt).getTime()` interval math is identical on every device.
 * For each member only the earliest-(createdAt, id) placement in a window
 * survives, so a flood can never RENDER more than one cell per member per
 * interval, and every device resolves the identical board and history.
 *
 * Honest limit: this enforces CLAIMED-time spacing, not a wall-clock guarantee.
 * A serverless P2P board has no clock oracle, so a member who past-dates
 * WELL-SPACED forged timestamps can still author one rendered cell per claimed
 * interval -- an inherent limit, NOT a hard rate cap. What actually bounds such
 * a backdated, well-spaced flood is: the ingest far-future clock reject
 * (SYNC_PIXEL_MAX_FUTURE_SKEW_MS), the PER-MEMBER storage cap
 * (SYNC_PIXEL_MAX_STORED_PER_MEMBER, which caps how many of one signer's rows a
 * peer will ever store), receiver-side render dials, and community-level removal
 * of the offending member from the descriptor (dropping their membership makes
 * membershipOf return false, so none of their pixels resolve) or simply not
 * rendering a griefed board. There is NO curator tombstone at the pixel-row
 * level: pixel events carry no tombstone field and a raw DELETE is rejected, so
 * removal is by membership/descriptor, not by tombstoning individual pixels. Do
 * not read a hard wall-clock rate guarantee into this function.
 *
 * intervalSeconds comes from the board policy (pixelBoardConfig, never looser
 * than the protocol minimum); it defaults to the minimum so a caller that
 * omits it still fails safe, never open.
 */
export function resolveCanvasPixels(
  events: readonly CommunityCanvasPixelEvent[],
  membershipOf: (deviceId: string) => boolean,
  intervalSeconds: number = SYNC_PIXEL_MIN_INTERVAL_SECONDS,
): { cells: Map<string, CommunityCanvasPixelEvent>; ordered: CommunityCanvasPixelEvent[] } {
  const intervalMs = Math.max(0, intervalSeconds) * 1000;
  const verified = events
    .filter((event) => verifyCanvasPixelEvent(event) && membershipOf(event.signedBy))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
  const lastKeptMsByMember = new Map<string, number>();
  const ordered: CommunityCanvasPixelEvent[] = [];
  for (const event of verified) {
    const tMs = new Date(event.createdAt).getTime();
    if (!Number.isFinite(tMs)) continue; // unparseable timestamp: drop, fail-safe
    const last = lastKeptMsByMember.get(event.signedBy);
    // Within this member's own interval since their last KEPT placement: not a
    // valid placement (the earliest in the window already won). Different
    // members never rate-limit each other. Strict `<` keeps exactly-interval
    // spacing, matching the apply-time boundary and the honest local guard.
    if (last !== undefined && tMs - last < intervalMs) continue;
    lastKeptMsByMember.set(event.signedBy, tMs);
    ordered.push(event);
  }
  const cells = new Map<string, CommunityCanvasPixelEvent>();
  for (const event of ordered) cells.set(`${event.x},${event.y}`, event);
  return { cells, ordered };
}

/**
 * Apply-time validator: ONLY order-independent gates, so every device stores
 * the identical validly-signed set and resolveCanvasPixels (the authoritative
 * per-member rate limit) operates on the same rows everywhere. The gates:
 *   - raw DELETE rejected (tombstones are events, never deletes);
 *   - verified author signature (author signs for themself);
 *   - community known and the signer a member (never a viewer);
 *   - an existing, verified, non-tombstoned pixel_board canvas;
 *   - in-grid against the board's POLICY size;
 *   - an INGEST-only far-future clock reject (wall clock is allowed HERE, the
 *     one place it may be, unlike the pure verify/resolve path);
 *   - a PER-MEMBER COUNT storage cap (scoped by signer, so a single flooder
 *     exhausts only their own budget and never freezes honest members out).
 *
 * It deliberately does NOT rate-reject on a prior stored same-signer placement.
 * That check counted already-stored rows and so depended on the order rows
 * landed (apply + gossip re-delivery), which an adversary controls: peers then
 * stored DIFFERENT sets and never reconverged (codex defect 3, e.g. Q@T /
 * P@T+20 / E@T+40 -> device A stores {Q,E}, device B stores {Q}), and the
 * resolver cannot rate-limit what a device never stored. Rate limiting moved
 * wholly to resolveCanvasPixels, a pure function of the converged set.
 */
export function validateCanvasPixelRow(db: DatabaseAdapter, change: RowChange): CanvasRowVerdict {
  if (change.operation === 'DELETE') return { ok: false, reason: 'signed_row_delete_rejected' };
  if (!change.data) return { ok: false, reason: 'canvas_pixel_malformed' };
  const event = canvasPixelEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'canvas_pixel_malformed' };
  if (!verifyCanvasPixelEvent(event)) return { ok: false, reason: 'canvas_pixel_signature_invalid' };
  const descriptor = getDescriptor(db, event.communityId);
  if (!descriptor) return { ok: false, reason: 'canvas_pixel_community_unknown' };
  const role = communityRole(descriptor, event.signedBy);
  if (role === null || role === 'viewer') return { ok: false, reason: 'canvas_pixel_not_member' };
  let board: CommunityCanvasEvent | null = null;
  try {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM ${COMMUNITY_CANVAS_TABLE} WHERE id = ?`,
      [event.canvasId],
    );
    board = rows[0] ? canvasEventFromRow(rows[0]) : null;
  } catch {
    board = null;
  }
  if (!board || board.tombstone || board.kind !== 'pixel_board' || !verifyCanvasEvent(board, descriptor)) {
    return { ok: false, reason: 'canvas_pixel_board_unknown' };
  }
  const config = pixelBoardConfig(board.policyJson);
  if (event.x >= config.w || event.y >= config.h) return { ok: false, reason: 'canvas_pixel_out_of_grid' };
  // INGEST-only far-future reject (WALL CLOCK, allowed here). verify already
  // proved createdAt is canonical UTC (so this parse is finite and timezone-
  // independent); a member past-dating to 2099-... would otherwise pass the
  // pure format gate, sail through claimed-time spacing, and poison
  // last-writer-per-cell forever (codex defect 1). Any peer within
  // SYNC_PIXEL_MAX_FUTURE_SKEW_MS of real time drops it; this is a wall-clock
  // reject and therefore CANNOT live in the pure resolver.
  if (new Date(event.createdAt).getTime() > Date.now() + SYNC_PIXEL_MAX_FUTURE_SKEW_MS) {
    return { ok: false, reason: 'canvas_pixel_future_skew' };
  }
  // Order-independent PER-MEMBER storage cap: the ingest DoS bound now that the
  // per-member interval reject is gone. Scoped by signed_by so one flooder only
  // exhausts THEIR OWN budget and can never freeze honest members out of the
  // board (a whole-canvas COUNT here would let a single member's flood block
  // everyone). A per-signer COUNT threshold is order-independent for that
  // signer's accepted sub-cap set, so it does NOT reintroduce defect 3's
  // divergence below the cap -- every peer accepts the same rows from a given
  // signer until that member is saturated far past any legitimate use.
  try {
    const rows = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${COMMUNITY_CANVAS_PIXELS_TABLE} WHERE canvas_id = ? AND signed_by = ?`,
      [event.canvasId, event.signedBy],
    );
    if ((rows[0]?.n ?? 0) >= SYNC_PIXEL_MAX_STORED_PER_MEMBER) {
      return { ok: false, reason: 'canvas_pixel_storage_cap' };
    }
  } catch {
    // Missing table mid-migration: cap check skipped, signature gate held.
  }
  return { ok: true };
}

/**
 * The board configuration from a pixel_board policyJson: bounded grid size
 * and the per-member interval (never looser than the protocol minimum).
 * Malformed policy falls back to the defaults, fail-safe.
 */
export function pixelBoardConfig(policyJson: string | null): { w: number; h: number; intervalSeconds: number } {
  const fallback = { w: SYNC_PIXEL_GRID_DEFAULT, h: SYNC_PIXEL_GRID_DEFAULT, intervalSeconds: SYNC_PIXEL_MIN_INTERVAL_SECONDS };
  if (!policyJson) return fallback;
  try {
    const parsed = JSON.parse(policyJson) as { pixel?: { w?: unknown; h?: unknown; intervalSeconds?: unknown } };
    const raw = parsed?.pixel;
    if (!raw || typeof raw !== 'object') return fallback;
    const clampGrid = (value: unknown): number => (
      typeof value === 'number' && Number.isInteger(value) && value >= 8 && value <= SYNC_PIXEL_GRID_MAX
        ? value
        : SYNC_PIXEL_GRID_DEFAULT
    );
    const interval = typeof raw.intervalSeconds === 'number' && Number.isInteger(raw.intervalSeconds)
      ? Math.max(SYNC_PIXEL_MIN_INTERVAL_SECONDS, raw.intervalSeconds)
      : SYNC_PIXEL_MIN_INTERVAL_SECONDS;
    return { w: clampGrid(raw.w), h: clampGrid(raw.h), intervalSeconds: interval };
  } catch {
    return fallback;
  }
}
