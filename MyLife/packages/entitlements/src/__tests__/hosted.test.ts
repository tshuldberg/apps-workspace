import { describe, expect, it } from 'vitest';
import {
  isEntitlementExpired,
  createEntitlementSignature,
  verifyEntitlementSignature,
  EntitlementsSchema,
} from '../index';
import type { UnsignedEntitlements } from '../hosted-types';

// ---------------------------------------------------------------------------
// isEntitlementExpired
// ---------------------------------------------------------------------------

describe('isEntitlementExpired', () => {
  it('returns false when no purchaseDate and no expiresAt', () => {
    expect(isEntitlementExpired({ purchaseDate: null })).toBe(false);
    expect(isEntitlementExpired({})).toBe(false);
  });

  it('returns true when expiresAt is in the past', () => {
    const pastIso = new Date(Date.now() - 1000).toISOString();
    expect(isEntitlementExpired({ expiresAt: pastIso })).toBe(true);
  });

  it('returns false when expiresAt is in the future', () => {
    const futureIso = new Date(Date.now() + 86_400_000).toISOString();
    expect(isEntitlementExpired({ expiresAt: futureIso })).toBe(false);
  });

  it('returns false when updateEntitled is true (IAP model)', () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    expect(isEntitlementExpired({ purchaseDate: oldDate, updateEntitled: true })).toBe(false);
  });

  it('returns true when purchaseDate is older than one year and updateEntitled is false', () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    expect(isEntitlementExpired({ purchaseDate: oldDate, updateEntitled: false })).toBe(true);
  });

  it('returns false when purchaseDate is within the past year', () => {
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(isEntitlementExpired({ purchaseDate: recentDate })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createEntitlementSignature + verifyEntitlementSignature
// ---------------------------------------------------------------------------

describe('createEntitlementSignature / verifyEntitlementSignature', () => {
  const payload: UnsignedEntitlements = {
    appId: 'mylife',
    mode: 'hosted',
    hostedActive: true,
    selfHostLicense: false,
    features: ['sync', 'sharing'],
    issuedAt: '2026-01-01T00:00:00.000Z',
  };

  it('produces a non-empty base64url signature', async () => {
    const sig = await createEntitlementSignature(payload, 'test-secret');
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(10);
    // base64url: no +, /, or trailing =
    expect(sig).not.toMatch(/[+/=]/);
  });

  it('verifies a correctly signed payload', async () => {
    const sig = await createEntitlementSignature(payload, 'test-secret');
    const entitlements = { ...payload, signature: sig };
    expect(await verifyEntitlementSignature(entitlements, 'test-secret')).toBe(true);
  });

  it('rejects a payload signed with a different secret', async () => {
    const sig = await createEntitlementSignature(payload, 'secret-a');
    const entitlements = { ...payload, signature: sig };
    expect(await verifyEntitlementSignature(entitlements, 'secret-b')).toBe(false);
  });

  it('rejects a revoked signature via options.isRevoked', async () => {
    const sig = await createEntitlementSignature(payload, 'test-secret');
    const entitlements = { ...payload, signature: sig };
    const result = await verifyEntitlementSignature(entitlements, 'test-secret', {
      isRevoked: (s) => s === sig,
    });
    expect(result).toBe(false);
  });

  it('rejects a revoked signature via options.revokedSignatures', async () => {
    const sig = await createEntitlementSignature(payload, 'test-secret');
    const entitlements = { ...payload, signature: sig };
    const result = await verifyEntitlementSignature(entitlements, 'test-secret', {
      revokedSignatures: [sig],
    });
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EntitlementsSchema
// ---------------------------------------------------------------------------

describe('EntitlementsSchema', () => {
  const valid = {
    appId: 'mylife',
    mode: 'self_host',
    hostedActive: false,
    selfHostLicense: true,
    features: ['sync'],
    issuedAt: '2026-01-01T00:00:00.000Z',
    signature: 'abc123',
  };

  it('parses a valid entitlements object', () => {
    const result = EntitlementsSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects an object missing required fields', () => {
    const { signature: _sig, ...noSig } = valid;
    expect(_sig).toBeTruthy();
    expect(EntitlementsSchema.safeParse(noSig).success).toBe(false);
  });

  it('rejects an invalid mode', () => {
    expect(EntitlementsSchema.safeParse({ ...valid, mode: 'invalid' }).success).toBe(false);
  });
});
