/**
 * Plan 19 P3a acceptance: the always-on COMMUNITY NODE serves a PUBLIC publication
 * over OPEN (no per-member auth) HTTP read routes, while owner publish/register
 * stays owner-signed, the existing private routes stay gated, and a real per-IP
 * limiter caps the new open surface.
 *
 * Everything is real: real Ed25519 identities, a real owner-signed
 * SignedPublicationDescriptor (verifyPublication), a real non-confidential
 * author-signed public snapshot (buildPublicSnapshot), a real node:http server
 * (startCommunityNodeHttp), and the real public reader path (importPublicSnapshot)
 * that fetches the opaque pieces over the OPEN route and verifies them fail-closed.
 *
 * Acceptance proven here:
 *  1. Owner registers a publication; ANONYMOUS GET /public/{id}/manifest returns it
 *     (no auth headers) with the signed descriptor + status active.
 *  2. ANONYMOUS GET /public/{id}/{contentId}/{index} serves the public snapshot
 *     pieces; importPublicSnapshot (expectedAuthor + expectedContentId) round-trips
 *     them to the exact authored events.
 *  3. NC-2: a public read for publication P whose infoHash is a PRIVATE community
 *     snapshot (or any infoHash != P.contentId) returns 404 -- a private piece is
 *     NEVER reachable via the public route.
 *  4. unpublish() -> all public routes 404; a killed publication (verified
 *     DescriptorKill from the trusted authority) -> 404.
 *  5. The page route returns events strictly AFTER the cursor in ascending HLC
 *     order with correct nextCursor/hasMore; `after` omitted = genesis; `limit`
 *     clamps.
 *  6. Per-IP limiter: hammering one IP past the cap yields 429; a different XFF is
 *     unaffected; the key is the FIRST X-Forwarded-For hop (matches the relay).
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  buildPublicSnapshot,
  bytesToHex,
  createChannelMessage,
  createDescriptorKill,
  createPublication,
  generateDeviceIdentity,
  importPublicSnapshot,
  revisePublication,
  unpublish,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { CommunityNode, InMemorySeederPieceStore } from '../index';
import { startCommunityNodeHttp } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

const CHANNEL = 'general';
const COMMUNITY = 'pub-community';
const NOW = '2026-06-16T00:00:00.000Z';

// ---------------------------------------------------------------------------
// node:http helpers (status + json + bytes), with optional headers (for XFF).
// ---------------------------------------------------------------------------

interface RawResponse { status: number; bytes: Uint8Array | null; text: string }

function rawRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers ?? {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: res.statusCode ?? 500,
          bytes: body.length ? new Uint8Array(body) : null,
          text: body.toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

async function getJson(url: string, headers?: Record<string, string>): Promise<{ status: number; json: any }> {
  const res = await rawRequest(url, { headers });
  return { status: res.status, json: res.text ? JSON.parse(res.text) : null };
}

// ---------------------------------------------------------------------------
// Real public fixture: owner-signed publication over a real public snapshot.
// ---------------------------------------------------------------------------

interface PublicFixture {
  owner: DeviceIdentity;
  publicKey: Uint8Array;
  signed: SignedPublicationDescriptor;
  publicationId: string;
  contentId: string;
  manifest: ContentManifest;
  pieces: Uint8Array[];
  authored: ChannelMessageEvent[];
}

function postMessage(author: DeviceIdentity, body: string, wall: string): ChannelMessageEvent {
  return createChannelMessage(author, { communityId: COMMUNITY, channelId: CHANNEL, body, hlc: { wall, counter: 0 } });
}

async function buildPublicFixture(): Promise<PublicFixture> {
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(randomBytes(32));
  const authored = [
    postMessage(owner, 'first public post', '2026-06-16T00:00:10.000Z'),
    postMessage(owner, 'second public post', '2026-06-16T00:00:11.000Z'),
    postMessage(owner, 'third public post', '2026-06-16T00:00:12.000Z'),
  ];

  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({
    identity: owner,
    publicationId: 'pending',
    communityId: COMMUNITY,
    channelId: CHANNEL,
    events: authored,
    publicKey,
    pieceStore: buildStore,
    now: NOW,
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);

  const signed = createPublication(owner, {
    kind: 'channel',
    communityId: COMMUNITY,
    channelId: CHANNEL,
    title: 'Open Channel',
    description: 'A public, anyone-can-read channel.',
    category: 'technology',
    contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey),
    now: NOW,
  });

  return {
    owner, publicKey, signed,
    publicationId: signed.descriptor.publicationId,
    contentId: record.infoHash,
    manifest, pieces, authored,
  };
}

/** Encode a register body (pieces -> base64) for the owner-signed register route. */
function registerBody(signed: SignedPublicationDescriptor, manifest: ContentManifest, pieces: Uint8Array[]): string {
  return JSON.stringify({
    descriptor: signed,
    snapshots: [{
      channelId: CHANNEL,
      epoch: 0,
      manifest,
      pieces: pieces.map((p) => Buffer.from(p).toString('base64')),
    }],
  });
}

