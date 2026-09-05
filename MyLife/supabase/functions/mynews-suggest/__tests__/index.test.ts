import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleSuggestRequest } from '../index.ts';
import {
  createInMemoryMyNewsStore,
  type EditorAggregates,
  type MyNewsStore,
  type NewsroomRole,
} from '../../_shared/mynews-store.ts';
import { EDGE_MYNEWS_BOUNDS } from '../../_shared/mynews-bounds.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../modules/mynews/src/signing/__fixtures__/signing-vectors.json'),
    'utf8',
  ),
);

// The JWT subject used by post(); the terms gate keys on this auth user id and
// it is editor-1's user id in the seeded store.
const EDITOR_USER_ID = 'auth-editor-1';

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

/** Default request carries a terms-accepted editor; opts.sub=null signs out. */
function post(body: unknown, opts?: { sub?: string | null }): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const sub = opts && 'sub' in opts ? opts.sub : EDITOR_USER_ID;
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-suggest', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** Terms-acceptance seed satisfying the gate for EDITOR_USER_ID. */
const acceptedTerms = () => [{ userId: EDITOR_USER_ID, version: EDGE_CURRENT_TERMS_VERSION }];

interface SeedOptions {
  article?: Partial<{ status: string; authorProfileId: string; newsroomId: string | null }>;
  newsroomMembers?: Array<{ newsroomId: string; profileId: string; role: NewsroomRole }>;
}

function seeded(opts: SeedOptions = {}) {
  const { store, state } = createInMemoryMyNewsStore({
    profiles: [
      { id: 'editor-1', userId: EDITOR_USER_ID, pubkey: vectors.publicKeyHex },
      { id: 'editor-2', pubkey: 'other-editor-pub' },
    ],
    newsroomMembers: opts.newsroomMembers,
    termsAcceptances: acceptedTerms(),
  });
  state.articles.set(vectors.suggestion.articleId, {
    id: vectors.suggestion.articleId,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: 'author-1',
    authorPubkey: 'author-pub',
    currentRev: 1,
    ...opts.article,
  });
  return { store, state };
}

const validBody = () => ({
  suggestion: { id: 'sug-1', createdAt: '2026-07-03T12:00:00.000Z', ...vectors.suggestion },
  signatureHex: vectors.suggestionSignatureHex,
});

/* --------------------- near-dupe scaffolding (fake verify) --------------------- */

// Signature checking is covered by the fixture tests; the dupe and cap suites
// use the DI verify seam so they can submit arbitrary diffs.
const fakeVerify = async () => true;

const replaceOp = (baseIndex: number, text: string) => ({
  kind: 'replace',
  baseIndex,
  anchorBefore: null,
  anchorAfter: null,
  baseBlocks: [`Base block ${baseIndex}.`],
  newBlocks: [text],
});

const diffWith = (ops: unknown[]) => JSON.stringify({ baseHash: 'deadbeef', ops });

const customBody = (diffJson: string) => ({
  suggestion: {
    id: 'sug-new',
    articleId: vectors.suggestion.articleId,
    baseRev: 1,
    type: 'copyedit',
    diffJson,
    citations: [],
    rationale: 'tighten the wording',
    editorPubkey: vectors.publicKeyHex,
    createdAt: '2026-07-03T12:00:00.000Z',
  },
  signatureHex: 'unchecked-under-fake-verify',
});

function seedOpen(
  state: ReturnType<typeof seeded>['state'],
  id: string,
  diffJson: string,
  over: { editorProfileId?: string; createdAt?: string } = {},
) {
  state.suggestions.set(id, {
    id,
    articleId: vectors.suggestion.articleId,
    baseRev: 1,
    editorProfileId: over.editorProfileId ?? 'editor-2',
    type: 'copyedit',
    diffJson,
    citations: [],
    rationale: 'original fix',
    signature: 'sig',
    createdAt: over.createdAt ?? '2026-07-03T10:00:00.000Z',
    status: 'open',
  });
}

const aggregates = (over: Partial<EditorAggregates> = {}): EditorAggregates => ({
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
  ...over,
});

