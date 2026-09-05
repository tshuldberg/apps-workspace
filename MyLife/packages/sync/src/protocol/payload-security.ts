import type {
  PairedDevice,
  SyncMessage,
  SyncMessageType,
  SyncSecuritySubjectType,
} from '../types';
import { decrypt, encrypt } from '../encryption/encrypt';
import { bytesToHex, deriveKey, deriveKeyV2, hexToBytes } from '../encryption/keys';
import { getSharedSecretHex } from '../secrets/sync-secret-store';
import { createJsonMessage, parseJsonPayload } from './message-codec';

/**
 * Per-message forward-secrecy ratchet (D.6). Each application message on a
 * forward-secret data channel is sealed under a distinct key derived from a
 * one-way HKDF chain advanced per message index:
 *
 *   ck_0 = HKDF(sessionKey, "root")
 *   ck_i = HKDF(ck_{i-1}, "chain")
 *   mk_i = HKDF(ck_i,     "message-key")
 *
 * mk_i is a one-way image of ck_i, so an attacker who captures a single message
 * key cannot recover its chain key and therefore cannot derive any other
 * message key (neither mk_{i-1} nor mk_{i+1}). Chain keys are retained so an
 * out-of-order or late frame can still be opened; the cross-session forward
 * secrecy comes from the ephemeral Noise session key, and this ratchet layers
 * per-message key isolation on top of it.
 */
const RATCHET_ROOT_INFO = 'mylife-sync-msg-ratchet:root';
const RATCHET_CHAIN_INFO = 'mylife-sync-msg-ratchet:chain';
const RATCHET_KEY_INFO = 'mylife-sync-msg-ratchet:message-key';

/**
 * The furthest a wire-supplied index may jump past the current chain frontier
 * before it is rejected. Honest streams advance by one per message, so a few
 * thousand is generous for out-of-order delivery while denying a compromised
 * paired peer a giant-index DoS (unbounded chain iteration / allocation).
 */
const RATCHET_MAX_SKIP = 4096;

export class MessageRatchet {
  private chainKeys: Uint8Array[] = [];
  private messageKeys = new Map<number, Uint8Array>();
  private sendIndex = 0;

  constructor(sessionKey: Uint8Array) {
    // The raw session key never seals a message directly; ck_0 is a one-way
    // derivation of it.
    this.chainKeys[0] = deriveKeyV2(sessionKey, RATCHET_ROOT_INFO);
  }

  /** Reserve and return the next monotonic index for an outbound message. */
  nextIndex(): number {
    return this.sendIndex++;
  }

  /**
   * Message key for a trusted, locally generated index (outbound). Walks the
   * chain forward as needed. Callers only ever pass `nextIndex()`, so the index
   * is a small sequential integer.
   */
  messageKey(index: number): Uint8Array {
    const cached = this.messageKeys.get(index);
    if (cached) return cached;
    for (let i = this.chainKeys.length; i <= index; i++) {
      this.chainKeys[i] = deriveKeyV2(this.chainKeys[i - 1]!, RATCHET_CHAIN_INFO);
    }
    const mk = deriveKeyV2(this.chainKeys[index]!, RATCHET_KEY_INFO);
    this.messageKeys.set(index, mk);
    return mk;
  }

  /**
   * Message key for a wire-supplied index (inbound). Fail-closed: a non-integer,
   * negative, or far-future index (a DoS-shaped input from a compromised paired
   * peer) is rejected with null instead of forcing an unbounded chain walk /
   * allocation or throwing out of the synchronous data handler.
   */
  messageKeyForWireIndex(index: number): Uint8Array | null {
    if (!Number.isInteger(index) || index < 0) return null;
    const frontier = this.chainKeys.length - 1;
    if (index > frontier + RATCHET_MAX_SKIP) return null;
    return this.messageKey(index);
  }
}

export interface SessionPayloadSecurity {
  enabled: boolean;
  key: Uint8Array | null;
  /**
   * Present on a forward-secret data channel: each message is sealed under a
   * per-index ratchet key instead of the bare session key. Absent on the
   * negotiation channel and on the static / group-epoch data channels.
   */
  ratchet?: MessageRatchet | null;
}

interface EncryptedPayloadEnvelope {
  encrypted: true;
  version: 1;
  algorithm: 'xsalsa20-poly1305';
  nonceHex: string;
  ciphertextHex: string;
  /** Ratchet index (D.6). Present only on forward-secret data-channel frames. */
  msgIndex?: number;
}

function isEncryptedPayloadEnvelope(value: unknown): value is EncryptedPayloadEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.encrypted === true
    && record.version === 1
    && record.algorithm === 'xsalsa20-poly1305'
    && typeof record.nonceHex === 'string'
    && typeof record.ciphertextHex === 'string'
    && (record.msgIndex === undefined || typeof record.msgIndex === 'number');
}

function extractLocalSharedSecret(ref: string, remoteDeviceId: string): Uint8Array | null {
  const secureSecretHex = getSharedSecretHex(ref);
  if (secureSecretHex) {
    return hexToBytes(secureSecretHex);
  }

  const prefix = 'local:shared:';
  if (!ref.startsWith(prefix)) return null;

  const secretHex = ref.slice(prefix.length);
  if (secretHex === remoteDeviceId) return null;
  if (!/^[0-9a-f]+$/i.test(secretHex) || secretHex.length < 64 || secretHex.length % 2 !== 0) {
    return null;
  }

  try {
    return hexToBytes(secretHex.slice(0, 64));
  } catch {
    return null;
  }
}

