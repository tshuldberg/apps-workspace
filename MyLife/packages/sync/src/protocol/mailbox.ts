/**
 * Mailbox mode (plan 14, MK-033; the Briar pattern).
 *
 * A phone that sleeps for a day should wake up to its changes, not to an empty
 * sync screen. When the recipient is offline, the sender parks SEALED DELTAS in
 * a store-and-forward mailbox -- the recipient's own always-on node, or a relay
 * running with a long mailbox TTL -- and the recipient drains the queue on its
 * next connect. The mailbox host learns nothing but ciphertext size and
 * timing: every delta is sealed to the recipient's X25519 key (ephemeral
 * sender key -> HKDF -> authenticated secretbox), the sender and recipient
 * ids live INSIDE that sealed box (v2), the mailbox is addressed by a
 * PAIR-PRIVATE token derived from the pairing shared secret -- not from
 * anyone's public key -- and the outer Ed25519 signature does not reveal its
 * signer. So a host that inspects a parked envelope cannot read it, cannot
 * attribute it to a sender or recipient, and cannot correlate mailboxes to
 * identities.
 *
 * The transport is the existing relay contract: `hello` on the mailbox token,
 * `env` frames queue in the relay's TTL mailbox when the peer is absent, and
 * the drain on join is exactly the wake-up delivery. TTL purging is the relay
 * hub's sweep (proven with an injected clock in its tests).
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import type { DeviceIdentity } from '../types';
import {
  extractDhPrivateKeyHex,
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { hkdf, sha512Hex } from '../node/hkdf';
import { relayTokenDayBucket } from './day-bucket';

const { decodeUTF8, encodeUTF8 } = naclUtil;
const encoder = new TextEncoder();

const EPH_PUB_BYTES = 32;
const NONCE_BYTES = nacl.secretbox.nonceLength;
const WRAP_INFO = 'meerkat-mailbox-seal-v2';

/**
 * The pair-private mailbox token: derived from the pairing shared secret, the
 * RECIPIENT's device id, and the UTC day bucket, so only the two paired
 * devices can compute where the mailbox lives and the relay-visible address
 * rotates daily (v2, 2026-08-25: the v1 token omitted the bucket and was a
 * static per-pair pseudonym the relay could track across days). The relay
 * sees a meaningless 64-hex token. Senders derive with their current clock;
 * receivers drain/listen via deriveMailboxDrainTokens.
 */
export function deriveMailboxToken(
  pairSharedSecretHex: string,
  recipientDeviceId: string,
  nowMs: number,
): string {
  const ikm = hexToBytes(pairSharedSecretHex);
  const info = `meerkat-mailbox-token-v2:${recipientDeviceId}:${relayTokenDayBucket(nowMs)}`;
  return sha512Hex(hkdf(ikm, info)).slice(0, 64);
}

/**
 * The wall-clock ms a seal-and-park site should derive its token bucket from:
 * the same optional ISO `now` its sealMailboxDelta call stamps inside the box,
 * falling back to the real clock. Keeping the token bucket and the sealed
 * createdAt on one clock means a test with an injected `now` is deterministic
 * and a production park always uses the sender's current bucket.
 */
export function mailboxSealNowMs(now: string | undefined): number {
  if (now !== undefined) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

/**
 * Resolve ONE clock instant for a seal-and-park operation: the token bucket
 * and the sealed createdAt must come from the same read, so a park that
 * straddles midnight can never stamp today's timestamp under a token derived
 * a tick earlier (or vice versa). With an explicit `now` both views are that
 * value; without one, a single Date.now() read serves both.
 */
export function resolveMailboxSealClock(
  now: string | undefined,
): { nowIso: string; nowMs: number } {
  if (now !== undefined) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return { nowIso: now, nowMs: parsed };
  }
  const nowMs = Date.now();
  return { nowIso: new Date(nowMs).toISOString(), nowMs };
}

/**
 * The receiver-side token window: current + previous UTC day bucket. With the
 * shipped 24h relay mailbox TTL every live parked envelope is addressed by one
 * of these two tokens (see day-bucket.ts for the boundary rule).
 */
export function deriveMailboxDrainTokens(
  pairSharedSecretHex: string,
  recipientDeviceId: string,
  nowMs: number,
): string[] {
  return [
    deriveMailboxToken(pairSharedSecretHex, recipientDeviceId, nowMs),
    deriveMailboxToken(pairSharedSecretHex, recipientDeviceId, nowMs - 86_400_000),
  ];
}

/**
 * A delta sealed to one recipient, signed by the sender.
 *
 * v2 (audit P0): the envelope carries NO identity metadata. Sender id,
 * recipient id, and creation time all live INSIDE the sealed payload, so a
 * mailbox host that inspects a parked envelope learns nothing but ciphertext
 * size. Ed25519 signatures do not reveal their signer, so the outer signature
 * is unlinkable too. Authentication still holds: the claimed sender travels
 * inside the box, and the signature over the ciphertext only verifies against
 * that claimed sender's key, so a forger cannot park an envelope naming a
 * sender whose signing key it does not hold.
 */
export interface MailboxEnvelope {
  version: 2;
  /** hex: ephPub(32) || nonce(24) || secretbox(inner). */
  sealedHex: string;
  /** Ed25519 signature (hex) by the INNER senderDeviceId over the canonical envelope. */
  signature: string;
}

