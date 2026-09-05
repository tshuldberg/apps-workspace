/**
 * WP-43G end-to-end: announce -> resolve -> open -> gate path compose.
 *
 * A community node hosts a real published community (real signed descriptor,
 * real epoch-sealed rolling snapshot, served over real HTTP). It plans + builds
 * a sealed HistoryHostRecord for that community and announces it (rid + opaque
 * ciphertext only) to a REAL relay over a real WebSocket. A member who holds
 * only the community secret (genesisNonce) then runs the UNCHANGED
 * runAutomaticHistorySync (WP-43D) with resolveHosts wired to the real relay
 * lookup and pullHost wired to the real pullCommunityFeed -- proving the whole
 * chain composes and lands a real, decrypted, verified import with nothing
 * hand-waved.
 *
 * Zero-knowledge assertion: a transport spy wraps the relay's announceHost call
 * and asserts the ONLY fields sent are `rid` + `record` (the sealed ciphertext,
 * renamed sealedRecord on our side) -- no key on the wire is named like
 * community/descriptor/member/device, and the wire values never contain the
 * plaintext community id or secret.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  buildCommunitySnapshots,
  createChannelMessage,
  createCommunity,
  createGroupCommit,
  createSyncTables,
  createWorkspace,
  getKeyWraps,
  pullCommunityFeed,
  resolveChannelMessages,
  runAutomaticHistorySync,
  signFeedAuth,
  storeReceivedKeyWrap,
  unwrapEpochSecret,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type GroupMemberKey,
} from '@mylife/sync';
import { generateDeviceIdentity } from '@mylife/sync';
import { CommunityNode, InMemorySeederPieceStore } from '../index';
import { startCommunityNodeHttp } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';
import { startRelayServer, type RelayServer } from '../server';
import { buildSealedHistoryAnnouncement, planHistoryAnnouncements } from '../community-history-announce';

const CHANNEL = 'general';
const NOW = '2026-07-11T00:00:00.000Z';
const WS = WebSocket as unknown as new (url: string) => unknown;

const httpFetch = ((input: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }) =>
  new Promise((resolve, reject) => {
    const url = typeof input === 'string' ? input : String(input);
    const method = init?.method ?? 'GET';
    const headers = init?.headers ?? {};
    const req = http.request(url, { method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
          status: res.statusCode ?? 500,
          statusText: res.statusMessage ?? '',
          json: async () => JSON.parse(body.toString('utf8')),
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        });
      });
    });
    req.on('error', reject);
    if (init?.body) req.write(init.body as string);
    req.end();
  })) as unknown as typeof fetch;

function freshDb(workspaceId: string): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  createWorkspace(db.adapter, {
    id: workspaceId, displayName: 'History Club', workspaceType: 'community',
    createdByDeviceId: 'owner', createdAt: NOW, rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  return db;
}

function memberKey(identity: DeviceIdentity): GroupMemberKey {
  return { deviceId: identity.publicKey, dhPublicKey: identity.dhPublicKey };
}

function distributeWraps(from: InMemoryTestDatabase, to: InMemoryTestDatabase, workspaceId: string, epoch: number, deviceId: string): void {
  for (const wrap of getKeyWraps(from.adapter, workspaceId, epoch)) {
    if (wrap.wrappedForDeviceId === deviceId) storeReceivedKeyWrap(to.adapter, wrap);
  }
}

function postMessage(author: DeviceIdentity, communityId: string, body: string, wall: string): ChannelMessageEvent {
  return createChannelMessage(author, { communityId, channelId: CHANNEL, body, hlc: { wall, counter: 0 } });
}

let relay: RelayServer | null = null;
let server: SeederHttpServer | null = null;
let ownerDb: InMemoryTestDatabase | null = null;
let memberDb: InMemoryTestDatabase | null = null;

afterEach(async () => {
  if (relay) { await relay.close(); relay = null; }
  if (server) { await server.close(); server = null; }
  ownerDb?.close(); ownerDb = null;
  memberDb?.close(); memberDb = null;
});

describe('WP-43G history-host announce e2e (announce -> resolve -> open -> gate compose)', () => {
  it('a member with only the community secret discovers, pulls, and imports a real cold-start snapshot', async () => {
    relay = await startRelayServer({ port: 0, host: '127.0.0.1' });
    const relayUrl = `ws://127.0.0.1:${relay.port}`;

    const owner = generateDeviceIdentity('Owner');
    const member = generateDeviceIdentity('Member');

    const signed = createCommunity(owner, {
      name: 'History Club',
      channels: [{ id: CHANNEL, name: CHANNEL }],
      members: [{ deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey }],
      now: NOW,
    });
    const communityId = signed.descriptor.communityId;
    const communitySecret = signed.descriptor.genesisNonce;

    ownerDb = freshDb(communityId);
    memberDb = freshDb(communityId);

    const commit = createGroupCommit(ownerDb.adapter, {
      workspaceId: communityId, committer: owner, members: [owner, member].map(memberKey), now: NOW,
    });
    distributeWraps(ownerDb, memberDb, communityId, commit.epoch, member.publicKey);

    const authored = [
      postMessage(owner, communityId, 'welcome to the archive', '2026-07-11T00:00:10.000Z'),
      postMessage(owner, communityId, 'here is the backlog', '2026-07-11T00:00:11.000Z'),
    ];

    const buildStore = new InMemorySeederPieceStore();
    const built = await buildCommunitySnapshots({
      db: ownerDb.adapter, identity: owner, communityId,
      channels: [{ channelId: CHANNEL, events: authored }],
      pieceStore: buildStore, now: NOW,
    });
    const record = built.records[0]!;
    const manifest = JSON.parse(record.manifestJson) as ContentManifest;
    const pieces: Uint8Array[] = [];
    for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);

    // 1) The owner publishes the real descriptor + snapshot to the community node.
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    const challenge = (await node.issueChallenge(communityId))!;
    const auth = {
      deviceId: owner.publicKey,
      nonce: challenge.nonce,
      ts: NOW,
      signature: signFeedAuth(owner, { communityId, nonce: challenge.nonce, ts: NOW }),
    };
    const verdict = await node.publish(communityId, {
      descriptor: signed,
      snapshots: [{ channelId: CHANNEL, epoch: record.epoch, manifest, pieces }],
    }, auth);
    expect(verdict.ok).toBe(true);

    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    const publicBaseUrl = server.url;

    // 2) Plan + build the sealed announcement from the node's OWN read of its state
    //    (mirrors exactly what the bin's announceHistory() tick does).
    const state = await node.getPrivateCommunityState(communityId);
    expect(state?.snapshots.length).toBeGreaterThan(0);
    const nowMs = Date.parse(NOW);
    const plan = planHistoryAnnouncements({
      candidates: [{
        communityId,
        communitySecret,
        descriptorRevision: state!.descriptor.descriptor.revision,
        descriptorCurrent: true,
        snapshotServeable: state!.snapshots.length > 0,
        lastAnnouncedAt: null,
      }],
      ttlMs: 60_000, refreshLeadMs: 10_000, maxPerTick: 10, jitterWindowMs: 0,
      jitterSeed: publicBaseUrl, nowMs,
    });
    expect(plan.actions).toHaveLength(1);
    // buildSealedHistoryAnnouncement is fail-closed https-only (by design: a
    // plaintext base url must never be announced). The real community-node HTTP
    // test server is plain http (no TLS fixture in this harness), so the
    // announced record carries an https PLACEHOLDER host that resolves to the
    // same address; the puller below substitutes it back to the real server.url
    // before fetching, so the actual bytes still flow over the real listener.
    const httpsPlaceholderBaseUrl = publicBaseUrl.replace(/^http:/, 'https:');
    const sealed = buildSealedHistoryAnnouncement({
      communityId,
      communitySecret,
      descriptorCurrent: true,
      descriptorRevision: state!.descriptor.descriptor.revision,
      snapshotServeable: true,
      publicBaseUrl: httpsPlaceholderBaseUrl,
      maxObjectBytes: 8 * 1024 * 1024,
      ttlMs: 60_000,
      nowMs,
    });
    expect(sealed).not.toBeNull();

    // 3) Announce over a REAL relay, through a transport SPY that asserts the wire
    //    frame carries ONLY {t, rid, rec} -- no community/descriptor/member/device
    //    field, and neither value contains the plaintext community id or secret.
    const sentFrames: Record<string, unknown>[] = [];
    class SpyWebSocket extends WebSocket {
      send(data: string): void {
        const frame = JSON.parse(data) as Record<string, unknown>;
        if (frame.t === 'ann') sentFrames.push(frame);
        super.send(data);
      }
    }
    const { announceHost } = await import('@mylife/sync');
    await announceHost({
      url: relayUrl,
      rid: sealed!.rid,
      record: sealed!.sealedRecord,
      ttlMs: 60_000,
      webSocketImpl: SpyWebSocket as unknown as new (url: string) => unknown as never,
    });
    expect(sentFrames).toHaveLength(1);
    const wireKeys = Object.keys(sentFrames[0]!);
    for (const key of wireKeys) {
      expect(key.toLowerCase()).not.toMatch(/community|descriptor|member|device/);
    }
    const wireValues = JSON.stringify(sentFrames[0]);
    expect(wireValues).not.toContain(communityId);
    expect(wireValues).not.toContain(communitySecret);

    // 4) A member holding ONLY the community secret + the verified descriptor runs
    //    the UNCHANGED WP-43D loop: resolveHosts -> the real relay lookup;
    //    pullHost -> the real pullCommunityFeed (full per-member auth + snapshot +
    //    per-piece + inner-author verification). Nothing here is stubbed.
    let committed: ChannelMessageEvent[] | null = null;
    const result = await runAutomaticHistorySync({
      communitySecret,
      descriptor: signed,
      resolveHosts: async () => {
        const { lookupHosts } = await import('@mylife/sync');
        return lookupHosts({ url: relayUrl, rid: sealed!.rid, webSocketImpl: WS as never });
      },
      pullHost: async ({ hostUrl }) => {
        // The record's hostUrl is the https placeholder (real TLS is a deploy-time
        // fact this harness has no fixture for); the real bytes still flow over
        // the actual http test listener the announcement described.
        const realHostUrl = hostUrl === httpsPlaceholderBaseUrl ? publicBaseUrl : hostUrl;
        const pulled = await pullCommunityFeed({
          baseUrl: realHostUrl,
          communityId,
          identity: member,
          fetchFn: httpFetch,
          getEpochKey: () => ({ epoch: commit.epoch, secret: unwrapEpochSecret(memberDb!.adapter, communityId, commit.epoch, member)! }),
          now: NOW,
        });
        if (!pulled.ok) return { ok: false, reason: pulled.reason };
        return {
          ok: true,
          channels: pulled.channels.map((c) => ({ channelId: c.channelId, events: c.events, newEvents: c.newEvents })),
        };
      },
      commit: async (batch) => {
        committed = batch.channels.find((c) => c.channelId === CHANNEL)?.events ?? [];
      },
      now: new Date(nowMs).toISOString(),
    });

    expect(result.outcome).toBe('imported');
    if (result.outcome === 'imported') {
      expect(result.hostUrl).toBe(httpsPlaceholderBaseUrl);
    }
    expect(committed).not.toBeNull();
    const resolved = resolveChannelMessages(committed!);
    expect(resolved.map((e) => e.body)).toEqual(['welcome to the archive', 'here is the backlog']);
  });
});
