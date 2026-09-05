import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import {
  hexToBytes,
  bytesToHex,
  deriveKey,
  generateNonce,
  generateSessionKey,
} from '../encryption/keys';
import {
  encrypt,
  decrypt,
  encryptString,
  decryptString,
} from '../encryption/encrypt';
import { NoiseHandshake } from '../encryption/noise-handshake';
import type { DeviceIdentity } from '../types';

// ---------------------------------------------------------------------------
// Helper: create a DeviceIdentity with known DH keys for handshake tests
// ---------------------------------------------------------------------------

function createTestIdentity(name: string): {
  identity: DeviceIdentity;
  dhSecretKey: Uint8Array;
} {
  const signingKp = nacl.sign.keyPair();
  const dhKp = nacl.box.keyPair();

  // Store the DH secret in the privateKeyRef for the handshake to extract.
  // The NoiseHandshake.extractDhPrivateKey reads the first 32 bytes of the
  // hex after "local:ed25519:". We pack the DH secret there so the test
  // handshake can derive the correct shared key.
  const dhSecretHex = bytesToHex(dhKp.secretKey);
  // Pad to at least 64 hex chars (32 bytes) as the extractor expects
  const privateKeyRef = `local:ed25519:${dhSecretHex}${'0'.repeat(Math.max(0, 64 - dhSecretHex.length))}`;

  return {
    identity: {
      publicKey: bytesToHex(signingKp.publicKey),
      privateKeyRef,
      dhPublicKey: bytesToHex(dhKp.publicKey),
      displayName: name,
      createdAt: new Date().toISOString(),
    },
    dhSecretKey: dhKp.secretKey,
  };
}

// ---------------------------------------------------------------------------
// Hex encoding
// ---------------------------------------------------------------------------

describe('hex encoding', () => {
  it('roundtrips bytes through hex', () => {
    const original = nacl.randomBytes(32);
    const hex = bytesToHex(original);
    const decoded = hexToBytes(hex);

    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(decoded).toEqual(original);
  });

  it('handles empty array', () => {
    expect(bytesToHex(new Uint8Array(0))).toBe('');
    expect(hexToBytes('')).toEqual(new Uint8Array(0));
  });

  it('handles known values', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255, 128]))).toBe('0001ff80');
    expect(hexToBytes('0001ff80')).toEqual(new Uint8Array([0, 1, 255, 128]));
  });

  it('throws on odd-length hex', () => {
    expect(() => hexToBytes('abc')).toThrow('even length');
  });

  it('throws on invalid hex characters', () => {
    expect(() => hexToBytes('zzzz')).toThrow('Invalid hex');
  });
});

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

describe('deriveKey', () => {
  it('produces deterministic output for same inputs', () => {
    const secret = nacl.randomBytes(32);

    const key1 = deriveKey(secret, 'session-key');
    const key2 = deriveKey(secret, 'session-key');

    expect(key1).toEqual(key2);
  });

  it('produces different output for different info strings', () => {
    const secret = nacl.randomBytes(32);

    const keyA = deriveKey(secret, 'encryption-key');
    const keyB = deriveKey(secret, 'auth-key');

    expect(keyA).not.toEqual(keyB);
  });

  it('produces different output for different secrets', () => {
    const secretA = nacl.randomBytes(32);
    const secretB = nacl.randomBytes(32);

    const keyA = deriveKey(secretA, 'same-info');
    const keyB = deriveKey(secretB, 'same-info');

    expect(keyA).not.toEqual(keyB);
  });

  it('defaults to 32-byte output', () => {
    const key = deriveKey(nacl.randomBytes(32), 'test');
    expect(key.length).toBe(32);
  });

  it('respects custom length parameter', () => {
    const key16 = deriveKey(nacl.randomBytes(32), 'test', 16);
    const key48 = deriveKey(nacl.randomBytes(32), 'test', 48);

    expect(key16.length).toBe(16);
    expect(key48.length).toBe(48);
  });
});

// ---------------------------------------------------------------------------
// Random generation
// ---------------------------------------------------------------------------

