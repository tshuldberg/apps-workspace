import { describe, expect, it } from 'vitest';
import {
  STORAGE_AUTH_DOMAIN,
  STORAGE_V1_SUPPORTED_OPERATIONS,
  canonicalStorageCapabilityDescriptorBytes,
  createStorageChallengeNonce,
  signStorageCapabilityDescriptor,
  signStorageChallengeResponse,
  storageOperatorPublicKeyFromPrivateKey,
  verifyStorageCapabilityDescriptor,
  verifyStorageChallengeResponse,
  type StorageCapabilityDescriptor,
  type UnsignedStorageCapabilityDescriptor,
} from '../connected-descriptor';

const NOW = '2026-07-14T16:00:00.000Z';
const OPERATOR_SEED = '11'.repeat(32);
const OTHER_SEED = '22'.repeat(32);
const OPERATOR_KEY = storageOperatorPublicKeyFromPrivateKey(OPERATOR_SEED);

function unsignedDescriptor(
  overrides: Partial<UnsignedStorageCapabilityDescriptor> = {},
): UnsignedStorageCapabilityDescriptor {
  return {
    version: 1,
    endpoint: 'https://storage.example.test/api/storage/v1',
    operatorKey: OPERATOR_KEY,
    supportedOperations: [...STORAGE_V1_SUPPORTED_OPERATIONS],
    maximumObjectBytes: 1_048_576,
    quotaBytes: 10_485_760,
    retention: 'rolling30',
    authDomain: STORAGE_AUTH_DOMAIN,
    issuedAt: '2026-07-14T15:55:00.000Z',
    expiresAt: '2026-07-14T16:05:00.000Z',
    ...overrides,
  };
}

function descriptor(
  overrides: Partial<UnsignedStorageCapabilityDescriptor> = {},
): StorageCapabilityDescriptor {
  return signStorageCapabilityDescriptor(unsignedDescriptor(overrides), OPERATOR_SEED, {
    allowInsecureLocalNetwork: overrides.endpoint?.startsWith('http://') === true,
  });
}

describe('storage:v1 capability descriptor', () => {
  it('builds explicit canonical bytes in the plan field order', () => {
    const value = unsignedDescriptor({ supportedOperations: ['health', 'quota'] });
    expect(new TextDecoder().decode(canonicalStorageCapabilityDescriptorBytes(value))).toBe(JSON.stringify([
      'meerkat-storage-capability-descriptor-v1',
      1,
      value.endpoint,
      value.operatorKey,
      ['health', 'quota'],
      value.maximumObjectBytes,
      value.quotaBytes,
      value.retention,
      STORAGE_AUTH_DOMAIN,
      value.issuedAt,
      value.expiresAt,
    ]));
  });

  it('signs with the matching Ed25519 operator key and verifies at the injected clock', () => {
    const signed = descriptor();
    expect(signed.signature).toMatch(/^[a-f0-9]{128}$/);
    expect(verifyStorageCapabilityDescriptor(signed, {
      now: () => NOW,
      expectedOperatorKey: OPERATOR_KEY,
      requiredOperations: ['health', 'quota'],
    })).toBe(true);
  });

  it.each([
    ['tampered endpoint', (value: StorageCapabilityDescriptor) => ({ ...value, endpoint: 'https://evil.example.test/api/storage/v1' })],
    ['tampered quota', (value: StorageCapabilityDescriptor) => ({ ...value, quotaBytes: 1 })],
    ['wrong version', (value: StorageCapabilityDescriptor) => ({ ...value, version: 2 })],
    ['wrong auth domain', (value: StorageCapabilityDescriptor) => ({ ...value, authDomain: 'other-domain' })],
    ['unknown operation', (value: StorageCapabilityDescriptor) => ({ ...value, supportedOperations: ['health', 'unknown'] })],
    ['duplicate operation', (value: StorageCapabilityDescriptor) => ({ ...value, supportedOperations: ['health', 'health'] })],
    ['extra unsigned field', (value: StorageCapabilityDescriptor) => ({ ...value, ignored: true })],
  ] as const)('fails closed for %s', (_label, mutate) => {
    const changed: unknown = mutate(descriptor());
    expect(verifyStorageCapabilityDescriptor(changed, { now: () => NOW })).toBe(false);
  });

  it('rejects a wrong pinned operator key, future issue time, and expiry boundary', () => {
    const signed = descriptor();
    expect(verifyStorageCapabilityDescriptor(signed, {
      now: () => NOW,
      expectedOperatorKey: storageOperatorPublicKeyFromPrivateKey(OTHER_SEED),
    })).toBe(false);
    expect(verifyStorageCapabilityDescriptor(signed, {
      now: () => '2026-07-14T15:54:59.999Z',
    })).toBe(false);
    expect(verifyStorageCapabilityDescriptor(signed, {
      now: () => signed.expiresAt,
    })).toBe(false);
  });

  it('requires HTTPS unless a private-network HTTP exception is explicit', () => {
    const local = descriptor({ endpoint: 'http://192.168.1.4/api/storage/v1' });
    expect(verifyStorageCapabilityDescriptor(local, { now: () => NOW })).toBe(false);
    expect(verifyStorageCapabilityDescriptor(local, {
      now: () => NOW,
      allowInsecureLocalNetwork: true,
    })).toBe(true);

    expect(() => descriptor({ endpoint: 'http://storage.example.test/api/storage/v1' }))
      .toThrow(/invalid/i);
  });

  it('refuses to sign when the advertised operator key differs from the private key', () => {
    expect(() => signStorageCapabilityDescriptor(
      unsignedDescriptor({ operatorKey: storageOperatorPublicKeyFromPrivateKey(OTHER_SEED) }),
      OPERATOR_SEED,
    )).toThrow(/does not match/i);
  });
});

describe('storage operator challenge', () => {
  it('binds a short-lived response to nonce, endpoint, and descriptor operator', () => {
    const signedDescriptor = descriptor();
    const nonce = 'ab'.repeat(32);
    const response = signStorageChallengeResponse({
      version: 1,
      authDomain: STORAGE_AUTH_DOMAIN,
      endpoint: signedDescriptor.endpoint,
      operatorKey: signedDescriptor.operatorKey,
      nonce,
      issuedAt: '2026-07-14T15:59:59.000Z',
      expiresAt: '2026-07-14T16:00:29.000Z',
    }, OPERATOR_SEED);

    expect(verifyStorageChallengeResponse(response, signedDescriptor, nonce, { now: () => NOW })).toBe(true);
    expect(verifyStorageChallengeResponse(response, signedDescriptor, 'cd'.repeat(32), { now: () => NOW }))
      .toBe(false);
    expect(verifyStorageChallengeResponse({ ...response, endpoint: 'https://other.example.test/api/storage/v1' }, signedDescriptor, nonce, {
      now: () => NOW,
    })).toBe(false);
    expect(verifyStorageChallengeResponse(
      response,
      { ...signedDescriptor, quotaBytes: 1 },
      nonce,
      { now: () => NOW },
    )).toBe(false);
    expect(verifyStorageChallengeResponse(response, signedDescriptor, nonce, {
      now: () => response.expiresAt,
    })).toBe(false);
  });

  it('creates a 32-byte nonce and rejects a short random source', () => {
    expect(createStorageChallengeNonce(() => new Uint8Array(32).fill(7))).toBe('07'.repeat(32));
    expect(() => createStorageChallengeNonce(() => new Uint8Array(31))).toThrow(/invalid length/i);
  });
});
