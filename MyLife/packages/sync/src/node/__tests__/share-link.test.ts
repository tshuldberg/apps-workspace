import { describe, it, expect } from 'vitest';
import { buildShareLink, buildMagnetLink, parseShareLink } from '../share-link';

const key = new Uint8Array(32);
for (let i = 0; i < 32; i++) key[i] = (i * 7 + 1) & 0xff;

const parts = {
  contentId: 'abc123def456',
  linkKey: key,
  authorPublicKey: 'ed25519publickeyhex',
  name: 'My Shared File.txt',
};

describe('share links', () => {
  it('round-trips a meerkat:// link including the key bytes', () => {
    const link = buildShareLink(parts);
    expect(link.startsWith('meerkat://share/abc123def456?')).toBe(true);
    const parsed = parseShareLink(link);
    expect(parsed).not.toBeNull();
    expect(parsed!.contentId).toBe(parts.contentId);
    expect(parsed!.authorPublicKey).toBe(parts.authorPublicKey);
    expect(parsed!.name).toBe(parts.name);
    expect(Buffer.from(parsed!.linkKey).equals(Buffer.from(key))).toBe(true);
  });

  it('round-trips a magnet link', () => {
    const link = buildMagnetLink(parts);
    expect(link.startsWith('magnet:?')).toBe(true);
    const parsed = parseShareLink(link);
    expect(parsed).not.toBeNull();
    expect(parsed!.contentId).toBe(parts.contentId);
    expect(Buffer.from(parsed!.linkKey).equals(Buffer.from(key))).toBe(true);
  });

  it('returns null for malformed links', () => {
    expect(parseShareLink('https://example.com')).toBeNull();
    expect(parseShareLink('meerkat://share/onlyid')).toBeNull();
    expect(parseShareLink('magnet:?xt=urn:other:x')).toBeNull();
  });
});
