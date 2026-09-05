/**
 * Public snapshot PULL client (Plan 19, Meerkat Public Social Layer -- P4).
 *
 * The reader-side counterpart to the community node's OPEN public serving routes
 * (`community-node-http.ts`: GET /public/{id}/manifest and /{infoHash}/{index}).
 * Given a community-node base url + a publicationId discovered from the public
 * directory, plus the owner-signed binding the directory entry already carries
 * (expectedAuthor = descriptor.ownerDeviceId, expectedContentId = descriptor.contentId,
 * publicKey re-derived from descriptor.publicKeyHex), it:
 *   1. fetches the OPEN manifest (no auth -- reading is anonymous),
 *   2. cross-checks the served descriptor against the caller's binding AND verifies
 *      its owner signature (verifyPublication), so a host serving a DIFFERENT or a
 *      TAMPERED descriptor is rejected before any piece pull -- and the returned
 *      descriptor's DISPLAY fields (title/description/category/joinPolicy/updatedAt)
 *      are signature-safe for the UI to render directly,
 *   3. pulls every opaque snapshot piece over HTTP into a local store, and
 *   4. runs importPublicSnapshot FAIL-CLOSED, binding expectedContentId +
 *      expectedAuthor, so a holder of the non-secret public key cannot substitute
 *      self-signed content for the owner's.
 *
 * It returns ONLY the verified events the host's bytes actually carry; any
 * fetch/parse/verify failure fails closed with an honest reason. The cryptographic
 * gate is importPublicSnapshot's expectedAuthor binding (the snapshot signer is
 * signature-verified and must equal the owner), not the host's word.
 *
 * RN-safe: fetchFn is injected (defaults to the platform global fetch); no
 * node:http / node:crypto import at module load, so it runs unchanged on Hermes,
 * mirroring fetchCatalogFromWebSeed (torrent/web-seed.ts) and feed-node-client.ts.
 */

import type { ContentManifest } from '../types';
import { hexToBytes } from '../encryption/keys';
import {
  importPublicSnapshot,
  type ImportPublicSnapshotResult,
} from '../protocol/public-snapshot';
import { hlcAfter, type SnapshotPieceStore } from '../protocol/community-snapshots';
import { verifyChannelMessage, type ChannelMessageEvent, type Hlc } from '../protocol/channel-message';
import { verifyPublication, type SignedPublicationDescriptor } from '../protocol/publication';
import { verifyPublicPost, type AcceptedPublicPost } from '../protocol/public-post';

/** The OPEN /public/{id}/manifest payload shape (mirrors PublicationManifestPayload). */
interface PublicManifestPayload {
  publicationId: string;
  status: string;
  communityId: string;
  channelId: string | null;
  contentId: string;
  descriptor: SignedPublicationDescriptor;
  /** Each `manifest` is the JSON string the reader parses back into a ContentManifest. */
  snapshots: { channelId: string; epoch: number; manifest: string }[];
}

export interface FetchPublicSnapshotInput {
  /** The community-node base url (no trailing slash needed). */
  baseUrl: string;
  /** The publicationId discovered from the directory. */
  publicationId: string;
  /** The publication's PUBLISHED read key (re-derived from descriptor.publicKeyHex). */
  publicKey: Uint8Array;
  /** The owner-signed descriptor.contentId. Bound fail-closed in import. */
  expectedContentId: string;
  /** The owner-signed descriptor.ownerDeviceId. Bound fail-closed in import. */
  expectedAuthor: string;
  /** Restrict the pull to one channel snapshot; default pulls every snapshot served. */
  channelId?: string;
  /**
   * Warm-tail cursor (FF2): when set, the imported events are only those strictly
   * AFTER this HLC, so a reader that already holds the older snapshot does not
   * re-process the full set on every focus. Applied to every pulled channel.
   */
  sinceHlc?: Hlc | null;
  /**
   * Per-channel warm-tail cursors (FF2): overrides `sinceHlc` for the named channel.
   * A multi-channel publication advances each channel's reader cursor independently.
   */
  sinceHlcByChannel?: Record<string, Hlc>;
  /** Injected for RN-safety + tests; defaults to the platform global fetch. */
  fetchFn?: typeof fetch;
}

export interface PublicSnapshotChannelResult {
  channelId: string;
  /** The verified, resolved-order events for this channel. */
  events: ChannelMessageEvent[];
}

