/**
 * Plan 19 P3b acceptance: the deployable public-directory-node discovery service.
 *
 * Everything is real: real Ed25519 identities, real owner-signed
 * SignedPublicationDescriptors (verifyPublication), a real ws server speaking the
 * SAME relay `ann`/`lk` verbs the P2 client talks, and the real P2 directory client
 * (`announcePublication`/`browsePublications`/`searchPublications`) pointed at the
 * directory node unchanged. A raw ws client drives the new `trend` verb and the
 * distinct-host announcements (distinct X-Forwarded-For hops = distinct serving
 * hosts behind the trusted edge proxy).
 *
 * Acceptance proven here:
 *  1. store/serve: an owner-signed publication announced via the P2 client is
 *     returned verified by browse(category) + search(term); a forged (tampered,
 *     not owner-signed) record is dropped on store (never a stored publication).
 *  2. trending: ranked by the REAL distinct announcing-host count first, recency
 *     (owner-signed updatedAt) second; NO owner-claimed eventCount/likes influence.
 *  3. per-owner cap: one owner past the cap is rejected; a different owner is fine.
 *  4. DescriptorKill: a verified kill removes the publication from browse/search/
 *     trending; an UNSIGNED/forged kill (wrong authority) removes nothing.
 *  5. durability: a SECOND node over the same data dir still rejects the killed
 *     publication and preserves the stored (non-killed) records after a restart.
 *  6. limiter: the open endpoints hammered past the cap return err rate_limited and
 *     the tracked-client map stays bounded (swept/capped, no unbounded growth).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import {
  announcePublication,
  browsePublications,
  searchPublications,
  bytesToHex,
  createDescriptorKill,
  createPublication,
  deriveCategoryRid,
  deriveContentRegistryId,
  generateDeviceIdentity,
  revisePublication,
  unpublish,
  type DeviceIdentity,
  type PublicCategory,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import {
  PublicDirectoryNode,
  FileKillStore,
  FilePublicationDirectoryStore,
  startPublicDirectoryNode,
  type PublicDirectoryNodeServer,
} from '../index';

// The sync registry/directory client uses the platform global WebSocket; inject ws.
const WS = WebSocket as unknown as new (url: string) => unknown;
const NOW = Date.parse('2026-06-20T00:00:00.000Z');

let server: PublicDirectoryNodeServer | null = null;
let tmp: string | null = null;
afterEach(async () => {
  if (server) await server.close();
  server = null;
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = null;
});

function makePublication(
  owner: DeviceIdentity,
  opts: {
    communityId: string;
    contentId: string;
    title: string;
    description: string;
    category?: PublicCategory;
    updatedAt?: string;
  },
): SignedPublicationDescriptor {
  return createPublication(owner, {
    kind: 'community',
    communityId: opts.communityId,
    title: opts.title,
    description: opts.description,
    category: opts.category ?? 'technology',
    contentId: opts.contentId,
    publicKeyHex: bytesToHex(new Uint8Array(randomBytes(32))),
    now: opts.updatedAt ?? '2026-06-20T00:00:00.000Z',
  });
}

/** One raw ws round-trip (open, send a frame, await one reply, close), optional XFF. */
function wsRoundTrip(url: string, frame: unknown, xff?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = xff
      ? new WebSocket(url, { headers: { 'X-Forwarded-For': xff } })
      : new WebSocket(url);
    let settled = false;
    socket.on('open', () => socket.send(JSON.stringify(frame)));
    socket.on('message', (data: Buffer) => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(data.toString('utf8'))); } catch (err) { reject(err); }
      try { socket.send(JSON.stringify({ t: 'bye' })); } catch { /* ignore */ }
      socket.close();
    });
    socket.on('error', (err: Error) => { if (!settled) { settled = true; reject(err); } });
    socket.on('close', () => { if (!settled) { settled = true; reject(new Error('closed before reply')); } });
  });
}

/** Send a RAW text payload (not necessarily JSON) and resolve the first reply, or the
 *  ws close code when the server closes without replying (oversized-frame path). */
