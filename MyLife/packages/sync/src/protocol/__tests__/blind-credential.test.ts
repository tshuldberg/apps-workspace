/**
 * Plan 51 P2: RSABSSA blind credential protocol.
 *
 * The test performs the issuer's raw RSA private-key operation with node:crypto
 * (the same operation @mylife/meerkat-relay's blind-credential-server performs);
 * the protocol module under test stays pure and RN-safe.
 */

import { describe, expect, it } from 'vitest';
import { constants, generateKeyPairSync, privateDecrypt, randomBytes as nodeRandomBytes } from 'node:crypto';
import {
  BLIND_CREDENTIAL_DOMAIN,
  CREDENTIAL_EPOCH_GENESIS_MS,
  CREDENTIAL_EPOCH_LENGTH_MS,
  CREDENTIAL_EPOCH_GRACE_MS,
  CREDENTIAL_MODULUS_BYTES,
  credentialBase64ToBytes,
  credentialBytesToBase64,
  credentialEpochAt,
  credentialEpochWindow,
  credentialSerial,
  finalizeBlindCredential,
  isWithinRenewalWindow,
  parseMeerkatCredential,
  parseRsaPublicKeySpki,
  prepareBlindCredentialRequest,
  serializeMeerkatCredential,
  verifyBlindCredential,
  type MeerkatCredential,
} from '../blind-credential';

const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
const publicKeySpkiDerBase64 = keyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

function rawBlindSign(blindedMessageBase64: string): string {
  const blinded = Buffer.from(blindedMessageBase64, 'base64');
  const signed = privateDecrypt(
    { key: keyPair.privateKey, padding: constants.RSA_NO_PADDING },
    blinded,
  );
  const padded = Buffer.alloc(CREDENTIAL_MODULUS_BYTES);
  signed.copy(padded, CREDENTIAL_MODULUS_BYTES - signed.length);
  return padded.toString('base64');
}

const liveRandom = (length: number): Uint8Array => new Uint8Array(nodeRandomBytes(length));

const EPOCH = 3;
const EPOCH_NOW = credentialEpochWindow(EPOCH).notBeforeMs + 1000;

function mintCredential(): { credential: MeerkatCredential; blindedMessageBase64: string; blindSignatureBase64: string } {
  const prepared = prepareBlindCredentialRequest(EPOCH, publicKeySpkiDerBase64, liveRandom);
  expect(prepared).not.toBeNull();
  const blindSignatureBase64 = rawBlindSign(prepared!.blindedMessageBase64);
  const credential = finalizeBlindCredential(prepared!.state, publicKeySpkiDerBase64, blindSignatureBase64);
  expect(credential).not.toBeNull();
  return { credential: credential!, blindedMessageBase64: prepared!.blindedMessageBase64, blindSignatureBase64 };
}

describe('blind credential roundtrip', () => {
  it('mints, finalizes, and verifies a credential against the epoch public key', () => {
    const { credential } = mintCredential();
    expect(verifyBlindCredential(credential, publicKeySpkiDerBase64, EPOCH_NOW)).toBe('ok');
    const serial = credentialSerial(credential.messageBase64);
    expect(serial).toMatch(/^[0-9a-f]{64}$/);
  });

  it('parses the SPKI public key into RSA-2048 components', () => {
    const key = parseRsaPublicKeySpki(publicKeySpkiDerBase64);
    expect(key).not.toBeNull();
    expect(key!.e).toBe(65537n);
    expect(key!.modulusBytes).toBe(256);
    expect(parseRsaPublicKeySpki('not-a-key')).toBeNull();
    expect(parseRsaPublicKeySpki(credentialBytesToBase64(new Uint8Array(40)))).toBeNull();
  });

  it('rejects non-canonical base64 with non-zero padding bits', () => {
    expect(credentialBase64ToBytes('/w==')).toEqual(new Uint8Array([255]));
    expect(credentialBase64ToBytes('/x==')).toBeNull();
  });

  it('serial is stable per token and distinct across tokens', () => {
    const a = mintCredential().credential;
    const b = mintCredential().credential;
    expect(credentialSerial(a.messageBase64)).toBe(credentialSerial(a.messageBase64));
    expect(credentialSerial(a.messageBase64)).not.toBe(credentialSerial(b.messageBase64));
  });

  it('bearer serialization roundtrips and rejects malformed input', () => {
    const { credential } = mintCredential();
    const bearer = serializeMeerkatCredential(credential);
    expect(parseMeerkatCredential(bearer)).toEqual(credential);
    expect(parseMeerkatCredential('!!!')).toBeNull();
    expect(parseMeerkatCredential('')).toBeNull();
    expect(parseMeerkatCredential('{"version":2}')).toBeNull();
  });
});

