/**
 * Community feed P2 acceptance: an always-on COMMUNITY NODE serves the full
 * encrypted feed to authenticated members over REAL HTTP (a different "network"),
 * rejects non-members and removed members at auth, and holds ONLY ciphertext.
 *
 * Everything is real: real Ed25519/X25519 identities, a real signed
 * CommunityDescriptor, real epoch group keys (createGroupCommit + per-member
 * wraps distributed device-to-device), real signed ChannelMessageEvents sealed
 * into a rolling snapshot (buildCommunitySnapshots), a real node:http server
 * (startCommunityNodeHttp), and the real pull client (pullCommunityFeed) that
 * authenticates, fetches the opaque pieces, decrypts, and inner-verifies. No
 * stubs; every assertion is on real decrypted events or real HTTP status codes.
 *
 * Acceptance proven here:
 *  1. A MEMBER with the epoch key authenticates and pulls the FULL feed, then
 *     decrypts it locally; the resolved feed matches what the owner authored.
 *  2. A NON-member (valid key, not in the descriptor) AND a REMOVED member (owner
 *     publishes a revised descriptor without them) are BOTH rejected (401
 *     not_member).
 *  3. The node holds only ciphertext: the bytes it stored for a piece fail to
 *     parse without the epoch key (decrypt_failed) -- it cannot produce plaintext.
 *  4. (P6 item 1) Per-community piece-path scoping: with two communities on one
 *     node, a member of A is served its own pieces over the scoped path but gets
 *     404 for B's infoHash on A's path and 401 for B's path with an A-only nonce.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { issueMeerkatHostedEntitlement } from '@mylife/entitlements/server';
import {
  buildCommunitySnapshots,
  createChannelMessage,
  createCommunity,
  createGroupCommit,
  createSyncTables,
  createWorkspace,
  getKeyWraps,
  importSnapshotFromPieces,
  pullCommunityFeed,
  resolveChannelMessages,
  reviseCommunity,
  storeReceivedKeyWrap,
  unwrapEpochSecret,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type GroupMemberKey,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import { generateDeviceIdentity } from '@mylife/sync';
import { CommunityNode, InMemorySeederPieceStore } from '../index';
import { startCommunityNodeHttp } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

const CHANNEL = 'general';
const NOW = '2026-06-16T00:00:00.000Z';

// ---------------------------------------------------------------------------
// A node:http fetch that supports json(), arrayBuffer(), POST bodies + headers.
// ---------------------------------------------------------------------------

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

/** A raw GET returning status + body bytes (for asserting piece-route scoping). */
function rawGet(url: string, headers: Record<string, string>): Promise<{ status: number; bytes: Uint8Array | null }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({ status: res.statusCode ?? 500, bytes: body.length ? new Uint8Array(body) : null });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Real epoch key plumbing: one in-memory DB per device.
// ---------------------------------------------------------------------------

