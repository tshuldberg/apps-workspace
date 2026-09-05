// In-memory store contract for the editing-desk surface. The in-memory impl
// must mirror the RPC semantics in
// supabase/migrations/20260703000003_mynews_editing_desk.sql exactly:
// validation-before-any-write ordering, the SQL's return-code priority
// (not-open > mixed-articles > rev-conflict > bad-award), reject notes on the
// event payload, and aggregates v2 computed from state with the SQL
// definitions.

import { describe, expect, it } from 'vitest';
import {
  createInMemoryMyNewsStore,
  type AwardInput,
  type BatchAcceptRecord,
  type StoredSuggestion,
} from '../../_shared/mynews-store.ts';

const revision = (articleId: string, rev: number) => ({
  articleId,
  rev,
  headline: 'headline',
  dek: undefined,
  bodyMd: 'body',
  changelogJson: '[]',
  createdAt: '2026-07-03T12:00:00.000Z',
  signature: 'sig',
  signerPubkey: 'author-pub',
});

const award = (editorProfileId = 'editor-1'): AwardInput => ({
  editorProfileId,
  basePoints: 1,
  diversityMult: 0.3,
  standingMult: 0.85,
});

function seeded() {
  const { store, state } = createInMemoryMyNewsStore({
    profiles: [
      { id: 'author-1', userId: 'user-author', pubkey: 'author-pub' },
      { id: 'author-2', userId: 'user-author-2', pubkey: 'author-2-pub' },
      { id: 'editor-1', userId: 'user-editor', pubkey: 'editor-pub' },
    ],
  });
  state.articles.set('art-1', {
    id: 'art-1',
    slug: 'art-1',
    kind: 'news',
    status: 'published',
    authorProfileId: 'author-1',
    authorPubkey: 'author-pub',
    currentRev: 1,
  });
  state.articles.set('art-2', {
    id: 'art-2',
    slug: 'art-2',
    kind: 'news',
    status: 'published',
    authorProfileId: 'author-2',
    authorPubkey: 'author-2-pub',
    currentRev: 1,
  });
  const suggest = (id: string, over: Partial<StoredSuggestion> = {}) => {
    state.suggestions.set(id, {
      id,
      articleId: 'art-1',
      baseRev: 1,
      editorProfileId: 'editor-1',
      type: 'copyedit',
      diffJson: '{"baseHash":"x","ops":[]}',
      citations: [],
      rationale: 'why',
      signature: 'sig',
      createdAt: '2026-07-03T11:00:00.000Z',
      status: 'open',
      ...over,
    });
  };
  return { store, state, suggest };
}

function snapshot(state: ReturnType<typeof seeded>['state']) {
  return JSON.stringify({
    articles: [...state.articles.entries()],
    suggestions: [...state.suggestions.entries()],
    revisions: state.revisions,
    events: state.events,
    ledger: state.ledger,
  });
}

