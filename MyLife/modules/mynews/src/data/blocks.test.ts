import { describe, expect, it } from 'vitest';
import {
  buildBlockSet,
  filterBlockedEvents,
  filterBlockedFeed,
  filterBlockedSuggestions,
  isBlockedAuthor,
} from './blocks';
import type { BlockView, FeedItem, SuggestionEventView, SuggestionView } from './cloud';

function block(over: Partial<BlockView>): BlockView {
  return {
    id: 'b1',
    blockedProfileId: 'p-troll',
    blockedPubkey: 'pub-troll',
    blockedHandle: 'troll',
    blockedDisplayName: 'Troll',
    mode: 'block',
    createdAt: '2026-07-05T00:00:00.000Z',
    ...over,
  };
}

function feedItem(over: Partial<FeedItem>): FeedItem {
  return {
    articleId: 'a1',
    slug: 's1',
    headline: 'H',
    kind: 'news',
    rev: 1,
    publishedAt: '2026-07-03T00:00:00.000Z',
    authorHandle: 'rosa',
    authorDisplayName: 'Rosa',
    authorPubkey: 'pub-rosa',
    authorTier: 'open',
    ...over,
  };
}

function suggestion(over: Partial<SuggestionView>): SuggestionView {
  return {
    id: 'sg1',
    articleId: 'a1',
    articleSlug: 's1',
    articleHeadline: 'H',
    baseRev: 1,
    editorId: 'p-ed',
    editorHandle: 'ed',
    editorDisplayName: 'Ed',
    editorPubkey: 'pub-ed',
    type: 'copyedit',
    diff: { baseHash: '', ops: [] },
    citations: [],
    rationale: 'r',
    status: 'open',
    createdAt: '2026-07-03T00:00:00.000Z',
    endorsements: 0,
    ...over,
  };
}

describe('buildBlockSet + isBlockedAuthor', () => {
  it('indexes by both profile id and pubkey', () => {
    const set = buildBlockSet([block({})]);
    expect(isBlockedAuthor(set, { pubkey: 'pub-troll' })).toBe(true);
    expect(isBlockedAuthor(set, { profileId: 'p-troll' })).toBe(true);
    expect(isBlockedAuthor(set, { pubkey: 'pub-rosa', profileId: 'p-rosa' })).toBe(false);
    expect(set.byPubkey.get('pub-troll')).toBe('block');
    expect(set.byProfileId.get('p-troll')).toBe('block');
  });

  it('tolerates empty pubkeys (a key-less profile is only matched by id)', () => {
    const set = buildBlockSet([block({ blockedPubkey: '' })]);
    expect(set.pubkeys.has('')).toBe(false);
    expect(isBlockedAuthor(set, { profileId: 'p-troll' })).toBe(true);
    expect(isBlockedAuthor(set, { pubkey: '' })).toBe(false);
  });
});

describe('filterBlockedFeed', () => {
  it('hides a blocked author from the feed and unblock restores them', () => {
    const items = [
      feedItem({ articleId: 'a1', authorPubkey: 'pub-rosa' }),
      feedItem({ articleId: 'a2', authorPubkey: 'pub-troll' }),
    ];
    const blocked = buildBlockSet([block({})]);
    expect(filterBlockedFeed(blocked, items).map((i) => i.articleId)).toEqual(['a1']);

    // "Unblock" = an empty block set: everything returns, same identity.
    const cleared = buildBlockSet([]);
    expect(filterBlockedFeed(cleared, items)).toBe(items);
  });

  it('mute also removes from the primary feed (both modes hide)', () => {
    const items = [feedItem({ articleId: 'a2', authorPubkey: 'pub-troll' })];
    const muted = buildBlockSet([block({ mode: 'mute' })]);
    expect(filterBlockedFeed(muted, items)).toEqual([]);
  });
});

describe('filterBlockedSuggestions + filterBlockedEvents', () => {
  it('drops suggestions from a blocked editor (by id or pubkey)', () => {
    const items = [
      suggestion({ id: 'sg1', editorId: 'p-ed', editorPubkey: 'pub-ed' }),
      suggestion({ id: 'sg2', editorId: 'p-troll', editorPubkey: 'pub-troll' }),
      suggestion({ id: 'sg3', editorId: 'p-troll2', editorPubkey: 'pub-troll' }),
    ];
    const blocked = buildBlockSet([block({})]);
    // sg2 matches by both keys; sg3 matches by pubkey only.
    expect(filterBlockedSuggestions(blocked, items).map((s) => s.id)).toEqual(['sg1']);
  });

  it('drops thread events from a blocked actor', () => {
    const events: SuggestionEventView[] = [
      { id: 'e1', suggestionId: 'sg1', actorId: 'p-ed', actorHandle: 'ed', action: 'comment', payload: {}, createdAt: '' },
      { id: 'e2', suggestionId: 'sg1', actorId: 'p-troll', actorHandle: 'troll', action: 'comment', payload: {}, createdAt: '' },
    ];
    const blocked = buildBlockSet([block({})]);
    expect(filterBlockedEvents(blocked, events).map((e) => e.id)).toEqual(['e1']);
  });
});
