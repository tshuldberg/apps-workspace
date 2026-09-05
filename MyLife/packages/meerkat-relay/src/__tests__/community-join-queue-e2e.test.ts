/**
 * Plan 57 W4 acceptance: the DURABLE join queue closes the asleep-owner gap.
 *
 * The money test drives the FULL handshake over real HTTP with real crypto and
 * a real node RESTART in the middle:
 *   1. A joiner (holding a real signed invite) parks a sealed JOIN_REQUEST on
 *      the node's durable box while the "owner sleeps".
 *   2. The node process dies and a NEW server boots over the same DATA_DIR
 *      (FileCommunityJoinStore): the parked request SURVIVES -- the exact
 *      failure that silently loses a relay-mailbox join today.
 *   3. The owner wakes, drains its request box through the SAME kind-routed
 *      handlers the relay drain uses (processJoinRequest), minting a real
 *      epoch wrap and parking the JOIN_GRANT back on the node.
 *   4. The joiner drains its grant box (applyJoinGrant) and ends holding a
 *      REAL epoch key + the descriptor that lists it. No fabricated states.
 *
 * Also proven: caps and bad-input rejections (typed reasons, verbatim),
 * non-consuming list + ack semantics, TTL sweep, and the notify seam firing on
 * a real accepted park.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  applyJoinGrant,
  buildJoinRequest,
  createCommunity,
  createCommunityInvite,
  createGroupCommit,
  createSyncTables,
  createWorkspace,
  drainJoinBoxFromNode,
  generateDeviceIdentity,
  getCurrentEpochKey,
  getCommunity,
  parkJoinEnvelopeOnNode,
  fetchJoinBoxFromNode,
  processJoinRequest,
  deriveCommunityJoinToken,
  upsertCommunity,
  type DeviceIdentity,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import { CommunityNode, InMemorySeederPieceStore } from '../index';
import { FileCommunityJoinStore, InMemoryCommunityJoinStore, CommunityJoinQueue, JOIN_QUEUE_LIMITS } from '../community-join-queue';
import { startCommunityNodeHttp } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

const NOW = '2026-09-01T00:00:00.000Z';

const httpFetch = ((input: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }) =>
  new Promise((resolve, reject) => {
    const req = http.request(String(input), { method: init?.method ?? 'GET', headers: init?.headers ?? {} }, (res) => {
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

function ownerDbFor(communityId: string, owner: DeviceIdentity, signed: SignedCommunityDescriptor): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  createWorkspace(db.adapter, {
    id: communityId, displayName: 'Join Club', workspaceType: 'community',
    createdByDeviceId: owner.publicKey, createdAt: NOW, rotatedAt: null, currentKeyVersion: 0, archivedAt: null,
  });
  createGroupCommit(db.adapter, {
    workspaceId: communityId,
    committer: owner,
    members: [{ deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey }],
    now: NOW,
  });
  upsertCommunity(db.adapter, signed, owner.publicKey);
  return db;
}

function joinerDbFor(): InMemoryTestDatabase {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  return db;
}

let server: SeederHttpServer | null = null;
let tmpDir: string | null = null;
const dbs: InMemoryTestDatabase[] = [];

afterEach(async () => {
  if (server) await server.close();
  server = null;
  for (const db of dbs.splice(0)) db.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = null;
});

async function bootServer(joinStore: FileCommunityJoinStore | InMemoryCommunityJoinStore, node: CommunityNode): Promise<SeederHttpServer> {
  return startCommunityNodeHttp({ node, host: '127.0.0.1', joinQueue: { store: joinStore } });
}

/** Owner publishes descriptor-only so the node hosts the community (join park requires it). */
async function seedNode(node: CommunityNode, owner: DeviceIdentity, signed: SignedCommunityDescriptor): Promise<void> {
  const communityId = signed.descriptor.communityId;
  const challenge = (await node.issueChallenge(communityId))!;
  const { signFeedAuth } = await import('@mylife/sync');
  const auth = {
    deviceId: owner.publicKey,
    nonce: challenge.nonce,
    ts: NOW,
    signature: signFeedAuth(owner, { communityId, nonce: challenge.nonce, ts: NOW }),
  };
  const verdict = await node.publish(communityId, { descriptor: signed, snapshots: [] }, auth);
  expect(verdict.ok).toBe(true);
}

