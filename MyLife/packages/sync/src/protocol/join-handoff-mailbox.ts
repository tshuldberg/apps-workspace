/**
 * Owner-side invite -> join key-handoff mailbox payloads (community feed P7).
 *
 * The one honest gap the feed had: joinCommunityFromLink stores the descriptor a
 * link carried, but it does NOT make the OWNER learn the joiner, so a normal
 * invite -> join never minted an epoch key for the newcomer nor added it to the
 * descriptor membership. This module closes that gap over the EXACT existing
 * pair-private mailbox path -- the same primitives as file-request-mailbox.ts and
 * history-backfill-mailbox.ts, VERBATIM: sealMailboxDelta to the recipient's
 * X25519 key, addressed by a community-derived token, parked in the relay's TTL
 * store-and-forward mailbox. So the relay sees only a 64-hex token and a
 * ciphertext size: no community id, no identities, no kind tag in the clear.
 *
 * Two sealed payload kinds live INSIDE the box:
 *   JOIN_REQUEST_MAILBOX_KIND -- joiner B -> owner; carries the SIGNED invite B
 *     used (so the owner re-verifies it against its own current descriptor) plus
 *     B's SIGNED identity bundle (so the owner binds B's X25519 key to the
 *     signing identity that authored the envelope, then wraps the epoch secret to
 *     that key).
 *   JOIN_GRANT_MAILBOX_KIND   -- owner -> joiner B; carries the new SIGNED
 *     descriptor that now lists B, the key-wrap rows B can open (epoch secrets
 *     wrapped to B's DH key, hex-serialized via keyWrapToSyncedRow), and the
 *     owner's SIGNED identity bundle (so B pins + pairs the owner). B re-verifies
 *     everything on apply (descriptor owner signature, ownerDeviceId binding,
 *     each wrap is recipient-gated).
 *
 * The token derivation is per-RECIPIENT and community-scoped (see
 * deriveCommunityJoinToken): a request is addressed to the OWNER's device id, a
 * grant back to the JOINER's device id. Anyone holding the descriptor (the
 * genesisNonce) can derive the token, but only the addressed recipient can OPEN
 * the sealed box. Mirrors community-notify.ts's token derivation shape.
 *
 * RN-safe: no Node crypto/fs. Everything is reused from the package helpers; this
 * adds NO new crypto scheme.
 */