const baseDiff = diffWith([replaceOp(1, 'Beta block two, now with sourcing.')]);
const paraphraseDiff = diffWith([replaceOp(1, 'Beta block two, now with better sourcing.')]);
const otherBlockDiff = diffWith([replaceOp(3, 'A different paragraph entirely, rewritten.')]);

describe('handleSuggestRequest', () => {
  it('accepts the fixture-signed suggestion end to end', async () => {
    const { store, state } = seeded();
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { suggestionId: 'sug-1' } });
    expect(state.suggestions.get('sug-1')?.status).toBe('open');
  });

  it('blocks a suspended editor (suspended 403)', async () => {
    const { store, state } = seeded();
    await store.moderateSuspendProfile({
      profileId: 'editor-1',
      until: '2026-08-01T00:00:00.000Z',
      moderatorRef: 'mod@ops',
      note: 'abuse',
    });
    const res = await handleSuggestRequest(post(validBody()), {
      store,
      now: () => Date.parse('2026-07-03T12:00:00.000Z'),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('suspended');
    expect(state.suggestions.get('sug-1')).toBeUndefined();
  });

  it('rejects tampered rationale with the real verifier', async () => {
    const { store } = seeded();
    const body = validBody();
    body.suggestion = { ...body.suggestion, rationale: 'changed after signing' };
    const res = await handleSuggestRequest(post(body), { store });
    expect((await res.json()).error).toBe('bad-signature');
  });

  it('enforces the citation floor for corrections', async () => {
    const { store } = seeded();
    const body = validBody();
    body.suggestion = { ...body.suggestion, citations: [] };
    const res = await handleSuggestRequest(post(body), { store });
    expect((await res.json()).error).toBe('citation-floor');
  });

  it('rejects non-https citations as bad payload', async () => {
    const { store } = seeded();
    const body = validBody();
    body.suggestion = { ...body.suggestion, citations: ['http://insecure.example'] };
    const res = await handleSuggestRequest(post(body), { store });
    expect((await res.json()).error).toBe('bad-payload');
  });

  it('enforces the open-suggestion cap (low-acceptance throttle)', async () => {
    const { store, state } = seeded();
    state.aggregates.set('editor-1', {
      openCount: 3,
      decidedSampleSize: 40,
      acceptanceRate: 0.1,
      acceptedTotal: 4,
      acceptedCopyedits: 0,
      distinctAuthors: 2,
      endorsementsReceived: 0,
      maxPairShare: 0.5,
      sanctionsInLast90d: 0,
      authorStanding: 0.5,
    });
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('cap-exceeded');
  });

  // A distinct diff on a far-off block so the throttle noise never near-dupes
  // the fixture suggestion (empty ops); only the throttle count is exercised.
  const noiseDiff = diffWith([replaceOp(99, 'Unrelated throttle noise.')]);

  function seedThrottleNoise(
    state: ReturnType<typeof seeded>['state'],
    createdAt: string,
  ) {
    for (let i = 0; i < 20; i++) {
      state.suggestions.set(`noise-${createdAt}-${i}`, {
        id: `noise-${createdAt}-${i}`,
        articleId: vectors.suggestion.articleId,
        baseRev: 1,
        editorProfileId: 'editor-1',
        type: 'copyedit',
        diffJson: noiseDiff,
        citations: [],
        rationale: 'r',
        signature: 'sig',
        createdAt,
        status: 'rejected',
      });
    }
  }

  it('throttles a burst of recent suggestions from one editor (429, before the scan)', async () => {
    const nowMs = Date.parse('2026-07-03T12:00:00.000Z');
    const { store, state } = seeded();
    seedThrottleNoise(state, '2026-07-03T11:59:30.000Z');
    const res = await handleSuggestRequest(post(validBody()), { store, now: () => nowMs });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('rate-limited');
    expect(state.suggestions.get('sug-1')).toBeUndefined();
  });

  it('does not throttle when recent suggestions fall outside the window', async () => {
    const nowMs = Date.parse('2026-07-03T12:00:00.000Z');
    const { store, state } = seeded();
    // 90s ago, past the 60s window.
    seedThrottleNoise(state, '2026-07-03T11:58:30.000Z');
    const res = await handleSuggestRequest(post(validBody()), { store, now: () => nowMs });
    expect(res.status).toBe(200);
    expect(state.suggestions.get('sug-1')?.status).toBe('open');
  });

  it('fails closed with a retryable 503 when the throttle count errors', async () => {
    // Wave 2 alignment with the report and comment throttles: a failed count
    // can never read as an empty window, or a store outage becomes a flood
    // bypass. The user gets an honest retryable state, not a silent allow.
    const { store: base, state } = seeded();
    const store: MyNewsStore = {
      ...base,
      countRecentSuggestions: async () => {
        throw new Error('count boom');
      },
    };
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('suggest-unavailable');
    expect(state.suggestions.size).toBe(0);
  });

  it('requires a registered editor profile and a known article', async () => {
    const empty = createInMemoryMyNewsStore();
    const noProfile = await handleSuggestRequest(post(validBody()), { store: empty.store });
    expect((await noProfile.json()).error).toBe('no-profile');

    const { store, state } = seeded();
    state.articles.clear();
    const unknown = await handleSuggestRequest(post(validBody()), { store });
    expect((await unknown.json()).error).toBe('unknown-article');
    expect(unknown.status).toBe(404);
  });
});

