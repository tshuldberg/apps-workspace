/**
 * DM disappearing-message shred (Plan 21 Phase 8).
 *
 * A shred is the message AUTHOR's SIGNED instruction to every recipient device to
 * delete specific DM(s) locally (a delete-for-everyone). It is signed over its own
 * domain string ('meerkat-dm-shred-v1') -- distinct from the DM message
 * ('meerkat-dm-message-v1'), receipt ('meerkat-dm-receipt-v1'), and group
 * ('meerkat-dm-group-v1') domains -- so a shred can never be confused with any of
 * them.
 *
 * It travels through the same pair-private mailbox as a message: sealed to each
 * recipient device's DH key, addressed by deriveMailboxToken(pairSecret,
 * recipientDeviceId). The relay sees only a token and a ciphertext size.
 *
 * Two-layer authority (the "signed by a non-author is rejected" guarantee):
 *  1. verifyDmShred checks the shred's Ed25519 signature under authorDeviceId, and
 *     openDmShredMailbox binds the envelope signer to that same authorDeviceId, so
 *     only the author can send a shred.
 *  2. The APPLY side (provider) deletes a referenced message ONLY when the local
 *     row's author_device_id equals the shred author, so a valid shred can delete
 *     only the author's OWN messages, never someone else's.
 *
 * Honest boundary (documented like entity-keys' local-first caveat): until a peer
 * DRAINS the shred it can still read its locally-stored copy; the relay mailbox TTL
 * purge is the only guarantee for a never-drained copy. This is a DM-specific
 * signed shred, NOT an entity-keys.ts crypto-shred (dm_ tables never replicate, so
 * that policy hook can never recognize them).
 *
 * RN-safe: reuses the SHIPPED identity + mailbox primitives; no new crypto.
 */

import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import {
  deriveMailboxToken,
  resolveMailboxSealClock,
  openMailboxDelta,
  sealMailboxDelta,
  type MailboxEnvelope,
} from './mailbox';

export const DM_SHRED_MAILBOX_KIND = 'meerkat.dm-shred-v1';
const DM_SHRED_DOMAIN = 'meerkat-dm-shred-v1';

const encoder = new TextEncoder();

/** An author-signed instruction to delete specific DM messages locally. */
export interface DmShredEvent {
  conversationId: string;
  /** The message ids to shred. Sorted in the canonical form so order cannot forge. */
  messageIds: string[];
  /** The device that authored the shred (must be the author of the messages). */
  authorDeviceId: string;
  /** ISO timestamp of the shred. */
  at: string;
  /** Hex Ed25519 signature over the canonical shred form. */
  signature: string;
}

export type DmShredInput = Omit<DmShredEvent, 'authorDeviceId' | 'signature'>;

function canonicalDmShred(shred: Omit<DmShredEvent, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    DM_SHRED_DOMAIN,
    shred.conversationId,
    [...shred.messageIds].sort(),
    shred.authorDeviceId,
    shred.at,
  ]));
}

/** Create a shred signed by the authoring device (authorDeviceId = its key). */
export function createDmShred(author: DeviceIdentity, input: DmShredInput): DmShredEvent {
  const unsigned: Omit<DmShredEvent, 'signature'> = {
    conversationId: input.conversationId,
    messageIds: [...input.messageIds],
    authorDeviceId: author.publicKey,
    at: input.at,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(author.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalDmShred(unsigned)));
  return { ...unsigned, signature };
}

/** Verify a shred against its claimed author. Fail-closed. */
export function verifyDmShred(shred: DmShredEvent): boolean {
  if (!isDmShredEvent(shred)) return false;
  try {
    const { signature, ...unsigned } = shred;
    return verifySignature(
      shred.authorDeviceId,
      canonicalDmShred(unsigned),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}

export interface DmShredMailboxPayload {
  kind: typeof DM_SHRED_MAILBOX_KIND;
  version: 1;
  shred: DmShredEvent;
}

export interface SealDmShredInput {
  /** The author (this device) parking the shred. */
  sender: DeviceIdentity;
  /** One recipient device the shred is addressed to. */
  recipient: { deviceId: string; dhPublicKey: string };
  pairSharedSecretHex: string;
  shred: DmShredEvent;
  now?: string;
}

export interface SealDmShredResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: DmShredMailboxPayload;
}

/** Seal a shred to one recipient device's pair-private mailbox. */
export function sealDmShred(input: SealDmShredInput): SealDmShredResult {
  const payload: DmShredMailboxPayload = {
    kind: DM_SHRED_MAILBOX_KIND,
    version: 1,
    shred: input.shred,
  };
  const clock = resolveMailboxSealClock(input.now);
  const token = deriveMailboxToken(
    input.pairSharedSecretHex,
    input.recipient.deviceId,
    clock.nowMs,
  );
  const envelope = sealMailboxDelta(input.sender, input.recipient, payload, clock.nowIso);
  return { token, envelope, payload };
}

export type DmShredMailboxRejectReason =
  | 'invalid_payload'
  | 'invalid_shred'
  | 'invalid_signature'
  | 'wrong_sender'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'malformed';

export type OpenDmShredMailboxResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: DmShredMailboxPayload;
      shred: DmShredEvent;
    }
  | { ok: false; reason: DmShredMailboxRejectReason };

/**
 * Open + verify a shred envelope. Fail-closed on decrypt / signature / wrong
 * recipient / wrong kind, on a shred whose own signature does not verify
 * (invalid_shred), and when the envelope signer is not the shred author
 * (wrong_sender) -- only the author can send a shred.
 */
export function openDmShredMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenDmShredMailboxResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== DM_SHRED_MAILBOX_KIND
    || payload.version !== 1
    || !isDmShredEvent(payload.shred)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const shred = payload.shred;
  if (!verifyDmShred(shred)) return { ok: false, reason: 'invalid_shred' };
  if (shred.authorDeviceId !== opened.senderDeviceId) return { ok: false, reason: 'wrong_sender' };

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: { kind: DM_SHRED_MAILBOX_KIND, version: 1, shred },
    shred,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDmShredEvent(value: unknown): value is DmShredEvent {
  return isRecord(value)
    && typeof value.conversationId === 'string'
    && Array.isArray(value.messageIds)
    && value.messageIds.every((id) => typeof id === 'string')
    && value.messageIds.length > 0
    && typeof value.authorDeviceId === 'string'
    && typeof value.at === 'string'
    && typeof value.signature === 'string';
}
