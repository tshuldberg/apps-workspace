// Enforcement-layer semantics for the moderation console (Plan 39 T8). These
// exercise the in-memory store, which mirrors the SECURITY DEFINER RPC
// semantics in migration 20260705000007 exactly (state transition + audit row).

import { describe, expect, it } from 'vitest';
import { createInMemoryMyNewsStore } from '../mynews-store.ts';

const REPORTER = 'profile-reporter';
const AUTHOR = 'profile-author';
const EDITOR = 'profile-editor';
const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const SUGGESTION_ID = '22222222-2222-2222-2222-222222222222';

function seeded() {
  const built = createInMemoryMyNewsStore({
    profiles: [
      { id: REPORTER, userId: 'auth-reporter', pubkey: '', handle: 'reporter' },
      { id: AUTHOR, userId: 'auth-author', pubkey: 'ab'.repeat(32), handle: 'author' },
      { id: EDITOR, userId: 'auth-editor', pubkey: 'cd'.repeat(32), handle: 'editor' },
    ],
  });
  built.state.articles.set(ARTICLE_ID, {
    id: ARTICLE_ID,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: AUTHOR,
    authorPubkey: 'ab'.repeat(32),
    currentRev: 1,
    newsroomId: null,
    publishedAt: '2026-07-01T00:00:00.000Z',
  });
  built.state.revisions.push({
    articleId: ARTICLE_ID,
    rev: 1,
    headline: 'Owens Valley water rights',
    bodyMd: 'body',
    changelogJson: '[]',
    createdAt: '2026-07-01T00:00:00.000Z',
    signature: 'sig',
    signerPubkey: 'ab'.repeat(32),
  });
  built.state.suggestions.set(SUGGESTION_ID, {
    id: SUGGESTION_ID,
    articleId: ARTICLE_ID,
    baseRev: 1,
    editorProfileId: EDITOR,
    type: 'correction',
    diffJson: '{}',
    citations: [],
    rationale: 'fix the date',
    signature: 'sig',
    createdAt: '2026-07-01T00:00:00.000Z',
    status: 'open',
  });
  return built;
}

async function seedReport(
  store: ReturnType<typeof seeded>['store'],
  over: { targetKind?: 'article' | 'suggestion' | 'profile' | 'media'; targetId?: string } = {},
) {
  await store.insertReport({
    reporterProfileId: REPORTER,
    targetKind: over.targetKind ?? 'article',
    targetId: over.targetId ?? ARTICLE_ID,
    reason: 'harassment',
    detail: 'abuse',
  });
}

describe('moderation queue read', () => {
  it('returns open reports newest-first with article context', async () => {
    const { store } = seeded();
    await seedReport(store);
    const queue = await store.getOpenReportQueue(50);
    expect(queue).toHaveLength(1);
    expect(queue[0]?.targetKind).toBe('article');
    expect(queue[0]?.targetContext).toEqual({
      kind: 'article',
      slug: 'owens-valley',
      status: 'published',
      authorProfileId: AUTHOR,
      headline: 'Owens Valley water rights',
    });
  });

  it('hydrates suggestion, profile, and media context', async () => {
    const { store } = seeded();
    await seedReport(store, { targetKind: 'suggestion', targetId: SUGGESTION_ID });
    await seedReport(store, { targetKind: 'profile', targetId: AUTHOR });
    await seedReport(store, { targetKind: 'media', targetId: 'blob:xyz' });
    const queue = await store.getOpenReportQueue(50);
    const byKind = Object.fromEntries(queue.map((q) => [q.targetKind, q.targetContext]));
    expect(byKind.suggestion).toMatchObject({ kind: 'suggestion', status: 'open', editorProfileId: EDITOR });
    expect(byKind.profile).toMatchObject({ kind: 'profile', handle: 'author', suspendedUntil: null });
    expect(byKind.media).toEqual({ kind: 'media', ref: 'blob:xyz' });
  });

  it('leaves target context null when the target no longer resolves', async () => {
    const { store } = seeded();
    await seedReport(store, { targetKind: 'article', targetId: 'deadbeef-0000-0000-0000-000000000000' });
    const queue = await store.getOpenReportQueue(50);
    expect(queue[0]?.targetContext).toBeNull();
  });

  it('excludes resolved reports from the queue', async () => {
    const { store } = seeded();
    await seedReport(store);
    const before = await store.getOpenReportQueue(50);
    await store.moderateResolveReport({
      reportId: before[0]!.id,
      status: 'no_action',
      moderatorRef: 'mod@ops',
      note: 'not abusive',
    });
    expect(await store.getOpenReportQueue(50)).toHaveLength(0);
  });
});

