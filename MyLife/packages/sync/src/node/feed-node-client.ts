/**
 * Community feed PULL client (community feed P2, design sections 4.1 + 6 + 7).
 *
 * The member-side counterpart to the always-on community node. It authenticates
 * to the node with a per-member signed challenge, pulls the AUTH'd manifest
 * (descriptor + per-channel snapshot manifests + the sealed live tail), fetches
 * the opaque snapshot pieces over HTTP, then locally:
 *   - reuses P1 importSnapshotFromPieces to verify + decrypt each channel's
 *     rolling snapshot with the epoch key (the cold-start body), and
 *   - opens each sealed TAIL entry with the epoch content key and runs the INNER
 *     verifyChannelMessage check (the node could only verify the outer
 *     over-ciphertext signature; the puller is the one that decrypts).
 *
 * Honesty: this returns ONLY what the HTTP responses actually carry. A 401 is
 * surfaced verbatim (not_member / expired / ...); a fetch failure fails closed.
 * It never claims a status the node cannot prove. fetchFn is injected so the
 * client stays RN-safe and unit-testable.
 */

import naclUtil from 'tweetnacl-util';
import type { ContentManifest } from '../types';
import type { DeviceIdentity } from '../types';
import { decrypt, encrypt } from '../encryption/encrypt';
import { hexToBytes } from '../encryption/keys';
import {
  compareChannelMessages,
  verifyChannelMessage,
  type ChannelMessageEvent,
  type Hlc,
} from '../protocol/channel-message';
import { deriveEpochContentKey } from '../protocol/group-keys';
import { signFeedAuth, signSealedTailEntry, type SealedTailEntryFields } from '../protocol/feed-auth';
import type { SealedTailEntry } from '../protocol/feed-auth';
import type { SignedCommunityDescriptor } from '../protocol/community';
import {
  hlcAfter,
  importSnapshotFromPieces,
  parseSnapshotManifest,
  type CommunitySnapshotRecord,
  type SnapshotPieceStore,
} from '../protocol/community-snapshots';

const { encodeBase64 } = naclUtil;

const NONCE_BYTES = 24; // nacl.secretbox.nonceLength
const decoder = new TextDecoder();

/** The AUTH'd /manifest payload the community node returns (no piece bytes). */
export interface FeedManifestSnapshotEntry {
  channelId: string;
  /** ContentManifest JSON (parsed leniently by parseSnapshotManifest). */
  manifest: unknown;
  /** The rolling-snapshot record metadata (carries epoch + infoHash). */
  record: { epoch: number; infoHash: string };
}

export interface FeedManifestPayload {
  descriptor: unknown;
  snapshots: FeedManifestSnapshotEntry[];
  tail: SealedTailEntry[];
}

/** This device's unwrapped current epoch key (number + secret). */
export interface EpochKeyHandle {
  epoch: number;
  secret: Uint8Array;
}

export interface PullCommunityFeedInput {
  /** The community node base url (no trailing slash needed). */
  baseUrl: string;
  communityId: string;
  identity: DeviceIdentity;
  fetchFn?: typeof fetch;
  /** Returns this device's epoch key, or null when it does not hold one. */
  getEpochKey: () => EpochKeyHandle | null;
  /**
   * Optional OLDER epoch keys this device still holds. A tail entry sealed just
   * before a membership rotation carries no epoch tag, so the opener tries the
   * current key first and then each candidate (authenticated decryption makes a
   * wrong key fail safely) instead of silently dropping the delayed event.
   */
  getCandidateEpochKeys?: () => EpochKeyHandle[];
  /** Per-channel events the device already has (for newEvents accounting). */
  existingEventsByChannel?: Record<string, readonly ChannelMessageEvent[]>;
  /** Per-channel warm cursor; only events strictly after it count as new. */
  cursorByChannel?: Record<string, Hlc | null>;
  /**
   * Optional hosted-entitlement bearer for first-party nodes that gate every
   * route (requireHostedEntitlement). Self-hosted nodes without the gate ignore
   * it. Sent as `Authorization: Bearer` on EVERY request including /challenge
   * and the piece fetches (the gate runs on all of them).
   */
  entitlementToken?: string;
  now?: string;
}

