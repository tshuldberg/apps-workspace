// Today-feed loader. Pure over the cloud port so it tests against the module's
// InMemoryCloudAdapter with no React and no SQLite. The screen maps each state
// to an honest surface: not-connected copy, an empty-follows prompt, an empty
// feed, an error, or the loaded cards.

import {
  buildBlockSet,
  filterBlockedFeed,
  type BlockView,
  type FeedItem,
  type MyNewsCloudPort,
} from '@mylife/mynews';

export type FeedState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'no-follows' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; items: FeedItem[] };

/** Collapse duplicate follows to the set of author keys the feed queries by. */
export function dedupeFollowedPubkeys(keys: string[]): string[] {
  return [...new Set(keys.filter((key) => key.length > 0))];
}

export async function loadFeed(input: {
  configured: boolean;
  port: MyNewsCloudPort | null;
  followedPubkeys: string[];
  /**
   * The signed-in viewer's block/mute list. Blocked authors are filtered out of
   * the Today feed client-side after the read: the feed query is keyed by
   * followed pubkeys, and the block set is a small self-scoped list keyed by the
   * blocked author's profile id / pubkey. Filtering here keeps one pure
   * enforcement point (filterBlockedFeed) shared across every feed surface and
   * avoids a second server round-trip to resolve blocked pubkeys into the URL.
   * Empty (or omitted, e.g. signed out) means no filtering.
   */
  blocks?: BlockView[];
}): Promise<FeedState> {
  if (!input.configured || !input.port) {
    return { status: 'not-configured' };
  }
  const followedPubkeys = dedupeFollowedPubkeys(input.followedPubkeys);
  if (followedPubkeys.length === 0) {
    return { status: 'no-follows' };
  }
  try {
    const raw = await input.port.getFeed({ followedPubkeys });
    const items = filterBlockedFeed(buildBlockSet(input.blocks ?? []), raw);
    return items.length === 0 ? { status: 'empty' } : { status: 'loaded', items };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
