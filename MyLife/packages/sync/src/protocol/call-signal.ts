import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { decrypt, encrypt } from '../encryption/encrypt';
import {
  bytesToHex,
  deriveKeyV2,
  generateNonce,
  hexToBytes,
} from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';
import { relayTokenDayBucket } from './day-bucket';

export const CALL_SIGNAL_DOMAIN = 'meerkat-call-signal-v1';

export type CallSignalKind =
  | 'invite'
  | 'accept'
  | 'decline'
  | 'busy'
  | 'cancel'
  | 'end'
  | 'offer'
  | 'answer'
  | 'ice'
  | 'restart';

export interface CallSignal {
  version: 1;
  callId: string;
  kind: CallSignalKind;
  fromDeviceId: string;
  toDeviceId: string;
  media: 'voice' | 'video';
  payloadCiphertext?: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  signature: string;
}

export interface CreateCallSignalInput {
  sender: DeviceIdentity;
  callId: string;
  kind: CallSignalKind;
  toDeviceId: string;
  media: CallSignal['media'];
  payloadCiphertext?: string;
  issuedAt?: string;
  expiresAt?: string;
  nonce?: string;
  nowMs?: number;
  ttlMs?: number;
}

export type CreateCallSignalRejectReason =
  | 'invalid_input'
  | 'invalid_call_id'
  | 'invalid_sender'
  | 'invalid_recipient'
  | 'invalid_kind'
  | 'invalid_media'
  | 'invalid_timestamp'
  | 'invalid_ttl'
  | 'invalid_nonce'
  | 'invalid_payload_ciphertext'
  | 'payload_too_large'
  | 'signal_too_large'
  | 'signing_failed';

export type CreateCallSignalResult =
  | { ok: true; signal: CallSignal }
  | { ok: false; reason: CreateCallSignalRejectReason };

export interface VerifyCallSignalOptions {
  senderPublicKey: string;
  expectedRecipientDeviceId: string;
  nowMs: number;
  hasSeenNonce: (nonce: string) => boolean;
}

export type CallSignalRejectReason =
  | 'malformed'
  | 'unknown_field'
  | 'signal_too_large'
  | 'invalid_call_id'
  | 'invalid_device_id'
  | 'invalid_timestamp'
  | 'invalid_nonce'
  | 'invalid_payload_ciphertext'
  | 'payload_too_large'
  | 'invalid_version'
  | 'invalid_media'
  | 'invalid_kind'
  | 'invalid_ttl'
  | 'ttl_exceeded'
  | 'issued_in_future'
  | 'expired'
  | 'wrong_recipient'
  | 'invalid_signature'
  | 'sender_mismatch'
  | 'replayed_nonce'
  | 'replay_check_failed';

export type VerifyCallSignalResult =
  | { ok: true; signal: CallSignal }
  | { ok: false; reason: CallSignalRejectReason };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const DEFAULT_TTL_MS = 60_000;
const MAX_TTL_MS = 120_000;
const MAX_FUTURE_SKEW_MS = 30_000;
const MAX_SIGNAL_BYTES = 64 * 1024;
const MAX_PAYLOAD_CIPHERTEXT_BYTES = 32 * 1024;
const MAX_CALL_ID_BYTES = 128;
const MAX_TIMESTAMP_BYTES = 64;
const MIN_NONCE_HEX_LENGTH = 32;
const MAX_NONCE_HEX_LENGTH = 128;
const SECRETBOX_NONCE_HEX_LENGTH = 48;
const SECRETBOX_TAG_HEX_LENGTH = 32;

const CALL_SIGNAL_KINDS = new Set<string>([
  'invite',
  'accept',
  'decline',
  'busy',
  'cancel',
  'end',
  'offer',
  'answer',
  'ice',
  'restart',
]);

const CALL_SIGNAL_FIELDS = new Set([
  'version',
  'callId',
  'kind',
  'fromDeviceId',
  'toDeviceId',
  'media',
  'payloadCiphertext',
  'issuedAt',
  'expiresAt',
  'nonce',
  'signature',
]);

const REQUIRED_CALL_SIGNAL_FIELDS = [
  'version',
  'callId',
  'kind',
  'fromDeviceId',
  'toDeviceId',
  'media',
  'issuedAt',
  'expiresAt',
  'nonce',
  'signature',
] as const;

