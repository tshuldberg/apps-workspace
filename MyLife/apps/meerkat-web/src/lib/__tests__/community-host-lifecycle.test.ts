/**
 * Plan 57 W2/W3 (web twin): community server (host) lifecycle. VERBATIM twin of
 * apps/meerkat/app/__tests__/community-host-lifecycle.test.ts over the web data
 * layer, proving the same fail-closed attach, honest exit, real sealed-tail
 * append, and snapshot publish behaviors against a wire-accurate fake node.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  buildJoinRequest,
  createChannelMessage,
  createCommunity,
  createCommunityInvite,
  createSyncTables,
  deriveCommunityJoinToken,
  generateDeviceIdentity,
  getCommunity,
  parkJoinEnvelopeOnNode,
  processJoinRequest,
  verifySealedTailEntry,
  type ChannelMessageEvent,
  type DeviceIdentity,
  type SealedTailEntry,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import {
  appendEventToCommunityHost,
  clearCommunityHost,
  drainCommunityJoinBoxesFromHosts,
  getCommunityHostUrl,
  insertMessageRow,
  normalizeCommunityHostUrl,
  parkJoinRequestOnInviteHost,
  publishCommunitySnapshotsToHost,
  setCommunityHost,
  storeOwnedCommunity,
} from '../meerkat-data';
import { COMMUNITY_DDL, ensureMeerkatTables } from '../schema';

const NOW = '2026-09-01T00:00:00.000Z';
const CHANNEL = 'general';
const HOST = 'http://node.test:8890';

interface FakeNodeState {
  publishes: Array<{ descriptor: SignedCommunityDescriptor; snapshots: Array<{ channelId: string; pieces: string[] }> }>;
  appends: SealedTailEntry[];
  urls: string[];
  healthy: boolean;
  publishReason: string | null;
  /** Durable join boxes: token -> [{id, envelopeB64}] (Plan 57 W4). */
  joinBoxes: Map<string, Array<{ id: string; envelopeB64: string }>>;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

/** A wire-accurate fake community node: append entries are REALLY verified. */
function fakeNode(descriptor: () => SignedCommunityDescriptor): { fetchFn: typeof fetch; state: FakeNodeState } {
  const state: FakeNodeState = { publishes: [], appends: [], urls: [], healthy: true, publishReason: null, joinBoxes: new Map() };
  let joinCounter = 0;
  const fetchFn = (async (input: unknown, init?: { method?: string; body?: unknown }) => {
    const url = String(input);
    state.urls.push(url);
    if (url.endsWith('/healthz')) {
      return state.healthy ? jsonResponse(200, { ok: true }) : jsonResponse(503, { ok: false });
    }
    if (url.endsWith('/join/park')) {
      const body = JSON.parse(String(init?.body)) as { token: string; envelope: string };
      joinCounter += 1;
      const entry = { id: `jq_${joinCounter}`, envelopeB64: body.envelope };
      const list = state.joinBoxes.get(body.token) ?? [];
      list.push(entry);
      state.joinBoxes.set(body.token, list);
      return jsonResponse(200, { ok: true, id: entry.id });
    }
    const boxMatch = /\/join\/box\/([0-9a-f]{64})$/.exec(url);
    if (boxMatch) {
      return jsonResponse(200, { entries: state.joinBoxes.get(boxMatch[1]!) ?? [] });
    }
    if (url.endsWith('/join/ack')) {
      const body = JSON.parse(String(init?.body)) as { token: string; ids: string[] };
      const list = state.joinBoxes.get(body.token) ?? [];
      const drop = new Set(body.ids);
      const kept = list.filter((entry) => !drop.has(entry.id));
      state.joinBoxes.set(body.token, kept);
      return jsonResponse(200, { ok: true, acked: list.length - kept.length });
    }
    if (url.endsWith('/challenge')) {
      return jsonResponse(200, { nonce: `nonce-${state.urls.length}`, expiresAt: '2026-09-01T00:05:00.000Z' });
    }
    if (url.endsWith('/publish')) {
      if (state.publishReason) return jsonResponse(401, { reason: state.publishReason });
      state.publishes.push(JSON.parse(String(init?.body)) as FakeNodeState['publishes'][number]);
      return jsonResponse(200, { ok: true });
    }
    if (url.endsWith('/append')) {
      const entry = JSON.parse(String(init?.body)) as SealedTailEntry;
      const verdict = verifySealedTailEntry(entry, descriptor().descriptor);
      if (!verdict.ok) return jsonResponse(401, { reason: verdict.reason });
      state.appends.push(entry);
      return jsonResponse(200, { ok: true });
    }
    return jsonResponse(404, { reason: 'not_found' });
  }) as unknown as typeof fetch;
  return { fetchFn, state };
}