describe('enforcement RPCs transition state + write audit', () => {
  it('hide_article retracts the article and audits', async () => {
    const { store, state } = seeded();
    const res = await store.moderateHideArticle({
      articleId: ARTICLE_ID,
      moderatorRef: 'mod@ops',
      note: 'defamatory',
    });
    expect(res).toBe('ok');
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('retracted');
    expect(state.moderationActions).toHaveLength(1);
    expect(state.moderationActions[0]).toMatchObject({
      action: 'hide_article',
      targetKind: 'article',
      targetId: ARTICLE_ID,
      moderatorRef: 'mod@ops',
      note: 'defamatory',
    });
  });

  it('hide_article returns not-found for an unknown article and audits nothing', async () => {
    const { store, state } = seeded();
    const res = await store.moderateHideArticle({
      articleId: 'ffffffff-0000-0000-0000-000000000000',
      moderatorRef: 'mod@ops',
      note: '',
    });
    expect(res).toBe('not-found');
    expect(state.moderationActions).toHaveLength(0);
  });

  it('hide_suggestion rejects the suggestion and audits', async () => {
    const { store, state } = seeded();
    const res = await store.moderateHideSuggestion({
      suggestionId: SUGGESTION_ID,
      moderatorRef: 'mod@ops',
      note: 'spam',
      reportId: null,
    });
    expect(res).toBe('ok');
    expect(state.suggestions.get(SUGGESTION_ID)?.status).toBe('rejected');
    expect(state.moderationActions[0]).toMatchObject({ action: 'hide_suggestion', targetId: SUGGESTION_ID });
  });

  it('suspend_profile sets suspended_until and audits; restore lifts it', async () => {
    const { store, state } = seeded();
    const suspend = await store.moderateSuspendProfile({
      profileId: EDITOR,
      until: '2026-08-01T00:00:00.000Z',
      moderatorRef: 'mod@ops',
      note: 'harassment',
    });
    expect(suspend).toBe('ok');
    expect(await store.isProfileSuspended(EDITOR, '2026-07-10T00:00:00.000Z')).toBe(true);
    expect(state.moderationActions[0]?.action).toBe('suspend_profile');

    const restore = await store.moderateSuspendProfile({
      profileId: EDITOR,
      until: null,
      moderatorRef: 'mod@ops',
      note: 'appeal granted',
    });
    expect(restore).toBe('ok');
    expect(await store.isProfileSuspended(EDITOR, '2026-07-10T00:00:00.000Z')).toBe(false);
    expect(state.moderationActions[1]?.action).toBe('restore');
  });

  it('resolve_report moves open -> actioned and audits, and refuses a non-open report', async () => {
    const { store, state } = seeded();
    await seedReport(store);
    const { id } = (await store.getOpenReportQueue(1))[0]!;
    const first = await store.moderateResolveReport({
      reportId: id,
      status: 'actioned',
      moderatorRef: 'mod@ops',
      note: 'removed',
    });
    expect(first).toBe('ok');
    expect(state.reports[0]?.status).toBe('actioned');
    expect(state.moderationActions.at(-1)?.reportId).toBe(id);

    const again = await store.moderateResolveReport({
      reportId: id,
      status: 'no_action',
      moderatorRef: 'mod@ops',
      note: 'double',
    });
    expect(again).toBe('not-open');
  });

  it('rejects a blank moderator ref on every RPC', async () => {
    const { store } = seeded();
    await seedReport(store);
    const { id } = (await store.getOpenReportQueue(1))[0]!;
    expect(
      await store.moderateHideArticle({ articleId: ARTICLE_ID, moderatorRef: '  ', note: '' }),
    ).toBe('bad-moderator');
    expect(
      await store.moderateHideSuggestion({ suggestionId: SUGGESTION_ID, moderatorRef: '', note: '' }),
    ).toBe('bad-moderator');
    expect(
      await store.moderateSuspendProfile({ profileId: EDITOR, until: null, moderatorRef: '', note: '' }),
    ).toBe('bad-moderator');
    expect(
      await store.moderateResolveReport({ reportId: id, status: 'actioned', moderatorRef: '', note: '' }),
    ).toBe('bad-moderator');
  });

  /* ------------------- appeals against actions (plan 48 WP9) --------------- */

  it('lets the owner appeal an adverse action once, and nobody else at all', async () => {
    const { store, state } = seeded();
    await store.moderateHideArticle({
      articleId: ARTICLE_ID,
      moderatorRef: 'mod@ops',
      note: 'removed',
    });
    const actionId = state.moderationActions.at(-1)!.id!;
    expect(actionId).toBeTruthy();

    // Someone else's action and a missing action answer identically, so this
    // cannot be used to probe which action ids exist.
    expect(
      await store.appealModerationAction({
        appellantProfileId: EDITOR,
        actionId,
        reason: 'not my article',
      }),
    ).toBe('not-found');
    expect(
      await store.appealModerationAction({
        appellantProfileId: AUTHOR,
        actionId: 'no-such-action',
        reason: 'fishing',
      }),
    ).toBe('not-found');

    expect(
      await store.appealModerationAction({
        appellantProfileId: AUTHOR,
        actionId,
        reason: 'this was a quote',
      }),
    ).toBe('ok');
    expect(
      await store.appealModerationAction({
        appellantProfileId: AUTHOR,
        actionId,
        reason: 'again',
      }),
    ).toBe('already-appealed');

    const notices = await store.getMyModerationNotices('auth-author');
    expect(notices[0]?.appealState).toBe('requested');
    expect(notices[0]?.appealReason).toBe('this was a quote');
  });

  it('refuses an appeal with no reason', async () => {
    const { store, state } = seeded();
    await store.moderateHideArticle({ articleId: ARTICLE_ID, moderatorRef: 'mod@ops', note: '' });
    const actionId = state.moderationActions.at(-1)!.id!;
    for (const reason of ['', '   ', 'x'.repeat(2001)]) {
      expect(
        await store.appealModerationAction({ appellantProfileId: AUTHOR, actionId, reason }),
      ).toBe('bad-reason');
    }
  });

  it('refuses to appeal a non-adverse action', async () => {
    const { store, state } = seeded();
    await seedReport(store);
    const { id } = (await store.getOpenReportQueue(1))[0]!;
    // Resolving a report writes a 'dismiss' or 'restore' row. Neither is an
    // adverse action against the user, so neither is appealable.
    await store.moderateResolveReport({
      reportId: id,
      status: 'no_action',
      moderatorRef: 'mod@ops',
      note: 'nothing wrong here',
    });
    const actionId = state.moderationActions.at(-1)!.id!;
    expect(
      await store.appealModerationAction({
        appellantProfileId: AUTHOR,
        actionId,
        reason: 'I want this reversed too',
      }),
    ).toBe('not-appealable');
  });

  it('gives every recorded action a distinct id', async () => {
    const { store, state } = seeded();
    await store.moderateHideArticle({ articleId: ARTICLE_ID, moderatorRef: 'mod@ops', note: 'one' });
    await store.moderateHideSuggestion({
      suggestionId: SUGGESTION_ID,
      moderatorRef: 'mod@ops',
      note: 'two',
    });
    const ids = state.moderationActions.map((row) => row.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