describe('generateNonce', () => {
  it('produces 24-byte nonces', () => {
    const nonce = generateNonce();
    expect(nonce.length).toBe(24);
  });

  it('produces unique values on each call', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nonces.add(bytesToHex(generateNonce()));
    }
    // Collisions in 100 random 24-byte values are astronomically unlikely
    expect(nonces.size).toBe(100);
  });
});

describe('generateSessionKey', () => {
  it('produces 32-byte keys', () => {
    const key = generateSessionKey();
    expect(key.length).toBe(32);
  });

  it('produces unique keys', () => {
    const a = generateSessionKey();
    const b = generateSessionKey();
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });
});

// ---------------------------------------------------------------------------
// Symmetric encryption
// ---------------------------------------------------------------------------

describe('encrypt / decrypt', () => {
  it('roundtrips with a random key', () => {
    const key = generateSessionKey();
    const plaintext = new TextEncoder().encode('P2P sync data payload');

    const { ciphertext, nonce } = encrypt(plaintext, key);
    const result = decrypt(ciphertext, nonce, key);

    expect(result).not.toBeNull();
    expect(result).toEqual(plaintext);
  });

  it('returns null when decrypting with the wrong key', () => {
    const key = generateSessionKey();
    const wrongKey = generateSessionKey();
    const plaintext = new TextEncoder().encode('Secret data');

    const { ciphertext, nonce } = encrypt(plaintext, key);
    const result = decrypt(ciphertext, nonce, wrongKey);

    expect(result).toBeNull();
  });

  it('returns null when ciphertext is tampered', () => {
    const key = generateSessionKey();
    const plaintext = new TextEncoder().encode('Integrity check');

    const { ciphertext, nonce } = encrypt(plaintext, key);

    // Flip a byte in the ciphertext
    const tampered = new Uint8Array(ciphertext);
    tampered[0] = (tampered[0]! + 1) % 256;

    expect(decrypt(tampered, nonce, key)).toBeNull();
  });

  it('returns null when nonce is wrong', () => {
    const key = generateSessionKey();
    const plaintext = new TextEncoder().encode('Nonce check');

    const { ciphertext } = encrypt(plaintext, key);
    const wrongNonce = generateNonce();

    expect(decrypt(ciphertext, wrongNonce, key)).toBeNull();
  });

  it('handles empty plaintext', () => {
    const key = generateSessionKey();
    const plaintext = new Uint8Array(0);

    const { ciphertext, nonce } = encrypt(plaintext, key);
    const result = decrypt(ciphertext, nonce, key);

    expect(result).toEqual(plaintext);
  });
});

// ---------------------------------------------------------------------------
// String encryption
// ---------------------------------------------------------------------------

