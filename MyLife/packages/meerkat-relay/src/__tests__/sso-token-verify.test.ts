/**
 * Plan 51 P1: SSO ID-token verification tests (AC-6 anchor).
 *
 * A fake JWKS source holds a real RSA public key; the test signs real RS256 JWTs
 * and asserts the verifier admits a well-formed Apple/Google token and refuses
 * every defect (wrong aud, wrong iss, expired, bad signature) plus the
 * not_configured fail-closed path for an unconfigured provider.
 */

import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  APPLE_ISSUER,
  GOOGLE_ISSUER,
  createSsoTokenVerifier,
  type Jwk,
  type Jwks,
  type JwksSource,
} from '../sso-token-verify';

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeKeyPair(kid: string): { publicJwk: Jwk; privateKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
  return { publicJwk: { ...jwk, kid, kty: 'RSA', alg: 'RS256', use: 'sig' } as Jwk, privateKey };
}

function signJwt(privateKey: KeyObject, kid: string, payload: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(privateKey);
  return `${signingInput}.${base64Url(signature)}`;
}

function fakeJwksSource(jwksByIssuer: Record<string, Jwks>): JwksSource {
  return {
    async fetchJwks(issuer) {
      const jwks = jwksByIssuer[issuer];
      if (!jwks) throw new Error('no jwks');
      return jwks;
    },
  };
}

const NOW = Date.UTC(2026, 8, 1);
const nowSeconds = Math.floor(NOW / 1000);

describe('createSsoTokenVerifier', () => {
  it('verifies a well-formed Apple token and returns provider/subject/email', async () => {
    const apple = makeKeyPair('apple-kid-1');
    const verifier = createSsoTokenVerifier({
      config: { apple: { serviceIds: ['com.mylife.meerkat'] } },
      jwksSource: fakeJwksSource({ [APPLE_ISSUER]: { keys: [apple.publicJwk] } }),
      now: () => NOW,
    });
    const token = signJwt(apple.privateKey, 'apple-kid-1', {
      iss: APPLE_ISSUER,
      aud: 'com.mylife.meerkat',
      sub: 'apple-subject-001',
      email: 'relay@privaterelay.appleid.com',
      exp: nowSeconds + 600,
      iat: nowSeconds - 10,
    });
    const result = await verifier.verify('apple', token);
    expect(result).toEqual({
      ok: true,
      provider: 'apple',
      subject: 'apple-subject-001',
      email: 'relay@privaterelay.appleid.com',
    });
  });

  it('verifies a Google token with array aud', async () => {
    const google = makeKeyPair('g-kid');
    const verifier = createSsoTokenVerifier({
      config: { google: { clientIds: ['123.apps.googleusercontent.com'] } },
      jwksSource: fakeJwksSource({ [GOOGLE_ISSUER]: { keys: [google.publicJwk] } }),
      now: () => NOW,
    });
    const token = signJwt(google.privateKey, 'g-kid', {
      iss: GOOGLE_ISSUER,
      aud: ['other.example', '123.apps.googleusercontent.com'],
      sub: 'google-subject-001',
      exp: nowSeconds + 600,
    });
    const result = await verifier.verify('google', token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.subject).toBe('google-subject-001');
  });

  it('refuses an unconfigured provider with not_configured (AC-6)', async () => {
    const apple = makeKeyPair('apple-kid-1');
    const verifier = createSsoTokenVerifier({
      config: {}, // neither provider configured
      jwksSource: fakeJwksSource({ [APPLE_ISSUER]: { keys: [apple.publicJwk] } }),
      now: () => NOW,
    });
    const token = signJwt(apple.privateKey, 'apple-kid-1', {
      iss: APPLE_ISSUER,
      aud: 'com.mylife.meerkat',
      sub: 'apple-subject-001',
      exp: nowSeconds + 600,
    });
    expect(await verifier.verify('apple', token)).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('refuses a wrong audience', async () => {
    const apple = makeKeyPair('apple-kid-1');
    const verifier = createSsoTokenVerifier({
      config: { apple: { serviceIds: ['com.mylife.meerkat'] } },
      jwksSource: fakeJwksSource({ [APPLE_ISSUER]: { keys: [apple.publicJwk] } }),
      now: () => NOW,
    });
    const token = signJwt(apple.privateKey, 'apple-kid-1', {
      iss: APPLE_ISSUER,
      aud: 'com.someone.else',
      sub: 'apple-subject-001',
      exp: nowSeconds + 600,
    });
    expect(await verifier.verify('apple', token)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses a wrong issuer', async () => {
    const apple = makeKeyPair('apple-kid-1');
    const verifier = createSsoTokenVerifier({
      config: { apple: { serviceIds: ['com.mylife.meerkat'] } },
      jwksSource: fakeJwksSource({ [APPLE_ISSUER]: { keys: [apple.publicJwk] } }),
      now: () => NOW,
    });
    const token = signJwt(apple.privateKey, 'apple-kid-1', {
      iss: 'https://evil.example',
      aud: 'com.mylife.meerkat',
      sub: 'apple-subject-001',
      exp: nowSeconds + 600,
    });
    expect(await verifier.verify('apple', token)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses an expired token', async () => {
    const apple = makeKeyPair('apple-kid-1');
    const verifier = createSsoTokenVerifier({
      config: { apple: { serviceIds: ['com.mylife.meerkat'] } },
      jwksSource: fakeJwksSource({ [APPLE_ISSUER]: { keys: [apple.publicJwk] } }),
      now: () => NOW,
    });
    const token = signJwt(apple.privateKey, 'apple-kid-1', {
      iss: APPLE_ISSUER,
      aud: 'com.mylife.meerkat',
      sub: 'apple-subject-001',
      exp: nowSeconds - 3600, // an hour past, well beyond the 5m skew
    });
    expect(await verifier.verify('apple', token)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses a tampered signature (signed by a different key)', async () => {
    const apple = makeKeyPair('apple-kid-1');
    const impostor = makeKeyPair('apple-kid-1'); // same kid, different key
    const verifier = createSsoTokenVerifier({
      config: { apple: { serviceIds: ['com.mylife.meerkat'] } },
      jwksSource: fakeJwksSource({ [APPLE_ISSUER]: { keys: [apple.publicJwk] } }),
      now: () => NOW,
    });
    const token = signJwt(impostor.privateKey, 'apple-kid-1', {
      iss: APPLE_ISSUER,
      aud: 'com.mylife.meerkat',
      sub: 'apple-subject-001',
      exp: nowSeconds + 600,
    });
    expect(await verifier.verify('apple', token)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses a malformed token', async () => {
    const apple = makeKeyPair('apple-kid-1');
    const verifier = createSsoTokenVerifier({
      config: { apple: { serviceIds: ['com.mylife.meerkat'] } },
      jwksSource: fakeJwksSource({ [APPLE_ISSUER]: { keys: [apple.publicJwk] } }),
      now: () => NOW,
    });
    expect(await verifier.verify('apple', 'not.a.jwt.at.all')).toEqual({ ok: false, reason: 'invalid' });
    expect(await verifier.verify('apple', 'onlyonesegment')).toEqual({ ok: false, reason: 'invalid' });
  });
});
