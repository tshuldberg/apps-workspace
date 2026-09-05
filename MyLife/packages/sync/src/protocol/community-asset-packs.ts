/**
 * Community asset packs (Plan 56 feature 5, C2): uploader-signed packs of
 * custom reaction emoji and stickers, on the same signed spine as the canvas
 * events. Two event shapes in one lww table (cm_asset_packs):
 *
 *   - PACK (uploader-signed): defines a pack -- packId, name, and packKind
 *     ('emoji' | 'sticker'). The pack identity is packId; a higher-version
 *     event by the SAME uploader renames it; a tombstone removes it (and its
 *     items stop resolving).
 *   - ITEM (uploader-signed): one slot in a pack -- a slug plus EITHER a
 *     unicode glyph OR a sealed image asset (same CanvasNodeAsset shape as
 *     canvas nodes; the manifest rides asset_manifest_json so collectBlobRefs
 *     replicates the sealed blocks automatically). The item identity is
 *     (packId, slug); per-identity lww by (version, createdAt, id).
 *
 * Authority: any MEMBER uploads (signs) packs and items. A curator (owner or
 * admin) may sign a TOMBSTONE for another member's pack or item (moderation),
 * mirroring the canvas curator-remove exception; a curator can never forge
 * live content as someone else.
 *
 * Anti-spoofing (7.4): item glyphs run the same reserved trust-glyph
 * exclusion as badges AT PACK-VALIDATION TIME, so a custom "emoji" can never
 * counterfeit a checkmark or lock.
 *
 * Caps (section 10): the 64-item RENDER cap is enforced deterministically at
 * RESOLVE ((createdAt, id) over live items), the sole convergent authority, so
 * every device shows the same 64 slots regardless of delivery order; apply time
 * adds only an order-independent per-pack STORAGE bound. Manifest JSON <= 16 KB
 * per item (measured in ENCODED bytes). Byte caps on the underlying images are
 * enforced against the manifest's DECLARED plaintext size: a hard 512 KB ceiling
 * at create/verify (an item event has no packKind), and the precise per-kind cap
 * (256 KB emoji / 512 KB sticker) at resolve where the owning pack's kind is known.
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
import { isValidCanvasNodeAsset, type CanvasNodeAsset } from './community-canvas';
import { badgeGlyphAllowed } from './community-badges';

const encoder = new TextEncoder();

export const COMMUNITY_ASSET_PACKS_TABLE = 'cm_asset_packs';

export const SYNC_ASSET_PACK_ITEM_CAP = 64;
/**
 * Order-independent PER-PACK stored-item ceiling (the ingest DoS bound). The
 * 64-slot RENDER cap is the resolver's SOLE authority (see resolveCommunityAssetPacks);
 * apply time no longer rejects by DISTINCT slug (that was delivery-order-dependent
 * and diverged peers -- codex DEFECT 1). Only a pack OWNER can author items under
 * an owner-bound packId, so a COUNT over (community_id, pack_id) is effectively
 * scoped to that one owner and self-limiting: a flooder exhausts only their own
 * pack's budget. Set to 16x the 64 rendered cap so each of the 64 slugs can be
 * re-versioned ~16 times (or fewer slugs versioned far more) WITH tombstone rows,
 * generous for any honest re-versioning while bounding one owner's stored rows.
 */
export const SYNC_ASSET_PACK_MAX_STORED_ITEMS_PER_PACK = SYNC_ASSET_PACK_ITEM_CAP * 16;
export const SYNC_ASSET_PACK_MANIFEST_MAX_BYTES = 16 * 1024;
export const SYNC_ASSET_PACK_EMOJI_MAX_BYTES = 256 * 1024;
export const SYNC_ASSET_PACK_STICKER_MAX_BYTES = 512 * 1024;
export const ASSET_PACK_NAME_MAX_CHARS = 60;

const ID_PATTERN = /^[0-9a-f]{16,64}$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/;

// --- pack identity is bound to the creator's key ---------------------------
// A packId is 64 hex: the first 128 bits COMMIT to the uploader's public key
// (sha512 over a domain tag + the key), the last 128 bits are a per-pack
// nonce. Because the prefix is a one-way function of the signer, a member
// cannot mint a live pack or item under someone else's packId -- the binding
// check below fails for any signer whose key does not reproduce the prefix.
// This replaces the old "earliest createdAt is the owner" rule, which a
// backdated timestamp defeated (a member could hijack any known packId/slug).
const ASSET_PACK_ID_TAG = 'meerkat-asset-pack-owner-v1';
const ASSET_PACK_ID_SUFFIX_HEX = 32;

