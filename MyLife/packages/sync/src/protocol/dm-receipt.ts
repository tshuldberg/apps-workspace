/**
 * DM delivery/read receipts (Plan 21 Phase 1).
 *
 * A receipt is the recipient device's SIGNED statement that it merged
 * ('delivered') or rendered ('read') a specific DM. It is signed over its OWN
 * domain string ('meerkat-dm-receipt-v1') -- distinct from the DM message domain
 * ('meerkat-dm-message-v1') and the mailbox kind ('meerkat.dm-receipt-v1') -- so
 * a receipt can never be confused with a message or a channel event.
 *
 * The receipt travels BACK to the original sender through the same pair-private
 * mailbox: sealed to the sender's DH key, addressed by
 * deriveMailboxToken(pairSecret, senderDeviceId). The relay sees only a token
 * and a ciphertext size.
 *
 * Honesty: these are PURE crypto helpers. A 'delivered' receipt must be created
 * only after a real merge, a 'read' only after a real render (provider layer,
 * Phase 4). Nothing here fabricates a receipt; a withheld receipt leaves the
 * sender with NO state to read.
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

export const DM_RECEIPT_MAILBOX_KIND = 'meerkat.dm-receipt-v1';
const DM_RECEIPT_DOMAIN = 'meerkat-dm-receipt-v1';

const encoder = new TextEncoder();

/** delivered = merged into the local log; read = actually rendered to the user. */
export type DmReceiptState = 'delivered' | 'read';

/** A recipient-signed delivery/read receipt for a single DM. */
export interface DmReceiptEvent {
  conversationId: string;
  messageId: string;
  /** The device that signed this receipt (the reader). */
  recipientDeviceId: string;
  state: DmReceiptState;
  /** ISO timestamp of the merge/render. */
  at: string;
  /** Hex Ed25519 signature over the canonical receipt form. */
  signature: string;
}

export type DmReceiptInput = Omit<DmReceiptEvent, 'recipientDeviceId' | 'signature'>;

function canonicalDmReceipt(receipt: Omit<DmReceiptEvent, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    DM_RECEIPT_DOMAIN,
    receipt.conversationId,
    receipt.messageId,
    receipt.recipientDeviceId,
    receipt.state,
    receipt.at,
  ]));
}

/** Create a receipt signed by the reading device (recipientDeviceId = its key). */
export function createDmReceipt(recipient: DeviceIdentity, input: DmReceiptInput): DmReceiptEvent {
  const unsigned: Omit<DmReceiptEvent, 'signature'> = {
    conversationId: input.conversationId,
    messageId: input.messageId,
    recipientDeviceId: recipient.publicKey,
    state: input.state,
    at: input.at,
  };
  const privateKeyHex = extractSigningPrivateKeyHex(recipient.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalDmReceipt(unsigned)));
  return { ...unsigned, signature };
}

/** Verify a receipt against its claimed signing device. Fail-closed. */
export function verifyDmReceipt(receipt: DmReceiptEvent): boolean {
  if (receipt.state !== 'delivered' && receipt.state !== 'read') return false;
  try {
    const { signature, ...unsigned } = receipt;
    return verifySignature(
      receipt.recipientDeviceId,
      canonicalDmReceipt(unsigned),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}

export interface DmReceiptMailboxPayload {
  kind: typeof DM_RECEIPT_MAILBOX_KIND;
  version: 1;
  receipt: DmReceiptEvent;
}

export interface SealDmReceiptInput {
  /** This device (it signed the receipt) parking it back to the original sender. */
  sender: DeviceIdentity;
  /** The original message author the receipt is addressed back to. */
  recipient: { deviceId: string; dhPublicKey: string };
  pairSharedSecretHex: string;
  receipt: DmReceiptEvent;
  now?: string;
}

export interface SealDmReceiptResult {
  token: string;
  envelope: MailboxEnvelope;
  payload: DmReceiptMailboxPayload;
}

/** Seal a receipt back to the original sender's pair-private mailbox. */
export function sealDmReceipt(input: SealDmReceiptInput): SealDmReceiptResult {
  const payload: DmReceiptMailboxPayload = {
    kind: DM_RECEIPT_MAILBOX_KIND,
    version: 1,
    receipt: input.receipt,
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

export type DmReceiptMailboxRejectReason =
  | 'invalid_payload'
  | 'invalid_receipt'
  | 'invalid_signature'
  | 'wrong_recipient'
  | 'decrypt_failed'
  | 'malformed';

export type OpenDmReceiptMailboxResult =
  | {
      ok: true;
      senderDeviceId: string;
      createdAt: string;
      payload: DmReceiptMailboxPayload;
      receipt: DmReceiptEvent;
    }
  | { ok: false; reason: DmReceiptMailboxRejectReason };

/**
 * Open + verify a receipt envelope. Fail-closed on decrypt / signature / wrong
 * recipient / wrong kind, and on a receipt whose own signature does not verify
 * (invalid_receipt) -- a tampered or forged receipt yields NO state.
 */
export function openDmReceiptMailbox(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenDmReceiptMailboxResult {
  const opened = openMailboxDelta<unknown>(recipient, envelope);
  if (!opened.ok) return opened;

  const payload = opened.payload;
  if (
    !isRecord(payload)
    || payload.kind !== DM_RECEIPT_MAILBOX_KIND
    || payload.version !== 1
    || !isDmReceiptEvent(payload.receipt)
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const receipt = payload.receipt;
  if (!verifyDmReceipt(receipt)) return { ok: false, reason: 'invalid_receipt' };

  return {
    ok: true,
    senderDeviceId: opened.senderDeviceId,
    createdAt: opened.createdAt,
    payload: { kind: DM_RECEIPT_MAILBOX_KIND, version: 1, receipt },
    receipt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDmReceiptEvent(value: unknown): value is DmReceiptEvent {
  return isRecord(value)
    && typeof value.conversationId === 'string'
    && typeof value.messageId === 'string'
    && typeof value.recipientDeviceId === 'string'
    && (value.state === 'delivered' || value.state === 'read')
    && typeof value.at === 'string'
    && typeof value.signature === 'string';
}
