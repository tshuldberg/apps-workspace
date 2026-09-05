/**
 * MK-020 -- recovery key + encrypted identity export. The printed key round-
 * trips with a checksum; the export decrypts only with the right key and
 * recovers the exact private keys (so the same deviceId is restored); a wrong
 * or tampered blob fails closed.
 */

import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity, extractSigningPrivateKeyHex, extractDhPrivateKeyHex } from '../identity/device-identity';
import {
  generateRecoveryKey,
  encodeRecoveryKey,
  parseRecoveryKey,
  exportRecoverableIdentity,
  sealRecovery,
  openRecovery,
  isRecoverableIdentityConsistent,
  restoreIdentityFromRecovery,
  openAndRestore,
} from '../node/recovery-key';

describe('recovery key encoding (MK-020)', () => {
  it('generates a printable MKR1 key that round-trips through parse', () => {
    const { key, bytes } = generateRecoveryKey();
    expect(key.startsWith('MKR1-')).toBe(true);
    expect(bytes).toHaveLength(32);
    expect(parseRecoveryKey(key)).toEqual(bytes);
  });

  it('is tolerant of spaces, lowercase, and missing dashes', () => {
    const { key, bytes } = generateRecoveryKey();
    const messy = key.toLowerCase().replace(/-/g, ' ');
    expect(parseRecoveryKey(messy)).toEqual(bytes);
  });

  it('rejects a key whose checksum does not match (a typo)', () => {
    const bytes = new Uint8Array(32).fill(7);
    const key = encodeRecoveryKey(bytes);
    // Flip one character in the payload region.
    const broken = key.slice(0, 6) + (key[6] === 'A' ? 'B' : 'A') + key.slice(7);
    expect(parseRecoveryKey(broken)).toBeNull();
  });

  it('rejects malformed strings', () => {
    expect(parseRecoveryKey('not a key')).toBeNull();
    expect(parseRecoveryKey('MKR1-')).toBeNull();
  });
});

describe('identity export seal/open (MK-020)', () => {
  it('recovers the exact identity keys with the right recovery key', () => {
    const identity = generateDeviceIdentity('Alice');
    const { bytes } = generateRecoveryKey();

    const sealed = sealRecovery(exportRecoverableIdentity(identity), bytes);
    const restored = openRecovery(sealed, bytes);

    expect(restored).not.toBeNull();
    expect(restored!.publicKey).toBe(identity.publicKey); // same deviceId restored
    expect(restored!.dhPublicKey).toBe(identity.dhPublicKey);
    expect(restored!.signingPrivateKeyHex).toBe(extractSigningPrivateKeyHex(identity.privateKeyRef));
    expect(restored!.dhPrivateKeyHex).toBe(extractDhPrivateKeyHex(identity.privateKeyRef));
  });

  it('returns null for the wrong recovery key', () => {
    const identity = generateDeviceIdentity('Alice');
    const sealed = sealRecovery(exportRecoverableIdentity(identity), generateRecoveryKey().bytes);
    expect(openRecovery(sealed, generateRecoveryKey().bytes)).toBeNull();
  });

  it('fails closed on a tampered ciphertext', () => {
    const identity = generateDeviceIdentity('Alice');
    const { bytes } = generateRecoveryKey();
    const sealed = sealRecovery(exportRecoverableIdentity(identity), bytes);
    const tampered = sealed.slice(0, -4) + (sealed.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    expect(openRecovery(tampered, bytes)).toBeNull();
  });

  it('the ciphertext does not leak the private key in the clear', () => {
    const identity = generateDeviceIdentity('Alice');
    const sealed = sealRecovery(exportRecoverableIdentity(identity), generateRecoveryKey().bytes);
    expect(sealed).not.toContain(extractSigningPrivateKeyHex(identity.privateKeyRef));
  });
});

describe('recovery restore engine helpers (Plan 23 / AM8)', () => {
  it('isRecoverableIdentityConsistent accepts a real export and rejects a tampered id', () => {
    const identity = generateDeviceIdentity('Alice');
    const recoverable = exportRecoverableIdentity(identity);
    expect(isRecoverableIdentityConsistent(recoverable)).toBe(true);

    // A hand-edited deviceId that the signing secret does not actually derive.
    const other = generateDeviceIdentity('Mallory');
    expect(isRecoverableIdentityConsistent({ ...recoverable, publicKey: other.publicKey })).toBe(false);
    expect(isRecoverableIdentityConsistent({ ...recoverable, dhPublicKey: other.dhPublicKey })).toBe(false);
    expect(isRecoverableIdentityConsistent({ ...recoverable, signingPrivateKeyHex: 'zz' })).toBe(false);
  });

  it('openAndRestore reconstitutes the SAME identity into the secret store', () => {
    const identity = generateDeviceIdentity('Alice');
    const { bytes } = generateRecoveryKey();
    const sealed = sealRecovery(exportRecoverableIdentity(identity), bytes);

    const restored = openAndRestore(sealed, bytes, '2026-07-06T00:00:00.000Z');
    expect(restored).not.toBeNull();
    // Same deviceId + dh key + name survive the wipe-and-restore.
    expect(restored!.publicKey).toBe(identity.publicKey);
    expect(restored!.dhPublicKey).toBe(identity.dhPublicKey);
    expect(restored!.displayName).toBe('Alice');
    // The reconstituted privateKeyRef resolves to the ORIGINAL private keys, so
    // the restored device can sign + derive shared secrets as its old self.
    expect(extractSigningPrivateKeyHex(restored!.privateKeyRef))
      .toBe(extractSigningPrivateKeyHex(identity.privateKeyRef));
    expect(extractDhPrivateKeyHex(restored!.privateKeyRef))
      .toBe(extractDhPrivateKeyHex(identity.privateKeyRef));
  });

  it('openAndRestore fails closed on a wrong key or tampered blob', () => {
    const identity = generateDeviceIdentity('Alice');
    const { bytes } = generateRecoveryKey();
    const sealed = sealRecovery(exportRecoverableIdentity(identity), bytes);

    expect(openAndRestore(sealed, generateRecoveryKey().bytes)).toBeNull();
    const tampered = sealed.slice(0, -4) + (sealed.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    expect(openAndRestore(tampered, bytes)).toBeNull();
  });

  it('restoreIdentityFromRecovery returns null for an inconsistent export (never a live identity)', () => {
    const identity = generateDeviceIdentity('Alice');
    const other = generateDeviceIdentity('Mallory');
    const forged = { ...exportRecoverableIdentity(identity), publicKey: other.publicKey };
    expect(restoreIdentityFromRecovery(forged)).toBeNull();
  });
});