describe('near-dupe collapse', () => {
  it('collapses an identical resubmission into the original and endorses it', async () => {
    const { store, state } = seeded();
    seedOpen(state, 'sug-orig', baseDiff);
    const res = await handleSuggestRequest(post(customBody(baseDiff)), {
      store,
      verify: fakeVerify,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      data: { suggestionId: 'sug-orig', collapsed: true },
    });
    expect(state.suggestions.has('sug-new')).toBe(false);
    expect(state.dupes).toEqual([
      { originalId: 'sug-orig', endorserId: 'editor-1', similarity: 1 },
    ]);
  });

  it('collapses a paraphrase above the threshold with the real similarity', async () => {
    const { store, state } = seeded();
    seedOpen(state, 'sug-orig', baseDiff);
    const res = await handleSuggestRequest(post(customBody(paraphraseDiff)), {
      store,
      verify: fakeVerify,
    });
    expect(await res.json()).toEqual({
      ok: true,
      data: { suggestionId: 'sug-orig', collapsed: true },
    });
    expect(state.suggestions.has('sug-new')).toBe(false);
    expect(state.dupes).toHaveLength(1);
    expect(state.dupes[0]?.similarity).toBeCloseTo(6 / 7, 6);
    expect(state.dupes[0]?.similarity).toBeGreaterThanOrEqual(0.85);
  });

  it('keeps a second endorsement idempotent on the (original, endorser) pair', async () => {
    const { store, state } = seeded();
    seedOpen(state, 'sug-orig', baseDiff);
    const first = await handleSuggestRequest(post(customBody(baseDiff)), {
      store,
      verify: fakeVerify,
    });
    const second = await handleSuggestRequest(post(customBody(paraphraseDiff)), {
      store,
      verify: fakeVerify,
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      ok: true,
      data: { suggestionId: 'sug-orig', collapsed: true },
    });
    expect(state.dupes).toHaveLength(1);
  });

  it('passes a fix aimed at a different block through as a new suggestion', async () => {
    const { store, state } = seeded();
    seedOpen(state, 'sug-orig', baseDiff);
    const res = await handleSuggestRequest(post(customBody(otherBlockDiff)), {
      store,
      verify: fakeVerify,
    });
    expect(await res.json()).toEqual({ ok: true, data: { suggestionId: 'sug-new' } });
    expect(state.suggestions.get('sug-new')?.status).toBe('open');
    expect(state.dupes).toEqual([]);
  });

  it('never records a self-endorsement when the editor re-submits their own fix', async () => {
    const { store, state } = seeded();
    seedOpen(state, 'sug-orig', baseDiff, { editorProfileId: 'editor-1' });
    const res = await handleSuggestRequest(post(customBody(baseDiff)), {
      store,
      verify: fakeVerify,
    });
    expect(await res.json()).toEqual({
      ok: true,
      data: { suggestionId: 'sug-orig', collapsed: true },
    });
    expect(state.suggestions.has('sug-new')).toBe(false);
    expect(state.dupes).toEqual([]);
  });

  it('collapses into the oldest matching original', async () => {
    const { store, state } = seeded();
    seedOpen(state, 'sug-later', paraphraseDiff, { createdAt: '2026-07-03T11:00:00.000Z' });
    seedOpen(state, 'sug-oldest', baseDiff, { createdAt: '2026-07-03T09:00:00.000Z' });
    const res = await handleSuggestRequest(post(customBody(baseDiff)), {
      store,
      verify: fakeVerify,
    });
    expect(await res.json()).toEqual({
      ok: true,
      data: { suggestionId: 'sug-oldest', collapsed: true },
    });
  });

  it('skips open suggestions whose stored diff is malformed', async () => {
    const { store, state } = seeded();
    seedOpen(state, 'sug-broken', '{"not":"a diff"}', { createdAt: '2026-07-03T09:00:00.000Z' });
    seedOpen(state, 'sug-orig', baseDiff, { createdAt: '2026-07-03T10:00:00.000Z' });
    const res = await handleSuggestRequest(post(customBody(baseDiff)), {
      store,
      verify: fakeVerify,
    });
    expect(await res.json()).toEqual({
      ok: true,
      data: { suggestionId: 'sug-orig', collapsed: true },
    });
  });

  it('skips the cap check on the dupe path', async () => {
    const { store, state } = seeded();
    seedOpen(state, 'sug-orig', baseDiff);
    // A cap that would trip on the insert path: throttle floor, openCount over it.
    state.aggregates.set(
      'editor-1',
      aggregates({ openCount: 20, decidedSampleSize: 40, acceptanceRate: 0.1, acceptedTotal: 4 }),
    );
    const res = await handleSuggestRequest(post(customBody(baseDiff)), {
      store,
      verify: fakeVerify,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      data: { suggestionId: 'sug-orig', collapsed: true },
    });
  });
});

