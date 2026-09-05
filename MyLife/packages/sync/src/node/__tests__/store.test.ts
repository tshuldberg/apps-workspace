import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../../identity/device-identity';
import { createSealedShare } from '../sealed-share';
import {
  InMemoryNodeStore,
  pinShare,
  fetchFromStore,
  loadSealedShare,
  unpinShare,
} from '../store';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe('node store (local seeding substrate)', () => {
  it('pins a share then fetches and decrypts it with the link key', async () => {
    const author = generateDeviceIdentity('Author');
    const content = enc('seed me across the mesh');
    const { share, linkKey } = createSealedShare(content, { name: 's', identity: author });

    const store = new InMemoryNodeStore();
    const record = await pinShare(store, share);
    expect(record.sealedChunkIds.length).toBe(share.sealedChunks.length);

    const stats = await store.stats();
    expect(stats.blockCount).toBe(share.sealedChunks.length);
    expect(stats.manifestCount).toBe(1);
    expect(stats.totalBytes).toBeGreaterThan(0);

    const result = await fetchFromStore(store, share.manifest.contentId, linkKey);
    expect(result.ok).toBe(true);
    if (result.ok) expect(dec(result.content)).toBe(dec(content));
  });

  it('reports content-not-pinned after unpinning', async () => {
    const author = generateDeviceIdentity('Author');
    const { share, linkKey } = createSealedShare(enc('temporary'), { name: 't', identity: author });
    const store = new InMemoryNodeStore();
    await pinShare(store, share);
    await unpinShare(store, share.manifest.contentId);

    const result = await fetchFromStore(store, share.manifest.contentId, linkKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('content-not-pinned');
    expect((await store.stats()).blockCount).toBe(0);
  });

  it('returns null when a block is missing (incomplete seed)', async () => {
    const author = generateDeviceIdentity('Author');
    const { share } = createSealedShare(enc('partial'), { name: 'p', identity: author });
    const store = new InMemoryNodeStore();
    await pinShare(store, share);
    await store.deleteBlock(share.sealedChunks[0]!.sealedId);
    expect(await loadSealedShare(store, share.manifest.contentId)).toBeNull();
  });

  it('coexists across two contexts and refcounts blocks on unpin (Plan 38 D.4)', async () => {
    // The load-bearing D.4 test: the SAME share pinned under 'default' and a
    // community context share their sealed blocks. Unpinning one context leaves
    // the other context's manifest AND the blocks intact; unpinning both frees
    // the blocks.
    const author = generateDeviceIdentity('Author');
    const content = enc('library object shared into two workspaces');
    const { share, linkKey } = createSealedShare(content, { name: 'obj', identity: author, chunkSize: 8 });
    const chunkIds = share.sealedChunks.map((c) => c.sealedId);
    expect(chunkIds.length).toBeGreaterThan(1);

    const store = new InMemoryNodeStore();
    await pinShare(store, share, 'default');
    await pinShare(store, share, 'ws-b');

    // Both pins coexist as distinct manifests; the blocks are one physical set.
    expect(await store.getManifest(share.manifest.contentId, 'default')).not.toBeNull();
    expect(await store.getManifest(share.manifest.contentId, 'ws-b')).not.toBeNull();
    for (const id of chunkIds) expect(await store.blockRefCount(id)).toBe(2);
    const stats2 = await store.stats();
    expect(stats2.manifestCount).toBe(2);
    expect(stats2.blockCount).toBe(chunkIds.length); // physical blocks, deduped

    // Unpin ONE context: the other manifest and every block survive.
    await unpinShare(store, share.manifest.contentId, 'default');
    expect(await store.getManifest(share.manifest.contentId, 'default')).toBeNull();
    expect(await store.getManifest(share.manifest.contentId, 'ws-b')).not.toBeNull();
    for (const id of chunkIds) {
      expect(await store.blockRefCount(id)).toBe(1);
      expect(await store.hasBlock(id)).toBe(true);
    }
    // The surviving context can still open the content end to end.
    const opened = await fetchFromStore(store, share.manifest.contentId, linkKey, undefined, 'ws-b');
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(dec(opened.content)).toBe(dec(content));

    // Unpin the LAST context: blocks are freed.
    await unpinShare(store, share.manifest.contentId, 'ws-b');
    for (const id of chunkIds) {
      expect(await store.blockRefCount(id)).toBe(0);
      expect(await store.hasBlock(id)).toBe(false);
    }
    const stats0 = await store.stats();
    expect(stats0.manifestCount).toBe(0);
    expect(stats0.blockCount).toBe(0);
    expect(stats0.totalBytes).toBe(0);
  });

  it('defaults to the default context and records the explicit pin class', async () => {
    const author = generateDeviceIdentity('Author');
    const { share } = createSealedShare(enc('legacy caller'), { name: 'l', identity: author });
    const store = new InMemoryNodeStore();
    // No context passed -> the DEFAULT_PIN_CONTEXT pin, readable both ways.
    await pinShare(store, share);
    expect(await store.getManifest(share.manifest.contentId)).not.toBeNull();
    expect(await store.getManifest(share.manifest.contentId, 'default')).not.toBeNull();
    const record = await store.getManifest(share.manifest.contentId);
    expect(record?.pinClass).toBe('explicit');
    // A second pin under a different context does not collide with the default.
    await pinShare(store, share, 'ws-x', 'policy');
    expect((await store.getManifest(share.manifest.contentId, 'ws-x'))?.pinClass).toBe('policy');
    expect((await store.listManifests('ws-x')).length).toBe(1);
    expect((await store.listManifests()).length).toBe(2);
  });

  it('a second node that receives the blocks + link reconstructs the content', async () => {
    // Simulates a seeder handing ciphertext blocks to a fresh node, which then
    // opens them with the out-of-band link key. No transport yet; this is the
    // logic that transport will carry.
    const author = generateDeviceIdentity('Author');
    const content = enc('crosses between two stores');
    const { share, linkKey } = createSealedShare(content, { name: 'x', identity: author });

    const seeder = new InMemoryNodeStore();
    await pinShare(seeder, share);

    const peer = new InMemoryNodeStore();
    const seededShare = await loadSealedShare(seeder, share.manifest.contentId);
    expect(seededShare).not.toBeNull();
    await pinShare(peer, seededShare!);

    const result = await fetchFromStore(peer, share.manifest.contentId, linkKey, {
      expectedAuthor: author.publicKey,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(dec(result.content)).toBe(dec(content));
  });
});