export interface PullCommunityFeedChannelResult {
  channelId: string;
  /** Full resolved-order event set for the channel after this pull. */
  events: ChannelMessageEvent[];
  /** Events strictly after the channel cursor (the warm delta). */
  newEvents: ChannelMessageEvent[];
}

export type PullCommunityFeedResult =
  | { ok: true; channels: PullCommunityFeedChannelResult[] }
  | {
    ok: false;
    reason:
      | 'no_epoch_key'
      | 'challenge_failed'
      | 'auth_rejected'
      | 'manifest_failed'
      | 'bad_manifest'
      | string;
  };

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Merge the optional hosted-entitlement bearer into a header set. */
function withBearer(
  headers: Record<string, string>,
  entitlementToken: string | undefined,
): Record<string, string> {
  if (!entitlementToken) return headers;
  return { ...headers, authorization: `Bearer ${entitlementToken}` };
}

async function getJson(
  fetchFn: typeof fetch,
  url: string,
  headers?: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  // Never throws: a rejected fetch (server died after a health probe, DNS,
  // abort) is a typed failure, so every caller keeps its documented {ok:false}
  // result instead of surfacing an unhandled rejection.
  try {
    const res = await fetchFn(url, headers ? { headers } : undefined);
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

async function getBytes(fetchFn: typeof fetch, url: string, headers: Record<string, string>): Promise<Uint8Array | null> {
  try {
    const res = await fetchFn(url, { headers });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/**
 * Open one sealed tail entry's bytes and recover the verified inner event. The
 * entry carries no epoch tag, so the CURRENT key is tried first and then each
 * older candidate this device still holds (a wrong key fails authentication
 * safely) -- a delayed pre-rotation append is recovered, never silently dropped.
 */
function openTailEvent(
  entry: SealedTailEntry,
  epochKeys: readonly EpochKeyHandle[],
  communityId: string,
): ChannelMessageEvent | null {
  let sealed: Uint8Array;
  try {
    sealed = hexToBytes(entry.sealedHex);
  } catch {
    return null;
  }
  if (sealed.length <= NONCE_BYTES) return null;
  const nonce = sealed.slice(0, NONCE_BYTES);
  const ciphertext = sealed.slice(NONCE_BYTES);

  for (const epochKey of epochKeys) {
    const contentKey = deriveEpochContentKey(epochKey.secret, communityId, epochKey.epoch);
    const plaintext = decrypt(ciphertext, nonce, contentKey);
    if (!plaintext) continue;

    let event: ChannelMessageEvent;
    try {
      event = JSON.parse(decoder.decode(plaintext)) as ChannelMessageEvent;
    } catch {
      return null;
    }
    // INNER check: the puller decrypted, so it verifies the real author signature
    // over the decrypted event (the node could only verify the outer signature).
    if (event.communityId !== communityId || event.channelId !== entry.channelId) return null;
    if (!verifyChannelMessage(event)) return null;
    return event;
  }
  return null;
}

/**
 * Authenticate to a community node and pull its full encrypted feed, decrypting
 * locally. Returns the per-channel resolved events + the warm delta. Fails
 * closed on any auth/fetch/parse failure; surfaces a 401 reason verbatim.
 */
export async function pullCommunityFeed(input: PullCommunityFeedInput): Promise<PullCommunityFeedResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const base = trimBase(input.baseUrl);
  const epochKey = input.getEpochKey();
  if (!epochKey) return { ok: false, reason: 'no_epoch_key' };

  // 1. Challenge.
  const challengeUrl = `${base}/community/${encodeURIComponent(input.communityId)}/challenge`;
  const challenge = await getJson(
    fetchFn,
    challengeUrl,
    input.entitlementToken ? withBearer({}, input.entitlementToken) : undefined,
  );
  if (!challenge.ok || typeof challenge.json !== 'object' || challenge.json === null) {
    return { ok: false, reason: 'challenge_failed' };
  }
  const { nonce } = challenge.json as { nonce?: unknown };
  if (typeof nonce !== 'string') return { ok: false, reason: 'challenge_failed' };

  // 2. Sign + fetch the AUTH'd manifest.
  const ts = input.now ?? new Date().toISOString();
  const signature = signFeedAuth(input.identity, { communityId: input.communityId, nonce, ts });
  const authHeaders: Record<string, string> = withBearer({
    'x-mk-device': input.identity.publicKey,
    'x-mk-nonce': nonce,
    'x-mk-ts': ts,
    'x-mk-sig': signature,
  }, input.entitlementToken);

  const manifestUrl = `${base}/community/${encodeURIComponent(input.communityId)}/manifest`;
  const manifestRes = await getJson(fetchFn, manifestUrl, authHeaders);
  if (manifestRes.status === 401) {
    const reason = (manifestRes.json as { reason?: unknown })?.reason;
    return { ok: false, reason: typeof reason === 'string' ? reason : 'auth_rejected' };
  }
  if (!manifestRes.ok || typeof manifestRes.json !== 'object' || manifestRes.json === null) {
    return { ok: false, reason: 'manifest_failed' };
  }
  const payload = manifestRes.json as FeedManifestPayload;
  if (!Array.isArray(payload.snapshots)) return { ok: false, reason: 'bad_manifest' };

  // 3. Per channel: fetch pieces -> import snapshot (verify + decrypt) + open tail.
  const tailByChannel = new Map<string, SealedTailEntry[]>();
  for (const entry of Array.isArray(payload.tail) ? payload.tail : []) {
    const list = tailByChannel.get(entry.channelId) ?? [];
    list.push(entry);
    tailByChannel.set(entry.channelId, list);
  }
  const openKeys: EpochKeyHandle[] = [epochKey, ...(input.getCandidateEpochKeys?.() ?? [])];

  const channels: PullCommunityFeedChannelResult[] = [];
  for (const snap of payload.snapshots) {
    const manifest = parseSnapshotManifest(
      typeof snap.manifest === 'string' ? snap.manifest : JSON.stringify(snap.manifest),
    );
    if (!manifest) continue;

    // Pull the opaque pieces over the per-member auth gate into a local store.
    const localStore = new MapPieceStore();
    const fetched = await fetchPieces(fetchFn, base, input.communityId, manifest, authHeaders, localStore);
    const cursor = input.cursorByChannel?.[snap.channelId] ?? null;

    const eventsById = new Map<string, ChannelMessageEvent>();
    for (const existing of input.existingEventsByChannel?.[snap.channelId] ?? []) {
      eventsById.set(existing.id, existing);
    }

    if (fetched) {
      const imported = await importSnapshotFromPieces({
        communityId: input.communityId,
        channelId: snap.channelId,
        epoch: snap.record.epoch,
        manifest,
        pieceStore: localStore,
        groupKey: epochKey.secret,
        sinceHlc: cursor,
      });
      if (imported.ok) {
        for (const event of imported.events) eventsById.set(event.id, event);
      }
    }

    // Open the sealed tail entries (decrypt + inner verify) and merge.
    for (const entry of tailByChannel.get(snap.channelId) ?? []) {
      const event = openTailEvent(entry, openKeys, input.communityId);
      if (event) eventsById.set(event.id, event);
    }

    const events = [...eventsById.values()].sort(compareChannelMessages);
    const newEvents = cursor ? events.filter((event) => hlcAfter(event.hlc, cursor)) : [...events];
    channels.push({ channelId: snap.channelId, events, newEvents });
  }

  // 4. TAIL-ONLY channels: a channel that was empty at publish time has no
  // snapshot entry, but members may have appended live-tail events since.
  // Iterating only payload.snapshots would silently drop them -- open these
  // channels' tails too, with the same existing/cursor accounting.
  const snapshotChannelIds = new Set(channels.map((channel) => channel.channelId));
  for (const [channelId, entries] of [...tailByChannel.entries()]) {
    if (snapshotChannelIds.has(channelId)) continue;
    const cursor = input.cursorByChannel?.[channelId] ?? null;
    const eventsById = new Map<string, ChannelMessageEvent>();
    for (const existing of input.existingEventsByChannel?.[channelId] ?? []) {
      eventsById.set(existing.id, existing);
    }
    for (const entry of entries) {
      const event = openTailEvent(entry, openKeys, input.communityId);
      if (event) eventsById.set(event.id, event);
    }
    const events = [...eventsById.values()].sort(compareChannelMessages);
    const newEvents = cursor ? events.filter((event) => hlcAfter(event.hlc, cursor)) : [...events];
    channels.push({ channelId, events, newEvents });
  }

  return { ok: true, channels };
}

/** A trivial in-memory piece store for one channel pull (verify happens in import). */
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

/**
 * Fetch every piece for a manifest over the auth-gated, per-community piece route
 * (P6 item 1): GET /community/{id}/{infoHash}/{index}. The community id scopes the
 * fetch so a member can only read pieces belonging to that community's snapshots.
 */
async function fetchPieces(
  fetchFn: typeof fetch,
  base: string,
  communityId: string,
  manifest: ContentManifest,
  authHeaders: Record<string, string>,
  store: SnapshotPieceStore,
): Promise<boolean> {
  for (let index = 0; index < manifest.pieces.length; index += 1) {
    const url = `${base}/community/${encodeURIComponent(communityId)}/${encodeURIComponent(manifest.infoHash)}/${index}`;
    const bytes = await getBytes(fetchFn, url, authHeaders);
    if (!bytes) return false;
    await store.put(manifest.infoHash, index, bytes);
  }
  return true;
}

// ---------------------------------------------------------------------------
// republishCommunityDescriptor (Plan 28 P3): descriptor-only owner publish.
// ---------------------------------------------------------------------------

export interface RepublishCommunityDescriptorInput {
  /** The community node base url (http(s)). */
  baseUrl: string;
  /** This device's identity; the node accepts a publish ONLY from the descriptor's owner. */
  identity: DeviceIdentity;
  /** The signed descriptor revision to publish (e.g. a member removal). */
  descriptor: SignedCommunityDescriptor;
  fetchFn?: typeof fetch;
  /** Optional hosted-entitlement bearer (see PullCommunityFeedInput). */
  entitlementToken?: string;
  /** ISO timestamp for the auth signature (test injection). */
  now?: string;
}

export type RepublishCommunityDescriptorResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Republish an owner-signed descriptor revision to a community node with NO
 * snapshot payload (`snapshots: []`): the node chain-verifies the revision off
 * its stored predecessor (or the owner signature standalone), enforces durable
 * revision monotonicity, and updates the roster it gates feed challenges with.
 * After a member-removal republish, the removed device's next feed pull returns
 * not_member (AC-3). Fail-closed: any challenge/auth/publish failure is
 * reported honestly, never claimed as a republish.
 */
export async function republishCommunityDescriptor(
  input: RepublishCommunityDescriptorInput,
): Promise<RepublishCommunityDescriptorResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const base = trimBase(input.baseUrl);
  const communityId = input.descriptor.descriptor.communityId;

  try {
    // 1. Challenge (single-use nonce).
    const challengeUrl = `${base}/community/${encodeURIComponent(communityId)}/challenge`;
    const challenge = await getJson(
      fetchFn,
      challengeUrl,
      input.entitlementToken ? withBearer({}, input.entitlementToken) : undefined,
    );
    if (!challenge.ok || typeof challenge.json !== 'object' || challenge.json === null) {
      return { ok: false, reason: 'challenge_failed' };
    }
    const { nonce } = challenge.json as { nonce?: unknown };
    if (typeof nonce !== 'string') return { ok: false, reason: 'challenge_failed' };

    // 2. Owner-signed publish with an EMPTY snapshot set (descriptor-only).
    const ts = input.now ?? new Date().toISOString();
    const signature = signFeedAuth(input.identity, { communityId, nonce, ts });
    const res = await fetchFn(`${base}/community/${encodeURIComponent(communityId)}/publish`, {
      method: 'POST',
      headers: withBearer({
        'content-type': 'application/json',
        'x-mk-device': input.identity.publicKey,
        'x-mk-nonce': nonce,
        'x-mk-ts': ts,
        'x-mk-sig': signature,
      }, input.entitlementToken),
      body: JSON.stringify({ descriptor: input.descriptor, snapshots: [] }),
    });
    if (res.ok) return { ok: true };
    let reason = `http_${res.status}`;
    try {
      const body = (await res.json()) as { reason?: unknown };
      if (typeof body?.reason === 'string') reason = body.reason;
    } catch {
      // keep the status-derived reason
    }
    return { ok: false, reason };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'network_error' };
  }
}

// ---------------------------------------------------------------------------
// Community feed WRITERS (Plan 57 W1): the client half the node was waiting for.
// publishCommunityFeed uploads the owner's rolling snapshots; appendCommunityTail
// uploads ONE member-authored sealed live-tail entry. Both are fail-closed and
// never claim a status the HTTP response cannot prove.
// ---------------------------------------------------------------------------

const writeEncoder = new TextEncoder();

/** Run the challenge + feed-auth handshake shared by every write. */
async function feedAuthHandshake(
  fetchFn: typeof fetch,
  base: string,
  communityId: string,
  identity: DeviceIdentity,
  entitlementToken: string | undefined,
  now: string | undefined,
): Promise<{ ok: true; headers: Record<string, string> } | { ok: false; reason: string }> {
  const challengeUrl = `${base}/community/${encodeURIComponent(communityId)}/challenge`;
  const challenge = await getJson(
    fetchFn,
    challengeUrl,
    entitlementToken ? withBearer({}, entitlementToken) : undefined,
  );
  if (!challenge.ok || typeof challenge.json !== 'object' || challenge.json === null) {
    const reason = (challenge.json as { reason?: unknown } | null)?.reason;
    return { ok: false, reason: typeof reason === 'string' ? reason : 'challenge_failed' };
  }
  const { nonce } = challenge.json as { nonce?: unknown };
  if (typeof nonce !== 'string') return { ok: false, reason: 'challenge_failed' };
  const ts = now ?? new Date().toISOString();
  const signature = signFeedAuth(identity, { communityId, nonce, ts });
  return {
    ok: true,
    headers: withBearer({
      'content-type': 'application/json',
      'x-mk-device': identity.publicKey,
      'x-mk-nonce': nonce,
      'x-mk-ts': ts,
      'x-mk-sig': signature,
    }, entitlementToken),
  };
}

/** POST a JSON body to an auth-gated node route; surface the node's reason verbatim. */
async function postJson(
  fetchFn: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetchFn(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) return { ok: true };
    let reason = `http_${res.status}`;
    try {
      const parsed = (await res.json()) as { reason?: unknown };
      if (typeof parsed?.reason === 'string') reason = parsed.reason;
    } catch {
      // keep the status-derived reason
    }
    return { ok: false, reason };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'network_error' };
  }
}

