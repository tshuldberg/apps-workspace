// App-level node-core flow tests.
//
// These exercise the exact @mylife/sync surface the Meerkat app screens call,
// end to end, against the InMemoryNodeStore so no SQLite or native module is
// needed. They are the evidence that the app's seal -> pin -> link -> open path
// works as wired (the screens are thin wrappers over these calls).

import { describe, it, expect } from 'vitest';
import { decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import {
  InMemoryNodeStore,
  buildMagnetLink,
  buildShareLink,
  createSealedShare,
  fetchFromStore,
  generateDeviceIdentity,
  generateFriendCode,
  getPublicKeyFingerprint,
  isValidFriendCode,
  openSealedShare,
  parseFriendCode,
  parseShareLink,
  pinShare,
  unpinShare,
} from '@mylife/sync';

function decode(bytes: Uint8Array): string {
  return encodeUTF8(bytes);
}

describe('Meerkat node-core app flow', () => {
  it('generates an identity with a stable fingerprint', () => {
    const identity = generateDeviceIdentity('My Meerkat');
    expect(identity.publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(identity.displayName).toBe('My Meerkat');
    const fp = getPublicKeyFingerprint(identity.publicKey);
    expect(fp).toMatch(/^[0-9a-f]{8}$/);
    expect(getPublicKeyFingerprint(identity.publicKey)).toBe(fp);
  });

  it('round-trips a friend code through parse', () => {
    const { code, rendezvousId } = generateFriendCode();
    expect(code).toMatch(/^MEER-/);
    expect(isValidFriendCode(code)).toBe(true);
    const parsed = parseFriendCode(code);
    expect(parsed).not.toBeNull();
    expect(Array.from(parsed!)).toEqual(Array.from(rendezvousId));
  });

  it('rejects a friend code with a broken checksum', () => {
    const { code } = generateFriendCode();
    // Flip a payload character to a different valid base32 char.
    const idx = code.length - 1;
    const last = code[idx]!;
    const replacement = last === 'Z' ? 'Y' : 'Z';
    const tampered = code.slice(0, idx) + replacement;
    expect(isValidFriendCode(tampered)).toBe(false);
  });

  it('seals, pins, builds a link, parses it, and fetches the content back', async () => {
    const store = new InMemoryNodeStore();
    const identity = generateDeviceIdentity('Author Device');
    const message = 'the eagle lands at dawn';

    const { share, linkKey } = createSealedShare(decodeUTF8(message), {
      name: 'note',
      identity,
      scope: 'published_blob',
    });
    const record = await pinShare(store, share);
    expect(record.contentId).toBe(share.manifest.contentId);

    const link = buildShareLink({
      contentId: share.manifest.contentId,
      linkKey,
      authorPublicKey: identity.publicKey,
      name: 'note',
    });
    expect(link.startsWith('meerkat://share/')).toBe(true);

    const parts = parseShareLink(link);
    expect(parts).not.toBeNull();
    expect(parts!.contentId).toBe(share.manifest.contentId);
    expect(parts!.authorPublicKey).toBe(identity.publicKey);

    const result = await fetchFromStore(store, parts!.contentId, parts!.linkKey);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(decode(result.content)).toBe(message);
    }
  });

  it('produces a magnet link that parses to the same parts as the meerkat link', () => {
    const identity = generateDeviceIdentity('Author Device');
    const { share, linkKey } = createSealedShare(decodeUTF8('hello'), {
      name: 'greeting',
      identity,
    });
    const parts = {
      contentId: share.manifest.contentId,
      linkKey,
      authorPublicKey: identity.publicKey,
      name: 'greeting',
    };
    const fromMeerkat = parseShareLink(buildShareLink(parts));
    const fromMagnet = parseShareLink(buildMagnetLink(parts));
    expect(fromMeerkat).not.toBeNull();
    expect(fromMagnet).not.toBeNull();
    expect(fromMagnet!.contentId).toBe(fromMeerkat!.contentId);
    expect(fromMagnet!.authorPublicKey).toBe(fromMeerkat!.authorPublicKey);
    expect(Array.from(fromMagnet!.linkKey)).toEqual(Array.from(fromMeerkat!.linkKey));
  });

  it('fails closed when the sealed ciphertext is tampered', async () => {
    const identity = generateDeviceIdentity('Author Device');
    const { share, linkKey } = createSealedShare(decodeUTF8('secret payload'), {
      name: 'secret',
      identity,
    });

    // Corrupt the first block's ciphertext before opening.
    const tampered = {
      ...share,
      sealedChunks: share.sealedChunks.map((c, i) =>
        i === 0 ? { ...c, payload: `${c.payload}AAAA` } : c,
      ),
    };
    const result = openSealedShare(tampered, linkKey);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('rejects opening with the wrong link key', async () => {
    const identity = generateDeviceIdentity('Author Device');
    const { share } = createSealedShare(decodeUTF8('classified'), {
      name: 'doc',
      identity,
    });
    const wrongKey = new Uint8Array(32).fill(7);
    const result = openSealedShare(share, wrongKey);
    expect(result.ok).toBe(false);
  });

  it('rejects an open when the expected author does not match', async () => {
    const identity = generateDeviceIdentity('Author Device');
    const other = generateDeviceIdentity('Other Device');
    const { share, linkKey } = createSealedShare(decodeUTF8('mine'), {
      name: 'doc',
      identity,
    });
    const result = openSealedShare(share, linkKey, { expectedAuthor: other.publicKey });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('author-mismatch');
    }
  });

  it('returns content-not-pinned when fetching an unknown content id', async () => {
    const store = new InMemoryNodeStore();
    const result = await fetchFromStore(store, 'deadbeef', new Uint8Array(32));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('content-not-pinned');
    }
  });

  it('unpins content so it can no longer be fetched', async () => {
    const store = new InMemoryNodeStore();
    const identity = generateDeviceIdentity('Author Device');
    const { share, linkKey } = createSealedShare(decodeUTF8('temporary'), {
      name: 'temp',
      identity,
    });
    await pinShare(store, share);

    const before = await fetchFromStore(store, share.manifest.contentId, linkKey);
    expect(before.ok).toBe(true);

    await unpinShare(store, share.manifest.contentId);
    const after = await fetchFromStore(store, share.manifest.contentId, linkKey);
    expect(after.ok).toBe(false);

    const stats = await store.stats();
    expect(stats.manifestCount).toBe(0);
    expect(stats.blockCount).toBe(0);
  });

  it('tracks stats across multiple pinned shares', async () => {
    const store = new InMemoryNodeStore();
    const identity = generateDeviceIdentity('Author Device');
    for (const text of ['alpha', 'bravo', 'charlie']) {
      const { share } = createSealedShare(decodeUTF8(text), { name: text, identity });
      await pinShare(store, share);
    }
    const stats = await store.stats();
    expect(stats.manifestCount).toBe(3);
    expect(stats.blockCount).toBeGreaterThanOrEqual(3);
    expect(stats.totalBytes).toBeGreaterThan(0);

    const list = await store.listManifests();
    expect(list).toHaveLength(3);
    expect(list.map((m) => m.name).sort()).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('preserves multi-chunk content through a small chunk size', async () => {
    const store = new InMemoryNodeStore();
    const identity = generateDeviceIdentity('Author Device');
    const big = 'x'.repeat(5000);
    const { share, linkKey } = createSealedShare(decodeUTF8(big), {
      name: 'large',
      identity,
      chunkSize: 512,
    });
    expect(share.sealedChunks.length).toBeGreaterThan(1);
    await pinShare(store, share);
    const result = await fetchFromStore(store, share.manifest.contentId, linkKey);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(decode(result.content)).toBe(big);
    }
  });
});