function wsRaw(url: string, raw: string): Promise<{ reply?: any; closeCode?: number }> {
  return new Promise((resolve) => {
    const socket = new WebSocket(url, { maxPayload: 1024 * 1024 });
    let settled = false;
    const done = (v: { reply?: any; closeCode?: number }) => { if (!settled) { settled = true; resolve(v); try { socket.close(); } catch { /* ignore */ } } };
    socket.on('open', () => socket.send(raw));
    socket.on('message', (data: Buffer) => done({ reply: JSON.parse(data.toString('utf8')) }));
    socket.on('close', (code: number) => done({ closeCode: code }));
    socket.on('error', () => { if (!settled) { settled = true; resolve({ closeCode: 1006 }); } });
  });
}

/** Announce a real publication's contentId from `count` DISTINCT hosts (distinct XFF hops). */
async function announceHosts(url: string, contentId: string, count: number): Promise<void> {
  const rid = deriveContentRegistryId(contentId);
  for (let i = 1; i <= count; i += 1) {
    const reply = await wsRoundTrip(url, { t: 'ann', rid, rec: `host-${contentId}-${i}` }, `10.0.0.${i}`);
    expect(reply.t).toBe('annok');
  }
}

async function trending(url: string, category?: PublicCategory, limit?: number): Promise<SignedPublicationDescriptor[]> {
  const reply = await wsRoundTrip(url, { t: 'trend', category, limit });
  expect(reply.t).toBe('trending');
  return (reply.recs as string[]).map((r) => JSON.parse(r) as SignedPublicationDescriptor);
}