describe('draft-scope gate', () => {
  it('denies suggesting on a draft to editors outside the newsroom', async () => {
    const { store, state } = seeded({ article: { status: 'draft', newsroomId: 'room-1' } });
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('draft-access');
    expect(state.suggestions.size).toBe(0);
  });

  it('allows newsroom members to suggest on a draft', async () => {
    const { store, state } = seeded({
      article: { status: 'draft', newsroomId: 'room-1' },
      newsroomMembers: [{ newsroomId: 'room-1', profileId: 'editor-1', role: 'reviewer' }],
    });
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(200);
    expect(state.suggestions.get('sug-1')?.status).toBe('open');
  });

  it('lets the author suggest on their own draft', async () => {
    const { store, state } = seeded({
      article: { status: 'draft', newsroomId: 'room-1', authorProfileId: 'editor-1' },
    });
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(200);
    expect(state.suggestions.get('sug-1')?.status).toBe('open');
  });

  it('denies a draft with no newsroom to non-authors (defensive)', async () => {
    const { store } = seeded({ article: { status: 'draft', newsroomId: null } });
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('draft-access');
  });
});

describe('cap from aggregates v2', () => {
  it('caps copyeditor-level stats at 12 open suggestions', async () => {
    const copyeditor = {
      decidedSampleSize: 40,
      acceptanceRate: 0.8,
      acceptedTotal: 30,
      acceptedCopyedits: 25,
      distinctAuthors: 5,
    };
    const atCap = seeded();
    atCap.state.aggregates.set('editor-1', aggregates({ ...copyeditor, openCount: 12 }));
    const capped = await handleSuggestRequest(post(validBody()), { store: atCap.store });
    expect(capped.status).toBe(429);
    expect((await capped.json()).error).toBe('cap-exceeded');

    const underCap = seeded();
    underCap.state.aggregates.set('editor-1', aggregates({ ...copyeditor, openCount: 11 }));
    const admitted = await handleSuggestRequest(post(validBody()), { store: underCap.store });
    expect(admitted.status).toBe(200);
    expect(underCap.state.suggestions.get('sug-1')?.status).toBe('open');
  });

  it('skips the ledger fetch below MIN_POSSIBLE_CAP and fetches it above', async () => {
    const counting = (store: MyNewsStore) => {
      const calls = { ledger: 0 };
      const wrapped: MyNewsStore = {
        ...store,
        getCredibilityLedger: async (editorId) => {
          calls.ledger += 1;
          return store.getCredibilityLedger(editorId);
        },
      };
      return { wrapped, calls };
    };

    // openCount 0 (computed aggregates for a fresh editor): cap can never trip.
    const fresh = seeded();
    const skip = counting(fresh.store);
    const ok = await handleSuggestRequest(post(validBody()), { store: skip.wrapped });
    expect(ok.status).toBe(200);
    expect(skip.calls.ledger).toBe(0);

    // openCount at the floor: the level math runs and reads the ledger once.
    const busy = seeded();
    busy.state.aggregates.set(
      'editor-1',
      aggregates({ openCount: 3, decidedSampleSize: 10, acceptanceRate: 0.8, acceptedTotal: 1 }),
    );
    const fetch = counting(busy.store);
    const admitted = await handleSuggestRequest(post(validBody()), { store: fetch.wrapped });
    expect(admitted.status).toBe(200);
    expect(fetch.calls.ledger).toBe(1);
  });
});

