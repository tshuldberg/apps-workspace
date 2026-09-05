/**
 * Humanity credential protocol (Plan 24, Meerkat anti-bot verification -- P0).
 *
 * A HumanityToken is a small, SERVICE-signed, single-use, expiring bearer credential
 * that proves "a real human/device passed a verification challenge once" WITHOUT
 * carrying any identity. It is the anonymous rate-limiting primitive that gates
 * SHARED-network participation (public joins, open posting, first publish, hosted
 * signup). It is NOT bound to the Meerkat device identity key (NC-2): the client wallet
 * holds a batch of these and spends one per gated action, and the token reveals nothing
 * about who spent it.
 *
 * Trust model (mirrors publication.ts / dm-message.ts crypto discipline):
 *  - The token is signed by the VERIFICATION SERVICE's Ed25519 key, not by a device.
 *    Clients verify LOCALLY against the pinned service PUBLIC key, then hand the token
 *    to a gate which double-checks not-spent server-side.
 *  - Distinct signing domain 'meerkat-humanity-v1' leads the canonical bytes, so a
 *    humanity token can never cross-verify as a publication / DM / channel / call-signal
 *    event and vice versa (TC domain separation).
 *  - No new crypto: Ed25519 sign/verify via the existing tweetnacl wrappers (NC-3). The
 *    only addition is deriving the service keypair from a 32-byte seed (nacl fromSeed),
 *    so the deploy can hold ONE seed env (`HUMANITY_SIGNING_KEY`) rather than a 64-byte
 *    secret key.
 *
 * Privacy: a token carries only a random tokenId + issue/expiry timestamps. It has NO
 * device id, no attestation payload, no counter that links it to an issuance batch
 * beyond the coarse time window documented in the plan (the launch correlation limit;
 * the blind-RSA unlinkability upgrade is Plan 24 P6, gated on a vetted library).
 */

import nacl from 'tweetnacl';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { signMessage, verifySignature } from '../identity/device-identity';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Distinct signing domain; leads the canonical bytes (never collides with other domains). */
export const HUMANITY_TOKEN_DOMAIN = 'meerkat-humanity-v1';

/** Default single-use token lifetime: 90 days (re-verify silently to refill). */
export const HUMANITY_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Default wallet batch size minted per successful verification. */
export const HUMANITY_BATCH_SIZE = 32;

/** A service-signed, single-use, expiring humanity credential. */
export interface HumanityToken {
  version: 1;
  /** 32 random bytes as hex (64 chars). The spent-store key is sha256(tokenId). */
  tokenId: string;
  /** ISO issuance timestamp. */
  issuedAt: string;
  /** ISO expiry timestamp. */
  expiresAt: string;
  /** Ed25519 signature (hex) over the canonical form, by the SERVICE key. */
  signature: string;
}

export type UnsignedHumanityToken = Omit<HumanityToken, 'signature'>;

export type HumanityTokenVerdict = 'ok' | 'expired' | 'invalid';

/**
 * Canonical byte form. The FIRST element is the humanity domain string, distinct from
 * every other Meerkat protocol, so a token and a message can never cross-verify.
 */
export function canonicalHumanityTokenBytes(token: UnsignedHumanityToken): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      HUMANITY_TOKEN_DOMAIN,
      token.version,
      token.tokenId,
      token.issuedAt,
      token.expiresAt,
    ]),
  );
}

/**
 * Derive the service's Ed25519 keypair from a 32-byte seed (hex). The deploy holds the
 * seed as `HUMANITY_SIGNING_KEY`; the client pins the returned publicKeyHex. Uses
 * tweetnacl's fromSeed only (no new crypto). Throws on a non-32-byte seed so a
 * misconfigured deploy fails loudly rather than signing with a truncated key.
 */
export function humanityServiceKeypairFromSeed(seedHex: string): {
  publicKeyHex: string;
  privateKeyHex: string;
} {
  const seed = hexToBytes(seedHex);
  if (seed.length !== 32) {
    throw new Error('HUMANITY signing seed must be exactly 32 bytes (64 hex chars).');
  }
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKeyHex: bytesToHex(keypair.publicKey),
    privateKeyHex: bytesToHex(keypair.secretKey),
  };
}

/** Sign an unsigned token with the service's 64-byte Ed25519 secret key (hex). */
export function signHumanityToken(
  servicePrivateKeyHex: string,
  unsigned: UnsignedHumanityToken,
): HumanityToken {
  const signature = bytesToHex(signMessage(servicePrivateKeyHex, canonicalHumanityTokenBytes(unsigned)));
  return { ...unsigned, signature };
}

