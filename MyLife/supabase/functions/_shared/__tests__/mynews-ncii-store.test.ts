// NCII / TAKE IT DOWN case semantics (Plan 39 T10). These exercise the
// in-memory store, which mirrors the SECURITY DEFINER RPC semantics in migration
// 20260705000009 exactly: take-down-first intake, fail-closed enforcement, and
// the human-only clear guard.

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
  built.state.suggestions.set(SUGGESTION_ID, {
    id: SUGGESTION_ID,
    articleId: ARTICLE_ID,
    baseRev: 1,
    editorProfileId: EDITOR,
    type: 'correction',
    diffJson: '{}',
    citations: [],
    rationale: 'fix',
    signature: 'sig',
    createdAt: '2026-07-01T00:00:00.000Z',
    status: 'open',
  });
  return built;
}

async function insertNciiReport(
  store: ReturnType<typeof seeded>['store'],
  kind: 'article' | 'suggestion' | 'profile' | 'media',
  targetId: string,
): Promise<string> {
  await store.insertReport({
    reporterProfileId: REPORTER,
    targetKind: kind,
    targetId,
    reason: 'ncii',
    detail: 'NCII',
  });
  const id = await store.getOpenReportId(REPORTER, kind, targetId);
  if (!id) throw new Error('report id not found');
  return id;
}

