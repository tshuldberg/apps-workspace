/**
 * public-snapshot-client: the reader-side PULL helper for public publications
 * (Plan 19 P4). These tests drive fetchPublicSnapshot against a STUB fetch (no
 * community-node process), proving the RN-safe injected-fetch contract, the happy
 * round-trip (manifest -> pieces -> importPublicSnapshot -> verified events), the
 * owner-signed descriptor cross-check, and the fail-closed branches (404 ->
 * not_found, garbage manifest, missing piece, wrong key). The cross-client e2e in
 * @mylife/meerkat-relay proves the SAME helper over real http sockets.
 */

import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../../identity/device-identity';
import { bytesToHex } from '../../encryption/keys';
import { createChannelMessage, type ChannelMessageEvent, type Hlc } from '../../protocol/channel-message';
import { buildPublicSnapshot } from '../../protocol/public-snapshot';
import { createPublication, type SignedPublicationDescriptor } from '../../protocol/publication';
import type { ContentManifest } from '../../types';
import type { SnapshotPieceStore } from '../../protocol/community-snapshots';
import { fetchPublicSnapshot, fetchPublicPage, publicSnapshotKeyFromHex } from '../public-snapshot-client';
import { randomBytes } from 'node:crypto';

const COMMUNITY = 'cm_unit';
const CHANNEL = 'general';
const BASE = 'https://host.example';

class MapStore implements SnapshotPieceStore {
  private readonly m = new Map<string, Uint8Array>();
  private k(h: string, i: number) { return `${h}:${i}`; }
  put(h: string, i: number, b: Uint8Array) { this.m.set(this.k(h, i), b); }
  get(h: string, i: number) { return this.m.get(this.k(h, i)) ?? null; }
  removeContent(h: string) { for (const k of [...this.m.keys()]) if (k.startsWith(`${h}:`)) this.m.delete(k); }
}

interface Fixture {
  signed: SignedPublicationDescriptor;
  publicKey: Uint8Array;
  contentId: string;
  manifest: ContentManifest;
  pieces: Uint8Array[];
  authored: ChannelMessageEvent[];
  ownerId: string;
}

