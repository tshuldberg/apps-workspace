import { describe, it, expect } from 'vitest';
import {
  generateDeviceIdentity,
  getDeviceId,
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
  getPublicKeyFingerprint,
} from '../identity/device-identity';
import {
  createPairingPayload,
  validatePairingCode,
  derivePairingSharedSecret,
  completePairing,
} from '../identity/pairing';
import { createRevocation } from '../identity/revocation';
import { bytesToHex } from '../encryption/keys';
import nacl from 'tweetnacl';

describe('device-identity', () => {
  it('generates a valid device identity with Ed25519 keys', () => {
    const identity = generateDeviceIdentity('Test Phone');

    // Public key should be 64 hex chars (32 bytes)
    expect(identity.publicKey).toMatch(/^[0-9a-f]{64}$/);

    // DH public key should be 64 hex chars (32 bytes)
    expect(identity.dhPublicKey).toMatch(/^[0-9a-f]{64}$/);

    // Private key ref should be opaque and must not contain raw key material
    expect(identity.privateKeyRef).toMatch(/^secure\.sync\.device\.[0-9a-f]{64}$/);

    // Display name preserved
    expect(identity.displayName).toBe('Test Phone');

    // Timestamp should be a valid ISO 8601 string
    expect(() => new Date(identity.createdAt)).not.toThrow();
    expect(new Date(identity.createdAt).toISOString()).toBe(identity.createdAt);
  });

  it('generates unique identities each time', () => {
    const a = generateDeviceIdentity('Device A');
    const b = generateDeviceIdentity('Device B');

    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.dhPublicKey).not.toBe(b.dhPublicKey);
    expect(a.privateKeyRef).not.toBe(b.privateKeyRef);
  });

  it('returns publicKey as device ID', () => {
    const identity = generateDeviceIdentity('Phone');
    expect(getDeviceId(identity)).toBe(identity.publicKey);
  });

  it('signs and verifies a message roundtrip', () => {
    const identity = generateDeviceIdentity('Signer');

    // Extract the raw private key from the placeholder ref
    const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);

    const message = new TextEncoder().encode('Hello, P2P sync!');
    const signature = signMessage(privateKeyHex, message);

    // Signature should be 64 bytes (128 hex chars)
    expect(signature.length).toBe(64);

    // Valid signature should verify
    expect(verifySignature(identity.publicKey, message, signature)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    const identity = generateDeviceIdentity('Signer');
    const other = generateDeviceIdentity('Impersonator');

    const privateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
    const message = new TextEncoder().encode('Authentic message');
    const signature = signMessage(privateKeyHex, message);

    // Wrong public key should fail
    expect(verifySignature(other.publicKey, message, signature)).toBe(false);

    // Tampered message should fail
    const tampered = new TextEncoder().encode('Tampered message');
    expect(verifySignature(identity.publicKey, tampered, signature)).toBe(false);

    // Corrupted signature should fail
    const badSig = new Uint8Array(signature);
    badSig[0] = (badSig[0]! + 1) % 256;
    expect(verifySignature(identity.publicKey, message, badSig)).toBe(false);
  });

  it('produces a deterministic fingerprint for the same key', () => {
    const identity = generateDeviceIdentity('Phone');

    const fp1 = getPublicKeyFingerprint(identity.publicKey);
    const fp2 = getPublicKeyFingerprint(identity.publicKey);

    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('produces different fingerprints for different keys', () => {
    const a = generateDeviceIdentity('A');
    const b = generateDeviceIdentity('B');

    expect(getPublicKeyFingerprint(a.publicKey)).not.toBe(
      getPublicKeyFingerprint(b.publicKey),
    );
  });
});

describe('pairing', () => {
  it('creates a valid pairing payload', () => {
    const identity = generateDeviceIdentity('My iPad');
    const { pairingData, pairingCode } = createPairingPayload(identity);

    expect(pairingData.publicKey).toBe(identity.publicKey);
    expect(pairingData.dhPublicKey).toBe(identity.dhPublicKey);
    expect(pairingData.displayName).toBe('My iPad');
    expect(pairingData.pairingNonce).toMatch(/^[0-9a-f]{32}$/); // 16 bytes hex

    expect(pairingCode).toMatch(/^\d{6}$/);
  });

  it('validates pairing codes correctly', () => {
    expect(validatePairingCode('123456')).toBe(true);
    expect(validatePairingCode('000000')).toBe(true);
    expect(validatePairingCode('999999')).toBe(true);

    expect(validatePairingCode('12345')).toBe(false);   // too short
    expect(validatePairingCode('1234567')).toBe(false);  // too long
    expect(validatePairingCode('abcdef')).toBe(false);   // not numeric
    expect(validatePairingCode('')).toBe(false);          // empty
    expect(validatePairingCode('12 456')).toBe(false);   // space
  });

  it('derives the same shared secret on both sides', () => {
    // Generate two independent DH keypairs
    const aliceKp = nacl.box.keyPair();
    const bobKp = nacl.box.keyPair();

    const alicePrivHex = bytesToHex(aliceKp.secretKey);
    const alicePubHex = bytesToHex(aliceKp.publicKey);
    const bobPrivHex = bytesToHex(bobKp.secretKey);
    const bobPubHex = bytesToHex(bobKp.publicKey);

    const secretAlice = derivePairingSharedSecret(alicePrivHex, bobPubHex);
    const secretBob = derivePairingSharedSecret(bobPrivHex, alicePubHex);

    // Both sides should derive the same 32-byte shared secret
    expect(secretAlice).toBe(secretBob);
    expect(secretAlice).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex
  });

  it('derives different secrets with different keypairs', () => {
    const kp1 = nacl.box.keyPair();
    const kp2 = nacl.box.keyPair();
    const kp3 = nacl.box.keyPair();

    const secret12 = derivePairingSharedSecret(
      bytesToHex(kp1.secretKey),
      bytesToHex(kp2.publicKey),
    );
    const secret13 = derivePairingSharedSecret(
      bytesToHex(kp1.secretKey),
      bytesToHex(kp3.publicKey),
    );

    expect(secret12).not.toBe(secret13);
  });

  it('completes pairing and produces a PairedDevice record', () => {
    const localIdentity = generateDeviceIdentity('Local Device');
    const remoteIdentity = generateDeviceIdentity('Remote Device');

    const { pairingData } = createPairingPayload(remoteIdentity);
    const pairedDevice = completePairing(localIdentity, pairingData);

    expect(pairedDevice.deviceId).toBe(remoteIdentity.publicKey);
    expect(pairedDevice.displayName).toBe('Remote Device');
    expect(pairedDevice.dhPublicKey).toBe(remoteIdentity.dhPublicKey);
    expect(pairedDevice.isActive).toBe(true);
    expect(pairedDevice.bytesSent).toBe(0);
    expect(pairedDevice.bytesReceived).toBe(0);
    expect(pairedDevice.lastSyncAt).toBeNull();
    expect(pairedDevice.lastSyncModule).toBeNull();
    expect(pairedDevice.sharedSecretRef).toMatch(/^secure\.sync\.shared\.[0-9a-f]{64}_[0-9a-f]{64}$/);
  });

  it('completePairing derives matching shared secrets on both devices', () => {
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');

    const alicePairedWithBob = completePairing(alice, createPairingPayload(bob).pairingData);
    const bobPairedWithAlice = completePairing(bob, createPairingPayload(alice).pairingData);

    expect(alicePairedWithBob.sharedSecretRef).toBe(bobPairedWithAlice.sharedSecretRef);
  });
});

describe('revocation', () => {
  it('creates a revocation record with correct fields', () => {
    const revoker = generateDeviceIdentity('Admin Phone');
    const targetId = generateDeviceIdentity('Lost Tablet').publicKey;

    const revocation = createRevocation(revoker, targetId, 'Device lost');

    expect(revocation.deviceId).toBe(targetId);
    expect(revocation.revokedByDeviceId).toBe(revoker.publicKey);
    expect(revocation.reason).toBe('Device lost');
    expect(() => new Date(revocation.revokedAt)).not.toThrow();
  });

  it('creates a revocation with null reason when none provided', () => {
    const revoker = generateDeviceIdentity('Phone');
    const targetId = 'deadbeef'.repeat(8); // 64 hex chars

    const revocation = createRevocation(revoker, targetId);

    expect(revocation.reason).toBeNull();
    expect(revocation.deviceId).toBe(targetId);
    expect(revocation.revokedByDeviceId).toBe(revoker.publicKey);
  });
});
