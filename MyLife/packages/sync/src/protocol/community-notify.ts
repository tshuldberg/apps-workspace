/**
 * Community feed LIVENESS primitives (community feed P4, the data/protocol layer
 * under the P5 feed UI). Two honest pieces and nothing more:
 *
 *  1. A content-FREE notify ping. After a real change (a tail append or a
 *     content-changing publish) the community node parks ONE sealed ping that
 *     says only "community X changed, at time T". It carries NO message bytes, so
 *     even a member who opens it learns only that the feed moved and when. The
 *     ping wakes a subscriber to ENQUEUE a pull; the ping itself delivers
 *     nothing, and a user-visible "message received" notification fires ONLY
 *     after the SUBSEQUENT pull applies real events (shouldEmitMessageNotification).
 *     This mirrors the data-only-push discipline in the Meerkat app's
 *     background-task-registration.ts: the wake enqueues, the applied count gates
 *     the notification.
 *
 *  2. The admin poll cadence. An owner sets a feed poll interval on the signed
 *     descriptor (feedPollIntervalMs). normalizeFeedPollInterval snaps a raw
 *     value to an allowed step, enforces a 1-minute PRODUCTION FLOOR (sub-minute
 *     intervals are only honored behind a dev flag), and falls back to 'manual'
 *     on junk.
 *
 * Zero-knowledge boundary (do not weaken): the notify token and seal key are
 * BOTH derived from the descriptor's `genesisNonce`, which the CALLER passes as
 * `communitySecret`. Every member AND the zero-knowledge community node hold the
 * signed descriptor, so all of them can derive the token (to park/drain the ping)
 * and open the content-free ping WITHOUT any epoch key. The node never holds an
 * epoch key and still never decrypts message content; the ping carries none. A
 * random third party who does not hold the descriptor cannot derive the token nor
 * read the ping. No new crypto scheme: HKDF + secretbox via the package helpers.
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import type { FeedPollIntervalMs } from '../types';
import { hkdf, sha512Hex } from '../node/hkdf';
import { hexToBytes } from '../encryption/keys';

const { decodeUTF8, encodeUTF8 } = naclUtil;
const encoder = new TextEncoder();

const NONCE_BYTES = nacl.secretbox.nonceLength;

/** The bytes of the descriptor's genesisNonce (the shared community secret). */
function secretBytes(communitySecret: string): Uint8Array {
  // genesisNonce is hex (bytesToHex of randomBytes(16)); fall back to UTF-8 bytes
  // if a caller passes a non-hex secret, so the derivation never throws.
  if (/^[0-9a-fA-F]+$/.test(communitySecret) && communitySecret.length % 2 === 0) {
    return hexToBytes(communitySecret);
  }
  return encoder.encode(communitySecret);
}

/**
 * Derive the per-community notify token. HKDF over the community secret bytes
 * (the descriptor's `genesisNonce`) with info `meerkat-community-notify-v1:<id>`,
 * SHA-512'd and sliced to 64 hex chars -- the same shape as deriveMailboxToken.
 *
 * Anyone holding the signed descriptor (every member AND the node) can derive
 * this WITHOUT any epoch key; a random third party cannot. The relay sees only a
 * meaningless 64-hex mailbox token.
 */
export function deriveCommunityNotifyToken(communitySecret: string, communityId: string): string {
  const ikm = secretBytes(communitySecret);
  const info = `meerkat-community-notify-v1:${communityId}`;
  return sha512Hex(hkdf(ikm, info)).slice(0, 64);
}

/** What lives inside a sealed notify ping. NO message bytes -- only an id + time. */
interface CommunityNotifyPayload {
  v: 1;
  communityId: string;
  ts: string;
}

export interface CommunityNotifyPing {
  communityId: string;
  ts: string;
}

/**
 * The secretbox seal key, derived from the community secret.
 *
 * Design note (deliberate, documented): the key is derived from the community
 * secret (the descriptor's `genesisNonce`) ONLY -- the community id is NOT folded
 * into the KDF info. The genesisNonce is already unique per community, so it is a
 * sufficient per-community separator; the id is instead carried INSIDE the
 * AUTHENTICATED secretbox payload, so a tampered id fails the MAC and reads null.
 * This keeps the reader a true 2-arg `(communitySecret, bytes)` function: it has
 * no id to derive a key with before opening. (The original P4 sketch put
 * `:${communityId}` in the seal info, which would force a 3-arg reader; binding
 * the id inside the authenticated box is equivalent for confidentiality and
 * integrity and matches the specified reader signature.)
 */