/** The 128-bit owner-committing prefix of every packId this signer may mint. */
export function assetPackOwnerPrefix(uploaderPubkey: string): string {
  return sha512Hex(encoder.encode(`${ASSET_PACK_ID_TAG}|${uploaderPubkey}`)).slice(0, 32);
}

/** Mint a packId bound to `uploaderPubkey`; `suffixHex` is a 32-hex per-pack nonce. */
export function deriveAssetPackId(uploaderPubkey: string, suffixHex: string): string {
  if (!/^[0-9a-f]{32}$/.test(suffixHex)) throw new Error('A pack id nonce must be 32 hex characters.');
  return assetPackOwnerPrefix(uploaderPubkey) + suffixHex;
}

/** True when `packId` is a well-formed id whose owner-prefix is this signer's. */
export function packIdBoundToOwner(packId: string, uploaderPubkey: string): boolean {
  if (typeof packId !== 'string' || packId.length !== 32 + ASSET_PACK_ID_SUFFIX_HEX) return false;
  if (!/^[0-9a-f]+$/.test(packId)) return false;
  return packId.slice(0, 32) === assetPackOwnerPrefix(uploaderPubkey);
}

export const ASSET_PACK_KINDS = ['emoji', 'sticker'] as const;
export type AssetPackKind = (typeof ASSET_PACK_KINDS)[number];

export type CommunityAssetPackEventKind = 'pack' | 'item';

export interface CommunityAssetPackEvent {
  version: 1;
  /** Content-addressed event id. */
  id: string;
  communityId: string;
  kind: CommunityAssetPackEventKind;
  /** The pack identity (pack events choose it; items reference it). */
  packId: string;
  /** pack: display name; null on items. */
  name: string | null;
  /** pack: 'emoji' | 'sticker'; null on items. */
  packKind: AssetPackKind | null;
  /** item: the slot slug ([a-z0-9_-], 2-32); null on packs. */
  slug: string | null;
  /** item: unicode glyph (reserved trust glyphs excluded). XOR asset. */
  glyph: string | null;
  /** item: sealed image asset (same shape as canvas nodes). XOR glyph. */
  asset: CanvasNodeAsset | null;
  /** Per-identity lww version (packId, or packId+slug). */
  entryVersion: number;
  tombstone: boolean;
  createdAt: string;
  signedBy: string;
  signature: string;
}

export type UnsignedAssetPackEvent = Omit<CommunityAssetPackEvent, 'id' | 'signature'>;
type SignedAssetPackEventWithoutId = Omit<CommunityAssetPackEvent, 'id'>;

function canonicalAssetPack(event: UnsignedAssetPackEvent): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-community-asset-pack-v1',
    event.version,
    event.communityId,
    event.kind,
    event.packId,
    event.name,
    event.packKind,
    event.slug,
    event.glyph,
    event.asset === null ? null : [event.asset.cid, event.asset.keyEpoch, event.asset.wrappedKey, event.asset.manifestJson],
    event.entryVersion,
    event.tombstone ? 1 : 0,
    event.createdAt,
    event.signedBy,
  ]));
}

export function assetPackEventId(event: SignedAssetPackEventWithoutId): string {
  const { signature, ...unsigned } = event;
  const canonical = canonicalAssetPack(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

/**
 * Sign + content-address an already-shaped event. A low-level protocol seam
 * shared by createAssetPackEvent / createAssetPackItemEvent (removes duplicated
 * signing) that also lets a test construct an event whose ONLY fault is a
 * SPECIFIC downstream gate (e.g. an oversized declared size that create refuses
 * to mint). This seam never weakens the trust boundary: the receiver's
 * verifyAssetPackEvent re-checks every structural, glyph, asset, size, id, and
 * signature constraint before a row is accepted.
 */
export function signAssetPackEvent(uploader: DeviceIdentity, unsigned: UnsignedAssetPackEvent): CommunityAssetPackEvent {
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(uploader.privateKeyRef), canonicalAssetPack(unsigned)));
  const withoutId = { ...unsigned, signature };
  return { ...withoutId, id: assetPackEventId(withoutId) };
}

