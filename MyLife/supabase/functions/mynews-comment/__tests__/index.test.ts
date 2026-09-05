import { describe, expect, it } from 'vitest';
import { handleCommentRequest } from '../index.ts';
import { EDGE_MYNEWS_BOUNDS } from '../../_shared/mynews-bounds.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';
import {
  createInMemoryMyNewsStore,
  type MyNewsStore,
} from '../../_shared/mynews-store.ts';

const ACTOR_USER_ID = 'auth-actor-1';
const ACTOR_PROFILE_ID = 'profile-actor-1';
const AUTHOR_PROFILE_ID = 'profile-author-1';
const AUTHOR_USER_ID = 'auth-author-1';
const OUTSIDER_PROFILE_ID = 'profile-outsider-1';
const OUTSIDER_USER_ID = 'auth-outsider-1';
const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const DRAFT_ARTICLE_ID = '44444444-4444-4444-4444-444444444444';
const SUGGESTION_ID = '22222222-2222-2222-2222-222222222222';
const DRAFT_SUGGESTION_ID = '55555555-5555-5555-5555-555555555555';
const NEWSROOM_ID = '66666666-6666-6666-6666-666666666666';
const NOW_MS = Date.parse('2026-07-30T12:00:00.000Z');

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown, sub: string | null): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-comment', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Published article + open suggestion + a newsroom-scoped draft with its own
 * suggestion. Actor, author, and an unaffiliated outsider all accept the
 * current terms so a test only has to remove what it is asserting on.
 */
