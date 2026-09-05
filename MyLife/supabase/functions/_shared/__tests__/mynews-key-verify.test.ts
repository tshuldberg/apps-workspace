// Step-up freshness gate and its parity with the account-deletion window
// (plan 48 WP6).

import { describe, expect, it } from 'vitest';
import {
  CUSTODY_STEP_UP_MAX_TOKEN_AGE_SECONDS,
  hasFreshSession,
} from '../mynews-key-verify.ts';
import { REAUTH_MAX_TOKEN_AGE_SECONDS } from '../../mynews-account/index.ts';

const NOW = 1_700_000_000_000;
const nowSeconds = Math.floor(NOW / 1000);

function req(iat: number | null | undefined, withAuth = true): Request {
  const headers: Record<string, string> = {};
  if (withAuth) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const claims: Record<string, unknown> = { sub: 'user-1' };
    if (iat !== null && iat !== undefined) claims.iat = iat;
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    headers.Authorization = `Bearer ${header}.${payload}.sig`;
  }
  return new Request('http://local/mynews-register-key', { method: 'POST', headers });
}

describe('step-up window parity', () => {
  it('pins the custody window to the account-deletion window', () => {
    // Two different step-up windows in one product would be a bug, and the
    // looser one would silently become the real security boundary.
    expect(CUSTODY_STEP_UP_MAX_TOKEN_AGE_SECONDS).toBe(REAUTH_MAX_TOKEN_AGE_SECONDS);
    expect(CUSTODY_STEP_UP_MAX_TOKEN_AGE_SECONDS).toBe(10 * 60);
  });
});

describe('hasFreshSession', () => {
  it('accepts a token issued now and one right at the boundary', () => {
    expect(hasFreshSession(req(nowSeconds), NOW)).toBe(true);
    expect(
      hasFreshSession(req(nowSeconds - CUSTODY_STEP_UP_MAX_TOKEN_AGE_SECONDS), NOW),
    ).toBe(true);
  });

  it('rejects a token one second past the boundary', () => {
    expect(
      hasFreshSession(req(nowSeconds - CUSTODY_STEP_UP_MAX_TOKEN_AGE_SECONDS - 1), NOW),
    ).toBe(false);
  });

  it('fails closed on a token with NO iat: an unageable token is not fresh', () => {
    expect(hasFreshSession(req(null), NOW)).toBe(false);
  });

  it('fails closed with no Authorization header at all', () => {
    expect(hasFreshSession(req(nowSeconds, false), NOW)).toBe(false);
  });

  it('tolerates small clock skew but rejects a far-future token', () => {
    expect(hasFreshSession(req(nowSeconds + 30), NOW)).toBe(true);
    expect(hasFreshSession(req(nowSeconds + 3600), NOW)).toBe(false);
  });
});
