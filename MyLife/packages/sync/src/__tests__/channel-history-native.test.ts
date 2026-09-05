/**
 * Gap #4 resolution proof: host channel history is fetchable from the RN barrel.
 *
 * Everything here imports from `index.native` (the React-Native-safe surface)
 * and runs with an INJECTED fetch (no node:http) and the pure-JS SHA-256 (no
 * node:crypto). A host builds a signed, encrypted history snapshot; a fresh
 * member fetches it over the injected transport, verifies every piece against
 * the manifest, and recovers the ordered events. This is exactly what the app's
 * ChatProvider can now call to replace `partialHistory: true`.
 */

import { describe, it, expect } from 'vitest';
import {
  generateDeviceIdentity,
  createChannelMessage,
  buildChannelHistory,
  fetchChannelHistory,
  mergeChannelHistoryEvents,
} from '../index.native';

const COMMUNITY = 'surf-club';
const CHANNEL = 'general';
const WORKSPACE = 'community';
const EPOCH = 2;
const GROUP_KEY = new Uint8Array(Array.from({ length: 32 }, (_, i) => (i * 7 + 1) & 0xff));

/** Serve a built history's pieces over an injected fetch: GET {base}/{hash}/{i}. */
function injectedFetch(pieces: readonly Uint8Array[]): typeof fetch {
  return (async (url: string) => {
    const match = /\/[0-9a-f]+\/(\d+)$/.exec(String(url));
    const piece = match ? pieces[Number(match[1])] : undefined;
    if (!piece) {
      return { ok: false, status: 404, statusText: 'not found', arrayBuffer: async () => new ArrayBuffer(0) };
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => piece.buffer.slice(piece.byteOffset, piece.byteOffset + piece.byteLength),
    };
  }) as unknown as typeof fetch;
}

describe('channel history over the RN-safe barrel (gap #4)', () => {
  it('a member fetches + verifies a host backlog with an injected transport', async () => {
    const host = generateDeviceIdentity('Host Admin');
    const author = generateDeviceIdentity('Author');

    const events = [
      createChannelMessage(author, {
        communityId: COMMUNITY, channelId: CHANNEL, body: 'first',
        hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
      }),
      createChannelMessage(author, {
        communityId: COMMUNITY, channelId: CHANNEL, body: 'second',
        hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
      }),
    ];

    // Host side: build the signed, encrypted snapshot (RN-safe SHA-256 catalog).
    const history = buildChannelHistory({
      communityId: COMMUNITY, channelId: CHANNEL, workspaceId: WORKSPACE, epoch: EPOCH,
      events, groupKey: GROUP_KEY, signer: host,
      createdAt: '2026-06-13T00:01:00.000Z', pieceLength: 256,
      webSeeds: ['https://host.example'],
    });

    // Member side: cold fetch through the RN path.
    const result = await fetchChannelHistory({
      communityId: COMMUNITY, channelId: CHANNEL, workspaceId: WORKSPACE, epoch: EPOCH,
      manifest: history.catalog.manifest,
      groupKey: GROUP_KEY,
      existingEvents: [],
      fetchFn: injectedFetch(history.pieces),
    });

    expect(result.ok).toBe(true);
    expect(result.mergedEvents.map((event) => event.body)).toEqual(['first', 'second']);
  });

  it('a member who already has live events merges history without duplicates', async () => {
    const host = generateDeviceIdentity('Host');
    const author = generateDeviceIdentity('Author');
    const a = createChannelMessage(author, {
      communityId: COMMUNITY, channelId: CHANNEL, body: 'a',
      hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
    });
    const b = createChannelMessage(author, {
      communityId: COMMUNITY, channelId: CHANNEL, body: 'b',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });

    const history = buildChannelHistory({
      communityId: COMMUNITY, channelId: CHANNEL, workspaceId: WORKSPACE, epoch: EPOCH,
      events: [a, b], groupKey: GROUP_KEY, signer: host, pieceLength: 256,
      webSeeds: ['https://host.example'],
    });

    // The member already saw `b` live; the fetch must not duplicate it.
    const result = await fetchChannelHistory({
      communityId: COMMUNITY, channelId: CHANNEL, workspaceId: WORKSPACE, epoch: EPOCH,
      manifest: history.catalog.manifest, groupKey: GROUP_KEY,
      existingEvents: [b], fetchFn: injectedFetch(history.pieces),
    });

    expect(result.ok).toBe(true);
    expect(result.mergedEvents).toHaveLength(2);
    expect(mergeChannelHistoryEvents([b], result.mergedEvents)).toHaveLength(2);
  });

  it('reports no_hosts when the manifest has no web seed and none are passed', async () => {
    const host = generateDeviceIdentity('Host');
    const author = generateDeviceIdentity('Author');
    const history = buildChannelHistory({
      communityId: COMMUNITY, channelId: CHANNEL, workspaceId: WORKSPACE, epoch: EPOCH,
      events: [createChannelMessage(author, {
        communityId: COMMUNITY, channelId: CHANNEL, body: 'x',
        hlc: { wall: '2026-06-13T00:00:00.000Z', counter: 0 },
      })],
      groupKey: GROUP_KEY, signer: host, pieceLength: 256,
    });
    const result = await fetchChannelHistory({
      communityId: COMMUNITY, channelId: CHANNEL, workspaceId: WORKSPACE, epoch: EPOCH,
      manifest: { ...history.catalog.manifest, webSeeds: [] }, groupKey: GROUP_KEY,
      fetchFn: injectedFetch(history.pieces),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_hosts');
  });
});
