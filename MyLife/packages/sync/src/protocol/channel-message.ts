import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';

const encoder = new TextEncoder();

/** A hybrid logical clock stamp: wall time plus a per-author monotonic counter. */
export interface Hlc {
  wall: string;
  counter: number;
}

/** Signed attachment metadata. Bytes are synced separately by blob_hash rows. */
export interface ChannelMessageAttachment {
  id: string;
  blobHash: string;
  name: string;
  mimeType: string;
  size: number;
}

/** Provenance of a signed event's author. */
export type MessageAuthorKind = 'human' | 'agent';

/** Intent of a v2 event; drives feed, attention, and agent dispatch in later plans. */
export type ChannelMessageIntent =
  | 'message'
  | 'react'
  | 'resolve'
  | 'agent_task'
  | 'agent_result';

/** An immutable, sender-signed channel message event (D15; v2 adds post/threading). */
export interface ChannelMessageEvent {
  version: 1 | 2;
  /** Content hash of the signed body and signature. */
  id: string;
  communityId: string;
  channelId: string;
  /** Ed25519 device id. */
  authorDeviceId: string;
  body: string;
  attachments?: ChannelMessageAttachment[];
  hlc: Hlc;
  /** If set, this event edits or tombstones a prior message id. */
  supersedes?: { id: string; deleted: boolean };
  // --- v2-only, all optional, all signature-covered (canonicalized ONLY when version === 2) ---
  /** Root post this event belongs to (the bump target). */
  postId?: string;
  /** Exact message replied to (post id | comment id | reply id): addressability. */
  parentId?: string;
  /** Branch this reply files under (defaults to nearest level-1 comment): render legibility. */
  branchId?: string;
  /** Provenance of the signer. */
  authorKind?: MessageAuthorKind;
  /** Addressed deviceIds (humans or agents): drives attention + agent dispatch. */
  mentions?: string[];
  /** Event intent. */
  intent?: ChannelMessageIntent;
  /** Hex Ed25519 signature over the canonical event form. */
  signature: string;
}

export type ChannelMessageInput = Omit<
  ChannelMessageEvent,
  'version' | 'id' | 'authorDeviceId' | 'signature'
>;

type UnsignedChannelMessageEvent = Omit<ChannelMessageEvent, 'id' | 'signature'>;
type SignedChannelMessageWithoutId = Omit<ChannelMessageEvent, 'id'>;

function canonicalAttachments(
  attachments: readonly ChannelMessageAttachment[] | undefined,
): Array<[string, string, string, string, number]> {
  return (attachments ?? []).map((attachment) => [
    attachment.id,
    attachment.blobHash,
    attachment.name,
    attachment.mimeType,
    attachment.size,
  ]);
}

function canonicalChannelMessage(message: UnsignedChannelMessageEvent): Uint8Array {
  const base: unknown[] = [
    message.version === 2 ? 'meerkat-channel-message-v2' : 'meerkat-channel-message-v1',
    message.version,
    message.communityId,
    message.channelId,
    message.authorDeviceId,
    message.body,
    canonicalAttachments(message.attachments),
    message.hlc.wall,
    message.hlc.counter,
    message.supersedes ? [message.supersedes.id, message.supersedes.deleted] : null,
  ];
  if (message.version === 2) {
    base.push([
      message.postId ?? null,
      message.parentId ?? null,
      message.branchId ?? null,
      message.authorKind ?? null,
      message.mentions ?? [],
      message.intent ?? null,
    ]);
  }
  return encoder.encode(JSON.stringify(base));
}