export interface PublishCommunityFeedInput {
  /** The community node base url (http(s)). */
  baseUrl: string;
  /** The OWNER device identity; the node rejects a publish from anyone else. */
  identity: DeviceIdentity;
  /** The current signed descriptor (also the roster the node will auth against). */
  descriptor: SignedCommunityDescriptor;
  /** The rolling-snapshot records to upload (from cm_snapshots / a fresh build). */
  records: readonly CommunitySnapshotRecord[];
  /** The store holding each record's opaque pieces (the build wrote them here). */
  pieceStore: SnapshotPieceStore;
  fetchFn?: typeof fetch;
  /** Optional hosted-entitlement bearer (see PullCommunityFeedInput). */
  entitlementToken?: string;
  now?: string;
}

export type PublishCommunityFeedResult =
  | { ok: true; channels: number }
  | { ok: false; reason: 'bad_manifest' | 'missing_piece' | 'challenge_failed' | string };

/**
 * Publish the owner's descriptor + rolling snapshots to a community node
 * (the write half of pullCommunityFeed). Pieces are read back from the piece
 * store the snapshot build populated and shipped base64-encoded in the exact
 * wire shape decodePublishBody expects. Fail-closed: a missing piece or an
 * unparseable stored manifest aborts BEFORE any bytes are sent, and the node's
 * rejection reason (not_owner / stale_revision / bad_piece / ...) is surfaced
 * verbatim. A 200 means the node accepted and stored this exact revision.
 */
