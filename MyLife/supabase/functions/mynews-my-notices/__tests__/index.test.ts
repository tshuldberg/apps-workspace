import { describe, expect, it } from 'vitest';
import { APPEAL_REASON_MAX_CHARS, handleMyNoticesRequest, parseAppealBody } from '../index.ts';
import { createInMemoryMyNewsStore } from '../../_shared/mynews-store.ts';

const MINE_USER = 'auth-mine';
const ARTICLE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_ARTICLE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function req(sub: string | null, query = ''): Request {
  const headers: Record<string, string> = {};
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request(`http://local/mynews-my-notices${query}`, { method: 'GET', headers });
}

/** POST an appeal body (plan 48 WP9). */
function appealReq(sub: string | null, body: unknown): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-my-notices', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** The action id of the caller's own hidden article, from the notices read. */
async function ownActionId(
  store: Parameters<typeof handleMyNoticesRequest>[1]['store'],
): Promise<string> {
  const res = await handleMyNoticesRequest(req(MINE_USER), { store });
  const { data } = await res.json();
  return data.notices[0].actionId as string;
}

async function seeded() {
  const { store, state } = createInMemoryMyNewsStore({
    profiles: [
      { id: 'mine', userId: MINE_USER, pubkey: 'mine-pub' },
      { id: 'theirs', userId: 'auth-theirs', pubkey: 'theirs-pub' },
    ],
    authEmails: [{ userId: MINE_USER, email: 'mine@example.com' }],
  });
  for (const [id, authorProfileId, pubkey] of [
    [ARTICLE_ID, 'mine', 'mine-pub'],
    [OTHER_ARTICLE_ID, 'theirs', 'theirs-pub'],
  ] as const) {
    state.articles.set(id, {
      id,
      slug: id,
      kind: 'news',
      status: 'published',
      authorProfileId,
      authorPubkey: pubkey,
      currentRev: 1,
    });
  }
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
  const dmca = await store.submitDmcaTakedown({
    submitterProfileId: 'mine',
    complainantName: 'Mine Rights',
    complainantEmail: 'mine@example.com',
    complainantAddress: '1 Main St',
    copyrightedWork: 'My article',
    infringingUrl: `https://mynews.app/article/${ARTICLE_ID}`,
    goodFaith: true,
    goodFaithAttestationText:
      'I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.',
    goodFaithAttestationVersion: '2026-07-12',
    accuracyUnderPenalty: true,
    accuracyAttestationText:
      'I state under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.',
    accuracyAttestationVersion: '2026-07-12',
    signature: 'Mine Rights',
  });
  return { store, state, dmcaReferenceId: dmca.referenceId ?? '' };
}