// --- Signal profiles (2026-08-25) --------------------------------------------
//
// The WebRTC SYNC rung reuses this file's signed-envelope machinery instead of
// carrying its own weaker envelope (no signature, in-memory replay floor). The
// two protocols stay cryptographically disjoint through a profile: a distinct
// signing DOMAIN (a call signature can never verify as a sync signal and vice
// versa), a distinct media value ('data', invalid on the call profile), and a
// tighter kind set. All validation below is shared verbatim.

interface SignalProfile {
  domain: string;
  media: ReadonlySet<string>;
  kinds: ReadonlySet<string>;
}

const CALL_SIGNAL_PROFILE: SignalProfile = {
  domain: CALL_SIGNAL_DOMAIN,
  media: new Set(['voice', 'video']),
  kinds: CALL_SIGNAL_KINDS,
};

export const WEBRTC_SYNC_SIGNAL_DOMAIN = 'meerkat-webrtc-sync-signal-v1';

export type WebRTCSyncSignalKind = 'offer' | 'answer' | 'ice';

const WEBRTC_SYNC_SIGNAL_PROFILE: SignalProfile = {
  domain: WEBRTC_SYNC_SIGNAL_DOMAIN,
  media: new Set(['data']),
  kinds: new Set(['offer', 'answer', 'ice']),
};

/** A signed WebRTC sync-signaling record: CallSignal shape, sync profile. */
export interface WebRTCSyncSignal {
  version: 1;
  /** The sync session id (the profile's callId slot). */
  callId: string;
  kind: WebRTCSyncSignalKind;
  fromDeviceId: string;
  toDeviceId: string;
  media: 'data';
  payloadCiphertext?: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  signature: string;
}

/** The widened internal shapes the shared machinery operates on. */
type AnySignal = Omit<CallSignal, 'media' | 'kind'> & { media: string; kind: string };
type UnsignedAnySignal = Omit<AnySignal, 'signature'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function byteLength(value: string): number {
  return encoder.encode(value).length;
}

function isBoundedString(value: unknown, minBytes: number, maxBytes: number): value is string {
  if (typeof value !== 'string') return false;
  const length = byteLength(value);
  return length >= minBytes && length <= maxBytes;
}

function isHex(value: string): boolean {
  return value.length % 2 === 0 && /^[0-9a-f]+$/u.test(value);
}

function isDeviceId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

function isNonce(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= MIN_NONCE_HEX_LENGTH
    && value.length <= MAX_NONCE_HEX_LENGTH
    && isHex(value);
}

function isPayloadCiphertext(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 2) return false;
  const [nonceHex, ciphertextHex] = parts;
  return nonceHex?.length === SECRETBOX_NONCE_HEX_LENGTH
    && typeof ciphertextHex === 'string'
    && ciphertextHex.length >= SECRETBOX_TAG_HEX_LENGTH
    && isHex(nonceHex)
    && isHex(ciphertextHex);
}

function parseTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function payloadCommitment(payloadCiphertext: string | undefined): string {
  return payloadCiphertext === undefined
    ? ''
    : sha512Hex(encoder.encode(payloadCiphertext));
}

function canonicalCallSignal(signal: UnsignedAnySignal, domain: string): Uint8Array {
  return encoder.encode(JSON.stringify([
    domain,
    signal.version,
    signal.callId,
    signal.kind,
    signal.fromDeviceId,
    signal.toDeviceId,
    signal.media,
    payloadCommitment(signal.payloadCiphertext),
    signal.issuedAt,
    signal.expiresAt,
    signal.nonce,
  ]));
}

function signalJsonByteLength(signal: unknown): number | null {
  const json = JSON.stringify(signal);
  return typeof json === 'string' ? byteLength(json) : null;
}

