// Community feed P5: the pure, honest feed-status module.
//
// No React, no DB, no I/O. Every string here is HONEST per apps/meerkat/CLAUDE.md
// transport boundary: there is no fake "live"/"online"/"delivered"/"connected"
// status and no fabricated peer count. The feed shows only "Updated Xm ago"
// (from the real last node-pull time), the real source of the last refresh, and
// honest empty/removed edge states. Unit-tested in __tests__/feed-status.test.ts.

import type { RefreshFeedSource } from '../lib/meerkat-data';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Honest relative label for the last SUCCESSFUL node pull. No fake precision:
 * sub-minute reads "just now", then whole minutes, hours, days. A null
 * lastPulledAt (never pulled) reads "Never updated". A future timestamp (clock
 * skew) clamps to "just now" rather than printing a negative age.
 */
export function formatUpdatedAgo(lastPulledAt: string | null, now: number): string {
  if (!lastPulledAt) return 'Never updated';
  const then = Date.parse(lastPulledAt);
  if (Number.isNaN(then)) return 'Never updated';
  const delta = now - then;
  if (delta < MINUTE_MS) return 'Updated just now';
  if (delta < HOUR_MS) return `Updated ${Math.floor(delta / MINUTE_MS)}m ago`;
  if (delta < DAY_MS) return `Updated ${Math.floor(delta / HOUR_MS)}h ago`;
  return `Updated ${Math.floor(delta / DAY_MS)}d ago`;
}

/** Human label for what actually answered the last refresh. Honest, never a fake live. */
export function sourceLabel(source: RefreshFeedSource): string {
  switch (source) {
    case 'community node':
      return 'Hosted for this community';
    case 'peer':
      return 'Requested from a peer (applies when they answer)';
    case 'no host reachable':
      return 'No host reachable';
    case 'removed':
      return 'You were removed from this community';
  }
}

export type FeedStateKind = 'removed' | 'no_relay' | 'no_host' | 'empty' | 'ready';

export interface DeriveFeedStateInput {
  /** A relay URL is configured (web is relay-only; the relay is how a node is discovered). */
  hasRelay: boolean;
  /** A community-node http(s) host is set in the descriptor. */
  nodeUrlConfigured: boolean;
  /** Real count of locally cached, rendered messages. */
  messageCount: number;
  /** What the last refresh actually returned, or null if it never ran this session. */
  lastSource: RefreshFeedSource | null;
  /** A real signal: the last refresh returned source 'removed' (node said not_member). */
  removed: boolean;
}

export interface FeedState {
  kind: FeedStateKind;
  /** An honest one-line notice for the empty/edge state, or null when the feed is ready. */
  notice: string | null;
}

/**
 * The honest empty/edge state machine for the feed. Priority order:
 *   removed  -> the node rejected this device (a real not_member signal)
 *   no_relay -> no relay AND no node url: nothing can be discovered yet
 *   no_host/empty -> 0 messages and the last refresh found no node:
 *                    'no_host' when there IS cached content to fall back on
 *                    (it cannot happen with messageCount 0, so this branch maps
 *                    to the honest "no messages yet" copy), else 'empty'
 *   ready    -> there is cached content (or a real source answered)
 *
 * Every notice is honest and em-dash free.
 */
export function deriveFeedState(input: DeriveFeedStateInput): FeedState {
  if (input.removed) {
    return { kind: 'removed', notice: 'You were removed from this community.' };
  }
  if (!input.hasRelay && !input.nodeUrlConfigured) {
    return { kind: 'no_relay', notice: 'Set a connection server to look for hosted community history.' };
  }
  // No locally cached messages AND the last refresh did not reach a host.
  const lastReachedNoHost = input.lastSource === null || input.lastSource === 'no host reachable';
  if (input.messageCount === 0 && lastReachedNoHost) {
    if (input.lastSource === 'no host reachable') {
      // We tried and found nothing, and there is no cache to show.
      return { kind: 'no_host', notice: 'No hosted community history reachable. No messages yet.' };
    }
    // Never refreshed this session and nothing cached.
    return { kind: 'empty', notice: 'No messages yet.' };
  }
  return { kind: 'ready', notice: null };
}

/**
 * The honest no-host notice when there IS cached content to fall back on. The UI
 * renders the cache and explains the source with the real "Updated Xm ago"
 * stamp, so a member never mistakes a stale cache for a fresh sync.
 */
export function noHostWithCacheNotice(updatedAgo: string): string {
  return `No hosted community history reachable. Showing your last synced copy from ${updatedAgo}.`;
}
