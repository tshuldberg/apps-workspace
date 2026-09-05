/**
 * MK-032 -- community catalog + seeding protocol. The ACs:
 *  - 2-host community: shards balance rarest-first;
 *  - killing one host keeps the catalog available;
 *  - a web seed (HTTP) serves the cold start, hash-verified end to end.
 */

import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { generateDeviceIdentity, extractSigningPrivateKeyHex } from '../identity/device-identity';
import { verifyManifest } from '../torrent/manifest';
import {
  applyPlacement,
  buildCommunityCatalog,
  catalogAvailability,
  catalogPieceBytes,
  fetchCatalogFromWebSeed,
  planReplicaPlacement,
  verifyCatalogPiece,
  type CatalogHostState,
  type CommunityCatalog,
} from '../torrent/community-catalog';

const PIECE = 1024;

function makeCatalog(sizeBytes = 10 * PIECE, webSeeds: string[] = []): CommunityCatalog {
  const owner = generateDeviceIdentity('Catalog Owner');
  const data = new Uint8Array(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) data[i] = (i * 13 + 5) % 251;
  return buildCommunityCatalog({
    communityName: 'Surf Club',
    entries: [{ path: 'archive.bin', data, mimeType: 'application/octet-stream' }],
    creatorPublicKey: owner.publicKey,
    creatorDisplayName: owner.displayName,
    creatorPrivateKey: extractSigningPrivateKeyHex(owner.privateKeyRef),
    pieceLength: PIECE,
    webSeeds,
  });
}

const host = (hostId: string, capacityBytes = 0): CatalogHostState =>
  ({ hostId, pieces: new Set<number>(), capacityBytes, alive: true });

/**
 * Explicit HTTP transport for the web-seed tests: the global-fetch guard
 * demands tests wire their I/O deliberately, and WebSeedClient takes a fetchFn
 * for exactly that. Real HTTP over real localhost sockets via node:http.
 */
const httpFetch = ((url: string) =>
  new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          ok: (res.statusCode ?? 500) < 400,
          status: res.statusCode ?? 500,
          statusText: res.statusMessage ?? '',
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        });
      });
    });
    req.on('error', reject);
  })) as unknown as typeof fetch;

describe('catalog build + integrity (MK-032)', () => {
  it('builds a signed Merkle manifest whose pieces verify individually', () => {
    const catalog = makeCatalog();
    expect(verifyManifest(catalog.manifest)).toBe(true);
    expect(catalog.manifest.pieces).toHaveLength(10);
    for (let i = 0; i < catalog.manifest.pieces.length; i++) {
      expect(verifyCatalogPiece(catalog.manifest, i, catalogPieceBytes(catalog, i))).toBe(true);
    }
    // A tampered piece fails verification (hosts are untrusted-but-verifiable).
    const evil = catalogPieceBytes(catalog, 0);
    evil[0]! ^= 0xff;
    expect(verifyCatalogPiece(catalog.manifest, 0, evil)).toBe(false);
  });
});

