/**
 * Public-tier persona SESSION tokens + persona-signed request proofs (Plan 39, P2).
 *
 * A session token is a short-lived, HMAC-signed bearer the accounts service issues to a
 * verified public persona. It authorizes the first-party public READ and WRITE routes
 * (verify-to-view, P9; submit, P6). It is deliberately NOT the persona key and NOT the
 * device key: it carries only the persona pubkey + an issue/expiry window, MAC'd with the
 * service secret, so a public route can authenticate the caller without the persona ever
 * re-signing per request and without any device identity crossing the wire (NC-P2).
 *
 * `verifyPersonaSessionToken` (and the `createPersonaSessionVerifier` factory over it) is the
 * exact SEAM Track B's submit route consumes: a pure-ish function with an injected clock,
 * secret, and optional revocation check. It fail-closes on every parse/expiry/signature/
 * revocation problem, mirroring `verifyHostedAuthBearer` / the humanity gate discipline.
 *
 * Two other persona-signed proofs live here (Ed25519 via @mylife/sync's wrapper, NC-3):
 *  - the session-issuance CHALLENGE proof (proof the caller holds the persona private key
 *    before a session is minted), and
 *  - a generic persona-signed REQUEST proof (GDPR delete/export are authorized by the
 *    persona key, with a freshness window so a captured request cannot be replayed later).
 *
 * NO NEW CRYPTO: HMAC-SHA256 (node:crypto) for the bearer MAC, Ed25519 (tweetnacl via
 * @mylife/sync) for the persona-key proofs. The bearer's constant-time compare uses
 * timingSafeEqual.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  personaRequestBytes,
  personaSessionChallengeBytes,
  verifySignature,
  PERSONA_GDPR_DELETE_DOMAIN,
  PERSONA_GDPR_EXPORT_DOMAIN,
  PERSONA_SESSION_CHALLENGE_DOMAIN,
} from '@mylife/sync';

// The persona-key proof BYTES + their domains are defined ONCE in @mylife/sync (so the RN/web
// client and this server node build byte-identical messages). Re-export them here for the
// relay barrel + callers that consume them alongside the server-only session bearer.
export {
  personaRequestBytes,
  personaSessionChallengeBytes,
  PERSONA_GDPR_DELETE_DOMAIN,
  PERSONA_GDPR_EXPORT_DOMAIN,
  PERSONA_SESSION_CHALLENGE_DOMAIN,
};

/** The server-only HMAC session-bearer domain (leads the MAC'd bytes). */
export const PERSONA_SESSION_DOMAIN = 'meerkat-persona-session-v1';

/** Default session lifetime (1h); short so a leaked bearer expires fast. */
export const DEFAULT_PERSONA_SESSION_TTL_MS = 60 * 60 * 1000;
/** Hard cap on a session lifetime the verifier will accept (leak-window bound). */
export const MAX_PERSONA_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** Freshness window for a persona-signed GDPR request (anti-replay). */
export const PERSONA_REQUEST_MAX_SKEW_MS = 5 * 60 * 1000;

