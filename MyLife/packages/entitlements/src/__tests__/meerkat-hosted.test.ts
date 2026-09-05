import { describe, expect, it } from 'vitest';
import {
  MEERKAT_APP_ID,
  MEERKAT_HOSTED_RELAY_FEATURE,
  MEERKAT_COMMUNITY_NODE_FEATURE,
  MEERKAT_HOSTED_STORAGE_FEATURE,
  issueMeerkatHostedEntitlement,
  parseEntitlementToken,
  serializeEntitlementToken,
  verifyHostedFeatureEntitlement,
} from '../server';
import { createEntitlementSignature } from '../verify';
import type { Entitlements } from '../hosted-types';

const SECRET = 'meerkat-test-secret';

describe('Meerkat hosted entitlement tokens', () => {
  it('issues a compact bearer token with all hosted features by default', async () => {
    const issued = await issueMeerkatHostedEntitlement({
      secret: SECRET,
      issuedAt: '2026-06-20T00:00:00.000Z',
      expiresAt: '2026-06-21T00:00:00.000Z',
    });

    expect(issued.token).not.toContain('{');
    expect(parseEntitlementToken(issued.token)).toEqual(issued.entitlements);
    expect(issued.entitlements.appId).toBe(MEERKAT_APP_ID);
    expect(issued.entitlements.features).toEqual([
      MEERKAT_COMMUNITY_NODE_FEATURE,
      MEERKAT_HOSTED_RELAY_FEATURE,
      MEERKAT_HOSTED_STORAGE_FEATURE,
    ]);
  });

  it('gates the hosted-storage feature fail-closed (Plan 22 S0.6 / TC-15)', async () => {
    // A default-issued token carries hosted-storage and passes the storage gate.
    const full = await issueMeerkatHostedEntitlement({
      secret: SECRET,
      issuedAt: '2026-06-20T00:00:00.000Z',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    await expect(
      verifyHostedFeatureEntitlement(full.token, SECRET, MEERKAT_HOSTED_STORAGE_FEATURE),
    ).resolves.toMatchObject({ ok: true });

    // A token issued WITHOUT hosted-storage fails the storage gate fail-closed.
    const relayOnly = await issueMeerkatHostedEntitlement({
      secret: SECRET,
      features: [MEERKAT_HOSTED_RELAY_FEATURE],
      issuedAt: '2026-06-20T00:00:00.000Z',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    await expect(
      verifyHostedFeatureEntitlement(relayOnly.token, SECRET, MEERKAT_HOSTED_STORAGE_FEATURE),
    ).resolves.toMatchObject({ ok: false, reason: 'missing_feature' });

    // No token at all also fails closed.
    await expect(
      verifyHostedFeatureEntitlement(null, SECRET, MEERKAT_HOSTED_STORAGE_FEATURE),
    ).resolves.toMatchObject({ ok: false, reason: 'missing' });
  });

  it('accepts the legacy raw JSON entitlement shape too', async () => {
    const issued = await issueMeerkatHostedEntitlement({
      secret: SECRET,
      features: [MEERKAT_HOSTED_RELAY_FEATURE],
      issuedAt: '2026-06-20T00:00:00.000Z',
    });

    const rawJson = JSON.stringify(issued.entitlements);
    await expect(
      verifyHostedFeatureEntitlement(rawJson, SECRET, MEERKAT_HOSTED_RELAY_FEATURE),
    ).resolves.toMatchObject({ ok: true });
  });

  it('returns null for malformed or invalid token payloads', async () => {
    const issued = await issueMeerkatHostedEntitlement({
      secret: SECRET,
      issuedAt: '2026-06-20T00:00:00.000Z',
    });
    const { signature: _signature, ...unsignedPayload } = issued.entitlements;
    expect(_signature).toBeTruthy();

    expect(parseEntitlementToken('')).toBeNull();
    expect(parseEntitlementToken('not-valid-base64!')).toBeNull();
    expect(parseEntitlementToken('eyJ')).toBeNull();
    expect(parseEntitlementToken(JSON.stringify(unsignedPayload))).toBeNull();
  });

  it('rejects missing, expired, inactive, wrong-app, and missing-feature tokens', async () => {
    const issued = await issueMeerkatHostedEntitlement({
      secret: SECRET,
      features: [MEERKAT_HOSTED_RELAY_FEATURE],
      issuedAt: '2026-06-20T00:00:00.000Z',
      expiresAt: '2026-06-20T01:00:00.000Z',
    });

    await expect(
      verifyHostedFeatureEntitlement(null, SECRET, MEERKAT_HOSTED_RELAY_FEATURE),
    ).resolves.toEqual({ ok: false, reason: 'missing' });
    await expect(
      verifyHostedFeatureEntitlement(
        issued.token,
        SECRET,
        MEERKAT_HOSTED_RELAY_FEATURE,
        { nowMs: Date.parse('2026-06-20T02:00:00.000Z') },
      ),
    ).resolves.toEqual({ ok: false, reason: 'expired' });
    await expect(
      verifyHostedFeatureEntitlement(
        issued.token,
        SECRET,
        MEERKAT_COMMUNITY_NODE_FEATURE,
        { nowMs: Date.parse('2026-06-20T00:30:00.000Z') },
      ),
    ).resolves.toEqual({ ok: false, reason: 'missing_feature' });

    const wrongApp = await signCustom({ ...issued.entitlements, appId: 'mylife' });
    await expect(
      verifyHostedFeatureEntitlement(
        serializeEntitlementToken(wrongApp),
        SECRET,
        MEERKAT_HOSTED_RELAY_FEATURE,
      ),
    ).resolves.toEqual({ ok: false, reason: 'wrong_app' });

    const inactive = await signCustom({
      ...issued.entitlements,
      mode: 'local_only',
      hostedActive: false,
      expiresAt: undefined,
    });
    await expect(
      verifyHostedFeatureEntitlement(
        serializeEntitlementToken(inactive),
        SECRET,
        MEERKAT_HOSTED_RELAY_FEATURE,
      ),
    ).resolves.toEqual({ ok: false, reason: 'inactive' });
  });

  it('rejects tampered signatures and revoked signatures', async () => {
    const issued = await issueMeerkatHostedEntitlement({
      secret: SECRET,
      issuedAt: '2026-06-20T00:00:00.000Z',
    });

    const tampered = serializeEntitlementToken({
      ...issued.entitlements,
      features: [...issued.entitlements.features, 'extra'],
    });
    await expect(
      verifyHostedFeatureEntitlement(tampered, SECRET, 'extra'),
    ).resolves.toEqual({ ok: false, reason: 'invalid_signature' });

    await expect(
      verifyHostedFeatureEntitlement(
        issued.token,
        SECRET,
        MEERKAT_HOSTED_RELAY_FEATURE,
        { revokedSignatures: [issued.entitlements.signature] },
      ),
    ).resolves.toEqual({ ok: false, reason: 'revoked' });

    await expect(
      verifyHostedFeatureEntitlement(
        issued.token,
        SECRET,
        MEERKAT_HOSTED_RELAY_FEATURE,
        { revokedSignatures: ['different-signature'] },
      ),
    ).resolves.toMatchObject({ ok: true });

    await expect(
      verifyHostedFeatureEntitlement(
        issued.token,
        SECRET,
        MEERKAT_HOSTED_RELAY_FEATURE,
        { isRevoked: async (signature) => signature === issued.entitlements.signature },
      ),
    ).resolves.toEqual({ ok: false, reason: 'revoked' });
  });
});

async function signCustom(entitlements: Entitlements): Promise<Entitlements> {
  const { signature: _signature, ...unsignedPayload } = entitlements;
  void _signature;
  return {
    ...unsignedPayload,
    signature: await createEntitlementSignature(unsignedPayload, SECRET),
  };
}
