/**
 * Plan 51 P1: server-side Sign in with Apple + Sign in with Google ID-token verification.
 *
 * This is the ONLY place the account service learns which real store account is
 * signing in. It verifies an RS256 JWT (the provider ID token) against the provider's
 * published JWKS, then returns { provider, subject, email? }. The provider subject is
 * the account layer's stable identity; nothing here ever reaches a persona.
 *
 * FAIL-CLOSED (AC-6): an unconfigured provider returns { ok:false, reason:'not_configured' }
 * and NEVER fabricates a verified state. Every verification defect (bad signature, wrong
 * issuer/audience, expired, malformed) maps to a uniform refusal; the token and its claims
 * are never logged. JWKS is INJECTED (interface) so tests use a fake key source and the
 * live bin an HTTP one; no crypto is duplicated (node:crypto verifies the JWT).
 */

import { createPublicKey, createVerify, timingSafeEqual } from 'node:crypto';

export const APPLE_ISSUER = 'https://appleid.apple.com';
export const GOOGLE_ISSUER = 'https://accounts.google.com';

/** A single JWK (RSA public key) as published in a provider JWKS document. */
export interface Jwk {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

export interface Jwks {
  keys: Jwk[];
}

/** JWKS source seam. The live impl fetches over HTTPS; tests inject a fake. */
export interface JwksSource {
  /** Return the JWKS for a provider issuer, or throw on an unreachable source. */
  fetchJwks(issuer: string): Promise<Jwks>;
}

export interface SsoProviderConfig {
  /** Configured Apple service ids / bundle ids the token `aud` must match. */
  apple?: { serviceIds: string[] };
  /** Configured Google OAuth client ids the token `aud` must match. */
  google?: { clientIds: string[] };
}

export type SsoProvider = 'apple' | 'google';

export type SsoVerifyResult =
  | { ok: true; provider: SsoProvider; subject: string; email?: string }
  | { ok: false; reason: 'not_configured' | 'invalid' };

interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Buffer;
}

function base64UrlToBuffer(value: string): Buffer | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  try {
    return Buffer.from(padded + '='.repeat(padLength), 'base64');
  } catch {
    return null;
  }
}

function parseJwt(token: string): JwtParts | null {
  if (typeof token !== 'string') return null;
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = segments;
  const headerBytes = base64UrlToBuffer(headerB64);
  const payloadBytes = base64UrlToBuffer(payloadB64);
  const signature = base64UrlToBuffer(signatureB64);
  if (!headerBytes || !payloadBytes || !signature) return null;
  let header: unknown;
  let payload: unknown;
  try {
    header = JSON.parse(headerBytes.toString('utf8'));
    payload = JSON.parse(payloadBytes.toString('utf8'));
  } catch {
    return null;
  }
  if (typeof header !== 'object' || header === null) return null;
  if (typeof payload !== 'object' || payload === null) return null;
  return {
    header: header as Record<string, unknown>,
    payload: payload as Record<string, unknown>,
    signingInput: `${headerB64}.${payloadB64}`,
    signature,
  };
}

function selectJwk(jwks: Jwks, kid: unknown): Jwk | null {
  if (!jwks || !Array.isArray(jwks.keys)) return null;
  const rsaKeys = jwks.keys.filter((key) => key && key.kty === 'RSA' && typeof key.n === 'string' && typeof key.e === 'string');
  if (typeof kid === 'string') {
    const match = rsaKeys.find((key) => key.kid === kid);
    if (match) return match;
  }
  // No kid match: only usable if there is exactly one candidate (an ambiguous
  // set with no kid is a refusal, never a guess).
  return rsaKeys.length === 1 ? rsaKeys[0]! : null;
}

function verifyRs256(signingInput: string, signature: Buffer, jwk: Jwk): boolean {
  try {
    const key = createPublicKey({ key: jwk as Record<string, unknown>, format: 'jwk' });
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signingInput);
    verifier.end();
    return verifier.verify(key, signature);
  } catch {
    return false;
  }
}

/** Constant-time string equality (issuer/audience checks; length-independent). */
function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function audienceMatches(aud: unknown, allowed: readonly string[]): boolean {
  const values = Array.isArray(aud) ? aud : [aud];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    if (allowed.some((candidate) => constantTimeEquals(value, candidate))) return true;
  }
  return false;
}

export interface SsoTokenVerifierOptions {
  config: SsoProviderConfig;
  jwksSource: JwksSource;
  /** Injected clock for tests (ms). */
  now?: () => number;
  /** Allowed clock skew for exp/iat, ms. Default 5 minutes. */
  maxSkewMs?: number;
}

export interface SsoTokenVerifier {
  verify(provider: SsoProvider, idToken: string): Promise<SsoVerifyResult>;
}