export type FetchPublicSnapshotResult =
  | {
    ok: true;
    /** The descriptor the host served (already cross-checked against the binding). */
    descriptor: SignedPublicationDescriptor;
    /** Per-channel verified events. */
    channels: PublicSnapshotChannelResult[];
    /** All verified events, concatenated in channel-served order (single-channel convenience). */
    events: ChannelMessageEvent[];
  }
  | {
    ok: false;
    reason:
      | 'manifest_failed'
      | 'not_found'
      | 'bad_manifest'
      | 'descriptor_mismatch'
      | 'descriptor_unverified'
      | 'no_matching_channel'
      | 'content_id_mismatch'
      | Extract<ImportPublicSnapshotResult, { ok: false }>['reason'];
  };

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/** A trivial in-memory piece store for one pull; verification happens in import. */
class MapPieceStore implements SnapshotPieceStore {
  private readonly pieces = new Map<string, Uint8Array>();
  private key(infoHash: string, index: number): string {
    return `${infoHash}:${index}`;
  }
  put(infoHash: string, index: number, bytes: Uint8Array): void {
    this.pieces.set(this.key(infoHash, index), bytes);
  }
  get(infoHash: string, index: number): Uint8Array | null {
    return this.pieces.get(this.key(infoHash, index)) ?? null;
  }
  removeContent(infoHash: string): void {
    for (const k of [...this.pieces.keys()]) {
      if (k.startsWith(`${infoHash}:`)) this.pieces.delete(k);
    }
  }
}

async function getManifest(
  fetchFn: typeof fetch,
  base: string,
  publicationId: string,
): Promise<{ status: number; json: unknown }> {
  const res = await fetchFn(`${base}/public/${encodeURIComponent(publicationId)}/manifest`);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function parseManifestPayload(json: unknown): PublicManifestPayload | null {
  if (typeof json !== 'object' || json === null) return null;
  const p = json as Partial<PublicManifestPayload>;
  if (
    typeof p.publicationId !== 'string'
    || typeof p.contentId !== 'string'
    || typeof p.communityId !== 'string'
    || typeof p.descriptor !== 'object'
    || p.descriptor === null
    || !Array.isArray(p.snapshots)
  ) {
    return null;
  }
  return p as PublicManifestPayload;
}

/** Parse one stringified ContentManifest; null on any garbage (fail-closed). */
function parseContentManifest(raw: string): ContentManifest | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const m = parsed as { infoHash?: unknown; pieces?: unknown };
    if (typeof m.infoHash !== 'string' || !Array.isArray(m.pieces)) return null;
    return parsed as ContentManifest;
  } catch {
    return null;
  }
}

/**
 * Fetch + verify a public publication's snapshot(s) from a real serving host. Pulls
 * the manifest and every opaque piece over the OPEN routes, then runs
 * importPublicSnapshot fail-closed with the owner-signed binding so the returned
 * events provably belong to the asked publication. Used by the apps' Discover read
 * path (P5/P6) and the cross-client e2e -- the same client, never a test-only loop.
 */
