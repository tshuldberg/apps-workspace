// Discover screen state + copy core (Plan 19, Meerkat Public Social Layer -- P6,
// web twin). Byte-parity with apps/meerkat/app/(root)/data/discover-core.ts on
// all shared logic (copy consts, taxonomy, honest formatter, 5-state selection,
// trending rank); the import paths are identical, so this file is the same source
// as the mobile core (like feed-core is duplicated across the two app boundaries).
//
// Pure, Node-testable helpers behind the Discover pane. They own the verbatim
// section 7.1 copy, the honest metric formatter, the full fixed taxonomy chip
// labels, and the 5-state selection from a real directory probe result. No IO:
// the pane runs probePublicDirectory / getDirectoryCacheEntries and feeds the
// results in here, so the state machine is testable without a browser.

import type { PublicCategory } from '@mylife/sync';
import {
  PUBLIC_CATEGORIES,
  type ProbePublicDirectoryResult,
  type VerifiedPublicEntry,
} from './public-directory-client';

export { PUBLIC_CATEGORIES };
export type { VerifiedPublicEntry };

// The rendered chip labels for the closed taxonomy. The KEY set is exactly the
// engine PublicCategory enum (PUBLIC_CATEGORIES); no chip omits a category and
// no chip exists outside the enum (plan section 8).
export const PUBLIC_CATEGORY_LABELS: Record<PublicCategory, string> = {
  technology: 'Technology',
  gaming: 'Gaming',
  news: 'News',
  sports: 'Sports',
  local: 'Local',
  hobbies: 'Hobbies',
  creative: 'Creative',
  discussion: 'Discussion',
  other: 'Other',
};

// Verbatim section 7.1 copy. Exported so the pane and the tests read the same
// strings (the pane must render these exact words).
export const DISCOVER_COPY = {
  headerTitle: 'Discover',
  headerSubtitle: 'Public communities, channels, and forums anyone can read.',
  searchPlaceholder: 'Search public communities and forums',
  trendingTitle: 'Trending',
  trendingHint: 'Ranked by how many hosts serve it and how recent it is. No view counts.',
  honestNotice:
    'This list comes from public directory hosts you can reach right now. Counts come from signed content and the number of hosts actually serving it, never from view or like tracking.',
  loading: 'Reaching public directory hosts…',
  emptyTitle: 'No public communities found here yet',
  emptyBody:
    'No reachable directory host returned results. Try another search or check your connection server in Settings.',
  errorTitle: 'Could not reach a public directory',
  errorRetry: 'Retry',
  errorBody:
    'No directory host responded. Public browsing needs a connection server with a public directory.',
} as const;

/** "Still verifying {n} entries…" -- the Partial footer (verbatim section 7.1). */
export function stillVerifyingLabel(n: number): string {
  return `Still verifying ${n} ${n === 1 ? 'entry' : 'entries'}…`;
}

/**
 * Honest per-card metric line: "{N} posts · served by {M} host{s} · updated {when}".
 * N = the verified snapshot event count (0 until a reader pulls a snapshot, rendered
 * "0 posts" honestly), M = the REAL announcing-host count, when = a locale time from
 * the signed latest_wall. NO likes, NO views -- only signed + serving signals.
 */
export function formatPublicMetric(entry: VerifiedPublicEntry): string {
  const posts = `${entry.event_count} ${entry.event_count === 1 ? 'post' : 'posts'}`;
  const hosts = `served by ${entry.announcing_hosts} ${entry.announcing_hosts === 1 ? 'host' : 'hosts'}`;
  const when = `updated ${formatWhen(entry.latest_wall)}`;
  return `${posts} · ${hosts} · ${when}`;
}

function formatWhen(wall: string): string {
  if (!wall) return 'recently';
  const date = new Date(wall);
  if (Number.isNaN(date.getTime())) return wall;
  return date.toLocaleString();
}

export type DiscoverState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error' }
  | { kind: 'success'; entries: VerifiedPublicEntry[] }
  | { kind: 'partial'; entries: VerifiedPublicEntry[]; verifying: number };

export interface SelectDiscoverStateInput {
  /** A probe is currently in flight. */
  inFlight: boolean;
  /** Verified entries currently displayable (warm cache, then last probe result). */
  shownEntries: readonly VerifiedPublicEntry[];
  /** The most recent resolved probe result, or null before the first one resolves. */
  probe: ProbePublicDirectoryResult | null;
}

/**
 * Select the Discover render state from the real probe machine. Honest mapping:
 *  - in flight + nothing to show yet  -> Loading
 *  - in flight + entries already shown -> Partial (a refresh is re-verifying them)
 *  - resolved, no source / unreachable -> Error
 *  - resolved, responded with zero      -> Empty
 *  - resolved, verified entries present -> Success
 * A probe that has not resolved and is not in flight is the initial Loading frame.
 */
export function selectDiscoverState(input: SelectDiscoverStateInput): DiscoverState {
  if (input.inFlight) {
    if (input.shownEntries.length > 0) {
      return { kind: 'partial', entries: [...input.shownEntries], verifying: input.shownEntries.length };
    }
    return { kind: 'loading' };
  }
  const probe = input.probe;
  if (!probe) return { kind: 'loading' };
  if (!probe.configured || probe.respondedAt === null) return { kind: 'error' };
  if (probe.entries.length === 0) return { kind: 'empty' };
  return { kind: 'success', entries: probe.entries };
}

/**
 * Rank verified entries for the Trending list using ONLY verifiable signals:
 * the real announcing-host count first, then signed recency (latest_wall). No
 * view counts, no like counts, no engagement score (plan AC-2).
 */
export function rankTrending(entries: readonly VerifiedPublicEntry[]): VerifiedPublicEntry[] {
  return [...entries].sort((a, b) => {
    if (a.announcing_hosts !== b.announcing_hosts) return b.announcing_hosts - a.announcing_hosts;
    if (a.latest_wall !== b.latest_wall) return a.latest_wall < b.latest_wall ? 1 : -1;
    return a.publication_id < b.publication_id ? -1 : a.publication_id === b.publication_id ? 0 : 1;
  });
}