function freshDb(workspaceId: string): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  createWorkspace(db.adapter, {
    id: workspaceId, displayName: 'Feed Club', workspaceType: 'community',
    createdByDeviceId: 'owner', createdAt: NOW, rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  return db;
}

function memberKey(identity: DeviceIdentity): GroupMemberKey {
  return { deviceId: identity.publicKey, dhPublicKey: identity.dhPublicKey };
}

/** Copy a member's wrap rows from the committer's DB to the member's DB. */
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

interface Fixture {
  owner: DeviceIdentity;
  member: DeviceIdentity;
  nonMember: DeviceIdentity;
  removed: DeviceIdentity;
  communityId: string;
  /** Descriptor that INCLUDES the removed member (the active roster initially). */
  signed: SignedCommunityDescriptor;
  ownerDb: InMemoryTestDatabase;
  memberDb: InMemoryTestDatabase;
  removedDb: InMemoryTestDatabase;
  epochSecret: Uint8Array;
  epoch: number;
  authored: ChannelMessageEvent[];
  snapshotManifest: ContentManifest;
  snapshotPieces: Uint8Array[];
  snapshotEpoch: number;
}

/**
 * Build the whole real fixture: identities, a signed community (owner + member +
 * removed in the roster), one real epoch wrapped for all three (distributed to
 * each device), three authored signed messages, and a rolling snapshot sealed
 * under the epoch key.
 */
async function buildFixture(): Promise<Fixture> {
  const owner = generateDeviceIdentity('Owner');
  const member = generateDeviceIdentity('Member');
  const nonMember = generateDeviceIdentity('Outsider');
  const removed = generateDeviceIdentity('Removed');

  const signed = createCommunity(owner, {
    name: 'Feed Club P2',
    channels: [{ id: CHANNEL, name: CHANNEL }],
    members: [
      { deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey },
      { deviceId: removed.publicKey, role: 'member', displayName: removed.displayName, dhPublicKey: removed.dhPublicKey },
    ],
    now: NOW,
  });
  const communityId = signed.descriptor.communityId;

  const ownerDb = freshDb(communityId);
  const memberDb = freshDb(communityId);
  const removedDb = freshDb(communityId);

  // One real epoch wrapped for owner + member + removed.
  const commit = createGroupCommit(ownerDb.adapter, {
    workspaceId: communityId,
    committer: owner,
    members: [owner, member, removed].map(memberKey),
    now: NOW,
  });
  distributeWraps(ownerDb, memberDb, communityId, commit.epoch, member.publicKey);
  distributeWraps(ownerDb, removedDb, communityId, commit.epoch, removed.publicKey);

  // Three real authored signed messages.
  const authored = [
    postMessage(owner, communityId, 'welcome to the feed', '2026-06-16T00:00:10.000Z'),
    postMessage(member, communityId, 'glad to be here', '2026-06-16T00:00:11.000Z'),
    postMessage(owner, communityId, 'rules pinned', '2026-06-16T00:00:12.000Z'),
  ];

  // Owner seals a rolling snapshot under the epoch key into a piece store.
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
  const record = built.records[0]!;
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) {
    const piece = buildStore.get(manifest.infoHash, i);
    pieces.push(piece as Uint8Array);
  }

  return {
    owner, member, nonMember, removed, communityId, signed,
    ownerDb, memberDb, removedDb,
    epochSecret: commit.secret, epoch: commit.epoch,
    authored, snapshotManifest: manifest, snapshotPieces: pieces, snapshotEpoch: record.epoch,
  };
}

let server: SeederHttpServer | null = null;
let fixture: Fixture | null = null;

afterEach(async () => {
  if (server) await server.close();
  server = null;
  fixture?.ownerDb.close();
  fixture?.memberDb.close();
  fixture?.removedDb.close();
  fixture = null;
});

/** Owner publishes the descriptor + snapshot to a running node over HTTP. */
async function ownerPublish(node: CommunityNode, fx: Fixture, descriptor: SignedCommunityDescriptor): Promise<void> {
  // The owner authenticates like any member.
  const challenge = (await node.issueChallenge(fx.communityId))!;
  const { signFeedAuth } = await import('@mylife/sync');
  const ts = NOW;
  const auth = {
    deviceId: fx.owner.publicKey,
    nonce: challenge.nonce,
    ts,
    signature: signFeedAuth(fx.owner, { communityId: fx.communityId, nonce: challenge.nonce, ts }),
  };
  const verdict = await node.publish(fx.communityId, {
    descriptor,
    snapshots: [{
      channelId: CHANNEL,
      epoch: fx.snapshotEpoch,
      manifest: fx.snapshotManifest,
      pieces: fx.snapshotPieces,
    }],
  }, auth);
  expect(verdict.ok).toBe(true);
}