describe('AC-1: issuance and presentation transcripts share no linkable values', () => {
  it('no value from the issuance transcript appears in the presentation transcript', () => {
    const { credential, blindedMessageBase64, blindSignatureBase64 } = mintCredential();
    const issuance = [blindedMessageBase64, blindSignatureBase64];
    const presentation = [
      credential.messageBase64,
      credential.signatureBase64,
      credentialSerial(credential.messageBase64)!,
    ];
    for (const issued of issuance) {
      for (const presented of presentation) {
        expect(issued).not.toBe(presented);
        expect(issued.includes(presented)).toBe(false);
        expect(presented.includes(issued)).toBe(false);
      }
    }
    // Byte-level disjointness on any 16-byte window: the blinding factor makes the
    // blinded message computationally independent of the token message.
    const issuedBytes = issuance.map((value) => credentialBase64ToBytes(value)!);
    const presentedBytes = presentation
      .filter((value) => /=$|[+/]/.test(value) || value.length % 4 === 0)
      .map((value) => credentialBase64ToBytes(value))
      .filter((value): value is Uint8Array => value !== null);
    const windows = new Set<string>();
    for (const bytes of issuedBytes) {
      for (let i = 0; i + 16 <= bytes.length; i += 1) {
        windows.add(Buffer.from(bytes.subarray(i, i + 16)).toString('hex'));
      }
    }
    for (const bytes of presentedBytes) {
      for (let i = 0; i + 16 <= bytes.length; i += 1) {
        expect(windows.has(Buffer.from(bytes.subarray(i, i + 16)).toString('hex'))).toBe(false);
      }
    }
  });

  it('two mints of the same epoch produce unrelated blinded messages', () => {
    const first = prepareBlindCredentialRequest(EPOCH, publicKeySpkiDerBase64, liveRandom)!;
    const second = prepareBlindCredentialRequest(EPOCH, publicKeySpkiDerBase64, liveRandom)!;
    expect(first.blindedMessageBase64).not.toBe(second.blindedMessageBase64);
    expect(first.state.messageBase64).not.toBe(second.state.messageBase64);
  });
});

describe('NC-1: forgery and tamper rejection', () => {
  it('rejects a tampered message', () => {
    const { credential } = mintCredential();
    const messageBytes = credentialBase64ToBytes(credential.messageBase64)!;
    messageBytes[messageBytes.length - 1]! ^= 0x01;
    const tampered = { ...credential, messageBase64: credentialBytesToBase64(messageBytes) };
    expect(verifyBlindCredential(tampered, publicKeySpkiDerBase64, EPOCH_NOW)).toBe('invalid');
  });

  it('rejects a tampered signature', () => {
    const { credential } = mintCredential();
    const signatureBytes = credentialBase64ToBytes(credential.signatureBase64)!;
    signatureBytes[0]! ^= 0x80;
    const tampered = { ...credential, signatureBase64: credentialBytesToBase64(signatureBytes) };
    expect(verifyBlindCredential(tampered, publicKeySpkiDerBase64, EPOCH_NOW)).toBe('invalid');
  });

  it('rejects a credential under a different epoch key', () => {
    const otherPair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
    const otherKey = otherPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    const { credential } = mintCredential();
    expect(verifyBlindCredential(credential, otherKey, EPOCH_NOW)).toBe('invalid');
  });

  it('rejects an epoch-rebound message (epoch field vs message binding)', () => {
    const { credential } = mintCredential();
    const rebound = { ...credential, epoch: EPOCH + 1 };
    expect(verifyBlindCredential(rebound, publicKeySpkiDerBase64, EPOCH_NOW)).toBe('invalid');
  });

  it('finalize refuses a garbage blind signature instead of storing a poisoned token', () => {
    const prepared = prepareBlindCredentialRequest(EPOCH, publicKeySpkiDerBase64, liveRandom)!;
    const garbage = credentialBytesToBase64(liveRandom(CREDENTIAL_MODULUS_BYTES));
    expect(finalizeBlindCredential(prepared.state, publicKeySpkiDerBase64, garbage)).toBeNull();
  });

  it('marks an authentic credential expired outside its epoch window, never invalid-as-fresh', () => {
    const { credential } = mintCredential();
    const { notBeforeMs, notAfterMs } = credentialEpochWindow(EPOCH);
    expect(verifyBlindCredential(credential, publicKeySpkiDerBase64, notBeforeMs - 1)).toBe('expired');
    expect(verifyBlindCredential(credential, publicKeySpkiDerBase64, notAfterMs + 1)).toBe('expired');
    expect(verifyBlindCredential(credential, publicKeySpkiDerBase64, notAfterMs - 1)).toBe('ok');
  });
});