/** The declared plaintext size a sealed pack asset may claim, by pack kind. */
export function assetPackByteCap(packKind: AssetPackKind): number {
  return packKind === 'emoji' ? SYNC_ASSET_PACK_EMOJI_MAX_BYTES : SYNC_ASSET_PACK_STICKER_MAX_BYTES;
}

/**
 * The declared plaintext byte size in a sealed asset manifest (NodeManifest.size),
 * or null when the manifest carries no numeric/finite size field.
 * isValidCanvasNodeAsset has already proven the JSON parses and the shape is
 * sound. This is a raw extractor; the fail-closed acceptance policy lives in
 * sealedAssetSizeAcceptable.
 */
function assetDeclaredSize(asset: CanvasNodeAsset): number | null {
  try {
    const parsed = JSON.parse(asset.manifestJson) as { manifest?: { size?: unknown } };
    const size = parsed?.manifest?.size;
    return typeof size === 'number' && Number.isFinite(size) ? size : null;
  } catch {
    return null;
  }
}

/**
 * Fail-closed gate for a sealed pack asset's DECLARED plaintext size at
 * create AND verify (codex DEFECT 2, missing/negative-size hole). A NodeManifest
 * REQUIRES a size (packages/sync/src/node/sealed-share.ts), so an item that
 * carries a sealed asset MUST declare a PRESENT, integer, non-negative size that
 * is within the hard 512 KB protocol ceiling. Absent, non-integer, or negative
 * is malformed and rejected: a dishonest tiny/absent/negative size must never
 * buy a pass on the byte budget. An item event carries no packKind, so this
 * enforces the MAXIMUM per-kind cap here; the precise per-kind cap (256 KB emoji
 * / 512 KB sticker) is applied at resolve where the owning pack's kind is known.
 *
 * BLOCK-FETCH RESIDUAL (honest, do NOT overclaim): this ceiling bounds the
 * STORED row's declared size and the resolve-time per-kind drop bounds the
 * RENDERED item, but sync's collectBlobRefs
 * (packages/sync/src/protocol/blob-transfer.ts) requests block hashes from every
 * *_manifest_json row before/without acceptance knowledge, so the sealed blocks
 * of an oversized/rejected asset can still be fetched -- bounded only by the
 * generic 50 MB/blob transfer policy, NOT this per-pack 256/512 KB cap.
 * Pack-precise FETCH bounding requires a blob-transfer change and is
 * deliberately NOT reworked in this pass (tracked separately). Current
 * mitigations are exactly this verify size ceiling, the resolve-time per-kind
 * render drop, and the generic blob policy.
 */
function sealedAssetSizeAcceptable(asset: CanvasNodeAsset): boolean {
  const declared = assetDeclaredSize(asset);
  return declared !== null
    && Number.isInteger(declared)
    && declared >= 0
    && declared <= SYNC_ASSET_PACK_STICKER_MAX_BYTES;
}

/** True when a (possibly null glyph) item's declared asset size fits a per-kind cap. */
function assetSizeWithinCap(asset: CanvasNodeAsset | null, cap: number): boolean {
  if (asset === null) return true; // glyph items carry no bytes
  const declared = assetDeclaredSize(asset);
  return declared === null || declared <= cap;
}

export interface AssetPackDefineInput {
  communityId: string;
  packId: string;
  name: string;
  packKind: AssetPackKind;
  entryVersion?: number;
  tombstone?: boolean;
  createdAt?: string;
}

export function createAssetPackEvent(uploader: DeviceIdentity, input: AssetPackDefineInput): CommunityAssetPackEvent {
  if (!ID_PATTERN.test(input.packId)) throw new Error('A pack id must be 16-64 hex characters.');
  // A live pack event must sit under the creator's own owner-bound packId; a
  // tombstone may also be a curator moderation event (a different signer), so
  // the binding is only required when the event carries live content.
  if (input.tombstone !== true && !packIdBoundToOwner(input.packId, uploader.publicKey)) {
    throw new Error('A pack id must be derived from your own key (use deriveAssetPackId).');
  }
  const name = input.name.trim();
  if (!name || name.length > ASSET_PACK_NAME_MAX_CHARS) throw new Error('A pack name must be 1-60 characters.');
  if (!(ASSET_PACK_KINDS as readonly string[]).includes(input.packKind)) throw new Error('Unknown pack kind.');
  const entryVersion = input.entryVersion ?? 1;
  if (!Number.isInteger(entryVersion) || entryVersion < 1) throw new Error('entryVersion must be a positive integer.');
  const unsigned: UnsignedAssetPackEvent = {
    version: 1,
    communityId: input.communityId,
    kind: 'pack',
    packId: input.packId,
    name,
    packKind: input.packKind,
    slug: null,
    glyph: null,
    asset: null,
    entryVersion,
    tombstone: input.tombstone === true,
    createdAt: input.createdAt ?? new Date().toISOString(),
    signedBy: uploader.publicKey,
  };
  return signAssetPackEvent(uploader, unsigned);
}

