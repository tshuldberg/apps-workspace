import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureSyncSecretStore,
  createHostedAuthBearer,
  createInMemorySyncSecretStore,
  createRevenueCatAppUserId,
  generateDeviceIdentity,
  hostedAuthMessage,
  MEERKAT_HOSTED_AUTH_MAX_TTL_MS,
  verifyRevenueCatAppUserId,
  verifySignature,
} from '../../index';

describe('hosted device authorization bearer', () => {
  beforeEach(() => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
  });

  it('binds the device public key and exact expiry to a valid Ed25519 signature', () => {
    const identity = generateDeviceIdentity('Billing device');
    const token = createHostedAuthBearer(identity, 1_000, 60_000);
    const [subjectId, expiry, signature] = token.split('.');

    expect(subjectId).toBe(identity.publicKey);
    expect(expiry).toBe('61000');
    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);

    const padded = `${signature}${'='.repeat((4 - (signature!.length % 4)) % 4)}`
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    expect(verifySignature(identity.publicKey, hostedAuthMessage(identity.publicKey, 61_000), bytes)).toBe(true);
  });

  it('rejects non-positive, non-finite, and over-cap lifetimes', () => {
    const identity = generateDeviceIdentity('Billing device');
    expect(() => createHostedAuthBearer(identity, 1_000, 0)).toThrow(/ttlMs/u);
    expect(() => createHostedAuthBearer(identity, 1_000, Number.NaN)).toThrow(/ttlMs/u);
    expect(() => createHostedAuthBearer(identity, 1_000, MEERKAT_HOSTED_AUTH_MAX_TTL_MS + 1)).toThrow(/ttlMs/u);
    expect(() => createHostedAuthBearer(identity, Number.NaN, 1_000)).toThrow(/nowMs/u);
  });

  it('derives an unguessable RevenueCat id that is cryptographically bound to the device', () => {
    const identity = generateDeviceIdentity('Purchase device');
    const other = generateDeviceIdentity('Other device');
    const appUserId = createRevenueCatAppUserId(identity);

    expect(appUserId).toMatch(/^[A-Za-z0-9_-]{86}$/u);
    expect(appUserId).not.toContain(identity.publicKey);
    expect(createRevenueCatAppUserId(identity)).toBe(appUserId);
    expect(verifyRevenueCatAppUserId(identity.publicKey, appUserId)).toBe(true);
    expect(verifyRevenueCatAppUserId(other.publicKey, appUserId)).toBe(false);
    const replacement = appUserId.endsWith('A') ? 'B' : 'A';
    expect(verifyRevenueCatAppUserId(identity.publicKey, `${appUserId.slice(0, -1)}${replacement}`)).toBe(false);
  });
});