import type { DeviceIdentity } from '../types';
import { hkdf, sha512Hex } from '../node/hkdf';
import { hexToBytes } from '../encryption/keys';
import {
  verifySignedIdentityBundle,
  type SignedIdentityBundle,
} from './identity-bundle';
import {
  verifyCommunityInvite,
  type SignedCommunityDescriptor,
  type SignedCommunityInvite,
} from './community';
import {
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';

export const JOIN_REQUEST_MAILBOX_KIND = 'meerkat.join-request-v1';
export const JOIN_GRANT_MAILBOX_KIND = 'meerkat.join-grant-v1';

const encoder = new TextEncoder();

/** The bytes of the descriptor's genesisNonce (the shared community secret). */
function secretBytes(communitySecret: string): Uint8Array {
  // genesisNonce is hex (bytesToHex of randomBytes(16)); fall back to UTF-8 bytes
  // if a caller passes a non-hex secret, so the derivation never throws. Mirrors
  // community-notify.ts.
  if (/^[0-9a-fA-F]+$/.test(communitySecret) && communitySecret.length % 2 === 0) {
    return hexToBytes(communitySecret);
  }
  return encoder.encode(communitySecret);
}

/**
 * Derive the per-recipient, community-scoped join mailbox token. HKDF over the
 * community secret bytes (the descriptor's `genesisNonce`) with info
 * `meerkat-community-join-v1:<communityId>:<recipientDeviceId>`, SHA-512'd and
 * sliced to 64 hex chars -- the same shape as deriveMailboxToken /
 * deriveCommunityNotifyToken.
 *
 * The request is addressed to the OWNER device id; the grant back to the JOINER
 * device id. Anyone holding the descriptor can derive the token (so an owner can
 * drain its own join-request token and a joiner its own join-grant token), but
 * only the addressed recipient can OPEN the sealed envelope inside. The relay
 * sees a meaningless 64-hex token.
 */
export function deriveCommunityJoinToken(
  communitySecret: string,
  communityId: string,
  recipientDeviceId: string,
): string {
  const ikm = secretBytes(communitySecret);
  const info = `meerkat-community-join-v1:${communityId}:${recipientDeviceId}`;
  return sha512Hex(hkdf(ikm, info)).slice(0, 64);
}

// ---------------------------------------------------------------------------
// Sealed payloads
// ---------------------------------------------------------------------------

export interface JoinRequestPayload {
  kind: typeof JOIN_REQUEST_MAILBOX_KIND;
  version: 1;
  communityId: string;
  /** The signed invite B used to join (the owner re-verifies it). */
  invite: SignedCommunityInvite;
  /** B's signed identity bundle (binds B's DH key to its signing identity). */
  bundle: SignedIdentityBundle;
}

export interface JoinGrantPayload {
  kind: typeof JOIN_GRANT_MAILBOX_KIND;
  version: 1;
  communityId: string;
  /** The new signed descriptor that now lists B. */
  descriptor: SignedCommunityDescriptor;
  /** keyWrapToSyncedRow outputs B can open (its epoch secrets wrapped to its DH key). */
  keyWraps: Record<string, unknown>[];
  /** The owner's signed identity bundle (so B pins + pairs the owner). */
  ownerBundle: SignedIdentityBundle;
}

export type JoinMailboxRejectReason =
  | 'invalid_payload'
  | 'invalid_signature'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'malformed';

// ---------------------------------------------------------------------------
// Validation (structural; cryptographic re-verification happens on the handlers)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Structural shape of a SignedCommunityInvite (signature verified on apply). */
function isSignedInviteShape(value: unknown): value is SignedCommunityInvite {
  if (!isRecord(value)) return false;
  if (typeof value.signature !== 'string' || value.signature.length === 0) return false;
  const invite = value.invite;
  if (!isRecord(invite)) return false;
  return invite.version === 1
    && typeof invite.communityId === 'string'
    && typeof invite.descriptorHash === 'string'
    && typeof invite.invitedByDeviceId === 'string'
    && typeof invite.expiresAt === 'string'
    && typeof invite.nonce === 'string';
}

/** Structural shape of a SignedIdentityBundle (signature verified on apply). */
function isSignedBundleShape(value: unknown): value is SignedIdentityBundle {
  if (!isRecord(value)) return false;
  if (typeof value.signature !== 'string' || value.signature.length === 0) return false;
  const bundle = value.bundle;
  if (!isRecord(bundle)) return false;
  return bundle.version === 1
    && typeof bundle.deviceId === 'string'
    && typeof bundle.dhPublicKey === 'string'
    && typeof bundle.displayName === 'string'
    && Array.isArray(bundle.relayHints)
    && typeof bundle.issuedAt === 'string';
}

/** Structural shape of a SignedCommunityDescriptor (signature verified on apply). */
function isSignedDescriptorShape(value: unknown): value is SignedCommunityDescriptor {
  if (!isRecord(value)) return false;
  if (typeof value.signature !== 'string' || value.signature.length === 0) return false;
  const descriptor = value.descriptor;
  if (!isRecord(descriptor)) return false;
  return descriptor.version === 1
    && typeof descriptor.communityId === 'string'
    && typeof descriptor.ownerDeviceId === 'string'
    && typeof descriptor.genesisNonce === 'string'
    && Array.isArray(descriptor.members)
    && Array.isArray(descriptor.channels);
}

// ---------------------------------------------------------------------------
// JOIN_REQUEST: joiner -> owner
// ---------------------------------------------------------------------------

export interface SealJoinRequestInput {
  /** The joiner (this device). */
  sender: DeviceIdentity;
  /** The owner this request is addressed to. */
  recipient: { deviceId: string; dhPublicKey: string };
  /** The token to park on: deriveCommunityJoinToken(genesisNonce, communityId, ownerDeviceId). */
  token: string;
  payload: JoinRequestPayload;
  now?: string;
}

export interface SealJoinRequestResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: JoinRequestPayload;
}

export function sealJoinRequestMailbox(input: SealJoinRequestInput): SealJoinRequestResult {
  const envelope = sealMailboxDelta(input.sender, input.recipient, input.payload, input.now);
  return { token: input.token, envelope, payload: input.payload };
}