describe('terms-acceptance gate (suggest, Plan 39 T11)', () => {
  it('rejects a signed-out request with 401', async () => {
    const { store } = seeded();
    const res = await handleSuggestRequest(post(validBody(), { sub: null }), { store });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('not-signed-in');
  });

  it('blocks an editor who has not accepted the current terms', async () => {
    const { store, state } = createInMemoryMyNewsStore({
      profiles: [{ id: 'editor-1', userId: EDITOR_USER_ID, pubkey: vectors.publicKeyHex }],
      // No terms acceptance seeded.
    });
    state.articles.set(vectors.suggestion.articleId, {
      id: vectors.suggestion.articleId,
      slug: 'owens-valley',
      kind: 'news',
      status: 'published',
      authorProfileId: 'author-1',
      authorPubkey: 'author-pub',
      currentRev: 1,
    });
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('terms-not-accepted');
    expect(state.suggestions.size).toBe(0);
  });

  it('re-gates after a version bump (an older acceptance is stale)', async () => {
    const { store, state } = createInMemoryMyNewsStore({
      profiles: [{ id: 'editor-1', userId: EDITOR_USER_ID, pubkey: vectors.publicKeyHex }],
      termsAcceptances: [{ userId: EDITOR_USER_ID, version: '2000-01-01' }],
    });
    state.articles.set(vectors.suggestion.articleId, {
      id: vectors.suggestion.articleId,
      slug: 'owens-valley',
      kind: 'news',
      status: 'published',
      authorProfileId: 'author-1',
      authorPubkey: 'author-pub',
      currentRev: 1,
    });
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('terms-not-accepted');
  });

  it('admits once the current terms are accepted', async () => {
    const { store, state } = seeded();
    const res = await handleSuggestRequest(post(validBody()), { store });
    expect(res.status).toBe(200);
    expect(state.suggestions.get('sug-1')?.status).toBe('open');
  });
});

