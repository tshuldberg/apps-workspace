import { describe, expect, it } from 'vitest';

import { isAal2, nextMfaStep, readAccessTokenClaims } from '../aal';

/**
 * MFA assurance reading (plan 48 WP9). Every case that is not exactly 'aal2' has
 * to read as aal1, because reading it any other way is how a console with MFA
 * "enforced" lets a single-factor session through.
 */

function token(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature-not-checked-here`;
}

describe('readAccessTokenClaims', () => {
  it('reads aal2 and the session id from a verified token payload', () => {
    const claims = readAccessTokenClaims(
      token({ aal: 'aal2', session_id: 'sess-1', exp: 1900000000 }),
    );
    expect(claims.aal).toBe('aal2');
    expect(claims.sessionId).toBe('sess-1');
    expect(claims.expiresAt).toBe(1900000000);
  });

  it('reads the authentication methods when the token records them', () => {
    const claims = readAccessTokenClaims(
      token({ aal: 'aal2', amr: [{ method: 'totp' }, { method: 'otp' }] }),
    );
    expect(claims.methods).toEqual(['totp', 'otp']);
  });

  it('tolerates plain-string amr entries', () => {
    expect(readAccessTokenClaims(token({ aal: 'aal2', amr: ['totp'] })).methods).toEqual(['totp']);
  });

  it('drops amr entries it cannot read rather than guessing', () => {
    expect(
      readAccessTokenClaims(token({ aal: 'aal2', amr: [{ nope: 1 }, null, 5, { method: 'totp' }] }))
        .methods,
    ).toEqual(['totp']);
  });

  it.each([
    ['aal1', { aal: 'aal1' }],
    ['a missing aal claim', { session_id: 's' }],
    ['an uppercase AAL2', { aal: 'AAL2' }],
    ['aal3', { aal: 'aal3' }],
    ['a numeric aal', { aal: 2 }],
    ['a truthy object aal', { aal: { level: 'aal2' } }],
    ['an array aal', { aal: ['aal2'] }],
  ])('reads %s as aal1', (_label, payload) => {
    expect(readAccessTokenClaims(token(payload)).aal).toBe('aal1');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['a non-JWT string', 'not-a-jwt'],
    ['a two-part token', 'a.b'],
    ['a four-part token', 'a.b.c.d'],
    ['an empty payload segment', 'a..c'],
    ['a payload that is not base64', 'a.!!!!.c'],
    ['a payload that is not JSON', `a.${Buffer.from('hello', 'utf8').toString('base64url')}.c`],
    ['a payload that is a JSON array', `a.${Buffer.from('[1,2]', 'utf8').toString('base64url')}.c`],
    ['a payload that is JSON null', `a.${Buffer.from('null', 'utf8').toString('base64url')}.c`],
  ])('reads %s as aal1 without throwing', (_label, value) => {
    const claims = readAccessTokenClaims(value as string | null);
    expect(claims.aal).toBe('aal1');
    expect(claims.sessionId).toBeNull();
    expect(claims.methods).toEqual([]);
  });

  it('isAal2 is the same decision', () => {
    expect(isAal2(token({ aal: 'aal2' }))).toBe(true);
    expect(isAal2(token({ aal: 'aal1' }))).toBe(false);
    expect(isAal2(null)).toBe(false);
  });

  it('ignores a non-numeric exp instead of coercing it', () => {
    expect(readAccessTokenClaims(token({ aal: 'aal2', exp: 'soon' })).expiresAt).toBeNull();
  });
});

describe('nextMfaStep', () => {
  it('passes a session that is already aal2', () => {
    expect(
      nextMfaStep({ currentLevel: 'aal2', nextLevel: 'aal2', hasVerifiedFactor: true }),
    ).toBe('ok');
  });

  it('asks for verification when a factor exists but this session has not used it', () => {
    expect(
      nextMfaStep({ currentLevel: 'aal1', nextLevel: 'aal2', hasVerifiedFactor: true }),
    ).toBe('verify');
  });

  it('asks for verification on a verified factor even when nextLevel lags', () => {
    expect(
      nextMfaStep({ currentLevel: 'aal1', nextLevel: 'aal1', hasVerifiedFactor: true }),
    ).toBe('verify');
  });

  it('asks for enrolment when no factor exists', () => {
    expect(
      nextMfaStep({ currentLevel: 'aal1', nextLevel: 'aal1', hasVerifiedFactor: false }),
    ).toBe('enroll');
  });

  it('falls back to enrolment on unreadable levels rather than passing', () => {
    expect(nextMfaStep({ currentLevel: null, nextLevel: null, hasVerifiedFactor: false })).toBe(
      'enroll',
    );
    expect(
      nextMfaStep({ currentLevel: 'unknown', nextLevel: 'unknown', hasVerifiedFactor: false }),
    ).toBe('enroll');
  });
});
