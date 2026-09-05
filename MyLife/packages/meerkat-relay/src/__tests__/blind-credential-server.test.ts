/** Plan 51 P2: issuer-side RSABSSA operations + the shared presentation verifier. */

import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, randomBytes as nodeRandomBytes } from 'node:crypto';
import {
  credentialEpochWindow,
  credentialSerial,
  finalizeBlindCredential,
  prepareBlindCredentialRequest,
  serializeMeerkatCredential,
  verifyBlindCredential,
  type MeerkatCredential,
} from '@mylife/sync';
import {
  blindSignCredential,
  deriveEpochPublicKey,
  generateEpochKeyPair,
  sealEpochPrivateKey,
  unsealEpochPrivateKey,
} from '../blind-credential-server';
import { createCredentialVerifier } from '../credential-verify';

const EPOCH = 4;
const keyPair = generateEpochKeyPair(EPOCH);
const EPOCH_NOW = credentialEpochWindow(EPOCH).notBeforeMs + 1000;
const liveRandom = (length: number): Uint8Array => new Uint8Array(nodeRandomBytes(length));

function mint(): MeerkatCredential {
  const prepared = prepareBlindCredentialRequest(EPOCH, keyPair.publicKeySpkiDerBase64, liveRandom)!;
  const blindSignature = blindSignCredential(keyPair.privateKeyPkcs8DerBase64, prepared.blindedMessageBase64);
  const credential = finalizeBlindCredential(prepared.state, keyPair.publicKeySpkiDerBase64, blindSignature);
  expect(credential).not.toBeNull();
  return credential!;
}

describe('blind-credential-server issuance', () => {
  it('signs a blinded message that finalizes into a verifiable credential', () => {
    const credential = mint();
    expect(verifyBlindCredential(credential, keyPair.publicKeySpkiDerBase64, EPOCH_NOW)).toBe('ok');
  });

  it('refuses a wrong-length blinded message', () => {
    expect(() => blindSignCredential(keyPair.privateKeyPkcs8DerBase64, Buffer.alloc(10).toString('base64')))
      .toThrow(/modulus length/);
  });

  it('rejects an out-of-range epoch at keygen', () => {
    expect(() => generateEpochKeyPair(-1)).toThrow(/out of range/);
    expect(() => generateEpochKeyPair(3.5)).toThrow(/out of range/);
  });
});

describe('epoch key sealing', () => {
  it('seals and unseals a private key under the env secret', () => {
    const sealed = sealEpochPrivateKey('a-sufficiently-long-secret', keyPair.privateKeyPkcs8DerBase64);
    expect(sealed.startsWith('v1:')).toBe(true);
    expect(sealed).not.toContain(keyPair.privateKeyPkcs8DerBase64.slice(0, 24));
    expect(unsealEpochPrivateKey('a-sufficiently-long-secret', sealed)).toBe(keyPair.privateKeyPkcs8DerBase64);
  });

  it('fails closed on wrong secret or tamper', () => {
    const sealed = sealEpochPrivateKey('a-sufficiently-long-secret', keyPair.privateKeyPkcs8DerBase64);
    expect(unsealEpochPrivateKey('the-wrong-secret-entirely', sealed)).toBeNull();
    const tampered = `${sealed.slice(0, sealed.length - 4)}AAAA`;
    expect(unsealEpochPrivateKey('a-sufficiently-long-secret', tampered)).toBeNull();
    expect(unsealEpochPrivateKey('a-sufficiently-long-secret', 'v2:zzzz')).toBeNull();
  });

  it('refuses a weak seal secret', () => {
    expect(() => sealEpochPrivateKey('short', keyPair.privateKeyPkcs8DerBase64)).toThrow(/at least 16/);
  });
});

describe('credential presentation verifier (NC-1 surface behavior)', () => {
  function verifier(overrides?: Partial<Parameters<typeof createCredentialVerifier>[0]>) {
    return createCredentialVerifier({
      getEpochPublicKey: (epoch) => (epoch === EPOCH ? keyPair.publicKeySpkiDerBase64 : null),
      isSerialRevoked: () => false,
      now: () => EPOCH_NOW,
      ...overrides,
    });
  }

  it('accepts a valid presentation and exposes epoch + serial', async () => {
    const credential = mint();
    const result = await verifier().verifyPresentation(serializeMeerkatCredential(credential));
    expect(result).toEqual({ ok: true, epoch: EPOCH, serial: credentialSerial(credential.messageBase64) });
  });

  it('refuses a missing bearer', async () => {
    expect(await verifier().verifyPresentation(undefined)).toEqual({ ok: false, reason: 'missing' });
    expect(await verifier().verifyPresentation('  ')).toEqual({ ok: false, reason: 'missing' });
  });

  it('refuses a forged credential', async () => {
    const credential = mint();
    const first = credential.signatureBase64[0];
    const forged = {
      ...credential,
      signatureBase64: `${first === 'A' ? 'B' : 'A'}${credential.signatureBase64.slice(1)}`,
    };
    const result = await verifier().verifyPresentation(serializeMeerkatCredential(forged));
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses a revoked serial', async () => {
    const credential = mint();
    const serial = credentialSerial(credential.messageBase64)!;
    const result = await verifier({ isSerialRevoked: (candidate) => candidate === serial })
      .verifyPresentation(serializeMeerkatCredential(credential));
    expect(result).toEqual({ ok: false, reason: 'revoked' });
  });

  it('fails closed when no epoch key source is configured', async () => {
    const credential = mint();
    const result = await verifier({ getEpochPublicKey: () => null })
      .verifyPresentation(serializeMeerkatCredential(credential));
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('fails closed (revoked) when the revocation source is unreachable', async () => {
    const credential = mint();
    const result = await verifier({
      isSerialRevoked: () => {
        throw new Error('db down');
      },
    }).verifyPresentation(serializeMeerkatCredential(credential));
    expect(result).toEqual({ ok: false, reason: 'revoked' });
  });

  it('reports an authentic but out-of-window credential as expired', async () => {
    const credential = mint();
    const late = credentialEpochWindow(EPOCH).notAfterMs + 1;
    const result = await verifier({ now: () => late })
      .verifyPresentation(serializeMeerkatCredential(credential));
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });
});


describe('persisted issuer key validation', () => {
  it('derives the existing public key byte for byte', () => {
    expect(deriveEpochPublicKey(keyPair.privateKeyPkcs8DerBase64)).toBe(keyPair.publicKeySpkiDerBase64);
  });

  it('rejects malformed and non-RSA private keys', () => {
    const ed = generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
    expect(deriveEpochPublicKey(ed)).toBeNull();
    expect(deriveEpochPublicKey('invalid')).toBeNull();
    expect(deriveEpochPublicKey(keyPair.publicKeySpkiDerBase64)).toBeNull();
  });

  it('rejects unsupported RSA size or exponent', () => {
    for (const options of [{ modulusLength: 1024, publicExponent: 65537 }, { modulusLength: 2048, publicExponent: 3 }]) {
      const key = generateKeyPairSync('rsa', options).privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
      expect(deriveEpochPublicKey(key)).toBeNull();
    }
  });
});