describe('rarest-first replica placement (MK-032 AC)', () => {
  it('2 hosts at replication 1: shards balance evenly across both', () => {
    const catalog = makeCatalog();
    const hosts = [host('host-a'), host('host-b')];
    const plan = planReplicaPlacement(catalog.manifest, hosts, 1);
    applyPlacement(hosts, plan);

    const a = hosts[0]!.pieces.size;
    const b = hosts[1]!.pieces.size;
    expect(a + b).toBe(10); // every piece placed exactly once
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1); // balanced
    expect(plan.underReplicated).toEqual([]);
  });

  it('2 hosts at replication 2: every piece lands on both; killing one host keeps the catalog available', () => {
    const catalog = makeCatalog();
    const hosts = [host('host-a'), host('host-b')];
    const plan = planReplicaPlacement(catalog.manifest, hosts, 2);
    applyPlacement(hosts, plan);

    expect(hosts[0]!.pieces.size).toBe(10);
    expect(hosts[1]!.pieces.size).toBe(10);
    expect(catalogAvailability(catalog.manifest, hosts).minReplication).toBe(2);

    // The AC: one host dies; the catalog stays fully available on the other.
    hosts[0]!.alive = false;
    const after = catalogAvailability(catalog.manifest, hosts);
    expect(after.available).toBe(true);
    expect(after.missingPieces).toEqual([]);
    expect(after.minReplication).toBe(1);
  });

  it('negative control: at replication 1, killing a host exposes exactly its shard', () => {
    const catalog = makeCatalog();
    const hosts = [host('host-a'), host('host-b')];
    applyPlacement(hosts, planReplicaPlacement(catalog.manifest, hosts, 1));
    const aPieces = [...hosts[0]!.pieces].sort((x, y) => x - y);

    hosts[0]!.alive = false;
    const after = catalogAvailability(catalog.manifest, hosts);
    expect(after.available).toBe(false);
    expect(after.missingPieces).toEqual(aPieces);
  });

  it('replicates the RAREST pieces first when capacity is scarce', () => {
    const catalog = makeCatalog();
    // host-a already holds pieces 0..7; pieces 8 and 9 have zero copies.
    const a = host('host-a');
    for (let i = 0; i <= 7; i++) a.pieces.add(i);
    // host-b only has room for two pieces.
    const b = host('host-b', 2 * PIECE);
    const plan = planReplicaPlacement(catalog.manifest, [a, b], 2);

    // The two slots go to the zero-copy pieces, not to re-replicating 0..7.
    expect(plan.assignments.get('host-b')!.sort((x, y) => x - y)).toEqual([8, 9]);
    // Everything else could not reach replication 2 (b is full) -- reported.
    expect(plan.underReplicated.sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('respects a host storage cap exactly', () => {
    const catalog = makeCatalog();
    const only = host('tiny', 3 * PIECE);
    const plan = planReplicaPlacement(catalog.manifest, [only], 1);
    applyPlacement([only], plan);
    expect(only.pieces.size).toBe(3);
    expect(plan.underReplicated).toHaveLength(7);
  });
});

describe('web-seed cold start (MK-032 AC)', () => {
  let server: http.Server | null = null;
  afterEach(async () => {
    if (server) await new Promise<void>((r) => server!.close(() => r()));
    server = null;
  });

  it('a fresh member fetches and verifies the whole catalog over plain HTTP', async () => {
    // Build first so the catalog bytes exist; the server serves per-piece URLs
    // ({base}/{infoHash}/{index}) straight from them.
    const seedless = makeCatalog(5 * PIECE);
    server = http.createServer((req, res) => {
      const match = /^\/([0-9a-f]+)\/(\d+)$/.exec(req.url ?? '');
      if (!match || match[1] !== seedless.manifest.infoHash) {
        res.writeHead(404).end();
        return;
      }
      const piece = catalogPieceBytes(seedless, Number(match[2]));
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.end(Buffer.from(piece));
    });
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as { port: number }).port;

    // The manifest a joiner receives advertises the web seed.
    const manifest = { ...seedless.manifest, webSeeds: [`http://127.0.0.1:${port}`] };

    const result = await fetchCatalogFromWebSeed(manifest, { fetchFn: httpFetch });
    expect(result.ok).toBe(true);
    expect(result.failedPieces).toEqual([]);
    expect(result.bytes).toEqual(seedless.bytes);
  });

  it('a corrupting web seed is caught by per-piece verification', async () => {
    const seedless = makeCatalog(3 * PIECE);
    server = http.createServer((req, res) => {
      const match = /^\/[0-9a-f]+\/(\d+)$/.exec(req.url ?? '');
      const index = Number(match?.[1] ?? 0);
      const piece = catalogPieceBytes(seedless, index);
      if (index === 1) piece[0]! ^= 0xff; // serve one corrupted piece
      res.writeHead(200).end(Buffer.from(piece));
    });
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as { port: number }).port;
    const manifest = { ...seedless.manifest, webSeeds: [`http://127.0.0.1:${port}`] };

    const result = await fetchCatalogFromWebSeed(manifest, { fetchFn: httpFetch });
    expect(result.ok).toBe(false);
    expect(result.failedPieces).toEqual([1]);
    expect(result.bytes).toBeNull();
  });
});
