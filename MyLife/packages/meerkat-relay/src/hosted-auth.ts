/**
 * Device-signed authorization for the hosted billing/usage API (Plan 22 Phase 2,
 * `authorize()`).
 *
 * Meerkat has NO account, so a "subject" is the device's own stable Ed25519
 * identity. A request proves it by presenting a bearer that the device SIGNED
 * with its private key; the service verifies the signature against the claimed
 * public key and never trusts a self-asserted subject id. This is the SAME
 * fail-closed discipline as the humanity service and the relay entitlement gate:
 * a missing, malformed, expired, or badly-signed bearer authorizes NOBODY.
 *
 * NO NEW CRYPTO: Ed25519 via tweetnacl, the exact primitive @mylife/sync wraps
 * everywhere else. The subject id IS the signer's public key (64 hex), so a
 * signature that verifies is, by construction, proof of that subject.
 *
 * Bearer wire form (all ASCII, dot-separated, url-safe):
 *   `<subjectPubKeyHex>.<expiresAtMs>.<signatureBase64Url>`
 * signed message = `meerkat-hosted-auth:<subjectPubKeyHex>:<expiresAtMs>`.
 */

import http from 'node:http';
import nacl from 'tweetnacl';
import {
  MEERKAT_HOSTED_AUTH_MAX_TTL_MS,
  hostedAuthMessage,
} from '@mylife/sync';
import type { MeerkatHostedSubject } from './hosted-api';

const PUBKEY_RE = /^[0-9a-f]{64}$/i;

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i] = byte;
  }
  return out;
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    return new Uint8Array(Buffer.from(padded, 'base64'));
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Mint a device-signed bearer (client/test helper). `secretKey` is the 64-byte
 * tweetnacl Ed25519 secret key; `subjectId` MUST be its 32-byte public key in hex.
 */
export function signHostedAuthBearer(
  subjectId: string,
  expiresAtMs: number,
  secretKey: Uint8Array,
): string {
  const signature = nacl.sign.detached(hostedAuthMessage(subjectId, expiresAtMs), secretKey);
  return `${subjectId}.${expiresAtMs}.${bytesToBase64Url(signature)}`;
}

/** Verify a bearer string, returning the subject only for a valid, unexpired signature. */
export function verifyHostedAuthBearer(bearer: string, nowMs: number): MeerkatHostedSubject | null {
  const parts = bearer.split('.');
  if (parts.length !== 3) return null;
  const [subjectId, expiryRaw, sigRaw] = parts;
  if (!PUBKEY_RE.test(subjectId)) return null;
  const expiresAtMs = Number(expiryRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null;
  // Cap the leak window: refuse a bearer that claims to be valid absurdly far out.
  if (expiresAtMs > nowMs + MEERKAT_HOSTED_AUTH_MAX_TTL_MS) return null;
  const publicKey = hexToBytes(subjectId);
  const signature = base64UrlToBytes(sigRaw);
  if (!publicKey || publicKey.length !== 32 || !signature || signature.length !== 64) return null;
  const ok = nacl.sign.detached.verify(hostedAuthMessage(subjectId, expiresAtMs), signature, publicKey);
  return ok ? { subjectId } : null;
}

function bearerFromRequest(req: http.IncomingMessage): string | null {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : null;
}

/**
 * The deployable `authorize()` for `MeerkatHostedApiOptions`: verify the
 * device-signed bearer and map it to its subject (its own public key). Fail
 * closed on anything missing or invalid.
 */
export function createDeviceSignedAuthorizer(
  now: () => number = () => Date.now(),
): (req: http.IncomingMessage) => MeerkatHostedSubject | null {
  return (req) => {
    const bearer = bearerFromRequest(req);
    if (!bearer) return null;
    return verifyHostedAuthBearer(bearer, now());
  };
}