/** What actually lives inside the sealed box. */
interface MailboxInner<T> {
  senderDeviceId: string;
  recipientDeviceId: string;
  createdAt: string;
  payload: T;
}

function canonicalEnvelope(env: Omit<MailboxEnvelope, 'signature'>): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-mailbox-envelope-v2',
    env.version,
    env.sealedHex,
  ]));
}

/**
 * Seal a delta payload for an offline recipient. Only the holder of the
 * recipient's DH private key can open it; the signature proves who parked it,
 * but only to the recipient (the host sees no identities).
 */
export function sealMailboxDelta(
  sender: DeviceIdentity,
  recipient: { deviceId: string; dhPublicKey: string },
  payload: unknown,
  now: string = new Date().toISOString(),
): MailboxEnvelope {
  const inner: MailboxInner<unknown> = {
    senderDeviceId: sender.publicKey,
    recipientDeviceId: recipient.deviceId,
    createdAt: now,
    payload,
  };
  const plaintext = decodeUTF8(JSON.stringify(inner));
  const eph = nacl.box.keyPair();
  const shared = nacl.box.before(hexToBytes(recipient.dhPublicKey), eph.secretKey);
  const key = hkdf(shared, WRAP_INFO);
  const nonce = nacl.randomBytes(NONCE_BYTES);
  const box = nacl.secretbox(plaintext, nonce, key);
  const sealed = new Uint8Array(EPH_PUB_BYTES + NONCE_BYTES + box.length);
  sealed.set(eph.publicKey, 0);
  sealed.set(nonce, EPH_PUB_BYTES);
  sealed.set(box, EPH_PUB_BYTES + NONCE_BYTES);

  const unsigned: Omit<MailboxEnvelope, 'signature'> = {
    version: 2,
    sealedHex: bytesToHex(sealed),
  };
  const signature = bytesToHex(
    signMessage(extractSigningPrivateKeyHex(sender.privateKeyRef), canonicalEnvelope(unsigned)),
  );
  return { ...unsigned, signature };
}

export type OpenMailboxResult<T> =
  | { ok: true; senderDeviceId: string; createdAt: string; payload: T }
  | { ok: false; reason: 'invalid_signature' | 'wrong_recipient' | 'decrypt_failed' | 'malformed' };

/**
 * Open a mailbox envelope: decrypt with our DH private key, read the claimed
 * sender from INSIDE the box, then verify the claimed sender's signature over
 * the ciphertext. Fails closed on any tamper, forgery, or misdelivery.
 */
export function openMailboxDelta<T>(
  recipient: DeviceIdentity,
  envelope: MailboxEnvelope,
): OpenMailboxResult<T> {
  if (
    !envelope
    || envelope.version !== 2
    || typeof envelope.sealedHex !== 'string'
    || typeof envelope.signature !== 'string'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  const dhPrivateKeyHex = extractDhPrivateKeyHex(recipient.privateKeyRef);
  if (!dhPrivateKeyHex) return { ok: false, reason: 'decrypt_failed' };

  let inner: MailboxInner<T>;
  try {
    const sealed = hexToBytes(envelope.sealedHex);
    if (sealed.length <= EPH_PUB_BYTES + NONCE_BYTES) return { ok: false, reason: 'malformed' };
    const ephPub = sealed.slice(0, EPH_PUB_BYTES);
    const nonce = sealed.slice(EPH_PUB_BYTES, EPH_PUB_BYTES + NONCE_BYTES);
    const box = sealed.slice(EPH_PUB_BYTES + NONCE_BYTES);
    const shared = nacl.box.before(ephPub, hexToBytes(dhPrivateKeyHex));
    const key = hkdf(shared, WRAP_INFO);
    const opened = nacl.secretbox.open(box, nonce, key);
    if (!opened) return { ok: false, reason: 'decrypt_failed' };
    inner = JSON.parse(encodeUTF8(opened)) as MailboxInner<T>;
  } catch {
    return { ok: false, reason: 'decrypt_failed' };
  }

  if (
    typeof inner?.senderDeviceId !== 'string'
    || typeof inner?.recipientDeviceId !== 'string'
    || typeof inner?.createdAt !== 'string'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  // Verify the CLAIMED sender signed this exact ciphertext. The claim lives
  // inside the sealed box, so naming someone else's device requires their
  // signing key.
  try {
    const { signature, ...unsigned } = envelope;
    if (!verifySignature(inner.senderDeviceId, canonicalEnvelope(unsigned), hexToBytes(signature))) {
      return { ok: false, reason: 'invalid_signature' };
    }
  } catch {
    return { ok: false, reason: 'invalid_signature' };
  }

  if (inner.recipientDeviceId !== recipient.publicKey) {
    return { ok: false, reason: 'wrong_recipient' };
  }

  return {
    ok: true,
    senderDeviceId: inner.senderDeviceId,
    createdAt: inner.createdAt,
    payload: inner.payload,
  };
}

/** Wire helpers: envelopes travel as relay `env` frames (opaque bytes). */
export function encodeMailboxEnvelope(envelope: MailboxEnvelope): Uint8Array {
  return decodeUTF8(JSON.stringify(envelope));
}

export function decodeMailboxEnvelope(bytes: Uint8Array): MailboxEnvelope | null {
  try {
    const parsed = JSON.parse(encodeUTF8(bytes)) as MailboxEnvelope;
    return parsed && parsed.version === 2 ? parsed : null;
  } catch {
    return null;
  }
}
