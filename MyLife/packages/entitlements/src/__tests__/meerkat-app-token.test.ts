/**
 * Plan 39 P6: app-unlock PROOF token (HMAC, short-lived, founder-locked product).
 * Fail-closed on tamper, wrong secret, wrong product/feature, expiry, and
 * cross-family confusion with hosted-subscription entitlement tokens (NC-P5).
 */

import { describe, expect, it } from 'vitest';
import {
  APP_UNLOCK_TOKEN_TTL_MS,
  MEERKAT_APP_UNLOCK_FEATURE,
  issueMeerkatAppUnlockToken,
  parseMeerkatAppUnlockToken,
  verifyMeerkatAppUnlockToken,
} from '../meerkat-app-token';
import { MEERKAT_APP_UNLOCK_PRODUCT_ID } from '../meerkat-app';
import { issueMeerkatHostedEntitlement } from '../meerkat-hosted';

const SECRET = 'proof-secret';
const NOW = Date.parse('2026-07-06T12:00:00.000Z');
const PURCHASE = '2026-07-01T00:00:00.000Z';

describe('meerkat app-unlock proof token (Plan 39 P6)', () => {
  it('issues and verifies a proof bound to the founder-locked product id', async () => {
    const { token, payload } = await issueMeerkatAppUnlockToken({ secret: SECRET, purchaseDate: PURCHASE, nowMs: NOW });
    expect(payload.productId).toBe(MEERKAT_APP_UNLOCK_PRODUCT_ID);
    expect(payload.productId).toBe('meerkat_app_unlock');
    expect(payload.feature).toBe(MEERKAT_APP_UNLOCK_FEATURE);
    const check = await verifyMeerkatAppUnlockToken(token, SECRET, { nowMs: NOW });
    expect(check.ok).toBe(true);
  });

  it('rejects missing, malformed, wrong-secret, and tampered tokens fail-closed', async () => {
    const { token } = await issueMeerkatAppUnlockToken({ secret: SECRET, purchaseDate: PURCHASE, nowMs: NOW });
    expect((await verifyMeerkatAppUnlockToken(null, SECRET)).ok).toBe(false);
    expect((await verifyMeerkatAppUnlockToken('', SECRET)).ok).toBe(false);
    expect((await verifyMeerkatAppUnlockToken('garbage!!', SECRET)).ok).toBe(false);
    expect((await verifyMeerkatAppUnlockToken(token, 'wrong-secret', { nowMs: NOW })).ok).toBe(false);

    const parsed = parseMeerkatAppUnlockToken(token)!;
    const tampered = JSON.stringify({ ...parsed, expiresAt: '2036-01-01T00:00:00.000Z' });
    const verdict = await verifyMeerkatAppUnlockToken(tampered, SECRET, { nowMs: NOW });
    expect(verdict).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('expires: a stale proof is rejected with reason expired', async () => {
    const { token } = await issueMeerkatAppUnlockToken({ secret: SECRET, purchaseDate: PURCHASE, nowMs: NOW });
    const verdict = await verifyMeerkatAppUnlockToken(token, SECRET, { nowMs: NOW + APP_UNLOCK_TOKEN_TTL_MS + 1 });
    expect(verdict).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a proof re-targeted at another product/feature (signature covers both)', async () => {
    const { token } = await issueMeerkatAppUnlockToken({ secret: SECRET, purchaseDate: PURCHASE, nowMs: NOW });
    const parsed = parseMeerkatAppUnlockToken(token)!;
    const wrongProduct = JSON.stringify({ ...parsed, productId: 'meerkat_pro_yearly' });
    expect((await verifyMeerkatAppUnlockToken(wrongProduct, SECRET, { nowMs: NOW })).ok).toBe(false);
    const wrongFeature = JSON.stringify({ ...parsed, feature: 'meerkat:hosted-relay' });
    expect((await verifyMeerkatAppUnlockToken(wrongFeature, SECRET, { nowMs: NOW })).ok).toBe(false);
  });

  it('persona binding: required-binding gates reject unbound, mismatched, and tampered bindings', async () => {
    const BINDING = 'ab'.repeat(32);
    const bound = await issueMeerkatAppUnlockToken({ secret: SECRET, purchaseDate: PURCHASE, bindingHash: BINDING, nowMs: NOW });
    expect((await verifyMeerkatAppUnlockToken(bound.token, SECRET, {
      nowMs: NOW, requireBinding: true, expectedBindingHash: BINDING,
    })).ok).toBe(true);
    expect(await verifyMeerkatAppUnlockToken(bound.token, SECRET, {
      nowMs: NOW, requireBinding: true, expectedBindingHash: 'cd'.repeat(32),
    })).toEqual({ ok: false, reason: 'wrong_binding' });

    const unbound = await issueMeerkatAppUnlockToken({ secret: SECRET, purchaseDate: PURCHASE, nowMs: NOW });
    expect(await verifyMeerkatAppUnlockToken(unbound.token, SECRET, {
      nowMs: NOW, requireBinding: true, expectedBindingHash: BINDING,
    })).toEqual({ ok: false, reason: 'unbound' });
    // Unbound still verifies where no binding is demanded.
    expect((await verifyMeerkatAppUnlockToken(unbound.token, SECRET, { nowMs: NOW })).ok).toBe(true);

    // Re-targeting the binding breaks the HMAC (signature covers it).
    const parsed = parseMeerkatAppUnlockToken(bound.token)!;
    const retargeted = JSON.stringify({ ...parsed, binding: 'cd'.repeat(32) });
    expect(await verifyMeerkatAppUnlockToken(retargeted, SECRET, {
      nowMs: NOW, requireBinding: true, expectedBindingHash: 'cd'.repeat(32),
    })).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('a hosted-subscription entitlement token NEVER verifies as an app-unlock proof (NC-P5)', async () => {
    const hosted = await issueMeerkatHostedEntitlement({ secret: SECRET, expiresAt: new Date(NOW + 60_000).toISOString() });
    const verdict = await verifyMeerkatAppUnlockToken(hosted.token, SECRET, { nowMs: NOW });
    expect(verdict.ok).toBe(false);
  });
});