describe('NCII case store semantics', () => {
  it('take-down-first: opening a case on an article report retracts it immediately + status removed', async () => {
    const { store, state } = seeded();
    const reportId = await insertNciiReport(store, 'article', ARTICLE_ID);

    const outcome = await store.openNciiCase(reportId);
    expect(outcome).toBe('ok');

    // The article is DOWN before any human review.
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('retracted');
    const cases = await store.getOpenNciiCases(10);
    expect(cases).toHaveLength(1);
    expect(cases[0]?.status).toBe('removed');
    // An audit row records the automatic takedown.
    expect(state.moderationActions.some((a) => a.moderatorRef === 'ncii-auto')).toBe(true);
  });

  it('sets a 48h deadline from now', async () => {
    const { store } = seeded();
    const reportId = await insertNciiReport(store, 'article', ARTICLE_ID);
    const before = Date.now();
    await store.openNciiCase(reportId);
    const after = Date.now();

    const [c] = await store.getOpenNciiCases(10);
    const deadline = Date.parse(c!.deadlineAt);
    expect(deadline).toBeGreaterThanOrEqual(before + 48 * 3600_000 - 5_000);
    expect(deadline).toBeLessThanOrEqual(after + 48 * 3600_000 + 5_000);
  });

  it('take-down-first: a suggestion report rejects the suggestion immediately', async () => {
    const { store, state } = seeded();
    const reportId = await insertNciiReport(store, 'suggestion', SUGGESTION_ID);
    await store.openNciiCase(reportId);
    expect(state.suggestions.get(SUGGESTION_ID)?.status).toBe('rejected');
    const [c] = await store.getOpenNciiCases(10);
    expect(c?.status).toBe('removed');
  });

  it('media/profile target with no content row stays queued (worker + human finish)', async () => {
    const { store } = seeded();
    const reportId = await insertNciiReport(store, 'media', 'blob-abc');
    await store.openNciiCase(reportId);
    const [c] = await store.getOpenNciiCases(10);
    expect(c?.status).toBe('queued');
  });

  it('is idempotent on report id', async () => {
    const { store } = seeded();
    const reportId = await insertNciiReport(store, 'article', ARTICLE_ID);
    expect(await store.openNciiCase(reportId)).toBe('ok');
    expect(await store.openNciiCase(reportId)).toBe('exists');
    expect(await store.getOpenNciiCases(10)).toHaveLength(1);
  });

  it('rejects opening a case on a non-ncii report', async () => {
    const { store } = seeded();
    await store.insertReport({
      reporterProfileId: REPORTER,
      targetKind: 'article',
      targetId: ARTICLE_ID,
      reason: 'harassment',
      detail: '',
    });
    const id = await store.getOpenReportId(REPORTER, 'article', ARTICLE_ID);
    expect(await store.openNciiCase(id!)).toBe('not-ncii');
  });

  it('getDueNciiCases only returns queued/escalated cases at or past the deadline', async () => {
    const { store } = seeded();
    const reportId = await insertNciiReport(store, 'media', 'blob-1');
    await store.openNciiCase(reportId); // queued, deadline +48h

    // Nothing due before the deadline.
    const now = new Date().toISOString();
    expect(await store.getDueNciiCases(now, 10)).toHaveLength(0);
    // Everything due far in the future.
    const future = new Date(Date.now() + 100 * 3600_000).toISOString();
    const due = await store.getDueNciiCases(future, 10);
    expect(due).toHaveLength(1);
    expect(due[0]?.status).toBe('queued');
  });

  it('enforce ensure_removed retracts a still-live article and marks removed (idempotent)', async () => {
    const { store, state } = seeded();
    // Simulate an intake whose immediate hold failed: force the article back live.
    const reportId = await insertNciiReport(store, 'article', ARTICLE_ID);
    await store.openNciiCase(reportId);
    state.articles.get(ARTICLE_ID)!.status = 'published';

    const [c] = await store.getOpenNciiCases(10);
    const outcome = await store.enforceNciiCase({
      caseId: c!.id,
      action: 'ensure_removed',
      moderatorRef: 'ncii-auto',
    });
    expect(outcome).toBe('removed');
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('retracted');

    // Idempotent: a second ensure_removed still returns removed.
    expect(
      await store.enforceNciiCase({ caseId: c!.id, action: 'ensure_removed', moderatorRef: 'ncii-auto' }),
    ).toBe('removed');
  });

  it('fail-closed: a media case with no content row escalates, never clears', async () => {
    const { store } = seeded();
    const reportId = await insertNciiReport(store, 'media', 'blob-x');
    await store.openNciiCase(reportId);
    const [c] = await store.getOpenNciiCases(10);
    const outcome = await store.enforceNciiCase({
      caseId: c!.id,
      action: 'ensure_removed',
      moderatorRef: 'ncii-auto',
    });
    expect(outcome).toBe('escalated');
  });

  it('the automated worker can NEVER clear a case', async () => {
    const { store } = seeded();
    const reportId = await insertNciiReport(store, 'article', ARTICLE_ID);
    await store.openNciiCase(reportId);
    const [c] = await store.getOpenNciiCases(10);
    expect(
      await store.enforceNciiCase({ caseId: c!.id, action: 'clear', moderatorRef: 'ncii-auto' }),
    ).toBe('clear-not-allowed');
    // Still open (removed), not cleared.
    expect((await store.getOpenNciiCases(10))[0]?.status).toBe('removed');
  });

  it('a human can clear a case (verified false report)', async () => {
    const { store } = seeded();
    const reportId = await insertNciiReport(store, 'article', ARTICLE_ID);
    await store.openNciiCase(reportId);
    const [c] = await store.getOpenNciiCases(10);
    const outcome = await store.enforceNciiCase({
      caseId: c!.id,
      action: 'clear',
      moderatorRef: 'moderator@mynews.app',
      note: 'verified false report',
    });
    expect(outcome).toBe('cleared');
    expect(await store.getOpenNciiCases(10)).toHaveLength(0);
  });

  it('records the hash-match verdict and NCMEC ref without auto-clearing', async () => {
    const { store } = seeded();
    const reportId = await insertNciiReport(store, 'article', ARTICLE_ID);
    await store.openNciiCase(reportId);
    const [c] = await store.getOpenNciiCases(10);
    await store.enforceNciiCase({
      caseId: c!.id,
      action: 'ensure_removed',
      moderatorRef: 'ncii-auto',
      hashStatus: 'match',
      ncmecRef: 'CT-12345',
    });
    const [after] = await store.getOpenNciiCases(10);
    expect(after?.hashMatchStatus).toBe('match');
    expect(after?.ncmecRef).toBe('CT-12345');
    // A match does NOT clear the case: it stays removed/open.
    expect(after?.status).toBe('removed');
  });

  it('rejects a blank moderator ref and a bad action', async () => {
    const { store } = seeded();
    const reportId = await insertNciiReport(store, 'article', ARTICLE_ID);
    await store.openNciiCase(reportId);
    const [c] = await store.getOpenNciiCases(10);
    expect(
      await store.enforceNciiCase({ caseId: c!.id, action: 'ensure_removed', moderatorRef: '  ' }),
    ).toBe('bad-moderator');
    expect(
      await store.enforceNciiCase({
        caseId: c!.id,
        // deliberately invalid action
        action: 'bogus' as unknown as 'clear',
        moderatorRef: 'ncii-auto',
      }),
    ).toBe('bad-action');
  });
});