const PUBKEY_RE = /^[0-9a-f]{64}$/i;
const HEX_SIG_RE = /^[0-9a-f]{128}$/i;

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

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    return new Uint8Array(Buffer.from(padded, 'base64'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session bearer (HMAC-signed).
// ---------------------------------------------------------------------------

export interface PersonaSessionClaims {
  personaPubkey: string;
  issuedAtMs: number;
  expiresAtMs: number;
}

function sessionMacBytes(claims: PersonaSessionClaims): string {
  return `${PERSONA_SESSION_DOMAIN}:${claims.personaPubkey}:${claims.issuedAtMs}:${claims.expiresAtMs}`;
}

/**
 * Mint a session bearer for a persona. Wire form (all ASCII, dot-separated, url-safe):
 *   `<personaPubkeyHex>.<issuedAtMs>.<expiresAtMs>.<hmacBase64Url>`
 */
export function signPersonaSessionToken(secret: string, claims: PersonaSessionClaims): string {
  const mac = createHmac('sha256', secret).update(sessionMacBytes(claims)).digest();
  return `${claims.personaPubkey}.${claims.issuedAtMs}.${claims.expiresAtMs}.${bytesToBase64Url(mac)}`;
}

export type PersonaSessionReason =
  | 'not_configured'
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'revoked';

export type PersonaSessionVerdict =
  | { ok: true; personaPubkey: string; issuedAtMs: number; expiresAtMs: number }
  | { ok: false; reason: PersonaSessionReason };

/**
 * Verify a session bearer against the service secret. Fail-closed:
 *  - no secret -> not_configured (the caller cannot check a MAC; refuse, never wave through).
 *  - wrong shape / bad pubkey / non-integer times / absurd TTL -> malformed.
 *  - MAC mismatch (constant-time) -> bad_signature.
 *  - expiresAtMs <= now -> expired.
 * The MAC is checked BEFORE expiry so a forged "not expired" claim cannot pass as merely
 * stale. The TTL is capped so a token minted with an absurd far-future expiry is rejected
 * even if its MAC is valid (a compromised issuer cannot mint an eternal bearer within cap).
 */
export function verifyPersonaSessionToken(
  token: string,
  secret: string,
  nowMs: number,
): PersonaSessionVerdict {
  if (!secret) return { ok: false, reason: 'not_configured' };
  if (typeof token !== 'string') return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [personaPubkey, issuedRaw, expiryRaw, macRaw] = parts;
  if (!PUBKEY_RE.test(personaPubkey)) return { ok: false, reason: 'malformed' };
  const issuedAtMs = Number(issuedRaw);
  const expiresAtMs = Number(expiryRaw);
  if (!Number.isInteger(issuedAtMs) || !Number.isInteger(expiresAtMs)) {
    return { ok: false, reason: 'malformed' };
  }
  if (expiresAtMs <= issuedAtMs) return { ok: false, reason: 'malformed' };
  if (expiresAtMs - issuedAtMs > MAX_PERSONA_SESSION_TTL_MS) return { ok: false, reason: 'malformed' };

  const provided = base64UrlToBytes(macRaw);
  if (!provided) return { ok: false, reason: 'malformed' };
  const expected = createHmac('sha256', secret)
    .update(sessionMacBytes({ personaPubkey, issuedAtMs, expiresAtMs }))
    .digest();
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (expiresAtMs <= nowMs) return { ok: false, reason: 'expired' };
  return { ok: true, personaPubkey, issuedAtMs, expiresAtMs };
}

export interface PersonaSessionVerifierOptions {
  /** The HMAC session secret. Empty -> every verify returns not_configured (fail-closed). */
  secret: string;
  /** Injected clock (ms). */
  now?: () => number;
  /**
   * Revocation seam: returns true when the persona's sessions have been revoked (GDPR
   * delete / operator suspend). A thrown/rejected check fails CLOSED (treated as revoked).
   */
  isRevoked?: (personaPubkey: string) => boolean | Promise<boolean>;
}

/**
 * Build the async session verifier Track B's submit route (and the read routes) consume.
 * Layers HMAC verification with the revocation seam; fail-closed everywhere.
 */
export function createPersonaSessionVerifier(
  options: PersonaSessionVerifierOptions,
): (token: string) => Promise<PersonaSessionVerdict> {
  const now = options.now ?? (() => Date.now());
  return async (token: string): Promise<PersonaSessionVerdict> => {
    const verdict = verifyPersonaSessionToken(token, options.secret, now());
    if (!verdict.ok) return verdict;
    if (options.isRevoked) {
      let revoked: boolean;
      try {
        revoked = await options.isRevoked(verdict.personaPubkey);
      } catch {
        return { ok: false, reason: 'revoked' }; // fail closed on a revocation-store error
      }
      if (revoked) return { ok: false, reason: 'revoked' };
    }
    return verdict;
  };
}

// ---------------------------------------------------------------------------
// Persona-key proof VERIFIERS (Ed25519). The signable BYTES + domains come from
// @mylife/sync (shared with the client, re-exported above); these server-side
// wrappers verify them fail-closed.
// ---------------------------------------------------------------------------

/** Verify the persona-key possession proof for a session-issuance challenge. Fail-closed. */
export function verifyPersonaSessionChallengeSignature(
  nonce: string,
  personaPubkey: string,
  signatureHex: string,
): boolean {
  if (!PUBKEY_RE.test(personaPubkey) || !HEX_SIG_RE.test(signatureHex)) return false;
  const sig = hexToBytes(signatureHex);
  if (!sig) return false;
  try {
    return verifySignature(personaPubkey, personaSessionChallengeBytes(nonce, personaPubkey), sig);
  } catch {
    return false;
  }
}

/**
 * Verify a persona-signed request (GDPR delete/export). Fail-closed on a bad shape, a stale
 * or future-dated timestamp (freshness window, anti-replay), or a signature that does not
 * verify under the persona key.
 */
export function verifyPersonaRequestSignature(input: {
  domain: string;
  personaPubkey: string;
  issuedAtMs: number;
  signatureHex: string;
  nowMs: number;
  maxSkewMs?: number;
}): boolean {
  const { domain, personaPubkey, issuedAtMs, signatureHex, nowMs } = input;
  const maxSkewMs = input.maxSkewMs ?? PERSONA_REQUEST_MAX_SKEW_MS;
  if (!PUBKEY_RE.test(personaPubkey) || !HEX_SIG_RE.test(signatureHex)) return false;
  if (!Number.isFinite(issuedAtMs)) return false;
  if (issuedAtMs > nowMs + maxSkewMs || issuedAtMs < nowMs - maxSkewMs) return false;
  const sig = hexToBytes(signatureHex);
  if (!sig) return false;
  try {
    return verifySignature(personaPubkey, personaRequestBytes(domain, personaPubkey, issuedAtMs), sig);
  } catch {
    return false;
  }
}
