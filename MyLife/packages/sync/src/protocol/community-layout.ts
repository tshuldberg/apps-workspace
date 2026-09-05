/**
 * Community layout (composition plan 2.2): the OWNER-signed composition
 * document for a community -- the block layout of the home surface, per-channel
 * block overrides, the capability manifest, and tier definitions, all carried
 * as ONE opaque @mylife/meerkat-layout codec blob.
 *
 * Design decision (composition correction 1.1): this is a NEW signed event
 * table (`cm_layout`), never a descriptor field. An old client verifying a new
 * descriptor field would canonicalize different bytes and reject the revision
 * as forged; an unknown TABLE simply fails closed on old clients
 * (defaultScope 'device_local') and they render the legacy surface. Modeled
 * line-for-line on cm_community_identity (community-identity.ts): latest
 * owner-signed revision wins, verified at create AND verify with the same caps
 * (fail-closed), and an UNVERIFIED layout event renders NOTHING (the avatar
 * rule; the app falls back to the legacy communityLayout() rendering).
 *
 * The layout blob is opaque here: the sync package does not depend on
 * @mylife/meerkat-layout. It is namespace-checked, capped, and
 * control-character-free at this layer; the APP decodes it through the codec,
 * which fails safe to the legacy rendering on a malformed value.
 *
 * The signer MUST be the community owner: verification binds signedBy to the
 * descriptor's ownerDeviceId (ownership handoff is future work everywhere in
 * this protocol; community.ts has the same posture). Tombstone-able: a signed
 * tombstone event clears the layout back to the legacy rendering.
 */

import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';

const encoder = new TextEncoder();

/**
 * Hard cap on the layout codec blob STRING (characters). The codec's decoded
 * JSON cap is 32 KB (MAX_LAYOUT_BLOB_BYTES in @mylife/meerkat-layout);
 * base64url expands 4/3, plus prefix and checksum, so 48 KB of characters
 * bounds every valid encoding with headroom and nothing more.
 */
export const COMMUNITY_LAYOUT_BLOB_MAX_CHARS = 48 * 1024;

/** The codec namespace every valid layout blob starts with (version-agnostic). */
export const COMMUNITY_LAYOUT_BLOB_NAMESPACE = 'meerkat-layout:';

export interface CommunityLayoutEvent {
  version: 1;
  id: string;
  communityId: string;
  /** Monotonic per community; the highest VERIFIED revision wins. */
  revision: number;
  /** @mylife/meerkat-layout codec string (opaque at this layer); null only on tombstone. */
  layoutBlob: string | null;
  /** A signed tombstone clears the layout back to the legacy rendering. */
  tombstone: boolean;
  updatedAt: string;
  /** MUST equal the community descriptor's ownerDeviceId (verified). */
  signedBy: string;
  signature: string;
}

export interface CommunityLayoutInput {
  communityId: string;
  revision: number;
  layoutBlob?: string | null;
  tombstone?: boolean;
  updatedAt?: string;
}

type UnsignedCommunityLayoutEvent = Omit<CommunityLayoutEvent, 'id' | 'signature'>;
type SignedCommunityLayoutEventWithoutId = Omit<CommunityLayoutEvent, 'id'>;

/**
 * In-cap, namespace-prefixed, control-character-free layout codec string
 * (opaque otherwise; the app-side codec is the structural validator).
 */
export function isValidCommunityLayoutBlob(value: string): boolean {
  if (!value || value.length > COMMUNITY_LAYOUT_BLOB_MAX_CHARS) return false;
  if (!value.startsWith(COMMUNITY_LAYOUT_BLOB_NAMESPACE)) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\s\u0000-\u001f\u007f]/.test(value); // single token: no whitespace, no controls
}

function normalizeLayoutBlob(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (!isValidCommunityLayoutBlob(trimmed)) {
    throw new Error('That community layout is too large or malformed.');
  }
  return trimmed;
}

function canonicalCommunityLayout(event: UnsignedCommunityLayoutEvent): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-community-layout-v1',
    event.version,
    event.communityId,
    event.revision,
    event.layoutBlob,
    event.tombstone,
    event.updatedAt,
    event.signedBy,
  ]));
}