export async function publishCommunityFeed(
  input: PublishCommunityFeedInput,
): Promise<PublishCommunityFeedResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const base = trimBase(input.baseUrl);
  const communityId = input.descriptor.descriptor.communityId;

  // Assemble the full payload BEFORE the challenge so an incomplete local build
  // never consumes a nonce or half-publishes.
  const snapshots: Array<{ channelId: string; epoch: number; manifest: unknown; pieces: string[] }> = [];
  for (const record of input.records) {
    const manifest = parseSnapshotManifest(record.manifestJson);
    if (!manifest) return { ok: false, reason: 'bad_manifest' };
    const pieces: string[] = [];
    for (let index = 0; index < manifest.pieces.length; index += 1) {
      const bytes = await input.pieceStore.get(record.infoHash, index);
      if (!bytes) return { ok: false, reason: 'missing_piece' };
      pieces.push(encodeBase64(bytes));
    }
    snapshots.push({ channelId: record.channelId, epoch: record.epoch, manifest, pieces });
  }

  const handshake = await feedAuthHandshake(
    fetchFn, base, communityId, input.identity, input.entitlementToken, input.now,
  );
  if (!handshake.ok) return { ok: false, reason: handshake.reason };

  const posted = await postJson(
    fetchFn,
    `${base}/community/${encodeURIComponent(communityId)}/publish`,
    handshake.headers,
    { descriptor: input.descriptor, snapshots },
  );
  if (!posted.ok) return posted;
  return { ok: true, channels: snapshots.length };
}

