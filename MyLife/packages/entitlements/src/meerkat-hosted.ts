import { EntitlementsSchema } from './schema';
import type { Entitlements, UnsignedEntitlements } from './hosted-types';
import {
  createEntitlementSignature,
  verifyEntitlementSignature,
  type VerifyEntitlementOptions,
} from './verify';

export const MEERKAT_APP_ID = 'meerkat';
export const MEERKAT_HOSTED_RELAY_FEATURE = 'meerkat:hosted-relay';
export const MEERKAT_COMMUNITY_NODE_FEATURE = 'meerkat:community-node';
/** Plan 22 S0.6: gates the durable hosted-storage ingest path (POST /api/storage/upload). */
export const MEERKAT_HOSTED_STORAGE_FEATURE = 'meerkat:hosted-storage';

export const MEERKAT_HOSTED_FEATURES = [
  MEERKAT_HOSTED_RELAY_FEATURE,
  MEERKAT_COMMUNITY_NODE_FEATURE,
  MEERKAT_HOSTED_STORAGE_FEATURE,
] as const;

export type MeerkatHostedFeature = (typeof MEERKAT_HOSTED_FEATURES)[number];

export type HostedEntitlementFailureReason =
  | 'missing'
  | 'malformed'
  | 'wrong_app'
  | 'inactive'
  | 'missing_feature'
  | 'expired'
  | 'revoked'
  | 'invalid_signature';

export type HostedEntitlementCheck =
  | { ok: true; entitlements: Entitlements }
  | { ok: false; reason: HostedEntitlementFailureReason };

export interface VerifyHostedFeatureEntitlementOptions extends VerifyEntitlementOptions {
  /** Defaults to the Meerkat app id. */
  appId?: string;
}

export interface IssueMeerkatHostedEntitlementInput {
  secret: string;
  /** Authenticated billing subject. Required by subject-bound managed storage consumers. */
  subjectId?: string;
  /** Defaults to both hosted relay and hosted community node access. */
  features?: readonly string[];
  issuedAt?: string;
  expiresAt?: string;
}

const BASE64_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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
  return bytesToBase64(bytes)
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_')
    .replace(/=+$/gu, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/u.test(value)) return null;
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return base64ToBytes(`${padded}${'='.repeat(padLength)}`);
}

function dedupeFeatures(features: readonly string[]): string[] {
  return [...new Set(features)].sort();
}

function isExpired(entitlements: Entitlements, nowMs: number): boolean {
  if (!entitlements.expiresAt) return false;
  const expiresAtMs = Date.parse(entitlements.expiresAt);
  return !Number.isNaN(expiresAtMs) && expiresAtMs <= nowMs;
}

function isSignatureRevoked(
  entitlements: Entitlements,
  options?: VerifyHostedFeatureEntitlementOptions,
): boolean {
  if (!options?.revokedSignatures) return false;
  for (const signature of options.revokedSignatures) {
    if (signature === entitlements.signature) return true;
  }
  return false;
}

/** Encodes a signed entitlement payload for use as an HTTP bearer token. */
export function serializeEntitlementToken(entitlements: Entitlements): string {
  return toBase64Url(textEncoder.encode(JSON.stringify(entitlements)));
}

/**
 * Parses either the compact bearer-token form or the older raw JSON token form.
 * Invalid shapes return null instead of throwing.
 */
export function parseEntitlementToken(token: string): Entitlements | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    if (trimmed.startsWith('{')) {
      parsed = JSON.parse(trimmed) as unknown;
    } else {
      const decoded = fromBase64Url(trimmed);
      if (!decoded) return null;
      parsed = JSON.parse(textDecoder.decode(decoded)) as unknown;
    }
  } catch {
    return null;
  }

  const result = EntitlementsSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/** Issue a short-lived hosted entitlement for the $4.99/month Meerkat plan. */
export async function issueMeerkatHostedEntitlement(
  input: IssueMeerkatHostedEntitlementInput,
): Promise<{ token: string; entitlements: Entitlements }> {
  const unsignedPayload: UnsignedEntitlements = {
    appId: MEERKAT_APP_ID,
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    mode: 'hosted',
    hostedActive: true,
    selfHostLicense: false,
    features: dedupeFeatures(input.features ?? MEERKAT_HOSTED_FEATURES),
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    expiresAt: input.expiresAt,
  };
  const entitlements: Entitlements = {
    ...unsignedPayload,
    signature: await createEntitlementSignature(unsignedPayload, input.secret),
  };
  return {
    token: serializeEntitlementToken(entitlements),
    entitlements,
  };
}

/**
 * Verify that a caller holds an active, signed hosted entitlement with the
 * requested feature. This checks entitlement shape, app id, hosted status,
 * expiry, revocation hooks, and HMAC signature.
 */
export async function verifyHostedFeatureEntitlement(
  token: string | null | undefined,
  secret: string,
  feature: string,
  options?: VerifyHostedFeatureEntitlementOptions,
): Promise<HostedEntitlementCheck> {
  if (!token?.trim()) return { ok: false, reason: 'missing' };
  const entitlements = parseEntitlementToken(token);
  if (!entitlements) return { ok: false, reason: 'malformed' };

  const appId = options?.appId ?? MEERKAT_APP_ID;
  if (entitlements.appId !== appId) return { ok: false, reason: 'wrong_app' };
  if (entitlements.mode !== 'hosted' || entitlements.hostedActive !== true) {
    return { ok: false, reason: 'inactive' };
  }
  if (!entitlements.features.includes(feature)) {
    return { ok: false, reason: 'missing_feature' };
  }

  const nowMs = options?.nowMs ?? Date.now();
  if (isExpired(entitlements, nowMs)) return { ok: false, reason: 'expired' };
  if (isSignatureRevoked(entitlements, options)) return { ok: false, reason: 'revoked' };
  if (options?.isRevoked && await options.isRevoked(entitlements.signature)) {
    return { ok: false, reason: 'revoked' };
  }

  const verified = await verifyEntitlementSignature(entitlements, secret, {
    nowMs,
    revokedSignatures: options?.revokedSignatures,
    isRevoked: options?.isRevoked,
  });
  if (!verified) return { ok: false, reason: 'invalid_signature' };
  return { ok: true, entitlements };
}
