import naclUtil from 'tweetnacl-util';
import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';

const { decodeBase64, encodeBase64 } = naclUtil;

export const MEERKAT_HOSTED_AUTH_DOMAIN = 'meerkat-hosted-auth';
export const MEERKAT_HOSTED_AUTH_MAX_TTL_MS = 24 * 60 * 60 * 1000;
export const MEERKAT_REVENUECAT_APP_USER_ID_DOMAIN = 'meerkat-revenuecat-app-user-id:v1';

function base64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  try {
    const bytes = decodeBase64(padded);
    // Reject alternate textual encodings that differ only in unused padding
    // bits. RevenueCat treats the app user id as an exact string, so accepting
    // a non-canonical spelling here would weaken the string-to-key binding.
    return base64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

export function hostedAuthMessage(subjectId: string, expiresAtMs: number): Uint8Array {
  return new TextEncoder().encode(`${MEERKAT_HOSTED_AUTH_DOMAIN}:${subjectId}:${expiresAtMs}`);
}

export function revenueCatAppUserIdMessage(subjectId: string): Uint8Array {
  return new TextEncoder().encode(`${MEERKAT_REVENUECAT_APP_USER_ID_DOMAIN}:${subjectId}`);
}

/**
 * RevenueCat's public SDK can read CustomerInfo for any known app user id, so
 * the id must not be the public device key. A deterministic Ed25519 signature is
 * stable for restores, unguessable without the private key, and verifiable by
 * the hosted service before it trusts the provider record.
 */
export function createRevenueCatAppUserId(identity: DeviceIdentity): string {
  return base64Url(signMessage(
    extractSigningPrivateKeyHex(identity.privateKeyRef),
    revenueCatAppUserIdMessage(identity.publicKey),
  ));
}

export function verifyRevenueCatAppUserId(subjectId: string, appUserId: string): boolean {
  const signature = base64UrlBytes(appUserId);
  return signature?.length === 64
    && verifySignature(subjectId, revenueCatAppUserIdMessage(subjectId), signature);
}

/**
 * Mint the short-lived bearer accepted by the hosted billing service. The device
 * identity is the subject and signs the exact expiry, so no account token or
 * hosted entitlement can be substituted for proof of device-key possession.
 */
export function createHostedAuthBearer(
  identity: DeviceIdentity,
  nowMs: number = Date.now(),
  ttlMs: number = 5 * 60 * 1000,
): string {
  if (!Number.isFinite(nowMs)) throw new Error('Hosted auth nowMs must be finite.');
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MEERKAT_HOSTED_AUTH_MAX_TTL_MS) {
    throw new Error('Hosted auth ttlMs is outside the allowed range.');
  }
  const expiresAtMs = Math.floor(nowMs + ttlMs);
  const signature = signMessage(
    extractSigningPrivateKeyHex(identity.privateKeyRef),
    hostedAuthMessage(identity.publicKey, expiresAtMs),
  );
  return `${identity.publicKey}.${expiresAtMs}.${base64Url(signature)}`;
}
