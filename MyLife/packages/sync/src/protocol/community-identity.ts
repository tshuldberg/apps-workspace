/**
 * Community identity (Plan 38, Phase 0/1): OWNER-signed cosmetic identity for
 * a community -- description, accent color, icon, banner, and an optional
 * @mylife/meerkat-theme codec blob.
 *
 * Design decision 1 (Plan 38): structure (channels, categories, layout) lives
 * in the signed descriptor; cosmetic identity changes often and must not force
 * descriptor revisions, so it is a separate owner-signed row-set modeled on
 * cm_profiles (community-profile.ts): latest-owner-signed-wins, verified at
 * create AND verify with the same caps (fail-closed), and an UNVERIFIED
 * identity event renders NOTHING (exactly the avatar rule).
 *
 * Media model (Phase 1a):
 * - The ICON is IN-ROW base64 JPEG under the exact avatar gate
 *   (isValidCommunityAvatarImage, 32 KB decoded cap): icons render in lists
 *   everywhere and must not wait on a block fetch.
 * - The BANNER is a SEALED LIBRARY OBJECT (library-objects.ts): the signed row
 *   carries its contentId, the epoch-wrapped DEK (bannerKeyEpoch +
 *   bannerWrappedKey), and the sealed-object manifest JSON whose
 *   sealedChunkIds feed the existing blob-transfer collector
 *   (banner_manifest_json column). Membership is the read capability, same as
 *   library items. The four banner fields are ALL-OR-NOTHING.
 *
 * The signer MUST be the community owner: verification binds signedBy to the
 * descriptor's ownerDeviceId (ownership handoff is future work everywhere in
 * this protocol; community.ts has the same posture). Tombstone-able: a signed
 * tombstone event clears the identity back to defaults.
 *
 * The theme blob is opaque here: the sync package does not depend on
 * @mylife/meerkat-theme. It is capped and control-character-free at this
 * layer; the APP decodes it through the Plan 18 codec, which fails safe to no
 * theme on a malformed value.
 */

import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import { isValidCommunityAvatarImage } from './community-profile';

const encoder = new TextEncoder();

/** Hard cap on the community description (characters, after normalization). */
export const COMMUNITY_DESCRIPTION_MAX_CHARS = 280;
/** Hard cap on the theme codec blob (characters). */
export const COMMUNITY_THEME_BLOB_MAX_CHARS = 16 * 1024;
/** Hard cap on the banner sealed object's PLAINTEXT size (manifest.size). */
export const COMMUNITY_BANNER_MAX_BYTES = 512 * 1024;
/** Hard cap on the banner manifest JSON carried in the row (characters). */
export const COMMUNITY_BANNER_MANIFEST_MAX_CHARS = 32 * 1024;

const ACCENT_COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const CONTENT_ID_PATTERN = /^[0-9a-f]{16,128}$/;
const WRAPPED_KEY_PATTERN = /^[0-9a-f]{96,512}$/;

export interface CommunityIdentityBanner {
  /** Sealed-object content id (plaintext Merkle root). */
  cid: string;
  /** Workspace epoch the DEK wraps under. */
  keyEpoch: number;
  /** hex(nonce || secretbox(DEK)) from wrapLibraryObjectKey. */
  wrappedKey: string;
  /**
   * JSON of { manifest, manifestSignature, sealedChunkIds } -- the manifest is
   * independently author-signed by the sealed-share layer (self-verifying);
   * sealedChunkIds feed the blob-transfer collector so banner blocks replicate.
   */
  manifestJson: string;
}

export interface CommunityIdentityEvent {
  version: 1;
  id: string;
  communityId: string;
  /** Monotonic per community; the highest VERIFIED revision wins. */
  revision: number;
  description: string | null;
  /** Lowercase #rrggbb; normalized at create, required normalized at verify. */
  accentColor: string | null;
  /** IN-ROW base64 JPEG icon under the exact avatar gate (32 KB decoded). */
  iconImage: string | null;
  /** Sealed-object banner (all four fields present, or null). */
  banner: CommunityIdentityBanner | null;
  /** @mylife/meerkat-theme codec string (opaque at this layer), if set. */
  themeBlob: string | null;
  /** A signed tombstone clears the identity back to defaults. */
  tombstone: boolean;
  updatedAt: string;
  /** MUST equal the community descriptor's ownerDeviceId (verified). */
  signedBy: string;
  signature: string;
}

