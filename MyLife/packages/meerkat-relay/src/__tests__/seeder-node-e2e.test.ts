/**
 * MK-031 acceptance: a node seeds a pinned community and a MEMBER FETCH SUCCEEDS
 * over the real HTTP web seed while no other member is online -- the node alone
 * serves the catalog, verified end to end by the existing client.
 */

import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import {
  buildCommunityCatalog,
  fetchCatalogFromWebSeed,
  generateDeviceIdentity,
  extractSigningPrivateKeyHex,
  type CommunityCatalog,
} from '@mylife/sync';
import { MeerkatSeederNode, InMemorySeederPieceStore } from '../seeder-node';
import { startSeederHttp, type SeederHttpServer } from '../seeder-http';

const PIECE = 4096;

/** Explicit node:http fetchFn: the repo's vitest guard stubs global fetch. */
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

function catalog(sizeBytes = 20 * PIECE): CommunityCatalog {
  const owner = generateDeviceIdentity('Community Owner');
  const data = new Uint8Array(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) data[i] = (i * 17 + 3) % 251;
  return buildCommunityCatalog({
    communityName: 'Always-On Club',
    entries: [{ path: 'archive.bin', data, mimeType: 'application/octet-stream' }],
    creatorPublicKey: owner.publicKey,
    creatorDisplayName: owner.displayName,
    creatorPrivateKey: extractSigningPrivateKeyHex(owner.privateKeyRef),
    pieceLength: PIECE,
  });
}

let server: SeederHttpServer | null = null;
afterEach(async () => {
  if (server) await server.close();
  server = null;
});

describe('Meerkat Node seeds a community over HTTP (MK-031 acceptance)', () => {
  it('a member fetches the full catalog from the lone node, verified', async () => {
    const node = new MeerkatSeederNode({
      pieceStore: new InMemorySeederPieceStore(),
      policy: {
        enabled: true, maxUploadKbps: 0, maxSeedStorageMB: 1024, autoDeleteDays: 30,
        seedOnCellular: false, seedWhileCharging: true, updatedAt: '2026-06-12T00:00:00.000Z',
      },
    });
    const cat = catalog();
    expect((await node.pin(cat, { pinForever: true })).ok).toBe(true);

    server = await startSeederHttp({ node, host: '127.0.0.1' });

    // The member's manifest points at the node as a web seed. No other member
    // is online -- only the node serves.
    const manifest = { ...cat.manifest, webSeeds: [server.url] };
    const result = await fetchCatalogFromWebSeed(manifest, { fetchFn: httpFetch });

    expect(result.ok).toBe(true);
    expect(result.failedPieces).toEqual([]);
    expect(result.bytes).toEqual(cat.bytes);

    // The node recorded the real uploads.
    const stats = await node.stats();
    expect(stats.peersServed).toBe(cat.manifest.pieces.length);
    expect(stats.bytesServed).toBe(cat.bytes.length);
  });

  it('serves /healthz and 404s unknown paths', async () => {
    const node = new MeerkatSeederNode({
      pieceStore: new InMemorySeederPieceStore(),
      policy: {
        enabled: true, maxUploadKbps: 0, maxSeedStorageMB: 1024, autoDeleteDays: 30,
        seedOnCellular: false, seedWhileCharging: true, updatedAt: '2026-06-12T00:00:00.000Z',
      },
    });
    server = await startSeederHttp({ node, host: '127.0.0.1' });

    const health = (await httpFetch(`${server.url}/healthz`)) as Awaited<ReturnType<typeof fetch>>;
    expect(health.ok).toBe(true);
    const miss = (await httpFetch(`${server.url}/deadbeef/0`)) as Awaited<ReturnType<typeof fetch>>;
    expect(miss.status).toBe(404);
  });
});
