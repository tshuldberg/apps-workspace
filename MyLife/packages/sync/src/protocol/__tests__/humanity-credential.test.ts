import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import { bytesToHex } from '../../encryption/keys';
import { generateDeviceIdentity } from '../../identity/device-identity';
import { createDmMessage, verifyDmMessage, type DmMessageEvent } from '../dm-message';
import {
  HUMANITY_TOKEN_DOMAIN,
  canonicalHumanityTokenBytes,
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  parseHumanityToken,
  serializeHumanityToken,
  signHumanityToken,
  verifyHumanityToken,
  type HumanityToken,
} from '../humanity-credential';
import { signMessage } from '../../identity/device-identity';

// A deterministic 32-byte seed -> the service's Ed25519 keypair.
const SEED_HEX = 'a'.repeat(64);
const service = humanityServiceKeypairFromSeed(SEED_HEX);

// A counter-based fake PRNG so batches are deterministic under test.
function fakeRandom(seed: number): (n: number) => Uint8Array {
  let counter = seed;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) {
      counter = (counter * 1103515245 + 12345) & 0x7fffffff;
      out[i] = counter & 0xff;
    }
    return out;
  };
}

describe('humanity credential protocol (Plan 24 P0)', () => {
  it('derives a stable service keypair from a seed', () => {
    const again = humanityServiceKeypairFromSeed(SEED_HEX);
    expect(again.publicKeyHex).toBe(service.publicKeyHex);
    expect(again.privateKeyHex).toBe(service.privateKeyHex);
    expect(service.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    // The public key is the tail 32 bytes of the 64-byte secret key (nacl convention).
    expect(service.privateKeyHex).toMatch(/^[0-9a-f]{128}$/);
  });

  it('signs and verifies a token', () => {
    const now = Date.parse('2026-07-04T00:00:00.000Z');
    const token = signHumanityToken(service.privateKeyHex, {
      version: 1,
      tokenId: 'b'.repeat(64),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 1000).toISOString(),
    });
    expect(token.signature).toMatch(/^[0-9a-f]{128}$/);
    expect(verifyHumanityToken(token, service.publicKeyHex, now)).toBe('ok');
  });

  it('reports expiry distinctly from invalidity', () => {
    const issued = Date.parse('2026-01-01T00:00:00.000Z');
    const token = signHumanityToken(service.privateKeyHex, {
      version: 1,
      tokenId: 'c'.repeat(64),
      issuedAt: new Date(issued).toISOString(),
      expiresAt: new Date(issued + 1000).toISOString(),
    });
    expect(verifyHumanityToken(token, service.publicKeyHex, issued + 500)).toBe('ok');
    expect(verifyHumanityToken(token, service.publicKeyHex, issued + 2000)).toBe('expired');
  });

  it('rejects a token signed by the wrong key', () => {
    const now = Date.parse('2026-07-04T00:00:00.000Z');
    const other = humanityServiceKeypairFromSeed('f'.repeat(64));
    const token = signHumanityToken(other.privateKeyHex, {
      version: 1,
      tokenId: 'd'.repeat(64),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 1000).toISOString(),
    });
    expect(verifyHumanityToken(token, service.publicKeyHex, now)).toBe('invalid');
  });

  it('rejects tampering of every signature-covered field', () => {
    const now = Date.parse('2026-07-04T00:00:00.000Z');
    const base = signHumanityToken(service.privateKeyHex, {
      version: 1,
      tokenId: 'e'.repeat(64),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 10_000).toISOString(),
    });
    const mutate = (patch: Partial<HumanityToken>): HumanityToken => ({ ...base, ...patch });
    expect(verifyHumanityToken(mutate({ tokenId: 'f'.repeat(64) }), service.publicKeyHex, now)).toBe('invalid');
    expect(verifyHumanityToken(mutate({ issuedAt: new Date(now + 1).toISOString() }), service.publicKeyHex, now)).toBe('invalid');
    expect(verifyHumanityToken(mutate({ expiresAt: new Date(now + 20_000).toISOString() }), service.publicKeyHex, now)).toBe('invalid');
  });

  it('rejects malformed shapes fail-closed', () => {
    const now = Date.now();
    expect(verifyHumanityToken(null as unknown as HumanityToken, service.publicKeyHex, now)).toBe('invalid');
    expect(verifyHumanityToken({} as HumanityToken, service.publicKeyHex, now)).toBe('invalid');
    expect(verifyHumanityToken({ version: 2, tokenId: 'a'.repeat(64), issuedAt: 'x', expiresAt: 'y', signature: 'z' } as unknown as HumanityToken, service.publicKeyHex, now)).toBe('invalid');
    // A non-hex tokenId is rejected before any signature work.
    expect(verifyHumanityToken({ version: 1, tokenId: 'nothex', issuedAt: 'x', expiresAt: 'y', signature: 'z' } as unknown as HumanityToken, service.publicKeyHex, now)).toBe('invalid');
  });

  it('mints a batch of single-use tokens with distinct ids', () => {
    const now = Date.parse('2026-07-04T00:00:00.000Z');
    const batch = issueHumanityTokenBatch({
      servicePrivateKeyHex: service.privateKeyHex,
      count: 32,
      ttlMs: 90 * 24 * 60 * 60 * 1000,
      now,
      randomBytes: fakeRandom(7),
    });
    expect(batch).toHaveLength(32);
    const ids = new Set(batch.map((t) => t.tokenId));
    expect(ids.size).toBe(32);
    for (const token of batch) {
      expect(token.tokenId).toMatch(/^[0-9a-f]{64}$/);
      expect(verifyHumanityToken(token, service.publicKeyHex, now)).toBe('ok');
      expect(Date.parse(token.expiresAt)).toBe(now + 90 * 24 * 60 * 60 * 1000);
    }
  });

  it('round-trips the bearer serialization and rejects garbage', () => {
    const now = Date.now();
    const token = signHumanityToken(service.privateKeyHex, {
      version: 1,
      tokenId: '1'.repeat(64),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 1000).toISOString(),
    });
    const wire = serializeHumanityToken(token);
    expect(wire).not.toContain('{');
    const parsed = parseHumanityToken(wire);
    expect(parsed).toEqual(token);
    // Also accepts the raw-JSON form for debugging tooling.
    expect(parseHumanityToken(JSON.stringify(token))).toEqual(token);
    expect(parseHumanityToken('')).toBeNull();
    expect(parseHumanityToken('!!!not-base64!!!')).toBeNull();
    expect(parseHumanityToken('{"bad":true}')).toBeNull();
  });
});