function seededStore(overrides?: { suspendedUntil?: string | null; acceptTerms?: boolean }) {
  const built = createInMemoryMyNewsStore({
    profiles: [
      {
        id: ACTOR_PROFILE_ID,
        userId: ACTOR_USER_ID,
        pubkey: 'ab'.repeat(32),
        suspendedUntil: overrides?.suspendedUntil ?? null,
      },
      { id: AUTHOR_PROFILE_ID, userId: AUTHOR_USER_ID, pubkey: 'cd'.repeat(32) },
      { id: OUTSIDER_PROFILE_ID, userId: OUTSIDER_USER_ID, pubkey: 'ef'.repeat(32) },
    ],
    newsroomMembers: [{ newsroomId: NEWSROOM_ID, profileId: ACTOR_PROFILE_ID, role: 'reviewer' }],
    termsAcceptances:
      overrides?.acceptTerms === false
        ? []
        : [
            { userId: ACTOR_USER_ID, version: EDGE_CURRENT_TERMS_VERSION },
            { userId: AUTHOR_USER_ID, version: EDGE_CURRENT_TERMS_VERSION },
            { userId: OUTSIDER_USER_ID, version: EDGE_CURRENT_TERMS_VERSION },
          ],
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
  built.state.articles.set(DRAFT_ARTICLE_ID, {
    id: DRAFT_ARTICLE_ID,
    slug: 'aqueduct-draft',
    kind: 'news',
    status: 'draft',
    authorProfileId: AUTHOR_PROFILE_ID,
    authorPubkey: 'cd'.repeat(32),
    currentRev: 1,
    newsroomId: NEWSROOM_ID,
    publishedAt: null,
  });
  for (const [id, articleId] of [
    [SUGGESTION_ID, ARTICLE_ID],
    [DRAFT_SUGGESTION_ID, DRAFT_ARTICLE_ID],
  ] as const) {
    built.state.suggestions.set(id, {
      id,
      articleId,
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
  }
  return built;
}

const validBody = () => ({ suggestionId: SUGGESTION_ID, body: 'Good catch on the acre-feet.' });

const deps = (store: MyNewsStore) => ({ store, now: () => NOW_MS });

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('handleCommentRequest', () => {
  it('rejects non-POST', async () => {
    const { store } = seededStore();
    const res = await handleCommentRequest(
      new Request('http://local/mynews-comment', { method: 'GET' }),
      deps(store),
    );
    expect(res.status).toBe(405);
  });

  it('rejects a missing session (anonymous comment flood is closed)', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(post(validBody(), null), deps(store));
    expect(res.status).toBe(401);
    expect((await readJson(res)).error).toBe('not-signed-in');
    expect(state.events).toHaveLength(0);
  });

  it('rejects a session with no profile row', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(post(validBody(), 'auth-stranger'), deps(store));
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('no-profile');
    expect(state.events).toHaveLength(0);
  });

  it('blocks a suspended commenter', async () => {
    const { store, state } = seededStore({ suspendedUntil: '2026-08-30T00:00:00.000Z' });
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(store));
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('suspended');
    expect(state.events).toHaveLength(0);
  });

  it('lets a lapsed suspension comment again', async () => {
    const { store, state } = seededStore({ suspendedUntil: '2026-07-01T00:00:00.000Z' });
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(store));
    expect(res.status).toBe(200);
    expect(state.events).toHaveLength(1);
  });

  it('requires acceptance of the CURRENT terms version', async () => {
    const { store, state } = seededStore({ acceptTerms: false });
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(store));
    expect(res.status).toBe(403);
    const payload = await readJson(res);
    expect(payload.error).toBe('terms-not-accepted');
    expect(payload.detail).toBe(EDGE_CURRENT_TERMS_VERSION);
    expect(state.events).toHaveLength(0);
  });

  it('rejects an acceptance of a stale terms version', async () => {
    const built = createInMemoryMyNewsStore({
      profiles: [{ id: ACTOR_PROFILE_ID, userId: ACTOR_USER_ID, pubkey: '' }],
      termsAcceptances: [{ userId: ACTOR_USER_ID, version: '2020-01-01' }],
    });
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(built.store));
    expect((await readJson(res)).error).toBe('terms-not-accepted');
  });

  it('throttles at ten comments per minute per profile', async () => {
    const { store, state } = seededStore();
    for (let i = 0; i < 10; i++) {
      state.events.push({
        suggestionId: SUGGESTION_ID,
        actorProfileId: ACTOR_PROFILE_ID,
        action: 'comment',
        payload: { body: `earlier ${i}` },
        createdAt: new Date(NOW_MS - 1000).toISOString(),
      });
    }
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(store));
    expect(res.status).toBe(429);
    expect((await readJson(res)).error).toBe('rate-limited');
    expect(state.events).toHaveLength(10);
  });

  it('counts only this profile, only comments, and only inside the window', async () => {
    const { store, state } = seededStore();
    for (let i = 0; i < 10; i++) {
      // Another profile's comments, this profile's decision events, and this
      // profile's comments from before the window must not count.
      state.events.push({
        suggestionId: SUGGESTION_ID,
        actorProfileId: AUTHOR_PROFILE_ID,
        action: 'comment',
        payload: { body: 'other profile' },
        createdAt: new Date(NOW_MS - 1000).toISOString(),
      });
      state.events.push({
        suggestionId: SUGGESTION_ID,
        actorProfileId: ACTOR_PROFILE_ID,
        action: 'reject',
        payload: {},
        createdAt: new Date(NOW_MS - 1000).toISOString(),
      });
      state.events.push({
        suggestionId: SUGGESTION_ID,
        actorProfileId: ACTOR_PROFILE_ID,
        action: 'comment',
        payload: { body: 'stale' },
        createdAt: new Date(NOW_MS - 61_000).toISOString(),
      });
    }
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(store));
    expect(res.status).toBe(200);
  });

  it('fails closed with a retryable 503 when the throttle count throws', async () => {
    const { store, state } = seededStore();
    const failing: MyNewsStore = {
      ...store,
      countRecentSuggestionComments: async () => {
        throw new Error('postgrest down');
      },
    };
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(failing));
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe('comment-unavailable');
    expect(state.events).toHaveLength(0);
  });

  it('rejects a malformed payload', async () => {
    const { store } = seededStore();
    for (const body of [
      {},
      { suggestionId: SUGGESTION_ID },
      { suggestionId: '   ', body: 'hi' },
      { suggestionId: SUGGESTION_ID, body: 42 },
    ]) {
      const res = await handleCommentRequest(post(body, ACTOR_USER_ID), deps(store));
      expect(res.status).toBe(400);
      expect((await readJson(res)).error).toBe('bad-payload');
    }
  });

  it('rejects an empty and an over-long body with the typed bounds error', async () => {
    const { store, state } = seededStore();
    const empty = await handleCommentRequest(
      post({ suggestionId: SUGGESTION_ID, body: '   ' }, ACTOR_USER_ID),
      deps(store),
    );
    expect(empty.status).toBe(400);
    expect((await readJson(empty)).error).toBe('bounds');

    const long = await handleCommentRequest(
      post(
        { suggestionId: SUGGESTION_ID, body: 'x'.repeat(EDGE_MYNEWS_BOUNDS.COMMENT_MAX_CHARS + 1) },
        ACTOR_USER_ID,
      ),
      deps(store),
    );
    expect(long.status).toBe(400);
    const payload = await readJson(long);
    expect(payload.error).toBe('bounds');
    expect(payload.detail).toContain(String(EDGE_MYNEWS_BOUNDS.COMMENT_MAX_CHARS));
    expect(state.events).toHaveLength(0);
  });

  it('accepts a body exactly at the character ceiling', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(
      post(
        { suggestionId: SUGGESTION_ID, body: 'x'.repeat(EDGE_MYNEWS_BOUNDS.COMMENT_MAX_CHARS) },
        ACTOR_USER_ID,
      ),
      deps(store),
    );
    expect(res.status).toBe(200);
    expect(state.events).toHaveLength(1);
  });

  it('rejects a comment on an unknown suggestion', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(
      post({ suggestionId: '99999999-9999-9999-9999-999999999999', body: 'hi' }, ACTOR_USER_ID),
      deps(store),
    );
    expect(res.status).toBe(404);
    expect((await readJson(res)).error).toBe('unknown-suggestion');
    expect(state.events).toHaveLength(0);
  });

  it('hides a draft thread from a non-member', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(
      post({ suggestionId: DRAFT_SUGGESTION_ID, body: 'peeking' }, OUTSIDER_USER_ID),
      deps(store),
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('draft-access');
    expect(state.events).toHaveLength(0);
  });

  it('lets a newsroom member and the author comment on a draft thread', async () => {
    const { store, state } = seededStore();
    const member = await handleCommentRequest(
      post({ suggestionId: DRAFT_SUGGESTION_ID, body: 'reviewer note' }, ACTOR_USER_ID),
      deps(store),
    );
    expect(member.status).toBe(200);
    const author = await handleCommentRequest(
      post({ suggestionId: DRAFT_SUGGESTION_ID, body: 'author note' }, AUTHOR_USER_ID),
      deps(store),
    );
    expect(author.status).toBe(200);
    expect(state.events).toHaveLength(2);
  });

  it('persists the comment event with the actor, action, and body', async () => {
    const { store, state } = seededStore();
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(store));
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true, data: { suggestionId: SUGGESTION_ID } });
    expect(state.events).toEqual([
      {
        suggestionId: SUGGESTION_ID,
        actorProfileId: ACTOR_PROFILE_ID,
        action: 'comment',
        payload: { body: 'Good catch on the acre-feet.' },
        createdAt: expect.any(String),
      },
    ]);
  });

  it('never reports success when the insert RPC refuses the row', async () => {
    const { store, state } = seededStore();
    const refusing: MyNewsStore = {
      ...store,
      insertSuggestionComment: async () => 'bad-payload',
    };
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(refusing));
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe('comment-unavailable');
    expect(state.events).toHaveLength(0);
  });

  it('maps an unknown actor from the RPC to no-profile', async () => {
    const { store } = seededStore();
    const refusing: MyNewsStore = {
      ...store,
      insertSuggestionComment: async () => 'unknown-actor',
    };
    const res = await handleCommentRequest(post(validBody(), ACTOR_USER_ID), deps(refusing));
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('no-profile');
  });
});

describe('in-memory comment store twin', () => {
  it('mirrors the RPC check order: bounds, then suggestion, then actor', async () => {
    const { store } = seededStore();
    expect(
      await store.insertSuggestionComment({
        suggestionId: SUGGESTION_ID,
        actorProfileId: ACTOR_PROFILE_ID,
        body: '',
      }),
    ).toBe('bad-payload');
    expect(
      await store.insertSuggestionComment({
        suggestionId: '99999999-9999-9999-9999-999999999999',
        actorProfileId: ACTOR_PROFILE_ID,
        body: 'hi',
      }),
    ).toBe('unknown-suggestion');
    expect(
      await store.insertSuggestionComment({
        suggestionId: SUGGESTION_ID,
        actorProfileId: 'profile-nobody',
        body: 'hi',
      }),
    ).toBe('unknown-actor');
    expect(
      await store.insertSuggestionComment({
        suggestionId: SUGGESTION_ID,
        actorProfileId: ACTOR_PROFILE_ID,
        body: 'hi',
      }),
    ).toBe('ok');
  });
});