describe('handleMyNoticesRequest', () => {
  it('rejects a signed-out request with 401', async () => {
    const { store } = await seeded();
    const res = await handleMyNoticesRequest(req(null), { store });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('not-signed-in');
  });

  it('returns only the caller\'s own statements of reasons', async () => {
    const { store } = await seeded();
    const res = await handleMyNoticesRequest(req(MINE_USER), { store });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.notices).toHaveLength(1);
    expect(data.notices[0].targetId).toBe(ARTICLE_ID);
    expect(data.notices[0].machineReason).toBe('hide_article');
    expect(data.notices[0].note).toBe('Copyright takedown; see /legal/dmca.');
  });

  it('returns an empty list for a user with no moderated content', async () => {
    const { store } = await seeded();
    const res = await handleMyNoticesRequest(req('auth-nobody'), { store });
    expect(res.status).toBe(200);
    expect((await res.json()).data.notices).toEqual([]);
  });

  it('returns the caller submission status for matching account email, kind, and notice id', async () => {
    const { store, dmcaReferenceId } = await seeded();
    const query = `?kind=takedown&noticeId=${encodeURIComponent(dmcaReferenceId)}&email=mine%40example.com`;
    const res = await handleMyNoticesRequest(req(MINE_USER, query), { store });
    expect(res.status).toBe(200);
    expect((await res.json()).data.dmcaSubmission).toMatchObject({
      referenceId: dmcaReferenceId,
      kind: 'takedown',
      status: 'received',
    });
  });

  it('does not disclose status for a mismatched email and rejects partial lookup credentials', async () => {
    const { store, dmcaReferenceId } = await seeded();
    const mismatch = await handleMyNoticesRequest(
      req(
        MINE_USER,
        `?kind=takedown&noticeId=${encodeURIComponent(dmcaReferenceId)}&email=other%40example.com`,
      ),
      { store },
    );
    expect(mismatch.status).toBe(200);
    expect((await mismatch.json()).data.dmcaSubmission).toBeNull();

    const partial = await handleMyNoticesRequest(
      req(MINE_USER, `?noticeId=${encodeURIComponent(dmcaReferenceId)}`),
      { store },
    );
    expect(partial.status).toBe(400);
  });

  it('rejects non-GET/POST methods', async () => {
    const { store } = await seeded();
    const res = await handleMyNoticesRequest(
      new Request('http://local/mynews-my-notices', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwtFor(MINE_USER)}` },
      }),
      { store },
    );
    expect(res.status).toBe(405);
  });

  /* ---------------------------- appeals (plan 48 WP9) ---------------------- */

  it('carries the action id and appeal state on every notice', async () => {
    const { store } = await seeded();
    const res = await handleMyNoticesRequest(req(MINE_USER), { store });
    const notice = (await res.json()).data.notices[0];
    // Without an action id there is nothing for an appeal to name.
    expect(typeof notice.actionId).toBe('string');
    expect(notice.actionId.length).toBeGreaterThan(0);
    expect(notice.appealState).toBe('none');
  });

  it('records an appeal against the caller\'s own action, once', async () => {
    const { store } = await seeded();
    const actionId = await ownActionId(store);

    const first = await handleMyNoticesRequest(
      appealReq(MINE_USER, { action: 'appeal', actionId, reason: 'I hold the licence' }),
      { store },
    );
    expect(first.status).toBe(200);
    expect((await first.json()).data.appealState).toBe('requested');

    // The state comes back on the next read, so the app can show it.
    const after = await handleMyNoticesRequest(req(MINE_USER), { store });
    expect((await after.json()).data.notices[0].appealState).toBe('requested');

    const second = await handleMyNoticesRequest(
      appealReq(MINE_USER, { action: 'appeal', actionId, reason: 'again' }),
      { store },
    );
    expect(second.status).toBe(409);
    expect((await second.json()).error).toBe('already-appealed');
  });

  it('answers not-found for someone else\'s action, exactly like a missing one', async () => {
    const { store } = await seeded();
    const actionId = await ownActionId(store);

    // 'auth-theirs' owns the OTHER article, so this action is not theirs.
    const notMine = await handleMyNoticesRequest(
      appealReq('auth-theirs', { action: 'appeal', actionId, reason: 'not mine' }),
      { store },
    );
    const missing = await handleMyNoticesRequest(
      appealReq('auth-theirs', { action: 'appeal', actionId: 'no-such-action', reason: 'fishing' }),
      { store },
    );
    expect(notMine.status).toBe(404);
    expect(missing.status).toBe(404);
    // Identical answers: this cannot be used to probe which action ids exist.
    expect(await notMine.json()).toEqual(await missing.json());
  });

  it('requires a reason', async () => {
    const { store } = await seeded();
    const actionId = await ownActionId(store);
    for (const reason of ['', '   ', 'x'.repeat(APPEAL_REASON_MAX_CHARS + 1)]) {
      const res = await handleMyNoticesRequest(
        appealReq(MINE_USER, { action: 'appeal', actionId, reason }),
        { store },
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('bad-payload');
    }
  });

  it('rejects a malformed action id at the handler, before the store sees it', async () => {
    const { store } = await seeded();
    let reached = false;
    const watched = {
      ...store,
      appealModerationAction: (input: Parameters<typeof store.appealModerationAction>[0]) => {
        reached = true;
        return store.appealModerationAction(input);
      },
    } as typeof store;
    const res = await handleMyNoticesRequest(
      // A non-string action id is a client bug, not a missing record, so the
      // handler answers 400 rather than passing it down as a 404.
      appealReq(MINE_USER, { action: 'appeal', actionId: 7, reason: 'valid reason' }),
      { store: watched },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad-payload');
    expect(reached).toBe(false);
  });

  it('fails closed on an outcome it does not recognise', async () => {
    const { store } = await seeded();
    const actionId = await ownActionId(store);
    const odd = {
      ...store,
      // A future store returning a code this handler has never seen must not be
      // reported to the user as a filed appeal.
      appealModerationAction: () => Promise.resolve('something-new' as never),
    } as typeof store;
    const res = await handleMyNoticesRequest(
      appealReq(MINE_USER, { action: 'appeal', actionId, reason: 'unknown outcome' }),
      { store: odd },
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('appeals-unavailable');
  });

  it('rejects a signed-out appeal before touching the store', async () => {
    const { store } = await seeded();
    const res = await handleMyNoticesRequest(
      appealReq(null, { action: 'appeal', actionId: 'anything', reason: 'let me in' }),
      { store },
    );
    expect(res.status).toBe(401);
  });

  it('refuses an appeal from a user with no profile', async () => {
    const { store } = await seeded();
    const actionId = await ownActionId(store);
    const res = await handleMyNoticesRequest(
      appealReq('auth-nobody', { action: 'appeal', actionId, reason: 'no profile here' }),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('no-profile');
  });

  it('fails closed with a retryable error when the appeal write fails', async () => {
    const { store } = await seeded();
    const actionId = await ownActionId(store);
    const broken = {
      ...store,
      appealModerationAction: () => Promise.reject(new Error('db down')),
    } as typeof store;
    const res = await handleMyNoticesRequest(
      appealReq(MINE_USER, { action: 'appeal', actionId, reason: 'this should not be recorded' }),
      { store: broken },
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('appeals-unavailable');
    // And nothing was recorded, so the user was not told an appeal exists.
    const after = await handleMyNoticesRequest(req(MINE_USER), { store });
    expect((await after.json()).data.notices[0].appealState).toBe('none');
  });

  it('still serves the read for a POST that carries no action', async () => {
    const { store } = await seeded();
    const res = await handleMyNoticesRequest(
      new Request('http://local/mynews-my-notices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtFor(MINE_USER)}` },
      }),
      { store },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.notices).toHaveLength(1);
  });
});