export interface AppendCommunityTailInput {
  /** The community node base url (http(s)). */
  baseUrl: string;
  communityId: string;
  /** The AUTHOR device identity: it seals, outer-signs, and feed-auths as itself. */
  identity: DeviceIdentity;
  /** The locally recorded, already-signed channel message event to append. */
  event: ChannelMessageEvent;
  /** Returns this device's epoch key, or null when it does not hold one. */
  getEpochKey: () => EpochKeyHandle | null;
  fetchFn?: typeof fetch;
  /** Optional hosted-entitlement bearer (see PullCommunityFeedInput). */
  entitlementToken?: string;
  now?: string;
}

export type AppendCommunityTailResult =
  | { ok: true }
  | { ok: false; reason: 'no_epoch_key' | 'scope_mismatch' | 'not_author' | 'challenge_failed' | string };

/**
 * Seal ONE channel message event with the epoch content key (nonce-prefixed
 * secretbox, the exact format openTailEvent opens), outer-sign it as a
 * SealedTailEntry, and append it to the community node's live tail. The node
 * verifies only the outer signature + roster membership; a puller decrypts and
 * runs the inner verifyChannelMessage. Fail-closed: scope or authorship
 * mismatches abort locally, and the node's rejection is surfaced verbatim.
 */
export async function appendCommunityTail(
  input: AppendCommunityTailInput,
): Promise<AppendCommunityTailResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const base = trimBase(input.baseUrl);
  if (input.event.communityId !== input.communityId) return { ok: false, reason: 'scope_mismatch' };
  if (input.event.authorDeviceId !== input.identity.publicKey) return { ok: false, reason: 'not_author' };
  const epochKey = input.getEpochKey();
  if (!epochKey) return { ok: false, reason: 'no_epoch_key' };

  const contentKey = deriveEpochContentKey(epochKey.secret, input.communityId, epochKey.epoch);
  const { ciphertext, nonce } = encrypt(writeEncoder.encode(JSON.stringify(input.event)), contentKey);
  const sealed = new Uint8Array(nonce.length + ciphertext.length);
  sealed.set(nonce, 0);
  sealed.set(ciphertext, nonce.length);

  const fields: SealedTailEntryFields = {
    communityId: input.communityId,
    channelId: input.event.channelId,
    authorDeviceId: input.event.authorDeviceId,
    hlcWall: input.event.hlc.wall,
    hlcCounter: input.event.hlc.counter,
  };
  const entry = signSealedTailEntry(input.identity, fields, sealed);

  const handshake = await feedAuthHandshake(
    fetchFn, base, input.communityId, input.identity, input.entitlementToken, input.now,
  );
  if (!handshake.ok) return { ok: false, reason: handshake.reason };

  return postJson(
    fetchFn,
    `${base}/community/${encodeURIComponent(input.communityId)}/append`,
    handshake.headers,
    entry,
  );
}
