/**
 * Community member-removal mailbox (Plan 28).
 *
 * When an owner removes a member it (1) signs a new descriptor revision that drops
 * the member (removeMemberRevision) and (2) mints a fresh epoch key wrapped ONLY
 * for the survivors (commitMemberRemoval). This module distributes both to every
 * REMAINING member over the exact pair-private mailbox path used by
 * join-handoff-mailbox.ts: sealMailboxDelta to each survivor's X25519 key, one
 * sealed envelope per survivor, addressed by a per-recipient community-scoped
 * token. The relay sees only a 64-hex token and a ciphertext size -- no community
 * id, no member ids, no kind tag in the clear.
 *
 * The sealed payload carries the new SIGNED descriptor (the recipient re-verifies
 * the owner signature + chain on apply), the recipient's own new-epoch key-wrap
 * rows (hex-serialized via keyWrapToSyncedRow, recipient-gated on apply), and the
 * removedDeviceId (so the recipient closes that roster row locally). NO message
 * content ever rides here (NC-4).
 *
 * Token derivation mirrors deriveCommunityJoinToken but under a DISTINCT HKDF
 * domain 'meerkat-community-removal-v1:<communityId>:<recipientDeviceId>', so it
 * never collides with the join / notify / public-join token domains.
 *
 * RN-safe: reuses the SHIPPED mailbox + community primitives; adds NO new crypto.
 */

