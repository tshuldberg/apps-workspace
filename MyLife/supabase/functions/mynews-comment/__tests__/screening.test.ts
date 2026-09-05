import { describe, expect, it } from 'vitest';

import { handleCommentRequest } from '../index.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';
import { createInMemoryMyNewsStore, type MyNewsStore } from '../../_shared/mynews-store.ts';

/**
 * Comment screening end to end (plan 48 WP8). The assertions that matter are
 * about STATE, not status codes: a held comment must exist in the thread table
 * marked non-public with a decision row beside it, and a clean comment must land
 * exactly as it did before screening existed.
 */

const ACTOR_USER_ID = 'auth-actor-1';
const ACTOR_PROFILE_ID = 'profile-actor-1';
const AUTHOR_PROFILE_ID = 'profile-author-1';
const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const SUGGESTION_ID = '22222222-2222-2222-2222-222222222222';
const NOW_MS = Date.parse('2026-07-30T12:00:00.000Z');

const CLEAN_BODY = 'Good catch on the acre-feet, the clerk record backs this up.';
const HATE_BODY = 'you are nothing but a kike and everyone knows it';
const CHILD_SAFETY_BODY = 'she is 14 yo, send pics and do not tell your parents about it';

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown, sub: string | null = ACTOR_USER_ID): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-comment', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function seededStore() {
  const built = createInMemoryMyNewsStore({
    // Pin the store clock to NOW_MS so allowance expiry never reads the real
    // clock (2026-08-01 CI failure: fixture allowances expired in real time).
    now: () => NOW_MS,
    profiles: [
      { id: ACTOR_PROFILE_ID, userId: ACTOR_USER_ID, pubkey: 'ab'.repeat(32) },
      { id: AUTHOR_PROFILE_ID, userId: 'auth-author-1', pubkey: 'cd'.repeat(32) },
    ],
    termsAcceptances: [{ userId: ACTOR_USER_ID, version: EDGE_CURRENT_TERMS_VERSION }],
  });
  built.state.articles.set(ARTICLE_ID, {
    id: ARTICLE_ID,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: AUTHOR_PROFILE_ID,
    authorPubkey: 'cd'.repeat(32),
    currentRev: 1,
    newsroomId: null,
    publishedAt: '2026-07-01T00:00:00.000Z',
  });
  built.state.suggestions.set(SUGGESTION_ID, {
    id: SUGGESTION_ID,
    articleId: ARTICLE_ID,
    baseRev: 1,
    editorProfileId: ACTOR_PROFILE_ID,
    type: 'correction',
    diffJson: '{"baseHash":"abc","ops":[]}',
    citations: ['https://example.org/1'],
    rationale: 'fix',
    signature: 'sig',
    createdAt: '2026-07-01T00:00:00.000Z',
    status: 'open',
  });
  return built;
}

const deps = (store: MyNewsStore) => ({
  store,
  now: () => NOW_MS,
  // Local-only screening: an unconfigured vendor is the launch state.
  screeningProvider: null,
});

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('comment screening: clean content', () => {
  it('publishes a clean comment exactly as before', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(
      post({ suggestionId: SUGGESTION_ID, body: CLEAN_BODY }),
      deps(store),
    );
    expect(res.status).toBe(200);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]!.action).toBe('comment');
    // No hold marker at all, so every existing public read still sees it.
    expect(state.events[0]!.screeningStatus).toBeUndefined();
    expect(state.screeningDecisions).toHaveLength(0);
  });
});