describe('epoch math', () => {
  it('maps times to epochs from genesis with a 30-day period', () => {
    expect(credentialEpochAt(CREDENTIAL_EPOCH_GENESIS_MS - 1)).toBe(0);
    expect(credentialEpochAt(CREDENTIAL_EPOCH_GENESIS_MS)).toBe(0);
    expect(credentialEpochAt(CREDENTIAL_EPOCH_GENESIS_MS + CREDENTIAL_EPOCH_LENGTH_MS)).toBe(1);
    expect(credentialEpochAt(CREDENTIAL_EPOCH_GENESIS_MS + 5.5 * CREDENTIAL_EPOCH_LENGTH_MS)).toBe(5);
  });

  it('epoch windows include the 24h verification grace', () => {
    const { notBeforeMs, notAfterMs } = credentialEpochWindow(2);
    expect(notBeforeMs).toBe(CREDENTIAL_EPOCH_GENESIS_MS + 2 * CREDENTIAL_EPOCH_LENGTH_MS);
    expect(notAfterMs - notBeforeMs).toBe(CREDENTIAL_EPOCH_LENGTH_MS + CREDENTIAL_EPOCH_GRACE_MS);
  });

  it('renewal opens only in the final 7 days of an epoch', () => {
    const start = credentialEpochWindow(1).notBeforeMs;
    const end = start + CREDENTIAL_EPOCH_LENGTH_MS;
    expect(isWithinRenewalWindow(start)).toBe(false);
    expect(isWithinRenewalWindow(end - 8 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(isWithinRenewalWindow(end - 6 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(isWithinRenewalWindow(end - 1)).toBe(true);
    expect(isWithinRenewalWindow(CREDENTIAL_EPOCH_GENESIS_MS - 1)).toBe(false);
  });
});

describe('domain separation', () => {
  it('the token message leads with the credential domain', () => {
    const { credential } = mintCredential();
    const messageBytes = credentialBase64ToBytes(credential.messageBase64)!;
    const domain = new TextDecoder().decode(messageBytes.subarray(0, BLIND_CREDENTIAL_DOMAIN.length));
    expect(domain).toBe(BLIND_CREDENTIAL_DOMAIN);
  });

  it('refuses to build a serial for a non-credential message', () => {
    expect(credentialSerial(credentialBytesToBase64(new TextEncoder().encode('meerkat-humanity-v1____')))).toBeNull();
    expect(credentialSerial('@@@')).toBeNull();
  });
});


it('a blinding-factor opening cannot bind a finished credential to one issuance transcript', () => {
  const own = mintCredential();
  const borrowed = mintCredential().credential;
  const { n } = parseRsaPublicKeySpki(publicKeySpkiDerBase64)!;
  const integer = (base64: string): bigint => BigInt(`0x${Buffer.from(base64, 'base64').toString('hex')}`);
  function inverse(value: bigint): bigint {
    let [a, b, x, y] = [value, n, 1n, 0n];
    while (b !== 0n) {
      const q = a / b;
      [a, b, x, y] = [b, a - q * b, y, x - q * y];
    }
    if (a !== 1n) throw new Error('fixture signature is not invertible');
    return (x % n + n) % n;
  }
  // Given one's own blind response w and any valid borrowed signature s, r=w/s.
  // Finalize then returns s. Revealing r or proving knowledge of it would not
  // prove the borrowed token was the message originally chosen for that request.
  const alternativeBlind = integer(own.blindSignatureBase64) * inverse(integer(borrowed.signatureBase64)) % n;
  const blindBase64 = Buffer.from(alternativeBlind.toString(16).padStart(CREDENTIAL_MODULUS_BYTES * 2, '0'), 'hex').toString('base64');
  const reconstructed = finalizeBlindCredential({ epoch: EPOCH, messageBase64: borrowed.messageBase64, blindBase64 },
    publicKeySpkiDerBase64, own.blindSignatureBase64);
  expect(reconstructed).toEqual(borrowed);
  expect(verifyBlindCredential(reconstructed!, publicKeySpkiDerBase64, EPOCH_NOW)).toBe('ok');
  expect(reconstructed).not.toEqual(own.credential);
});