export interface CommunityIdentityInput {
  communityId: string;
  revision: number;
  description?: string | null;
  accentColor?: string | null;
  iconImage?: string | null;
  banner?: CommunityIdentityBanner | null;
  themeBlob?: string | null;
  tombstone?: boolean;
  updatedAt?: string;
}

type UnsignedCommunityIdentityEvent = Omit<CommunityIdentityEvent, 'id' | 'signature'>;
type SignedCommunityIdentityEventWithoutId = Omit<CommunityIdentityEvent, 'id'>;

function normalizeDescription(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, COMMUNITY_DESCRIPTION_MAX_CHARS);
}

function normalizeAccentColor(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim().toLowerCase();
  if (!trimmed) return null;
  if (!ACCENT_COLOR_PATTERN.test(trimmed)) {
    throw new Error('Accent color must be a #rrggbb hex value.');
  }
  return trimmed;
}

function normalizeIconImage(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (!isValidCommunityAvatarImage(trimmed)) {
    throw new Error('That icon image is too large or not a supported format.');
  }
  return trimmed;
}

/** In-cap, control-character-free theme codec string (opaque otherwise). */
export function isValidCommunityThemeBlob(value: string): boolean {
  if (!value || value.length > COMMUNITY_THEME_BLOB_MAX_CHARS) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\s\u0000-\u001f\u007f]/.test(value); // single token: no whitespace, no controls
}

function normalizeThemeBlob(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (!isValidCommunityThemeBlob(trimmed)) {
    throw new Error('That community theme is too large or malformed.');
  }
  return trimmed;
}

/**
 * Structural + cap validation of a banner value. Checks the field shapes and
 * the manifest JSON structure INCLUDING the plaintext size cap (manifest.size)
 * -- the cryptographic verification (manifest signature, chunk hashes,
 * decrypt) happens when the sealed object is opened, fail-closed there too.
 */
export function isValidCommunityIdentityBanner(banner: CommunityIdentityBanner): boolean {
  if (!banner) return false;
  if (!CONTENT_ID_PATTERN.test(banner.cid)) return false;
  if (!Number.isInteger(banner.keyEpoch) || banner.keyEpoch < 1) return false;
  if (!WRAPPED_KEY_PATTERN.test(banner.wrappedKey)) return false;
  if (typeof banner.manifestJson !== 'string' || banner.manifestJson.length === 0) return false;
  if (banner.manifestJson.length > COMMUNITY_BANNER_MANIFEST_MAX_CHARS) return false;
  try {
    const parsed = JSON.parse(banner.manifestJson) as {
      manifest?: { contentId?: unknown; size?: unknown };
      manifestSignature?: unknown;
      sealedChunkIds?: unknown;
    };
    if (typeof parsed?.manifestSignature !== 'string') return false;
    if (!Array.isArray(parsed?.sealedChunkIds) || parsed.sealedChunkIds.length === 0) return false;
    if (!parsed.sealedChunkIds.every((s) => typeof s === 'string' && CONTENT_ID_PATTERN.test(s))) return false;
    if (parsed?.manifest?.contentId !== banner.cid) return false;
    const size = parsed?.manifest?.size;
    if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > COMMUNITY_BANNER_MAX_BYTES) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function normalizeBanner(value: CommunityIdentityBanner | null | undefined): CommunityIdentityBanner | null {
  if (!value) return null;
  const banner: CommunityIdentityBanner = {
    cid: value.cid.trim().toLowerCase(),
    keyEpoch: value.keyEpoch,
    wrappedKey: value.wrappedKey.trim().toLowerCase(),
    manifestJson: value.manifestJson,
  };
  if (!isValidCommunityIdentityBanner(banner)) {
    throw new Error('That banner is too large or malformed.');
  }
  return banner;
}

function canonicalCommunityIdentity(event: UnsignedCommunityIdentityEvent): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-community-identity-v1',
    event.version,
    event.communityId,
    event.revision,
    event.description,
    event.accentColor,
    event.iconImage,
    event.banner
      ? [event.banner.cid, event.banner.keyEpoch, event.banner.wrappedKey, event.banner.manifestJson]
      : null,
    event.themeBlob,
    event.tombstone,
    event.updatedAt,
    event.signedBy,
  ]));
}

