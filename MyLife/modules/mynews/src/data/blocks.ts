// Pure local enforcement for the block / mute list (Apple Guideline 1.2). The
// signed-in app resolves the viewer's blocks once (port.listBlocks) and filters
// its Today feed, article suggestion lists, and suggestion threads against this
// set so a blocked author's content stops appearing. The block set is keyed by
// BOTH the blocked profile id and that author's pubkey because the two surfaces
// identify authors differently: the feed carries authorPubkey, suggestions and
// their events carry the editor profile id / editor pubkey. Keeping both keys
// lets one pure helper cover every surface.
//
// `block` and `mute` both remove the author from the primary feed and lists; the
// distinction is a UI affordance (a muted author may be surfaced behind a
// "muted" hint elsewhere) and both are reversible via removeBlock. No fabricated
// state: this is a real local revocation of visibility, not a server mutation of
// the author's content.

import type { BlockMode, BlockView } from './cloud';

export interface BlockSet {
  /** Blocked author profile ids (suggestion / editor keyed surfaces). */
  profileIds: Set<string>;
  /** Blocked author pubkeys (feed / byline keyed surfaces). */
  pubkeys: Set<string>;
  /** Full lookup by profile id, for a "muted" affordance decision. */
  byProfileId: Map<string, BlockMode>;
  byPubkey: Map<string, BlockMode>;
}

/** Collapse the blocker's own block rows into a fast lookup set. */
export function buildBlockSet(blocks: BlockView[]): BlockSet {
  const profileIds = new Set<string>();
  const pubkeys = new Set<string>();
  const byProfileId = new Map<string, BlockMode>();
  const byPubkey = new Map<string, BlockMode>();
  for (const b of blocks) {
    if (b.blockedProfileId) {
      profileIds.add(b.blockedProfileId);
      byProfileId.set(b.blockedProfileId, b.mode);
    }
    if (b.blockedPubkey) {
      pubkeys.add(b.blockedPubkey);
      byPubkey.set(b.blockedPubkey, b.mode);
    }
  }
  return { profileIds, pubkeys, byProfileId, byPubkey };
}

/** True when either the author's pubkey or profile id is in the block set. */
export function isBlockedAuthor(
  set: BlockSet,
  keys: { profileId?: string | null; pubkey?: string | null },
): boolean {
  if (keys.pubkey && set.pubkeys.has(keys.pubkey)) return true;
  if (keys.profileId && set.profileIds.has(keys.profileId)) return true;
  return false;
}

/**
 * Drop entries authored by a blocked (or muted) author. Generic over the item
 * shape: the caller supplies how to read the author's pubkey and/or profile id.
 * Both `block` and `mute` remove the entry from the primary list.
 */
export function filterBlocked<T>(
  set: BlockSet,
  items: T[],
  keyOf: (item: T) => { profileId?: string | null; pubkey?: string | null },
): T[] {
  if (set.profileIds.size === 0 && set.pubkeys.size === 0) return items;
  return items.filter((item) => !isBlockedAuthor(set, keyOf(item)));
}

/** Feed items are keyed by the author's pubkey. */
export function filterBlockedFeed<T extends { authorPubkey: string }>(
  set: BlockSet,
  items: T[],
): T[] {
  return filterBlocked(set, items, (item) => ({ pubkey: item.authorPubkey }));
}

/** Suggestions carry the editor's profile id and pubkey. */
export function filterBlockedSuggestions<T extends { editorId: string; editorPubkey: string }>(
  set: BlockSet,
  items: T[],
): T[] {
  return filterBlocked(set, items, (item) => ({
    profileId: item.editorId,
    pubkey: item.editorPubkey,
  }));
}

/** Suggestion-thread events are keyed by the actor's profile id. */
export function filterBlockedEvents<T extends { actorId: string }>(
  set: BlockSet,
  items: T[],
): T[] {
  return filterBlocked(set, items, (item) => ({ profileId: item.actorId }));
}
