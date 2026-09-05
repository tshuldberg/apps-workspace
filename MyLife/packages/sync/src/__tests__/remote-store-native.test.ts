/**
 * Readiness gap #1 proof: a share link from another device/friend resolves over
 * the network, not just from the local pin.
 *
 * Everything imports from `index.native` (the RN-safe surface) and runs with an
 * INJECTED fetch (no node:http) over the pure-JS crypto. A host pins a sealed
 * share into its NodeStore and serves it with `handleNodeStoreHttp`; a fresh
 * device that only holds the share LINK fetches the manifest + blocks with
 * `httpNodeSource`, reassembles, and opens it fail-closed. This is exactly what
 * the app's "Open link" path can now call when `fetchFromStore` returns
 * `content-not-pinned`.
 */

import { describe, it, expect } from 'vitest';
import {
  generateDeviceIdentity,
  createSealedShare,
  buildShareLink,
  parseShareLink,
  InMemoryNodeStore,
  pinShare,
  fetchAndPinFromHosts,
  fetchFromHosts,
  fetchFromStore,
  httpNodeSource,
  handleNodeStoreHttp,
  type NodeStore,
} from '../index.native';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array): string => new TextDecoder().decode(b);

/** An injected fetch that serves a NodeStore via the pure server adapter. */
function storeFetch(store: NodeStore, mutate?: (path: string, body: string) => string): typeof fetch {
  return (async (url: string) => {
    const path = new URL(String(url)).pathname;
    const r = await handleNodeStoreHttp(store, path);
    if (!r) {
      return { ok: false, status: 404, statusText: 'not found', json: async () => ({}), text: async () => '' };
    }
    const body = mutate ? mutate(path, r.body) : r.body;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: 'OK',
      json: async () => JSON.parse(body),
      text: async () => body,
    };
  }) as unknown as typeof fetch;
}

/** Pin some content on a fresh host and return the share link parts + host store. */
async function publish(text: string, name = 'note.txt') {
  const author = generateDeviceIdentity('Author');
  const { share, linkKey } = createSealedShare(enc(text), { name, identity: author, chunkSize: 16 });
  const store = new InMemoryNodeStore();
  await pinShare(store, share);
  const link = buildShareLink({
    contentId: share.manifest.contentId,
    linkKey,
    authorPublicKey: share.manifest.authorPublicKey,
    name: share.manifest.name,
  });
  return { store, link, author };
}

describe('remote sealed-share fetch over the RN-safe barrel (gap #1)', () => {
  it('a device with only the link fetches + opens content from a remote host', async () => {
    const body = 'the quick brown fox jumps over the lazy dog'; // > one 16-byte chunk
    const { store, link } = await publish(body);

    const parts = parseShareLink(link)!;
    const result = await fetchFromHosts(
      [httpNodeSource('http://host.example', storeFetch(store))],
      parts.contentId,
      parts.linkKey,
      { expectedAuthor: parts.authorPublicKey },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(dec(result.content)).toBe(body);
      expect(result.name).toBe('note.txt');
    }
  });

  it('pins verified remote content into the local node store', async () => {
    const body = 'remote content becomes a local seed after verification';
    const { store, link } = await publish(body);
    const parts = parseShareLink(link)!;
    const localStore = new InMemoryNodeStore();

    const result = await fetchAndPinFromHosts(
      [httpNodeSource('http://host.example', storeFetch(store))],
      localStore,
      parts.contentId,
      parts.linkKey,
      { expectedAuthor: parts.authorPublicKey },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pinned).toBe(true);
      expect(dec(result.content)).toBe(body);
    }
    const local = await fetchFromStore(localStore, parts.contentId, parts.linkKey);
    expect(local.ok).toBe(true);
    if (local.ok) expect(dec(local.content)).toBe(body);
  });

  it('fails over from an incomplete host to a complete one', async () => {
    const body = 'failover payload that spans several sealed blocks';
    const { store, link } = await publish(body);
    const parts = parseShareLink(link)!;

    // An incomplete host: has the manifest index but is missing one block.
    const incomplete = new InMemoryNodeStore();
    const record = (await store.getManifest(parts.contentId))!;
    await incomplete.putManifest(record);
    for (let i = 0; i < record.sealedChunkIds.length - 1; i++) {
      const id = record.sealedChunkIds[i]!;
      await incomplete.putBlock({ sealedId: id, payload: (await store.getBlock(id))! });
    }

    const result = await fetchFromHosts(
      [httpNodeSource('http://incomplete', storeFetch(incomplete)), httpNodeSource('http://good', storeFetch(store))],
      parts.contentId,
      parts.linkKey,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(dec(result.content)).toBe(body);
  });

  it('rejects a host that serves tampered blocks (fail-closed)', async () => {
    const { store, link } = await publish('secret bytes that must verify');
    const parts = parseShareLink(link)!;

    // Flip a character inside every served block payload.
    const tamper = storeFetch(store, (path, b) => (path.startsWith('/block/') ? `${b.slice(0, -1)}A` : b));
    const result = await fetchFromHosts(
      [httpNodeSource('http://evil', tamper)],
      parts.contentId,
      parts.linkKey,
    );

    expect(result.ok).toBe(false);
  });

  it('rejects the wrong link key (fail-closed)', async () => {
    const { store, link } = await publish('hello');
    const parts = parseShareLink(link)!;
    const wrongKey = new Uint8Array(parts.linkKey.length); // all zeros

    const result = await fetchFromHosts(
      [httpNodeSource('http://host', storeFetch(store))],
      parts.contentId,
      wrongKey,
    );
    expect(result.ok).toBe(false);
  });

  it('reports no-hosts / content-unavailable cleanly', async () => {
    const { link } = await publish('x');
    const parts = parseShareLink(link)!;

    const none = await fetchFromHosts([], parts.contentId, parts.linkKey);
    expect(none).toEqual({ ok: false, reason: 'no-hosts' });

    const empty = await fetchFromHosts(
      [httpNodeSource('http://empty', storeFetch(new InMemoryNodeStore()))],
      parts.contentId,
      parts.linkKey,
    );
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toBe('content-unavailable');
  });

  it('handleNodeStoreHttp returns null for non-store paths (host can fall through)', async () => {
    const store = new InMemoryNodeStore();
    expect(await handleNodeStoreHttp(store, '/healthz')).toBeNull();
    expect(await handleNodeStoreHttp(store, '/some/other/path')).toBeNull();
  });
});
