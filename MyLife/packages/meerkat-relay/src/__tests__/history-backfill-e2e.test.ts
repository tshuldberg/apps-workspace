/**
 * Community feed P3 acceptance: member-to-member history BACKFILL over a REAL
 * relay mailbox, with NO community node.
 *
 * Everything is real: two fully independent @mylife/sync nodes (the multi-node
 * harness: real Ed25519/X25519 identities, real signed CommunityDescriptor,
 * real signed ChannelMessageEvents in cm_messages), a real loopback RelayServer
 * with the long mailbox TTL, the real pair-private mailbox seal/open primitives
 * (sealHistoryRequestMailbox / sealHistoryGrantMailbox), and the REAL drain
 * (runMailboxDrainJob) routing every envelope through the REAL dispatcher
 * (applyMailboxEnvelope). The serve + apply handlers are the EXACT shape the app
 * ships in apps/meerkat/.../data/history-backfill-core.ts (it cannot be imported
 * here -- the relay tsconfig pins rootDir to ./src -- so the handlers are rebuilt
 * from the SAME @mylife/sync primitives, re-verifying + role-gating on BOTH
 * sides). No stubs; every assertion is on real cm_messages rows + real drain
 * counts.
 *
 * Acceptance proven here:
 *  1. A authors several signed messages (incl. an edit/supersede); B has NONE.
 *     B requests a full backfill (null cursor), parked on A's mailbox token.
 *  2. A drains its mailbox -> SERVES -> parks a verified grant on B's token.
 *  3. B drains -> APPLIES -> B's cm_messages now hold A's events; B's resolved
 *     feed equals A's resolved feed; B's cursor advanced to the highest HLC.
 *  4. Negatives: a NON-member C requesting from A is served NOTHING (gate drops
 *     it, no grant parked); and a tampered event inside a grant is dropped by B
 *     (mergeChannelMessageEvents invalid++), nothing written.
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  applyMailboxEnvelope,
  compareChannelMessages,
  createChannelMessage,
  createCommunity,
  decodeMailboxEnvelope,
  encodeMailboxEnvelope,
  evaluateChannelPost,
  getCommunity,
  isAfterCursor,
  isServableEvent,
  resolveChannelMessages,
  runMailboxDrainJob,
  sealHistoryGrantMailbox,
  sealHistoryRequestMailbox,
  verifyChannelMessage,
  HISTORY_GRANT_MAX_EVENTS,
  historyRequestId,
  type ChannelMessageEvent,
  type Hlc,
  type HistoryGrantMailboxPayload,
  type HistoryRequestMailboxPayload,
  type MailboxDrainPeer,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import { WebSocketRelayBackend } from '@mylife/sync';
import { startRelayServer } from '../server';
import {
  buildNode,
  destroyNode,
  installCommunityOnNode,
  pairNodes,
  recordChannelMessageOnNode,
  stopRelayHarness,
  type MeerkatNode,
  type RelayHarness,
} from './support/multi-node-harness';

const CHANNEL = 'general';
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// In-test cursor store (the harness DB has no cm_feed_cursor table; P3's cursor
// helpers live in the app, which cannot be imported). A tiny per-node map mirrors
// getFeedCursor / setFeedCursor row-only semantics so the apply side can advance.
// ---------------------------------------------------------------------------

function cursorKey(communityId: string, channelId: string): string {
  return `${communityId}:${channelId}`;
}

// ---------------------------------------------------------------------------
// Read a node's verified, HLC-ordered events for a channel. The harness
// cm_messages schema has no attachments_json column, so this builds events
// without attachments (the app's listChannelMessageEvents does include them; the
// crypto path is identical -- canonicalChannelMessage emits [] for no attachments).
// ---------------------------------------------------------------------------

function eventsFromNode(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
): ChannelMessageEvent[] {
  const rows = db.query<{
    id: string;
    community_id: string;
    channel_id: string;
    author_device_id: string;
    body: string;
    hlc_wall: string;
    hlc_counter: number;
    supersedes_id: string | null;
    supersedes_deleted: number | null;
    signature: string;
  }>(
    `SELECT id, community_id, channel_id, author_device_id, body,
       hlc_wall, hlc_counter, supersedes_id, supersedes_deleted, signature
     FROM cm_messages WHERE community_id = ? AND channel_id = ?`,
    [communityId, channelId],
  );
  return rows
    .map((row): ChannelMessageEvent => ({
      version: 1,
      id: row.id,
      communityId: row.community_id,
      channelId: row.channel_id,
      authorDeviceId: row.author_device_id,
      body: row.body,
      hlc: { wall: row.hlc_wall, counter: row.hlc_counter },
      supersedes: row.supersedes_id
        ? { id: row.supersedes_id, deleted: row.supersedes_deleted === 1 }
        : undefined,
      signature: row.signature,
    }))
    .filter((event) => verifyChannelMessage(event))
    .sort(compareChannelMessages);
}

function highestEventHlc(events: readonly ChannelMessageEvent[]): Hlc | null {
  let highest: Hlc | null = null;
  for (const event of events) {
    if (
      !highest
      || event.hlc.wall > highest.wall
      || (event.hlc.wall === highest.wall && event.hlc.counter > highest.counter)
    ) {
      highest = event.hlc;
    }
  }
  return highest;
}

/**
 * Re-implements the app's mergeChannelMessageEvents over the harness schema:
 * verify each, skip existing ids, INSERT OR IGNORE the rest. Returns honest
 * counts (inserted/skipped/invalid), exactly like community-core.ts.
 */