describe('parseAppealBody', () => {
  const valid = { action: 'appeal', actionId: 'a1', reason: 'because' };

  it('accepts a well-formed appeal and trims it', () => {
    expect(parseAppealBody({ action: 'appeal', actionId: ' a1 ', reason: ' because ' })).toEqual(
      valid,
    );
  });

  it.each([
    ['null', null],
    ['a string', 'appeal'],
    ['an array', [valid]],
    ['a different action', { ...valid, action: 'withdraw' }],
    ['a missing action', { actionId: 'a1', reason: 'because' }],
    ['a blank action id', { ...valid, actionId: '   ' }],
    ['a non-string action id', { ...valid, actionId: 7 }],
    ['a blank reason', { ...valid, reason: '  ' }],
    ['a non-string reason', { ...valid, reason: { text: 'because' } }],
    ['an over-long reason', { ...valid, reason: 'x'.repeat(APPEAL_REASON_MAX_CHARS + 1) }],
  ])('rejects %s', (_label, body) => {
    expect(parseAppealBody(body)).toBeNull();
  });

  it('accepts a reason exactly at the limit', () => {
    const reason = 'x'.repeat(APPEAL_REASON_MAX_CHARS);
    expect(parseAppealBody({ ...valid, reason })?.reason).toBe(reason);
  });
});