describe('comment screening: held content', () => {
  it('stores a held comment non-public with a decision row, and does not publish it', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(
      post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }),
      deps(store),
    );
    expect(res.status).toBe(202);
    const body = await readJson(res);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('screening-quarantined');
    expect(String(body.detail)).toContain('not published');

    // Exactly one event, marked non-public.
    expect(state.events).toHaveLength(1);
    expect(state.events[0]!.screeningStatus).toBe('quarantined');
    // Exactly one decision row, pending, attributed to the actor.
    expect(state.screeningDecisions).toHaveLength(1);
    const decision = state.screeningDecisions[0]!;
    expect(decision.contentKind).toBe('comment');
    expect(decision.autoAction).toBe('quarantined');
    expect(decision.decision).toBe('pending');
    expect(decision.authorProfileId).toBe(ACTOR_PROFILE_ID);
    expect(decision.topClass).toBe('hate');
  });

  it('returns the decision id so the author can quote it in an appeal', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(
      post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }),
      deps(store),
    );
    const body = await readJson(res);
    expect(String(body.detail)).toContain(state.screeningDecisions[0]!.id);
  });

  it('writes a statement of reasons at hold time', async () => {
    const { store, state } = seededStore();
    await handleCommentRequest(post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }), deps(store));
    const audit = state.moderationActions.filter((row) => row.action === 'screening_hold');
    expect(audit).toHaveLength(1);
    expect(audit[0]!.moderatorRef).toBe('screening-auto');
    expect(audit[0]!.note).toContain('held for human review');
  });

  it('marks a child-safety hold as requiring human review', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(
      post({ suggestionId: SUGGESTION_ID, body: CHILD_SAFETY_BODY }),
      deps(store),
    );
    expect(res.status).toBe(202);
    const decision = state.screeningDecisions[0]!;
    expect(decision.topClass).toBe('child-safety');
    expect(decision.requiresHumanReview).toBe(true);
  });

  it('surfaces the hold to its author and to nobody else', async () => {
    const { store, state } = seededStore();
    await handleCommentRequest(post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }), deps(store));
    const mine = await store.getMyScreeningDecisions(ACTOR_USER_ID);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.id).toBe(state.screeningDecisions[0]!.id);
    // Curated shape: no scores, no signals, no threshold.
    expect(Object.keys(mine[0]!)).not.toContain('classScores');
    expect(Object.keys(mine[0]!)).not.toContain('thresholdHit');
    expect(await store.getMyScreeningDecisions('auth-author-1')).toHaveLength(0);
  });

  it('lets the author appeal once', async () => {
    const { store, state } = seededStore();
    await handleCommentRequest(post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }), deps(store));
    const decisionId = state.screeningDecisions[0]!.id;
    expect(
      await store.appealScreeningDecision({
        decisionId,
        authorProfileId: ACTOR_PROFILE_ID,
        reason: 'this is a quote from a court filing',
      }),
    ).toBe('ok');
    expect(
      await store.appealScreeningDecision({
        decisionId,
        authorProfileId: ACTOR_PROFILE_ID,
        reason: 'again',
      }),
    ).toBe('already-appealed');
  });

  it('refuses an appeal from someone who does not own the decision', async () => {
    const { store, state } = seededStore();
    await handleCommentRequest(post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }), deps(store));
    expect(
      await store.appealScreeningDecision({
        decisionId: state.screeningDecisions[0]!.id,
        authorProfileId: AUTHOR_PROFILE_ID,
        reason: 'let me out',
      }),
    ).toBe('not-author');
  });
});

describe('comment screening: fail closed', () => {
  it('returns a retryable 503 and writes nothing when screening cannot run', async () => {
    const { store, state } = seededStore();
    const broken: MyNewsStore = {
      ...store,
      screeningAllowanceExists: () => Promise.reject(new Error('db down')),
    };
    const res = await handleCommentRequest(
      post({ suggestionId: SUGGESTION_ID, body: CLEAN_BODY }),
      deps(broken),
    );
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe('screening-unavailable');
    expect(state.events).toHaveLength(0);
    expect(state.screeningDecisions).toHaveLength(0);
  });

  it('returns a retryable 503 and publishes nothing when the hold write fails', async () => {
    const { store, state } = seededStore();
    const broken: MyNewsStore = {
      ...store,
      quarantineComment: async () => ({ ok: false, code: 'unavailable' }),
    };
    const res = await handleCommentRequest(
      post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }),
      deps(broken),
    );
    expect(res.status).toBe(503);
    expect(state.events).toHaveLength(0);
  });

  it('screens before the insert, so a held comment never reaches the normal path', async () => {
    const { store, state } = seededStore();
    let insertCalls = 0;
    const watched: MyNewsStore = {
      ...store,
      insertSuggestionComment: async (input) => {
        insertCalls += 1;
        return store.insertSuggestionComment(input);
      },
    };
    await handleCommentRequest(
      post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }),
      deps(watched),
    );
    expect(insertCalls).toBe(0);
    expect(state.events[0]!.screeningStatus).toBe('quarantined');
  });
});

describe('comment screening: approved bytes go through', () => {
  it('publishes the same bytes normally once an allowance exists', async () => {
    const { store, state } = seededStore();
    // First attempt is held.
    await handleCommentRequest(post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }), deps(store));
    const decision = state.screeningDecisions[0]!;
    expect(state.events[0]!.screeningStatus).toBe('quarantined');

    // A moderator approves, which issues an allowance for exactly those bytes.
    state.screeningAllowances.push({
      authorProfileId: ACTOR_PROFILE_ID,
      contentSha256: await sha256Of(HATE_BODY),
      expiresAt: new Date(NOW_MS + 86_400_000).toISOString(),
    });
    decision.decision = 'approved';

    const res = await handleCommentRequest(
      post({ suggestionId: SUGGESTION_ID, body: HATE_BODY }),
      deps(store),
    );
    expect(res.status).toBe(200);
    // The resubmission landed as a normal comment rather than being held again.
    expect(state.events).toHaveLength(2);
    expect(state.events[1]!.screeningStatus).toBeUndefined();
    expect(state.screeningDecisions).toHaveLength(1);
  });
});

/** Same canonical payload the gate hashes, so the allowance matches. */
async function sha256Of(body: string): Promise<string> {
  const { canonicalScreeningPayload, sha256Hex } = await import(
    '../../_shared/mynews-screening-gate.ts'
  );
  return sha256Hex(canonicalScreeningPayload({ kind: 'comment', text: body }));
}
