import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PERSONA_CLAIM_DOMAIN,
  canonicalizeAlias,
  canonicalPersonaClaimBytes,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createPersonaClaim,
  extractPersonaPrivateKeyHex,
  generateDeviceIdentity,
  generatePublicPersona,
  isCanonicalAlias,
  storeSharedSecret,
  verifyPersonaClaim,
  type PersonaClaim,
} from '../../index';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../../identity/device-identity';
import { bytesToHex, hexToBytes } from '../../encryption/keys';
import { sha512Hex } from '../../node/hkdf';

const encoder = new TextEncoder();

// The humanity-token commitment: sha512Hex of the (here arbitrary) seed, matching the
// registry's bindingHash. 128 hex chars, so it satisfies the claim's binding shape.
function humanityBinding(seed: string): string {
  return sha512Hex(encoder.encode(seed));
}

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
});

describe('alias canonicalization + homoglyph policy', () => {
  it('case-folds and trims to a unique canonical form', () => {
    expect(canonicalizeAlias('  Alice  ')).toBe('alice');
    expect(canonicalizeAlias('ALICE')).toBe('alice');
    expect(canonicalizeAlias('river_99')).toBe('river_99');
  });

  it('folds width/compatibility variants then rejects non-ASCII (homoglyph defense)', () => {
    // Full-width digits normalize under NFKC to ASCII digits (allowed once folded).
    expect(canonicalizeAlias('ｒｉｖｅｒ')).toBe('river');
    // Cyrillic "а" (U+0430) is NOT NFKC-folded to Latin "a": it stays non-ASCII and is
    // rejected by the charset, so it can never collide with the Latin "alice".
    expect(canonicalizeAlias('аlice')).toBeNull();
    // Zero-width joiner cannot survive the ASCII charset.
    expect(canonicalizeAlias('ali‍ce')).toBeNull();
  });

  it('rejects out-of-charset and out-of-length aliases', () => {
    expect(canonicalizeAlias('ab')).toBeNull(); // too short
    expect(canonicalizeAlias('a'.repeat(21))).toBeNull(); // too long
    expect(canonicalizeAlias('has space')).toBeNull();
    expect(canonicalizeAlias('bad-dash')).toBeNull();
    expect(canonicalizeAlias('emoji😀name')).toBeNull();
    expect(isCanonicalAlias('Alice')).toBe(false);
    expect(isCanonicalAlias('alice')).toBe(true);
  });
});

describe('persona keypair generation', () => {
  it('mints a FRESH keypair distinct from any device key and stores it under a distinct namespace', () => {
    const device = generateDeviceIdentity('My Device');
    const persona = generatePublicPersona('Alice');

    expect(persona.personaPubkey).not.toBe(device.publicKey);
    expect(persona.privateKeyRef).not.toBe(device.privateKeyRef);
    expect(persona.alias).toBe('alice');
    // The persona structure carries NO device key field (NC-P2): no property equals the
    // device public key or its private-key ref.
    for (const value of Object.values(persona)) {
      expect(value).not.toBe(device.publicKey);
      expect(value).not.toBe(device.privateKeyRef);
    }
    // The private key resolves from the persona ref (round-trip), and it is NOT the device key.
    const personaPriv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
    expect(personaPriv).toMatch(/^[0-9a-f]{128}$/);
  });

  it('refuses to derive a signing key from a peer/wrong secret ref (codex P1 finding)', () => {
    const persona = generatePublicPersona('alice');
    // A pairwise PEER shared secret (known to a paired peer) lives in the same shared-secret
    // namespace. Feeding its ref must NOT yield the persona key: the derived pubkey will not
    // match, so extraction refuses rather than sign with a peer-known secret.
    const peerRef = storeSharedSecret('self-device', 'peer-device', 'ab'.repeat(32));
    expect(() => extractPersonaPrivateKeyHex(peerRef, persona.personaPubkey)).toThrow();
    // A different persona's ref is likewise rejected for this persona's pubkey.
    const other = generatePublicPersona('bob');
    expect(() => extractPersonaPrivateKeyHex(other.privateKeyRef, persona.personaPubkey)).toThrow();
  });

  it('rejects a bad alias before storing any key', () => {
    expect(() => generatePublicPersona('no')).toThrow();
    expect(() => generatePublicPersona('bad dash-')).toThrow();
  });

  it('two personas never collide', () => {
    const a = generatePublicPersona('alice');
    const b = generatePublicPersona('bob');
    expect(a.personaPubkey).not.toBe(b.personaPubkey);
  });
});