describe('acceptSuggestionsBatch', () => {
  it('commits one revision, N status flips, N accept events, N ledger rows', async () => {
    const { store, state, suggest } = seeded();
    suggest('sug-a');
    suggest('sug-b');
    const res = await store.acceptSuggestionsBatch({
      suggestionIds: ['sug-b', 'sug-a'],
      actorProfileId: 'author-1',
      revision: revision('art-1', 2),
      awards: { 'sug-a': award(), 'sug-b': award() },
    });
    expect(res).toBe('ok');
    expect(state.articles.get('art-1')?.currentRev).toBe(2);
    expect(state.revisions).toHaveLength(1);
    expect(state.suggestions.get('sug-a')?.status).toBe('accepted');
    expect(state.suggestions.get('sug-b')?.status).toBe('accepted');
    // Events and ledger rows land in id order (the RPC locks ordered by id).
    expect(state.events.map((e) => [e.suggestionId, e.action, e.payload])).toEqual([
      ['sug-a', 'accept', { rev: 2 }],
      ['sug-b', 'accept', { rev: 2 }],
    ]);
    expect(state.ledger.map((r) => r.suggestionId)).toEqual(['sug-a', 'sug-b']);
    expect(state.credibilityRows).toHaveLength(2);
  });

  it('returns not-open for empty, unknown, duplicated, or already-decided ids', async () => {
    const { store, suggest } = seeded();
    suggest('sug-a');
    suggest('sug-b', { status: 'rejected' });
    const base = {
      actorProfileId: 'author-1',
      revision: revision('art-1', 2),
      awards: { 'sug-a': award(), 'sug-b': award(), 'sug-x': award() },
    };
    expect(await store.acceptSuggestionsBatch({ ...base, suggestionIds: [] })).toBe('not-open');
    expect(await store.acceptSuggestionsBatch({ ...base, suggestionIds: ['sug-a', 'sug-x'] })).toBe(
      'not-open',
    );
    expect(await store.acceptSuggestionsBatch({ ...base, suggestionIds: ['sug-a', 'sug-a'] })).toBe(
      'not-open',
    );
    expect(await store.acceptSuggestionsBatch({ ...base, suggestionIds: ['sug-a', 'sug-b'] })).toBe(
      'not-open',
    );
  });

  it('returns mixed-articles for cross-article batches', async () => {
    const { store, suggest } = seeded();
    suggest('sug-a');
    suggest('sug-c', { articleId: 'art-2' });
    const res = await store.acceptSuggestionsBatch({
      suggestionIds: ['sug-a', 'sug-c'],
      actorProfileId: 'author-1',
      revision: revision('art-1', 2),
      awards: { 'sug-a': award(), 'sug-c': award() },
    });
    expect(res).toBe('mixed-articles');
  });

  it('mirrors the SQL return-code priority', async () => {
    const { store, suggest } = seeded();
    // not-open beats mixed-articles: decided suggestion on the other article.
    suggest('sug-a');
    suggest('sug-c', { articleId: 'art-2', status: 'rejected' });
    expect(
      await store.acceptSuggestionsBatch({
        suggestionIds: ['sug-a', 'sug-c'],
        actorProfileId: 'author-1',
        revision: revision('art-1', 2),
        awards: { 'sug-a': award(), 'sug-c': award() },
      }),
    ).toBe('not-open');

    // mixed-articles beats rev-conflict: cross-article batch with a bad rev.
    suggest('sug-d', { articleId: 'art-2' });
    expect(
      await store.acceptSuggestionsBatch({
        suggestionIds: ['sug-a', 'sug-d'],
        actorProfileId: 'author-1',
        revision: revision('art-1', 9),
        awards: { 'sug-a': award(), 'sug-d': award() },
      }),
    ).toBe('mixed-articles');

    // rev-conflict beats bad-award: bad rev with a missing award entry.
    suggest('sug-b');
    expect(
      await store.acceptSuggestionsBatch({
        suggestionIds: ['sug-a', 'sug-b'],
        actorProfileId: 'author-1',
        revision: revision('art-1', 9),
        awards: { 'sug-a': award() },
      }),
    ).toBe('rev-conflict');
  });

  it('returns bad-award for missing or incomplete award entries', async () => {
    const { store, suggest } = seeded();
    suggest('sug-a');
    suggest('sug-b');
    const missing = await store.acceptSuggestionsBatch({
      suggestionIds: ['sug-a', 'sug-b'],
      actorProfileId: 'author-1',
      revision: revision('art-1', 2),
      awards: { 'sug-a': award() },
    });
    expect(missing).toBe('bad-award');
    const incomplete = await store.acceptSuggestionsBatch({
      suggestionIds: ['sug-a', 'sug-b'],
      actorProfileId: 'author-1',
      revision: revision('art-1', 2),
      awards: {
        'sug-a': award(),
        'sug-b': { ...award(), standingMult: undefined as unknown as number },
      },
    });
    expect(incomplete).toBe('bad-award');
  });

  it('leaves state untouched when any validation fails (all-or-nothing)', async () => {
    const { store, state, suggest } = seeded();
    suggest('sug-a');
    suggest('sug-b', { status: 'partial' });
    suggest('sug-c');
    const before = snapshot(state);
    const failures: Array<Pick<BatchAcceptRecord, 'suggestionIds' | 'awards'>> = [
      { suggestionIds: ['sug-a', 'sug-b'], awards: { 'sug-a': award(), 'sug-b': award() } },
      { suggestionIds: ['sug-a', 'sug-c'], awards: { 'sug-a': award() } },
      { suggestionIds: ['sug-a', 'sug-missing'], awards: { 'sug-a': award() } },
    ];
    for (const f of failures) {
      const res = await store.acceptSuggestionsBatch({
        actorProfileId: 'author-1',
        revision: revision('art-1', 2),
        ...f,
      });
      expect(res).not.toBe('ok');
      expect(snapshot(state)).toBe(before);
    }
  });
});

describe('rejectSuggestion (3-arg)', () => {
  it('stores the optional note on the reject event payload', async () => {
    const { store, state, suggest } = seeded();
    suggest('sug-a');
    suggest('sug-b');
    expect(await store.rejectSuggestion('sug-a', 'author-1', 'thanks, but no')).toBe('ok');
    expect(await store.rejectSuggestion('sug-b', 'author-1')).toBe('ok');
    expect(state.events).toEqual([
      {
        suggestionId: 'sug-a',
        actorProfileId: 'author-1',
        action: 'reject',
        payload: { note: 'thanks, but no' },
      },
      { suggestionId: 'sug-b', actorProfileId: 'author-1', action: 'reject', payload: {} },
    ]);
    expect(state.suggestions.get('sug-a')?.status).toBe('rejected');
    expect(await store.rejectSuggestion('sug-a', 'author-1')).toBe('not-open');
  });
});

