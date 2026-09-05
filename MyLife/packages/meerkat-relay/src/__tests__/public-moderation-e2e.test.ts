/**
 * Plan 19 P8a acceptance: the public MODERATION layer end-to-end across REAL services
 * with REAL bytes over real sockets (plan §12 / TC-8). Two live servers stand up on
 * 127.0.0.1 (random ports):
 *
 *   - a LIVE directory    (startPublicDirectoryNode) -- ws ann/lk/trend discovery verbs.
 *   - a LIVE community     (startCommunityNodeHttp)   -- OPEN serving + moderation routes.
 *
 * The moderation "relay" here is the community node's HOST ABUSE-INTAKE: an UNSEALED,
 * reporter-signed report (Plan 19 §9) that an unpaired public reader can file with NO
 * owner DH key. The host verifies the reporter's Ed25519 signature alone, stores it,
 * and later hands it to the publication OWNER (who proves ownership with their own
 * Ed25519 key). This is the real fix for the P4 honest finding: the sealed mailbox path
 * needed the owner's X25519 DH key, which the PublicationDescriptor does not carry, so a
 * public reader could not seal a report. The unsealed host-intake + owner-fetch is the
 * genuine unpaired path.
 *
 * Acceptance proven here (all REAL bytes over live sockets):
 *  - §9: a reader B reports public content via POST /public/{id}/report (real signed
 *    unsealed report); the owner A pulls it via GET /public/{id}/reports (owner-signed),
 *    including a csam PRIORITY-flagged case; the owner sees WHO reported.
 *  - fail-closed: a FORGED report (bad reporter signature) is rejected 400 and never
 *    stored; a NON-OWNER GET /reports is rejected 401.
 *  - AC-7: A unpublishes + re-announces the unpublished revision -> the directory
 *    REMOVES the publication (B's browse drops it) AND the serving host 404s.
 *  - kill path: a T&S authority DescriptorKill drops it from browse + trending + 404.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import {
  announceHeldContent,
  announcePublication,
  browsePublications,
  buildPublicSnapshot,
  bytesToHex,
  createChannelMessage,
  createDescriptorKill,
  createPublication,
  createPublicAbuseReport,
  createPublicReportFetchSignature,
  deriveCategoryRid,
  generateDeviceIdentity,
  unpublish,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type SignedPublicAbuseReport,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
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
const COMMUNITY = 'cm_public_moderation';
const COMMUNITY_KILL = 'cm_public_moderation_kill';
const CATEGORY = 'technology' as const;

// ---------------------------------------------------------------------------
// Live-service teardown
// ---------------------------------------------------------------------------

let directory: PublicDirectoryNodeServer | null = null;
let community: SeederHttpServer | null = null;

afterEach(async () => {
  if (community) { await community.close(); community = null; }
  if (directory) { await directory.close(); directory = null; }
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

function authorEvent(author: DeviceIdentity, communityId: string, body: string, wall: string): ChannelMessageEvent {
  return createChannelMessage(author, { communityId, channelId: CHANNEL, body, hlc: { wall, counter: 0 } });
}

async function buildPublishFixture(owner: DeviceIdentity, hostUrls: string[], communityId: string): Promise<PublishFixture> {
  const publicKey = new Uint8Array(randomBytes(32));
  const authored = [
    authorEvent(owner, communityId, 'welcome to the public channel', '2026-06-29T00:00:10.000Z'),
    authorEvent(owner, communityId, 'second public post', '2026-06-29T00:00:11.000Z'),
  ];

  // Build the snapshot FIRST: infoHash is content-addressed, NOT publicationId-derived.
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({
    identity: owner,
    publicationId: 'pending',
    communityId,
    channelId: CHANNEL,
    events: authored,
    publicKey,
    pieceStore: buildStore,
    now: '2026-06-29T00:00:00.000Z',
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(record.infoHash, i) as Uint8Array);

  // THEN sign the descriptor over the real contentId; publicationId derives from it.
  const signed = createPublication(owner, {
    kind: 'channel',
    communityId,
    channelId: CHANNEL,
    title: 'Public Rust Channel',
    description: 'A public, anyone-can-read rust programming channel.',
    category: CATEGORY,
    contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey),
    hostUrls,
    now: '2026-06-29T00:00:00.000Z',
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

/** POST one unsealed signed report to the host abuse-intake route. */
function postReport(baseUrl: string, publicationId: string, signed: SignedPublicAbuseReport): Promise<RawResponse> {
  return rawRequest(`${baseUrl}/public/${publicationId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signed),
  });
}

/** GET the owner-signed reports route, proving ownership with an Ed25519 fetch signature. */
function fetchReports(baseUrl: string, publicationId: string, signer: DeviceIdentity): Promise<RawResponse> {
  const ts = new Date().toISOString();
  const sig = createPublicReportFetchSignature(signer, publicationId, ts);
  return rawRequest(`${baseUrl}/public/${publicationId}/reports`, {
    method: 'GET',
    headers: { 'x-mk-ts': ts, 'x-mk-owner-sig': sig },
  });
}

/**
 * Raw directory announce of an arbitrary signed record (the shipping announcePublication
 * helper REFUSES a non-active descriptor, so the unpublish re-announce uses the relay
 * `ann` verb directly -- exactly what the app's announce does on the wire).
 */
function rawAnnounce(url: string, rid: string, rec: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let settled = false;
    const done = (fn: () => void) => { if (!settled) { settled = true; ws.close(); fn(); } };
    ws.on('open', () => ws.send(JSON.stringify({ t: 'ann', rid, rec })));
    ws.on('message', (data: Buffer) => {
      let frame: { t?: string; code?: string };
      try { frame = JSON.parse(data.toString('utf8')); } catch { return; }
      if (frame.t === 'annok') done(() => resolve());
      else if (frame.t === 'err') done(() => reject(new Error(frame.code ?? 'err')));
    });
    ws.on('error', (e: Error) => { if (!settled) { settled = true; reject(e); } });
  });
}

interface ReportsBody {
  reports: Array<{ report: { reason: string; reporterDeviceId: string; publicationId: string }; signature: string; priority: boolean }>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plan 19 P8a: public moderation over a LIVE directory + serving host (REAL bytes)', () => {
  it('§9/AC-7: B reports unsealed; owner A fetches (priority-flagged); forged=400, non-owner=401; unpublish removes everywhere', async () => {
    const dirNode = new PublicDirectoryNode({});
    directory = await startPublicDirectoryNode({ node: dirNode, host: '127.0.0.1' });
    const commNode = new CommunityNode({});
    community = await startCommunityNodeHttp({ node: commNode, host: '127.0.0.1' });

    const deviceA = generateDeviceIdentity('DeviceA');
    const deviceB = generateDeviceIdentity('DeviceB');
    const deviceC = generateDeviceIdentity('DeviceC');
    const fx = await buildPublishFixture(deviceA, [community.url], COMMUNITY);

    // A publishes: register the owner-signed descriptor + snapshot + announce it.
    expect((await ownerRegister(community.url, fx)).status).toBe(200);
    await announcePublication({ url: directory.url, signed: fx.signed, webSocketImpl: WS as never });
    await announceHeldContent({ url: directory.url, contentId: fx.contentId, hostUrl: community.url, webSocketImpl: WS as never });

    // B browses + sees it.
    const before = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(before.some((e) => e.descriptor.publicationId === fx.publicationId)).toBe(true);

    // --- §9: B files an UNSEALED, signed public report (NO owner DH key needed). ---
    const spamReport = createPublicAbuseReport(deviceB, {
      publicationId: fx.publicationId, targetKind: 'post', targetId: fx.authored[0]!.id, reason: 'spam',
    });
    expect((await postReport(community.url, fx.publicationId, spamReport)).status).toBe(200);

    // A second reader files a CSAM report -> PRIORITY.
    const csamReport = createPublicAbuseReport(deviceC, {
      publicationId: fx.publicationId, targetKind: 'community', targetId: COMMUNITY, reason: 'csam',
    });
    expect((await postReport(community.url, fx.publicationId, csamReport)).status).toBe(200);

    // FORGED report (bad reporter signature) -> 400, never stored (fail-closed).
    const forged: SignedPublicAbuseReport = {
      report: spamReport.report,
      signature: (spamReport.signature[0] === '0' ? 'f' : '0') + spamReport.signature.slice(1),
    };
    expect((await postReport(community.url, fx.publicationId, forged)).status).toBe(400);

    // DoS hardening: an OVERSIZE-field report (targetId > 128 chars, still under the
    // 16 KB body cap) is rejected 400 by the §9 field caps and never stored.
    const oversizeField = createPublicAbuseReport(deviceB, {
      publicationId: fx.publicationId, targetKind: 'post', targetId: 'x'.repeat(600), reason: 'spam',
    });
    expect((await postReport(community.url, fx.publicationId, oversizeField)).status).toBe(400);

    // DoS hardening: a > 16 KB body is refused at the read cap (413) before verification.
    const hugeBody = createPublicAbuseReport(deviceB, {
      publicationId: fx.publicationId, targetKind: 'post', targetId: 'x'.repeat(40_000), reason: 'spam',
    });
    expect((await postReport(community.url, fx.publicationId, hugeBody)).status).toBe(413);

    // NON-OWNER GET /reports -> 401 (B signs a valid fetch, but B is not the owner).
    expect((await fetchReports(community.url, fx.publicationId, deviceB)).status).toBe(401);

    // Owner A fetches: sees BOTH reports, csam priority-flagged + sorted first, and WHO reported.
    const ownerResp = await fetchReports(community.url, fx.publicationId, deviceA);
    expect(ownerResp.status).toBe(200);
    const body = JSON.parse(ownerResp.text) as ReportsBody;
    expect(body.reports).toHaveLength(2); // the forged one was rejected, not stored
    expect(body.reports[0]!.report.reason).toBe('csam');
    expect(body.reports[0]!.priority).toBe(true);
    const spamRec = body.reports.find((r) => r.report.reason === 'spam');
    expect(spamRec).toBeDefined();
    expect(spamRec!.priority).toBe(false);
    expect(spamRec!.report.reporterDeviceId).toBe(deviceB.publicKey); // owner sees WHO reported

    // --- AC-7: A unpublishes; the serving host 404s + the directory REMOVES it. ---
    const pulled = unpublish(deviceA, fx.signed, '2026-06-29T01:00:00.000Z');
    expect((await ownerRegister(community.url, fx, pulled)).status).toBe(200);
    expect((await rawRequest(`${community.url}/public/${fx.publicationId}/manifest`)).status).toBe(404);

    // A FORGED unpublish (right publicationId, NOT chained off the stored genesis / not
    // owner-signed) is IGNORED: it leaves the live publication in browse (fail-closed),
    // so it can never take down someone else's publication. Announce it BEFORE the real
    // unpublish, while the genesis is still stored.
    const forgedUnpub: SignedPublicationDescriptor = {
      descriptor: { ...fx.signed.descriptor, revision: 2, status: 'unpublished', previousHash: 'deadbeef' },
      signature: fx.signed.signature,
    };
    await rawAnnounce(directory.url, deriveCategoryRid(CATEGORY), JSON.stringify(forgedUnpub));
    const stillThere = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(stillThere.some((e) => e.descriptor.publicationId === fx.publicationId)).toBe(true);

    // Re-announce the REAL owner-signed UNPUBLISHED revision -> recordUnpublish removes it.
    await rawAnnounce(directory.url, deriveCategoryRid(CATEGORY), JSON.stringify(pulled));
    const after = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(after.some((e) => e.descriptor.publicationId === fx.publicationId)).toBe(false);
  });

  it('kill path: a T&S DescriptorKill drops the publication from browse + trending + serving 404', async () => {
    const authority = generateDeviceIdentity('TnS Authority');
    const dirNode = new PublicDirectoryNode({ trustedKillAuthorityDeviceId: authority.publicKey });
    directory = await startPublicDirectoryNode({ node: dirNode, host: '127.0.0.1' });
    const commNode = new CommunityNode({ trustedKillAuthorityDeviceId: authority.publicKey });
    community = await startCommunityNodeHttp({ node: commNode, host: '127.0.0.1' });

    const deviceA = generateDeviceIdentity('DeviceA');
    const fx = await buildPublishFixture(deviceA, [community.url], COMMUNITY_KILL);

    expect((await ownerRegister(community.url, fx)).status).toBe(200);
    await announcePublication({ url: directory.url, signed: fx.signed, webSocketImpl: WS as never });
    await announceHeldContent({ url: directory.url, contentId: fx.contentId, hostUrl: community.url, webSocketImpl: WS as never });

    // Present in browse + trending + serving before the kill.
    const before = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(before.some((e) => e.descriptor.publicationId === fx.publicationId)).toBe(true);
    const trendBefore = await dirNode.trending('test-ip', CATEGORY);
    expect(trendBefore.ok && trendBefore.recs.some((r) => r.includes(fx.publicationId))).toBe(true);
    expect((await rawRequest(`${community.url}/public/${fx.publicationId}/manifest`)).status).toBe(200);

    // T&S signs a kill for the community; both nodes honor it (authority configured).
    const kill = createDescriptorKill(authority, COMMUNITY_KILL, 'illegal content');
    expect(await dirNode.recordKill(kill)).toBe(true);
    expect(await commNode.recordPublicationKill(kill)).toBe(true);

    // Dropped from browse + trending; the serving host 404s.
    const afterBrowse = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(afterBrowse.some((e) => e.descriptor.publicationId === fx.publicationId)).toBe(false);
    const trendAfter = await dirNode.trending('test-ip2', CATEGORY);
    expect(trendAfter.ok && trendAfter.recs.some((r) => r.includes(fx.publicationId))).toBe(false);
    expect((await rawRequest(`${community.url}/public/${fx.publicationId}/manifest`)).status).toBe(404);

    // A forged kill (untrusted authority) is ignored: it can never suppress content.
    const impostor = generateDeviceIdentity('Impostor');
    const fakeKill = createDescriptorKill(impostor, COMMUNITY_KILL, 'fake');
    expect(await commNode.recordPublicationKill(fakeKill)).toBe(false);
  });
});
