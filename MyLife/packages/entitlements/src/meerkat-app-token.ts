/**
 * Server-verifiable proof of the Meerkat $4.99 one-time app unlock (Plan 39 P6).
 *
 * The public submit route (community node) must verify the `meerkat_app_unlock`
 * entitlement SERVER-SIDE (NC-P3), but the unlock lives as a purchase row on the
 * hosted API, not on every community node. This token is the bridge: the hosted
 * API mints a SHORT-LIVED, HMAC-signed unlock proof ONLY from a real, active
 * purchase row (never self-certified), and the community node verifies it against
 * the shared signing secret, fail-closed.
 *
 * NC-P5 (founder pricing lock): this proves the EXISTING `meerkat_app_unlock`
 * $4.99 one-time SKU. It is not a new product, price, or subscription.
 *
 * Deliberately NOT an `Entitlements` payload: those assert `mode: 'hosted'` +
 * `hostedActive`, which would misrepresent a one-time unlock as a hosted
 * subscription. Same HMAC-SHA256 + base64url discipline as verify.ts; a distinct
 * leading domain string keeps the two token families from cross-verifying.
 */

import { MEERKAT_APP_UNLOCK_PRODUCT_ID } from './meerkat-app';

const APP_UNLOCK_TOKEN_DOMAIN = 'meerkat-app-unlock-token-v1';

/** The feature string carried by (and required of) every app-unlock proof. */
export const MEERKAT_APP_UNLOCK_FEATURE = 'meerkat:app-unlock';

/** Freshness window for a persona proof-of-possession at mint time. */
export const APP_UNLOCK_BINDING_WINDOW_MS = 5 * 60 * 1000;

/**
 * The canonical message a persona SIGNS to prove possession when requesting an
 * app-unlock proof bound to it (Plan 39 P6): without this, any purchaser could
 * mint proofs bound to arbitrary public persona keys and hand out unlocks. Pure
 * string builder; the client signs it with the existing Ed25519 wrappers and the
 * hosted API verifies it against `personaPubkey` before binding.
 */
export function appUnlockBindingMessage(personaPubkeyHex: string, ts: string): string {
  return JSON.stringify(['meerkat-app-unlock-binding-v1', personaPubkeyHex.toLowerCase(), ts]);
}

/** Default proof lifetime: short-lived; clients re-mint from the real purchase row. */
export const APP_UNLOCK_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface MeerkatAppUnlockToken {
  version: 1;
  feature: typeof MEERKAT_APP_UNLOCK_FEATURE;
  productId: typeof MEERKAT_APP_UNLOCK_PRODUCT_ID;
  /** ISO date of the underlying real purchase row. */
  purchaseDate: string;
  /**
   * Persona binding: sha256 hex of the holder's PUBLIC PERSONA key, computed
   * CLIENT-SIDE (the billing tier never receives the raw persona key). The
   * public submit gate requires it and rejects a proof whose binding does not
   * hash-match the session persona, so a purchased proof is NOT transferable to
   * another persona. null = an unbound proof, which the submit gate rejects.
   */
  binding: string | null;
  issuedAt: string;
  expiresAt: string;
  /** HMAC-SHA256 (base64url) over the canonical form, keyed by the shared secret. */
  signature: string;
}

export type UnsignedMeerkatAppUnlockToken = Omit<MeerkatAppUnlockToken, 'signature'>;

export type AppUnlockTokenFailureReason =
  | 'missing'
  | 'malformed'
  | 'wrong_feature'
  | 'wrong_product'
  | 'expired'
  | 'unbound'
  | 'wrong_binding'
  | 'invalid_signature';

export type AppUnlockTokenCheck =
  | { ok: true; token: MeerkatAppUnlockToken }
  | { ok: false; reason: AppUnlockTokenFailureReason };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function normalizeForSigning(payload: UnsignedMeerkatAppUnlockToken): string {
  return JSON.stringify([
    APP_UNLOCK_TOKEN_DOMAIN,
    payload.version,
    payload.feature,
    payload.productId,
    payload.purchaseDate,
    payload.binding,
    payload.issuedAt,
    payload.expiresAt,
  ]);
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error('WebCrypto API is unavailable in this runtime.');
  }
  const key = await cryptoApi.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await cryptoApi.subtle.sign('HMAC', key, textEncoder.encode(message));
  return toBase64Url(new Uint8Array(signatureBuffer));
}

export interface IssueMeerkatAppUnlockTokenInput {
  /** Shared HMAC secret between the hosted API (mint) and the community node (verify). */
  secret: string;
  /** ISO date of the REAL purchase row backing this proof. */
  purchaseDate: string;
  /**
   * Persona binding: sha256 hex (64 chars) of the holder's public persona key,
   * computed client-side. Omit only for proofs that will never hit a
   * binding-required gate; the public submit gate rejects unbound proofs.
   */
  bindingHash?: string | null;
  nowMs?: number;
  ttlMs?: number;
}

