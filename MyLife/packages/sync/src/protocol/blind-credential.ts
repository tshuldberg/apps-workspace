/**
 * Anonymous blind credential protocol (Plan 51, Meerkat verification account -- P2).
 *
 * A MeerkatCredential is an epoch-scoped anonymous pass proving "some verified account
 * backs me" WITHOUT revealing which one. Issuance is blind (RSA blind signatures, the
 * RFC 9474 RSABSSA construction parameterized with SHA-512, matching the Privacy Pass
 * publicly verifiable token shape): the account service signs a blinded message and
 * never sees the nonce, the finished token, or its serial. Presentation verifies
 * against the epoch PUBLIC key only, so no account-layer secret ever reaches a
 * verifier surface and no per-presentation account-service call exists.
 *
 * Trust model (mirrors humanity-credential.ts discipline):
 *  - Pure and RN-safe: hashing via tweetnacl SHA-512, arithmetic via BigInt. No
 *    node:crypto here; the raw RSA private-key operation lives server-side in
 *    @mylife/meerkat-relay (blind-credential-server.ts).
 *  - Distinct domain 'meerkat-credential-v1' leads the token message, so a credential
 *    can never cross-verify as a humanity token, publication, or session bearer.
 *  - The serial is sha512(message) truncated to 32 bytes hex: computable by anyone
 *    HOLDING the token, by nobody else -- the issuer cannot compute it (blindness).
 *  - finalize verifies the unblinded signature before returning, so a malicious
 *    signer cannot hand the client a poisoned token.
 *
 * Unlinkability boundary (the one-way wall): the issuance transcript contains only
 * { blindedMessage, blindSignature }; the presentation transcript contains only
 * { message, signature }. The blinding factor makes the pairs cryptographically
 * independent -- AC-1 asserts transcript disjointness in tests.
 */

import nacl from 'tweetnacl';
import { bytesToHex } from '../encryption/keys';

const encoder = new TextEncoder();

/** Distinct domain; leads the token message bytes. */
export const BLIND_CREDENTIAL_DOMAIN = 'meerkat-credential-v1';

/** Epoch 0 starts here; credentials are valid for whole epochs, never mint-stamped. */
export const CREDENTIAL_EPOCH_GENESIS_MS = Date.UTC(2026, 7, 1); // 2026-08-01T00:00:00Z

/** 30-day epochs. */
export const CREDENTIAL_EPOCH_LENGTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Verifiers accept an epoch for 24h past its end (clock skew), never longer. */
export const CREDENTIAL_EPOCH_GRACE_MS = 24 * 60 * 60 * 1000;

/** Renewal opens for the final 7 days of an epoch. */
export const CREDENTIAL_RENEWAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** RSA-2048: modulus length in bytes. */
export const CREDENTIAL_MODULUS_BYTES = 256;

const CREDENTIAL_NONCE_BYTES = 32;
const HASH_LENGTH = 64; // SHA-512
const SALT_LENGTH = 64; // sLen = hLen per RFC 9474 defaults
const MAX_EPOCH = 100000;

export interface MeerkatCredential {
  version: 1;
  epoch: number;
  /** base64 of domain || epoch(4B BE) || nonce(32B). */
  messageBase64: string;
  /** base64 of the 256-byte RSABSSA signature. */
  signatureBase64: string;
}

export interface BlindCredentialRequestState {
  epoch: number;
  messageBase64: string;
  /** base64 of the blinding factor r (256-byte BE). Secret; never leaves the client. */
  blindBase64: string;
}

export type BlindCredentialVerdict = 'ok' | 'expired' | 'invalid';

// ---------------------------------------------------------------------------
// Base64 (self-contained, mirrors humanity-credential.ts; no new dependency)
// ---------------------------------------------------------------------------

const BASE64_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function credentialBytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index]!;
    const byte2 = bytes[index + 1];
    const byte3 = bytes[index + 2];
    const combined = (byte1 << 16) | ((byte2 ?? 0) << 8) | (byte3 ?? 0);
    output += BASE64_TABLE[(combined >> 18) & 0x3f];
    output += BASE64_TABLE[(combined >> 12) & 0x3f];
    output += byte2 === undefined ? '=' : BASE64_TABLE[(combined >> 6) & 0x3f];
    output += byte3 === undefined ? '=' : BASE64_TABLE[combined & 0x3f];
  }
  return output;
}