let db: InMemoryTestDatabase;
let owner: DeviceIdentity;
let member: DeviceIdentity;
let signed: SignedCommunityDescriptor;
let communityId: string;

function recordMessage(author: DeviceIdentity, body: string, wall: string): ChannelMessageEvent {
  const event = createChannelMessage(author, {
    communityId, channelId: CHANNEL, body, hlc: { wall, counter: 0 },
  });
  insertMessageRow(db.adapter, event);
  return event;
}

beforeEach(() => {
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  ensureMeerkatTables(db.adapter);
  for (const ddl of COMMUNITY_DDL) db.adapter.execute(ddl);
  owner = generateDeviceIdentity('Owner');
  member = generateDeviceIdentity('Member');
  signed = createCommunity(owner, {
    name: 'Trail Crew',
    channels: [{ id: CHANNEL, name: CHANNEL }],
    members: [
      { deviceId: member.publicKey, role: 'member', displayName: member.displayName, dhPublicKey: member.dhPublicKey },
    ],
    now: NOW,
  });
  communityId = signed.descriptor.communityId;
  storeOwnedCommunity(db.adapter, owner, signed, NOW);
});

describe('normalizeCommunityHostUrl (web twin)', () => {
  it('accepts a plain http(s) base and strips trailing slashes', () => {
    expect(normalizeCommunityHostUrl(' https://node.example ')).toBe('https://node.example');
    expect(normalizeCommunityHostUrl('http://10.0.0.2:8890///')).toBe('http://10.0.0.2:8890');
  });
  it('rejects non-http schemes, credentials, queries, and garbage', () => {
    expect(normalizeCommunityHostUrl('ws://node.example')).toBeNull();
    expect(normalizeCommunityHostUrl('https://user:pw@node.example')).toBeNull();
    expect(normalizeCommunityHostUrl('https://node.example/?x=1')).toBeNull();
    expect(normalizeCommunityHostUrl('not a url')).toBeNull();
  });
});

