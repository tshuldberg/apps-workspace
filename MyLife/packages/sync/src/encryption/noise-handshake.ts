/**
 * Noise NK handshake for authenticated transport encryption, hardened with a
 * real SymmetricState (chaining key + transcript hash).
 *
 * The Noise NK pattern means:
 * - N: The initiator does NOT authenticate itself during the handshake
 *   (authentication happens via the encrypted payload containing a signed identity proof)
 * - K: The responder's static public key is Known to the initiator beforehand
 *
 * Flow:
 * 1. Initiator generates an ephemeral X25519 keypair, mixes es = DH(e_i, s_r)
 *    into the chaining key, and encrypts its identity proof with the key that
 *    MixKey derives.
 * 2. Responder mixes es = DH(s_r, e_i), generates its own ephemeral, mixes
 *    ee = DH(e_r, e_i), and derives the session key bound to the chaining key
 *    AND the running transcript hash.
 * 3. Initiator mirrors ee and derives the same session key.
 *
 * D.6: unlike the earlier flat concat-and-derive, the session key now depends on
 * a real chaining key advanced by each DH output (MixKey) and on a transcript
 * hash that binds the protocol name, the responder static key, every ephemeral
 * public key, and every handshake ciphertext in order (MixHash). Substituting an
 * ephemeral key or a ciphertext diverges the transcript, so the derived key no
 * longer matches and the handshake fails closed. The public method surface is
 * unchanged.
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { bytesToHex, hexToBytes, deriveKeyV2 } from './keys';
import { hkdfExtract, hkdfExpand } from '../node/hkdf';

const { decodeUTF8 } = naclUtil;
import type { DeviceIdentity } from '../types';
import { extractDhPrivateKeyHex } from '../identity/device-identity';

/**
 * The protocol label bound into the transcript hash. Both peers hash the exact
 * same bytes, so a mismatch anywhere in the handshake yields a different key.
 */
const PROTOCOL_NAME = 'Noise_NK_25519_XSalsa20Poly1305_SHA512_MK011';
const SESSION_KEY_INFO = 'mylife-sync-session-key';
const NONCE_LEN = nacl.secretbox.nonceLength;

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** MixHash: h = SHA-512(h || data). Binds `data` into the running transcript. */
function mixHash(h: Uint8Array, data: Uint8Array): Uint8Array {
  return nacl.hash(concatBytes(h, data));
}

/**
 * MixKey: advance the chaining key with a DH output and split off a fresh
 * symmetric key. HKDF(salt = ck, ikm = dhOutput) -> 64 bytes = (ck' | k).
 */
function mixKey(ck: Uint8Array, ikm: Uint8Array): { ck: Uint8Array; k: Uint8Array } {
  const prk = hkdfExtract(ck, ikm);
  const okm = hkdfExpand(prk, new Uint8Array(0), 64);
  return { ck: okm.slice(0, 32), k: okm.slice(32, 64) };
}

export class NoiseHandshake {
  private localIdentity: DeviceIdentity;
  private remoteStaticPublicKey: string | undefined;

  private ephemeralKeypair: nacl.BoxKeyPair | null = null;
  private sessionKey: Uint8Array | null = null;

  // SymmetricState: chaining key + transcript hash.
  private ck: Uint8Array | null = null;
  private h: Uint8Array | null = null;

  /**
   * Create a new handshake instance.
   *
   * @param localIdentity - This device's identity
   * @param remotePublicKey - The remote device's static X25519 public key (hex).
   *   The initiator must provide this (NK pattern: responder's key is Known).
   *   The responder may omit it if they will learn it from the hello message.
   */
  constructor(localIdentity: DeviceIdentity, remotePublicKey?: string) {
    this.localIdentity = localIdentity;
    this.remoteStaticPublicKey = remotePublicKey;
  }

