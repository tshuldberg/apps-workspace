import { describe, expect, it, vi } from 'vitest';
import {
  createEntitlementSignature,
  verifyEntitlementSignature,
} from '../verify';
import { isEntitlementExpired } from '../runtime';
import type { Entitlements, UnsignedEntitlements } from '../types';

const SECRET = 'test-entitlement-secret';

function baseUnsignedEntitlement(overrides?: Partial<UnsignedEntitlements>): UnsignedEntitlements {
  return {
    appId: 'mylife',
    mode: 'hosted',
    hostedActive: true,
    selfHostLicense: false,
    updatePackYear: 2026,
    features: ['sharing', 'sync', 'sharing'],
    issuedAt: '2026-03-09T00:00:00.000Z',
    expiresAt: '2026-12-31T00:00:00.000Z',
    ...(overrides ?? {}),
  };
}

async function signedEntitlement(overrides?: Partial<UnsignedEntitlements>): Promise<Entitlements> {
  const unsigned = baseUnsignedEntitlement(overrides);
  const signature = await createEntitlementSignature(unsigned, SECRET);
  return {
    ...unsigned,
    signature,
  };
}

describe('entitlement signature helpers', () => {
  it('creates a stable signature for the same logical payload', async () => {
    const a = await createEntitlementSignature(baseUnsignedEntitlement(), SECRET);
    const b = await createEntitlementSignature(
      baseUnsignedEntitlement({
        features: ['sync', 'sharing'],
      }),
      SECRET,
    );

    expect(a).toBe(b);
  });

  it('verifies a valid signature', async () => {
    const entitlement = await signedEntitlement();

    await expect(verifyEntitlementSignature(entitlement, SECRET)).resolves.toBe(true);
  });

  it('rejects tampered payloads', async () => {
    const entitlement = await signedEntitlement();

    await expect(
      verifyEntitlementSignature(
        {
          ...entitlement,
          features: ['sync', 'tampered'],
        },
        SECRET,
      ),
    ).resolves.toBe(false);
  });

  it('rejects expired entitlements', async () => {
    const entitlement = await signedEntitlement({
      expiresAt: '2026-03-10T00:00:00.000Z',
    });

    await expect(
      verifyEntitlementSignature(entitlement, SECRET, {
        nowMs: Date.parse('2026-03-11T00:00:00.000Z'),
      }),
    ).resolves.toBe(false);
    expect(
      isEntitlementExpired(entitlement, Date.parse('2026-03-11T00:00:00.000Z')),
    ).toBe(true);
  });

  it('rejects revoked signatures', async () => {
    const entitlement = await signedEntitlement();
    const isRevoked = vi.fn().mockResolvedValue(true);

    await expect(
      verifyEntitlementSignature(entitlement, SECRET, {
        isRevoked,
      }),
    ).resolves.toBe(false);
    expect(isRevoked).toHaveBeenCalledWith(entitlement.signature);
  });
});