import type { DeviceIdentity } from '../types';
import { hkdf, sha512Hex } from '../node/hkdf';
import { hexToBytes } from '../encryption/keys';
import { keyWrapToSyncedRow } from './group-keys';
import type { SyncWorkspaceKeyWrap } from '../types';
import {
  verifySignedIdentityBundle,
  type SignedIdentityBundle,
} from './identity-bundle';
import type { SignedCommunityDescriptor } from './community';
import {
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';

export const MEMBER_REMOVAL_MAILBOX_KIND = 'meerkat.member-removal-v1';

const DM_REMOVAL_TOKEN_DOMAIN = 'meerkat-community-removal-v1';
const encoder = new TextEncoder();

/** genesisNonce bytes for the token IKM (hex-aware; UTF-8 fallback so it never throws). */
function secretBytes(communitySecret: string): Uint8Array {
  if (/^[0-9a-fA-F]+$/.test(communitySecret) && communitySecret.length % 2 === 0) {
    return hexToBytes(communitySecret);
  }
  return encoder.encode(communitySecret);
}

/**
 * Derive the per-recipient, community-scoped member-removal token. HKDF over the
 * descriptor's genesisNonce with info
 * `meerkat-community-removal-v1:<communityId>:<recipientDeviceId>`, SHA-512'd and
 * sliced to 64 hex -- the deriveCommunityJoinToken shape under a distinct domain.
 * Anyone holding the descriptor can derive it (a survivor drains its own token),
 * but only the addressed recipient can OPEN the sealed envelope.
 */
export function deriveCommunityRemovalToken(
  communitySecret: string,
  communityId: string,
  recipientDeviceId: string,
): string {
  const ikm = secretBytes(communitySecret);
  const info = `${DM_REMOVAL_TOKEN_DOMAIN}:${communityId}:${recipientDeviceId}`;
  return sha512Hex(hkdf(ikm, info)).slice(0, 64);
}

/** The sealed per-survivor removal payload. */
export interface MemberRemovalPayload {
  kind: typeof MEMBER_REMOVAL_MAILBOX_KIND;
  version: 1;
  communityId: string;
  /** The new owner-signed descriptor that no longer lists the removed member. */
  descriptor: SignedCommunityDescriptor;
  /** keyWrapToSyncedRow outputs this survivor can open (its new-epoch secret wrapped to its DH key). */
  keyWraps: Record<string, unknown>[];
  /** The device removed by this revision (the recipient closes its roster row locally). */
  removedDeviceId: string;
  /** The owner's signed identity bundle (so the recipient pins the owner as the signer). */
  ownerBundle: SignedIdentityBundle;
}

/** One survivor of the fan-out: its device, DH key, and the wrap rows addressed to it. */
export interface MemberRemovalRecipient {
  deviceId: string;
  dhPublicKey: string;
  /** The SyncWorkspaceKeyWrap rows for THIS device (its new-epoch wrap[s]). */
  keyWraps: SyncWorkspaceKeyWrap[];
}

export interface SealMemberRemovalInput {
  /** The owner (this device) parking the removal. */
  owner: DeviceIdentity;
  communityId: string;
  communitySecret: string;
  descriptor: SignedCommunityDescriptor;
  removedDeviceId: string;
  ownerBundle: SignedIdentityBundle;
  recipients: readonly MemberRemovalRecipient[];
  now?: string;
}

/** One sealed removal envelope, addressed to one survivor by its removal token. */
export interface SealedMemberRemoval {
  recipientDeviceId: string;
  token: string;
  envelope: MailboxEnvelope;
  payload: MemberRemovalPayload;
}

/**
 * Seal the removal fan-out: one sealed MEMBER_REMOVAL envelope per survivor,
 * carrying ONLY that survivor's wrap rows. Pure. The removed device is never a
 * recipient (the caller excludes it).
 */
export function sealMemberRemovalFanOut(input: SealMemberRemovalInput): SealedMemberRemoval[] {
  return input.recipients.map<SealedMemberRemoval>((recipient) => {
    const payload: MemberRemovalPayload = {
      kind: MEMBER_REMOVAL_MAILBOX_KIND,
      version: 1,
      communityId: input.communityId,
      descriptor: input.descriptor,
      keyWraps: recipient.keyWraps.map(keyWrapToSyncedRow),
      removedDeviceId: input.removedDeviceId,
      ownerBundle: input.ownerBundle,
    };
    return {
      recipientDeviceId: recipient.deviceId,
      token: deriveCommunityRemovalToken(input.communitySecret, input.communityId, recipient.deviceId),
      envelope: sealMailboxDelta(
        input.owner,
        { deviceId: recipient.deviceId, dhPublicKey: recipient.dhPublicKey },
        payload,
        input.now,
      ),
      payload,
    };
  });
}

export type MemberRemovalRejectReason =
  | 'invalid_payload'
  | 'invalid_signature'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'malformed';

export type OpenMemberRemovalResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: MemberRemovalPayload;
    }
  | { ok: false; reason: MemberRemovalRejectReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Structural shape of a SignedCommunityDescriptor (owner signature re-verified on apply). */
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

function isSignedBundleShape(value: unknown): value is SignedIdentityBundle {
  if (!isRecord(value)) return false;
  if (typeof value.signature !== 'string' || value.signature.length === 0) return false;
  const bundle = value.bundle;
  if (!isRecord(bundle)) return false;
  return bundle.version === 1
    && typeof bundle.deviceId === 'string'
    && typeof bundle.dhPublicKey === 'string';
}

/**
 * Open + structurally validate a parked member-removal envelope. openMailboxDelta
 * enforces the envelope signature + recipient match + decrypt; then the payload is
 * structurally validated (descriptor shape, keyWraps array, owner bundle shape).
 * The owner signature on the descriptor, the sender/owner binding, and each wrap's
 * recipient-gating are re-verified by the APPLY side, exactly like the join-grant.
 */
export function openMemberRemovalMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenMemberRemovalResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== MEMBER_REMOVAL_MAILBOX_KIND
    || payload.version !== 1
    || typeof payload.communityId !== 'string'
    || payload.communityId.length === 0
    || !isSignedDescriptorShape(payload.descriptor)
    || typeof payload.removedDeviceId !== 'string'
    || payload.removedDeviceId.length === 0
    || !isSignedBundleShape(payload.ownerBundle)
    || !Array.isArray(payload.keyWraps)
    || !payload.keyWraps.every(isRecord)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: {
      kind: MEMBER_REMOVAL_MAILBOX_KIND,
      version: 1,
      communityId: payload.communityId,
      descriptor: payload.descriptor as unknown as SignedCommunityDescriptor,
      keyWraps: payload.keyWraps as Record<string, unknown>[],
      removedDeviceId: payload.removedDeviceId,
      ownerBundle: payload.ownerBundle as unknown as SignedIdentityBundle,
    },
  };
}

/** Re-export the bundle verifier under a removal-scoped name for the core's clarity. */
export function verifyMemberRemovalBundle(bundle: SignedIdentityBundle): boolean {
  return verifySignedIdentityBundle(bundle);
}