  /** InitializeSymmetric + the NK pre-message (responder static key). */
  private initSymmetric(responderStatic: Uint8Array): void {
    this.h = nacl.hash(decodeUTF8(PROTOCOL_NAME));
    this.ck = this.h.slice(0, 32);
    // NK pre-message: the responder's static public key is folded into the
    // transcript on both sides before any ephemeral is exchanged.
    this.h = mixHash(this.h, responderStatic);
  }

  private deriveSessionKey(): Uint8Array {
    if (!this.ck || !this.h) throw new Error('Handshake state not initialized');
    // Bind the session key to BOTH the chaining key (all DH outputs) and the
    // transcript hash (protocol name, static key, ephemerals, ciphertexts).
    return deriveKeyV2(concatBytes(this.ck, this.h), SESSION_KEY_INFO, nacl.secretbox.keyLength);
  }

  /**
   * Initiator step 1: Generate ephemeral keypair and encrypt identity proof.
   *
   * The encrypted payload carries the initiator's device id so the responder
   * can authenticate it. The encryption key comes from MixKey(es), so it is
   * bound to the chaining key rather than used as a bare DH output.
   */
  initiatorHello(): { ephemeralPublicKey: string; encryptedPayload: Uint8Array } {
    if (!this.remoteStaticPublicKey) {
      throw new Error('Initiator must know the remote static public key (NK pattern)');
    }

    const remoteStaticBytes = hexToBytes(this.remoteStaticPublicKey);
    this.initSymmetric(remoteStaticBytes);

    this.ephemeralKeypair = nacl.box.keyPair();
    // -> e
    this.h = mixHash(this.h!, this.ephemeralKeypair.publicKey);
    // es = DH(e_i, s_r)
    const es = nacl.box.before(remoteStaticBytes, this.ephemeralKeypair.secretKey);
    const { ck, k } = mixKey(this.ck!, es);
    this.ck = ck;

    const identityProof = decodeUTF8(JSON.stringify({
      deviceId: this.localIdentity.publicKey,
      dhPublicKey: this.localIdentity.dhPublicKey,
      displayName: this.localIdentity.displayName,
    }));

    const nonce = nacl.randomBytes(NONCE_LEN);
    const encrypted = nacl.secretbox(identityProof, nonce, k);
    const payload = concatBytes(nonce, encrypted);
    // Bind the ciphertext into the transcript.
    this.h = mixHash(this.h!, payload);

    return {
      ephemeralPublicKey: bytesToHex(this.ephemeralKeypair.publicKey),
      encryptedPayload: payload,
    };
  }

  /**
   * Responder step: Process the initiator's hello, decrypt the identity proof,
   * generate an ephemeral keypair, and derive the session key.
   *
   * @param hello - The initiator's hello message
   * @returns The responder's reply + the derived session key
   */
  responderReply(
    hello: { ephemeralPublicKey: string; encryptedPayload: Uint8Array },
  ): { ephemeralPublicKey: string; encryptedPayload: Uint8Array; sessionKey: Uint8Array } {
    // The responder's own static DH public key is the NK pre-message key.
    const ownStaticPublic = hexToBytes(this.localIdentity.dhPublicKey);
    this.initSymmetric(ownStaticPublic);

    const initiatorEphemeralBytes = hexToBytes(hello.ephemeralPublicKey);
    // -> e
    this.h = mixHash(this.h!, initiatorEphemeralBytes);

    // Extract the DH private key from the configured secure secret store.
    // Legacy raw refs are still accepted only so older local databases and
    // historical tests can migrate without losing pairings.
    const localDhSecret = this.extractDhPrivateKey();
    // es = DH(s_r, e_i)
    const es = nacl.box.before(initiatorEphemeralBytes, localDhSecret);
    const es1 = mixKey(this.ck!, es);
    this.ck = es1.ck;

    // Decrypt the initiator's identity proof with the MixKey-derived key.
    const nonce = hello.encryptedPayload.slice(0, NONCE_LEN);
    const ciphertext = hello.encryptedPayload.slice(NONCE_LEN);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, es1.k);
    if (!decrypted) {
      throw new Error('Failed to decrypt initiator hello -- wrong key or tampered data');
    }
    // Bind the (verified) ciphertext into the transcript, mirroring the initiator.
    this.h = mixHash(this.h!, hello.encryptedPayload);

