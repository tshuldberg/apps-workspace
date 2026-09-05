/**
 * End-to-end share-link host discovery (Task 1) over the real relay.
 *
 * A reachable seeder pins a sealed share into a NodeStore, serves it over real
 * HTTP (the NodeStore web-seed shape), and announces "I serve this contentId at
 * <url>" to a live relay. A fresh app that has only the share LINK -- no pasted
 * host -- looks the contentId up on the relay, gets the seeder's url back as a
 * candidate, fetches through the UNCHANGED fetchAndPinFromHosts -> openSealedShare
 * verify path, and the bytes decrypt to the original. Proves the real user win:
 * open a link with no pasted host when a real seeder has announced it.
 *
 * The relay only ever holds the opaque rid + sealed record; it never sees the
 * contentId or the host url.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';
import {
  announceHeldContent,
  buildShareLink,
  createSealedShare,
  fetchAndPinFromHosts,
  generateDeviceIdentity,
  httpNodeSource,
  InMemoryNodeStore,
  lookupContentHosts,
  parseShareLink,
  pinShare,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../server';
import { announceHeldShareContent } from '../seeder-node';
import { startNodeStoreHttp } from '../seeder-http';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// The sync registry-client uses the platform global WebSocket; in Node test we
// inject `ws`. (Node 22+ has a global WebSocket, but injecting keeps it pinned.)
const WS = WebSocket as unknown as new (url: string) => unknown;

// A real Node `fetch`-like client for the seeder's plain HTTP server.
const httpFetch = ((url: string) =>
  new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
          status: res.statusCode ?? 500,
          statusText: res.statusMessage ?? '',
          json: async () => JSON.parse(body),
          text: async () => body,
        });
      });
    });
    req.on('error', reject);
  })) as unknown as typeof fetch;

let relay: RelayServer | null = null;
let seeder: { url: string; close: () => Promise<void> } | null = null;

afterEach(async () => {
  if (relay) {
    await relay.close();
    relay = null;
  }
  if (seeder) {
    await seeder.close();
    seeder = null;
  }
});

describe('share-link host discovery e2e (Task 1)', () => {
  it('a fresh app with only the link discovers the seeder, fetches, verifies, and pins', async () => {
    relay = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const relayUrl = `ws://127.0.0.1:${relay.port}`;

    // 1) A seeder pins a sealed share into a NodeStore and serves it over HTTP.
    const author = generateDeviceIdentity('Seeder Author');
    const { share, linkKey } = createSealedShare(encoder.encode('discoverable secret'), {
      name: 'discovered.txt',
      identity: author,
      chunkSize: 16,
    });
    const seederStore = new InMemoryNodeStore();
    await pinShare(seederStore, share);
    seeder = await startNodeStoreHttp({ store: seederStore, host: '127.0.0.1' });

    const link = buildShareLink({
      contentId: share.manifest.contentId,
      linkKey,
      authorPublicKey: author.publicKey,
      name: share.manifest.name,
    });

    // 2) The seeder announces "I serve this contentId at <my url>" to the relay.
    await announceHeldContent({
      url: relayUrl,
      contentId: share.manifest.contentId,
      hostUrl: seeder.url,
      webSocketImpl: WS as never,
    });

    // 3) A FRESH app has only the link (parsed). With NO pasted host, it asks the
    //    relay which hosts have announced this content.
    const parts = parseShareLink(link)!;
    const discovered = await lookupContentHosts({
      url: relayUrl,
      contentId: parts.contentId,
      webSocketImpl: WS as never,
    });
    expect(discovered).toEqual([seeder.url]);

    // 4) Drive the FULL unchanged verify-then-pin path over the discovered host.
    const appStore = new InMemoryNodeStore();
    const result = await fetchAndPinFromHosts(
      discovered.map((host) => httpNodeSource(host, httpFetch)),
      appStore,
      parts.contentId,
      parts.linkKey,
      { expectedAuthor: parts.authorPublicKey },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pinned).toBe(true);
      expect(result.name).toBe('discovered.txt');
      expect(decoder.decode(result.content)).toBe('discoverable secret');
    }
    await expect(appStore.getManifest(parts.contentId)).resolves.not.toBeNull();
  });

  it('a never-announced contentId returns no candidate hosts', async () => {
    relay = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const relayUrl = `ws://127.0.0.1:${relay.port}`;
    const hosts = await lookupContentHosts({
      url: relayUrl,
      contentId: 'content-nobody-announced',
      webSocketImpl: WS as never,
    });
    expect(hosts).toEqual([]);
  });

  it('the seeder helper announces a NodeStore-shaped url backed by startNodeStoreHttp, openable end to end (readiness #3)', async () => {
    // The relay-image-deps test injects the global WebSocket; announceHeldShareContent
    // uses the global, so pin it for the duration of this test.
    (globalThis as { WebSocket?: unknown }).WebSocket = WS;
    try {
      relay = await startRelayServer({ port: 0, host: '127.0.0.1' });
      const relayUrl = `ws://127.0.0.1:${relay.port}`;

      // 1) A seeder pins TWO sealed shares into a NodeStore and serves that store
      //    over the NodeStore web-seed shape (the binding the helper assumes).
      const author = generateDeviceIdentity('Helper Seeder');
      const a = createSealedShare(encoder.encode('first share'), {
        name: 'a.txt', identity: author, chunkSize: 16,
      });
      const b = createSealedShare(encoder.encode('second share'), {
        name: 'b.txt', identity: author, chunkSize: 16,
      });
      const seederStore = new InMemoryNodeStore();
      await pinShare(seederStore, a.share);
      await pinShare(seederStore, b.share);
      const seedServer = await startNodeStoreHttp({ store: seederStore, host: '127.0.0.1' });
      seeder = seedServer;

      // 2) The seeder-side HELPER announces every contentId in the store at its
      //    NodeStore-shaped public base url. It reads the store's manifests, so it
      //    cannot announce anything the host does not genuinely serve.
      const results = await announceHeldShareContent(
        { relayUrl, publicBaseUrl: seedServer.url },
        seederStore,
      );
      expect(results.every((r) => r.ok)).toBe(true);
      expect(results.map((r) => r.contentId).sort()).toEqual(
        [a.share.manifest.contentId, b.share.manifest.contentId].sort(),
      );

      // 3) A fresh app with only the first link discovers the seeder url and opens
      //    it through the UNCHANGED verify-then-pin path -- proving the announced
      //    shape is exactly what httpNodeSource fetches.
      const link = buildShareLink({
        contentId: a.share.manifest.contentId,
        linkKey: a.linkKey,
        authorPublicKey: author.publicKey,
        name: a.share.manifest.name,
      });
      const parts = parseShareLink(link)!;
      const discovered = await lookupContentHosts({
        url: relayUrl,
        contentId: parts.contentId,
        webSocketImpl: WS as never,
      });
      expect(discovered).toEqual([seedServer.url]);

      const appStore = new InMemoryNodeStore();
      const opened = await fetchAndPinFromHosts(
        discovered.map((host) => httpNodeSource(host, httpFetch)),
        appStore,
        parts.contentId,
        parts.linkKey,
        { expectedAuthor: parts.authorPublicKey },
      );
      expect(opened.ok).toBe(true);
      if (opened.ok) {
        expect(opened.pinned).toBe(true);
        expect(decoder.decode(opened.content)).toBe('first share');
      }
    } finally {
      delete (globalThis as { WebSocket?: unknown }).WebSocket;
    }
  });
});