describe('community feed P2: always-on community node + per-member auth', () => {
  it('hosted mode requires a paid entitlement before issuing a challenge', async () => {
    const entitlement = await issueMeerkatHostedEntitlement({
      secret: 'community-hosted-secret',
      issuedAt: '2026-06-16T00:00:00.000Z',
      expiresAt: '2026-06-17T00:00:00.000Z',
    });
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({
      node,
      host: '127.0.0.1',
      hostedEntitlement: {
        required: true,
        secret: 'community-hosted-secret',
        nowMs: () => Date.parse(NOW),
      },
    });

    const unpaid = await httpFetch(`${server.url}/community/hosted-test/challenge`);
    expect(unpaid.status).toBe(401);
    expect(await unpaid.json()).toEqual({ reason: 'entitlement_required' });

    const paid = await httpFetch(`${server.url}/community/hosted-test/challenge`, {
      headers: { Authorization: `Bearer ${entitlement.token}` },
    });
    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({ nonce: expect.any(String), expiresAt: expect.any(String) });
  });

  it('a member pulls the full encrypted feed over real HTTP and decrypts it', async () => {
    fixture = await buildFixture();
    const fx = fixture;
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    await ownerPublish(node, fx, fx.signed);

    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    const result = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      fetchFn: httpFetch,
      getEpochKey: () => ({ epoch: fx.epoch, secret: unwrapEpochSecret(fx.memberDb.adapter, fx.communityId, fx.epoch, fx.member)! }),
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const channel = result.channels.find((c) => c.channelId === CHANNEL);
    expect(channel).toBeDefined();

    // The decrypted, resolved feed matches exactly what the owner authored.
    const resolved = resolveChannelMessages(channel!.events);
    expect(resolved.map((e) => e.body)).toEqual(['welcome to the feed', 'glad to be here', 'rules pinned']);
    expect(resolved.map((e) => e.id)).toEqual(resolveChannelMessages(fx.authored).map((e) => e.id));
    expect(channel!.newEvents).toHaveLength(3); // cold pull: all are new
  });

  it('rejects a non-member and a removed member at auth (401 not_member)', async () => {
    fixture = await buildFixture();
    const fx = fixture;
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });

    // Owner publishes a REVISED descriptor that drops the removed member.
    const revised = reviseCommunity(fx.owner, fx.signed, {
      members: fx.signed.descriptor.members.filter((m) => m.deviceId !== fx.removed.publicKey),
    }, '2026-06-16T00:00:05.000Z');
    await ownerPublish(node, fx, revised);

    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    // Non-member: a valid key that is not in the descriptor.
    const nonMemberPull = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.nonMember,
      fetchFn: httpFetch,
      // A non-member would not hold the key, but it can still TRY to authenticate;
      // give it a real (foreign) key so the rejection is at AUTH, not decrypt.
      getEpochKey: () => ({ epoch: fx.epoch, secret: fx.epochSecret }),
      now: NOW,
    });
    expect(nonMemberPull).toEqual({ ok: false, reason: 'not_member' });

    // Removed member: held the key (still does), but is gone from the latest roster.
    const removedPull = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.removed,
      fetchFn: httpFetch,
      getEpochKey: () => ({ epoch: fx.epoch, secret: unwrapEpochSecret(fx.removedDb.adapter, fx.communityId, fx.epoch, fx.removed)! }),
      now: NOW,
    });
    expect(removedPull).toEqual({ ok: false, reason: 'not_member' });

    // The member is still accepted under the revised descriptor.
    const memberPull = await pullCommunityFeed({
      baseUrl: server.url,
      communityId: fx.communityId,
      identity: fx.member,
      fetchFn: httpFetch,
      getEpochKey: () => ({ epoch: fx.epoch, secret: unwrapEpochSecret(fx.memberDb.adapter, fx.communityId, fx.epoch, fx.member)! }),
      now: NOW,
    });
    expect(memberPull.ok).toBe(true);
  });

  it('the node holds only ciphertext: its stored piece cannot be parsed without the epoch key', async () => {
    fixture = await buildFixture();
    const fx = fixture;
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    await ownerPublish(node, fx, fx.signed);

    // Take the EXACT bytes the node stored for the snapshot pieces.
    const storedPieceStore = new InMemorySeederPieceStore();
    for (let i = 0; i < fx.snapshotManifest.pieces.length; i += 1) {
      const bytes = await node.servePiece(fx.snapshotManifest.infoHash, i);
      expect(bytes).not.toBeNull();
      storedPieceStore.put(fx.snapshotManifest.infoHash, i, bytes!);
    }

    // With the RIGHT key, the same stored bytes decrypt (sanity: the node really
    // is holding the real sealed snapshot).
    const good = await importSnapshotFromPieces({
      communityId: fx.communityId,
      channelId: CHANNEL,
      epoch: fx.snapshotEpoch,
      manifest: fx.snapshotManifest,
      pieceStore: storedPieceStore,
      groupKey: fx.epochSecret,
    });
    expect(good.ok).toBe(true);

    // With a WRONG (zero) key -- what the node itself holds (nothing) -- the very
    // same stored bytes fail closed: the node cannot produce plaintext.
    const wrong = await importSnapshotFromPieces({
      communityId: fx.communityId,
      channelId: CHANNEL,
      epoch: fx.snapshotEpoch,
      manifest: fx.snapshotManifest,
      pieceStore: storedPieceStore,
      groupKey: new Uint8Array(32),
    });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe('decrypt_failed');
  });

  // P6 item 1: per-community piece-path scoping. Two communities live on ONE node.
  // A member of community A is served its OWN piece over the scoped path, but is
  // served NOTHING (404) when it points the SAME valid auth at community B's piece
  // path -- and gets a 401 when it points its A-issued nonce at community B's id.
  it('scopes piece serving per community: a member of A cannot fetch B pieces', async () => {
    const fxA = await buildFixture();
    const fxB = await buildFixture();
    fixture = fxA; // afterEach closes fxA; close fxB inline below.

    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    await ownerPublish(node, fxA, fxA.signed);
    await ownerPublish(node, fxB, fxB.signed);

    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    const { signFeedAuth } = await import('@mylife/sync');

    // Member of A authenticates AGAINST community A and gets a nonce A issued.
    const challengeA = (await node.issueChallenge(fxA.communityId))!;
    const authA: Record<string, string> = {
      'x-mk-device': fxA.member.publicKey,
      'x-mk-nonce': challengeA.nonce,
      'x-mk-ts': NOW,
      'x-mk-sig': signFeedAuth(fxA.member, { communityId: fxA.communityId, nonce: challengeA.nonce, ts: NOW }),
    };

    // A's own piece over A's scoped path: served (200, real bytes).
    const ownHash = fxA.snapshotManifest.infoHash;
    const own = await rawGet(`${server.url}/community/${encodeURIComponent(fxA.communityId)}/${ownHash}/0`, authA);
    expect(own.status).toBe(200);
    expect(own.bytes && own.bytes.length).toBeGreaterThan(0);

    // B's piece over A's scoped path (auth for A, but ask for B's infoHash): the
    // infoHash does not belong to community A's snapshots -> 404, served nothing.
    const bHash = fxB.snapshotManifest.infoHash;
    const crossOwnPath = await rawGet(`${server.url}/community/${encodeURIComponent(fxA.communityId)}/${bHash}/0`, authA);
    expect(crossOwnPath.status).toBe(404);

    // B's piece over B's path with A's A-issued nonce: 401 (the nonce verifies only
    // for community A; against community B it is a bad/foreign nonce).
    const crossBPath = await rawGet(`${server.url}/community/${encodeURIComponent(fxB.communityId)}/${bHash}/0`, authA);
    expect(crossBPath.status).toBe(401);

    fxB.ownerDb.close();
    fxB.memberDb.close();
    fxB.removedDb.close();
  });
});
