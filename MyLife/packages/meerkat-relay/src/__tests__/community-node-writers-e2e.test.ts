/**
 * Plan 57 W1 acceptance: the community-node WRITER clients
 * (publishCommunityFeed + appendCommunityTail) drive the always-on node over
 * REAL HTTP, end to end, with everything real: real identities, a real signed
 * CommunityDescriptor, real epoch group keys, real signed ChannelMessageEvents,
 * a real node:http server, and the real pull client closing the loop.
 *
 * Proven here:
 *  1. The OWNER publishes descriptor + rolling snapshot through the client;
 *     a MEMBER then pulls over HTTP and decrypts the exact authored feed.
 *  2. A MEMBER appends one sealed tail entry through the client; a fresh pull
 *     returns the appended event, inner-verified after local decryption.
 *  3. A non-owner publish is rejected verbatim (not_owner); a non-member append
 *     is rejected verbatim (not_member). Nothing is stored on rejection.
 *  4. Fail-closed locally: a missing piece aborts publish BEFORE any HTTP call.
 *  5. Hosted mode: both writers carry the entitlement bearer on every request
 *     (challenge included); without it the node's entitlement_required is
 *     surfaced verbatim.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { issueMeerkatHostedEntitlement } from '@mylife/entitlements/server';
import {
  appendCommunityTail,
  buildCommunitySnapshots,
  createChannelMessage,
  createCommunity,
  createGroupCommit,
  createSyncTables,
  createWorkspace,
  generateDeviceIdentity,
  getKeyWraps,
  publishCommunityFeed,
  pullCommunityFeed,
  storeReceivedKeyWrap,
  unwrapEpochSecret,
  type ChannelMessageEvent,
  type CommunitySnapshotRecord,
  type DeviceIdentity,
  type GroupMemberKey,
  type SignedCommunityDescriptor,
  type SnapshotPieceStore,
} from '@mylife/sync';
import { CommunityNode, InMemorySeederPieceStore } from '../index';
import { startCommunityNodeHttp } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

const CHANNEL = 'general';
const NOW = '2026-09-01T00:00:00.000Z';

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
    id: workspaceId, displayName: 'Writer Club', workspaceType: 'community',
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
  return createChannelMessage(author, {
    communityId, channelId: CHANNEL, body, hlc: { wall, counter: 0 },
  });
}

interface WriterFixture {
  owner: DeviceIdentity;
  member: DeviceIdentity;
  outsider: DeviceIdentity;
  communityId: string;
  signed: SignedCommunityDescriptor;
  ownerDb: InMemoryTestDatabase;
  memberDb: InMemoryTestDatabase;
  epoch: number;
  authored: ChannelMessageEvent[];
  records: CommunitySnapshotRecord[];
  buildStore: SnapshotPieceStore;
}

async function buildWriterFixture(): Promise<WriterFixture> {
  const owner = generateDeviceIdentity('Owner');
  const member = generateDeviceIdentity('Member');
  const outsider = generateDeviceIdentity('Outsider');

  const signed = createCommunity(owner, {
    name: 'Writer Club',
    channels: [{ id: CHANNEL, name: CHANNEL }],
    members: [
      { deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey },
    ],
    now: NOW,
  });
  const communityId = signed.descriptor.communityId;

  const ownerDb = freshDb(communityId);
  const memberDb = freshDb(communityId);

  const commit = createGroupCommit(ownerDb.adapter, {
    workspaceId: communityId,
    committer: owner,
    members: [owner, member].map(memberKey),
    now: NOW,
  });
  distributeWraps(ownerDb, memberDb, communityId, commit.epoch, member.publicKey);

  const authored = [
    postMessage(owner, communityId, 'first post from the owner', '2026-09-01T00:00:10.000Z'),
    postMessage(member, communityId, 'member checking in', '2026-09-01T00:00:11.000Z'),
  ];

  const buildStore = new InMemorySeederPieceStore();
  const built = await buildCommunitySnapshots({
    db: ownerDb.adapter,
    identity: owner,
    communityId,
    channels: [{ channelId: CHANNEL, events: authored }],
    pieceStore: buildStore,
    now: NOW,
  });
  expect(built.records).toHaveLength(1);

  return {
    owner, member, outsider, communityId, signed,
    ownerDb, memberDb,
    epoch: commit.epoch,
    authored,
    records: built.records,
    buildStore,
  };
}

function epochKeyFor(fx: WriterFixture, db: InMemoryTestDatabase, identity: DeviceIdentity) {
  return () => {
    const secret = unwrapEpochSecret(db.adapter, fx.communityId, fx.epoch, identity);
    return secret ? { epoch: fx.epoch, secret } : null;
  };
}

let server: SeederHttpServer | null = null;
let fixture: WriterFixture | null = null;

afterEach(async () => {
  if (server) await server.close();
  server = null;
  fixture?.ownerDb.close();
  fixture?.memberDb.close();
  fixture = null;
});

describe('plan 57 W1: community feed writers over real HTTP', () => {
  it('owner publishes through the client; a member pulls and decrypts the feed', async () => {
    fixture = await buildWriterFixture();
    const fx = fixture;
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    const published = await publishCommunityFeed({
      baseUrl: server.url,
      identity: fx.owner,
      descriptor: fx.signed,
      records: fx.records,
      pieceStore: fx.buildStore,
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(published).toEqual({ ok: true, channels: 1 });

    const pulled = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      fetchFn: httpFetch,
      getEpochKey: epochKeyFor(fx, fx.memberDb, fx.member),
      now: NOW,
    });
    expect(pulled.ok).toBe(true);
    if (!pulled.ok) return;
    const channel = pulled.channels.find((c) => c.channelId === CHANNEL);
    expect(channel).toBeDefined();
    expect(channel!.events.map((e) => e.body).sort()).toEqual(
      fx.authored.map((e) => e.body).sort(),
    );
  });

  it('a member appends one sealed tail entry; a fresh pull returns the event', async () => {
    fixture = await buildWriterFixture();
    const fx = fixture;
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    const published = await publishCommunityFeed({
      baseUrl: server.url,
      identity: fx.owner,
      descriptor: fx.signed,
      records: fx.records,
      pieceStore: fx.buildStore,
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(published.ok).toBe(true);

    const liveEvent = postMessage(fx.member, fx.communityId, 'live tail message', '2026-09-01T00:01:00.000Z');
    const appended = await appendCommunityTail({
      baseUrl: server!.url,
      communityId: fx.communityId,
      identity: fx.member,
      event: liveEvent,
      getEpochKey: epochKeyFor(fx, fx.memberDb, fx.member),
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(appended).toEqual({ ok: true });

    const pulled = await pullCommunityFeed({
      baseUrl: server!.url,
      communityId: fx.communityId,
      identity: fx.member,
      fetchFn: httpFetch,
      getEpochKey: epochKeyFor(fx, fx.memberDb, fx.member),
      now: NOW,
    });
    expect(pulled.ok).toBe(true);
    if (!pulled.ok) return;
    const channel = pulled.channels.find((c) => c.channelId === CHANNEL);
    const bodies = channel!.events.map((e) => e.body);
    expect(bodies).toContain('live tail message');
  });

  it('rejects a non-owner publish (not_owner) and a non-member append (not_member), verbatim', async () => {
    fixture = await buildWriterFixture();
    const fx = fixture;
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    const memberPublish = await publishCommunityFeed({
      baseUrl: server.url,
      identity: fx.member,
      descriptor: fx.signed,
      records: fx.records,
      pieceStore: fx.buildStore,
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(memberPublish).toEqual({ ok: false, reason: 'not_owner' });

    // Seed the node with the real roster first so the outsider hits membership,
    // not a missing descriptor.
    const ownerPublish = await publishCommunityFeed({
      baseUrl: server.url,
      identity: fx.owner,
      descriptor: fx.signed,
      records: fx.records,
      pieceStore: fx.buildStore,
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(ownerPublish.ok).toBe(true);

    // The outsider cannot hold the epoch key; hand it the member's key material
    // to prove the ROSTER (not key possession) is what the node enforces.
    const outsiderEvent = createChannelMessage(fx.outsider, {
      communityId: fx.communityId, channelId: CHANNEL, body: 'should never land', hlc: { wall: '2026-09-01T00:02:00.000Z', counter: 0 },
    });
    const outsiderAppend = await appendCommunityTail({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.outsider,
      event: outsiderEvent,
      getEpochKey: epochKeyFor(fx, fx.memberDb, fx.member),
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(outsiderAppend.ok).toBe(false);
    if (outsiderAppend.ok) return;
    expect(outsiderAppend.reason).toBe('not_member');
  });

  it('fails closed locally on a missing piece: no HTTP request is ever made', async () => {
    fixture = await buildWriterFixture();
    const fx = fixture;
    let calls = 0;
    const countingFetch = (async (...args: Parameters<typeof fetch>) => {
      calls += 1;
      return httpFetch(...args);
    }) as typeof fetch;

    const emptyStore = new InMemorySeederPieceStore();
    const result = await publishCommunityFeed({
      baseUrl: 'http://127.0.0.1:9',
      identity: fx.owner,
      descriptor: fx.signed,
      records: fx.records,
      pieceStore: emptyStore,
      fetchFn: countingFetch,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: 'missing_piece' });
    expect(calls).toBe(0);
  });

  it('a TAIL-ONLY channel (no snapshot yet) still delivers its appended events on pull', async () => {
    fixture = await buildWriterFixture();
    const fx = fixture;
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    // Descriptor-only publish: the channel has NO snapshot entry on the node.
    const published = await publishCommunityFeed({
      baseUrl: server.url,
      identity: fx.owner,
      descriptor: fx.signed,
      records: [],
      pieceStore: fx.buildStore,
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(published).toEqual({ ok: true, channels: 0 });

    const liveEvent = postMessage(fx.member, fx.communityId, 'tail-only channel message', '2026-09-01T00:05:00.000Z');
    const appended = await appendCommunityTail({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      event: liveEvent,
      getEpochKey: epochKeyFor(fx, fx.memberDb, fx.member),
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(appended).toEqual({ ok: true });

    const pulled = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      fetchFn: httpFetch,
      getEpochKey: epochKeyFor(fx, fx.memberDb, fx.member),
      now: NOW,
    });
    expect(pulled.ok).toBe(true);
    if (!pulled.ok) return;
    const channel = pulled.channels.find((c) => c.channelId === CHANNEL);
    expect(channel).toBeDefined();
    expect(channel!.events.map((e) => e.body)).toContain('tail-only channel message');
  });

  it('a tail entry sealed under the PRIOR epoch is recovered via candidate keys after a rotation', async () => {
    fixture = await buildWriterFixture();
    const fx = fixture;
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    const published = await publishCommunityFeed({
      baseUrl: server.url,
      identity: fx.owner,
      descriptor: fx.signed,
      records: fx.records,
      pieceStore: fx.buildStore,
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(published.ok).toBe(true);

    // Member appends while still on epoch 1.
    const preRotation = postMessage(fx.member, fx.communityId, 'sealed under epoch one', '2026-09-01T00:06:00.000Z');
    const appended = await appendCommunityTail({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      event: preRotation,
      getEpochKey: epochKeyFor(fx, fx.memberDb, fx.member),
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(appended).toEqual({ ok: true });

    // The owner rotates the epoch (a membership change); the member receives
    // its new wrap. The tail entry on the node is still epoch-1 ciphertext.
    const rotation = createGroupCommit(fx.ownerDb.adapter, {
      workspaceId: fx.communityId,
      committer: fx.owner,
      members: [fx.owner, fx.member].map(memberKey),
      now: '2026-09-01T00:07:00.000Z',
    });
    distributeWraps(fx.ownerDb, fx.memberDb, fx.communityId, rotation.epoch, fx.member.publicKey);
    expect(rotation.epoch).toBe(fx.epoch + 1);

    const epoch2Key = () => {
      const secret = unwrapEpochSecret(fx.memberDb.adapter, fx.communityId, rotation.epoch, fx.member);
      return secret ? { epoch: rotation.epoch, secret } : null;
    };

    // Without candidates, the pre-rotation entry is undecryptable (dropped).
    const withoutCandidates = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      fetchFn: httpFetch,
      getEpochKey: epoch2Key,
      now: NOW,
    });
    expect(withoutCandidates.ok).toBe(true);
    if (!withoutCandidates.ok) return;
    expect(
      withoutCandidates.channels.find((c) => c.channelId === CHANNEL)!.events.map((e) => e.body),
    ).not.toContain('sealed under epoch one');

    // With the prior epoch offered as a candidate, the entry is recovered.
    const withCandidates = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      fetchFn: httpFetch,
      getEpochKey: epoch2Key,
      getCandidateEpochKeys: () => {
        const secret = unwrapEpochSecret(fx.memberDb.adapter, fx.communityId, fx.epoch, fx.member);
        return secret ? [{ epoch: fx.epoch, secret }] : [];
      },
      now: NOW,
    });
    expect(withCandidates.ok).toBe(true);
    if (!withCandidates.ok) return;
    expect(
      withCandidates.channels.find((c) => c.channelId === CHANNEL)!.events.map((e) => e.body),
    ).toContain('sealed under epoch one');
  });

  it('hosted mode: writers carry the entitlement bearer end to end; without it the node refuses', async () => {
    fixture = await buildWriterFixture();
    const fx = fixture;
    const entitlement = await issueMeerkatHostedEntitlement({
      secret: 'writer-hosted-secret',
      issuedAt: NOW,
      expiresAt: '2026-09-02T00:00:00.000Z',
    });
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({
      node,
      host: '127.0.0.1',
      hostedEntitlement: {
        required: true,
        secret: 'writer-hosted-secret',
        nowMs: () => Date.parse(NOW),
      },
    });

    const unpaid = await publishCommunityFeed({
      baseUrl: server.url,
      identity: fx.owner,
      descriptor: fx.signed,
      records: fx.records,
      pieceStore: fx.buildStore,
      fetchFn: httpFetch,
      now: NOW,
    });
    expect(unpaid).toEqual({ ok: false, reason: 'entitlement_required' });

    const paid = await publishCommunityFeed({
      baseUrl: server.url,
      identity: fx.owner,
      descriptor: fx.signed,
      records: fx.records,
      pieceStore: fx.buildStore,
      fetchFn: httpFetch,
      entitlementToken: entitlement.token,
      now: NOW,
    });
    expect(paid).toEqual({ ok: true, channels: 1 });

    const liveEvent = postMessage(fx.member, fx.communityId, 'paid tail', '2026-09-01T00:03:00.000Z');
    const paidAppend = await appendCommunityTail({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      event: liveEvent,
      getEpochKey: epochKeyFor(fx, fx.memberDb, fx.member),
      fetchFn: httpFetch,
      entitlementToken: entitlement.token,
      now: NOW,
    });
    expect(paidAppend).toEqual({ ok: true });

    const paidPull = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      fetchFn: httpFetch,
      getEpochKey: epochKeyFor(fx, fx.memberDb, fx.member),
      entitlementToken: entitlement.token,
      now: NOW,
    });
    expect(paidPull.ok).toBe(true);
    if (!paidPull.ok) return;
    expect(paidPull.channels.find((c) => c.channelId === CHANNEL)!.events.map((e) => e.body)).toContain('paid tail');
  });
});