export async function fetchPublicSnapshot(
  input: FetchPublicSnapshotInput,
): Promise<FetchPublicSnapshotResult> {
  const fetchFn = input.fetchFn ?? (globalThis.fetch?.bind(globalThis) as typeof fetch);
  if (!fetchFn) return { ok: false, reason: 'manifest_failed' };
  const base = trimBase(input.baseUrl);

  // 1. Fetch the OPEN manifest. 404 = unknown / unpublished / killed (honest).
  const manifestRes = await getManifest(fetchFn, base, input.publicationId);
  if (manifestRes.status === 404) return { ok: false, reason: 'not_found' };
  if (manifestRes.status !== 200) return { ok: false, reason: 'manifest_failed' };
  const payload = parseManifestPayload(manifestRes.json);
  if (!payload) return { ok: false, reason: 'bad_manifest' };

  // 2. Cross-check the served descriptor against the caller's verified binding.
  // The cryptographic gate is importPublicSnapshot below; this just fails fast if a
  // host served a DIFFERENT publication under the asked id (no piece pull wasted).
  const d = payload.descriptor.descriptor;
  if (
    payload.publicationId !== input.publicationId
    || d.publicationId !== input.publicationId
    || d.ownerDeviceId !== input.expectedAuthor
    || d.contentId !== input.expectedContentId
  ) {
    return { ok: false, reason: 'descriptor_mismatch' };
  }

  // Defense-in-depth: the events are crypto-bound by importPublicSnapshot regardless,
  // but the descriptor's DISPLAY fields are host-asserted. Verify the owner signature
  // fail-closed so result.descriptor is signature-verified and safe for UI to render;
  // a tampered display field (a mutated title under a real id) breaks verifyPublication.
  if (verifyPublication(payload.descriptor) !== 'ok') {
    return { ok: false, reason: 'descriptor_unverified' };
  }

  // communityId comes from the owner-signed descriptor (not the loose payload field).
  const communityId = d.communityId;
  const wanted = input.channelId
    ? payload.snapshots.filter((s) => s.channelId === input.channelId)
    : payload.snapshots;
  if (wanted.length === 0) return { ok: false, reason: 'no_matching_channel' };

  // 3 + 4. For each snapshot: parse the manifest, pull every piece, import fail-closed.
  const channels: PublicSnapshotChannelResult[] = [];
  let boundToContentId = false;
  for (const snap of wanted) {
    const manifest = parseContentManifest(snap.manifest);
    if (!manifest) return { ok: false, reason: 'bad_manifest' };

    const store = new MapPieceStore();
    for (let index = 0; index < manifest.pieces.length; index += 1) {
      const res = await fetchFn(
        `${base}/public/${encodeURIComponent(input.publicationId)}/${encodeURIComponent(manifest.infoHash)}/${index}`,
      );
      if (!res.ok) return { ok: false, reason: 'missing_piece' };
      store.put(manifest.infoHash, index, new Uint8Array(await res.arrayBuffer()));
    }

    // Bind expectedContentId ONLY on the snapshot whose infoHash is the publication's
    // content id (a single-snapshot publication is the P4/P5 shape); the load-bearing
    // expectedAuthor binding is always enforced so a substituted self-signed snapshot
    // is rejected regardless.
    const matchesContentId = manifest.infoHash === input.expectedContentId;
    if (matchesContentId) boundToContentId = true;
    const imported = await importPublicSnapshot({
      publicationId: input.publicationId,
      communityId,
      channelId: snap.channelId,
      manifest,
      pieceStore: store,
      publicKey: input.publicKey,
      expectedContentId: matchesContentId ? input.expectedContentId : undefined,
      expectedAuthor: input.expectedAuthor,
      // FF2 warm tail: only events strictly after the per-channel (or global) cursor.
      sinceHlc: input.sinceHlcByChannel?.[snap.channelId] ?? input.sinceHlc ?? null,
    });
    if (!imported.ok) return { ok: false, reason: imported.reason };
    // newEvents == the full set when no cursor is given (backward-compatible), or only
    // the events strictly after the FF2 warm-tail cursor when one is.
    channels.push({ channelId: snap.channelId, events: imported.newEvents });
  }

  // At least one pulled snapshot MUST carry the owner-signed contentId, else the host
  // served only author-matching content that is not bound to this publication's id.
  if (!boundToContentId) return { ok: false, reason: 'content_id_mismatch' };

  return {
    ok: true,
    descriptor: payload.descriptor,
    channels,
    events: channels.flatMap((c) => c.events),
  };
}

/** Re-derive a publication's published read key from the descriptor's hex form. */
export function publicSnapshotKeyFromHex(publicKeyHex: string): Uint8Array {
  return hexToBytes(publicKeyHex);
}

// ---------------------------------------------------------------------------
// Warm-tail page client (FF2, section 5.6). The incremental counterpart to the
// full fetchPublicSnapshot: it pulls ONLY the events strictly after a cursor over
// the OPEN page route (GET /public/{id}/{channelId}/page?after={wall}.{counter}),
// so a reader appends the warm tail without re-downloading the whole snapshot. The
// page route returns plaintext signed events; this client NEVER trusts the node --
// it re-verifies EVERY event's author signature, requires the event's community +
// channel to match the (directory-verified) descriptor, and re-applies the strict
// after-cursor filter client-side. The snapshot-level contentId/owner binding lives
// on the full fetchPublicSnapshot path (the reader's initial trust anchor); this
// incremental path adds author + scope verification on top of that anchor.
// ---------------------------------------------------------------------------

export interface FetchPublicPageInput {
  /** The community-node base url (no trailing slash needed). */
  baseUrl: string;
  publicationId: string;
  channelId: string;
  /** The owner-signed descriptor.communityId; every event MUST match it (scope bind). */
  expectedCommunityId: string;
  /**
   * The descriptor-pinned node receipt key (descriptor.postNodeKeyHex, Plan 39
   * P4/P5). Required to accept node-mediated PUBLIC POSTS from the page: each is
   * dual-verified (author persona signature + node acceptance receipt against
   * THIS pinned key), fail-closed. Absent/null => every publicPost on the page
   * is dropped (unverifiable = unseen; never rendered on the node's word).
   */
  pinnedNodeKeyHex?: string | null;
  /** Pull events strictly AFTER this HLC. null/absent = from genesis. */
  after?: Hlc | null;
  /** Page size (the node clamps to [1, 200]). */
  limit?: number;
  fetchFn?: typeof fetch;
}