describe('setCommunityHost (web twin)', () => {
  it('attaches after healthz + accepted publish; descriptor carries the host', async () => {
    recordMessage(owner, 'first post', '2026-09-01T00:00:10.000Z');
    const node = fakeNode(() => signed);
    const result = await setCommunityHost(db.adapter, owner, communityId, `${HOST}/`, { fetchFn: node.fetchFn, now: NOW });
    expect(result).toEqual({ ok: true, hostUrl: HOST, channels: 1 });
    expect(getCommunityHostUrl(db.adapter, communityId)).toBe(HOST);
    expect(node.state.publishes).toHaveLength(1);
    const publishedDescriptor = node.state.publishes[0]!.descriptor.descriptor;
    expect(publishedDescriptor.hosts).toEqual([HOST]);
    expect(publishedDescriptor.revision).toBe(signed.descriptor.revision + 1);
  });

  it('attaches nothing when the health check fails', async () => {
    const node = fakeNode(() => signed);
    node.state.healthy = false;
    const result = await setCommunityHost(db.adapter, owner, communityId, HOST, { fetchFn: node.fetchFn, now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unreachable');
    expect(getCommunityHostUrl(db.adapter, communityId)).toBeNull();
  });

  it('attaches nothing when the node refuses the publish, reason verbatim', async () => {
    const node = fakeNode(() => signed);
    node.state.publishReason = 'stale_revision';
    const result = await setCommunityHost(db.adapter, owner, communityId, HOST, { fetchFn: node.fetchFn, now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('publish_failed');
    expect(result.detail).toBe('stale_revision');
    expect(getCommunityHostUrl(db.adapter, communityId)).toBeNull();
  });

  it('rejects a non-owner and a malformed url before any request', async () => {
    const node = fakeNode(() => signed);
    const nonOwner = await setCommunityHost(db.adapter, member, communityId, HOST, { fetchFn: node.fetchFn, now: NOW });
    expect(nonOwner.ok).toBe(false);
    if (!nonOwner.ok) expect(nonOwner.reason).toBe('not_owner');
    const badUrl = await setCommunityHost(db.adapter, owner, communityId, 'ftp://nope', { fetchFn: node.fetchFn, now: NOW });
    expect(badUrl.ok).toBe(false);
    if (!badUrl.ok) expect(badUrl.reason).toBe('bad_url');
    expect(node.state.urls).toHaveLength(0);
  });
});

describe('clearCommunityHost (web twin)', () => {
  it('commits the exit locally first; a dead node cannot block its firing', async () => {
    const node = fakeNode(() => signed);
    const attached = await setCommunityHost(db.adapter, owner, communityId, HOST, { fetchFn: node.fetchFn, now: NOW });
    expect(attached.ok).toBe(true);
    const deadFetch = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
    const cleared = await clearCommunityHost(db.adapter, owner, communityId, { fetchFn: deadFetch, now: '2026-09-01T01:00:00.000Z' });
    expect(cleared).toEqual({ ok: true, removedHostUrl: HOST, exitRepublished: false });
    expect(getCommunityHostUrl(db.adapter, communityId)).toBeNull();
  });

  it('reports honestly when no server is attached', async () => {
    const cleared = await clearCommunityHost(db.adapter, owner, communityId, { now: NOW });
    expect(cleared.ok).toBe(false);
    if (!cleared.ok) expect(cleared.reason).toBe('no_host');
  });
});

describe('appendEventToCommunityHost (web twin)', () => {
  it('is an honest no-op without a host', async () => {
    const event = recordMessage(owner, 'hello', '2026-09-01T00:00:10.000Z');
    const result = await appendEventToCommunityHost(db.adapter, owner, event, { now: NOW });
    expect(result).toEqual({ ok: false, reason: 'no_host' });
  });

  it('mirrors a recorded event as a real SealedTailEntry the roster verifies', async () => {
    const node = fakeNode(() => signed);
    const attached = await setCommunityHost(db.adapter, owner, communityId, HOST, { fetchFn: node.fetchFn, now: NOW });
    expect(attached.ok).toBe(true);
    const event = recordMessage(owner, 'live tail from the owner', '2026-09-01T00:10:00.000Z');
    const result = await appendEventToCommunityHost(db.adapter, owner, event, { fetchFn: node.fetchFn, now: NOW });
    expect(result).toEqual({ ok: true, hostUrl: HOST });
    expect(node.state.appends).toHaveLength(1);
    const entry = node.state.appends[0]!;
    expect(entry.communityId).toBe(communityId);
    expect(entry.channelId).toBe(CHANNEL);
    expect(entry.authorDeviceId).toBe(owner.publicKey);
  });
});

describe('durable join queue over the host (Plan 57 W4, web twin)', () => {
  it('joiner parks a REAL sealed request on the invite host; the asleep owner later drains it, mints a real grant, and the joiner lands in the roster', async () => {
    const node = fakeNode(() => signed);
    const attached = await setCommunityHost(db.adapter, owner, communityId, HOST, { fetchFn: node.fetchFn, now: NOW });
    expect(attached.ok).toBe(true);
    const hosted = getCommunity(db.adapter, communityId)!;
    const hostedSigned = { descriptor: hosted.descriptor, signature: hosted.signature };

    const joiner = generateDeviceIdentity('Joiner');
    const { invite } = createCommunityInvite(owner, hostedSigned, undefined, new Date(NOW));
    const built = buildJoinRequest(joiner, { descriptor: hostedSigned, invite }, NOW)!;
    expect(built).not.toBeNull();
    const parked = await parkJoinRequestOnInviteHost(hostedSigned, built.token, built.envelope, { fetchFn: node.fetchFn });
    expect(parked).toBe(true);

    const grantTokens: string[] = [];
    const drained = await drainCommunityJoinBoxesFromHosts(
      db.adapter,
      owner,
      (cid, hostUrl) => ({
        ...processJoinRequest({
          db: db.adapter,
          owner,
          parkEnvelope: async (token, envelope) => {
            const result = await parkJoinEnvelopeOnNode({
              baseUrl: hostUrl, communityId: cid, token, envelope, fetchFn: node.fetchFn,
            });
            if (result.ok) grantTokens.push(token);
            return result.ok;
          },
          now: () => NOW,
        }),
      }),
      { fetchFn: node.fetchFn },
    );
    expect(drained).toMatchObject({ communities: 1, fetched: 1, applied: 1, rejected: 0 });
    expect(grantTokens).toHaveLength(1);

    const revised = getCommunity(db.adapter, communityId)!;
    expect(revised.descriptor.members.some((m) => m.deviceId === joiner.publicKey)).toBe(true);
    const requestToken = deriveCommunityJoinToken(hosted.descriptor.genesisNonce, communityId, owner.publicKey);
    expect(node.state.joinBoxes.get(requestToken) ?? []).toHaveLength(0);
    expect(node.state.joinBoxes.get(grantTokens[0]!)).toHaveLength(1);
  });

  it('parkJoinRequestOnInviteHost is an honest false with no host in the descriptor', async () => {
    const joiner = generateDeviceIdentity('Joiner');
    const { invite } = createCommunityInvite(owner, signed, undefined, new Date(NOW));
    const built = buildJoinRequest(joiner, { descriptor: signed, invite }, NOW)!;
    const parked = await parkJoinRequestOnInviteHost(signed, built.token, built.envelope, {
      fetchFn: (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch,
    });
    expect(parked).toBe(false);
  });

  it('a listed non-owner member drains no join box', async () => {
    const node = fakeNode(() => signed);
    const attached = await setCommunityHost(db.adapter, owner, communityId, HOST, { fetchFn: node.fetchFn, now: NOW });
    expect(attached.ok).toBe(true);
    const drained = await drainCommunityJoinBoxesFromHosts(
      db.adapter,
      member,
      () => ({}),
      { fetchFn: node.fetchFn },
    );
    expect(drained).toEqual({ communities: 0, fetched: 0, applied: 0, rejected: 0 });
  });
});

describe('publishCommunitySnapshotsToHost (web twin)', () => {
  it('is an honest no-op without a host', async () => {
    const result = await publishCommunitySnapshotsToHost(db.adapter, owner, communityId, { now: NOW });
    expect(result).toEqual({ ok: false, reason: 'no_host' });
  });

  it('publishes refreshed snapshots to the attached host', async () => {
    recordMessage(owner, 'first post', '2026-09-01T00:00:10.000Z');
    const node = fakeNode(() => signed);
    const attached = await setCommunityHost(db.adapter, owner, communityId, HOST, { fetchFn: node.fetchFn, now: NOW });
    expect(attached.ok).toBe(true);
    recordMessage(owner, 'second post', '2026-09-01T00:20:00.000Z');
    const result = await publishCommunitySnapshotsToHost(db.adapter, owner, communityId, {
      fetchFn: node.fetchFn, now: '2026-09-01T00:21:00.000Z',
    });
    expect(result).toEqual({ ok: true, hostUrl: HOST, channels: 1 });
    expect(node.state.publishes).toHaveLength(2);
    const refreshed = node.state.publishes[1]!;
    expect(refreshed.snapshots[0]!.channelId).toBe(CHANNEL);
    expect(refreshed.snapshots[0]!.pieces.length).toBeGreaterThan(0);
  });

  it('refuses for a non-owner device', async () => {
    const node = fakeNode(() => signed);
    const attached = await setCommunityHost(db.adapter, owner, communityId, HOST, { fetchFn: node.fetchFn, now: NOW });
    expect(attached.ok).toBe(true);
    const result = await publishCommunitySnapshotsToHost(db.adapter, member, communityId, { fetchFn: node.fetchFn, now: NOW });
    expect(result).toEqual({ ok: false, reason: 'not_owner' });
  });
});
