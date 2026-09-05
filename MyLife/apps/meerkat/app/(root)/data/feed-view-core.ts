// Plan 32 T1.1: the pure view mapping for the content-first feed card.
//
// This sits BESIDE feed-core.ts and never touches its ranking logic (NC-5). It
// consumes the already-evaluated FeedItem (media / replyCount / reactions were
// populated in Plan 32 Phase 0) and turns it into the display + engagement model
// the card renders. Every engagement number derives from a verified FeedItem
// field (NC-1); nothing here fabricates a count. Node-only, no React, so the
// mapping is unit-tested without a render harness.

import type { DatabaseAdapter } from '@mylife/db';
import { listChannelPostCards } from './community-core';
import type { FeedControlKey, FeedItem, FeedItemKind } from './feed-core';

/** The quick-react emoji the feed engagement heart toggles (matches QUICK_REACTIONS[0]). */
export const HEART_EMOJI = '❤️';

/** Human label for a feed item kind (shown in the why-sheet, not on the card). */
export const FEED_KIND_LABEL: Record<FeedItemKind, string> = {
  mention: 'Mention',
  reply: 'Reply',
  unread: 'Unread',
  post: 'Post',
  canvas: 'Canvas post',
  file: 'File',
  public: 'Public',
};

/** The source toggle that controls whether each kind appears (why-sheet + filters). */
export const FEED_KIND_CONTROL: Record<FeedItemKind, FeedControlKey> = {
  mention: 'messages',
  reply: 'posts',
  unread: 'unread',
  post: 'posts',
  canvas: 'posts',
  file: 'files',
  public: 'public',
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/** First letter of a display name, uppercased; `?` when there is no letter/digit. */
export function feedAvatarInitial(name: string): string {
  for (const char of name.trim()) {
    if (/[\p{L}\p{N}]/u.test(char)) return char.toUpperCase();
  }
  return '?';
}

/**
 * Compact relative timestamp for the card context line. Deterministic: an ISO in
 * the future or the last minute reads "now"; older than a week falls back to a
 * stable YYYY-MM-DD (never a locale-variant string, so tests are hermetic).
 */
export function formatFeedTime(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = nowMs - then;
  if (diff < MINUTE_MS) return 'now';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h`;
  if (diff < WEEK_MS) return `${Math.floor(diff / DAY_MS)}d`;
  return new Date(then).toISOString().slice(0, 10);
}

export interface FeedContext {
  community: string;
  channel: string | null;
}

/**
 * The muted context line parts. Public items carry the publication title as the
 * community and have no channel; community items carry the community name and,
 * when present, the channel name.
 */
export function feedContext(item: FeedItem): FeedContext {
  if (item.kind === 'public') {
    return { community: item.communityName, channel: null };
  }
  return {
    community: item.communityName,
    channel: item.channelName ? item.channelName : null,
  };
}

export interface FeedHeart {
  count: number;
  mine: boolean;
}

/** The heart reaction summary from the verified read model (NC-1). */
export function feedHeart(item: FeedItem): FeedHeart {
  const group = (item.reactions ?? []).find((g) => g.emoji === HEART_EMOJI);
  return { count: group?.count ?? 0, mine: group?.mine ?? false };
}

export interface FeedEngagement {
  /** Any affordance renders at all (skip the row entirely when false). */
  hasAny: boolean;
  showReplies: boolean;
  replyCount: number;
  showHeart: boolean;
  heart: FeedHeart;
  /** Share renders ONLY on public items (NC-3: no external share on private content). */
  showShare: boolean;
}

/**
 * Per-kind engagement row. Replies + heart live on the post-root-backed kinds
 * (`post` / `reply`, which carry postId + reactions); Share lives only on public
 * items. File / mention / unread items get no engagement row.
 */
export function feedEngagement(item: FeedItem): FeedEngagement {
  const isPostRoot = (item.kind === 'post' || item.kind === 'reply') && !!item.postId;
  const showShare = item.kind === 'public';
  const heart = feedHeart(item);
  return {
    hasAny: isPostRoot || showShare,
    showReplies: isPostRoot,
    replyCount: item.replyCount ?? 0,
    showHeart: isPostRoot,
    heart,
    showShare,
  };
}

/** Parse host_urls (a JSON array) and return the first URL-looking string, or null. */
function firstHostUrl(hostUrlsJson: string): string | null {
  try {
    const parsed: unknown = JSON.parse(hostUrlsJson);
    if (!Array.isArray(parsed)) return null;
    for (const entry of parsed) {
      if (typeof entry === 'string' && /^(https?|wss?):\/\//i.test(entry)) return entry;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The plain-text payload the Share affordance hands to the OS share sheet for a
 * public item: title, description, and a real reachable host URL when one exists.
 * No fabricated link is ever produced.
 */
export function buildPublicShareMessage(item: FeedItem): string {
  const entry = item.public;
  const parts: string[] = [];
  const title = entry?.title ?? item.title;
  if (title) parts.push(title);
  const description = entry?.description ?? item.body;
  if (description) parts.push(description);
  const host = entry ? firstHostUrl(entry.host_urls) : null;
  if (host) parts.push(host);
  return parts.join('\n\n');
}

/**
 * Resolve the signed root event id for a post-kind feed item so the heart's
 * ADD path can target it (`sendReaction` needs the root event id; the feed item
 * only carries postId). Uses the same read model that produced the card; returns
 * null when the post root is no longer resolvable.
 */
export function findPostRootEventId(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  postId: string,
): string | null {
  const card = listChannelPostCards(db, communityId, channelId).find(
    (c) => c.postId === postId,
  );
  return card?.root.id ?? null;
}

export interface FeedCardView {
  id: string;
  kind: FeedItemKind;
  authorName: string;
  initial: string;
  community: string;
  channel: string | null;
  time: string;
  title: string;
  body: string;
  media: { blobHash: string; mimeType: string } | null;
  /**
   * The post root's first link-preview attachment reference (Plan 32 T5.1), or
   * null. Only the blob hash + mime cross here; the url/title/image are parsed
   * lazily from the local verified blob by the render layer (LinkPreviewCard),
   * never fetched on the receiver (NC-2).
   */
  linkPreview: { blobHash: string; mimeType: string } | null;
  engagement: FeedEngagement;
}

/** Compose the full display model for one card from an evaluated feed item. */
export function toFeedCardView(
  item: FeedItem,
  opts: { authorName: string; nowMs: number },
): FeedCardView {
  const context = feedContext(item);
  return {
    id: item.id,
    kind: item.kind,
    authorName: opts.authorName,
    initial: feedAvatarInitial(opts.authorName),
    community: context.community,
    channel: context.channel,
    time: formatFeedTime(item.sortAt.wall, opts.nowMs),
    title: item.title,
    body: item.body,
    media: item.media ?? null,
    linkPreview: item.linkPreview ?? null,
    engagement: feedEngagement(item),
  };
}

// ============================================================================
// Plan 32 T5.1 perf seams (mobile FlatList). These are pure decisions so the
// screen's scroll/heart hot paths are unit-tested without a render harness.
// ============================================================================

/**
 * How long the feed coalesces revision bumps (heart toggles, drained rows)
 * before it re-runs evaluateLocalFeed. Small enough to feel instant on a single
 * spaced tap (leading edge applies immediately), long enough that a rapid burst
 * of taps re-evaluates the whole feed ONCE instead of once per tap.
 */
export const FEED_REEVAL_MIN_INTERVAL_MS = 120;

/**
 * The next FlatList render-window size after onEndReached. Grows by `step` until
 * it covers the whole evaluated list, then stays put (the slice caller caps at
 * the real length, so overshoot is harmless). Never shrinks here.
 */
export function nextRenderWindow(current: number, total: number, step: number): number {
  if (current >= total) return current;
  return current + step;
}

/**
 * A tiny per-key, versioned memo. The feed uses it to resolve each author's
 * avatar data URI ONCE per feed revision, so scrolling the FlatList never
 * re-decodes the same base64 avatar frame after frame. A new `version` for a key
 * replaces that key's entry (no unbounded growth); repeated same-key/same-version
 * lookups return the SAME reference and never re-run `compute`.
 */
export interface KeyedMemo<T> {
  get(key: string, version: number, compute: () => T): T;
}

export function createKeyedMemo<T>(): KeyedMemo<T> {
  const cache = new Map<string, { version: number; value: T }>();
  return {
    get(key, version, compute) {
      const hit = cache.get(key);
      if (hit && hit.version === version) return hit.value;
      const value = compute();
      cache.set(key, { version, value });
      return value;
    },
  };
}

export type FeedThrottleDecision =
  | { action: 'noop' }
  | { action: 'apply' }
  | { action: 'schedule'; delayMs: number };

export interface FeedThrottleInput {
  /** The revision the feed currently reflects. */
  appliedRevision: number;
  /** The newest chat revision (bumped by every heart toggle / drained row). */
  latestRevision: number;
  /** When the feed last applied a revision (ms epoch). */
  lastAppliedAt: number;
  now: number;
  minIntervalMs: number;
}

/**
 * Pure throttle decision for the debounced feed re-eval. A heart toggle bumps the
 * chat revision; rather than re-run the entire evaluateLocalFeed synchronously on
 * every tap, the screen asks this what to do. It NEVER drops a real change: the
 * feed always converges to `latestRevision` (so every count still comes from the
 * real rows), just at most once per `minIntervalMs`. Leading edge applies at once
 * when the last apply is old enough; a burst schedules a single trailing apply.
 */
export function decideFeedThrottle(input: FeedThrottleInput): FeedThrottleDecision {
  if (input.latestRevision === input.appliedRevision) return { action: 'noop' };
  const since = input.now - input.lastAppliedAt;
  if (since >= input.minIntervalMs) return { action: 'apply' };
  return { action: 'schedule', delayMs: input.minIntervalMs - since };
}