/**
 * Build the SSO verifier. Unconfigured provider -> not_configured; every other
 * failure -> invalid (uniform, non-informative). Never fabricates verification.
 */
export function createSsoTokenVerifier(options: SsoTokenVerifierOptions): SsoTokenVerifier {
  const now = options.now ?? (() => Date.now());
  const maxSkewMs = options.maxSkewMs ?? 5 * 60 * 1000;

  return {
    async verify(provider, idToken) {
      const issuer = provider === 'apple' ? APPLE_ISSUER : GOOGLE_ISSUER;
      const allowedAudiences = provider === 'apple'
        ? options.config.apple?.serviceIds
        : options.config.google?.clientIds;
      if (!allowedAudiences || allowedAudiences.length === 0) {
        return { ok: false, reason: 'not_configured' };
      }

      const parts = parseJwt(idToken);
      if (!parts) return { ok: false, reason: 'invalid' };
      if (parts.header.alg !== 'RS256') return { ok: false, reason: 'invalid' };

      let jwks: Jwks;
      try {
        jwks = await options.jwksSource.fetchJwks(issuer);
      } catch {
        // A dead JWKS source is a refusal, never an admit. Distinct from
        // not_configured: the provider IS configured, the key source is down.
        return { ok: false, reason: 'invalid' };
      }
      const jwk = selectJwk(jwks, parts.header.kid);
      if (!jwk) return { ok: false, reason: 'invalid' };
      if (!verifyRs256(parts.signingInput, parts.signature, jwk)) {
        return { ok: false, reason: 'invalid' };
      }

      const { payload } = parts;
      if (typeof payload.iss !== 'string' || !constantTimeEquals(payload.iss, issuer)) {
        return { ok: false, reason: 'invalid' };
      }
      if (!audienceMatches(payload.aud, allowedAudiences)) {
        return { ok: false, reason: 'invalid' };
      }
      const nowSeconds = now() / 1000;
      const skewSeconds = maxSkewMs / 1000;
      if (typeof payload.exp !== 'number' || payload.exp + skewSeconds < nowSeconds) {
        return { ok: false, reason: 'invalid' };
      }
      if (typeof payload.iat === 'number' && payload.iat - skewSeconds > nowSeconds) {
        return { ok: false, reason: 'invalid' };
      }
      if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 512) {
        return { ok: false, reason: 'invalid' };
      }

      const email = typeof payload.email === 'string' && payload.email.length >= 3 && payload.email.length <= 512
        ? payload.email
        : undefined;
      return { ok: true, provider, subject: payload.sub, ...(email ? { email } : {}) };
    },
  };
}

// ---------------------------------------------------------------------------
// Live JWKS source (HTTPS fetch). The bin wires this; tests inject a fake.
// ---------------------------------------------------------------------------

const PROVIDER_JWKS_URL: Record<string, string> = {
  [APPLE_ISSUER]: 'https://appleid.apple.com/auth/keys',
  [GOOGLE_ISSUER]: 'https://www.googleapis.com/oauth2/v3/certs',
};

export interface HttpJwksSourceOptions {
  /** Cache TTL for a fetched JWKS document, ms. Default 1 hour. */
  cacheTtlMs?: number;
  now?: () => number;
  /** Injected fetch (defaults to global fetch); lets tests avoid the network. */
  fetchImpl?: typeof fetch;
}

/**
 * The HTTPS JWKS source used by the live bin: fetches the provider's published
 * keys, caches them briefly, and only serves the two known provider issuers (an
 * unknown issuer throws so a misconfiguration never silently reads a wrong URL).
 */
export function createHttpJwksSource(options: HttpJwksSourceOptions = {}): JwksSource {
  const cacheTtlMs = options.cacheTtlMs ?? 60 * 60 * 1000;
  const now = options.now ?? (() => Date.now());
  const doFetch = options.fetchImpl ?? fetch;
  const cache = new Map<string, { jwks: Jwks; fetchedAtMs: number }>();

  return {
    async fetchJwks(issuer: string): Promise<Jwks> {
      const url = PROVIDER_JWKS_URL[issuer];
      if (!url) throw new Error('Unknown SSO issuer');
      const cached = cache.get(issuer);
      if (cached && now() - cached.fetchedAtMs < cacheTtlMs) return cached.jwks;
      const response = await doFetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);
      const body = (await response.json()) as unknown;
      if (!body || typeof body !== 'object' || !Array.isArray((body as Jwks).keys)) {
        throw new Error('JWKS document is malformed');
      }
      const jwks = body as Jwks;
      cache.set(issuer, { jwks, fetchedAtMs: now() });
      return jwks;
    },
  };
}