/**
 * Mint an app-unlock proof. CALLER CONTRACT (fail-closed by construction at the
 * one mint site): only mint after deriveMeerkatAppUnlock over the REAL purchase
 * rows reports unlocked. This function is pure and never checks a store.
 */
export async function issueMeerkatAppUnlockToken(
  input: IssueMeerkatAppUnlockTokenInput,
): Promise<{ token: string; payload: MeerkatAppUnlockToken }> {
  const nowMs = input.nowMs ?? Date.now();
  const unsigned: UnsignedMeerkatAppUnlockToken = {
    version: 1,
    feature: MEERKAT_APP_UNLOCK_FEATURE,
    productId: MEERKAT_APP_UNLOCK_PRODUCT_ID,
    purchaseDate: input.purchaseDate,
    binding: input.bindingHash?.toLowerCase() ?? null,
    issuedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + (input.ttlMs ?? APP_UNLOCK_TOKEN_TTL_MS)).toISOString(),
  };
  const payload: MeerkatAppUnlockToken = {
    ...unsigned,
    signature: await hmacSign(normalizeForSigning(unsigned), input.secret),
  };
  return { token: toBase64Url(textEncoder.encode(JSON.stringify(payload))), payload };
}

function isTokenShape(value: unknown): value is MeerkatAppUnlockToken {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    t.version === 1
    && typeof t.feature === 'string'
    && typeof t.productId === 'string'
    && typeof t.purchaseDate === 'string'
    && (t.binding === null || t.binding === undefined || typeof t.binding === 'string')
    && typeof t.issuedAt === 'string'
    && typeof t.expiresAt === 'string'
    && typeof t.signature === 'string'
  );
}

/** Parse the compact bearer form or raw JSON. Shape only; verify separately. */
export function parseMeerkatAppUnlockToken(raw: string): MeerkatAppUnlockToken | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    if (trimmed.startsWith('{')) {
      parsed = JSON.parse(trimmed);
    } else {
      const decoded = fromBase64Url(trimmed);
      if (!decoded) return null;
      parsed = JSON.parse(textDecoder.decode(decoded));
    }
  } catch {
    return null;
  }
  if (!isTokenShape(parsed)) return null;
  const t = parsed;
  return {
    version: 1,
    feature: t.feature as typeof MEERKAT_APP_UNLOCK_FEATURE,
    productId: t.productId as typeof MEERKAT_APP_UNLOCK_PRODUCT_ID,
    purchaseDate: t.purchaseDate,
    binding: t.binding ?? null,
    issuedAt: t.issuedAt,
    expiresAt: t.expiresAt,
    signature: t.signature,
  };
}

/**
 * Verify an app-unlock proof FAIL-CLOSED: shape, the exact feature + the exact
 * founder-locked product id, expiry, the HMAC signature, and (when the caller
 * demands it) the PERSONA BINDING. A hosted-subscription entitlement token, a
 * token for any other product, a proof minted for a DIFFERENT persona, or any
 * tamper is rejected. The public submit gate passes `requireBinding` +
 * `expectedBindingHash` so a purchased proof is not transferable.
 */
export async function verifyMeerkatAppUnlockToken(
  token: string | null | undefined,
  secret: string,
  options?: { nowMs?: number; requireBinding?: boolean; expectedBindingHash?: string },
): Promise<AppUnlockTokenCheck> {
  if (!token?.trim()) return { ok: false, reason: 'missing' };
  const parsed = parseMeerkatAppUnlockToken(token);
  if (!parsed) return { ok: false, reason: 'malformed' };
  if (parsed.feature !== MEERKAT_APP_UNLOCK_FEATURE) return { ok: false, reason: 'wrong_feature' };
  if (parsed.productId !== MEERKAT_APP_UNLOCK_PRODUCT_ID) return { ok: false, reason: 'wrong_product' };
  const nowMs = options?.nowMs ?? Date.now();
  const expiresAtMs = Date.parse(parsed.expiresAt);
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs) return { ok: false, reason: 'expired' };
  const { signature, ...unsigned } = parsed;
  const expected = await hmacSign(normalizeForSigning(unsigned), secret);
  if (signature !== expected) return { ok: false, reason: 'invalid_signature' };
  if (options?.requireBinding || options?.expectedBindingHash !== undefined) {
    if (parsed.binding === null) return { ok: false, reason: 'unbound' };
    if (
      typeof options.expectedBindingHash !== 'string'
      || parsed.binding.toLowerCase() !== options.expectedBindingHash.toLowerCase()
    ) {
      return { ok: false, reason: 'wrong_binding' };
    }
  }
  return { ok: true, token: parsed };
}