export function communityIdentityEventId(event: SignedCommunityIdentityEventWithoutId): string {
  const { signature, ...unsigned } = event;
  const canonical = canonicalCommunityIdentity(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

/**
 * Create + sign an identity event. The CALLER is responsible for passing the
 * community owner identity; a non-owner event signs fine but will never verify
 * against the descriptor (and so renders nothing anywhere).
 */
export function createCommunityIdentityEvent(
  owner: DeviceIdentity,
  input: CommunityIdentityInput,
): CommunityIdentityEvent {
  if (!input.communityId) throw new Error('A community id is required.');
  if (!Number.isInteger(input.revision) || input.revision < 1) {
    throw new Error('Identity revision must be a positive integer.');
  }
  const tombstone = input.tombstone === true;
  const unsigned: UnsignedCommunityIdentityEvent = {
    version: 1,
    communityId: input.communityId,
    revision: input.revision,
    description: tombstone ? null : normalizeDescription(input.description),
    accentColor: tombstone ? null : normalizeAccentColor(input.accentColor),
    iconImage: tombstone ? null : normalizeIconImage(input.iconImage),
    banner: tombstone ? null : normalizeBanner(input.banner),
    themeBlob: tombstone ? null : normalizeThemeBlob(input.themeBlob),
    tombstone,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    signedBy: owner.publicKey,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(owner.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalCommunityIdentity(unsigned)));
  const withoutId = { ...unsigned, signature };
  return { ...withoutId, id: communityIdentityEventId(withoutId) };
}

/**
 * Verify an identity event against the community owner. Fail-closed: any
 * structural violation, cap violation, non-normalized field, owner mismatch,
 * id mismatch, or bad signature returns false -- and an unverified event must
 * render NOTHING (the avatar rule).
 */
export function verifyCommunityIdentityEvent(
  event: CommunityIdentityEvent,
  ownerDeviceId: string,
): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.communityId || !event.updatedAt || !event.signedBy) return false;
  if (!ownerDeviceId || event.signedBy !== ownerDeviceId) return false;
  if (!Number.isInteger(event.revision) || event.revision < 1) return false;
  if (typeof event.tombstone !== 'boolean') return false;
  if (event.tombstone) {
    // A tombstone carries no identity payload (nothing rides outside intent).
    if (event.description !== null || event.accentColor !== null || event.iconImage !== null
      || event.banner !== null || event.themeBlob !== null) {
      return false;
    }
  } else {
    if (event.description !== null && event.description !== normalizeDescription(event.description)) return false;
    if (event.accentColor !== null && !ACCENT_COLOR_PATTERN.test(event.accentColor)) return false;
    if (event.iconImage !== null && !isValidCommunityAvatarImage(event.iconImage)) return false;
    if (event.banner !== null && !isValidCommunityIdentityBanner(event.banner)) return false;
    if (event.themeBlob !== null && !isValidCommunityThemeBlob(event.themeBlob)) return false;
  }
  if (event.id !== communityIdentityEventId(event)) return false;
  try {
    const { id, signature, ...unsigned } = event;
    void id;
    return verifySignature(event.signedBy, canonicalCommunityIdentity(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

/** The synced table these events ride in (shared_workspace, explicit rule). */
export const COMMUNITY_IDENTITY_TABLE = 'cm_community_identity';

/** Serialize an event to its synced row shape (snake_case, tombstone 0/1). */
export function communityIdentityEventToRow(event: CommunityIdentityEvent): Record<string, unknown> {
  return {
    id: event.id,
    community_id: event.communityId,
    revision: event.revision,
    description: event.description,
    accent_color: event.accentColor,
    icon_image: event.iconImage,
    banner_cid: event.banner?.cid ?? null,
    banner_key_epoch: event.banner?.keyEpoch ?? null,
    banner_wrapped_key: event.banner?.wrappedKey ?? null,
    // Named *manifest_json so the blob-transfer collector replicates the
    // banner's sealed blocks exactly like library items.
    banner_manifest_json: event.banner?.manifestJson ?? null,
    theme_blob: event.themeBlob,
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

/**
 * Parse a synced row back into an event. Null on ANY malformed field --
 * callers treat null as an unverifiable row (renders nothing / rejects).
 */
export function communityIdentityEventFromRow(data: Record<string, unknown>): CommunityIdentityEvent | null {
  const id = rowString(data.id);
  const communityId = rowString(data.community_id);
  const updatedAt = rowString(data.updated_at);
  const signedBy = rowString(data.signed_by);
  const signature = rowString(data.signature);
  if (!id || !communityId || !updatedAt || !signedBy || !signature) return null;
  const revision = typeof data.revision === 'number' ? data.revision : Number.NaN;
  if (!Number.isInteger(revision)) return null;
  const tombstoneRaw = data.tombstone;
  if (tombstoneRaw !== 0 && tombstoneRaw !== 1 && typeof tombstoneRaw !== 'boolean') return null;
  const description = rowString(data.description);
  const accentColor = rowString(data.accent_color);
  const iconImage = rowString(data.icon_image);
  const themeBlob = rowString(data.theme_blob);
  const bannerCid = rowString(data.banner_cid);
  const bannerWrappedKey = rowString(data.banner_wrapped_key);
  const bannerManifestJson = rowString(data.banner_manifest_json);
  if (
    description === undefined || accentColor === undefined || iconImage === undefined
    || themeBlob === undefined || bannerCid === undefined || bannerWrappedKey === undefined
    || bannerManifestJson === undefined
  ) {
    return null;
  }
  const bannerKeyEpochRaw = data.banner_key_epoch;
  let banner: CommunityIdentityBanner | null = null;
  const bannerFieldCount = [bannerCid, bannerWrappedKey, bannerManifestJson]
    .filter((v) => v !== null).length + (bannerKeyEpochRaw !== null && bannerKeyEpochRaw !== undefined ? 1 : 0);
  if (bannerFieldCount === 4) {
    if (typeof bannerKeyEpochRaw !== 'number' || !Number.isInteger(bannerKeyEpochRaw)) return null;
    banner = {
      cid: bannerCid!, keyEpoch: bannerKeyEpochRaw,
      wrappedKey: bannerWrappedKey!, manifestJson: bannerManifestJson!,
    };
  } else if (bannerFieldCount !== 0) {
    return null; // partial banner = malformed (all-or-nothing)
  }
  return {
    version: 1,
    id,
    communityId,
    revision,
    description,
    accentColor,
    iconImage,
    banner,
    themeBlob,
    tombstone: tombstoneRaw === true || tombstoneRaw === 1,
    updatedAt,
    signedBy,
    signature,
  };
}

/**
 * Resolve the winning identity from a set of candidate events:
 * latest-owner-signed-wins = highest VERIFIED revision (ties: latest
 * updatedAt, then id, for determinism). Returns null when nothing verifies or
 * the winner is a tombstone -- both mean "no identity, render defaults".
 */
export function resolveCommunityIdentity(
  events: readonly CommunityIdentityEvent[],
  ownerDeviceId: string,
): CommunityIdentityEvent | null {
  let winner: CommunityIdentityEvent | null = null;
  for (const event of events) {
    if (!verifyCommunityIdentityEvent(event, ownerDeviceId)) continue;
    if (
      !winner
      || event.revision > winner.revision
      || (event.revision === winner.revision && event.updatedAt > winner.updatedAt)
      || (event.revision === winner.revision && event.updatedAt === winner.updatedAt && event.id > winner.id)
    ) {
      winner = event;
    }
  }
  if (!winner || winner.tombstone) return null;
  return winner;
}