describe('encryptString / decryptString', () => {
  it('roundtrips a UTF-8 string', () => {
    const key = generateSessionKey();
    const text = 'Hello, encrypted world!';

    const encrypted = encryptString(text, key);
    const decrypted = decryptString(encrypted, key);

    expect(decrypted).toBe(text);
  });

  it('handles unicode characters', () => {
    const key = generateSessionKey();
    const text = 'Emoji test: \u{1F30A}\u{1F3C4}\u2728 and CJK: \u4F60\u597D';

    const encrypted = encryptString(text, key);
    const decrypted = decryptString(encrypted, key);

    expect(decrypted).toBe(text);
  });

  it('returns null with wrong key', () => {
    const key = generateSessionKey();
    const wrongKey = generateSessionKey();

    const encrypted = encryptString('secret', key);
    expect(decryptString(encrypted, wrongKey)).toBeNull();
  });

  it('returns null for malformed input', () => {
    const key = generateSessionKey();

    expect(decryptString('not-valid-base64', key)).toBeNull();
    expect(decryptString('', key)).toBeNull();
  });

  it('produces base64-encoded output with dot separator', () => {
    const key = generateSessionKey();
    const encrypted = encryptString('test', key);

    // Format: base64(nonce).base64(ciphertext)
    expect(encrypted).toContain('.');
    const parts = encrypted.split('.');
    expect(parts.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Noise NK handshake
// ---------------------------------------------------------------------------

describe('NoiseHandshake', () => {
  it('initiator and responder derive the same session key', () => {
    const { identity: initiatorId } = createTestIdentity('Initiator');
    const { identity: responderId } = createTestIdentity('Responder');

    // Initiator knows the responder's DH public key
    const initiatorHandshake = new NoiseHandshake(initiatorId, responderId.dhPublicKey);
    const responderHandshake = new NoiseHandshake(responderId);

    // Step 1: Initiator sends hello
    const hello = initiatorHandshake.initiatorHello();

    // Step 2: Responder processes hello and sends reply
    const reply = responderHandshake.responderReply(hello);

    // Step 3: Initiator finalizes
    const initiatorSessionKey = initiatorHandshake.initiatorFinalize(reply);
    const responderSessionKey = reply.sessionKey;

    // Both should have derived the same session key
    expect(bytesToHex(initiatorSessionKey)).toBe(bytesToHex(responderSessionKey));
    expect(initiatorSessionKey.length).toBe(32);
  });

  it('session keys differ for different identity pairs', () => {
    const { identity: a1 } = createTestIdentity('A1');
    const { identity: b1 } = createTestIdentity('B1');
    const { identity: a2 } = createTestIdentity('A2');
    const { identity: b2 } = createTestIdentity('B2');

    // First handshake
    const hs1i = new NoiseHandshake(a1, b1.dhPublicKey);
    const hs1r = new NoiseHandshake(b1);
    const hello1 = hs1i.initiatorHello();
    const reply1 = hs1r.responderReply(hello1);
    const key1 = hs1i.initiatorFinalize(reply1);

    // Second handshake with different identities
    const hs2i = new NoiseHandshake(a2, b2.dhPublicKey);
    const hs2r = new NoiseHandshake(b2);
    const hello2 = hs2i.initiatorHello();
    const reply2 = hs2r.responderReply(hello2);
    const key2 = hs2i.initiatorFinalize(reply2);

    expect(bytesToHex(key1)).not.toBe(bytesToHex(key2));
  });

  it('getSessionKey() throws before handshake is complete', () => {
    const { identity } = createTestIdentity('Device');
    const hs = new NoiseHandshake(identity, bytesToHex(nacl.randomBytes(32)));

    expect(() => hs.getSessionKey()).toThrow('not complete');
  });

  it('getSessionKey() returns the key after handshake completes', () => {
    const { identity: initiatorId } = createTestIdentity('Init');
    const { identity: responderId } = createTestIdentity('Resp');

    const initiator = new NoiseHandshake(initiatorId, responderId.dhPublicKey);
    const responder = new NoiseHandshake(responderId);

    const hello = initiator.initiatorHello();
    responder.responderReply(hello);

    // Responder should have a session key
    const respKey = responder.getSessionKey();
    expect(respKey.length).toBe(32);
  });

  it('initiatorHello() throws without remote public key', () => {
    const { identity } = createTestIdentity('Device');
    const hs = new NoiseHandshake(identity); // no remote key

    expect(() => hs.initiatorHello()).toThrow('remote static public key');
  });

  it('initiatorFinalize() throws without calling initiatorHello first', () => {
    const { identity } = createTestIdentity('Device');
    const hs = new NoiseHandshake(identity, bytesToHex(nacl.randomBytes(32)));

    expect(() =>
      hs.initiatorFinalize({
        ephemeralPublicKey: bytesToHex(nacl.randomBytes(32)),
        encryptedPayload: nacl.randomBytes(100),
      }),
    ).toThrow('initiatorHello');
  });

  it('can encrypt/decrypt data with the derived session key', () => {
    const { identity: initiatorId } = createTestIdentity('Sender');
    const { identity: responderId } = createTestIdentity('Receiver');

    const initiator = new NoiseHandshake(initiatorId, responderId.dhPublicKey);
    const responder = new NoiseHandshake(responderId);

    const hello = initiator.initiatorHello();
    const reply = responder.responderReply(hello);
    initiator.initiatorFinalize(reply);

    // Use the session key for symmetric encryption
    const sessionKey = initiator.getSessionKey();
    const plaintext = new TextEncoder().encode('Sync payload after handshake');

    const { ciphertext, nonce } = encrypt(plaintext, sessionKey);
    const decrypted = decrypt(ciphertext, nonce, responder.getSessionKey());

    expect(decrypted).toEqual(plaintext);
  });
});