describe('plan 57 W4: durable join queue over real HTTP', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-join-queue-'));
  });

  it('closes the asleep-owner gap: park -> node RESTART -> owner drain -> grant -> joiner holds a real epoch key', async () => {
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const signed = createCommunity(owner, {
      name: 'Join Club',
      channels: [{ id: 'general', name: 'general' }],
      now: NOW,
    });
    const communityId = signed.descriptor.communityId;
    const ownerDb = ownerDbFor(communityId, owner, signed);
    const joinerDb = joinerDbFor();
    dbs.push(ownerDb, joinerDb);

    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    await seedNode(node, owner, signed);
    server = await bootServer(new FileCommunityJoinStore(path.join(tmpDir!, 'joins')), node);

    // 1. Joiner parks a REAL sealed join request while the owner sleeps.
    const { invite } = createCommunityInvite(owner, signed, undefined, new Date(NOW));
    const built = buildJoinRequest(joiner, { descriptor: signed, invite }, NOW)!;
    expect(built).not.toBeNull();
    const parked = await parkJoinEnvelopeOnNode({
      baseUrl: server.url, communityId, token: built.token, envelope: built.envelope, fetchFn: httpFetch,
    });
    expect(parked.ok).toBe(true);

    // 2. The node process "dies"; a NEW server boots over the SAME DATA_DIR.
    await server.close();
    server = await bootServer(new FileCommunityJoinStore(path.join(tmpDir!, 'joins')), node);

    // 3. The owner wakes and drains its request box through the REAL handlers,
    //    parking the grant back on the node's durable box.
    const grantParks: string[] = [];
    const ownerDrain = await drainJoinBoxFromNode({
      baseUrl: server.url,
      communityId,
      token: deriveCommunityJoinToken(signed.descriptor.genesisNonce, communityId, owner.publicKey),
      identity: owner,
      handlers: {
        ...processJoinRequest({
          db: ownerDb.adapter,
          owner,
          parkEnvelope: async (token, envelope) => {
            // The grant targets the JOINER's token (not yet in the node's
            // roster), so the owner parks over the AUTHENTICATED lane.
            const result = await parkJoinEnvelopeOnNode({
              baseUrl: server!.url, communityId, token, envelope, identity: owner, now: NOW, fetchFn: httpFetch,
            });
            if (result.ok) grantParks.push(token);
            return result.ok;
          },
          now: () => NOW,
        }),
      },
      fetchFn: httpFetch,
    });
    expect(ownerDrain).toMatchObject({ fetched: 1, applied: 1, rejected: 0, acked: 1 });
    expect(grantParks).toHaveLength(1);

    // The owner's descriptor now LISTS the joiner (a real signed revision).
    const ownerStored = getCommunity(ownerDb.adapter, communityId)!;
    expect(ownerStored.descriptor.members.some((m) => m.deviceId === joiner.publicKey)).toBe(true);

    // 4. The joiner drains its grant box and ends holding a REAL epoch key.
    const joinerDrain = await drainJoinBoxFromNode({
      baseUrl: server.url,
      communityId,
      token: deriveCommunityJoinToken(signed.descriptor.genesisNonce, communityId, joiner.publicKey),
      identity: joiner,
      handlers: { ...applyJoinGrant({ db: joinerDb.adapter, self: joiner, now: () => NOW }) },
      fetchFn: httpFetch,
    });
    expect(joinerDrain).toMatchObject({ fetched: 1, applied: 1, rejected: 0, acked: 1 });

    const joinerStored = getCommunity(joinerDb.adapter, communityId)!;
    expect(joinerStored.descriptor.members.some((m) => m.deviceId === joiner.publicKey)).toBe(true);
    expect(getCurrentEpochKey(joinerDb.adapter, communityId, joiner)).not.toBeNull();

    // Both boxes are empty after the acks (nothing left to double-apply).
    const requestBox = await fetchJoinBoxFromNode({
      baseUrl: server.url, communityId,
      token: deriveCommunityJoinToken(signed.descriptor.genesisNonce, communityId, owner.publicKey),
      fetchFn: httpFetch,
    });
    expect(requestBox).toMatchObject({ ok: true, entries: [] });
  });

  it('rejects bad input with typed reasons and enforces the per-box cap', async () => {
    const owner = generateDeviceIdentity('Owner');
    const signed = createCommunity(owner, { name: 'Caps', channels: [{ id: 'general', name: 'general' }], now: NOW });
    const communityId = signed.descriptor.communityId;
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore(), now: () => Date.parse(NOW) });
    await seedNode(node, owner, signed);
    server = await bootServer(new InMemoryCommunityJoinStore(), node);

    // Unknown community -> 404 unknown_community.
    const unknown = await parkJoinEnvelopeOnNode({
      baseUrl: server.url, communityId: 'nope', token: 'a'.repeat(64),
      envelope: { v: 1 } as never, fetchFn: httpFetch,
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toBe('unknown_community');

    // Bad token -> bad_token.
    const badToken = await httpFetch(`${server.url}/community/${encodeURIComponent(communityId)}/join/park`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'short', envelope: 'aGk=' }),
    });
    expect(badToken.status).toBe(400);
    expect(await badToken.json()).toEqual({ reason: 'bad_token' });

    // Token-exhaustion defense: an unauthenticated park to a token the node
    // cannot derive from its CURRENT roster is refused, so a flood of random
    // 64-hex tokens can never exhaust the per-community token cap.
    const randomToken = await httpFetch(`${server.url}/community/${encodeURIComponent(communityId)}/join/park`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'b'.repeat(64), envelope: 'aGk=' }),
    });
    expect(randomToken.status).toBe(401);
    expect(await randomToken.json()).toEqual({ reason: 'token_not_recognized' });

    // Per-box cap: the 33rd park is refused as box_full, never silently dropped.
    // The box is the OWNER's roster-derived request box (the one an
    // unauthenticated joiner may legitimately fill).
    const token = deriveCommunityJoinToken(signed.descriptor.genesisNonce, communityId, owner.publicKey);
    for (let i = 0; i < JOIN_QUEUE_LIMITS.maxPerToken; i += 1) {
      const res = await httpFetch(`${server.url}/community/${encodeURIComponent(communityId)}/join/park`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, envelope: 'aGk=' }),
      });
      expect(res.status).toBe(200);
    }
    const overflow = await httpFetch(`${server.url}/community/${encodeURIComponent(communityId)}/join/park`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, envelope: 'aGk=' }),
    });
    expect(overflow.status).toBe(429);
    expect(await overflow.json()).toEqual({ reason: 'box_full' });
  });

  it('list does not consume; ack removes exactly the processed ids; TTL sweep expires', async () => {
    const store = new InMemoryCommunityJoinStore();
    let nowMs = Date.parse(NOW);
    const parkedNotifies: string[] = [];
    const queue = new CommunityJoinQueue({
      store,
      now: () => nowMs,
      onParked: (communityId) => { parkedNotifies.push(communityId); },
    });

    const token = 'c'.repeat(64);
    const first = await queue.park('community-1', token, 'aGVsbG8=', true, true);
    expect(first.ok).toBe(true);
    expect(parkedNotifies).toEqual(['community-1']);

    // Two lists in a row both see the entry (non-consuming).
    const listA = await queue.list('community-1', token);
    const listB = await queue.list('community-1', token);
    expect(Array.isArray(listA) && listA.length).toBe(1);
    expect(Array.isArray(listB) && listB.length).toBe(1);

    // Ack removes it.
    const entryId = (listA as { id: string }[])[0]!.id;
    expect(await queue.ack('community-1', token, [entryId])).toBe(1);
    expect(await queue.list('community-1', token)).toEqual([]);

    // TTL: a parked entry disappears after the (clamped) TTL elapses.
    const second = await queue.park('community-1', token, 'aGVsbG8=', true, true);
    expect(second.ok).toBe(true);
    nowMs += JOIN_QUEUE_LIMITS.ttlMs + 1;
    expect(await queue.list('community-1', token)).toEqual([]);
  });
});

