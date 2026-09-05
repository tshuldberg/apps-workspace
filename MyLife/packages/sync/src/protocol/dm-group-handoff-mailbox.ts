/**
 * Group DM epoch handoff mailbox (Plan 21 Phase 6) -- sibling of
 * join-handoff-mailbox.ts.
 *
 * A dm_group epoch commit (create / add / remove) writes NO change-tracker row
 * (NC-9), so its key wraps NEVER replicate. The ONLY way a member learns the new
 * epoch is this explicit, per-recipient sealed handoff: for each member device
 * the admin seals a DM_GROUP_COMMIT payload -- the new SignedDmGroupDescriptor,
 * the recipient's own key-wrap rows (hex-serialized via keyWrapToSyncedRow), and
 * the admin's signed identity bundle -- to that device's X25519 key, parked under
 * a per-recipient, conversation-scoped token. The relay sees only a 64-hex token
 * and a ciphertext size: no conversation id, no member ids, no kind tag.
 *
 * Token derivation mirrors the community-join token but under a DISTINCT HKDF
 * domain scoped `meerkat-dm-group-v1:<conversationId>:<recipientDeviceId>`, so it
 * never collides with the pair / community / public-join token domains. The
 * conversationId (fresh 16-byte entropy) is the derivation IKM: both the admin
 * (to park) and the recipient (to drain its own token) compute it, but only the
 * addressed recipient can OPEN the sealed box.
 *
 * The apply side (pin the admin, store the recipient-gated wrap, bridge the
 * dm_group workspace) is a db-touching factory in dm-group-handoff-core.ts, kept
 * out of this pure file so the dispatcher can import the open path cycle-free.
 *
 * RN-safe: reuses the SHIPPED mailbox + identity-bundle + group-keys primitives;
 * adds NO new crypto scheme.
 */