function sealKey(communitySecret: string): Uint8Array {
  return hkdf(secretBytes(communitySecret), 'meerkat-community-notify-seal-v1');
}

/**
 * Build a content-FREE, sealed notify ping. The relay (and any non-descriptor-
 * holder) sees opaque bytes; a descriptor-holder who opens it learns only that
 * the community changed and when. It carries no message body, ever.
 */
export function buildCommunityNotifyPing(
  communitySecret: string,
  communityId: string,
  now: string = new Date().toISOString(),
): Uint8Array {
  const payload: CommunityNotifyPayload = { v: 1, communityId, ts: now };
  const key = sealKey(communitySecret);
  const nonce = nacl.randomBytes(NONCE_BYTES);
  const box = nacl.secretbox(decodeUTF8(JSON.stringify(payload)), nonce, key);
  const out = new Uint8Array(NONCE_BYTES + box.length);
  out.set(nonce, 0);
  out.set(box, NONCE_BYTES);
  return out;
}

/**
 * Open a sealed notify ping. Fail-closed: a wrong community secret, tampered
 * bytes, or a malformed payload all return null. A reader learns only
 * {communityId, ts} -- never any message content (there is none in the ping).
 */
export function readCommunityNotifyPing(
  communitySecret: string,
  bytes: Uint8Array,
): CommunityNotifyPing | null {
  if (!(bytes instanceof Uint8Array) || bytes.length <= NONCE_BYTES) return null;
  const nonce = bytes.slice(0, NONCE_BYTES);
  const box = bytes.slice(NONCE_BYTES);

  const opened = nacl.secretbox.open(box, nonce, sealKey(communitySecret));
  if (!opened) return null;
  try {
    const payload = JSON.parse(encodeUTF8(opened)) as CommunityNotifyPayload;
    if (
      payload?.v !== 1
      || typeof payload.communityId !== 'string'
      || typeof payload.ts !== 'string'
    ) {
      return null;
    }
    return { communityId: payload.communityId, ts: payload.ts };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Poll cadence (admin-set on the descriptor)
// ---------------------------------------------------------------------------

export interface FeedPollIntervalOption {
  value: FeedPollIntervalMs;
  label: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Ordered allowed poll intervals + labels. 'manual' first. */
export const FEED_POLL_INTERVALS: readonly FeedPollIntervalOption[] = [
  { value: 'manual', label: 'Manual' },
  { value: 1 * MIN, label: '1m' },
  { value: 5 * MIN, label: '5m' },
  { value: 10 * MIN, label: '10m' },
  { value: 15 * MIN, label: '15m' },
  { value: 30 * MIN, label: '30m' },
  { value: 1 * HOUR, label: '1h' },
  { value: 6 * HOUR, label: '6h' },
  { value: 24 * HOUR, label: '24h' },
  { value: 7 * 24 * HOUR, label: '1 week' },
];

/** The minimum auto-poll cadence in production (sub-minute is dev-flag-gated). */
export const FEED_POLL_PRODUCTION_FLOOR_MS = 60_000;

/** The numeric (non-manual) allowed steps, ascending. */
const NUMERIC_STEPS: readonly number[] = FEED_POLL_INTERVALS
  .map((o) => o.value)
  .filter((v): v is number => typeof v === 'number');

export interface NormalizeFeedPollIntervalOptions {
  /** Dev-build flag: allow a sub-minute (below the production floor) interval. */
  allowSubMinute?: boolean;
}

/**
 * Normalize a raw poll-interval value to an allowed setting:
 *  - 'manual' (case-insensitive) stays 'manual'.
 *  - A finite positive number snaps to the NEAREST allowed step.
 *  - A sub-minute number is raised to the 1m production floor UNLESS
 *    allowSubMinute (the dev flag), in which case the raw value passes through.
 *  - Anything else (junk, NaN, <= 0, non-number/non-'manual') -> 'manual'.
 */
export function normalizeFeedPollInterval(
  value: unknown,
  opts: NormalizeFeedPollIntervalOptions = {},
): FeedPollIntervalMs {
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'manual') return 'manual';
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return normalizeFeedPollInterval(parsed, opts);
    return 'manual';
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'manual';

  // Sub-minute: honor it ONLY behind the dev flag; otherwise floor to 1m.
  if (value < FEED_POLL_PRODUCTION_FLOOR_MS) {
    return opts.allowSubMinute ? value : FEED_POLL_PRODUCTION_FLOOR_MS;
  }

  // Snap to the nearest allowed numeric step.
  let nearest = NUMERIC_STEPS[0]!;
  let bestDelta = Math.abs(value - nearest);
  for (const step of NUMERIC_STEPS) {
    const delta = Math.abs(value - step);
    if (delta < bestDelta) {
      bestDelta = delta;
      nearest = step;
    }
  }
  return nearest;
}

/** Human label for a poll interval value (falls back to a rounded minutes/hours form). */
export function feedPollIntervalLabel(value: FeedPollIntervalMs): string {
  if (value === 'manual') return 'Manual';
  const known = FEED_POLL_INTERVALS.find((o) => o.value === value);
  if (known) return known.label;
  if (value < MIN) return `${Math.round(value / 1000)}s`;
  if (value < HOUR) return `${Math.round(value / MIN)}m`;
  return `${Math.round(value / HOUR)}h`;
}

/**
 * The honest gate for a "message received" notification: TRUE only when a real
 * pull applied events. Mirrors background-task-registration.ts so a caller
 * cannot notify the user without real applied events behind it.
 */
export function shouldEmitMessageNotification(appliedCount: number): boolean {
  return typeof appliedCount === 'number' && appliedCount > 0;
}

// ---------------------------------------------------------------------------
// Notify-drain core (PURE). Given drained ping bytes, ENQUEUE a pull per valid
// ping. The ping itself delivers NOTHING; the user-visible "message received"
// notification is the caller's job and only fires when the SUBSEQUENT pull's
// applied > 0 (shouldEmitMessageNotification). The expo notification wiring is
// DEFERRED behind a dev flag exactly like background-task-registration.ts: ship
// the pure enqueue/applied-gating; the OS scheduler + push token delivery come
// in a dev build.
// ---------------------------------------------------------------------------

export interface DrainCommunityNotifyInput {
  /** The community secret (descriptor genesisNonce) for this token's community. */
  communitySecret: string;
  /** The opaque ping payloads drained off the notify token (relay env frames). */
  pings: readonly Uint8Array[];
  /**
   * Enqueue a pull for the community a valid ping named. Injected so the core
   * stays pure + testable; the app wires it to its real "pull now" queue. May be
   * sync or async; the core does not await delivery, only records the enqueue.
   */
  enqueuePull: (communityId: string) => void | Promise<void>;
}

export interface DrainCommunityNotifyResult {
  /** How many valid, decodable pings were seen. */
  read: number;
  /** How many distinct communities were enqueued for a pull. */
  enqueued: number;
  /** The distinct community ids enqueued (in first-seen order). */
  communityIds: string[];
}

/**
 * Drain a batch of notify pings: read each (fail-closed; a bad/foreign ping is
 * dropped and not counted as read), and ENQUEUE one pull per distinct community
 * named by a valid ping. Returns real counts only. Delivers NO content -- the
 * enqueued pull is what fetches and applies, and only THAT pull's applied count
 * may drive a user notification.
 */
export async function drainCommunityNotifyPings(
  input: DrainCommunityNotifyInput,
): Promise<DrainCommunityNotifyResult> {
  let read = 0;
  const seen = new Set<string>();
  const communityIds: string[] = [];
  for (const bytes of input.pings) {
    const ping = readCommunityNotifyPing(input.communitySecret, bytes);
    if (!ping) continue; // fail-closed: foreign/tampered ping, not counted
    read += 1;
    if (!seen.has(ping.communityId)) {
      seen.add(ping.communityId);
      communityIds.push(ping.communityId);
      await input.enqueuePull(ping.communityId);
    }
  }
  return { read, enqueued: communityIds.length, communityIds };
}
