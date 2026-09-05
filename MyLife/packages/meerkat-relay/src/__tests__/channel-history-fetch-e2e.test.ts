/**
 * MK-056 acceptance: a fresh member with zero live channel events loads the
 * full encrypted channel backlog from a lone host node over real HTTP.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import {
  buildChannelHistory,
  createChannelMessage,
  fetchChannelHistory,
  generateDeviceIdentity,
} from '@mylife/sync';
import { InMemorySeederPieceStore, MeerkatSeederNode } from '../seeder-node';
import { startSeederHttp, type SeederHttpServer } from '../seeder-http';

const COMMUNITY = 'community-1';
const CHANNEL = 'general';
const WORKSPACE = 'community-1';
const EPOCH = 7;
const PIECE = 96;
const GROUP_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => (index * 7 + 11) % 251));

const httpFetch = ((url: string) =>
  new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
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

let server: SeederHttpServer | null = null;

afterEach(async () => {
  if (server) await server.close();
  server = null;
});

describe('channel history fetch + scrollback (MK-056)', () => {
  it('loads the full ordered backlog from a lone host node', async () => {
    const signer = generateDeviceIdentity('Host Admin');
    const alice = generateDeviceIdentity('Alice');
    const bob = generateDeviceIdentity('Bob');
    const first = createChannelMessage(bob, {
      communityId: COMMUNITY,
      channelId: CHANNEL,
      body: 'bob earlier',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    const second = createChannelMessage(alice, {
      communityId: COMMUNITY,
      channelId: CHANNEL,
      body: 'alice later',
      hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 },
    });
    const history = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      events: [second, first],
      groupKey: GROUP_KEY,
      signer,
      createdAt: '2026-06-13T00:03:00.000Z',
      pieceLength: PIECE,
    });

    const node = new MeerkatSeederNode({
      pieceStore: new InMemorySeederPieceStore(),
      policy: {
        enabled: true,
        maxUploadKbps: 0,
        maxSeedStorageMB: 1024,
        autoDeleteDays: 30,
        seedOnCellular: false,
        seedWhileCharging: true,
        updatedAt: '2026-06-13T00:00:00.000Z',
      },
    });
    expect((await node.pin(history.catalog, { pinForever: true })).ok).toBe(true);

    server = await startSeederHttp({ node, host: '127.0.0.1' });

    const result = await fetchChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: WORKSPACE,
      epoch: EPOCH,
      manifest: history.catalog.manifest,
      hosts: [server.url],
      groupKey: GROUP_KEY,
      existingEvents: [],
      fetchFn: httpFetch,
      pieceAvailability: history.catalog.manifest.pieces.map((_, index) => (
        index === 0 ? 2 : 1
      )),
      maxConcurrent: 2,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.failedPieces).toEqual([]);
      expect(result.importedCount).toBe(2);
      expect(result.events.map((event) => event.body)).toEqual(['bob earlier', 'alice later']);
      expect(result.mergedEvents.map((event) => event.id)).toEqual([first.id, second.id]);
      expect(result.snapshot.snapshotId).toBe(history.snapshot.snapshotId);
      expect(result.fetchedPieces).toHaveLength(history.catalog.manifest.pieces.length);
    }

    const stats = await node.stats();
    expect(stats.peersServed).toBe(history.catalog.manifest.pieces.length);
    expect(stats.bytesServed).toBe(history.catalog.bytes.length);
  });
});
