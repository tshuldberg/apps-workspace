/**
 * Recovery key + encrypted identity export (plan 14, MK-020; recovery v1).
 *
 * Device keys live in the OS keychain; wipe the phone and they are gone, and a
 * deviceId that nobody else holds is unrecoverable. Recovery v1 gives the user
 * one printable, high-entropy key that encrypts an export of their identity's
 * secret keys. Stash the ciphertext somewhere durable (a relay mailbox, a file,
 * a backup), keep the printed key offline, and a fresh install can restore the
 * SAME identity -- same deviceId, same pins, same pairings survive.
 *
 * The recovery key is the only secret: the export is useless without it, and the
 * relay (or any host of the ciphertext) learns nothing. Pure crypto, no I/O.
 *
 * Data-loss boundaries (v1, documented honestly):
 *  - Lose BOTH the printed key and every other device and there is no recovery;
 *    the key is the root of trust, by design (no server escrow).
 *  - This restores the IDENTITY (keys), not module data. Synced data re-flows
 *    from peers after the restored identity re-pairs; device-local-only data
 *    that never left the wiped device is gone.
 *  - A leaked recovery key is a full account compromise: treat it like a seed
 *    phrase. Rotation after a suspected leak is future work (MK-020 v2).
 */

import nacl from 'tweetnacl';
import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  extractDhPrivateKeyHex,
} from '../identity/device-identity';
import { storeDeviceIdentitySecrets } from '../secrets/sync-secret-store';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { encryptString, decryptString } from '../encryption/encrypt';
import { hkdf } from './hkdf';

// Crockford base32 (no I/L/O/U), shared with friend codes' transcription rules.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DECODE: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) m[ALPHABET[i]!] = i;
  m['I'] = 1; m['L'] = 1; m['O'] = 0; m['U'] = m['V']!;
  return m;
})();