function mergeEventsOnNode(
  db: DatabaseAdapter,
  events: readonly ChannelMessageEvent[],
): { inserted: number; skipped: number; invalid: number } {
  let inserted = 0;
  let skipped = 0;
  let invalid = 0;
  for (const event of events) {
    if (!verifyChannelMessage(event)) {
      invalid += 1;
      continue;
    }
    const existing = db.query<{ id: string }>('SELECT id FROM cm_messages WHERE id = ? LIMIT 1', [event.id]);
    if (existing.length > 0) {
      skipped += 1;
      continue;
    }
    db.execute(
      `INSERT OR IGNORE INTO cm_messages (
        id, community_id, channel_id, author_device_id, body,
        hlc_wall, hlc_counter, supersedes_id, supersedes_deleted, signature, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id, event.communityId, event.channelId, event.authorDeviceId, event.body,
        event.hlc.wall, event.hlc.counter,
        event.supersedes?.id ?? null,
        event.supersedes ? (event.supersedes.deleted ? 1 : 0) : null,
        event.signature, event.hlc.wall,
      ],
    );
    inserted += 1;
  }
  return { inserted, skipped, invalid };
}

/**
 * Build the SAME serve + apply handler shape the app ships
 * (history-backfill-core.ts), rebuilt from @mylife/sync primitives because the
 * app file is not importable from the relay package. Re-verifies + role-gates on
 * BOTH sides; advances the in-test cursor on apply.
 */
function buildBackfillHandlers(deps: {
  node: MeerkatNode;
  resolvePeer: (deviceId: string) => { dhPublicKey: string; sharedSecretHex: string } | null;
  parkEnvelope: (token: string, envelope: MailboxEnvelope) => boolean | Promise<boolean>;
  cursors: Map<string, Hlc>;
  activeMember: (communityId: string, deviceId: string) => boolean;
}): Pick<MailboxEnvelopeHandlers, 'historyRequest' | 'historyGrant'> {
  const { node, resolvePeer, parkEnvelope, cursors, activeMember } = deps;
  const db = node.db;
  return {
    historyRequest: async (senderDeviceId, payload: HistoryRequestMailboxPayload): Promise<boolean> => {
      // Gate the requester FIRST, fail-closed.
      if (!activeMember(payload.communityId, senderDeviceId)) return false;
      const community = getCommunity(db, payload.communityId);
      if (!community) return false;
      const descriptor = community.descriptor;
      if (!descriptor.channels.some((c) => c.id === payload.channelId)) return false;

      const all = eventsFromNode(db, payload.communityId, payload.channelId);
      const servable: ChannelMessageEvent[] = [];
      for (const event of all) {
        if (!isAfterCursor(event, payload.sinceWall, payload.sinceCounter)) continue;
        if (!isServableEvent(event)) continue;
        if (!evaluateChannelPost(descriptor, event.authorDeviceId, payload.channelId).allowed) continue;
        servable.push(event);
        if (servable.length >= HISTORY_GRANT_MAX_EVENTS) break;
      }
      if (servable.length === 0) return false;

      const peer = resolvePeer(senderDeviceId);
      if (!peer) return false;

      const grantPayload: HistoryGrantMailboxPayload = {
        kind: 'meerkat.history-grant-v1',
        version: 1,
        communityId: payload.communityId,
        channelId: payload.channelId,
        requestId: payload.requestId,
        events: servable,
      };
      const sealed = sealHistoryGrantMailbox({
        sender: node.identity,
        recipient: { deviceId: senderDeviceId, dhPublicKey: peer.dhPublicKey },
        pairSharedSecretHex: peer.sharedSecretHex,
        payload: grantPayload,
      });
      const parked = await parkEnvelope(sealed.token, sealed.envelope);
      return parked === true;
    },
    historyGrant: (_senderDeviceId, payload: HistoryGrantMailboxPayload): boolean => {
      const community = getCommunity(db, payload.communityId);
      if (!community) return false;
      const descriptor = community.descriptor;

      const valid: ChannelMessageEvent[] = [];
      for (const event of payload.events) {
        if (event.communityId !== payload.communityId) continue;
        if (event.channelId !== payload.channelId) continue;
        if (!verifyChannelMessage(event)) continue;
        if (!evaluateChannelPost(descriptor, event.authorDeviceId, payload.channelId).allowed) continue;
        valid.push(event);
      }
      if (valid.length === 0) return false;

      const merge = mergeEventsOnNode(db, valid);
      if (merge.inserted <= 0) return false;

      const stored = eventsFromNode(db, payload.communityId, payload.channelId);
      const highest = highestEventHlc(stored);
      if (highest) {
        const key = cursorKey(payload.communityId, payload.channelId);
        const cursor = cursors.get(key);
        if (
          !cursor
          || highest.wall > cursor.wall
          || (highest.wall === cursor.wall && highest.counter > cursor.counter)
        ) {
          cursors.set(key, highest);
        }
      }
      return true;
    },
  };
}

/**
 * One drain peer entry for a paired node (active, not revoked, with the real
 * shared secret), exactly the shape SyncProvider.resolveForegroundDrainPeers
 * produces.
 */
function drainPeer(deviceId: string, sharedSecretHex: string): MailboxDrainPeer {
  return { deviceId, pairSharedSecretHex: sharedSecretHex, revoked: false, isActive: true };
}

/** A peer-resolver for the serve side: only the one paired peer is resolvable. */
function makeResolvePeer(
  peerDeviceId: string,
  peerDhPublicKey: string,
  sharedSecretHex: string,
): (deviceId: string) => { dhPublicKey: string; sharedSecretHex: string } | null {
  return (deviceId) =>
    deviceId === peerDeviceId ? { dhPublicKey: peerDhPublicKey, sharedSecretHex } : null;
}

/** Park a sealed envelope on the relay (a fresh backend per park, like the app). */
async function parkOnRelay(harness: RelayHarness, token: string, envelope: MailboxEnvelope): Promise<boolean> {
  try {
    const session = await harness.backend.connect(harness.url, token);
    try {
      await session.send(encodeMailboxEnvelope(envelope));
      return true;
    } finally {
      await session.close();
    }
  } catch {
    return false;
  }
}

/** The "let the relay buffer the frames" wait the mailbox e2e uses. */
function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let harness: RelayHarness | null = null;
const nodes: MeerkatNode[] = [];

afterEach(async () => {
  for (const node of nodes.splice(0)) await destroyNode(node);
  await stopRelayHarness(harness);
  harness = null;
});

async function startHarness(): Promise<RelayHarness> {
  // A long mailbox TTL so a parked request/grant survives the cross-drain gap.
  const server = await startRelayServer({
    port: 0,
    host: '127.0.0.1',
    limits: { mailboxTtlMs: DAY_MS, mailboxMax: 256 },
  });
  return { server, backend: new WebSocketRelayBackend(), url: `ws://127.0.0.1:${server.port}` };
}

describe('community feed P3: member-to-member history backfill over a real relay mailbox', () => {
  it('B reconstructs A\'s full channel feed (incl. an edit) and advances its cursor', async () => {
    harness = await startHarness();
    const h = harness;

    const a = await buildNode('NodeA');
    const b = await buildNode('NodeB');
    nodes.push(a, b);

    // Real X25519 pairing: both sides derive the same secret (and record it).
    const secret = pairNodes(a, b);

    // A founds a community with both A and B as members; install on BOTH nodes so
    // each holds the membership/roles the gate reads.
    const signed: SignedCommunityDescriptor = createCommunity(a.identity, {
      name: 'Feed Club P3',
      channels: [{ id: CHANNEL, name: CHANNEL }],
      members: [
        { deviceId: b.identity.publicKey, role: 'member', displayName: b.displayName, dhPublicKey: b.identity.dhPublicKey },
      ],
    });
    const communityId = signed.descriptor.communityId;
    installCommunityOnNode(a, signed);
    installCommunityOnNode(b, signed);

    // A authors four signed messages: three originals + one edit (supersede).
    const m1 = createChannelMessage(a.identity, { communityId, channelId: CHANNEL, body: 'welcome', hlc: { wall: '2026-06-16T00:00:01.000Z', counter: 0 } });
    const m2 = createChannelMessage(a.identity, { communityId, channelId: CHANNEL, body: 'rules', hlc: { wall: '2026-06-16T00:00:02.000Z', counter: 0 } });
    const m3 = createChannelMessage(a.identity, { communityId, channelId: CHANNEL, body: 'have fun', hlc: { wall: '2026-06-16T00:00:03.000Z', counter: 0 } });
    const m2edit = createChannelMessage(a.identity, {
      communityId, channelId: CHANNEL, body: 'rules (pinned)',
      hlc: { wall: '2026-06-16T00:00:04.000Z', counter: 0 },
      supersedes: { id: m2.id, deleted: false },
    });
    for (const event of [m1, m2, m3, m2edit]) recordChannelMessageOnNode(a, event);

    // Precondition: B holds NOTHING.
    expect(eventsFromNode(b.db, communityId, CHANNEL)).toHaveLength(0);

    // --- 1. B queues a full backfill request (null cursor), parked on A's token.
    const fields = {
      communityId, channelId: CHANNEL, sinceWall: null, sinceCounter: null,
      requestId: historyRequestId({ communityId, channelId: CHANNEL, sinceWall: null, sinceCounter: null }, b.identity.publicKey),
    };
    const request = sealHistoryRequestMailbox({
      sender: b.identity,
      recipient: { deviceId: a.identity.publicKey, dhPublicKey: a.identity.dhPublicKey },
      pairSharedSecretHex: secret,
      fields,
    });
    expect(await parkOnRelay(h, request.token, request.envelope)).toBe(true);
    await waitMs(100);

    // --- 2. A drains its mailbox -> SERVES -> parks a grant on B's token.
    const aCursors = new Map<string, Hlc>();
    const aDrain = await runMailboxDrainJob({
      identity: a.identity,
      backend: h.backend,
      relayUrl: h.url,
      peers: [drainPeer(b.identity.publicKey, secret)],
      handlers: buildBackfillHandlers({
        node: a,
        resolvePeer: makeResolvePeer(b.identity.publicKey, b.identity.dhPublicKey, secret),
        parkEnvelope: (token, env) => parkOnRelay(h, token, env),
        cursors: aCursors,
        activeMember: (cid, did) => cid === communityId
          && signed.descriptor.members.some((m) => m.deviceId === did),
      }),
      waitForDrain: () => waitMs(150),
    });
    expect(aDrain.historyRequests).toBe(1); // one request served
    expect(aDrain.historyGrants).toBe(0);
    expect(aDrain.applied).toBe(0); // A applied no channel messages
    await waitMs(100);

    // --- 3. B drains -> APPLIES the grant -> verified events merged into cm_messages.
    const bCursors = new Map<string, Hlc>();
    const bDrain = await runMailboxDrainJob({
      identity: b.identity,
      backend: h.backend,
      relayUrl: h.url,
      peers: [drainPeer(a.identity.publicKey, secret)],
      handlers: buildBackfillHandlers({
        node: b,
        resolvePeer: makeResolvePeer(a.identity.publicKey, a.identity.dhPublicKey, secret),
        parkEnvelope: (token, env) => parkOnRelay(h, token, env),
        cursors: bCursors,
        activeMember: (cid, did) => cid === communityId
          && signed.descriptor.members.some((m) => m.deviceId === did),
      }),
      waitForDrain: () => waitMs(150),
    });
    expect(bDrain.historyGrants).toBe(1); // one grant applied
    expect(bDrain.historyRequests).toBe(0);

    // --- 4. Assert on REAL rows: B now holds all four of A's events.
    const aEvents = eventsFromNode(a.db, communityId, CHANNEL);
    const bEvents = eventsFromNode(b.db, communityId, CHANNEL);
    expect(bEvents.map((e) => e.id).sort()).toEqual(aEvents.map((e) => e.id).sort());
    expect(bEvents).toHaveLength(4);

    // B's resolved feed (edit collapsed) equals A's resolved feed.
    const aResolved = resolveChannelMessages(aEvents);
    const bResolved = resolveChannelMessages(bEvents);
    expect(bResolved.map((e) => e.body)).toEqual(aResolved.map((e) => e.body));
    expect(bResolved.map((e) => e.body)).toEqual(['welcome', 'rules (pinned)', 'have fun']);

    // B's cursor advanced to the highest HLC (the edit at ...04Z).
    expect(bCursors.get(cursorKey(communityId, CHANNEL))).toEqual({ wall: '2026-06-16T00:00:04.000Z', counter: 0 });
  });

  it('a NON-member is served nothing, and a tampered grant event is dropped on apply', async () => {
    harness = await startHarness();
    const h = harness;

    const a = await buildNode('NodeA');
    const b = await buildNode('NodeB');
    const c = await buildNode('NodeC'); // an outsider, NOT in the community
    nodes.push(a, b, c);

    const secretAB = pairNodes(a, b);
    const secretAC = pairNodes(a, c);

    // Community has A + B only. C is paired with A but NOT a member.
    const signed = createCommunity(a.identity, {
      name: 'Feed Club P3 neg',
      channels: [{ id: CHANNEL, name: CHANNEL }],
      members: [
        { deviceId: b.identity.publicKey, role: 'member', displayName: b.displayName, dhPublicKey: b.identity.dhPublicKey },
      ],
    });
    const communityId = signed.descriptor.communityId;
    installCommunityOnNode(a, signed);
    installCommunityOnNode(b, signed);

    const m1 = createChannelMessage(a.identity, { communityId, channelId: CHANNEL, body: 'secret history', hlc: { wall: '2026-06-16T00:00:01.000Z', counter: 0 } });
    recordChannelMessageOnNode(a, m1);

    const activeMember = (cid: string, did: string): boolean =>
      cid === communityId && signed.descriptor.members.some((m) => m.deviceId === did);

    // --- C (non-member) requests a full backfill from A. A drains -> serves NOTHING.
    const cFields = {
      communityId, channelId: CHANNEL, sinceWall: null, sinceCounter: null,
      requestId: historyRequestId({ communityId, channelId: CHANNEL, sinceWall: null, sinceCounter: null }, c.identity.publicKey),
    };
    const cRequest = sealHistoryRequestMailbox({
      sender: c.identity,
      recipient: { deviceId: a.identity.publicKey, dhPublicKey: a.identity.dhPublicKey },
      pairSharedSecretHex: secretAC,
      fields: cFields,
    });
    expect(await parkOnRelay(h, cRequest.token, cRequest.envelope)).toBe(true);
    await waitMs(100);

    const aDrain = await runMailboxDrainJob({
      identity: a.identity,
      backend: h.backend,
      relayUrl: h.url,
      peers: [drainPeer(c.identity.publicKey, secretAC)],
      handlers: buildBackfillHandlers({
        node: a,
        resolvePeer: makeResolvePeer(c.identity.publicKey, c.identity.dhPublicKey, secretAC),
        parkEnvelope: (token, env) => parkOnRelay(h, token, env),
        cursors: new Map(),
        activeMember,
      }),
      waitForDrain: () => waitMs(150),
    });
    // The gate dropped the non-member request: it is counted rejected, NOT served.
    expect(aDrain.historyRequests).toBe(0);
    expect(aDrain.rejected).toBe(1);

    // C's drain finds NO grant parked for it (A served nothing).
    const cDrain = await runMailboxDrainJob({
      identity: c.identity,
      backend: h.backend,
      relayUrl: h.url,
      peers: [drainPeer(a.identity.publicKey, secretAC)],
      handlers: buildBackfillHandlers({
        node: c,
        resolvePeer: makeResolvePeer(a.identity.publicKey, a.identity.dhPublicKey, secretAC),
        parkEnvelope: (token, env) => parkOnRelay(h, token, env),
        cursors: new Map(),
        activeMember,
      }),
      waitForDrain: () => waitMs(150),
    });
    expect(cDrain.drained).toBe(0);
    expect(cDrain.historyGrants).toBe(0);

    // --- Tampered grant: A seals a grant to B but with a body-tampered event.
    // B re-verifies on apply -> the tampered event fails verifyChannelMessage ->
    // dropped (invalid), nothing written, no cursor advance.
    const tampered: ChannelMessageEvent = { ...m1, body: 'TAMPERED history' }; // signature no longer matches
    expect(verifyChannelMessage(tampered)).toBe(false); // sanity: it IS broken
    const grant = sealHistoryGrantMailbox({
      sender: a.identity,
      recipient: { deviceId: b.identity.publicKey, dhPublicKey: b.identity.dhPublicKey },
      pairSharedSecretHex: secretAB,
      payload: {
        kind: 'meerkat.history-grant-v1', version: 1,
        communityId, channelId: CHANNEL, requestId: 'whatever',
        events: [tampered],
      },
    });
    expect(await parkOnRelay(h, grant.token, grant.envelope)).toBe(true);
    await waitMs(100);

    const bCursors = new Map<string, Hlc>();
    const bDrain = await runMailboxDrainJob({
      identity: b.identity,
      backend: h.backend,
      relayUrl: h.url,
      peers: [drainPeer(a.identity.publicKey, secretAB)],
      handlers: buildBackfillHandlers({
        node: b,
        resolvePeer: makeResolvePeer(a.identity.publicKey, a.identity.dhPublicKey, secretAB),
        parkEnvelope: (token, env) => parkOnRelay(h, token, env),
        cursors: bCursors,
        activeMember,
      }),
      waitForDrain: () => waitMs(150),
    });
    // The tampered grant opened+verified at the envelope layer (A really signed
    // it), but the inner event failed re-verification -> nothing applied ->
    // counted rejected, NOT a history-grant.
    expect(bDrain.drained).toBe(1);
    expect(bDrain.historyGrants).toBe(0);
    expect(bDrain.rejected).toBe(1);
    expect(eventsFromNode(b.db, communityId, CHANNEL)).toHaveLength(0); // nothing written
    expect(bCursors.size).toBe(0); // cursor not advanced

    // Defense-in-depth sanity: the dispatcher itself drops the tampered grant.
    const decoded = decodeMailboxEnvelope(encodeMailboxEnvelope(grant.envelope));
    expect(decoded).not.toBeNull();
    const outcome = await applyMailboxEnvelope(
      b.identity,
      encodeMailboxEnvelope(grant.envelope),
      buildBackfillHandlers({
        node: b,
        resolvePeer: makeResolvePeer(a.identity.publicKey, a.identity.dhPublicKey, secretAB),
        parkEnvelope: () => false,
        cursors: new Map(),
        activeMember,
      }),
    );
    expect(outcome.kind).toBe('rejected');
  });
});