describe('store: hasAcceptedTerms + getMyModerationNotices scoping (Plan 39 T11)', () => {
  it('answers hasAcceptedTerms only for the exact (user, version) pair', async () => {
    const { store } = createInMemoryMyNewsStore({
      termsAcceptances: [{ userId: 'u1', version: EDGE_CURRENT_TERMS_VERSION }],
    });
    expect(await store.hasAcceptedTerms('u1', EDGE_CURRENT_TERMS_VERSION)).toBe(true);
    expect(await store.hasAcceptedTerms('u1', 'other-version')).toBe(false);
    expect(await store.hasAcceptedTerms('u2', EDGE_CURRENT_TERMS_VERSION)).toBe(false);
  });

  it('returns only statements of reasons for content the caller owns', async () => {
    const ARTICLE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const OTHER_ARTICLE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const { store, state } = createInMemoryMyNewsStore({
      profiles: [
        { id: 'mine', userId: 'u-mine', pubkey: 'mine-pub' },
        { id: 'theirs', userId: 'u-theirs', pubkey: 'theirs-pub' },
      ],
    });
    state.articles.set(ARTICLE_ID, {
      id: ARTICLE_ID,
      slug: 'my-story',
      kind: 'news',
      status: 'published',
      authorProfileId: 'mine',
      authorPubkey: 'mine-pub',
      currentRev: 1,
    });
    state.articles.set(OTHER_ARTICLE_ID, {
      id: OTHER_ARTICLE_ID,
      slug: 'their-story',
      kind: 'news',
      status: 'published',
      authorProfileId: 'theirs',
      authorPubkey: 'theirs-pub',
      currentRev: 1,
    });
    // A moderator hides both articles; each writes an audit row.
    await store.moderateHideArticle({
      articleId: ARTICLE_ID,
      moderatorRef: 'mod@ops',
      note: 'Copyright takedown; see /legal/dmca.',
    });
    await store.moderateHideArticle({
      articleId: OTHER_ARTICLE_ID,
      moderatorRef: 'mod@ops',
      note: 'not yours',
    });

    const mine = await store.getMyModerationNotices('u-mine');
    expect(mine).toHaveLength(1);
    expect(mine[0]?.targetId).toBe(ARTICLE_ID);
    expect(mine[0]?.machineReason).toBe('hide_article');
    expect(mine[0]?.note).toBe('Copyright takedown; see /legal/dmca.');
    // The other author's statement is never leaked.
    expect(mine.some((n) => n.targetId === OTHER_ARTICLE_ID)).toBe(false);

    const theirs = await store.getMyModerationNotices('u-theirs');
    expect(theirs).toHaveLength(1);
    expect(theirs[0]?.targetId).toBe(OTHER_ARTICLE_ID);

    // A user with no content sees nothing.
    expect(await store.getMyModerationNotices('u-nobody')).toEqual([]);
  });

  it('excludes dismiss/restore audit rows from statements of reasons', async () => {
    const SUG_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const { store, state } = createInMemoryMyNewsStore({
      profiles: [{ id: 'ed', userId: 'u-ed', pubkey: 'ed-pub' }],
    });
    state.suggestions.set(SUG_ID, {
      id: SUG_ID,
      articleId: 'some-article',
      baseRev: 1,
      editorProfileId: 'ed',
      type: 'copyedit',
      diffJson: '{}',
      citations: [],
      rationale: 'x',
      signature: 'sig',
      createdAt: '2026-07-04T10:00:00.000Z',
      status: 'open',
    });
    await store.moderateHideSuggestion({
      suggestionId: SUG_ID,
      moderatorRef: 'mod@ops',
      note: 'off-topic',
    });
    const notices = await store.getMyModerationNotices('u-ed');
    expect(notices).toHaveLength(1);
    expect(notices[0]?.machineReason).toBe('hide_suggestion');
  });
});