import type { DeviceIdentity, SyncWorkspaceKeyWrap } from '../types';
import { hkdf, sha512Hex } from '../node/hkdf';
import { hexToBytes } from '../encryption/keys';
import { keyWrapToSyncedRow } from './group-keys';
import {
  verifyDmGroupDescriptor,
  type SignedDmGroupDescriptor,
} from './dm-group';
import {
  verifySignedIdentityBundle,
  type SignedIdentityBundle,
} from './identity-bundle';
import {
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';

export const DM_GROUP_COMMIT_KIND = 'meerkat.dm-group-commit-v1';

/** Distinct HKDF domain for the dm_group commit handoff token. */
const DM_GROUP_TOKEN_DOMAIN = 'meerkat-dm-group-v1';

const encoder = new TextEncoder();

/** conversationId bytes for the token IKM (hex-aware; UTF-8 fallback so it never throws). */
function conversationSecretBytes(conversationId: string): Uint8Array {
  if (/^[0-9a-fA-F]+$/.test(conversationId) && conversationId.length % 2 === 0) {
    return hexToBytes(conversationId);
  }
  return encoder.encode(conversationId);
}

/**
 * Derive the per-recipient, conversation-scoped dm_group commit token. HKDF over
 * the conversationId bytes with info
 * `meerkat-dm-group-v1:<conversationId>:<recipientDeviceId>`, SHA-512'd + sliced
 * to 64 hex chars -- the deriveMailboxToken / deriveCommunityJoinToken shape.
 */
export function deriveDmGroupCommitToken(
  conversationId: string,
  recipientDeviceId: string,
): string {
  const ikm = conversationSecretBytes(conversationId);
  const info = `${DM_GROUP_TOKEN_DOMAIN}:${conversationId}:${recipientDeviceId}`;
  return sha512Hex(hkdf(ikm, info)).slice(0, 64);
}

/** The sealed per-recipient epoch handoff. */
export interface DmGroupCommitPayload {
  kind: typeof DM_GROUP_COMMIT_KIND;
  version: 1;
  conversationId: string;
  /** The new admin-signed descriptor at the committed epoch. */
  descriptor: SignedDmGroupDescriptor;
  /** keyWrapToSyncedRow outputs this recipient can open (its epoch secrets wrapped to its DH key). */
  keyWraps: Record<string, unknown>[];
  /** The admin's signed identity bundle (so the recipient pins + pairs the admin). */
  adminBundle: SignedIdentityBundle;
}

/** One recipient of the fan-out: its device + the wrap rows addressed to it. */
export interface DmGroupCommitRecipient {
  deviceId: string;
  dhPublicKey: string;
  /** The SyncWorkspaceKeyWrap rows for THIS device (the epoch[s] being handed off). */
  keyWraps: SyncWorkspaceKeyWrap[];
}

export interface SealDmGroupCommitInput {
  /** The admin (this device) parking the handoff. */
  admin: DeviceIdentity;
  conversationId: string;
  descriptor: SignedDmGroupDescriptor;
  adminBundle: SignedIdentityBundle;
  recipients: readonly DmGroupCommitRecipient[];
  now?: string;
}

/** One sealed handoff envelope, addressed to one member device by its dm_group token. */
export interface SealedDmGroupCommit {
  recipientDeviceId: string;
  token: string;
  envelope: MailboxEnvelope;
  payload: DmGroupCommitPayload;
}

/**
 * Seal the epoch handoff for every member device: one sealed DM_GROUP_COMMIT
 * envelope per recipient, carrying ONLY that recipient's wrap rows. Pure.
 */
export function sealDmGroupCommit(input: SealDmGroupCommitInput): SealedDmGroupCommit[] {
  return input.recipients.map<SealedDmGroupCommit>((recipient) => {
    const payload: DmGroupCommitPayload = {
      kind: DM_GROUP_COMMIT_KIND,
      version: 1,
      conversationId: input.conversationId,
      descriptor: input.descriptor,
      keyWraps: recipient.keyWraps.map(keyWrapToSyncedRow),
      adminBundle: input.adminBundle,
    };
    return {
      recipientDeviceId: recipient.deviceId,
      token: deriveDmGroupCommitToken(input.conversationId, recipient.deviceId),
      envelope: sealMailboxDelta(
        input.admin,
        { deviceId: recipient.deviceId, dhPublicKey: recipient.dhPublicKey },
        payload,
        input.now,
      ),
      payload,
    };
  });
}

export type DmGroupCommitRejectReason =
  | 'invalid_payload'
  | 'invalid_signature'
  | 'wrong_sender'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'malformed';

export type OpenDmGroupCommitResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: DmGroupCommitPayload;
    }
  | { ok: false; reason: DmGroupCommitRejectReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Open + verify a parked dm_group commit. Fail-closed: openMailboxDelta enforces
 * the envelope signature + recipient match + decrypt; then the payload is
 * structurally validated, the descriptor signature RE-VERIFIED (admin-only), the
 * envelope signer bound to the descriptor admin (wrong_sender otherwise), and the
 * admin bundle re-verified + bound to the same sender. The recovered wraps are
 * still recipient-gated on apply (storeReceivedKeyWrap).
 */
export function openDmGroupCommit(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenDmGroupCommitResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== DM_GROUP_COMMIT_KIND
    || payload.version !== 1
    || typeof payload.conversationId !== 'string'
    || payload.conversationId.length === 0
    || !isRecord(payload.descriptor)
    || !Array.isArray(payload.keyWraps)
    || !payload.keyWraps.every(isRecord)
    || !isRecord(payload.adminBundle)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const descriptor = payload.descriptor as unknown as SignedDmGroupDescriptor;
  if (descriptor.conversationId !== payload.conversationId) {
    return { ok: false, reason: 'invalid_payload' };
  }
  // Admin-only membership: the descriptor must verify under its adminDeviceId.
  if (!verifyDmGroupDescriptor(descriptor)) return { ok: false, reason: 'invalid_signature' };
  // Bind the envelope signer to the descriptor admin: only the admin hands off epochs.
  if (descriptor.adminDeviceId !== opened.senderDeviceId) return { ok: false, reason: 'wrong_sender' };

  const adminBundle = payload.adminBundle as unknown as SignedIdentityBundle;
  if (!verifySignedIdentityBundle(adminBundle)) return { ok: false, reason: 'invalid_signature' };
  if (adminBundle.bundle.deviceId !== opened.senderDeviceId) return { ok: false, reason: 'invalid_payload' };

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: {
      kind: DM_GROUP_COMMIT_KIND,
      version: 1,
      conversationId: payload.conversationId,
      descriptor,
      keyWraps: payload.keyWraps as Record<string, unknown>[],
      adminBundle,
    },
  };
}