describe('acceptSuggestion (single) ledger + event seam', () => {
  it('records the accept event and a ledger row with the suggestion id', async () => {
    const { store, state, suggest } = seeded();
    suggest('sug-a', { type: 'correction' });
    const res = await store.acceptSuggestion({
      suggestionId: 'sug-a',
      decision: 'partial',
      actorProfileId: 'author-1',
      revision: revision('art-1', 2),
      award: { editorProfileId: 'editor-1', basePoints: 10, diversityMult: 0.3, standingMult: 0.85 },
    });
    expect(res).toBe('ok');
    expect(state.suggestions.get('sug-a')?.status).toBe('partial');
    expect(state.events).toEqual([
      { suggestionId: 'sug-a', actorProfileId: 'author-1', action: 'partial', payload: { rev: 2 } },
    ]);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({
      editorProfileId: 'editor-1',
      suggestionId: 'sug-a',
      basePoints: 10,
    });
    expect(state.credibilityRows).toEqual([
      { editorProfileId: 'editor-1', basePoints: 10, diversityMult: 0.3, standingMult: 0.85 },
    ]);
  });
});

describe('getEditorAggregates v2 (computed from state, SQL definitions)', () => {
  it('returns the reader defaults on an empty ledger', async () => {
    const { store } = seeded();
    expect(await store.getEditorAggregates('editor-1')).toEqual({
      openCount: 0,
      decidedSampleSize: 0,
      acceptanceRate: 1,
      acceptedTotal: 0,
      acceptedCopyedits: 0,
      distinctAuthors: 0,
      endorsementsReceived: 0,
      maxPairShare: 0,
      sanctionsInLast90d: 0,
      authorStanding: 0.5,
    });
  });

  it('computes counts, rate, diversity, pair share, and endorsements from state', async () => {
    const { store, state, suggest } = seeded();
    suggest('sug-1', { status: 'accepted', type: 'copyedit' });
    suggest('sug-2', { status: 'accepted', type: 'copyedit' });
    suggest('sug-3', { status: 'partial', type: 'correction', articleId: 'art-2' });
    suggest('sug-4', { status: 'rejected' });
    suggest('sug-5', { status: 'open' });
    suggest('sug-6', { status: 'stale' });
    suggest('sug-other', { editorProfileId: 'editor-2', status: 'accepted' });
    state.dupes.push(
      { originalId: 'sug-1', endorserId: 'e-a', similarity: 1 },
      { originalId: 'sug-1', endorserId: 'e-b', similarity: 0.9 },
      { originalId: 'sug-5', endorserId: 'e-a', similarity: 0.88 },
      { originalId: 'sug-other', endorserId: 'e-a', similarity: 1 },
    );
    expect(await store.getEditorAggregates('editor-1')).toEqual({
      openCount: 1,
      decidedSampleSize: 4,
      acceptanceRate: 0.75,
      acceptedTotal: 3,
      acceptedCopyedits: 2,
      distinctAuthors: 2,
      endorsementsReceived: 3,
      maxPairShare: 2 / 3,
      sanctionsInLast90d: 0,
      authorStanding: 0.5,
    });
  });

  it('honors an explicit test override', async () => {
    const { store, state } = seeded();
    const override = {
      openCount: 9,
      decidedSampleSize: 40,
      acceptanceRate: 0.1,
      acceptedTotal: 4,
      acceptedCopyedits: 1,
      distinctAuthors: 2,
      endorsementsReceived: 0,
      maxPairShare: 0.5,
      sanctionsInLast90d: 0,
      authorStanding: 0.5,
    };
    state.aggregates.set('editor-1', override);
    expect(await store.getEditorAggregates('editor-1')).toEqual(override);
  });
});