const KEY_BYTES = 32; // 256 bits of recovery entropy
const CHECKSUM_BYTES = 2;
const RECOVERY_INFO = 'meerkat-recovery-v1';
const PREFIX = 'MKR1';

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function decodeBase32(text: string, expectedBytes: number): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out = new Uint8Array(expectedBytes);
  let i = 0;
  for (const ch of text) {
    const v = DECODE[ch];
    if (v === undefined) return null;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      if (i >= expectedBytes) return null;
      out[i++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return i === expectedBytes ? out : null;
}

const checksum = (bytes: Uint8Array): Uint8Array => nacl.hash(bytes).slice(0, CHECKSUM_BYTES);

function group(s: string): string {
  return s.match(/.{1,5}/g)?.join('-') ?? s;
}

/** Format 32 recovery bytes as a printable, checksummed, grouped key string. */
export function encodeRecoveryKey(bytes: Uint8Array): string {
  if (bytes.length !== KEY_BYTES) throw new Error(`recovery key must be ${KEY_BYTES} bytes`);
  const payload = new Uint8Array(KEY_BYTES + CHECKSUM_BYTES);
  payload.set(bytes, 0);
  payload.set(checksum(bytes), KEY_BYTES);
  return `${PREFIX}-${group(encodeBase32(payload))}`;
}

/** Generate a fresh recovery key: 256 random bits + its printable form. */
export function generateRecoveryKey(): { key: string; bytes: Uint8Array } {
  const bytes = nacl.randomBytes(KEY_BYTES);
  return { key: encodeRecoveryKey(bytes), bytes };
}

/** Parse + checksum-validate a printed recovery key. Null if malformed. */
export function parseRecoveryKey(key: string): Uint8Array | null {
  const cleaned = key.toUpperCase().replace(/^MKR1-?/i, '').replace(/[-\s]/g, '');
  const payload = decodeBase32(cleaned, KEY_BYTES + CHECKSUM_BYTES);
  if (!payload) return null;
  const bytes = payload.slice(0, KEY_BYTES);
  const expected = checksum(bytes);
  for (let i = 0; i < CHECKSUM_BYTES; i++) {
    if (payload[KEY_BYTES + i] !== expected[i]) return null;
  }
  return bytes;
}

/** The identity material an export carries -- enough to reconstitute the device. */
export interface RecoverableIdentity {
  version: 1;
  publicKey: string;
  dhPublicKey: string;
  displayName: string;
  signingPrivateKeyHex: string;
  dhPrivateKeyHex: string;
}

/** Build the recoverable export from a device identity (reads its secret keys). */
export function exportRecoverableIdentity(identity: DeviceIdentity): RecoverableIdentity {
  const signingPrivateKeyHex = extractSigningPrivateKeyHex(identity.privateKeyRef);
  const dhPrivateKeyHex = extractDhPrivateKeyHex(identity.privateKeyRef);
  if (!dhPrivateKeyHex) throw new Error('Cannot export a recovery bundle without a DH private key.');
  return {
    version: 1,
    publicKey: identity.publicKey,
    dhPublicKey: identity.dhPublicKey,
    displayName: identity.displayName,
    signingPrivateKeyHex,
    dhPrivateKeyHex,
  };
}

/** Encrypt an identity export under the recovery key. Output is opaque base64. */
export function sealRecovery(recoverable: RecoverableIdentity, recoveryBytes: Uint8Array): string {
  const key = hkdf(recoveryBytes, RECOVERY_INFO);
  return encryptString(JSON.stringify(recoverable), key);
}

/**
 * Decrypt an identity export with the recovery key. Returns null if the key is
 * wrong or the ciphertext is corrupt/tampered (secretbox auth fails closed).
 */
export function openRecovery(sealed: string, recoveryBytes: Uint8Array): RecoverableIdentity | null {
  const key = hkdf(recoveryBytes, RECOVERY_INFO);
  const json = decryptString(sealed, key);
  if (json === null) return null;
  try {
    const parsed = JSON.parse(json) as RecoverableIdentity;
    if (
      parsed.version === 1
      && typeof parsed.publicKey === 'string'
      && typeof parsed.dhPublicKey === 'string'
      && typeof parsed.signingPrivateKeyHex === 'string'
      && typeof parsed.dhPrivateKeyHex === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Restore helpers (Plan 23 A-engine; AM8). PURE crypto reconstitution only:
// the app owns the orchestration around them (write mk_identity, flush the
// secure-store, set friend-code state, then boot the engine). These never
// touch the app DB, secure-store adapter selection, or engine lifecycle.
// ---------------------------------------------------------------------------

/**
 * Does a decrypted export's private key material actually derive its claimed
 * public keys? A recovery blob is only as trustworthy as the recovery key that
 * opened it, but a corrupt or hand-edited export could still carry a signing
 * secret whose real public key is NOT the claimed deviceId. Restoring that
 * would strand the device under an id it can neither sign for nor be dialed at.
 * Verify both keypairs (Ed25519 signing, X25519 DH) before trusting the export
 * as an identity. Pure, no I/O; fail-closed on any malformed field.
 */
export function isRecoverableIdentityConsistent(recoverable: RecoverableIdentity): boolean {
  try {
    const signingSecret = hexToBytes(recoverable.signingPrivateKeyHex);
    if (signingSecret.length !== nacl.sign.secretKeyLength) return false;
    if (bytesToHex(nacl.sign.keyPair.fromSecretKey(signingSecret).publicKey) !== recoverable.publicKey) {
      return false;
    }
    const dhSecret = hexToBytes(recoverable.dhPrivateKeyHex);
    if (dhSecret.length !== nacl.box.secretKeyLength) return false;
    if (bytesToHex(nacl.box.keyPair.fromSecretKey(dhSecret).publicKey) !== recoverable.dhPublicKey) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Reconstitute a DeviceIdentity from a verified export: stash its private keys
 * in the configured sync secret store (the same seam generateDeviceIdentity
 * uses) and return the identity with the resulting opaque privateKeyRef -- the
 * SAME deviceId, dhPublicKey, and display name. Returns null if the export is
 * inconsistent (its keys do not derive its claimed ids), so a bad blob never
 * becomes a live identity. The caller supplies `now` for the restored
 * createdAt (the export carries no timestamp); it is cosmetic, not identity.
 */
export function restoreIdentityFromRecovery(
  recoverable: RecoverableIdentity,
  now: string = new Date().toISOString(),
): DeviceIdentity | null {
  if (!isRecoverableIdentityConsistent(recoverable)) return null;
  const privateKeyRef = storeDeviceIdentitySecrets(recoverable.publicKey, {
    ed25519PrivateKeyHex: recoverable.signingPrivateKeyHex,
    x25519PrivateKeyHex: recoverable.dhPrivateKeyHex,
  });
  return {
    publicKey: recoverable.publicKey,
    privateKeyRef,
    dhPublicKey: recoverable.dhPublicKey,
    displayName: recoverable.displayName,
    createdAt: now,
  };
}

/**
 * The one-call restore seam an app boot flow drives: decrypt the sealed export
 * with the recovery key, verify keypair consistency, and reconstitute the
 * DeviceIdentity into the secret store. Returns null on a wrong key, a
 * tampered/corrupt blob, or an inconsistent export -- fail-closed, never a
 * partial identity. The app still owns the rest of the flow (persist
 * mk_identity, flush, friend-code state, boot the engine).
 */
export function openAndRestore(
  sealed: string,
  recoveryBytes: Uint8Array,
  now: string = new Date().toISOString(),
): DeviceIdentity | null {
  const recoverable = openRecovery(sealed, recoveryBytes);
  if (!recoverable) return null;
  return restoreIdentityFromRecovery(recoverable, now);
}
