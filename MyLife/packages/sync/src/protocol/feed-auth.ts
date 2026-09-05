/**
 * Per-member signed feed auth + zero-knowledge tail-entry integrity
 * (community feed P2, design sections 4.4 + 5(4) + 6).
 *
 * Two PURE concerns, both built only on the existing identity + hkdf primitives:
 *
 *  1. Challenge-response auth. A community NODE issues a short-lived nonce; a
 *     puller signs `(communityId, nonce, ts)` with its DEVICE key; the node
 *     verifies the signature AND that the device is a non-removed member of the
 *     community's latest signed descriptor (communityRole !== null). The node
 *     already legitimately holds the roster (the signed descriptor), so revealing
 *     "which member pulled" is the accepted P2 tradeoff; the node still never
 *     reads message plaintext.
 *
 *  2. Sealed-tail-entry integrity over CIPHERTEXT. A live tail entry carries the
 *     epoch-sealed bytes of one ChannelMessageEvent (`sealedHex`) plus an OUTER
 *     author signature computed over those sealed bytes (never the plaintext).
 *     The node verifies this outer signature so it "rejects any attempt to store
 *     an event whose author signature does not verify (fail-closed integrity
 *     even without reading content)" -- WITHOUT ever decrypting. The INNER
 *     verifyChannelMessage check is the PULLER's job after it decrypts the bytes
 *     with the epoch key. This module deliberately never imports the epoch key
 *     or decrypts anything.
 *
 * RN-safe: tweetnacl + the package's own identity/hkdf only (no node:crypto), so
 * it runs unchanged from index.native.
 */

import nacl from 'tweetnacl';
import type { CommunityDescriptor } from './community';
import { communityRole } from './community';
import type { DeviceIdentity, WorkspaceMemberRole } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';

const encoder = new TextEncoder();

const DEFAULT_CHALLENGE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const DEFAULT_NONCE_BYTES = 24;
const DEFAULT_MAX_SKEW_MS = 2 * 60 * 1000; // freshness window for ts

// ---------------------------------------------------------------------------
// Challenge-response auth
// ---------------------------------------------------------------------------

export interface FeedChallenge {
  /** Random hex nonce (PRNG via nacl.randomBytes). */
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface CreateFeedChallengeOptions {
  ttlMs?: number;
  now?: string;
  nonceBytes?: number;
}

/** Mint a fresh, short-lived challenge nonce. A nonce on its own leaks nothing. */
export function createFeedChallenge(options: CreateFeedChallengeOptions = {}): FeedChallenge {
  const nowMs = options.now ? Date.parse(options.now) : Date.now();
  const issuedAt = new Date(nowMs).toISOString();
  const ttlMs = options.ttlMs ?? DEFAULT_CHALLENGE_TTL_MS;
  const nonce = bytesToHex(nacl.randomBytes(options.nonceBytes ?? DEFAULT_NONCE_BYTES));
  return { nonce, issuedAt, expiresAt: new Date(nowMs + ttlMs).toISOString() };
}

/** Canonical bytes a member signs to prove membership for a pull. */
export function feedAuthCanonical(communityId: string, nonce: string, ts: string): Uint8Array {
  return encoder.encode(JSON.stringify(['meerkat-feed-auth-v1', communityId, nonce, ts]));
}

export interface FeedAuthFields {
  communityId: string;
  nonce: string;
  ts: string;
}

/** Sign a feed-auth challenge with this device's Ed25519 key. Returns hex. */
export function signFeedAuth(identity: DeviceIdentity, fields: FeedAuthFields): string {
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  return bytesToHex(signMessage(privateKeyHex, feedAuthCanonical(fields.communityId, fields.nonce, fields.ts)));
}

export interface VerifyFeedAuthInput extends FeedAuthFields {
  /** The signing device id (Ed25519 public key hex). */
  deviceId: string;
  signature: string;
  /** The community's LATEST signed descriptor (the roster the node holds). */
  descriptor: CommunityDescriptor;
  now?: string;
  maxSkewMs?: number;
  /** When provided, now must be <= expiresAt (the issued challenge's expiry). */
  expiresAt?: string;
}

export type FeedAuthVerdict =
  | { ok: true; role: WorkspaceMemberRole }
  | { ok: false; reason: 'bad_signature' | 'not_member' | 'expired' };

/**
 * Verify a feed-auth proof: signature over the canonical, membership in the
 * latest descriptor (a removed device is absent -> not_member), and freshness
 * (ts within maxSkewMs of now AND, when provided, now <= the challenge expiry).
 */
export function verifyFeedAuth(input: VerifyFeedAuthInput): FeedAuthVerdict {
  const nowMs = input.now ? Date.parse(input.now) : Date.now();
  const maxSkewMs = input.maxSkewMs ?? DEFAULT_MAX_SKEW_MS;

  let signatureOk = false;
  try {
    signatureOk = verifySignature(
      input.deviceId,
      feedAuthCanonical(input.communityId, input.nonce, input.ts),
      hexToBytes(input.signature),
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { ok: false, reason: 'bad_signature' };

  const tsMs = Date.parse(input.ts);
  if (Number.isNaN(tsMs) || Math.abs(nowMs - tsMs) > maxSkewMs) {
    return { ok: false, reason: 'expired' };
  }
  if (input.expiresAt) {
    const expiresMs = Date.parse(input.expiresAt);
    if (Number.isNaN(expiresMs) || nowMs > expiresMs) {
      return { ok: false, reason: 'expired' };
    }
  }

  const role = communityRole(input.descriptor, input.deviceId);
  if (!role) return { ok: false, reason: 'not_member' };

  return { ok: true, role };
}

// ---------------------------------------------------------------------------
// Sealed tail entry (zero-knowledge integrity over ciphertext)
// ---------------------------------------------------------------------------

/**
 * One live tail event as an untrusted host stores it. `sealedHex` is the hex of
 * the epoch-content-key-sealed ChannelMessageEvent bytes (nonce || ciphertext,
 * the same seal shape channel-history.ts uses). The node holds this opaque and
 * verifies ONLY `entrySignature`, an outer author signature over the sealed
 * bytes -- it never decrypts.
 */
export interface SealedTailEntry {
  communityId: string;
  channelId: string;
  authorDeviceId: string;
  hlcWall: string;
  hlcCounter: number;
  sealedHex: string;
  entrySignature: string;
}

export type SealedTailEntryFields = Omit<SealedTailEntry, 'sealedHex' | 'entrySignature'>;

/**
 * Canonical bytes for the OUTER (over-ciphertext) tail signature. Binds the
 * scope + author + HLC to the SHA-512 of the sealed bytes, so the signature
 * commits to exactly these ciphertext bytes without revealing them.
 */
export function sealedTailCanonical(fields: SealedTailEntryFields, sealedBytes: Uint8Array): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-tail-entry-v1',
    fields.communityId,
    fields.channelId,
    fields.authorDeviceId,
    fields.hlcWall,
    fields.hlcCounter,
    sha512Hex(sealedBytes),
  ]));
}