export interface AssetPackItemInput {
  communityId: string;
  packId: string;
  slug: string;
  glyph?: string | null;
  asset?: CanvasNodeAsset | null;
  entryVersion?: number;
  tombstone?: boolean;
  createdAt?: string;
}

export function createAssetPackItemEvent(uploader: DeviceIdentity, input: AssetPackItemInput): CommunityAssetPackEvent {
  if (!ID_PATTERN.test(input.packId)) throw new Error('A pack id must be 16-64 hex characters.');
  if (!SLUG_PATTERN.test(input.slug)) throw new Error('An item slug must be 2-32 lowercase letters, digits, _ or -.');
  const glyph = input.glyph ?? null;
  const asset = input.asset ?? null;
  const tombstone = input.tombstone === true;
  // Live item content must sit under the creator's own owner-bound packId (a
  // curator moderation tombstone is exempt, verified by role at resolve time).
  if (!tombstone && !packIdBoundToOwner(input.packId, uploader.publicKey)) {
    throw new Error('A pack id must be derived from your own key (use deriveAssetPackId).');
  }
  if (!tombstone) {
    if ((glyph === null) === (asset === null)) {
      throw new Error('A pack item carries exactly one of a glyph or a sealed image.');
    }
    if (glyph !== null && !badgeGlyphAllowed(glyph)) throw new Error('That glyph is reserved or invalid.');
    if (asset !== null) {
      if (!isValidCanvasNodeAsset(asset)) throw new Error('That pack asset is malformed.');
      // Encoded BYTE length, not UTF-16 .length: a multibyte manifest under the
      // char count could still blow the byte budget (codex DEFECT 2b).
      if (encoder.encode(asset.manifestJson).length > SYNC_ASSET_PACK_MANIFEST_MAX_BYTES) {
        throw new Error('That pack asset manifest is too large.');
      }
      // Fail-closed on the sealed asset's DECLARED plaintext size: it must be
      // present, integer, non-negative, and within the hard 512 KB ceiling (an
      // absent/negative/tiny-dishonest size is malformed, not a free pass). The
      // precise per-kind cap is applied at resolve where the pack's kind is
      // known; see sealedAssetSizeAcceptable for the block-fetch residual
      // (codex DEFECT 2).
      if (!sealedAssetSizeAcceptable(asset)) {
        throw new Error('That pack asset declares a missing or out-of-range size.');
      }
    }
  }
  const entryVersion = input.entryVersion ?? 1;
  if (!Number.isInteger(entryVersion) || entryVersion < 1) throw new Error('entryVersion must be a positive integer.');
  const unsigned: UnsignedAssetPackEvent = {
    version: 1,
    communityId: input.communityId,
    kind: 'item',
    packId: input.packId,
    name: null,
    packKind: null,
    slug: input.slug,
    glyph: tombstone ? null : glyph,
    asset: tombstone ? null : asset,
    entryVersion,
    tombstone,
    createdAt: input.createdAt ?? new Date().toISOString(),
    signedBy: uploader.publicKey,
  };
  return signAssetPackEvent(uploader, unsigned);
}

/**
 * Verify against the descriptor. Live content binds to a MEMBER signer; a
 * TOMBSTONE also verifies from a curator (owner/admin) as the moderation
 * path. Fail-closed on any structural, glyph, asset, id, or signature fault.
 */
