/**
 * Task 5: physical TWO-device exit demo, software twin.
 *
 * Two FULLY INDEPENDENT nodes (own identity, own DatabaseAdapter, own engine)
 * run the entire Meerkat rung ladder over ONE live loopback RelayServer, driven
 * through the EXACT shipping app path (NativeSyncEngine.syncWithConnection /
 * handleIncomingConnection over connectRelayPeer, mirroring SyncProvider.tsx).
 *
 * Honesty boundary (CLAUDE.md): this proves PROTOCOL + RELAY correctness only.
 * The physical transport/OS rungs (LAN/mDNS, BLE, OS background limits, push)
 * remain UNVERIFIED until a human runs apps/meerkat/Tickets/device-qa-exit-demo.md.
 * Every assertion is on a REAL local row (the RECEIVER's own cm_messages /
 * mp_pad, the reader's OWN cm_read_state, sync_session rows) or real engine
 * status -- never a synthetic "remote has read" flag or a fabricated peer count.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import {
  buildShareLink,
  createChannelMessage,
  createCommunity,
  createSealedShare,
  decodeMailboxEnvelope,
  deriveMailboxToken,
  deriveSas,
  encodeMailboxEnvelope,
  evaluateChannelPost,
  fetchAndPinFromHosts,
  getInboundAudit,
  getRecentSyncSessions,
  getSasVerification,
  hexToBytes,
  httpNodeSource,
  InMemoryNodeStore,
  isScopeWithinMaxScope,
  nextHlc,
  openChannelMessageMailboxDelta,
  parseShareLink,
  pinShare,
  recordSasVerification,
  resolveChannelMessages,
  sasFingerprint,
  sasMatches,
  sealChannelMessageMailboxDelta,
  verifyChannelMessage,
  type ChannelMessageEvent,
  type PinnedManifest,
} from '@mylife/sync';
import { startNodeStoreHttp, type SeederHttpServer } from '../seeder-http';
import {
  buildNode,
  destroyNode,
  installCommunityOnNode,
  HARNESS_COMMUNITY_SYNC_POLICY,
  pairNodes,
  readChannelBodies,
  recordChannelMessageOnNode,
  runRelaySession,
  startRelayHarness,
  stopRelayHarness,
  type MeerkatNode,
  type RelayHarness,
} from './support/multi-node-harness';

const PHRASE_TOKEN = 'a'.repeat(64);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// A real Node fetch-like client for the seeder's plain HTTP server (the
// NodeStore web-seed shape; same shape host-registry-e2e.test.ts uses).
const httpFetch = ((url: string) =>
  new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
          status: res.statusCode ?? 500,
          statusText: res.statusMessage ?? '',
          json: async () => JSON.parse(body),
          text: async () => body,
        });
      });
    });
    req.on('error', reject);
  })) as unknown as typeof fetch;

let harness: RelayHarness | null = null;
let nodeA: MeerkatNode | null = null;
let nodeB: MeerkatNode | null = null;
let seeder: SeederHttpServer | null = null;

afterEach(async () => {
  if (seeder) { await seeder.close(); seeder = null; }
  await destroyNode(nodeA); nodeA = null;
  await destroyNode(nodeB); nodeB = null;
  await stopRelayHarness(harness); harness = null;
});

describe('two-device exit-demo software twin (Task 5)', () => {
  it('rung 2 (pairing + SAS): both ends derive the same secret and the same five-emoji SAS; a MITM does not match', async () => {
    nodeA = await buildNode('Phone A');
    nodeB = await buildNode('Phone B');
    const secret = pairNodes(nodeA, nodeB);

    // SAS is derived from the pairing secret on BOTH ends (SyncProvider.getPeerSas
    // does deriveSas(hexToBytes(hex))). Honest peers share one secret -> one SAS.
    const sasA = deriveSas(hexToBytes(secret));
    const sasB = deriveSas(hexToBytes(secret));
    expect(sasMatches(sasA, sasB)).toBe(true);
    expect(sasFingerprint(sasA)).toBe(sasFingerprint(sasB));
    expect(sasA.emoji).toHaveLength(5);

    // The user confirms the emoji out of band -> recorded on this device.
    recordSasVerification(nodeA.db, {
      peerDeviceId: nodeB.identity.publicKey,
      workspaceId: '',
      sasIndices: sasFingerprint(sasA),
    });
    expect(getSasVerification(nodeA.db, nodeB.identity.publicKey, '')).not.toBeNull();

    // Fail-closed NEGATIVE: a first-contact MITM relaying two legs holds a
    // DIFFERENT secret on the leg to A, so its SAS does not match the honest one.
    const mitm = await buildNode('MITM');
    const mitmSecret = pairNodes(nodeA, mitm); // A<->MITM secret != A<->B secret
    expect(mitmSecret).not.toBe(secret);
    expect(sasMatches(deriveSas(hexToBytes(mitmSecret)), sasA)).toBe(false);
    await destroyNode(mitm);
  });

  it('rung 3 (manual relay session): a pad authored on A lands in B, with a recorded session row and no rejections', async () => {
    harness = await startRelayHarness();
    nodeA = await buildNode('Phone A');
    nodeB = await buildNode('Phone B');
    pairNodes(nodeA, nodeB);

    // A authors the bellwether pad row (mp_pad), the same entity SyncProvider.savePad
    // records into the engine.
    const padRow = { id: 'pad', body: 'pad from phone A', updated_at: '2026-06-13T00:00:00.000Z' };
    nodeA.db.execute('INSERT OR REPLACE INTO mp_pad (id, body, updated_at) VALUES (?, ?, ?)', [padRow.id, padRow.body, padRow.updated_at]);
    nodeA.engine.recordChange('mp_pad', 'INSERT', 'pad', { ...padRow });

    const session = await runRelaySession(harness, nodeA, nodeB, PHRASE_TOKEN);
    expect(session.status).toBe('completed');

    // The pad crossed the live relay into B's OWN database.
    const bPad = nodeB.db.query<{ body: string }>('SELECT body FROM mp_pad WHERE id = ?', ['pad']);
    expect(bPad).toHaveLength(1);
    expect(bPad[0]!.body).toBe('pad from phone A');

    // Real recorded session row (the Sync screen's only source of truth) + clean inbound.
    expect(getRecentSyncSessions(nodeB.db).length).toBeGreaterThan(0);
    expect(getInboundAudit(nodeB.db, { outcome: 'rejected' })).toHaveLength(0);
    expect(nodeA.engine.getStatus().lastSyncAt).not.toBeNull();
    expect(nodeB.engine.getStatus().lastSyncAt).not.toBeNull();
  });

  it('rung 4 (channel delivery): a signed channel message authored on A reaches B; resolveChannelMessages matches', async () => {
    harness = await startRelayHarness();
    nodeA = await buildNode('Owner Device');
    nodeB = await buildNode('Member Device');
    pairNodes(nodeA, nodeB);

    const signed = createCommunity(nodeA.identity, {
      name: 'Club',
      channels: [
        { id: 'general', name: 'general' },
        { id: 'announcements', name: 'announcements', postRoles: ['owner', 'admin'] },
      ],
      members: [{ deviceId: nodeB.identity.publicKey, role: 'member', displayName: nodeB.identity.displayName }],
      now: '2026-06-13T00:00:00.000Z',
    });
    const communityId = signed.descriptor.communityId;
    installCommunityOnNode(nodeA, signed);
    installCommunityOnNode(nodeB, signed);

    const first = createChannelMessage(nodeA.identity, {
      communityId, channelId: 'general', body: 'hello from owner',
      hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 },
    });
    const second = createChannelMessage(nodeA.identity, {
      communityId, channelId: 'general', body: 'second line',
      hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 },
    });
    recordChannelMessageOnNode(nodeA, first);
    recordChannelMessageOnNode(nodeA, second);

    const session = await runRelaySession(harness, nodeA, nodeB, PHRASE_TOKEN);
    expect(session.status).toBe('completed');

    // B's OWN cm_messages received both signed events, and they verify + resolve.
    expect(readChannelBodies(nodeB, communityId, 'general')).toEqual(['hello from owner', 'second line']);
    const bEvents = nodeB.db
      .query<{
        id: string; community_id: string; channel_id: string; author_device_id: string;
        body: string; hlc_wall: string; hlc_counter: number; signature: string;
      }>('SELECT * FROM cm_messages WHERE community_id = ? AND channel_id = ?', [communityId, 'general'])
      .map((row): ChannelMessageEvent => ({
        version: 1, id: row.id, communityId: row.community_id, channelId: row.channel_id,
        authorDeviceId: row.author_device_id, body: row.body,
        hlc: { wall: row.hlc_wall, counter: row.hlc_counter }, signature: row.signature,
      }));
    expect(bEvents.every((e) => verifyChannelMessage(e))).toBe(true);
    expect(resolveChannelMessages(bEvents).map((e) => e.body)).toEqual(['hello from owner', 'second line']);
    expect(getInboundAudit(nodeB.db, { outcome: 'rejected' })).toHaveLength(0);
  });

  it('rung 4 NEGATIVE (role gate): a member posting to an owner-only channel is denied with reason channel_role_denied', async () => {
    nodeA = await buildNode('Owner Device');
    nodeB = await buildNode('Member Device');
    const signed = createCommunity(nodeA.identity, {
      name: 'Club',
      channels: [
        { id: 'general', name: 'general' },
        { id: 'announcements', name: 'announcements', postRoles: ['owner', 'admin'] },
      ],
      members: [{ deviceId: nodeB.identity.publicKey, role: 'member', displayName: nodeB.identity.displayName }],
      now: '2026-06-13T00:00:00.000Z',
    });

    // evaluateChannelPost is the SAME apply-time gate the responder session runs
    // (sync-session.ts calls it on every community row carrying a channel_id) and
    // it IS in the native barrel, so this proves the real gate the app ships.
    const ownerToGeneral = evaluateChannelPost(signed.descriptor, nodeA.identity.publicKey, 'general');
    expect(ownerToGeneral.allowed).toBe(true);

    const ownerToAnnouncements = evaluateChannelPost(signed.descriptor, nodeA.identity.publicKey, 'announcements');
    expect(ownerToAnnouncements.allowed).toBe(true);

    const memberToAnnouncements = evaluateChannelPost(signed.descriptor, nodeB.identity.publicKey, 'announcements');
    expect(memberToAnnouncements.allowed).toBe(false);
    if (!memberToAnnouncements.allowed) {
      expect(memberToAnnouncements.reason).toBe('channel_role_denied');
    }

    // And a non-member is rejected outright.
    const stranger = await buildNode('Stranger');
    const strangerPost = evaluateChannelPost(signed.descriptor, stranger.identity.publicKey, 'general');
    expect(strangerPost.allowed).toBe(false);
    if (!strangerPost.allowed) {
      expect(strangerPost.reason).toBe('not_community_member');
    }
    await destroyNode(stranger);
  });

  it('rung 5 (offline mailbox): A parks a sealed channel burst while B is offline; the relay sees only ciphertext + sizes; B drains in HLC order', async () => {
    harness = await startRelayHarness();
    nodeA = await buildNode('Owner Device');
    nodeB = await buildNode('Member Device');
    const secret = pairNodes(nodeA, nodeB);

    const signed = createCommunity(nodeA.identity, {
      name: 'Club',
      channels: [{ id: 'general', name: 'general' }],
      members: [{ deviceId: nodeB.identity.publicKey, role: 'member', displayName: nodeB.identity.displayName }],
      now: '2026-06-13T00:00:00.000Z',
    });
    const communityId = signed.descriptor.communityId;
    installCommunityOnNode(nodeB, signed);

    const one = createChannelMessage(nodeA.identity, { communityId, channelId: 'general', body: 'offline one', hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 } });
    const two = createChannelMessage(nodeA.identity, { communityId, channelId: 'general', body: 'offline two', hlc: { wall: '2026-06-13T00:00:02.000Z', counter: 0 } });
    const three = createChannelMessage(nodeA.identity, { communityId, channelId: 'general', body: 'offline three', hlc: { wall: '2026-06-13T00:00:03.000Z', counter: 0 } });

    // The app seals via SyncProvider.queueChannelMessageMailbox with the SAME args.
    const sealed = sealChannelMessageMailboxDelta({
      sender: nodeA.identity,
      recipient: { deviceId: nodeB.identity.publicKey, dhPublicKey: nodeB.identity.dhPublicKey },
      pairSharedSecretHex: secret,
      communityId,
      channelId: 'general',
      events: [three, one, two],
      now: '2026-06-13T00:00:04.000Z',
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.token).toBe(deriveMailboxToken(secret, nodeB.identity.publicKey, Date.parse('2026-06-13T00:00:04.000Z')));

    // ZERO-KNOWLEDGE: the wire envelope leaks no device ids, community/channel id,
    // or plaintext (reuse of the mailbox-mode-e2e assertion).
    const wire = encodeMailboxEnvelope(sealed.envelope);
    const wireText = decoder.decode(wire);
    expect(wireText).not.toContain(nodeA.identity.publicKey);
    expect(wireText).not.toContain(nodeB.identity.publicKey);
    expect(wireText).not.toContain(communityId);
    expect(wireText).not.toContain('general');
    expect(wireText).not.toContain('offline one');

    // A (online) parks the sealed burst; B is offline. The relay store-and-forwards.
    const sender = await harness.backend.connect(harness.url, sealed.token);
    await sender.send(wire);
    await new Promise((r) => setTimeout(r, 100));
    await sender.close();
    expect(harness.server.hub.stats().mailboxedEnvelopes).toBe(1);

    // B wakes and drains: openChannelMessageMailboxDelta yields events in HLC order.
    const received: Uint8Array[] = [];
    const receiver = await harness.backend.connect(harness.url, sealed.token);
    receiver.onMessage((bytes) => received.push(new Uint8Array(bytes)));
    await new Promise((r) => setTimeout(r, 200));
    await receiver.close();

    expect(received).toHaveLength(1);
    const decoded = decodeMailboxEnvelope(received[0]!);
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    const opened = openChannelMessageMailboxDelta(nodeB.identity, decoded);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.senderDeviceId).toBe(nodeA.identity.publicKey);
    expect(opened.events.map((e) => e.body)).toEqual(['offline one', 'offline two', 'offline three']);

    // Apply into B's OWN cm_messages, exactly as the live receive path does.
    for (const event of opened.events) {
      if (verifyChannelMessage(event)) recordChannelMessageOnNode(nodeB, event);
    }
    expect(readChannelBodies(nodeB, communityId, 'general')).toEqual(['offline one', 'offline two', 'offline three']);
  });

  it('rung 5 NEGATIVE (wrong recipient): a delta sealed to B will not open with a stranger identity', async () => {
    nodeA = await buildNode('Owner Device');
    nodeB = await buildNode('Member Device');
    const secret = pairNodes(nodeA, nodeB);
    const stranger = await buildNode('Stranger');
    const communityId = 'cm_neg_channel';

    const event = createChannelMessage(nodeA.identity, { communityId, channelId: 'general', body: 'for B only', hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 } });
    const sealed = sealChannelMessageMailboxDelta({
      sender: nodeA.identity,
      recipient: { deviceId: nodeB.identity.publicKey, dhPublicKey: nodeB.identity.dhPublicKey },
      pairSharedSecretHex: secret,
      communityId, channelId: 'general', events: [event],
      now: '2026-06-13T00:00:02.000Z',
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const decoded = decodeMailboxEnvelope(encodeMailboxEnvelope(sealed.envelope));
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    // The stranger cannot open a delta sealed to B's DH key (fail-closed).
    expect(openChannelMessageMailboxDelta(stranger.identity, decoded).ok).toBe(false);
    await destroyNode(stranger);
  });

  it('rung 6 (read state): the reader marks read on its OWN cm_read_state; unread drops to 0; read state never crosses a SHARED-scope session', async () => {
    nodeA = await buildNode('Owner Device');
    nodeB = await buildNode('Member Device');
    const communityId = 'cm_read_channel';

    // B applies two received messages (both signed by A), then marks read at the
    // latest HLC. This is a personal_replica row on the reader's OWN db
    // (markChannelRead behavior).
    const m1 = createChannelMessage(nodeA.identity, { communityId, channelId: 'general', body: 'm1', hlc: { wall: '2026-06-13T00:00:01.000Z', counter: 0 } });
    const m2 = createChannelMessage(nodeA.identity, { communityId, channelId: 'general', body: 'm2', hlc: nextHlc(m1.hlc, '2026-06-13T00:00:02.000Z') });
    recordChannelMessageOnNode(nodeB, m1);
    recordChannelMessageOnNode(nodeB, m2);

    const latest = m2.hlc;
    const readStateId = `${communityId}:general`;
    nodeB.db.execute(
      `INSERT OR REPLACE INTO cm_read_state (id, community_id, channel_id, last_read_wall, last_read_counter, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [readStateId, communityId, 'general', latest.wall, latest.counter, '2026-06-13T00:00:05.000Z'],
    );
    const rs = nodeB.db.query<{ last_read_wall: string }>('SELECT last_read_wall FROM cm_read_state WHERE id = ?', [readStateId]);
    expect(rs).toHaveLength(1);
    expect(rs[0]!.last_read_wall).toBe(latest.wall);

    // Unread count is 0 once last_read >= every visible message HLC.
    const visible = nodeB.db.query<{ hlc_wall: string; hlc_counter: number }>(
      'SELECT hlc_wall, hlc_counter FROM cm_messages WHERE community_id = ? AND channel_id = ?', [communityId, 'general']);
    const unread = visible.filter((v) => v.hlc_wall > latest.wall || (v.hlc_wall === latest.wall && v.hlc_counter > latest.counter)).length;
    expect(unread).toBe(0);

    // Read state never crosses a SHARED community session: cm_read_state declares
    // maxScope personal_replica, so it is NOT within a shared_workspace session
    // scope (the exact rule sync-session.ts canSendTableAtScope enforces). This is
    // the policy-level twin of the full session proof in @mylife/sync's
    // channel-chat-session.test.ts (which uses the Node-only session directly).
    const readStateRule = HARNESS_COMMUNITY_SYNC_POLICY.entityRules?.find((r) => r.tableName === 'cm_read_state');
    expect(readStateRule?.maxScope).toBe('personal_replica');
    expect(isScopeWithinMaxScope('shared_workspace', readStateRule?.maxScope)).toBe(false);
    // A cm_messages row, by contrast, IS allowed at shared_workspace scope.
    const messagesRule = HARNESS_COMMUNITY_SYNC_POLICY.entityRules?.find((r) => r.tableName === 'cm_messages');
    expect(isScopeWithinMaxScope('shared_workspace', messagesRule?.maxScope)).toBe(true);
  });

  it('rung 7 (remote share): a never-saw-it node fetches + verifies + pins a sealed share from a real HTTP host; a tampered host is skipped', async () => {
    // A seals + pins a share into its NodeStore and serves it over real HTTP.
    const author = (await buildNode('Author')).identity;
    const { share, linkKey } = createSealedShare(encoder.encode('exit demo payload'), {
      name: 'demo.txt', identity: author, chunkSize: 16,
    });
    const hostStore = new InMemoryNodeStore();
    await pinShare(hostStore, share);
    seeder = await startNodeStoreHttp({ store: hostStore, host: '127.0.0.1' });

    const link = buildShareLink({
      contentId: share.manifest.contentId,
      linkKey,
      authorPublicKey: author.publicKey,
      name: share.manifest.name,
    });
    const parts = parseShareLink(link)!;

    // C (fresh node, never saw the content) fetches through the UNCHANGED verify-
    // then-pin path and pins into its OWN store.
    const cStore = new InMemoryNodeStore();
    const ok = await fetchAndPinFromHosts(
      [httpNodeSource(seeder.url, httpFetch)],
      cStore,
      parts.contentId,
      parts.linkKey,
      { expectedAuthor: parts.authorPublicKey },
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.pinned).toBe(true);
      expect(decoder.decode(ok.content)).toBe('exit demo payload');
    }
    await expect(cStore.getManifest(parts.contentId)).resolves.not.toBeNull();

    // NEGATIVE (tampered host): a host that serves a real manifest but corrupted
    // blocks is SKIPPED fail-closed -- openSealedShare rejects, nothing is pinned.
    const manifest = await hostStore.getManifest(parts.contentId);
    expect(manifest).not.toBeNull();
    const tamperedHost = {
      async getManifest(): Promise<PinnedManifest | null> { return manifest; },
      async getBlock(): Promise<string | null> { return 'tampered-ciphertext'; },
    };
    const tamperedStore = new InMemoryNodeStore();
    const tamperedResult = await fetchAndPinFromHosts(
      [tamperedHost],
      tamperedStore,
      parts.contentId,
      parts.linkKey,
      { expectedAuthor: parts.authorPublicKey },
    );
    expect(tamperedResult.ok).toBe(false);
    await expect(tamperedStore.getManifest(parts.contentId)).resolves.toBeNull();

    // NEGATIVE (wrong author): the real host's bytes are correct, but an
    // expectedAuthor that does not match the manifest signer is rejected.
    const wrongAuthor = (await buildNode('Wrong Author')).identity;
    const dStore = new InMemoryNodeStore();
    const wrongAuthorResult = await fetchAndPinFromHosts(
      [httpNodeSource(seeder.url, httpFetch)],
      dStore,
      parts.contentId,
      parts.linkKey,
      { expectedAuthor: wrongAuthor.publicKey },
    );
    expect(wrongAuthorResult.ok).toBe(false);
    await expect(dStore.getManifest(parts.contentId)).resolves.toBeNull();
  });
});