/**
 * Build a signed sealed tail entry from the already-sealed bytes of one event.
 * The signer is the event author; the outer signature is over the ciphertext.
 */
export function signSealedTailEntry(
  identity: DeviceIdentity,
  fields: SealedTailEntryFields,
  sealedBytes: Uint8Array,
): SealedTailEntry {
  const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  const entrySignature = bytesToHex(signMessage(privateKeyHex, sealedTailCanonical(fields, sealedBytes)));
  return {
    communityId: fields.communityId,
    channelId: fields.channelId,
    authorDeviceId: fields.authorDeviceId,
    hlcWall: fields.hlcWall,
    hlcCounter: fields.hlcCounter,
    sealedHex: bytesToHex(sealedBytes),
    entrySignature,
  };
}

export type SealedTailVerdict =
  | { ok: true; role: WorkspaceMemberRole }
  | { ok: false; reason: 'bad_signature' | 'not_member' | 'malformed' };

/**
 * Verify a sealed tail entry WITHOUT decrypting it: the outer author signature
 * holds over the canonical (scope + HLC + hash of sealed bytes), and the author
 * is a member of the descriptor. This is the node's fail-closed integrity gate.
 */
export function verifySealedTailEntry(
  entry: SealedTailEntry,
  descriptor: CommunityDescriptor,
): SealedTailVerdict {
  if (
    typeof entry?.communityId !== 'string'
    || typeof entry.channelId !== 'string'
    || typeof entry.authorDeviceId !== 'string'
    || typeof entry.hlcWall !== 'string'
    || typeof entry.hlcCounter !== 'number'
    || typeof entry.sealedHex !== 'string'
    || typeof entry.entrySignature !== 'string'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  let sealedBytes: Uint8Array;
  try {
    sealedBytes = hexToBytes(entry.sealedHex);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (sealedBytes.length === 0) return { ok: false, reason: 'malformed' };

  let signatureOk = false;
  try {
    const fields: SealedTailEntryFields = {
      communityId: entry.communityId,
      channelId: entry.channelId,
      authorDeviceId: entry.authorDeviceId,
      hlcWall: entry.hlcWall,
      hlcCounter: entry.hlcCounter,
    };
    signatureOk = verifySignature(
      entry.authorDeviceId,
      sealedTailCanonical(fields, sealedBytes),
      hexToBytes(entry.entrySignature),
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) return { ok: false, reason: 'bad_signature' };

  const role = communityRole(descriptor, entry.authorDeviceId);
  if (!role) return { ok: false, reason: 'not_member' };

  return { ok: true, role };
}