export function verifyAssetPackEvent(event: CommunityAssetPackEvent, descriptor: CommunityDescriptor): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.communityId || event.communityId !== descriptor.communityId) return false;
  if (!ID_PATTERN.test(event.packId ?? '')) return false;
  if (!event.createdAt || !event.signedBy) return false;
  if (!Number.isInteger(event.entryVersion) || event.entryVersion < 1) return false;
  if (typeof event.tombstone !== 'boolean') return false;
  const role = communityRole(descriptor, event.signedBy);
  if (role === null) return false;
  // Live content (pack or item) MUST sit under the signer's own owner-bound
  // packId, so a member can never author under another member's pack. A
  // tombstone is exempt here: it may be a curator moderation event by a
  // different signer, whose authority is the role check + resolve-time gate.
  if (!event.tombstone && !packIdBoundToOwner(event.packId, event.signedBy)) return false;
  if (event.kind === 'pack') {
    if (event.slug !== null || event.glyph !== null || event.asset !== null) return false;
    if (typeof event.name !== 'string' || !event.name || event.name.length > ASSET_PACK_NAME_MAX_CHARS) return false;
    if (!(ASSET_PACK_KINDS as readonly string[]).includes(event.packKind as string)) return false;
  } else if (event.kind === 'item') {
    if (event.name !== null || event.packKind !== null) return false;
    if (typeof event.slug !== 'string' || !SLUG_PATTERN.test(event.slug)) return false;
    if (event.tombstone) {
      if (event.glyph !== null || event.asset !== null) return false;
    } else {
      if ((event.glyph === null) === (event.asset === null)) return false;
      if (event.glyph !== null && !badgeGlyphAllowed(event.glyph)) return false;
      if (event.asset !== null) {
        if (!isValidCanvasNodeAsset(event.asset)) return false;
        // Encoded BYTE length, not UTF-16 .length (codex DEFECT 2b).
        if (encoder.encode(event.asset.manifestJson).length > SYNC_ASSET_PACK_MANIFEST_MAX_BYTES) return false;
        // Fail-closed declared-size gate: present, integer, non-negative, and
        // within the hard 512 KB ceiling (a missing/negative size is malformed,
        // not a free pass -- codex DEFECT 2). Precise per-kind cap at resolve.
        if (!sealedAssetSizeAcceptable(event.asset)) return false;
      }
    }
  } else {
    return false;
  }
  if (event.id !== assetPackEventId(event)) return false;
  try {
    const { id, signature, ...unsigned } = event;
    void id;
    return verifySignature(event.signedBy, canonicalAssetPack(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

export function assetPackEventToRow(event: CommunityAssetPackEvent): Record<string, unknown> {
  return {
    id: event.id,
    community_id: event.communityId,
    kind: event.kind,
    pack_id: event.packId,
    name: event.name,
    pack_kind: event.packKind,
    slug: event.slug,
    glyph: event.glyph,
    asset_cid: event.asset?.cid ?? null,
    asset_key_epoch: event.asset?.keyEpoch ?? null,
    asset_wrapped_key: event.asset?.wrappedKey ?? null,
    asset_manifest_json: event.asset?.manifestJson ?? null,
    entry_version: event.entryVersion,
    tombstone: event.tombstone ? 1 : 0,
    created_at: event.createdAt,
    signed_by: event.signedBy,
    signature: event.signature,
  };
}

function rowString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : undefined;
}

export function assetPackEventFromRow(data: Record<string, unknown>): CommunityAssetPackEvent | null {
  const id = rowString(data.id);
  const communityId = rowString(data.community_id);
  const kind = rowString(data.kind);
  const packId = rowString(data.pack_id);
  const createdAt = rowString(data.created_at);
  const signedBy = rowString(data.signed_by);
  const signature = rowString(data.signature);
  if (!id || !communityId || !kind || !packId || !createdAt || !signedBy || !signature) return null;
  if (kind !== 'pack' && kind !== 'item') return null;
  const name = rowString(data.name);
  const packKind = rowString(data.pack_kind);
  const slug = rowString(data.slug);
  const glyph = rowString(data.glyph);
  if (name === undefined || packKind === undefined || slug === undefined || glyph === undefined) return null;
  if (packKind !== null && !(ASSET_PACK_KINDS as readonly string[]).includes(packKind)) return null;
  const versionRaw = data.entry_version;
  if (typeof versionRaw !== 'number' || !Number.isInteger(versionRaw)) return null;
  const tombstoneRaw = data.tombstone;
  if (tombstoneRaw !== 0 && tombstoneRaw !== 1 && typeof tombstoneRaw !== 'boolean') return null;
  const assetCid = rowString(data.asset_cid);
  const assetWrappedKey = rowString(data.asset_wrapped_key);
  const assetManifest = rowString(data.asset_manifest_json);
  if (assetCid === undefined || assetWrappedKey === undefined || assetManifest === undefined) return null;
  let asset: CanvasNodeAsset | null = null;
  if (assetCid !== null) {
    const epochRaw = data.asset_key_epoch;
    if (typeof epochRaw !== 'number' || !Number.isInteger(epochRaw)) return null;
    if (assetWrappedKey === null || assetManifest === null) return null;
    asset = { cid: assetCid, keyEpoch: epochRaw, wrappedKey: assetWrappedKey, manifestJson: assetManifest };
  }
  return {
    version: 1,
    id,
    communityId,
    kind: kind as CommunityAssetPackEventKind,
    packId,
    name,
    packKind: packKind as AssetPackKind | null,
    slug,
    glyph,
    asset,
    entryVersion: versionRaw,
    tombstone: tombstoneRaw === 1 || tombstoneRaw === true,
    createdAt,
    signedBy,
    signature,
  };
}

export interface ResolvedAssetPackItem {
  slug: string;
  glyph: string | null;
  asset: CanvasNodeAsset | null;
  uploadedBy: string;
}

export interface ResolvedAssetPack {
  packId: string;
  name: string;
  packKind: AssetPackKind;
  uploadedBy: string;
  /** Slots honored within the 64-item cap, in deterministic (createdAt, id) order. */
  items: ResolvedAssetPackItem[];
}

/** Deterministic per-identity winner: higher entryVersion, then createdAt, then id. */
function beats(a: CommunityAssetPackEvent, b: CommunityAssetPackEvent): boolean {
  if (a.entryVersion !== b.entryVersion) return a.entryVersion > b.entryVersion;
  if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt;
  return a.id > b.id;
}

/**
 * Resolve packs from candidate events. Rules, all fail-closed and 7.6-honest:
 *  - only VERIFIED events participate; a live pack/item event is verified ONLY
 *    if its packId is owner-bound to its signer (packIdBoundToOwner), so the
 *    pack owner is proven by the id itself and no backdated timestamp can
 *    hijack a slug -- the owner is whoever the packId commits to, full stop;
 *  - among an identity's live events the winner is the highest
 *    (entryVersion, createdAt, id); an OWNER self-tombstone is LWW (the owner
 *    may re-add at a higher entryVersion);
 *  - a CURATOR moderation tombstone (signed by an owner/admin who is NOT the
 *    pack owner) is PERMANENT: it kills the identity for good and no re-upload
 *    at any entryVersion resurrects it (mirrors the canvas curator_remove);
 *  - packs cap at 64 honored items, earliest (createdAt, id) win the slots.
 */
export function resolveCommunityAssetPacks(
  events: readonly CommunityAssetPackEvent[],
  descriptor: CommunityDescriptor,
): ResolvedAssetPack[] {
  const verified = events.filter((event) => verifyAssetPackEvent(event, descriptor));
  const curatorOf = (deviceId: string) => {
    const role = communityRole(descriptor, deviceId);
    return role === 'owner' || role === 'admin';
  };
  const ownsPack = (deviceId: string, packId: string) => packIdBoundToOwner(packId, deviceId);

  const live = new Map<string, CommunityAssetPackEvent>();
  // OWNER self-tombstone high-water mark (LWW): the owner may outrun their own.
  const ownerKilledAt = new Map<string, number>();
  // CURATOR moderation kill: permanent, entryVersion-independent.
  const moderationKilled = new Set<string>();
  for (const event of verified) {
    const key = event.kind === 'pack' ? `p:${event.packId}` : `i:${event.packId}:${event.slug}`;
    if (event.tombstone) {
      if (ownsPack(event.signedBy, event.packId)) {
        // The owner deleting their own entry -- ordinary LWW.
        ownerKilledAt.set(key, Math.max(ownerKilledAt.get(key) ?? 0, event.entryVersion));
      } else if (curatorOf(event.signedBy)) {
        // Moderation by a curator who is not the owner -- durable removal.
        moderationKilled.add(key);
      }
      // Any other tombstone signer is ignored (never had authority).
      continue;
    }
    // Live events are already owner-bound by verifyAssetPackEvent, so every
    // live event for a packId is necessarily signed by that one owner.
    const current = live.get(key);
    if (!current || beats(event, current)) live.set(key, event);
  }

  const survives = (key: string, event: CommunityAssetPackEvent): boolean =>
    !moderationKilled.has(key) && event.entryVersion > (ownerKilledAt.get(key) ?? 0);

  const packs: ResolvedAssetPack[] = [];
  const packEvents = [...live.values()]
    .filter((event) => event.kind === 'pack' && survives(`p:${event.packId}`, event))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const pack of packEvents) {
    // Precise per-kind byte cap: an item event carries no packKind, so the
    // owning pack's kind (known only here) is what bounds its sealed asset
    // (256 KB emoji / 512 KB sticker). An item whose DECLARED asset size exceeds
    // its pack's cap is dropped BEFORE the slot slice so it never consumes a
    // rendered slot; this filter is a property of the item alone, so it stays
    // order-independent and convergent (codex DEFECT 2a).
    const kindCap = assetPackByteCap(pack.packKind as AssetPackKind);
    const items = [...live.values()]
      .filter((event) => event.kind === 'item'
        && event.packId === pack.packId
        && survives(`i:${event.packId}:${event.slug}`, event)
        && assetSizeWithinCap(event.asset, kindCap))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1))
      .slice(0, SYNC_ASSET_PACK_ITEM_CAP)
      .map((event) => ({
        slug: event.slug as string,
        glyph: event.glyph,
        asset: event.asset,
        uploadedBy: event.signedBy,
      }));
    packs.push({
      packId: pack.packId,
      name: pack.name as string,
      packKind: pack.packKind as AssetPackKind,
      uploadedBy: pack.signedBy,
      items,
    });
  }
  return packs;
}