/** KDF versions this build can speak, newest first (MK-010). */
export const SUPPORTED_KDF_VERSIONS: readonly number[] = [2, 1];

/**
 * Pick the highest KDF version both sides support. A peer that does not
 * advertise versions predates negotiation and gets v1 (the fallback window).
 */
export function negotiateKdfVersion(
  local: readonly number[],
  remote: readonly number[] | undefined,
): number {
  if (!remote || remote.length === 0) return 1;
  const remoteSet = new Set(remote);
  const mutual = [...local].filter((v) => remoteSet.has(v)).sort((a, b) => b - a);
  return mutual[0] ?? 1;
}

/**
 * Resolve the raw pairwise shared secret for an active paired device, or null
 * when the peer is unknown, revoked, or its secret cannot be loaded. Shared by
 * the payload channel and the frame envelope so both key off the same pairing.
 */
export function resolvePairSharedSecret(
  pairedDevices: PairedDevice[],
  remoteDeviceId: string,
): Uint8Array | null {
  const paired = pairedDevices.find((device) => (
    device.deviceId === remoteDeviceId && device.isActive
  ));
  if (!paired) return null;
  return extractLocalSharedSecret(paired.sharedSecretRef, remoteDeviceId);
}

export function resolvePayloadEncryptionKey(opts: {
  pairedDevices: PairedDevice[];
  localDeviceId: string;
  remoteDeviceId: string;
  subjectType: SyncSecuritySubjectType;
  subjectId: string;
  /** Negotiated KDF version: 2 = RFC 5869 HKDF, 1 = legacy concat-hash. */
  kdfVersion?: number;
}): Uint8Array | null {
  const sharedSecret = resolvePairSharedSecret(opts.pairedDevices, opts.remoteDeviceId);
  if (!sharedSecret) return null;

  const pairId = [opts.localDeviceId, opts.remoteDeviceId].sort().join(':');
  const subjectId = opts.subjectType === 'direct' ? pairId : opts.subjectId;
  const info = `mylife-sync-payload:${opts.subjectType}:${subjectId}:${pairId}`;
  return (opts.kdfVersion ?? 1) >= 2
    ? deriveKeyV2(sharedSecret, info)
    : deriveKey(sharedSecret, info);
}

export function createSessionPayloadSecurity(
  key: Uint8Array | null,
  encryptionConfirmed: boolean,
): SessionPayloadSecurity {
  return {
    enabled: encryptionConfirmed && key !== null,
    key,
    ratchet: null,
  };
}

/**
 * Attach a per-message forward-secrecy ratchet to a keyed data channel (D.6).
 * A no-op on a channel with no key. Both peers wrap the SAME session key, so
 * they derive identical per-message keys.
 */
export function withMessageRatchet(security: SessionPayloadSecurity): SessionPayloadSecurity {
  if (!security.enabled || !security.key) return security;
  return { ...security, ratchet: new MessageRatchet(security.key) };
}

export function createSecureJsonMessage(
  type: SyncMessageType,
  deviceId: string,
  nonce: string,
  payload: unknown,
  security: SessionPayloadSecurity,
): SyncMessage {
  if (!security.enabled || !security.key) {
    return createJsonMessage(type, deviceId, nonce, payload);
  }

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  if (security.ratchet) {
    const msgIndex = security.ratchet.nextIndex();
    const encrypted = encrypt(plaintext, security.ratchet.messageKey(msgIndex));
    return createJsonMessage(type, deviceId, nonce, {
      encrypted: true,
      version: 1,
      algorithm: 'xsalsa20-poly1305',
      nonceHex: bytesToHex(encrypted.nonce),
      ciphertextHex: bytesToHex(encrypted.ciphertext),
      msgIndex,
    } satisfies EncryptedPayloadEnvelope);
  }

  const encrypted = encrypt(plaintext, security.key);
  return createJsonMessage(type, deviceId, nonce, {
    encrypted: true,
    version: 1,
    algorithm: 'xsalsa20-poly1305',
    nonceHex: bytesToHex(encrypted.nonce),
    ciphertextHex: bytesToHex(encrypted.ciphertext),
  } satisfies EncryptedPayloadEnvelope);
}

export function parseSecureJsonPayload<T>(
  message: SyncMessage,
  security: SessionPayloadSecurity,
): T | null {
  const parsed = parseJsonPayload<unknown>(message);
  if (!isEncryptedPayloadEnvelope(parsed)) {
    if (security.enabled) return null;
    return parsed as T | null;
  }

  if (!security.enabled || !security.key) return null;

  // A ratcheted frame carries its message index; derive that message's key. A
  // frame without an index uses the bare session key. The two must match the
  // channel: a ratcheted channel rejects an index-less frame and vice versa, so
  // a stripped index fails closed rather than silently using the wrong key.
  let key: Uint8Array;
  if (typeof parsed.msgIndex === 'number') {
    if (!security.ratchet) return null;
    // Fail-closed on a hostile wire index (negative, non-integer, or a giant
    // forward jump). Never derive or throw on untrusted input.
    const wireKey = security.ratchet.messageKeyForWireIndex(parsed.msgIndex);
    if (!wireKey) return null;
    key = wireKey;
  } else {
    if (security.ratchet) return null;
    key = security.key;
  }

  try {
    const plaintext = decrypt(
      hexToBytes(parsed.ciphertextHex),
      hexToBytes(parsed.nonceHex),
      key,
    );
    if (!plaintext) return null;
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}