describe('audit 2026-09-01 R2: per-community byte cap + throttled sweep', () => {
  it('refuses a park that would push the community past its byte cap, on both stores', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-join-bytes-'));
    try {
      for (const store of [new InMemoryCommunityJoinStore(), new FileCommunityJoinStore(dir)]) {
        const queue = new CommunityJoinQueue({ store, maxBytesPerCommunity: 1_000 });
        const tokenA = 'a'.repeat(64);
        const tokenB = 'b'.repeat(64);
        const big = 'A'.repeat(400);
        expect((await queue.park('c', tokenA, big, true, true)).ok).toBe(true);
        expect((await queue.park('c', tokenB, big, true, true)).ok).toBe(true);
        // 800 + 400 > 1000: refused with the typed community_full, never dropped.
        const over = await queue.park('c', tokenA, big, true, true);
        expect(over).toEqual({ ok: false, status: 429, reason: 'community_full' });
        // A small one still fits (800 + 100 <= 1000).
        expect((await queue.park('c', tokenA, 'A'.repeat(100), true, true)).ok).toBe(true);
        // Other communities are unaffected by this one's cap.
        expect((await queue.park('d', tokenA, big, true, true)).ok).toBe(true);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sweeps the directory at most once per interval while list stays exact', async () => {
    let sweeps = 0;
    const inner = new InMemoryCommunityJoinStore();
    const store = {
      park: inner.park.bind(inner), list: inner.list.bind(inner), ack: inner.ack.bind(inner),
      count: inner.count.bind(inner), tokenCount: inner.tokenCount.bind(inner), byteCount: inner.byteCount.bind(inner),
      sweep: (nowMs: number) => { sweeps += 1; return inner.sweep(nowMs); },
    };
    let nowMs = Date.parse(NOW);
    const queue = new CommunityJoinQueue({ store, now: () => nowMs });
    const token = 'e'.repeat(64);
    for (let i = 0; i < 10; i += 1) expect((await queue.park('c', token, 'aGk=', true, true)).ok).toBe(true);
    expect(sweeps).toBe(1);
    // Past the TTL the entries are gone from list immediately, even before the next sweep.
    nowMs += JOIN_QUEUE_LIMITS.ttlMs + 1;
    nowMs += JOIN_QUEUE_LIMITS.sweepIntervalMs; // and the next call sweeps for real
    expect(await queue.list('c', token)).toEqual([]);
    expect(sweeps).toBe(2);
    expect(inner.count('c', token)).toBe(0);
  });
});