export interface IssueHumanityBatchOptions {
  /** The service's 64-byte Ed25519 secret key (hex). */
  servicePrivateKeyHex: string;
  /** Injected PRNG: 32 random bytes -> a tokenId. Deterministic under test. */
  randomBytes: (length: number) => Uint8Array;
  /** Tokens to mint. Defaults to HUMANITY_BATCH_SIZE. */
  count?: number;
  /** Token lifetime in ms. Defaults to HUMANITY_TOKEN_TTL_MS. */
  ttlMs?: number;
  /** Injected clock (ms). Defaults to Date.now(). */
  now?: number;
}

/**
 * Mint a wallet batch of single-use tokens. Each carries a fresh random 32-byte tokenId
 * and a shared issue/expiry window. The ids are the ONLY per-token entropy; nothing
 * links a token to the attestation or to the device (NC-2).
 */
export function issueHumanityTokenBatch(options: IssueHumanityBatchOptions): HumanityToken[] {
  const count = options.count ?? HUMANITY_BATCH_SIZE;
  const ttlMs = options.ttlMs ?? HUMANITY_TOKEN_TTL_MS;
  const nowMs = options.now ?? Date.now();
  const issuedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + ttlMs).toISOString();
  const tokens: HumanityToken[] = [];
  for (let i = 0; i < count; i += 1) {
    const tokenId = bytesToHex(options.randomBytes(32));
    tokens.push(
      signHumanityToken(options.servicePrivateKeyHex, { version: 1, tokenId, issuedAt, expiresAt }),
    );
  }
  return tokens;
}

const HEX_32_BYTES = /^[0-9a-f]{64}$/;

/**
 * Verify a token against the pinned service public key. Fail-closed:
 *  - 'invalid' = malformed shape, non-hex tokenId, or a signature that does not verify.
 *  - 'expired' = a valid signature but expiresAt <= now (still authentic, just stale).
 *  - 'ok'      = a valid, unexpired token.
 * Signature validity is checked BEFORE expiry, so a forged "not expired" claim cannot
 * masquerade as merely stale.
 */
export function verifyHumanityToken(
  token: HumanityToken,
  servicePublicKeyHex: string,
  nowMs: number = Date.now(),
): HumanityTokenVerdict {
  if (!token || typeof token !== 'object') return 'invalid';
  if (
    token.version !== 1
    || typeof token.tokenId !== 'string'
    || !HEX_32_BYTES.test(token.tokenId)
    || typeof token.issuedAt !== 'string'
    || typeof token.expiresAt !== 'string'
    || typeof token.signature !== 'string'
  ) {
    return 'invalid';
  }
  let ok = false;
  try {
    ok = verifySignature(
      servicePublicKeyHex,
      canonicalHumanityTokenBytes(token),
      hexToBytes(token.signature),
    );
  } catch {
    return 'invalid';
  }
  if (!ok) return 'invalid';
  const expiresAtMs = Date.parse(token.expiresAt);
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs) return 'expired';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Bearer serialization (base64url of the JSON), mirroring the entitlement token.
// ---------------------------------------------------------------------------

const BASE64_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
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

function base64ToBytes(encoded: string): Uint8Array | null {
  if (encoded.length === 0 || encoded.length % 4 === 1) return null;
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
  return new Uint8Array(out);
}

function toBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/u.test(value)) return null;
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return base64ToBytes(`${padded}${'='.repeat(padLength)}`);
}

function isHumanityTokenShape(value: unknown): value is HumanityToken {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    t.version === 1
    && typeof t.tokenId === 'string'
    && typeof t.issuedAt === 'string'
    && typeof t.expiresAt === 'string'
    && typeof t.signature === 'string'
  );
}

/** Encode a token as a compact base64url bearer string for an HTTP header. */
export function serializeHumanityToken(token: HumanityToken): string {
  return toBase64Url(encoder.encode(JSON.stringify(token)));
}

/**
 * Parse either the compact bearer form or the raw JSON form. Invalid shapes return null
 * instead of throwing (fail-closed). This validates SHAPE only; the caller still runs
 * verifyHumanityToken against the service key.
 */
export function parseHumanityToken(raw: string): HumanityToken | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    if (trimmed.startsWith('{')) {
      parsed = JSON.parse(trimmed);
    } else {
      const decoded = fromBase64Url(trimmed);
      if (!decoded) return null;
      parsed = JSON.parse(decoder.decode(decoded));
    }
  } catch {
    return null;
  }
  if (!isHumanityTokenShape(parsed)) return null;
  const t = parsed as HumanityToken;
  return { version: 1, tokenId: t.tokenId, issuedAt: t.issuedAt, expiresAt: t.expiresAt, signature: t.signature };
}