export function communityLayoutEventId(event: SignedCommunityLayoutEventWithoutId): string {
  const { signature, ...unsigned } = event;
  const canonical = canonicalCommunityLayout(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

/**
 * Create + sign a layout event. The CALLER is responsible for passing the
 * community owner identity; a non-owner event signs fine but will never verify
 * against the descriptor (and so renders nothing anywhere). A non-tombstone
 * event REQUIRES a valid blob: an empty layout is expressed as a tombstone,
 * never as a null-blob revision.
 */
export function createCommunityLayoutEvent(
  owner: DeviceIdentity,
  input: CommunityLayoutInput,
): CommunityLayoutEvent {
  if (!input.communityId) throw new Error('A community id is required.');
  if (!Number.isInteger(input.revision) || input.revision < 1) {
    throw new Error('Layout revision must be a positive integer.');
  }
  const tombstone = input.tombstone === true;
  const layoutBlob = tombstone ? null : normalizeLayoutBlob(input.layoutBlob);
  if (!tombstone && layoutBlob === null) {
    throw new Error('A layout event needs a layout blob (or a tombstone).');
  }
  const unsigned: UnsignedCommunityLayoutEvent = {
    version: 1,
    communityId: input.communityId,
    revision: input.revision,
    layoutBlob,
    tombstone,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    signedBy: owner.publicKey,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(owner.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalCommunityLayout(unsigned)));
  const withoutId = { ...unsigned, signature };
  return { ...withoutId, id: communityLayoutEventId(withoutId) };
}

/**
 * Verify a layout event against the community owner. Fail-closed: any
 * structural violation, cap violation, owner mismatch, id mismatch, or bad
 * signature returns false -- and an unverified event must render NOTHING (the
 * app falls back to the legacy rendering).
 */
export function verifyCommunityLayoutEvent(
  event: CommunityLayoutEvent,
  ownerDeviceId: string,
): boolean {
  if (!event || event.version !== 1) return false;
  if (!event.communityId || !event.updatedAt || !event.signedBy) return false;
  if (!ownerDeviceId || event.signedBy !== ownerDeviceId) return false;
  if (!Number.isInteger(event.revision) || event.revision < 1) return false;
  if (typeof event.tombstone !== 'boolean') return false;
  if (event.tombstone) {
    // A tombstone carries no layout payload (nothing rides outside intent).
    if (event.layoutBlob !== null) return false;
  } else {
    if (typeof event.layoutBlob !== 'string' || !isValidCommunityLayoutBlob(event.layoutBlob)) return false;
  }
  if (event.id !== communityLayoutEventId(event)) return false;
  try {
    const { id, signature, ...unsigned } = event;
    void id;
    return verifySignature(event.signedBy, canonicalCommunityLayout(unsigned), hexToBytes(signature));
  } catch {
    return false;
  }
}

/** The synced table these events ride in (shared_workspace, explicit rule). */
export const COMMUNITY_LAYOUT_TABLE = 'cm_layout';

/** Serialize an event to its synced row shape (snake_case, tombstone 0/1). */
export function communityLayoutEventToRow(event: CommunityLayoutEvent): Record<string, unknown> {
  return {
    id: event.id,
    community_id: event.communityId,
    revision: event.revision,
    layout_blob: event.layoutBlob,
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
export function communityLayoutEventFromRow(data: Record<string, unknown>): CommunityLayoutEvent | null {
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
  const layoutBlob = rowString(data.layout_blob);
  if (layoutBlob === undefined) return null;
  return {
    version: 1,
    id,
    communityId,
    revision,
    layoutBlob,
    tombstone: tombstoneRaw === true || tombstoneRaw === 1,
    updatedAt,
    signedBy,
    signature,
  };
}

/**
 * Resolve the winning layout from a set of candidate events:
 * latest-owner-signed-wins = highest VERIFIED revision (ties: latest
 * updatedAt, then id, for determinism). Returns null when nothing verifies or
 * the winner is a tombstone -- both mean "no layout, render the legacy
 * surfaces".
 */
export function resolveCommunityLayout(
  events: readonly CommunityLayoutEvent[],
  ownerDeviceId: string,
): CommunityLayoutEvent | null {
  let winner: CommunityLayoutEvent | null = null;
  for (const event of events) {
    if (!verifyCommunityLayoutEvent(event, ownerDeviceId)) continue;
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