// --- apply-time validator --------------------------------------------------

export type AssetPackRowVerdict = { ok: true } | { ok: false; reason: string };

export function validateAssetPackRow(
  db: DatabaseAdapter,
  change: { table: string; rowId: string; operation: string; data: Record<string, unknown> | null | undefined },
): AssetPackRowVerdict {
  if (!change.data) return { ok: false, reason: 'asset_pack_row_malformed' };
  const event = assetPackEventFromRow(change.data);
  if (!event) return { ok: false, reason: 'asset_pack_row_malformed' };
  const community = getCommunity(db, event.communityId);
  if (!community) return { ok: false, reason: 'asset_pack_community_unknown' };
  if (!verifyAssetPackEvent(event, community.descriptor)) return { ok: false, reason: 'asset_pack_signature_invalid' };
  if (event.kind === 'item') {
    // ORDER-INDEPENDENT per-pack storage cap (codex DEFECT 1, tombstone-accounting
    // fix). The gate now covers ALL item inserts -- LIVE and TOMBSTONE alike --
    // and COUNTs ALL item rows for (community_id, pack_id). Storage here is
    // APPEND-ONLY: a tombstone is itself a stored row. The previous gate ran only
    // for live inserts, which let an attacker flood UNBOUNDED tombstone rows (the
    // storage was never actually capped) while a live insert could still be
    // rejected once enough tombstones accumulated (delivery-order dependent).
    // Counting ALL item rows and gating ALL item inserts bounds TOTAL storage
    // honestly. Consequence, stated plainly: tombstoning frees a RENDER slot (the
    // resolver already excludes tombstoned slugs) but NOT a STORAGE slot, and at
    // the ceiling even a moderation/self tombstone is refused.
    //
    // Convergence of the RENDERED packs is guaranteed for the ACCEPTED set below
    // this storage boundary -- resolveCommunityAssetPacks is the deterministic
    // render authority (the first 64 by (createdAt, id) over live items). This
    // storage cap is an anti-DoS bound only, and its at-boundary acceptance is
    // delivery-order dependent in the ABUSE regime ABOVE the cap. That weakening
    // is DELIBERATE and consistent with the pre-existing SYNC_CANVAS_STROKE_CAP /
    // node COUNT caps enforced the same way in community-canvas.ts
    // (validateCanvasStrokeRow / validateCanvasNodeRow) and the merged C3
    // per-member pixel cap. This explicit statement is the accepted condition.
    const rows = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${COMMUNITY_ASSET_PACKS_TABLE}
       WHERE community_id = ? AND pack_id = ? AND kind = 'item'`,
      [event.communityId, event.packId],
    );
    if ((rows[0]?.n ?? 0) >= SYNC_ASSET_PACK_MAX_STORED_ITEMS_PER_PACK) {
      return { ok: false, reason: 'asset_pack_storage_cap' };
    }
  }
  return { ok: true };
}