/** Content id = hash of the signed canonical form plus the signature. */
export function channelMessageId(message: SignedChannelMessageWithoutId): string {
  const { signature, ...unsigned } = message;
  const canonical = canonicalChannelMessage(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

function buildChannelMessage(
  author: DeviceIdentity,
  input: ChannelMessageInput,
  version: 1 | 2,
): ChannelMessageEvent {
  const unsigned: UnsignedChannelMessageEvent = {
    version,
    authorDeviceId: author.publicKey,
    ...input,
  };
  if (version === 1) {
    delete unsigned.postId;
    delete unsigned.parentId;
    delete unsigned.branchId;
    delete unsigned.authorKind;
    delete unsigned.mentions;
    delete unsigned.intent;
  }
  const privateKeyHex = extractSigningPrivateKeyHex(author.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalChannelMessage(unsigned)));
  const id = channelMessageId({ ...unsigned, signature });
  return { ...unsigned, id, signature };
}

/** Create a v1 channel message (legacy; carries no post/threading fields). */
export function createChannelMessage(
  author: DeviceIdentity,
  input: ChannelMessageInput,
): ChannelMessageEvent {
  return buildChannelMessage(author, input, 1);
}

/** Create a v2 channel message (posts, comments, replies, reactions, agent events). */
export function createChannelMessageV2(
  author: DeviceIdentity,
  input: ChannelMessageInput,
): ChannelMessageEvent {
  return buildChannelMessage(author, input, 2);
}

// --- Reaction body validation (T0.1) --------------------------------------
// A reaction body is exactly ONE emoji grapheme. This check is consensus-adjacent
// (both the pre-flight before signing and verification call it), so it must agree
// byte-for-byte on Hermes (no Intl.Segmenter), V8, and Node. It uses an explicit
// emoji-sequence grammar plus a hard UTF-8 byte cap, never a runtime-provided
// segmenter and never an environment branch.
const ZWJ_CP = 0x200d;
const VS16_CP = 0xfe0f;
const KEYCAP_CP = 0x20e3;
const REACTION_BODY_BYTE_CAP = 28;

// Emoji "core" code point ranges. Regional indicators, skin-tone modifiers, and
// the join/selector marks are handled separately below and are deliberately NOT
// treated as cores, so a lone modifier or a core+flag mix is rejected.
const EMOJI_CORE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00a9, 0x00a9], [0x00ae, 0x00ae],
  [0x203c, 0x203c], [0x2049, 0x2049],
  [0x2122, 0x2122], [0x2139, 0x2139],
  [0x2194, 0x21aa],
  [0x231a, 0x231b],
  [0x2328, 0x2328],
  [0x23cf, 0x23cf],
  [0x23e9, 0x23f3],
  [0x23f8, 0x23fa],
  [0x24c2, 0x24c2],
  [0x25aa, 0x25ab],
  [0x25b6, 0x25b6],
  [0x25c0, 0x25c0],
  [0x25fb, 0x25fe],
  [0x2600, 0x27bf],
  [0x2934, 0x2935],
  [0x2b00, 0x2bff],
  [0x3030, 0x3030],
  [0x303d, 0x303d],
  [0x3297, 0x3297],
  [0x3299, 0x3299],
  [0x1f000, 0x1faff],
];

function isRegionalIndicator(cp: number): boolean {
  return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}

function isSkinToneModifier(cp: number): boolean {
  return cp >= 0x1f3fb && cp <= 0x1f3ff;
}

function isKeycapBase(cp: number): boolean {
  return cp === 0x23 || cp === 0x2a || (cp >= 0x30 && cp <= 0x39);
}