describe('humanity credential domain separation (TC, load-bearing)', () => {
  it('carries a domain string distinct from the other Meerkat signing domains', () => {
    expect(HUMANITY_TOKEN_DOMAIN).toBe('meerkat-humanity-v1');
    // The canonical form leads with the domain, so no other protocol's bytes can collide.
    const bytes = canonicalHumanityTokenBytes({
      version: 1,
      tokenId: 'a'.repeat(64),
      issuedAt: '2026-07-04T00:00:00.000Z',
      expiresAt: '2026-07-05T00:00:00.000Z',
    });
    expect(new TextDecoder().decode(bytes)).toContain('meerkat-humanity-v1');
  });

  it('a humanity token cannot pass as a DM and a DM cannot pass as a humanity token', () => {
    const author = generateDeviceIdentity('Author');
    const peer = generateDeviceIdentity('Peer');
    const now = Date.parse('2026-07-04T00:00:00.000Z');

    // A real, individually-valid humanity token from the service key.
    const humanity = signHumanityToken(service.privateKeyHex, {
      version: 1,
      tokenId: '9'.repeat(64),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 1000).toISOString(),
    });
    // A real, individually-valid DM event from the author key.
    const dm = createDmMessage(author, {
      conversationId: peer.publicKey,
      body: 'private note',
      hlc: { wall: '2026-07-04T00:00:00.000Z', counter: 0 },
    });
    expect(verifyHumanityToken(humanity, service.publicKeyHex, now)).toBe('ok');
    expect(verifyDmMessage(dm)).toBe(true);

    // Cross-verification is cryptographically impossible: the DM signature over
    // 'meerkat-dm-message-v1' bytes cannot authenticate a humanity token, and vice versa.
    const dmAsHumanity = {
      version: 1,
      tokenId: dm.id.padEnd(64, '0').slice(0, 64),
      issuedAt: dm.hlc.wall,
      expiresAt: new Date(now + 1000).toISOString(),
      signature: dm.signature,
    } as HumanityToken;
    expect(verifyHumanityToken(dmAsHumanity, author.publicKey, now)).toBe('invalid');

    const humanityAsDm = {
      version: 1,
      id: 'x',
      conversationId: peer.publicKey,
      authorDeviceId: service.publicKeyHex,
      body: humanity.tokenId,
      hlc: { wall: humanity.issuedAt, counter: 0 },
      signature: humanity.signature,
    } as unknown as DmMessageEvent;
    expect(verifyDmMessage(humanityAsDm)).toBe(false);
  });

  it('a token re-signed under a foreign domain is rejected', () => {
    const now = Date.parse('2026-07-04T00:00:00.000Z');
    const unsigned = {
      version: 1 as const,
      tokenId: '2'.repeat(64),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 1000).toISOString(),
    };
    // Sign the SAME fields but under a different leading domain string.
    const foreignBytes = new TextEncoder().encode(
      JSON.stringify(['meerkat-not-humanity-v1', unsigned.version, unsigned.tokenId, unsigned.issuedAt, unsigned.expiresAt]),
    );
    const foreignSig = bytesToHex(signMessage(service.privateKeyHex, foreignBytes));
    const forged = { ...unsigned, signature: foreignSig } as HumanityToken;
    expect(verifyHumanityToken(forged, service.publicKeyHex, now)).toBe('invalid');
  });
});

// Silence unused import when the suite is trimmed; nacl anchors the seed-length assumption.
void nacl;