export type FetchPublicPageResult =
  | {
    ok: true;
    events: ChannelMessageEvent[];
    /** Dual-verified node-accepted public posts (Plan 39 P6), receipt-HLC order. */
    publicPosts: AcceptedPublicPost[];
    /**
     * The node's cursor for the NEXT pull. Readers persist THIS rather than a
     * cursor derived from events alone: a page containing only public posts must
     * still advance (otherwise the reader re-pulls the same page forever).
     */
    nextCursor: Hlc | null;
    hasMore: boolean;
  }
  | { ok: false; reason: 'fetch_failed' | 'not_found' | 'bad_cursor' | 'bad_page' };

interface PublicPageWire {
  events?: unknown[];
  publicPosts?: unknown[];
  nextCursor?: unknown;
  hasMore?: unknown;
}

/** Parse the node's `{wall}.{counter}` cursor string; null on any malformation. */
function parseWireCursor(raw: unknown): Hlc | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const idx = raw.lastIndexOf('.');
  if (idx <= 0 || idx === raw.length - 1) return null;
  const counter = Number(raw.slice(idx + 1));
  if (!Number.isInteger(counter) || counter < 0) return null;
  return { wall: raw.slice(0, idx), counter };
}

/**
 * Fetch one warm-tail page of a public channel, fail-closed. Returns only the events
 * that (1) verify against their author signature, (2) are scoped to the expected
 * community + the requested channel, and (3) are strictly after the requested cursor;
 * plus the node-accepted public posts that DUAL-verify (author + pinned-node receipt).
 * `hasMore` reflects the node's report so the caller can keep paging.
 */
export async function fetchPublicPage(input: FetchPublicPageInput): Promise<FetchPublicPageResult> {
  const fetchFn = input.fetchFn ?? (globalThis.fetch?.bind(globalThis) as typeof fetch);
  if (!fetchFn) return { ok: false, reason: 'fetch_failed' };
  const base = trimBase(input.baseUrl);
  const params = new URLSearchParams();
  if (input.after) params.set('after', `${input.after.wall}.${input.after.counter}`);
  if (typeof input.limit === 'number') params.set('limit', String(input.limit));
  const qs = params.toString();
  const url = `${base}/public/${encodeURIComponent(input.publicationId)}/${encodeURIComponent(input.channelId)}/page${qs ? `?${qs}` : ''}`;

  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    return { ok: false, reason: 'fetch_failed' };
  }
  if (res.status === 404) return { ok: false, reason: 'not_found' };
  if (res.status === 400) return { ok: false, reason: 'bad_cursor' };
  if (res.status !== 200) return { ok: false, reason: 'fetch_failed' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, reason: 'bad_page' };
  }
  if (typeof json !== 'object' || json === null) return { ok: false, reason: 'bad_page' };
  const payload = json as PublicPageWire;
  if (!Array.isArray(payload.events)) return { ok: false, reason: 'bad_page' };

  const after = input.after ?? null;
  const events: ChannelMessageEvent[] = [];
  for (const raw of payload.events) {
    if (typeof raw !== 'object' || raw === null) continue;
    const ev = raw as ChannelMessageEvent;
    // Scope bind to the directory-verified descriptor, then verify the author signature,
    // then re-apply the after-cursor filter. Any failure drops the single event.
    if (ev.communityId !== input.expectedCommunityId) continue;
    if (ev.channelId !== input.channelId) continue;
    if (after && !hlcAfter(ev.hlc, after)) continue;
    if (!verifyChannelMessage(ev)) continue;
    events.push(ev);
  }

  // Node-accepted public posts (Plan 39 P6): each must DUAL-verify against the
  // DESCRIPTOR-pinned node key with the publication/channel scope bound, then
  // pass the strict after-cursor filter on the receipt's node-assigned HLC. No
  // pinned key = no verifiable posts (fail-closed drop). Never trusts the node.
  const publicPosts: AcceptedPublicPost[] = [];
  if (input.pinnedNodeKeyHex && Array.isArray(payload.publicPosts)) {
    for (const raw of payload.publicPosts) {
      if (typeof raw !== 'object' || raw === null) continue;
      const accepted = raw as AcceptedPublicPost;
      if (verifyPublicPost(accepted, input.pinnedNodeKeyHex, {
        publicationId: input.publicationId,
        channelId: input.channelId,
      }) !== 'ok') {
        continue;
      }
      if (after && !hlcAfter(accepted.receipt.hlc, after)) continue;
      publicPosts.push(accepted);
    }
  }
  return {
    ok: true,
    events,
    publicPosts,
    nextCursor: parseWireCursor(payload.nextCursor),
    hasMore: payload.hasMore === true,
  };
}