export type OpenJoinRequestResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: JoinRequestPayload;
    }
  | { ok: false; reason: JoinMailboxRejectReason };

export function openJoinRequestMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenJoinRequestResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== JOIN_REQUEST_MAILBOX_KIND
    || payload.version !== 1
    || typeof payload.communityId !== 'string'
    || payload.communityId.length === 0
    || !isSignedInviteShape(payload.invite)
    || !isSignedBundleShape(payload.bundle)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: {
      kind: JOIN_REQUEST_MAILBOX_KIND,
      version: 1,
      communityId: payload.communityId,
      invite: payload.invite,
      bundle: payload.bundle,
    },
  };
}

// ---------------------------------------------------------------------------
// JOIN_GRANT: owner -> joiner
// ---------------------------------------------------------------------------

export interface SealJoinGrantInput {
  /** The owner (this device). */
  sender: DeviceIdentity;
  /** The joiner this grant is addressed back to. */
  recipient: { deviceId: string; dhPublicKey: string };
  /** The token to park on: deriveCommunityJoinToken(genesisNonce, communityId, joinerDeviceId). */
  token: string;
  payload: JoinGrantPayload;
  now?: string;
}

export interface SealJoinGrantResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: JoinGrantPayload;
}

export function sealJoinGrantMailbox(input: SealJoinGrantInput): SealJoinGrantResult {
  const envelope = sealMailboxDelta(input.sender, input.recipient, input.payload, input.now);
  return { token: input.token, envelope, payload: input.payload };
}

export type OpenJoinGrantResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: JoinGrantPayload;
    }
  | { ok: false; reason: JoinMailboxRejectReason };

export function openJoinGrantMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenJoinGrantResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== JOIN_GRANT_MAILBOX_KIND
    || payload.version !== 1
    || typeof payload.communityId !== 'string'
    || payload.communityId.length === 0
    || !isSignedDescriptorShape(payload.descriptor)
    || !isSignedBundleShape(payload.ownerBundle)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  // Drop the WHOLE grant if keyWraps is not an array of plain records. Each wrap
  // is recipient-gated on apply (storeReceivedKeyWrap), but a non-array keyWraps
  // is a malformed grant and is rejected here fail-closed.
  if (!Array.isArray(payload.keyWraps) || !payload.keyWraps.every(isRecord)) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: {
      kind: JOIN_GRANT_MAILBOX_KIND,
      version: 1,
      communityId: payload.communityId,
      descriptor: payload.descriptor,
      keyWraps: payload.keyWraps as Record<string, unknown>[],
      ownerBundle: payload.ownerBundle,
    },
  };
}

// ---------------------------------------------------------------------------
// Shared shape helpers re-exported for the core (verify-on-both-sides reuse).
// ---------------------------------------------------------------------------

/** Re-export the bundle verifier under a join-scoped name for the core's clarity. */
export function verifyJoinBundle(bundle: SignedIdentityBundle): boolean {
  return verifySignedIdentityBundle(bundle);
}

/**
 * Verify a join invite against the owner's CURRENT stored descriptor (NOT a
 * joiner-supplied one). The core pairs the joiner's signed invite with the
 * owner's own SignedCommunityDescriptor so a forged descriptor cannot grant
 * membership; expiry, signature, the binding hash, and inviter authority are all
 * checked by verifyCommunityInvite. Returns the 'ok' | reason verdict.
 */
export function verifyJoinInviteAgainstOwnerDescriptor(
  invite: SignedCommunityInvite,
  ownerSignedDescriptor: SignedCommunityDescriptor,
  now: Date = new Date(),
): ReturnType<typeof verifyCommunityInvite> {
  // requireDescriptorBinding:false - a multi-use invite is authorized against the
  // owner's CURRENT (mutating) descriptor by inviter authority + community id +
  // expiry, never the exact descriptor-hash it was minted against. Otherwise the
  // first join (which revises the descriptor) would invalidate the same invite for
  // every later joiner (community feed P7).
  return verifyCommunityInvite({ invite, descriptor: ownerSignedDescriptor }, now, {
    requireDescriptorBinding: false,
  });
}