describe('editing-desk reads and endorsements', () => {
  it('getOpenSuggestionsForArticle filters by article, baseRev, and open status', async () => {
    const { store, suggest } = seeded();
    suggest('sug-1');
    suggest('sug-2', { baseRev: 2 });
    suggest('sug-3', { status: 'accepted' });
    suggest('sug-4', { articleId: 'art-2' });
    expect(await store.getOpenSuggestionsForArticle('art-1', 1)).toEqual([
      {
        id: 'sug-1',
        editorProfileId: 'editor-1',
        type: 'copyedit',
        diffJson: '{"baseHash":"x","ops":[]}',
        baseRev: 1,
      },
    ]);
  });

  it('insertDupeEndorsement is idempotent on the (original, endorser) pair', async () => {
    const { store, state, suggest } = seeded();
    suggest('sug-1');
    expect(
      await store.insertDupeEndorsement({ originalId: 'sug-1', endorserId: 'e-a', similarity: 0.9 }),
    ).toBe('ok');
    expect(
      await store.insertDupeEndorsement({ originalId: 'sug-1', endorserId: 'e-a', similarity: 1 }),
    ).toBe('ok');
    expect(
      await store.insertDupeEndorsement({ originalId: 'sug-1', endorserId: 'e-b', similarity: 0.9 }),
    ).toBe('ok');
    expect(state.dupes).toEqual([
      { originalId: 'sug-1', endorserId: 'e-a', similarity: 0.9 },
      { originalId: 'sug-1', endorserId: 'e-b', similarity: 0.9 },
    ]);
  });

  it('getCredibilityLedger returns only the editor rows', async () => {
    const { store, state } = seeded();
    state.ledger.push(
      {
        editorProfileId: 'editor-1',
        suggestionId: 'sug-1',
        basePoints: 10,
        diversityMult: 0.3,
        standingMult: 0.85,
        awardedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        editorProfileId: 'editor-2',
        suggestionId: 'sug-2',
        basePoints: 1,
        diversityMult: 0.3,
        standingMult: 0.85,
        awardedAt: '2026-07-02T00:00:00.000Z',
      },
    );
    const rows = await store.getCredibilityLedger('editor-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.suggestionId).toBe('sug-1');
  });

  it('getCredibilityLedger returns newest-first (postgrest awarded_at.desc mirror)', async () => {
    const { store, state } = seeded();
    const row = (suggestionId: string, awardedAt: string) => ({
      editorProfileId: 'editor-1',
      suggestionId,
      basePoints: 1,
      diversityMult: 0.3,
      standingMult: 0.85,
      awardedAt,
    });
    state.ledger.push(
      row('sug-old', '2026-06-01T00:00:00.000Z'),
      row('sug-new', '2026-07-02T00:00:00.000Z'),
      row('sug-mid', '2026-06-15T00:00:00.000Z'),
    );
    expect((await store.getCredibilityLedger('editor-1')).map((r) => r.suggestionId)).toEqual([
      'sug-new',
      'sug-mid',
      'sug-old',
    ]);
  });

  it('getOpenSuggestionsForArticle returns created_at ascending (oldest is the collapse original)', async () => {
    const { store, suggest } = seeded();
    suggest('sug-late', { createdAt: '2026-07-03T12:00:00.000Z' });
    suggest('sug-early', { createdAt: '2026-07-03T09:00:00.000Z' });
    suggest('sug-middle', { createdAt: '2026-07-03T10:30:00.000Z' });
    expect((await store.getOpenSuggestionsForArticle('art-1', 1)).map((s) => s.id)).toEqual([
      'sug-early',
      'sug-middle',
      'sug-late',
    ]);
  });

  it('getArticleHead exposes newsroomId for the draft-scope gate', async () => {
    const { store, state } = seeded();
    expect((await store.getArticleHead('art-1'))?.newsroomId).toBeNull();
    state.articles.set('art-draft', {
      id: 'art-draft',
      slug: 'art-draft',
      kind: 'news',
      status: 'draft',
      authorProfileId: 'author-1',
      authorPubkey: 'author-pub',
      currentRev: 1,
      newsroomId: 'room-1',
    });
    const head = await store.getArticleHead('art-draft');
    expect(head?.status).toBe('draft');
    expect(head?.newsroomId).toBe('room-1');
  });

  it('getProfilePubkeys maps profile ids to registered pubkeys, skipping unknowns', async () => {
    const { store } = seeded();
    expect(await store.getProfilePubkeys(['author-1', 'editor-1', 'missing'])).toEqual({
      'author-1': 'author-pub',
      'editor-1': 'editor-pub',
    });
    expect(await store.getProfilePubkeys([])).toEqual({});
  });

  it('getNewsroomRole reads the membership table directly', async () => {
    const { store } = createInMemoryMyNewsStore({
      profiles: [{ id: 'p-1', pubkey: 'k1' }],
      newsroomMembers: [
        { newsroomId: 'room-1', profileId: 'p-1', role: 'owner' },
        { newsroomId: 'room-1', profileId: 'p-2', role: 'reviewer' },
      ],
    });
    expect(await store.getNewsroomRole('room-1', 'p-1')).toBe('owner');
    expect(await store.getNewsroomRole('room-1', 'p-2')).toBe('reviewer');
    expect(await store.getNewsroomRole('room-1', 'p-3')).toBeNull();
    expect(await store.getNewsroomRole('room-2', 'p-1')).toBeNull();
  });
});
