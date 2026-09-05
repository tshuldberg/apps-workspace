/**
 * Plan 19 P4 acceptance: the public social layer end-to-end across REAL services,
 * with REAL bytes over real sockets -- no in-memory simulation passing as transport
 * (plan §12 / TC-8: v1 shipped zero real bytes because in-memory proofs hid dead
 * transports). Three live servers stand up on 127.0.0.1 (random ports):
 *
 *   - a LIVE relay        (startRelayServer)        -- the zero-knowledge mailbox.
 *   - a LIVE directory    (startPublicDirectoryNode) -- ws ann/lk discovery verbs.
 *   - a LIVE community     (startCommunityNodeHttp)   -- OPEN public serving routes.
 *
 * Device A and device B are two INDEPENDENT real Ed25519 identities. The bytes that
 * cross are real: A's owner-signed descriptor + non-confidential public snapshot
 * pieces are served over the community node's HTTP sockets; A's announce + B's browse
 * ride the directory node's ws sockets; B's sealed abuse report rides the relay's
 * store-and-forward mailbox. B PULLS through the SHIPPING client helper
 * (fetchPublicSnapshot), so the test exercises the real import path the apps use in
 * P5/P6, not a bespoke http loop.
 *
 * Acceptance proven here:
 *  - AC-4: a published item appears on a SECOND device, pulled + verified from a REAL
 *    serving host (the community node), NOT from A's device.
 *  - AC-6/AC-7: any reader B reports public content; owner A receives the report via
 *    the zero-knowledge mailbox over the LIVE relay; A unpublishes; the serving host
 *    404s authoritatively and the directory drops it from browse on TTL refresh.
 *  - TC-8: every step moves REAL bytes across live sockets.
 *
 * Ordering subtlety (resolved deliberately, not faked): buildPublicSnapshot's
 * infoHash is content-addressed over events + pieces + the published key (see
 * protocol/public-snapshot.ts -> buildChannelHistory); it does NOT depend on the
 * publicationId passed in. So there is NO circular dependency: build the snapshot
 * FIRST to get contentId, THEN createPublication(contentId) to derive publicationId.
 * The same publicKey bytes feed buildPublicSnapshot and (as hex) createPublication;
 * B re-derives the key from descriptor.publicKeyHex.
 *
 * Honest finding (flagged, not faked): a PUBLIC reader can derive the owner's report
 * mailbox token from public descriptor data (publicKeyHex + ownerDeviceId), but the
 * P0 PublicationDescriptor does NOT carry the owner's X25519 dhPublicKey, so sealing
 * a report to the owner needs the owner's published identity bundle / DH key out of
 * band. The transport + crypto round-trip below are fully real; only the reporter's
 * knowledge of the owner DH key stands in for that missing descriptor field.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import {
  WebSocketRelayBackend,
  buildPublicSnapshot,
  bytesToHex,
  createAbuseReport,
  createChannelMessage,
  createPublication,
  decodeMailboxEnvelope,
  deriveMailboxToken,
  encodeMailboxEnvelope,
  fetchPublicSnapshot,
  generateDeviceIdentity,
  openAbuseReport,
  publicSnapshotKeyFromHex,
  announceHeldContent,
  announcePublication,
  browsePublications,
  unpublish,
  type AbuseReport,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type MailboxEnvelope,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import { startRelayServer, type RelayServer } from '../server';
import {
  CommunityNode,
  PublicDirectoryNode,
  startCommunityNodeHttp,
  startPublicDirectoryNode,
  type PublicDirectoryNodeServer,
} from '../index';
import type { SeederHttpServer } from '../seeder-http';

// The sync directory/registry client uses the platform global WebSocket; inject ws.
const WS = WebSocket as unknown as new (url: string) => unknown;
const CHANNEL = 'general';
const COMMUNITY = 'cm_public_social';
const CATEGORY = 'technology' as const;
const DAY_MS = 24 * 60 * 60 * 1000;

// A node-native fetch over real http sockets, injected into the RN-safe client so
// the e2e drives the SAME helper the apps ship, against a real serving host.
const nodeFetch: typeof fetch = globalThis.fetch.bind(globalThis);

// ---------------------------------------------------------------------------
// Live-service teardown
// ---------------------------------------------------------------------------

let relay: RelayServer | null = null;
let backend: WebSocketRelayBackend | null = null;
let directory: PublicDirectoryNodeServer | null = null;
let community: SeederHttpServer | null = null;

afterEach(async () => {
  backend?.destroy();
  backend = null;
  if (community) { await community.close(); community = null; }
  if (directory) { await directory.close(); directory = null; }
  if (relay) { await relay.close(); relay = null; }
});

// ---------------------------------------------------------------------------
// Publish fixture: a real owner-signed publication over a real public snapshot.
// ---------------------------------------------------------------------------

interface PublishFixture {
  owner: DeviceIdentity;
  publicKey: Uint8Array;
  signed: SignedPublicationDescriptor;
  publicationId: string;
  contentId: string;
  manifest: ContentManifest;
  pieces: Uint8Array[];
  authored: ChannelMessageEvent[];
}

function authorEvent(author: DeviceIdentity, body: string, wall: string): ChannelMessageEvent {
  return createChannelMessage(author, { communityId: COMMUNITY, channelId: CHANNEL, body, hlc: { wall, counter: 0 } });
}

async function buildPublishFixture(owner: DeviceIdentity, hostUrls: string[]): Promise<PublishFixture> {
  const publicKey = new Uint8Array(randomBytes(32));
  const authored = [
    authorEvent(owner, 'welcome to the public channel', '2026-06-28T00:00:10.000Z'),
    authorEvent(owner, 'second public post', '2026-06-28T00:00:11.000Z'),
    authorEvent(owner, 'third public post', '2026-06-28T00:00:12.000Z'),
  ];

  // 1) Build the snapshot FIRST: infoHash is content-addressed, NOT publicationId-derived.
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({
    identity: owner,
    publicationId: 'pending',
    communityId: COMMUNITY,
    channelId: CHANNEL,
    events: authored,
    publicKey,
    pieceStore: buildStore,
    now: '2026-06-28T00:00:00.000Z',
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(record.infoHash, i) as Uint8Array);

  // 2) THEN sign the descriptor over the real contentId; publicationId derives from it.
  const signed = createPublication(owner, {
    kind: 'channel',
    communityId: COMMUNITY,
    channelId: CHANNEL,
    title: 'Public Rust Channel',
    description: 'A public, anyone-can-read rust programming channel.',
    category: CATEGORY,
    contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey),
    hostUrls,
    now: '2026-06-28T00:00:00.000Z',
  });

  return {
    owner, publicKey, signed,
    publicationId: signed.descriptor.publicationId,
    contentId: record.infoHash,
    manifest, pieces, authored,
  };
}

interface RawResponse { status: number; text: string }

function rawRequest(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers ?? {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 500, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

/** Owner-signed register over the community node's POST route (pieces -> base64 in JSON). */
async function ownerRegister(
  baseUrl: string,
  fx: PublishFixture,
  signed: SignedPublicationDescriptor = fx.signed,
): Promise<RawResponse> {
  return rawRequest(`${baseUrl}/public/${fx.publicationId}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      descriptor: signed,
      snapshots: [{ channelId: CHANNEL, epoch: 0, manifest: fx.manifest, pieces: fx.pieces.map((p) => Buffer.from(p).toString('base64')) }],
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plan 19 P4: cross-client public social over a LIVE relay + directory + serving host', () => {
  it('AC-4: device B discovers A\'s publication in the directory and pulls + verifies it from a REAL serving host', async () => {
    relay = await startRelayServer({ port: 0, host: '127.0.0.1', limits: { mailboxTtlMs: DAY_MS, mailboxMax: 256 } });
    const dirNode = new PublicDirectoryNode({});
    directory = await startPublicDirectoryNode({ node: dirNode, host: '127.0.0.1' });
    const commNode = new CommunityNode({});
    community = await startCommunityNodeHttp({ node: commNode, host: '127.0.0.1' });

    const deviceA = generateDeviceIdentity('DeviceA');
    const deviceB = generateDeviceIdentity('DeviceB');
    const fx = await buildPublishFixture(deviceA, [community.url]);

    // A publishes: register the owner-signed descriptor + snapshot on the serving host,
    // announce it to the directory, and announce the community node as a serving host.
    expect((await ownerRegister(community.url, fx)).status).toBe(200);
    await announcePublication({ url: directory.url, signed: fx.signed, webSocketImpl: WS as never });
    await announceHeldContent({ url: directory.url, contentId: fx.contentId, hostUrl: community.url, webSocketImpl: WS as never });

    // B (a different device) browses the directory and discovers the verified entry.
    const browsed = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    const entry = browsed.find((e) => e.descriptor.publicationId === fx.publicationId);
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(entry.verified).toBe(true);
    expect(entry.descriptor.ownerDeviceId).toBe(deviceA.publicKey);
    expect(entry.announcingHosts).toBeGreaterThanOrEqual(1); // a REAL serving host announced

    // B PULLS the snapshot from the serving host through the SHIPPING client helper,
    // binding the owner-signed identity + content id discovered from the directory.
    const pulled = await fetchPublicSnapshot({
      baseUrl: entry.descriptor.hostUrls[0]!, // a REAL serving host, not B's own device
      publicationId: entry.descriptor.publicationId,
      publicKey: publicSnapshotKeyFromHex(entry.descriptor.publicKeyHex),
      expectedContentId: entry.descriptor.contentId,
      expectedAuthor: entry.descriptor.ownerDeviceId,
      channelId: CHANNEL,
      fetchFn: nodeFetch,
    });
    expect(pulled.ok).toBe(true);
    if (!pulled.ok) return;

    // B's imported events EQUAL A's authored events, pulled over real sockets + verified.
    expect(pulled.events.map((e) => e.body)).toEqual(fx.authored.map((e) => e.body));
    expect(pulled.events.map((e) => e.id)).toEqual(fx.authored.map((e) => e.id));
    expect(pulled.events.every((e) => e.authorDeviceId === deviceA.publicKey)).toBe(true);
    // The host served A's content; B is a distinct device (no shared in-memory store).
    expect(deviceB.publicKey).not.toBe(deviceA.publicKey);

    // Fail-closed: a wrong expectedAuthor (substitution attempt) rejects the pull at
    // the descriptor cross-check, BEFORE any piece bytes are fetched -- the helper
    // refuses to pull a publication whose served owner is not the one B discovered.
    const forgedAuthor = await fetchPublicSnapshot({
      baseUrl: community.url,
      publicationId: fx.publicationId,
      publicKey: fx.publicKey,
      expectedContentId: fx.contentId,
      expectedAuthor: deviceB.publicKey, // not the signer
      channelId: CHANNEL,
      fetchFn: nodeFetch,
    });
    expect(forgedAuthor.ok).toBe(false);
    if (!forgedAuthor.ok) expect(forgedAuthor.reason).toBe('descriptor_mismatch');

    // Fail-closed at the IMPORT crypto gate too: when the served descriptor matches
    // the binding but the publicKey is wrong, the seal/parse fails closed (a wrong key
    // cannot decrypt + verify the snapshot), so no events surface.
    const wrongKey = await fetchPublicSnapshot({
      baseUrl: community.url,
      publicationId: fx.publicationId,
      publicKey: new Uint8Array(randomBytes(32)), // not the published key
      expectedContentId: fx.contentId,
      expectedAuthor: deviceA.publicKey,
      channelId: CHANNEL,
      fetchFn: nodeFetch,
    });
    expect(wrongKey.ok).toBe(false);
  });

  it('AC-6/AC-7: B reports over the LIVE relay mailbox; A receives + unpublishes; serving 404 + browse drops it', async () => {
    relay = await startRelayServer({ port: 0, host: '127.0.0.1', limits: { mailboxTtlMs: DAY_MS, mailboxMax: 256 } });
    backend = new WebSocketRelayBackend();
    const relayUrl = `ws://127.0.0.1:${relay.port}`;

    // The directory runs on an injected clock so the publication's announce TTL can be
    // advanced deterministically (owner-unpublish has no directory removal verb; the
    // directory reflects it via TTL expiry once the owner stops re-announcing, or via a
    // signed DescriptorKill -- see the honest finding below).
    let dirClock = Date.parse('2026-06-28T01:00:00.000Z');
    const dirNode = new PublicDirectoryNode({ now: () => dirClock });
    directory = await startPublicDirectoryNode({ node: dirNode, host: '127.0.0.1' });
    const commNode = new CommunityNode({});
    community = await startCommunityNodeHttp({ node: commNode, host: '127.0.0.1' });

    const deviceA = generateDeviceIdentity('DeviceA');
    const deviceB = generateDeviceIdentity('DeviceB');
    const fx = await buildPublishFixture(deviceA, [community.url]);
    const ANNOUNCE_TTL_MS = 2000;

    expect((await ownerRegister(community.url, fx)).status).toBe(200);
    await announcePublication({ url: directory.url, signed: fx.signed, ttlMs: ANNOUNCE_TTL_MS, webSocketImpl: WS as never });

    // B discovers it.
    const before = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(before.some((e) => e.descriptor.publicationId === fx.publicationId)).toBe(true);

    // --- AC-6: B (any reader) files an abuse report to A's zero-knowledge mailbox. ---
    const d = fx.signed.descriptor;
    // The report mailbox token is derived from PUBLIC descriptor data, so any reader
    // can address the owner's mailbox without prior pairing. The relay sees only a
    // 64-hex token + a ciphertext size.
    const reportToken = deriveMailboxToken(d.publicKeyHex, d.ownerDeviceId, Date.now());
    // HONEST FINDING: the descriptor does not expose the owner's X25519 dhPublicKey, so
    // a real public reader needs the owner's published identity bundle to seal here.
    // The transport + crypto are real; only the DH key source is stubbed by the owner id.
    const report = createAbuseReport(
      deviceB,
      { deviceId: d.ownerDeviceId, dhPublicKey: deviceA.dhPublicKey },
      { reason: 'spam', context: 'this public channel is posting spam', communityId: COMMUNITY, contentId: fx.contentId },
    );

    // Park the sealed report over the LIVE relay mailbox; B disconnects (A is offline).
    const reporter = await backend.connect(relayUrl, reportToken);
    await reporter.send(encodeMailboxEnvelope(report));
    await new Promise((r) => setTimeout(r, 120));
    await reporter.close();
    expect(relay.hub.stats().mailboxedEnvelopes).toBe(1); // store-and-forward proof

    // A wakes, joins its pair-private mailbox token, and drains the sealed envelope.
    const received: Uint8Array[] = [];
    const ownerDrain = await backend.connect(relayUrl, reportToken);
    ownerDrain.onMessage((bytes) => received.push(bytes));
    await new Promise((r) => setTimeout(r, 200));
    await ownerDrain.close();
    expect(received).toHaveLength(1);

    const envelope = decodeMailboxEnvelope(received[0]!) as MailboxEnvelope;
    expect(envelope).not.toBeNull();
    const opened = openAbuseReport(deviceA, envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const payload = opened.payload as AbuseReport;
    expect(opened.senderDeviceId).toBe(deviceB.publicKey); // owner sees WHO reported
    expect(payload.reason).toBe('spam');
    expect(payload.contentId).toBe(fx.contentId);
    expect(payload.context).toBe('this public channel is posting spam');

    // --- AC-7: A unpublishes; the serving host stops serving authoritatively. ---
    const pulledSigned = unpublish(deviceA, fx.signed, '2026-06-28T01:01:00.000Z');
    expect((await ownerRegister(community.url, fx, pulledSigned)).status).toBe(200);

    // The serving host 404s every public route immediately (the authoritative removal).
    expect((await rawRequest(`${community.url}/public/${fx.publicationId}/manifest`)).status).toBe(404);
    expect((await rawRequest(`${community.url}/public/${fx.publicationId}/${fx.contentId}/0`)).status).toBe(404);
    const afterUnpublish = await fetchPublicSnapshot({
      baseUrl: community.url,
      publicationId: fx.publicationId,
      publicKey: fx.publicKey,
      expectedContentId: fx.contentId,
      expectedAuthor: deviceA.publicKey,
      channelId: CHANNEL,
      fetchFn: nodeFetch,
    });
    expect(afterUnpublish.ok).toBe(false);
    if (!afterUnpublish.ok) expect(afterUnpublish.reason).toBe('not_found');

    // HONEST BEHAVIOR: the directory still shows the stale active record right after
    // unpublish -- owner-unpublish does NOT actively propagate a takedown to the
    // directory (no owner removal verb exists). The directory drops it on TTL expiry
    // once the owner stops re-announcing (or on a signed DescriptorKill).
    const stale = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(stale.some((e) => e.descriptor.publicationId === fx.publicationId)).toBe(true);

    // One refresh past the announce TTL (owner stopped re-announcing): browse drops it.
    dirClock += ANNOUNCE_TTL_MS + 1000;
    const after = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(after.some((e) => e.descriptor.publicationId === fx.publicationId)).toBe(false);
  });
});