describe('persona claim sign/verify', () => {
  it('signs and verifies a well-formed claim', () => {
    const persona = generatePublicPersona('Alice');
    const claim = createPersonaClaim({ persona, humanityBinding: humanityBinding('tok-1') });
    expect(claim.alias).toBe('alice');
    expect(claim.personaPubkey).toBe(persona.personaPubkey);
    expect(verifyPersonaClaim(claim)).toBe('ok');
  });

  it('rejects a tampered alias, key, binding, or timestamp', () => {
    const persona = generatePublicPersona('alice');
    const claim = createPersonaClaim({ persona, humanityBinding: humanityBinding('tok-1') });
    const other = generatePublicPersona('bob');

    expect(verifyPersonaClaim({ ...claim, alias: 'bob' })).toBe('invalid');
    expect(verifyPersonaClaim({ ...claim, personaPubkey: other.personaPubkey })).toBe('invalid');
    expect(verifyPersonaClaim({ ...claim, humanityBinding: humanityBinding('tok-2') })).toBe('invalid');
    expect(verifyPersonaClaim({ ...claim, issuedAt: '2000-01-01T00:00:00.000Z' })).toBe('invalid');
  });

  it('rejects a malformed claim (non-canonical alias, non-hex key/binding)', () => {
    const persona = generatePublicPersona('alice');
    const claim = createPersonaClaim({ persona, humanityBinding: humanityBinding('tok-1') });
    expect(verifyPersonaClaim({ ...claim, alias: 'Alice' })).toBe('malformed');
    expect(verifyPersonaClaim({ ...claim, personaPubkey: 'zz' })).toBe('malformed');
    expect(verifyPersonaClaim({ ...claim, humanityBinding: 'nothex' })).toBe('malformed');
    expect(verifyPersonaClaim(undefined as unknown as PersonaClaim)).toBe('malformed');
    expect(verifyPersonaClaim({ ...claim, version: 2 } as unknown as PersonaClaim)).toBe('malformed');
  });

  it('refuses to build a claim with a non-hex humanity binding', () => {
    const persona = generatePublicPersona('alice');
    expect(() => createPersonaClaim({ persona, humanityBinding: 'not-a-hash' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// NC-P2 leakage tests (BOTH directions): the persona key and the device key
// never cross-verify, and a persona-domain signature never doubles as a
// private-tier signature. This is the load-bearing unlinkability guarantee.
// ---------------------------------------------------------------------------
describe('NC-P2 cross-domain leakage guards', () => {
  it('a persona-signed claim cannot verify as a private-domain payload (direction 1)', () => {
    const persona = generatePublicPersona('alice');
    const claim = createPersonaClaim({ persona, humanityBinding: humanityBinding('tok-1') });
    const personaPriv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);

    // The persona signature is over bytes that LEAD with the persona domain. The same
    // signature must NOT verify against a payload built under any other domain.
    const claimBytes = canonicalPersonaClaimBytes({
      version: 1,
      alias: claim.alias,
      personaPubkey: claim.personaPubkey,
      humanityBinding: claim.humanityBinding,
      issuedAt: claim.issuedAt,
    });
    const sig = hexToBytes(claim.signature);
    expect(verifySignature(persona.personaPubkey, claimBytes, sig)).toBe(true);

    for (const foreignDomain of [
      'meerkat-community-profile-v1',
      'meerkat-humanity-v1',
      'meerkat-live-session-v1',
      'meerkat-dm-v1',
    ]) {
      const foreignBytes = encoder.encode(
        JSON.stringify([foreignDomain, 1, claim.alias, claim.personaPubkey]),
      );
      expect(verifySignature(persona.personaPubkey, foreignBytes, sig)).toBe(false);
    }

    // And if the persona key signs a genuinely foreign (private-domain) message, that
    // signature can never satisfy verifyPersonaClaim.
    const foreignMsg = encoder.encode(
      JSON.stringify(['meerkat-community-profile-v1', 1, 'community', persona.personaPubkey]),
    );
    const foreignSig = bytesToHex(signMessage(personaPriv, foreignMsg));
    expect(verifyPersonaClaim({ ...claim, signature: foreignSig })).toBe('invalid');
  });

  it('a device key can never produce a claim that verifies for a real persona (direction 2)', () => {
    const device = generateDeviceIdentity('My Device');
    const persona = generatePublicPersona('alice');
    // Sign the persona claim bytes with the DEVICE key, but present the real persona pubkey
    // as the signer. The signature is over the correct bytes yet by the wrong key, so
    // verification fails: the device key cannot forge a persona claim for someone's alias.
    const bytes = canonicalPersonaClaimBytes({
      version: 1,
      alias: persona.alias,
      personaPubkey: persona.personaPubkey,
      humanityBinding: humanityBinding('tok-1'),
      issuedAt: '2026-07-06T00:00:00.000Z',
    });
    const deviceSig = bytesToHex(signMessage(extractSigningPrivateKeyHex(device.privateKeyRef), bytes));
    const forged: PersonaClaim = {
      version: 1,
      alias: persona.alias,
      personaPubkey: persona.personaPubkey,
      humanityBinding: humanityBinding('tok-1'),
      issuedAt: '2026-07-06T00:00:00.000Z',
      signature: deviceSig,
    };
    expect(verifyPersonaClaim(forged)).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// NC-P1 static guard: no private pairing/mesh source file may import the public
// persona protocol. The persona only ever lives on the public-tier path.
// ---------------------------------------------------------------------------
describe('NC-P1 private-path isolation', () => {
  const protocolDir = path.resolve(__dirname, '..');
  const identityDir = path.resolve(__dirname, '../../identity');
  const privatePathFiles = [
    path.join(identityDir, 'pairing.ts'),
    path.join(identityDir, 'device-identity.ts'),
    path.join(protocolDir, 'join-handoff-core.ts'),
    path.join(protocolDir, 'dm-message.ts'),
    path.join(protocolDir, 'dm-mailbox.ts'),
    path.join(protocolDir, 'group-keys.ts'),
    path.join(protocolDir, 'sync-session.ts'),
    path.join(protocolDir, 'community.ts'),
  ];

  it('the private mesh path never imports public-persona', () => {
    for (const file of privatePathFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('public-persona')).toBe(false);
      expect(src.includes(PERSONA_CLAIM_DOMAIN)).toBe(false);
    }
  });
});