export function credentialBase64ToBytes(encoded: string): Uint8Array | null {
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) return null;
  const clean = encoded.replace(/=+$/u, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE64_TABLE.indexOf(char);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  const decoded = new Uint8Array(out);
  // Reject alternate encodings that differ only in unused padding bits. A
  // credential has one canonical wire representation, which keeps tamper and
  // replay checks from accepting textually distinct aliases of the same bytes.
  return credentialBytesToBase64(decoded) === encoded ? decoded : null;
}

// ---------------------------------------------------------------------------
// BigInt helpers
// ---------------------------------------------------------------------------

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) result = (result << 8n) | BigInt(byte);
  return result;
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let v = value;
  for (let i = length - 1; i >= 0; i -= 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) throw new Error('Value does not fit in the requested byte length');
  return out;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus <= 0n) throw new Error('Invalid modulus');
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

function modInverse(value: bigint, modulus: bigint): bigint | null {
  let [old_r, r] = [value % modulus, modulus];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }
  if (old_r !== 1n) return null; // not coprime
  return ((old_s % modulus) + modulus) % modulus;
}

// ---------------------------------------------------------------------------
// Minimal SPKI DER parsing for RSA public keys (n, e). The single canonical key
// format everywhere is base64 SPKI DER: node:crypto produces and consumes it
// directly server-side; this parser gives pure clients/verifiers n and e.
// ---------------------------------------------------------------------------

interface DerReader {
  bytes: Uint8Array;
  offset: number;
}

function readDerTagLength(reader: DerReader, expectedTag: number): number {
  const tag = reader.bytes[reader.offset];
  if (tag !== expectedTag) throw new Error(`Unexpected DER tag ${tag} at ${reader.offset}`);
  reader.offset += 1;
  let length = reader.bytes[reader.offset]!;
  reader.offset += 1;
  if (length & 0x80) {
    const lengthBytes = length & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 4) throw new Error('Unsupported DER length');
    length = 0;
    for (let i = 0; i < lengthBytes; i += 1) {
      length = (length << 8) | reader.bytes[reader.offset]!;
      reader.offset += 1;
    }
  }
  if (reader.offset + length > reader.bytes.length) throw new Error('DER length overruns buffer');
  return length;
}

function readDerInteger(reader: DerReader): bigint {
  const length = readDerTagLength(reader, 0x02);
  const slice = reader.bytes.subarray(reader.offset, reader.offset + length);
  reader.offset += length;
  return bytesToBigInt(slice);
}

export interface RsaPublicKeyComponents {
  n: bigint;
  e: bigint;
  modulusBytes: number;
}