function createTimestamps(input: Pick<CreateCallSignalInput, 'nowMs' | 'ttlMs' | 'issuedAt' | 'expiresAt'>):
  | { ok: true; issuedAt: string; expiresAt: string }
  | { ok: false; reason: 'invalid_timestamp' | 'invalid_ttl' } {
  if (input.nowMs !== undefined && !Number.isFinite(input.nowMs)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  if (
    input.ttlMs !== undefined
    && (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0 || input.ttlMs > MAX_TTL_MS)
  ) {
    return { ok: false, reason: 'invalid_ttl' };
  }

  let issuedAt = input.issuedAt;
  if (issuedAt === undefined) {
    const nowMs = input.nowMs ?? Date.now();
    try {
      issuedAt = new Date(nowMs).toISOString();
    } catch {
      return { ok: false, reason: 'invalid_timestamp' };
    }
  }
  if (!isBoundedString(issuedAt, 1, MAX_TIMESTAMP_BYTES)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  const issuedAtMs = parseTimestamp(issuedAt);
  if (issuedAtMs === null) return { ok: false, reason: 'invalid_timestamp' };

  let expiresAt = input.expiresAt;
  if (expiresAt === undefined) {
    try {
      expiresAt = new Date(issuedAtMs + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString();
    } catch {
      return { ok: false, reason: 'invalid_timestamp' };
    }
  }
  if (!isBoundedString(expiresAt, 1, MAX_TIMESTAMP_BYTES)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  const expiresAtMs = parseTimestamp(expiresAt);
  if (expiresAtMs === null) return { ok: false, reason: 'invalid_timestamp' };

  const ttlMs = expiresAtMs - issuedAtMs;
  if (ttlMs <= 0 || ttlMs > MAX_TTL_MS) {
    return { ok: false, reason: 'invalid_ttl' };
  }
  return { ok: true, issuedAt, expiresAt };
}

type CreateAnySignalInput = Omit<CreateCallSignalInput, 'kind' | 'media'> & {
  kind: string;
  media: string;
};

type CreateAnySignalResult =
  | { ok: true; signal: AnySignal }
  | { ok: false; reason: CreateCallSignalRejectReason };

export function createCallSignal(input: CreateCallSignalInput): CreateCallSignalResult {
  return createSignalWithProfile(input, CALL_SIGNAL_PROFILE) as CreateCallSignalResult;
}

function createSignalWithProfile(
  input: CreateAnySignalInput,
  profile: SignalProfile,
): CreateAnySignalResult {
  try {
    if (!isRecord(input) || !isRecord(input.sender)) {
      return { ok: false, reason: 'invalid_input' };
    }
    if (!isBoundedString(input.callId, 1, MAX_CALL_ID_BYTES)) {
      return { ok: false, reason: 'invalid_call_id' };
    }
    if (!isDeviceId(input.sender.publicKey)) {
      return { ok: false, reason: 'invalid_sender' };
    }
    if (!isDeviceId(input.toDeviceId)) {
      return { ok: false, reason: 'invalid_recipient' };
    }
    if (!profile.kinds.has(input.kind)) {
      return { ok: false, reason: 'invalid_kind' };
    }
    if (!profile.media.has(input.media)) {
      return { ok: false, reason: 'invalid_media' };
    }
    if (input.payloadCiphertext !== undefined) {
      if (typeof input.payloadCiphertext !== 'string') {
        return { ok: false, reason: 'invalid_payload_ciphertext' };
      }
      if (byteLength(input.payloadCiphertext) > MAX_PAYLOAD_CIPHERTEXT_BYTES) {
        return { ok: false, reason: 'payload_too_large' };
      }
      if (!isPayloadCiphertext(input.payloadCiphertext)) {
        return { ok: false, reason: 'invalid_payload_ciphertext' };
      }
    }

    const timestamps = createTimestamps(input);
    if (!timestamps.ok) return timestamps;

    const nonce = input.nonce ?? bytesToHex(generateNonce());
    if (!isNonce(nonce)) return { ok: false, reason: 'invalid_nonce' };

    const unsigned: UnsignedAnySignal = {
      version: 1,
      callId: input.callId,
      kind: input.kind,
      fromDeviceId: input.sender.publicKey,
      toDeviceId: input.toDeviceId,
      media: input.media,
      ...(input.payloadCiphertext !== undefined
        ? { payloadCiphertext: input.payloadCiphertext }
        : {}),
      issuedAt: timestamps.issuedAt,
      expiresAt: timestamps.expiresAt,
      nonce,
    };

    let signature: string;
    try {
      const privateKeyHex = extractSigningPrivateKeyHex(input.sender.privateKeyRef);
      signature = bytesToHex(signMessage(privateKeyHex, canonicalCallSignal(unsigned, profile.domain)));
    } catch {
      return { ok: false, reason: 'signing_failed' };
    }

    const signal: AnySignal = { ...unsigned, signature };
    const totalBytes = signalJsonByteLength(signal);
    if (totalBytes === null || totalBytes > MAX_SIGNAL_BYTES) {
      return { ok: false, reason: 'signal_too_large' };
    }
    return { ok: true, signal };
  } catch {
    return { ok: false, reason: 'invalid_input' };
  }
}

export function encryptCallPayload(
  pairSecretBytes: Uint8Array,
  callId: string,
  payload: unknown,
): string {
  const json = JSON.stringify(payload);
  if (typeof json !== 'string') throw new TypeError('Call payload must be JSON serializable');
  const key = deriveKeyV2(pairSecretBytes, `meerkat-call-signal-payload:v1:${callId}`);
  const sealed = encrypt(encoder.encode(json), key);
  return `${bytesToHex(sealed.nonce)}.${bytesToHex(sealed.ciphertext)}`;
}

export function decryptCallPayload<T>(
  pairSecretBytes: Uint8Array,
  callId: string,
  payloadCiphertext: string,
): T | null {
  try {
    if (!isPayloadCiphertext(payloadCiphertext)) return null;
    const [nonceHex, ciphertextHex] = payloadCiphertext.split('.') as [string, string];
    const key = deriveKeyV2(pairSecretBytes, `meerkat-call-signal-payload:v1:${callId}`);
    const plaintext = decrypt(hexToBytes(ciphertextHex), hexToBytes(nonceHex), key);
    if (!plaintext) return null;
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch {
    return null;
  }
}

type VerifyAnySignalResult =
  | { ok: true; signal: AnySignal }
  | { ok: false; reason: CallSignalRejectReason };

function verifyCallSignalUnsafe(
  value: unknown,
  opts: VerifyCallSignalOptions,
  profile: SignalProfile,
): VerifyAnySignalResult {
  const totalBytes = signalJsonByteLength(value);
  if (totalBytes === null) return { ok: false, reason: 'malformed' };
  if (totalBytes > MAX_SIGNAL_BYTES) return { ok: false, reason: 'signal_too_large' };
  if (!isRecord(value)) return { ok: false, reason: 'malformed' };

  const keys = Object.keys(value);
  if (keys.some((key) => !CALL_SIGNAL_FIELDS.has(key))) {
    return { ok: false, reason: 'unknown_field' };
  }
  if (REQUIRED_CALL_SIGNAL_FIELDS.some((key) => !hasOwn(value, key))) {
    return { ok: false, reason: 'malformed' };
  }
  if (
    typeof value.version !== 'number'
    || typeof value.callId !== 'string'
    || typeof value.kind !== 'string'
    || typeof value.fromDeviceId !== 'string'
    || typeof value.toDeviceId !== 'string'
    || typeof value.media !== 'string'
    || typeof value.issuedAt !== 'string'
    || typeof value.expiresAt !== 'string'
    || typeof value.nonce !== 'string'
    || typeof value.signature !== 'string'
    || (hasOwn(value, 'payloadCiphertext') && typeof value.payloadCiphertext !== 'string')
  ) {
    return { ok: false, reason: 'malformed' };
  }
  const payloadCiphertext = hasOwn(value, 'payloadCiphertext')
    ? value.payloadCiphertext as string
    : undefined;

  if (!isBoundedString(value.callId, 1, MAX_CALL_ID_BYTES)) {
    return { ok: false, reason: 'invalid_call_id' };
  }
  if (!isDeviceId(value.fromDeviceId) || !isDeviceId(value.toDeviceId)) {
    return { ok: false, reason: 'invalid_device_id' };
  }
  if (
    !isBoundedString(value.issuedAt, 1, MAX_TIMESTAMP_BYTES)
    || !isBoundedString(value.expiresAt, 1, MAX_TIMESTAMP_BYTES)
  ) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  if (!isNonce(value.nonce)) return { ok: false, reason: 'invalid_nonce' };
  if (byteLength(value.signature) !== 128 || !isHex(value.signature)) {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (payloadCiphertext !== undefined) {
    if (byteLength(payloadCiphertext) > MAX_PAYLOAD_CIPHERTEXT_BYTES) {
      return { ok: false, reason: 'payload_too_large' };
    }
    if (!isPayloadCiphertext(payloadCiphertext)) {
      return { ok: false, reason: 'invalid_payload_ciphertext' };
    }
  }

  if (value.version !== 1) return { ok: false, reason: 'invalid_version' };
  if (!profile.media.has(value.media)) {
    return { ok: false, reason: 'invalid_media' };
  }
  if (!profile.kinds.has(value.kind)) {
    return { ok: false, reason: 'invalid_kind' };
  }

  const issuedAtMs = parseTimestamp(value.issuedAt);
  const expiresAtMs = parseTimestamp(value.expiresAt);
  if (
    issuedAtMs === null
    || expiresAtMs === null
    || !Number.isFinite(opts.nowMs)
  ) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  const ttlMs = expiresAtMs - issuedAtMs;
  if (ttlMs <= 0) return { ok: false, reason: 'invalid_ttl' };
  if (ttlMs > MAX_TTL_MS) return { ok: false, reason: 'ttl_exceeded' };
  if (issuedAtMs > opts.nowMs + MAX_FUTURE_SKEW_MS) {
    return { ok: false, reason: 'issued_in_future' };
  }
  if (opts.nowMs >= expiresAtMs) return { ok: false, reason: 'expired' };
  if (value.toDeviceId !== opts.expectedRecipientDeviceId) {
    return { ok: false, reason: 'wrong_recipient' };
  }

  const signal: AnySignal = {
    version: 1,
    callId: value.callId,
    kind: value.kind,
    fromDeviceId: value.fromDeviceId,
    toDeviceId: value.toDeviceId,
    media: value.media,
    ...(payloadCiphertext !== undefined
      ? { payloadCiphertext }
      : {}),
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    nonce: value.nonce,
    signature: value.signature,
  };

  const { signature, ...unsigned } = signal;
  if (!verifySignature(opts.senderPublicKey, canonicalCallSignal(unsigned, profile.domain), hexToBytes(signature))) {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (signal.fromDeviceId !== opts.senderPublicKey) {
    return { ok: false, reason: 'sender_mismatch' };
  }
  if (typeof opts.hasSeenNonce !== 'function') return { ok: false, reason: 'replay_check_failed' };

  let replayed: boolean;
  try {
    replayed = opts.hasSeenNonce(signal.nonce);
  } catch {
    return { ok: false, reason: 'replay_check_failed' };
  }
  if (replayed) return { ok: false, reason: 'replayed_nonce' };
  return { ok: true, signal };
}

export function verifyCallSignal(
  signal: unknown,
  opts: VerifyCallSignalOptions,
): VerifyCallSignalResult {
  try {
    return verifyCallSignalUnsafe(signal, opts, CALL_SIGNAL_PROFILE) as VerifyCallSignalResult;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

export function deriveCallSignalToken(pairSecretHex: string, callId: string): string {
  return bytesToHex(deriveKeyV2(
    hexToBytes(pairSecretHex),
    `meerkat-call-signal-token:v1:${callId}`,
  ));
}

/**
 * The per-pair invite channel id (WP-25G). A callee cannot know a callId before
 * the invite arrives, so invites (and pre-accept cancels) ride a stable
 * pair-private channel token; every other signal rides the per-call token.
 * The id is namespaced so it can never collide with an app-generated callId.
 */
export const CALL_INVITE_CHANNEL_ID = 'meerkat-call-invite-channel:v1';

export function deriveCallInviteToken(pairSecretHex: string): string {
  return deriveCallSignalToken(pairSecretHex, CALL_INVITE_CHANNEL_ID);
}

// --- Sealed relay frames (WP-25G) -------------------------------------------
//
// A CallSignal is signed and its SDP/ICE payload is already recipient-encrypted,
// but its envelope fields (device ids, kind, timestamps) must never cross the
// relay in cleartext: the relay is an opaque carrier that sees a token, sizes,
// and timing only. Both pair members hold pairSecret, so frames are sealed with
// a pair-derived key under a dedicated HKDF context.

const CALL_SIGNAL_FRAME_CONTEXT = 'meerkat-call-signal-frame:v1';
const MAX_FRAME_TEXT_LENGTH = 2 * MAX_SIGNAL_BYTES + SECRETBOX_NONCE_HEX_LENGTH + 64;

function sealSignalFrameWithContext(
  pairSecretBytes: Uint8Array,
  signal: AnySignal,
  context: string,
): Uint8Array {
  const key = deriveKeyV2(pairSecretBytes, context);
  const sealed = encrypt(encoder.encode(JSON.stringify(signal)), key);
  return encoder.encode(`${bytesToHex(sealed.nonce)}.${bytesToHex(sealed.ciphertext)}`);
}

export function sealCallSignalFrame(pairSecretBytes: Uint8Array, signal: CallSignal): Uint8Array {
  return sealSignalFrameWithContext(pairSecretBytes, signal, CALL_SIGNAL_FRAME_CONTEXT);
}

/**
 * Open a sealed relay frame back into an UNVERIFIED signal candidate. The
 * caller MUST pass the result through verifyCallSignal (NC-25.2); this only
 * removes the transport sealing. Returns null on any malformed or tampered
 * frame (fail-closed, no throw on raw relay input).
 */
export function openCallSignalFrame(pairSecretBytes: Uint8Array, frame: Uint8Array): unknown {
  return openSignalFrameWithContext(pairSecretBytes, frame, CALL_SIGNAL_FRAME_CONTEXT);
}

function openSignalFrameWithContext(
  pairSecretBytes: Uint8Array,
  frame: Uint8Array,
  context: string,
): unknown {
  try {
    if (frame.length > MAX_FRAME_TEXT_LENGTH) return null;
    const text = decoder.decode(frame);
    const parts = text.split('.');
    if (parts.length !== 2) return null;
    const [nonceHex, ciphertextHex] = parts as [string, string];
    if (nonceHex.length !== SECRETBOX_NONCE_HEX_LENGTH || !isHex(nonceHex)) return null;
    if (ciphertextHex.length < SECRETBOX_TAG_HEX_LENGTH || !isHex(ciphertextHex)) return null;
    const key = deriveKeyV2(pairSecretBytes, context);
    const plaintext = decrypt(hexToBytes(ciphertextHex), hexToBytes(nonceHex), key);
    if (!plaintext) return null;
    return JSON.parse(decoder.decode(plaintext)) as unknown;
  } catch {
    return null;
  }
}

export function resolveCallGlare(
  local: { callId: string; fromDeviceId: string },
  remote: { callId: string; fromDeviceId: string },
): { callId: string; fromDeviceId: string } {
  if (local.callId < remote.callId) return { ...local };
  if (remote.callId < local.callId) return { ...remote };
  return local.fromDeviceId <= remote.fromDeviceId ? { ...local } : { ...remote };
}

// --- WebRTC SYNC signaling (2026-08-25) --------------------------------------
//
// The dev-build WebRTC sync rung's SDP/ICE exchange, on the SAME signed
// machinery as call signals (create/verify/seal/open above) under its own
// profile. Differences from the call profile, all enforced in one place:
// domain WEBRTC_SYNC_SIGNAL_DOMAIN, media 'data' only, kinds offer/answer/ice
// only, its own frame HKDF context, and DAY-BUCKETED invite tokens (the v1
// invite token was a static per-pair pseudonym the relay could track across
// days; the per-session token was already ephemeral and stays un-bucketed).

const WEBRTC_SYNC_FRAME_CONTEXT = 'meerkat-webrtc-sync-signal-frame:v1';
const WEBRTC_SYNC_SESSION_TOKEN_CONTEXT = 'meerkat-webrtc-sync-session-token:v1';
const WEBRTC_SYNC_INVITE_TOKEN_CONTEXT = 'meerkat-webrtc-sync-invite-token:v2';
const WEBRTC_SYNC_PAYLOAD_ID_PREFIX = 'webrtc-sync';
const WEBRTC_SYNC_DEFAULT_TTL_MS = 30_000;

export interface CreateWebRTCSyncSignalInput {
  sender: DeviceIdentity;
  /** The sync session id (64-hex, chosen by the dialer). */
  sessionId: string;
  kind: WebRTCSyncSignalKind;
  toDeviceId: string;
  payloadCiphertext: string;
  nowMs?: number;
  ttlMs?: number;
  nonce?: string;
}

export type CreateWebRTCSyncSignalResult =
  | { ok: true; signal: WebRTCSyncSignal }
  | { ok: false; reason: CreateCallSignalRejectReason };

export function createWebRTCSyncSignal(
  input: CreateWebRTCSyncSignalInput,
): CreateWebRTCSyncSignalResult {
  return createSignalWithProfile(
    {
      sender: input.sender,
      callId: input.sessionId,
      kind: input.kind,
      toDeviceId: input.toDeviceId,
      media: 'data',
      payloadCiphertext: input.payloadCiphertext,
      nowMs: input.nowMs,
      ttlMs: input.ttlMs ?? WEBRTC_SYNC_DEFAULT_TTL_MS,
      nonce: input.nonce,
    },
    WEBRTC_SYNC_SIGNAL_PROFILE,
  ) as CreateWebRTCSyncSignalResult;
}

export type VerifyWebRTCSyncSignalResult =
  | { ok: true; signal: WebRTCSyncSignal }
  | { ok: false; reason: CallSignalRejectReason };

/**
 * Verify an opened sync-signal candidate: same checks as verifyCallSignal
 * (strict fields, bounds, TTL, skew, recipient, Ed25519 signature under the
 * sync domain, sender binding, replay callback) with the sync profile. The
 * caller records the nonce AFTER acting on the signal, exactly like the call
 * path (verification never mutates the replay floor).
 */
export function verifyWebRTCSyncSignal(
  signal: unknown,
  opts: VerifyCallSignalOptions,
): VerifyWebRTCSyncSignalResult {
  try {
    return verifyCallSignalUnsafe(
      signal,
      opts,
      WEBRTC_SYNC_SIGNAL_PROFILE,
    ) as VerifyWebRTCSyncSignalResult;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

export function sealWebRTCSyncSignalFrame(
  pairSecretBytes: Uint8Array,
  signal: WebRTCSyncSignal,
): Uint8Array {
  return sealSignalFrameWithContext(pairSecretBytes, signal, WEBRTC_SYNC_FRAME_CONTEXT);
}

/** Open a sealed sync frame into an UNVERIFIED candidate (fail-closed null). */
export function openWebRTCSyncSignalFrame(
  pairSecretBytes: Uint8Array,
  frame: Uint8Array,
): unknown {
  return openSignalFrameWithContext(pairSecretBytes, frame, WEBRTC_SYNC_FRAME_CONTEXT);
}

/** The SDP/ICE payload seal (same construction as call payloads, own id space). */
export function encryptWebRTCSyncPayload(
  pairSecretBytes: Uint8Array,
  sessionId: string,
  payload: unknown,
): string {
  return encryptCallPayload(pairSecretBytes, `${WEBRTC_SYNC_PAYLOAD_ID_PREFIX}:${sessionId}`, payload);
}

export function decryptWebRTCSyncPayload<T>(
  pairSecretBytes: Uint8Array,
  sessionId: string,
  payloadCiphertext: string,
): T | null {
  return decryptCallPayload<T>(
    pairSecretBytes,
    `${WEBRTC_SYNC_PAYLOAD_ID_PREFIX}:${sessionId}`,
    payloadCiphertext,
  );
}

/**
 * The day-bucketed invite token a DIALER sends its offer on (v2). Rotates
 * daily so the relay cannot track a static per-pair rendezvous across days.
 */
export function deriveWebRTCSyncInviteToken(pairSecretHex: string, nowMs: number): string {
  return bytesToHex(deriveKeyV2(
    hexToBytes(pairSecretHex),
    `${WEBRTC_SYNC_INVITE_TOKEN_CONTEXT}:${relayTokenDayBucket(nowMs)}`,
  ));
}

/**
 * The LISTENER-side invite token window: current + previous UTC day bucket
 * (see day-bucket.ts for the boundary rule; the relay parks frames for absent
 * tokens, and the 30s signal TTL bounds how stale a parked offer can be).
 */
export function deriveWebRTCSyncInviteListenTokens(
  pairSecretHex: string,
  nowMs: number,
): string[] {
  return [
    deriveWebRTCSyncInviteToken(pairSecretHex, nowMs),
    deriveWebRTCSyncInviteToken(pairSecretHex, nowMs - 86_400_000),
  ];
}

/** The per-session channel token (already ephemeral: sessionId is random). */
export function deriveWebRTCSyncSessionToken(pairSecretHex: string, sessionId: string): string {
  return bytesToHex(deriveKeyV2(
    hexToBytes(pairSecretHex),
    `${WEBRTC_SYNC_SESSION_TOKEN_CONTEXT}:${sessionId}`,
  ));
}