describe('Plan 19 P3b: public-directory-node discovery service', () => {
  it('stores + serves a publication (browse + search) and drops a forged record on store', async () => {
    const owner = generateDeviceIdentity('Publisher');
    const node = new PublicDirectoryNode({ now: () => NOW });
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1' });

    const signed = makePublication(owner, {
      communityId: 'comm-1', contentId: 'content-1',
      title: 'Rust Programming', description: 'systems language community',
      category: 'technology',
    });
    await announcePublication({ url: server.url, signed, webSocketImpl: WS as never });

    // Forged: flip a signature-covered field WITHOUT re-signing, announce it raw
    // under the SAME category rid. verifyPublication fails closed -> never stored.
    const tampered: SignedPublicationDescriptor = {
      descriptor: { ...signed.descriptor, title: 'hijacked' },
      signature: signed.signature,
    };
    const forgedReply = await wsRoundTrip(
      server.url,
      { t: 'ann', rid: deriveCategoryRid('technology'), rec: JSON.stringify(tampered) },
    );
    expect(forgedReply.t).toBe('annok'); // accepted as an opaque host slot, NOT a publication

    const browsed = await browsePublications({ url: server.url, category: 'technology', webSocketImpl: WS as never });
    expect(browsed.map((e) => e.descriptor.publicationId)).toEqual([signed.descriptor.publicationId]);
    expect(browsed[0]!.verified).toBe(true);

    const searched = await searchPublications({ url: server.url, terms: ['rust'], webSocketImpl: WS as never });
    expect(searched.map((e) => e.descriptor.publicationId)).toEqual([signed.descriptor.publicationId]);

    // Verify-on-store: exactly ONE real publication is stored (the forged one is not).
    expect((await node.stats()).publications).toBe(1);
  });

  it('round-trips a non-Latin (CJK) publication through announce -> search over the live node (FF4)', async () => {
    const owner = generateDeviceIdentity('Publisher');
    const node = new PublicDirectoryNode({ now: () => NOW });
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1' });

    const signed = makePublication(owner, {
      communityId: 'comm-cjk', contentId: 'content-cjk',
      title: '東京自転車クラブ', description: '公開コミュニティ',
      category: 'local',
    });
    await announcePublication({ url: server.url, signed, webSocketImpl: WS as never });

    const searched = await searchPublications({
      url: server.url, terms: ['東京自転車'], webSocketImpl: WS as never,
    });
    expect(searched.map((e) => e.descriptor.publicationId)).toEqual([signed.descriptor.publicationId]);
  });

  it('ranks trending by real announcing-host count first, recency second; no eventCount influence', async () => {
    const owner = generateDeviceIdentity('Publisher');
    // A mutable clock: host-count changes ride the trending-cache TTL, so we advance
    // the clock past it to observe a re-rank (production reflects host counts within TTL).
    let clock = NOW;
    const node = new PublicDirectoryNode({ now: () => clock, trendingCacheTtlMs: 1000 });
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1' });

    // A is NEWER, B is OLDER. Both start with zero announcing hosts.
    const pubA = makePublication(owner, {
      communityId: 'comm-a', contentId: 'content-a', title: 'Alpha', description: 'alpha topic',
      updatedAt: '2026-06-20T00:00:10.000Z',
    });
    const pubB = makePublication(owner, {
      communityId: 'comm-b', contentId: 'content-b', title: 'Bravo', description: 'bravo topic',
      updatedAt: '2026-06-20T00:00:05.000Z',
    });
    await announcePublication({ url: server.url, signed: pubA, webSocketImpl: WS as never });
    await announcePublication({ url: server.url, signed: pubB, webSocketImpl: WS as never });

    // No hosts yet: recency decides -> A (newer) first.
    expect((await trending(server.url)).map((p) => p.descriptor.publicationId))
      .toEqual([pubA.descriptor.publicationId, pubB.descriptor.publicationId]);

    // 3 DISTINCT hosts announce B's content -> B outranks A on the REAL host count,
    // even though A is newer. (No eventCount/likes exist to inflate A.)
    await announceHosts(server.url, 'content-b', 3);
    clock += 2000; // expire the trending cache so the new host counts are reflected
    expect((await trending(server.url)).map((p) => p.descriptor.publicationId))
      .toEqual([pubB.descriptor.publicationId, pubA.descriptor.publicationId]);

    // Give A the SAME host count (3): the tie now falls to recency -> A (newer) first.
    await announceHosts(server.url, 'content-a', 3);
    clock += 2000;
    expect((await trending(server.url)).map((p) => p.descriptor.publicationId))
      .toEqual([pubA.descriptor.publicationId, pubB.descriptor.publicationId]);

    // Category filter narrows trending to the signed category.
    const onlyTech = await trending(server.url, 'technology');
    expect(onlyTech).toHaveLength(2);
    const noneGaming = await trending(server.url, 'gaming');
    expect(noneGaming).toHaveLength(0);
  });

  it('enforces the per-owner publication cap; a different owner is unaffected', async () => {
    const ownerA = generateDeviceIdentity('OwnerA');
    const ownerB = generateDeviceIdentity('OwnerB');
    const node = new PublicDirectoryNode({ now: () => NOW, limits: { maxPublicationsPerOwner: 2 } });
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1' });

    const opts = (i: number) => ({
      communityId: `c-${i}`, contentId: `content-${i}`, title: `Title ${i}`, description: `desc ${i}`,
    });
    await announcePublication({ url: server.url, signed: makePublication(ownerA, opts(1)), webSocketImpl: WS as never });
    await announcePublication({ url: server.url, signed: makePublication(ownerA, opts(2)), webSocketImpl: WS as never });

    // Owner A's THIRD distinct publication is over the cap -> announce rejected (relay err).
    await expect(
      announcePublication({ url: server.url, signed: makePublication(ownerA, opts(3)), webSocketImpl: WS as never }),
    ).rejects.toThrow();
    expect((await node.stats()).publications).toBe(2);

    // A DIFFERENT owner has its own budget.
    await announcePublication({ url: server.url, signed: makePublication(ownerB, opts(4)), webSocketImpl: WS as never });
    expect((await node.stats()).publications).toBe(3);
  });

  it('honors a verified DescriptorKill across browse/search/trending; a forged kill removes nothing', async () => {
    const owner = generateDeviceIdentity('Publisher');
    const authority = generateDeviceIdentity('TrustAndSafety');
    const node = new PublicDirectoryNode({ now: () => NOW, trustedKillAuthorityDeviceId: authority.publicKey });
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1' });

    const signed = makePublication(owner, {
      communityId: 'comm-kill', contentId: 'content-kill',
      title: 'Killable', description: 'rust topic to remove',
    });
    await announcePublication({ url: server.url, signed, webSocketImpl: WS as never });
    expect((await browsePublications({ url: server.url, category: 'technology', webSocketImpl: WS as never }))).toHaveLength(1);

    // A forged kill (untrusted authority) removes nothing.
    const imposter = generateDeviceIdentity('Imposter');
    expect(await node.recordKill(createDescriptorKill(imposter, 'comm-kill', 'spoof'))).toBe(false);
    expect((await browsePublications({ url: server.url, category: 'technology', webSocketImpl: WS as never }))).toHaveLength(1);

    // A verified kill from the trusted authority drops it everywhere.
    expect(await node.recordKill(createDescriptorKill(authority, 'comm-kill', 'policy'))).toBe(true);
    expect((await browsePublications({ url: server.url, category: 'technology', webSocketImpl: WS as never }))).toHaveLength(0);
    expect((await searchPublications({ url: server.url, terms: ['rust'], webSocketImpl: WS as never }))).toHaveLength(0);
    expect((await trending(server.url))).toHaveLength(0);
  });

  it('durably survives a restart: killed publication stays gone, stored records preserved', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'mk-dir-'));
    const owner = generateDeviceIdentity('Publisher');
    const authority = generateDeviceIdentity('TrustAndSafety');

    const killed = makePublication(owner, {
      communityId: 'comm-doomed', contentId: 'content-doomed', title: 'Doomed', description: 'rust doomed',
    });
    const survivor = makePublication(owner, {
      communityId: 'comm-survivor', contentId: 'content-survivor', title: 'Survivor', description: 'rust survivor',
    });

    const node1 = new PublicDirectoryNode({
      now: () => NOW,
      trustedKillAuthorityDeviceId: authority.publicKey,
      publicationStore: new FilePublicationDirectoryStore(join(tmp, 'publications')),
      killStore: new FileKillStore(join(tmp, 'kills')),
    });
    const catRid = deriveCategoryRid('technology');
    expect((await node1.announce('1.1.1.1', catRid, JSON.stringify(killed))).ok).toBe(true);
    expect((await node1.announce('1.1.1.1', catRid, JSON.stringify(survivor))).ok).toBe(true);
    expect(await node1.recordKill(createDescriptorKill(authority, 'comm-doomed', 'policy'))).toBe(true);

    // Restart: a fresh node over the SAME dirs re-feeds the durable kill ledger and
    // reloads the stored publications.
    const node2 = new PublicDirectoryNode({
      now: () => NOW,
      trustedKillAuthorityDeviceId: authority.publicKey,
      publicationStore: new FilePublicationDirectoryStore(join(tmp, 'publications')),
      killStore: new FileKillStore(join(tmp, 'kills')),
    });
    const look = await node2.lookup('1.1.1.1', catRid);
    expect(look.ok).toBe(true);
    if (!look.ok) return;
    const ids = look.recs.map((r) => (JSON.parse(r) as SignedPublicationDescriptor).descriptor.publicationId);
    expect(ids).toContain(survivor.descriptor.publicationId);     // preserved
    expect(ids).not.toContain(killed.descriptor.publicationId);   // takedown sticks
  });

  it('rate-limits the open endpoints per IP (err rate_limited) and keeps the limiter map bounded', async () => {
    const node = new PublicDirectoryNode({
      now: () => NOW,
      // Tiny request budget + a tiny tracked-client cap to force 429 and prove bounding.
      publicReadLimits: { requestsPerWindow: 3, windowMs: 60_000, maxTrackedClients: 2 },
    });
    // Declare one trusted hop so the XFF-simulated client IPs below key the limiter
    // (the secure default ignores XFF entirely and would collapse them into one key).
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1', trustedProxyHops: 1 });
    const rid = deriveCategoryRid('technology');

    // Hammer ONE IP past the budget: first 3 ok, the rest rate_limited.
    const statuses: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const reply = await wsRoundTrip(server.url, { t: 'lk', rid }, '4.4.4.4');
      statuses.push(reply.t === 'err' ? reply.code : reply.t);
    }
    expect(statuses.filter((s) => s === 'hosts').length).toBe(3);
    expect(statuses.filter((s) => s === 'rate_limited').length).toBe(3);

    // Spray many DISTINCT IPs: the tracked-client map is hard-capped (swept + evicted).
    for (let i = 0; i < 25; i += 1) {
      await wsRoundTrip(server.url, { t: 'lk', rid }, `203.0.113.${i}`);
    }
    expect((await node.stats()).limiterTrackedClients).toBeLessThanOrEqual(2);
  });

  it('a revised (non-genesis) descriptor presented standalone is dropped (genesis-only fail-closed)', async () => {
    const owner = generateDeviceIdentity('Publisher');
    const node = new PublicDirectoryNode({ now: () => NOW });
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1' });
    const rid = deriveCategoryRid('technology');

    const genesis = makePublication(owner, {
      communityId: 'comm-rev', contentId: 'content-rev', title: 'Rev', description: 'rust rev',
    });
    const rev2 = revisePublication(owner, genesis, { title: 'Rev v2' }, '2026-06-20T00:01:00.000Z');
    // A standalone revision (revision 2, no predecessor) cannot be chain-verified ->
    // verifyPublication !== 'ok' -> never stored as a publication.
    await node.announce('5.5.5.5', rid, JSON.stringify(rev2));
    expect((await node.stats()).publications).toBe(0);

    // An unpublished genesis-shaped record is likewise not served as active.
    const pulled = unpublish(owner, genesis, '2026-06-20T00:02:00.000Z');
    await node.announce('5.5.5.5', rid, JSON.stringify(pulled));
    expect((await node.stats()).publications).toBe(0);
  });

  it('FF1: an owner takedown at revision >= 3 removes the publication; a non-owner forgery does not', async () => {
    const owner = generateDeviceIdentity('Publisher');
    const attacker = generateDeviceIdentity('Attacker');
    const node = new PublicDirectoryNode({ now: () => NOW });
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1' });
    const rid = deriveCategoryRid('technology');
    const opts = { communityId: 'comm-ff1', contentId: 'content-ff1', title: 'FF1', description: 'rust ff1' };

    const genesis = makePublication(owner, opts);
    await node.announce('1.1.1.1', rid, JSON.stringify(genesis));
    expect((await node.stats()).publications).toBe(1);

    // Revise to revision 3, then unpublish at revision 4. The directory only stored
    // the genesis; the old chained verify rejected a rev-4 unpublish (state divergence).
    const v2 = revisePublication(owner, genesis, { title: 'FF1 v2' }, '2026-06-20T00:01:00.000Z');
    const v3 = revisePublication(owner, v2, { title: 'FF1 v3' }, '2026-06-20T00:02:00.000Z');
    const taken = unpublish(owner, v3, '2026-06-20T00:03:00.000Z');
    expect(taken.descriptor.revision).toBe(4);

    await node.announce('1.1.1.1', rid, JSON.stringify(taken));
    expect((await node.stats()).publications).toBe(0);
    expect(
      await browsePublications({ url: server.url, category: 'technology', webSocketImpl: WS as never }),
    ).toHaveLength(0);

    // C2 (anti-rollback): a third party REPLAYS the original active genesis to try to
    // resurrect the taken-down publication -> the directory IGNORES it (the tombstone
    // rejects revision <= the takedown revision), so browse/trending stay empty.
    await node.announce('1.1.1.1', rid, JSON.stringify(genesis));
    expect((await node.stats()).publications).toBe(0);
    expect(
      await browsePublications({ url: server.url, category: 'technology', webSocketImpl: WS as never }),
    ).toHaveLength(0);

    // A non-owner forgery does NOT take down a DIFFERENT, live publication.
    const liveOpts = { communityId: 'comm-ff1b', contentId: 'content-ff1b', title: 'FF1 live', description: 'still up' };
    const live = makePublication(owner, liveOpts);
    await node.announce('1.1.1.1', rid, JSON.stringify(live));
    expect((await node.stats()).publications).toBe(1);
    const attackerGenesis = makePublication(attacker, liveOpts);
    const attackerTakedown = unpublish(attacker, attackerGenesis, '2026-06-20T00:04:00.000Z');
    const forged = {
      ...attackerTakedown,
      descriptor: { ...attackerTakedown.descriptor, publicationId: live.descriptor.publicationId },
    };
    await node.announce('1.1.1.1', rid, JSON.stringify(forged));
    expect((await node.stats()).publications).toBe(1); // forgery rejected; the live pub survives
  });

  it('rejects malformed and oversized frames (bad_frame / ws close), and unknown verbs', async () => {
    const node = new PublicDirectoryNode({ now: () => NOW });
    // maxFrameBytes is a server option: a frame past it is closed at the ws transport.
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1', maxFrameBytes: 512 });

    // Non-JSON payload -> bad_frame.
    const garbage = await wsRaw(server.url, 'not json at all');
    expect(garbage.reply?.t).toBe('err');
    expect(garbage.reply?.code).toBe('bad_frame');

    // Well-formed JSON but an unknown verb -> bad_frame (zod discriminated-union reject).
    const unknownVerb = await wsRaw(server.url, JSON.stringify({ t: 'nope', rid: 'a'.repeat(32) }));
    expect(unknownVerb.reply?.code).toBe('bad_frame');

    // A frame larger than maxFrameBytes -> the ws server closes the socket (1009),
    // never a normal reply (egress/parse DoS guard at the transport edge).
    const huge = await wsRaw(server.url, JSON.stringify({ t: 'ann', rid: 'a'.repeat(32), rec: 'x'.repeat(4096) }));
    expect(huge.reply).toBeUndefined();
    expect([1009, 1006]).toContain(huge.closeCode);
  });

  it('rejects an over-cap record (too_large) and enforces the global directory_full cap', async () => {
    const owner = generateDeviceIdentity('Publisher');
    // maxRecordChars small enough to trip on a synthetic rec but ABOVE a real
    // publication JSON, so the cap path still accepts genuine records.
    const node = new PublicDirectoryNode({ now: () => NOW, limits: { maxRecordChars: 4096, maxPublications: 1 } });
    const rid = deriveCategoryRid('technology');

    // A rec longer than maxRecordChars is refused BEFORE parse (no work done).
    const big = await node.announce('1.1.1.1', rid, 'x'.repeat(5000));
    expect(big).toEqual({ ok: false, code: 'too_large' });

    // First real publication fits (well under 4096 chars) and fills the global cap of 1.
    const p1 = makePublication(owner, { communityId: 'c1', contentId: 'k1', title: 'One', description: 'one' });
    expect((await node.announce('1.1.1.1', rid, JSON.stringify(p1))).ok).toBe(true);

    // A SECOND distinct publication is over the global cap -> directory_full.
    const p2 = makePublication(owner, { communityId: 'c2', contentId: 'k2', title: 'Two', description: 'two' });
    expect(await node.announce('1.1.1.1', rid, JSON.stringify(p2))).toEqual({ ok: false, code: 'directory_full' });
    expect((await node.stats()).publications).toBe(1);
  });

  it('clamps a huge trend limit (does not echo it back or error)', async () => {
    const owner = generateDeviceIdentity('Publisher');
    const node = new PublicDirectoryNode({ now: () => NOW });
    server = await startPublicDirectoryNode({ node, host: '127.0.0.1' });
    for (const i of [1, 2, 3]) {
      await announcePublication({
        url: server.url,
        signed: makePublication(owner, { communityId: `c${i}`, contentId: `k${i}`, title: `T${i}`, description: `d${i}` }),
        webSocketImpl: WS as never,
      });
    }
    // A limit far past the 200 ceiling is clamped, not echoed: returns only what exists.
    const recs = await trending(server.url, undefined, 100000);
    expect(recs).toHaveLength(3);
  });
});