function isEmojiCore(cp: number): boolean {
  if (isRegionalIndicator(cp) || isSkinToneModifier(cp)) return false;
  if (cp === VS16_CP || cp === ZWJ_CP || cp === KEYCAP_CP) return false;
  for (const [lo, hi] of EMOJI_CORE_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

/** Consume one `core VS16? skinTone?` element; returns the next index or -1. */
function consumeEmojiElement(cps: readonly number[], start: number): number {
  let i = start;
  if (i >= cps.length || !isEmojiCore(cps[i]!)) return -1;
  i += 1;
  if (i < cps.length && cps[i] === VS16_CP) i += 1;
  if (i < cps.length && isSkinToneModifier(cps[i]!)) i += 1;
  return i;
}

function isZwjEmojiSequence(cps: readonly number[]): boolean {
  let i = 0;
  let elements = 0;
  while (i < cps.length) {
    if (elements > 0) {
      if (cps[i] !== ZWJ_CP) return false;
      i += 1;
      if (i >= cps.length) return false; // dangling ZWJ
    }
    const next = consumeEmojiElement(cps, i);
    if (next < 0) return false;
    i = next;
    elements += 1;
  }
  return elements >= 1;
}

// --- Pack reaction tokens (Plan 56 feature 5) ------------------------------
// A custom-emoji reaction rides the SAME v2 react intent as a deterministic
// token instead of a unicode grapheme: `mkpack:<packId>:<slug>`. The grammar
// is a bounded regex (runtime-independent, like the emoji grammar below), so
// every build agrees byte-for-byte. Builds predating packs fail this check
// and DROP the reaction fail-closed -- honest degradation, never corruption.
const PACK_REACTION_RE = /^mkpack:[0-9a-f]{16,64}:[a-z0-9][a-z0-9_-]{1,31}$/;

export function isPackReactionToken(body: string): boolean {
  return typeof body === 'string' && body.length <= 100 && PACK_REACTION_RE.test(body);
}

export function packReactionToken(packId: string, slug: string): string {
  const token = `mkpack:${packId}:${slug}`;
  if (!isPackReactionToken(token)) throw new Error('Invalid pack reaction token.');
  return token;
}

export function parsePackReactionToken(body: string): { packId: string; slug: string } | null {
  if (!isPackReactionToken(body)) return null;
  const [, packId, slug] = body.split(':');
  return { packId: packId!, slug: slug! };
}

/** True when `body` is exactly one emoji grapheme (a valid reaction body). */
export function isSingleEmojiGrapheme(body: string): boolean {
  if (typeof body !== 'string' || body.length === 0) return false;
  if (encoder.encode(body).length > REACTION_BODY_BYTE_CAP) return false;

  const cps: number[] = [];
  for (const ch of body) cps.push(ch.codePointAt(0)!);
  if (cps.length === 0) return false;

  // Flag: exactly two regional indicators, nothing else.
  if (cps.length === 2 && isRegionalIndicator(cps[0]!) && isRegionalIndicator(cps[1]!)) {
    return true;
  }
  if (cps.some(isRegionalIndicator)) return false;

  // Keycap: base + VS16 + U+20E3, nothing else.
  if (cps.length === 3 && isKeycapBase(cps[0]!) && cps[1] === VS16_CP && cps[2] === KEYCAP_CP) {
    return true;
  }
  if (cps.includes(KEYCAP_CP)) return false;

  return isZwjEmojiSequence(cps);
}

/** A react event's shape (T0.2); tombstones relax only the emoji-body check. */
function isValidReactShape(message: ChannelMessageEvent): boolean {
  if (message.version !== 2) return false;
  if (typeof message.parentId !== 'string' || message.parentId.length === 0) return false;
  if (message.attachments && message.attachments.length > 0) return false;
  const isTombstone = message.supersedes?.deleted === true;
  if (!isTombstone && !isSingleEmojiGrapheme(message.body) && !isPackReactionToken(message.body)) return false;
  return true;
}

export function verifyChannelMessage(message: ChannelMessageEvent): boolean {
  if (message.version !== 1 && message.version !== 2) return false;
  if (message.intent === 'react' && !isValidReactShape(message)) return false;
  if (message.version === 1) {
    // A v1 event must not carry v2 fields: they would ride along unsigned.
    if (
      message.postId !== undefined ||
      message.parentId !== undefined ||
      message.branchId !== undefined ||
      message.authorKind !== undefined ||
      message.mentions !== undefined ||
      message.intent !== undefined
    ) {
      return false;
    }
  }
  if (message.id !== channelMessageId(message)) return false;

  try {
    const { id, signature, ...unsigned } = message;
    void id;
    return verifySignature(
      message.authorDeviceId,
      canonicalChannelMessage(unsigned),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}

/** The app's channel event log table (cm_messages). */
export const CHANNEL_MESSAGE_TABLE = 'cm_messages';

function isChannelMessageAttachment(value: unknown): value is ChannelMessageAttachment {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.id === 'string'
    && typeof a.blobHash === 'string'
    && typeof a.name === 'string'
    && typeof a.mimeType === 'string'
    && typeof a.size === 'number'
  );
}

function parseJsonArray(value: unknown): unknown[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Reconstruct a ChannelMessageEvent from an inbound cm_messages row (untrusted
 * `change.data`). Returns null when a required column is missing or malformed.
 *
 * This is a byte-exact mirror of the app's persistence mapping
 * (channelMessageRowFromEvent / channelMessageEventFromRow), so a caller that
 * feeds the result into verifyChannelMessage recomputes the SAME canonical form
 * the author signed. It lets the inbound apply path (inbound-row-validators)
 * verify a channel post's SIGNATURE + author authorization BEFORE the row is
 * written, instead of trusting the transport-level sender (a device-scoped
 * session carries every community's rows, so the connection peer is not the
 * author). Kept in the engine so read-time and apply-time verification never
 * drift; the app should consume this rather than reconstructing its own.
 */
export function channelMessageEventFromRow(
  data: Record<string, unknown>,
): ChannelMessageEvent | null {
  // The cm_messages `version` column defaults to 1 (legacy v1 rows predate the
  // v2 post columns and may omit it entirely); an absent/null version is v1. A
  // present-but-unsupported version is malformed.
  const version = data.version == null ? 1 : data.version;
  if (version !== 1 && version !== 2) return null;
  const { id, community_id, channel_id, author_device_id, body, hlc_wall, hlc_counter, signature } = data;
  if (
    typeof id !== 'string'
    || typeof community_id !== 'string'
    || typeof channel_id !== 'string'
    || typeof author_device_id !== 'string'
    || typeof body !== 'string'
    || typeof hlc_wall !== 'string'
    || typeof hlc_counter !== 'number'
    || typeof signature !== 'string'
  ) {
    return null;
  }
  const event: ChannelMessageEvent = {
    version,
    id,
    communityId: community_id,
    channelId: channel_id,
    authorDeviceId: author_device_id,
    body,
    attachments: parseJsonArray(data.attachments_json).filter(isChannelMessageAttachment),
    hlc: { wall: hlc_wall, counter: hlc_counter },
    supersedes:
      typeof data.supersedes_id === 'string'
        ? { id: data.supersedes_id, deleted: data.supersedes_deleted === 1 }
        : undefined,
    signature,
  };
  if (version === 2) {
    if (typeof data.post_id === 'string') event.postId = data.post_id;
    if (typeof data.parent_id === 'string') event.parentId = data.parent_id;
    if (typeof data.branch_id === 'string') event.branchId = data.branch_id;
    if (data.author_kind === 'human' || data.author_kind === 'agent') event.authorKind = data.author_kind;
    const mentions = parseJsonArray(data.mentions_json).filter((v): v is string => typeof v === 'string');
    if (mentions.length > 0) event.mentions = mentions;
    if (typeof data.intent === 'string') event.intent = data.intent as ChannelMessageIntent;
  } else if (rowCarriesV2Data(data)) {
    // A v1 signature does NOT cover the v2 columns, so a caller that verifies the
    // reconstructed event and then persists the RAW row could smuggle unsigned
    // post_id/parent_id/branch_id/author_kind/mentions/intent into the store and
    // poison the post-threading index. Reject a v1 row that carries any v2 data;
    // a genuine v1 row leaves those columns null / mentions_json '[]'.
    return null;
  }
  return event;
}

/** Does a cm_messages row carry any v2-only column data (illegal on a v1 row)? */
function rowCarriesV2Data(data: Record<string, unknown>): boolean {
  return (
    data.post_id != null
    || data.parent_id != null
    || data.branch_id != null
    || data.author_kind != null
    || data.intent != null
    || parseJsonArray(data.mentions_json).length > 0
  );
}

/** Deterministic total order: wall, then counter, then author, then id. */
export function compareChannelMessages(
  a: ChannelMessageEvent,
  b: ChannelMessageEvent,
): number {
  if (a.hlc.wall !== b.hlc.wall) return a.hlc.wall < b.hlc.wall ? -1 : 1;
  if (a.hlc.counter !== b.hlc.counter) return a.hlc.counter - b.hlc.counter;
  if (a.authorDeviceId !== b.authorDeviceId) {
    return a.authorDeviceId < b.authorDeviceId ? -1 : 1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** Normalized intent: a v1 event (no intent field) is a 'message'. */
function normalizedIntent(event: ChannelMessageEvent): ChannelMessageIntent {
  return event.intent ?? 'message';
}

/**
 * Resolve immutable edit/delete events into the visible channel message list.
 * Edits keep the original message's slot; deletes remove that slot.
 *
 * A supersede is AUTHOR-BOUND and INTENT-BOUND (fail-closed, consensus-adjacent:
 * pure + deterministic, no env branches). Only the ORIGINAL author of a root may
 * edit or delete it, and a supersede may not cross intents. This closes a
 * censorship vector: every event is individually signed, but a signed tombstone
 * only proves who authored the TOMBSTONE, not that they may censor the target.
 * Without this bind, member B could sign a tombstone naming member A's message
 * (or reaction) id and delete it community-wide, and a react tombstone could
 * censor a message. A mismatched supersede is ignored and the target stays
 * active; the hostile event is simply never applied (it may still be stored).
 */
export function resolveChannelMessages(events: readonly ChannelMessageEvent[]): ChannelMessageEvent[] {
  const ordered = [...events].sort(compareChannelMessages);
  const rootByEventId = new Map<string, string>();
  const rootOrder: string[] = [];
  const visibleByRoot = new Map<string, ChannelMessageEvent>();
  const rootAuthor = new Map<string, string>();
  const rootIntent = new Map<string, ChannelMessageIntent>();

  for (const event of ordered) {
    if (!event.supersedes) {
      rootByEventId.set(event.id, event.id);
      if (!rootOrder.includes(event.id)) rootOrder.push(event.id);
      visibleByRoot.set(event.id, event);
      rootAuthor.set(event.id, event.authorDeviceId);
      rootIntent.set(event.id, normalizedIntent(event));
      continue;
    }

    const rootId = rootByEventId.get(event.supersedes.id);
    if (!rootId) continue;
    // Fail-closed author + intent bind: a supersede from anyone but the root's
    // author, or across intents, is ignored (the target is NOT touched).
    if (event.authorDeviceId !== rootAuthor.get(rootId)) continue;
    if (normalizedIntent(event) !== rootIntent.get(rootId)) continue;

    rootByEventId.set(event.id, rootId);
    if (event.supersedes.deleted) {
      visibleByRoot.delete(rootId);
    } else {
      visibleByRoot.set(rootId, event);
    }
  }

  return rootOrder
    .map((rootId) => visibleByRoot.get(rootId))
    .filter((event): event is ChannelMessageEvent => event !== undefined);
}

/** Next HLC for a local send given the highest clock this device has seen. */
export function nextHlc(seen: Hlc | null, now: string): Hlc {
  if (!seen) return { wall: now, counter: 0 };
  if (now > seen.wall) return { wall: now, counter: 0 };
  return { wall: seen.wall, counter: seen.counter + 1 };
}

/** The highest HLC across a set of events (total order), or null when empty. */
export function highestEventHlc(events: readonly ChannelMessageEvent[]): Hlc | null {
  let highest: ChannelMessageEvent | null = null;
  for (const event of events) {
    if (!highest || compareChannelMessages(event, highest) > 0) highest = event;
  }
  return highest ? { wall: highest.hlc.wall, counter: highest.hlc.counter } : null;
}