/** Parse a base64 SPKI DER RSA public key into (n, e). Returns null on any defect. */
export function parseRsaPublicKeySpki(publicKeySpkiDerBase64: string): RsaPublicKeyComponents | null {
  const der = credentialBase64ToBytes(publicKeySpkiDerBase64);
  if (!der) return null;
  try {
    const reader: DerReader = { bytes: der, offset: 0 };
    readDerTagLength(reader, 0x30); // SubjectPublicKeyInfo
    const algLength = readDerTagLength(reader, 0x30); // AlgorithmIdentifier
    reader.offset += algLength; // skip OID + params (rsaEncryption)
    const bitStringLength = readDerTagLength(reader, 0x03);
    if (reader.bytes[reader.offset] !== 0x00) return null; // unused-bits byte
    const inner: DerReader = {
      bytes: reader.bytes.subarray(reader.offset + 1, reader.offset + bitStringLength),
      offset: 0,
    };
    readDerTagLength(inner, 0x30); // RSAPublicKey
    const n = readDerInteger(inner);
    const e = readDerInteger(inner);
    if (n <= 0n || e <= 1n) return null;
    const modulusBits = n.toString(2).length;
    const modulusBytes = Math.ceil(modulusBits / 8);
    if (modulusBytes !== CREDENTIAL_MODULUS_BYTES) return null; // RSA-2048 only
    return { n, e, modulusBytes };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// EMSA-PSS (SHA-512, MGF1-SHA512, sLen = 64), RFC 8017 sections 9.1.1 / 9.1.2
// ---------------------------------------------------------------------------

function sha512(bytes: Uint8Array): Uint8Array {
  return nacl.hash(bytes);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function mgf1(seed: Uint8Array, maskLength: number): Uint8Array {
  const blocks: Uint8Array[] = [];
  const counter = new Uint8Array(4);
  for (let i = 0; blocks.length * HASH_LENGTH < maskLength; i += 1) {
    counter[0] = (i >> 24) & 0xff;
    counter[1] = (i >> 16) & 0xff;
    counter[2] = (i >> 8) & 0xff;
    counter[3] = i & 0xff;
    blocks.push(sha512(concatBytes(seed, counter)));
  }
  return concatBytes(...blocks).subarray(0, maskLength);
}

function pssEncode(message: Uint8Array, salt: Uint8Array, emBits: number): Uint8Array {
  const emLen = Math.ceil(emBits / 8);
  if (emLen < HASH_LENGTH + salt.length + 2) throw new Error('PSS encoding error: emLen too small');
  const mHash = sha512(message);
  const mPrime = concatBytes(new Uint8Array(8), mHash, salt);
  const h = sha512(mPrime);
  const psLength = emLen - salt.length - HASH_LENGTH - 2;
  const db = concatBytes(new Uint8Array(psLength), Uint8Array.of(0x01), salt);
  const dbMask = mgf1(h, emLen - HASH_LENGTH - 1);
  const maskedDb = new Uint8Array(db.length);
  for (let i = 0; i < db.length; i += 1) maskedDb[i] = db[i]! ^ dbMask[i]!;
  const topBits = 8 * emLen - emBits;
  maskedDb[0]! &= 0xff >> topBits;
  return concatBytes(maskedDb, h, Uint8Array.of(0xbc));
}

function pssVerify(message: Uint8Array, em: Uint8Array, emBits: number): boolean {
  const emLen = Math.ceil(emBits / 8);
  if (em.length !== emLen || emLen < HASH_LENGTH + SALT_LENGTH + 2) return false;
  if (em[emLen - 1] !== 0xbc) return false;
  const maskedDb = em.subarray(0, emLen - HASH_LENGTH - 1);
  const h = em.subarray(emLen - HASH_LENGTH - 1, emLen - 1);
  const topBits = 8 * emLen - emBits;
  if ((maskedDb[0]! & ~(0xff >> topBits)) !== 0) return false;
  const dbMask = mgf1(h, emLen - HASH_LENGTH - 1);
  const db = new Uint8Array(maskedDb.length);
  for (let i = 0; i < db.length; i += 1) db[i] = maskedDb[i]! ^ dbMask[i]!;
  db[0]! &= 0xff >> topBits;
  const psLength = emLen - HASH_LENGTH - SALT_LENGTH - 2;
  for (let i = 0; i < psLength; i += 1) {
    if (db[i] !== 0x00) return false;
  }
  if (db[psLength] !== 0x01) return false;
  const salt = db.subarray(psLength + 1);
  const mHash = sha512(message);
  const mPrime = concatBytes(new Uint8Array(8), mHash, salt);
  const hPrime = sha512(mPrime);
  if (hPrime.length !== h.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i += 1) diff |= h[i]! ^ hPrime[i]!;
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Epoch math
// ---------------------------------------------------------------------------

export function credentialEpochAt(nowMs: number): number {
  if (!Number.isFinite(nowMs) || nowMs < CREDENTIAL_EPOCH_GENESIS_MS) return 0;
  return Math.min(MAX_EPOCH, Math.floor((nowMs - CREDENTIAL_EPOCH_GENESIS_MS) / CREDENTIAL_EPOCH_LENGTH_MS));
}

export function credentialEpochWindow(epoch: number): { notBeforeMs: number; notAfterMs: number } {
  const notBeforeMs = CREDENTIAL_EPOCH_GENESIS_MS + epoch * CREDENTIAL_EPOCH_LENGTH_MS;
  return {
    notBeforeMs,
    notAfterMs: notBeforeMs + CREDENTIAL_EPOCH_LENGTH_MS + CREDENTIAL_EPOCH_GRACE_MS,
  };
}

/** True during the final 7 days of the current epoch, when next-epoch minting opens. */
export function isWithinRenewalWindow(nowMs: number): boolean {
  if (nowMs < CREDENTIAL_EPOCH_GENESIS_MS) return false;
  const epoch = credentialEpochAt(nowMs);
  const { notBeforeMs } = credentialEpochWindow(epoch);
  const epochEndMs = notBeforeMs + CREDENTIAL_EPOCH_LENGTH_MS;
  return nowMs >= epochEndMs - CREDENTIAL_RENEWAL_WINDOW_MS;
}

// ---------------------------------------------------------------------------
// Token message + serial
// ---------------------------------------------------------------------------

function buildTokenMessage(epoch: number, nonce: Uint8Array): Uint8Array {
  const epochBytes = new Uint8Array(4);
  epochBytes[0] = (epoch >> 24) & 0xff;
  epochBytes[1] = (epoch >> 16) & 0xff;
  epochBytes[2] = (epoch >> 8) & 0xff;
  epochBytes[3] = epoch & 0xff;
  return concatBytes(encoder.encode(BLIND_CREDENTIAL_DOMAIN), epochBytes, nonce);
}

const TOKEN_MESSAGE_LENGTH = BLIND_CREDENTIAL_DOMAIN.length + 4 + CREDENTIAL_NONCE_BYTES;

function parseTokenMessage(messageBytes: Uint8Array): { epoch: number } | null {
  if (messageBytes.length !== TOKEN_MESSAGE_LENGTH) return null;
  const domain = encoder.encode(BLIND_CREDENTIAL_DOMAIN);
  for (let i = 0; i < domain.length; i += 1) {
    if (messageBytes[i] !== domain[i]) return null;
  }
  const epoch = (messageBytes[domain.length]! << 24)
    | (messageBytes[domain.length + 1]! << 16)
    | (messageBytes[domain.length + 2]! << 8)
    | messageBytes[domain.length + 3]!;
  if (epoch < 0 || epoch > MAX_EPOCH) return null;
  return { epoch };
}

/**
 * The revocation-list key: sha512(message) truncated to 32 bytes, hex. Only a
 * token holder (or a verifier shown the token) can compute it; the issuer cannot.
 */
export function credentialSerial(messageBase64: string): string | null {
  const messageBytes = credentialBase64ToBytes(messageBase64);
  if (!messageBytes || !parseTokenMessage(messageBytes)) return null;
  return bytesToHex(sha512(messageBytes).subarray(0, 32));
}

// ---------------------------------------------------------------------------
// Client: prepare (blind) and finalize (unblind + verify)
// ---------------------------------------------------------------------------

export interface PreparedBlindCredentialRequest {
  state: BlindCredentialRequestState;
  /** base64 of the 256-byte blinded message. The ONLY token-derived value the issuer sees. */
  blindedMessageBase64: string;
}

/**
 * Build a fresh token message and blind it under the epoch public key.
 * randomBytes is injected (deterministic under test; expo-crypto / webcrypto live).
 */
export function prepareBlindCredentialRequest(
  epoch: number,
  publicKeySpkiDerBase64: string,
  randomBytes: (length: number) => Uint8Array,
): PreparedBlindCredentialRequest | null {
  if (!Number.isInteger(epoch) || epoch < 0 || epoch > MAX_EPOCH) return null;
  const key = parseRsaPublicKeySpki(publicKeySpkiDerBase64);
  if (!key) return null;
  const nonce = randomBytes(CREDENTIAL_NONCE_BYTES);
  if (nonce.length !== CREDENTIAL_NONCE_BYTES) return null;
  const messageBytes = buildTokenMessage(epoch, nonce);
  const salt = randomBytes(SALT_LENGTH);
  if (salt.length !== SALT_LENGTH) return null;
  const emBits = key.modulusBytes * 8 - 1;
  const em = pssEncode(messageBytes, salt, emBits);
  const emInt = bytesToBigInt(em);
  if (emInt >= key.n) return null; // cannot happen with emBits = modBits-1; fail closed anyway
  // Blinding factor r: random, invertible mod n. Retry on the (negligible) miss.
  let r = 0n;
  let rInverse: bigint | null = null;
  for (let attempt = 0; attempt < 8 && rInverse === null; attempt += 1) {
    r = bytesToBigInt(randomBytes(key.modulusBytes)) % key.n;
    if (r <= 1n) continue;
    rInverse = modInverse(r, key.n);
  }
  if (rInverse === null) return null;
  const blinded = (emInt * modPow(r, key.e, key.n)) % key.n;
  return {
    state: {
      epoch,
      messageBase64: credentialBytesToBase64(messageBytes),
      blindBase64: credentialBytesToBase64(bigIntToBytes(r, key.modulusBytes)),
    },
    blindedMessageBase64: credentialBytesToBase64(bigIntToBytes(blinded, key.modulusBytes)),
  };
}

/**
 * Unblind the issuer's blind signature and verify the finished credential before
 * returning it. Returns null on any defect (a malicious signer cannot plant a bad
 * token in the secret store).
 */
export function finalizeBlindCredential(
  state: BlindCredentialRequestState,
  publicKeySpkiDerBase64: string,
  blindSignatureBase64: string,
): MeerkatCredential | null {
  const key = parseRsaPublicKeySpki(publicKeySpkiDerBase64);
  if (!key) return null;
  const blindSignatureBytes = credentialBase64ToBytes(blindSignatureBase64);
  const blindBytes = credentialBase64ToBytes(state.blindBase64);
  const messageBytes = credentialBase64ToBytes(state.messageBase64);
  if (!blindSignatureBytes || !blindBytes || !messageBytes) return null;
  if (blindSignatureBytes.length !== key.modulusBytes) return null;
  const blindSignature = bytesToBigInt(blindSignatureBytes);
  if (blindSignature >= key.n) return null;
  const rInverse = modInverse(bytesToBigInt(blindBytes), key.n);
  if (rInverse === null) return null;
  const signature = (blindSignature * rInverse) % key.n;
  const credential: MeerkatCredential = {
    version: 1,
    epoch: state.epoch,
    messageBase64: state.messageBase64,
    signatureBase64: credentialBytesToBase64(bigIntToBytes(signature, key.modulusBytes)),
  };
  const { notBeforeMs } = credentialEpochWindow(state.epoch);
  if (verifyBlindCredential(credential, publicKeySpkiDerBase64, notBeforeMs) !== 'ok') return null;
  return credential;
}

// ---------------------------------------------------------------------------
// Verification (pure; used by clients at finalize and by verifier surfaces)
// ---------------------------------------------------------------------------

/**
 * Verify a credential against the epoch public key. Fail-closed:
 *  - 'invalid' = malformed shape, wrong domain/epoch binding, or bad signature.
 *  - 'expired' = authentic but nowMs is outside the epoch window (+24h grace).
 *  - 'ok'      = authentic and current.
 * Signature validity is checked BEFORE expiry (a forged "fresh" claim cannot
 * masquerade as merely stale). Revocation is the caller's separate serial check.
 */
export function verifyBlindCredential(
  credential: MeerkatCredential,
  publicKeySpkiDerBase64: string,
  nowMs: number,
): BlindCredentialVerdict {
  if (!credential || typeof credential !== 'object') return 'invalid';
  if (
    credential.version !== 1
    || !Number.isInteger(credential.epoch)
    || typeof credential.messageBase64 !== 'string'
    || typeof credential.signatureBase64 !== 'string'
  ) {
    return 'invalid';
  }
  const key = parseRsaPublicKeySpki(publicKeySpkiDerBase64);
  if (!key) return 'invalid';
  const messageBytes = credentialBase64ToBytes(credential.messageBase64);
  const signatureBytes = credentialBase64ToBytes(credential.signatureBase64);
  if (!messageBytes || !signatureBytes || signatureBytes.length !== key.modulusBytes) return 'invalid';
  const parsed = parseTokenMessage(messageBytes);
  if (!parsed || parsed.epoch !== credential.epoch) return 'invalid';
  const signature = bytesToBigInt(signatureBytes);
  if (signature >= key.n) return 'invalid';
  const emBits = key.modulusBytes * 8 - 1;
  const em = bigIntToBytes(modPow(signature, key.e, key.n), key.modulusBytes);
  // emLen for emBits = 2047 is 256, matching the modulus length; verify over that view.
  if (!pssVerify(messageBytes, em, emBits)) return 'invalid';
  const { notBeforeMs, notAfterMs } = credentialEpochWindow(credential.epoch);
  if (nowMs < notBeforeMs || nowMs > notAfterMs) return 'expired';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Bearer serialization (base64url of the JSON), mirroring humanity-credential.
// ---------------------------------------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  return credentialBytesToBase64(bytes).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return credentialBase64ToBytes(`${padded}${'='.repeat(padLength)}`);
}

function isCredentialShape(value: unknown): value is MeerkatCredential {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    c.version === 1
    && typeof c.epoch === 'number'
    && typeof c.messageBase64 === 'string'
    && typeof c.signatureBase64 === 'string'
  );
}

/** Encode a credential as a compact base64url bearer string for an HTTP header. */
export function serializeMeerkatCredential(credential: MeerkatCredential): string {
  return toBase64Url(encoder.encode(JSON.stringify(credential)));
}

/**
 * Parse the compact bearer form or the raw JSON form. Shape-only; the caller still
 * runs verifyBlindCredential plus the revocation check. Null on any defect.
 */
export function parseMeerkatCredential(raw: string): MeerkatCredential | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    if (trimmed.startsWith('{')) {
      parsed = JSON.parse(trimmed);
    } else {
      const decoded = fromBase64Url(trimmed);
      if (!decoded) return null;
      parsed = JSON.parse(new TextDecoder().decode(decoded));
    }
  } catch {
    return null;
  }
  if (!isCredentialShape(parsed)) return null;
  const c = parsed;
  return {
    version: 1,
    epoch: c.epoch,
    messageBase64: c.messageBase64,
    signatureBase64: c.signatureBase64,
  };
}