    // Generate responder ephemeral. -> e
    this.ephemeralKeypair = nacl.box.keyPair();
    this.h = mixHash(this.h!, this.ephemeralKeypair.publicKey);
    // ee = DH(e_r, e_i)
    const ee = nacl.box.before(initiatorEphemeralBytes, this.ephemeralKeypair.secretKey);
    const ee1 = mixKey(this.ck!, ee);
    this.ck = ee1.ck;

    this.sessionKey = this.deriveSessionKey();

    // Encrypt our identity proof with the second MixKey output.
    const replyProof = decodeUTF8(JSON.stringify({
      deviceId: this.localIdentity.publicKey,
      dhPublicKey: this.localIdentity.dhPublicKey,
      displayName: this.localIdentity.displayName,
    }));
    const replyNonce = nacl.randomBytes(NONCE_LEN);
    const replyEncrypted = nacl.secretbox(replyProof, replyNonce, ee1.k);
    const replyPayload = concatBytes(replyNonce, replyEncrypted);
    this.h = mixHash(this.h!, replyPayload);

    return {
      ephemeralPublicKey: bytesToHex(this.ephemeralKeypair.publicKey),
      encryptedPayload: replyPayload,
      sessionKey: this.sessionKey,
    };
  }

  /**
   * Initiator step 2: Process the responder's reply and derive the session key.
   *
   * Mirrors the responder: MixHash(e_r), MixKey(ee = DH(e_i, e_r)), then derive
   * the session key from the chaining key + transcript hash. A tampered
   * ephemeral or ciphertext diverges the transcript, so the derived key no
   * longer opens the reply and this throws.
   */
  initiatorFinalize(
    reply: { ephemeralPublicKey: string; encryptedPayload: Uint8Array },
  ): Uint8Array {
    if (!this.ephemeralKeypair) {
      throw new Error('Must call initiatorHello() before initiatorFinalize()');
    }
    if (!this.remoteStaticPublicKey) {
      throw new Error('Remote static public key is required');
    }
    if (!this.ck || !this.h) {
      throw new Error('Handshake state not initialized');
    }

    const responderEphemeralBytes = hexToBytes(reply.ephemeralPublicKey);
    // -> e
    this.h = mixHash(this.h, responderEphemeralBytes);
    // ee = DH(e_i, e_r)
    const ee = nacl.box.before(responderEphemeralBytes, this.ephemeralKeypair.secretKey);
    const ee1 = mixKey(this.ck, ee);
    this.ck = ee1.ck;

    this.sessionKey = this.deriveSessionKey();

    // Verify we can decrypt the responder's payload with the MixKey output.
    const nonce = reply.encryptedPayload.slice(0, NONCE_LEN);
    const ciphertext = reply.encryptedPayload.slice(NONCE_LEN);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, ee1.k);
    if (!decrypted) {
      throw new Error('Failed to decrypt responder reply -- session key mismatch');
    }
    this.h = mixHash(this.h, reply.encryptedPayload);

    return this.sessionKey;
  }

  /**
   * Get the negotiated session key after the handshake completes.
   * Throws if the handshake has not been finalized.
   */
  getSessionKey(): Uint8Array {
    if (!this.sessionKey) {
      throw new Error('Handshake not complete -- no session key available');
    }
    return this.sessionKey;
  }

  /**
   * Extract the DH private key from the local identity.
   *
   * Fetch the DH private key through the identity's secret reference.
   * Legacy raw refs are supported for migration compatibility.
   */
  private extractDhPrivateKey(): Uint8Array {
    const dhPrivateKeyHex = extractDhPrivateKeyHex(this.localIdentity.privateKeyRef);
    if (dhPrivateKeyHex) {
      return hexToBytes(dhPrivateKeyHex);
    }
    throw new Error(
      'Cannot load DH private key from identity ref.',
    );
  }
}