async function ownerRegister(server: SeederHttpServer, fx: PublicFixture, signed = fx.signed): Promise<RawResponse> {
  return rawRequest(`${server.url}/public/${fx.publicationId}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: registerBody(signed, fx.manifest, fx.pieces),
  });
}

/** In-process register body (raw Uint8Array pieces) for precise verdict-reason assertions. */
function registerInput(fx: PublicFixture, signed: SignedPublicationDescriptor = fx.signed) {
  return { descriptor: signed, snapshots: [{ channelId: CHANNEL, epoch: 0, manifest: fx.manifest, pieces: fx.pieces }] };
}

let server: SeederHttpServer | null = null;

afterEach(async () => {
  if (server) await server.close();
  server = null;
});

describe('Plan 19 P3a: community-node OPEN public serving routes', () => {
  it('registers a publication and serves the manifest anonymously (no auth headers)', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    const reg = await ownerRegister(server, fx);
    expect(reg.status).toBe(200);

    const { status, json } = await getJson(`${server.url}/public/${fx.publicationId}/manifest`);
    expect(status).toBe(200);
    expect(json.status).toBe('active');
    expect(json.publicationId).toBe(fx.publicationId);
    expect(json.contentId).toBe(fx.contentId);
    expect(json.descriptor.descriptor.ownerDeviceId).toBe(fx.owner.publicKey);
    expect(json.snapshots[0].channelId).toBe(CHANNEL);
  });

  it('serves public snapshot pieces anonymously; the reader imports + verifies them', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    expect((await ownerRegister(server, fx)).status).toBe(200);

    const readerStore = new SnapStore();
    for (let i = 0; i < fx.manifest.pieces.length; i += 1) {
      const res = await rawRequest(`${server.url}/public/${fx.publicationId}/${fx.contentId}/${i}`);
      expect(res.status).toBe(200);
      expect(res.bytes && res.bytes.length).toBeGreaterThan(0);
      readerStore.put(fx.contentId, i, res.bytes!);
    }

    const imported = await importPublicSnapshot({
      publicationId: fx.publicationId,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest: fx.manifest,
      pieceStore: readerStore,
      publicKey: fx.publicKey,
      expectedContentId: fx.contentId,
      expectedAuthor: fx.owner.publicKey,
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.events.map((e) => e.body)).toEqual(
      ['first public post', 'second public post', 'third public post'],
    );
  });

  it('NC-2: a private snapshot piece is NOT reachable via the public route', async () => {
    const fx = await buildPublicFixture();
    // The node shares ONE piece store across public + private content (as it does
    // for private community snapshots). Plant a foreign (private-shaped) snapshot's
    // bytes under a different infoHash: real, fetchable bytes that are NOT this
    // publication's content.
    const sharedStore = new InMemorySeederPieceStore();
    const node = new CommunityNode({ pieceStore: sharedStore, now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    expect((await ownerRegister(server, fx)).status).toBe(200);

    const privateHash = 'deadbeef'.repeat(8);
    const planted = new Uint8Array([1, 2, 3, 4, 5]);
    sharedStore.put(privateHash, 0, planted);
    expect(await node.servePiece(privateHash, 0)).not.toBeNull(); // really stored

    // The public route for THIS publication must refuse the foreign infoHash: NC-2.
    const cross = await rawRequest(`${server.url}/public/${fx.publicationId}/${privateHash}/0`);
    expect(cross.status).toBe(404);

    // Any other non-matching hex hash is equally refused.
    const otherHash = 'abad1dea'.repeat(8);
    const other = await rawRequest(`${server.url}/public/${fx.publicationId}/${otherHash}/0`);
    expect(other.status).toBe(404);

    // The publication's OWN contentId is still served (sanity: only the scope is closed).
    const own = await rawRequest(`${server.url}/public/${fx.publicationId}/${fx.contentId}/0`);
    expect(own.status).toBe(200);
  });

  it('unpublish() removes the publication from all public routes (404)', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    expect((await ownerRegister(server, fx)).status).toBe(200);
    expect((await getJson(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(200);

    // Owner signs an unpublish revision and re-registers it (chained, owner-only).
    const pulled = unpublish(fx.owner, fx.signed, '2026-06-16T00:01:00.000Z');
    expect((await ownerRegister(server, fx, pulled)).status).toBe(200);

    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(404);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${fx.contentId}/0`)).status).toBe(404);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page`)).status).toBe(404);
  });

  it('FF1: an owner unpublish at revision >= 3 un-pins + stops serving (host only holds the genesis)', async () => {
    const fx = await buildPublicFixture();
    const store = new SnapStore();
    const node = new CommunityNode({ now: () => Date.parse(NOW), pieceStore: store });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    // The host only ever stored the GENESIS (rev 1); the owner revised locally and
    // never re-registered the intermediate revisions on this host.
    expect((await ownerRegister(server, fx)).status).toBe(200);
    expect((await getJson(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(200);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${fx.contentId}/0`)).status).toBe(200);
    expect(store.sizeBytes()).toBeGreaterThan(0);

    const rev2 = revisePublication(fx.owner, fx.signed, { title: 'v2' }, '2026-06-16T00:01:00.000Z');
    const rev3 = revisePublication(fx.owner, rev2, { title: 'v3' }, '2026-06-16T00:02:00.000Z');
    const taken = unpublish(fx.owner, rev3, '2026-06-16T00:03:00.000Z'); // revision 4, 'unpublished'
    expect(taken.descriptor.revision).toBe(4);

    // The chained register path would reject rev 4 against the stored rev 1
    // (missing_predecessor); the terminal-takedown branch accepts it (owner-authenticated).
    expect((await ownerRegister(server, fx, taken)).status).toBe(200);

    // Stops serving on every public route AND un-pins the durable bytes.
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(404);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${fx.contentId}/0`)).status).toBe(404);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page`)).status).toBe(404);
    expect(store.sizeBytes()).toBe(0);
  });

  it('FF1: a non-owner forged takedown is rejected and the publication stays served', async () => {
    const fx = await buildPublicFixture();
    const store = new SnapStore();
    const node = new CommunityNode({ now: () => Date.parse(NOW), pieceStore: store });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    expect((await ownerRegister(server, fx)).status).toBe(200);

    // An attacker signs their OWN takedown, then forges the victim's publicationId onto it.
    const attacker = generateDeviceIdentity('Attacker');
    const attackerGenesis = createPublication(attacker, {
      kind: 'channel', communityId: COMMUNITY, channelId: CHANNEL,
      title: 'attacker', description: 'x', category: 'technology',
      contentId: fx.contentId, publicKeyHex: bytesToHex(fx.publicKey), now: NOW,
    });
    const attackerTakedown = unpublish(attacker, attackerGenesis, '2026-06-16T00:01:00.000Z');
    const forged: SignedPublicationDescriptor = {
      ...attackerTakedown,
      descriptor: { ...attackerTakedown.descriptor, publicationId: fx.publicationId },
    };

    // The terminal-takedown branch rejects it (verifyOwnerTakedown sees a foreign owner),
    // and the normal chained path rejects it too (forged previousHash). Never served down.
    expect((await ownerRegister(server, fx, forged)).status).not.toBe(200);

    // The victim's publication is untouched and still served, bytes still pinned.
    expect((await getJson(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(200);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${fx.contentId}/0`)).status).toBe(200);
    expect(store.sizeBytes()).toBeGreaterThan(0);
  });

  it('C3: a republish-then-takedown does NOT wipe a victim publication that shares the contentId', async () => {
    const fx = await buildPublicFixture();
    const store = new SnapStore();
    const node = new CommunityNode({ now: () => Date.parse(NOW), pieceStore: store });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    const registerAs = (pubId: string, signed: SignedPublicationDescriptor) =>
      rawRequest(`${server!.url}/public/${pubId}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: registerBody(signed, fx.manifest, fx.pieces),
      });

    // Victim A publishes content C.
    expect((await registerAs(fx.publicationId, fx.signed)).status).toBe(200);

    // An ATTACKER republishes the SAME content C as their own publication (different
    // owner -> different content-addressed publicationId; pieces hash-verify, so the
    // register is accepted and the bytes dedupe onto the same infoHash store key).
    const attacker = generateDeviceIdentity('Attacker');
    const attackerPub = createPublication(attacker, {
      kind: 'channel', communityId: COMMUNITY, channelId: CHANNEL,
      title: 'stolen', description: 'x', category: 'technology',
      contentId: fx.contentId, publicKeyHex: bytesToHex(fx.publicKey), now: NOW,
    });
    const attackerId = attackerPub.descriptor.publicationId;
    expect((await registerAs(attackerId, attackerPub)).status).toBe(200);

    // Both serve A's shared bytes.
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${fx.contentId}/0`)).status).toBe(200);
    expect((await rawRequest(`${server.url}/public/${attackerId}/${fx.contentId}/0`)).status).toBe(200);

    // The attacker takes down THEIR OWN publication. removeContent is refcounted, so the
    // shared bytes are KEPT (victim A still references them, active).
    const attackerTakedown = unpublish(attacker, attackerPub, '2026-06-16T00:01:00.000Z');
    expect((await registerAs(attackerId, attackerTakedown)).status).toBe(200);

    // Attacker's pub is gone; the VICTIM still serves the shared content + bytes survive.
    expect((await rawRequest(`${server.url}/public/${attackerId}/manifest`)).status).toBe(404);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(200);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${fx.contentId}/0`)).status).toBe(200);
    expect(store.sizeBytes()).toBeGreaterThan(0);
  });

  it('a killed publication (verified DescriptorKill) is dropped from all public routes (404)', async () => {
    const fx = await buildPublicFixture();
    const authority = generateDeviceIdentity('TrustAndSafety');
    const node = new CommunityNode({
      now: () => Date.parse(NOW),
      trustedKillAuthorityDeviceId: authority.publicKey,
    });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    expect((await ownerRegister(server, fx)).status).toBe(200);
    expect((await getJson(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(200);

    // T&S signs a kill for the community; the node verifies + records it.
    const kill = createDescriptorKill(authority, COMMUNITY, 'policy', '2026-06-16T00:02:00.000Z');
    expect(await node.recordPublicationKill(kill)).toBe(true);

    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(404);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${fx.contentId}/0`)).status).toBe(404);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page`)).status).toBe(404);

    // A kill signed by an UNTRUSTED key is ignored (never suppresses content).
    const imposter = generateDeviceIdentity('Imposter');
    const fakeKill = createDescriptorKill(imposter, COMMUNITY, 'spoof', NOW);
    expect(await node.recordPublicationKill(fakeKill)).toBe(false);
  });

  it('pages signed events strictly after the cursor in ascending HLC order', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    expect((await ownerRegister(server, fx)).status).toBe(200);

    // From genesis (no `after`): all three, ascending, hasMore false.
    const all = await getJson(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page`);
    expect(all.status).toBe(200);
    expect(all.json.events.map((e: ChannelMessageEvent) => e.body)).toEqual(
      ['first public post', 'second public post', 'third public post'],
    );
    expect(all.json.hasMore).toBe(false);
    expect(all.json.nextCursor).toBe('2026-06-16T00:00:12.000Z.0');
    // Events are signed (carry the author signature) -- the reader verifies them.
    expect(typeof all.json.events[0].signature).toBe('string');

    // limit=1 -> first event only, hasMore true, cursor at event 1.
    const p1 = await getJson(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page?limit=1`);
    expect(p1.json.events.map((e: ChannelMessageEvent) => e.body)).toEqual(['first public post']);
    expect(p1.json.hasMore).toBe(true);
    expect(p1.json.nextCursor).toBe('2026-06-16T00:00:10.000Z.0');

    // after=p1.nextCursor with limit=1 -> the SECOND event only (strictly after).
    const p2 = await getJson(
      `${server.url}/public/${fx.publicationId}/${CHANNEL}/page?after=${encodeURIComponent(p1.json.nextCursor)}&limit=1`,
    );
    expect(p2.json.events.map((e: ChannelMessageEvent) => e.body)).toEqual(['second public post']);
    expect(p2.json.hasMore).toBe(true);

    // after = the LAST event -> empty window, hasMore false, cursor echoes the input.
    const tail = await getJson(
      `${server.url}/public/${fx.publicationId}/${CHANNEL}/page?after=${encodeURIComponent('2026-06-16T00:00:12.000Z.0')}`,
    );
    expect(tail.json.events).toEqual([]);
    expect(tail.json.hasMore).toBe(false);

    // A huge limit is clamped (does not error) and still returns the full set.
    const big = await getJson(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page?limit=100000`);
    expect(big.json.events).toHaveLength(3);

    // The wrong channelId is not this snapshot's scope -> 404.
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/nope/page`)).status).toBe(404);
  });

  it('rate-limits the open read routes per IP (429); spoofed XFF cannot rotate the key', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({
      node,
      host: '127.0.0.1',
      // Fixed clock so the window never rolls; tiny request budget to force 429.
      // Budget 4: the owner register below spends 1 (same direct-socket bucket
      // under the secure default), leaving 3 for the hammer.
      now: () => Date.parse(NOW),
      publicReadLimits: { requestsPerWindow: 4, windowMs: 60_000 },
    });
    expect((await ownerRegister(server, fx)).status).toBe(200);

    const url = `${server.url}/public/${fx.publicationId}/manifest`;
    const hammer = async (xff: string): Promise<number[]> => {
      const out: number[] = [];
      for (let i = 0; i < 6; i += 1) out.push((await rawRequest(url, { headers: { 'X-Forwarded-For': xff } })).status);
      return out;
    };

    // Default (no trusted proxy): the key is the DIRECT socket address, so a
    // forged XFF neither creates a fresh bucket nor escapes the exhausted one.
    const ipA = await hammer('1.2.3.4');
    expect(ipA.filter((s) => s === 200).length).toBe(3);   // budget = 3
    expect(ipA.filter((s) => s === 429).length).toBe(3);   // the rest are throttled
    const spoofed = await rawRequest(url, { headers: { 'X-Forwarded-For': '5.6.7.8' } });
    expect(spoofed.status).toBe(429);
  });

  it('keys the read limiter on the forwarded client behind a declared trusted proxy hop', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({
      node,
      host: '127.0.0.1',
      now: () => Date.parse(NOW),
      publicReadLimits: { requestsPerWindow: 3, windowMs: 60_000 },
      trustedProxyHops: 1,
    });
    expect((await ownerRegister(server, fx)).status).toBe(200);

    const url = `${server.url}/public/${fx.publicationId}/manifest`;
    const hammer = async (xff: string): Promise<number[]> => {
      const out: number[] = [];
      for (let i = 0; i < 6; i += 1) out.push((await rawRequest(url, { headers: { 'X-Forwarded-For': xff } })).status);
      return out;
    };

    const ipA = await hammer('1.2.3.4');
    expect(ipA.filter((s) => s === 200).length).toBe(3);
    expect(ipA.filter((s) => s === 429).length).toBe(3);

    // With one declared hop, the LAST XFF entry (set by the trusted proxy) keys the
    // bucket: a different forwarded client gets its own budget...
    const fresh = await rawRequest(url, { headers: { 'X-Forwarded-For': '5.6.7.8' } });
    expect(fresh.status).toBe(200);

    // ...and extra attacker-prepended hops beyond the declared count are ignored:
    // "9.9.9.9, 1.2.3.4" still resolves to IP A's (exhausted) bucket.
    const prepended = await rawRequest(url, { headers: { 'X-Forwarded-For': '9.9.9.9, 1.2.3.4' } });
    expect(prepended.status).toBe(429);
  });

  it('refuses a tampered (not owner-signed) publication descriptor', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });

    // Flip a signature-covered field WITHOUT re-signing: verifyPublication recomputes
    // the genesis id (and checks the owner signature) and fails closed.
    const tampered: SignedPublicationDescriptor = {
      descriptor: { ...fx.signed.descriptor, title: 'hijacked' },
      signature: fx.signed.signature,
    };
    const res = await rawRequest(`${server.url}/public/${fx.publicationId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: registerBody(tampered, fx.manifest, fx.pieces),
    });
    expect([400, 401]).toContain(res.status);

    // Nothing was registered.
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/manifest`)).status).toBe(404);
  });

  it('trips the per-IP byte ceiling (429) and recovers after the window rolls', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    // Register in-process so we can size the byte budget to exactly ONE manifest.
    expect((await node.registerPublication(registerInput(fx))).ok).toBe(true);
    const payload = await node.getPublicationManifest(fx.publicationId);
    const manifestBytes = Buffer.byteLength(JSON.stringify(payload));

    let clock = Date.parse(NOW);
    server = await startCommunityNodeHttp({
      node,
      host: '127.0.0.1',
      now: () => clock,
      // Generous request budget so ONLY the byte ceiling can bind; one manifest fits.
      publicReadLimits: { requestsPerWindow: 10_000, bytesPerWindow: manifestBytes, perPublicationBytesPerWindow: 1e12, windowMs: 1000 },
    });
    const url = `${server.url}/public/${fx.publicationId}/manifest`;
    const xff = { 'X-Forwarded-For': '7.7.7.7' };

    expect((await rawRequest(url, { headers: xff })).status).toBe(200); // exactly one fits
    expect((await rawRequest(url, { headers: xff })).status).toBe(429); // per-IP byte ceiling

    clock += 2000; // roll the tumbling window
    expect((await rawRequest(url, { headers: xff })).status).toBe(200); // recovered
  });

  it('trips the per-publication byte ceiling across distinct IPs (429)', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    expect((await node.registerPublication(registerInput(fx))).ok).toBe(true);
    const payload = await node.getPublicationManifest(fx.publicationId);
    const manifestBytes = Buffer.byteLength(JSON.stringify(payload));

    server = await startCommunityNodeHttp({
      node,
      host: '127.0.0.1',
      now: () => Date.parse(NOW),
      // High per-IP budget; the PER-PUBLICATION ceiling (one manifest total) binds across IPs.
      publicReadLimits: { requestsPerWindow: 10_000, bytesPerWindow: 1e12, perPublicationBytesPerWindow: manifestBytes, windowMs: 60_000 },
    });
    const url = `${server.url}/public/${fx.publicationId}/manifest`;

    expect((await rawRequest(url, { headers: { 'X-Forwarded-For': '8.8.8.8' } })).status).toBe(200);
    // A DIFFERENT IP is refused: the publication's whole byte budget is already spent.
    expect((await rawRequest(url, { headers: { 'X-Forwarded-For': '9.9.9.1' } })).status).toBe(429);
  });

  it('rejects a rolled-back / skipped publication revision (stale_revision, missing_predecessor)', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    expect((await node.registerPublication(registerInput(fx))).ok).toBe(true); // rev 1

    const rev2 = revisePublication(fx.owner, fx.signed, { title: 'v2' }, '2026-06-16T00:01:00.000Z');
    const rev3 = revisePublication(fx.owner, rev2, { title: 'v3' }, '2026-06-16T00:02:00.000Z');

    // rev 3 presented while only rev 1 is stored: cannot chain (skips rev 2) -> fail closed.
    const skipped = await node.registerPublication(registerInput(fx, rev3));
    expect(skipped).toEqual({ ok: false, status: 400, reason: 'missing_predecessor' });

    // rev 2 chains off rev 1 -> accepted.
    expect((await node.registerPublication(registerInput(fx, rev2))).ok).toBe(true);

    // Replaying the older rev 1 after rev 2 is stored is a rollback -> rejected.
    const rolledBack = await node.registerPublication(registerInput(fx, fx.signed));
    expect(rolledBack).toEqual({ ok: false, status: 400, reason: 'stale_revision' });
  });

  it('a kill drops a publication whose page cache is already warm (cache-after-kill)', async () => {
    const fx = await buildPublicFixture();
    const authority = generateDeviceIdentity('TrustAndSafety');
    const node = new CommunityNode({ now: () => Date.parse(NOW), trustedKillAuthorityDeviceId: authority.publicKey });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    expect((await ownerRegister(server, fx)).status).toBe(200);

    // Warm the parsed-events cache for this channel.
    const warm = await getJson(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page`);
    expect(warm.json.events).toHaveLength(3);

    // Kill: the resolve gate short-circuits BEFORE the cache, so the warm cache is never served.
    const kill = createDescriptorKill(authority, COMMUNITY, 'policy', '2026-06-16T00:03:00.000Z');
    expect(await node.recordPublicationKill(kill)).toBe(true);
    expect((await rawRequest(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page`)).status).toBe(404);
  });

  it('handles malformed page params (limit=abc -> default 50; after=garbage -> 400)', async () => {
    const fx = await buildPublicFixture();
    const node = new CommunityNode({ now: () => Date.parse(NOW) });
    server = await startCommunityNodeHttp({ node, host: '127.0.0.1' });
    expect((await ownerRegister(server, fx)).status).toBe(200);

    // A non-numeric limit falls back to the default (50) and returns the full set.
    const badLimit = await getJson(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page?limit=abc`);
    expect(badLimit.status).toBe(200);
    expect(badLimit.json.events).toHaveLength(3);

    // A malformed cursor fails closed with 400 (the client must send {wall}.{counter}).
    const badCursor = await rawRequest(`${server.url}/public/${fx.publicationId}/${CHANNEL}/page?after=garbage`);
    expect(badCursor.status).toBe(400);
  });
});