async function build(): Promise<Fixture> {
  const owner = generateDeviceIdentity('Owner');
  const publicKey = new Uint8Array(randomBytes(32));
  const authored = [
    createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: 'a', hlc: { wall: '2026-06-28T00:00:01.000Z', counter: 0 } }),
    createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: 'b', hlc: { wall: '2026-06-28T00:00:02.000Z', counter: 0 } }),
  ];
  const store = new MapStore();
  const record = await buildPublicSnapshot({
    identity: owner, publicationId: 'pending', communityId: COMMUNITY, channelId: CHANNEL,
    events: authored, publicKey, pieceStore: store, now: '2026-06-28T00:00:00.000Z',
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(store.get(record.infoHash, i)!);
  const signed = createPublication(owner, {
    kind: 'channel', communityId: COMMUNITY, channelId: CHANNEL, title: 'T', description: 'd',
    category: 'technology', contentId: record.infoHash, publicKeyHex: bytesToHex(publicKey), now: '2026-06-28T00:00:00.000Z',
  });
  return { signed, publicKey, contentId: record.infoHash, manifest, pieces, authored, ownerId: owner.publicKey };
}

/** A stub fetch that serves the community-node public wire shape from memory. */
function stubFetch(
  fx: Fixture,
  opts: { manifestStatus?: number; missingPieceIndex?: number; badManifest?: boolean; descriptor?: SignedPublicationDescriptor } = {},
): typeof fetch {
  const manifestUrl = `${BASE}/public/${fx.signed.descriptor.publicationId}/manifest`;
  return (async (url: string | URL) => {
    const u = String(url);
    if (u === manifestUrl) {
      const status = opts.manifestStatus ?? 200;
      const payload = {
        publicationId: fx.signed.descriptor.publicationId,
        status: 'active',
        communityId: COMMUNITY,
        channelId: CHANNEL,
        contentId: fx.contentId,
        descriptor: opts.descriptor ?? fx.signed,
        snapshots: [{ channelId: CHANNEL, epoch: 0, manifest: opts.badManifest ? 'not json' : JSON.stringify(fx.manifest) }],
      };
      return { status, ok: status === 200, json: async () => payload } as Response;
    }
    const m = u.match(/\/public\/[^/]+\/[0-9a-f]+\/(\d+)$/);
    if (m) {
      const idx = Number(m[1]);
      if (opts.missingPieceIndex === idx) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
      const bytes = fx.pieces[idx]!;
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as Response;
    }
    return { ok: false, status: 404, json: async () => null, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  }) as typeof fetch;
}

function binding(fx: Fixture) {
  return {
    baseUrl: BASE,
    publicationId: fx.signed.descriptor.publicationId,
    publicKey: publicSnapshotKeyFromHex(fx.signed.descriptor.publicKeyHex),
    expectedContentId: fx.contentId,
    expectedAuthor: fx.ownerId,
    channelId: CHANNEL,
  };
}

describe('fetchPublicSnapshot (Plan 19 P4 reader-side pull helper)', () => {
  it('round-trips authored events through manifest + pieces + import (verified)', async () => {
    const fx = await build();
    const result = await fetchPublicSnapshot({ ...binding(fx), fetchFn: stubFetch(fx) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map((e) => e.body)).toEqual(['a', 'b']);
    expect(result.events.map((e) => e.id)).toEqual(fx.authored.map((e) => e.id));
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0]!.channelId).toBe(CHANNEL);
  });

  it('re-derives the published key from descriptor hex', async () => {
    const fx = await build();
    expect(publicSnapshotKeyFromHex(fx.signed.descriptor.publicKeyHex)).toEqual(fx.publicKey);
  });

  it('fails closed: 404 manifest -> not_found', async () => {
    const fx = await build();
    const r = await fetchPublicSnapshot({ ...binding(fx), fetchFn: stubFetch(fx, { manifestStatus: 404 }) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('fails closed: wrong expectedAuthor -> descriptor_mismatch (before any piece pull)', async () => {
    const fx = await build();
    const other = generateDeviceIdentity('Other');
    const r = await fetchPublicSnapshot({ ...binding(fx), expectedAuthor: other.publicKey, fetchFn: stubFetch(fx) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('descriptor_mismatch');
  });

  it('fails closed: wrong expectedContentId -> descriptor_mismatch', async () => {
    const fx = await build();
    const r = await fetchPublicSnapshot({ ...binding(fx), expectedContentId: 'deadbeef'.repeat(8), fetchFn: stubFetch(fx) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('descriptor_mismatch');
  });

  it('fails closed: a missing piece -> missing_piece', async () => {
    const fx = await build();
    const r = await fetchPublicSnapshot({ ...binding(fx), fetchFn: stubFetch(fx, { missingPieceIndex: 0 }) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('missing_piece');
  });

  it('fails closed: a non-JSON snapshot manifest -> bad_manifest', async () => {
    const fx = await build();
    const r = await fetchPublicSnapshot({ ...binding(fx), fetchFn: stubFetch(fx, { badManifest: true }) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_manifest');
  });

  it('fails closed: a wrong public key cannot decrypt + verify the snapshot', async () => {
    const fx = await build();
    const r = await fetchPublicSnapshot({ ...binding(fx), publicKey: new Uint8Array(randomBytes(32)), fetchFn: stubFetch(fx) });
    expect(r.ok).toBe(false);
  });

  it('fails closed: a channel not present in the manifest -> no_matching_channel', async () => {
    const fx = await build();
    const r = await fetchPublicSnapshot({ ...binding(fx), channelId: 'nope', fetchFn: stubFetch(fx) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_matching_channel');
  });

  it('fails closed: a TAMPERED descriptor (mutated display field, bound id/owner/contentId) -> descriptor_unverified', async () => {
    const fx = await build();
    // Keep the bound id/owner/contentId so the cheap cross-check passes, but mutate a
    // signature-covered DISPLAY field WITHOUT re-signing: verifyPublication fails closed
    // (a genesis id-derivation that no longer matches), so the tampered title never
    // reaches the UI and no events are returned.
    const tampered: SignedPublicationDescriptor = {
      descriptor: { ...fx.signed.descriptor, title: 'HIJACKED TITLE' },
      signature: fx.signed.signature,
    };
    const r = await fetchPublicSnapshot({ ...binding(fx), fetchFn: stubFetch(fx, { descriptor: tampered }) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('descriptor_unverified');
    // The helper never surfaces the tampered descriptor on a failure.
    expect(r).not.toHaveProperty('descriptor');
  });
});

// --- FF2 warm-tail: sinceHlc on the full fetch + the incremental page client ---

const HLC1: Hlc = { wall: '2026-06-28T00:00:01.000Z', counter: 0 };

/** A stub fetch for the OPEN page route, serving signed events after a cursor. */
function pageStub(events: ChannelMessageEvent[], opts: { status?: number; hasMore?: boolean } = {}): typeof fetch {
  return (async (url: string | URL) => {
    const u = new URL(String(url));
    const status = opts.status ?? 200;
    if (status !== 200) return { status, ok: false, json: async () => ({ reason: 'x' }) } as Response;
    const after = u.searchParams.get('after');
    let out = events;
    if (after) {
      const idx = after.lastIndexOf('.');
      const cursor = { wall: after.slice(0, idx), counter: Number(after.slice(idx + 1)) };
      out = events.filter((e) => e.hlc.wall > cursor.wall || (e.hlc.wall === cursor.wall && e.hlc.counter > cursor.counter));
    }
    const last = out[out.length - 1];
    return {
      status: 200, ok: true,
      json: async () => ({ events: out, nextCursor: last ? `${last.hlc.wall}.${last.hlc.counter}` : null, hasMore: opts.hasMore ?? false }),
    } as Response;
  }) as typeof fetch;
}

describe('fetchPublicSnapshot sinceHlc (FF2 warm tail)', () => {
  it('returns ONLY events strictly after the cursor', async () => {
    const fx = await build();
    const full = await fetchPublicSnapshot({ ...binding(fx), fetchFn: stubFetch(fx) });
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    expect(full.events.map((e) => e.body)).toEqual(['a', 'b']);

    const tail = await fetchPublicSnapshot({ ...binding(fx), sinceHlc: HLC1, fetchFn: stubFetch(fx) });
    expect(tail.ok).toBe(true);
    if (!tail.ok) return;
    expect(tail.events.map((e) => e.body)).toEqual(['b']); // 'a' (== cursor) is excluded
  });
});

describe('fetchPublicPage (FF2 incremental, fail-closed)', () => {
  const pageBinding = (fx: Fixture) => ({
    baseUrl: BASE, publicationId: fx.signed.descriptor.publicationId,
    channelId: CHANNEL, expectedCommunityId: COMMUNITY,
  });

  it('returns verified events strictly after the cursor + reports hasMore', async () => {
    const fx = await build();
    const r = await fetchPublicPage({ ...pageBinding(fx), after: HLC1, fetchFn: pageStub(fx.authored, { hasMore: true }) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events.map((e) => e.body)).toEqual(['b']); // 'a' is at the cursor
    expect(r.hasMore).toBe(true);
  });

  it('drops a tampered event (author signature fails) -- never trusts the node', async () => {
    const fx = await build();
    const tampered = { ...fx.authored[1]!, body: 'evil' };
    const r = await fetchPublicPage({ ...pageBinding(fx), fetchFn: pageStub([fx.authored[0]!, tampered]) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events.map((e) => e.body)).toEqual(['a']); // the tampered 'b' is dropped
  });

  it('drops an event scoped to a different community/channel', async () => {
    const fx = await build();
    const other = generateDeviceIdentity('Other');
    const wrongCommunity = createChannelMessage(other, { communityId: 'cm_other', channelId: CHANNEL, body: 'leak', hlc: { wall: '2026-06-28T00:00:09.000Z', counter: 0 } });
    const r = await fetchPublicPage({ ...pageBinding(fx), fetchFn: pageStub([fx.authored[0]!, wrongCommunity]) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events.map((e) => e.body)).toEqual(['a']); // the foreign-community event is dropped
  });

  it('maps 404 -> not_found and 400 -> bad_cursor', async () => {
    const fx = await build();
    expect((await fetchPublicPage({ ...pageBinding(fx), fetchFn: pageStub([], { status: 404 }) }))).toEqual({ ok: false, reason: 'not_found' });
    expect((await fetchPublicPage({ ...pageBinding(fx), fetchFn: pageStub([], { status: 400 }) }))).toEqual({ ok: false, reason: 'bad_cursor' });
  });
});