// Plan 48 WP4. Bounds and the structured-diff shape check run before the
// signature verify and before every store read, so an oversized or malformed
// payload never reaches the near-dupe scan, the cap math, or the insert.
describe('handleSuggestRequest canonical bounds', () => {
  const bodyWith = (over: Record<string, unknown>) => {
    const base = customBody(diffWith([replaceOp(0, 'Tighter wording.')]));
    return { ...base, suggestion: { ...base.suggestion, ...over } };
  };

  it('rejects an over-long rationale', async () => {
    const { store, state } = seeded();
    const res = await handleSuggestRequest(
      post(bodyWith({ rationale: 'r'.repeat(EDGE_MYNEWS_BOUNDS.RATIONALE_MAX_CHARS + 1) })),
      { store, verify: fakeVerify },
    );
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toBe('bounds');
    expect(String(payload.detail)).toContain(String(EDGE_MYNEWS_BOUNDS.RATIONALE_MAX_CHARS));
    expect(state.suggestions.size).toBe(0);
  });

  it('rejects an empty rationale', async () => {
    const { store } = seeded();
    const res = await handleSuggestRequest(post(bodyWith({ rationale: '   ' })), {
      store,
      verify: fakeVerify,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad-payload');
  });

  it('rejects more citations than the ceiling and an over-long citation URL', async () => {
    const { store, state } = seeded();
    const tooMany = Array.from(
      { length: EDGE_MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS + 1 },
      (_, i) => `https://example.org/${i}`,
    );
    const many = await handleSuggestRequest(post(bodyWith({ citations: tooMany })), {
      store,
      verify: fakeVerify,
    });
    expect(many.status).toBe(400);
    expect((await many.json()).error).toBe('bounds');

    const long = await handleSuggestRequest(
      post(
        bodyWith({ citations: [`https://example.org/${'x'.repeat(EDGE_MYNEWS_BOUNDS.URL_MAX_CHARS)}`] }),
      ),
      { store, verify: fakeVerify },
    );
    expect(long.status).toBe(400);
    expect((await long.json()).error).toBe('bounds');
    expect(state.suggestions.size).toBe(0);
  });

  it('accepts a citation list exactly at the ceiling', async () => {
    const { store, state } = seeded();
    const atCap = Array.from(
      { length: EDGE_MYNEWS_BOUNDS.CITATIONS_MAX_ITEMS },
      (_, i) => `https://example.org/${i}`,
    );
    const res = await handleSuggestRequest(post(bodyWith({ citations: atCap })), {
      store,
      verify: fakeVerify,
    });
    expect(res.status).toBe(200);
    expect(state.suggestions.size).toBe(1);
  });

  it('rejects a diff that is not a structured diff', async () => {
    const { store, state } = seeded();
    for (const diffJson of [
      'not json',
      '{}',
      '[]',
      JSON.stringify({ baseHash: 'deadbeef' }),
      JSON.stringify({ ops: [] }),
      diffWith([{ ...replaceOp(0, 'x'), kind: 'obliterate' }]),
      diffWith([{ ...replaceOp(0, 'x'), baseIndex: -1 }]),
      diffWith([{ ...replaceOp(0, 'x'), newBlocks: [42] }]),
    ]) {
      const res = await handleSuggestRequest(post(customBody(diffJson)), {
        store,
        verify: fakeVerify,
      });
      expect(res.status, diffJson.slice(0, 40)).toBe(400);
      expect((await res.json()).error, diffJson.slice(0, 40)).toBe('bad-diff');
    }
    expect(state.suggestions.size).toBe(0);
  });

  it('rejects a diff over the op, block, and byte ceilings', async () => {
    const { store, state } = seeded();
    const tooManyOps = diffWith(
      Array.from({ length: EDGE_MYNEWS_BOUNDS.DIFF_MAX_OPS + 1 }, (_, i) => replaceOp(i, `x${i}`)),
    );
    const tooManyBlocks = diffWith([
      {
        ...replaceOp(0, 'x'),
        newBlocks: new Array(EDGE_MYNEWS_BOUNDS.DIFF_MAX_BLOCKS_PER_OP + 1).fill('x'),
      },
    ]);
    const hugeBlock = diffWith([
      { ...replaceOp(0, 'x'), newBlocks: ['x'.repeat(EDGE_MYNEWS_BOUNDS.DIFF_MAX_BLOCK_CHARS + 1)] },
    ]);
    for (const diffJson of [tooManyOps, tooManyBlocks, hugeBlock]) {
      const res = await handleSuggestRequest(post(customBody(diffJson)), {
        store,
        verify: fakeVerify,
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('bad-diff');
    }

    // Byte ceiling: rejected before the payload is parsed at all.
    const oversized = `{"baseHash":"deadbeef","ops":[],"pad":"${'x'.repeat(
      EDGE_MYNEWS_BOUNDS.DIFF_MAX_BYTES,
    )}"}`;
    const res = await handleSuggestRequest(post(customBody(oversized)), {
      store,
      verify: fakeVerify,
    });
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toBe('bad-diff');
    expect(String(payload.detail)).toContain('bytes');
    expect(state.suggestions.size).toBe(0);
  });
});
