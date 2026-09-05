import { describe, it, expect } from 'vitest';
import { createHmac, hkdfSync } from 'node:crypto';
import { hmacSha512, hkdf, sha512Hex } from '../hkdf';

const enc = (s: string) => new TextEncoder().encode(s);

describe('hmacSha512', () => {
  it('matches Node crypto HMAC-SHA512 (known-answer cross-check)', () => {
    const key = enc('meerkat-test-key');
    const msg = enc('the quick brown fox');
    const mine = Buffer.from(hmacSha512(key, msg)).toString('hex');
    const node = createHmac('sha512', Buffer.from(key)).update(Buffer.from(msg)).digest('hex');
    expect(mine).toBe(node);
  });

  it('matches Node for an over-long key (key > block size triggers pre-hash)', () => {
    const key = enc('x'.repeat(200));
    const msg = enc('payload');
    const mine = Buffer.from(hmacSha512(key, msg)).toString('hex');
    const node = createHmac('sha512', Buffer.from(key)).update(Buffer.from(msg)).digest('hex');
    expect(mine).toBe(node);
  });
});

describe('hkdf (RFC 5869 over SHA-512)', () => {
  it('matches Node hkdfSync for the zero-salt path', () => {
    const ikm = enc('input-key-material');
    const info = 'meerkat-node-chunk:v1:abc:0';
    const mine = Buffer.from(hkdf(ikm, info, null, 32)).toString('hex');
    const node = Buffer.from(
      hkdfSync('sha512', Buffer.from(ikm), Buffer.alloc(0), Buffer.from(enc(info)), 32),
    ).toString('hex');
    expect(mine).toBe(node);
  });

  it('matches Node hkdfSync with an explicit salt and a longer length', () => {
    const ikm = enc('shared-secret');
    const salt = enc('some-salt-value');
    const info = 'workspace-key';
    const mine = Buffer.from(hkdf(ikm, info, salt, 64)).toString('hex');
    const node = Buffer.from(
      hkdfSync('sha512', Buffer.from(ikm), Buffer.from(salt), Buffer.from(enc(info)), 64),
    ).toString('hex');
    expect(mine).toBe(node);
  });

  it('derives distinct keys for distinct info strings', () => {
    const ikm = enc('same-ikm');
    const a = Buffer.from(hkdf(ikm, 'context:a')).toString('hex');
    const b = Buffer.from(hkdf(ikm, 'context:b')).toString('hex');
    expect(a).not.toBe(b);
  });

  it('is deterministic', () => {
    const ikm = enc('det');
    expect(Buffer.from(hkdf(ikm, 'i')).toString('hex')).toBe(
      Buffer.from(hkdf(ikm, 'i')).toString('hex'),
    );
  });
});

describe('sha512Hex', () => {
  it('matches the empty-input SHA-512 digest', () => {
    // Known SHA-512('') prefix.
    expect(sha512Hex(new Uint8Array(0))).toMatch(/^cf83e1357eefb8bd/);
  });
  it('changes with input', () => {
    expect(sha512Hex(enc('a'))).not.toBe(sha512Hex(enc('b')));
  });
});
