import { describe, expect, it } from 'vitest';
import { handleReportRequest } from '../index.ts';
import {
  createInMemoryMyNewsStore,
  type MyNewsStore,
} from '../../_shared/mynews-store.ts';

const REPORTER_USER_ID = 'auth-reporter-1';
const REPORTER_PROFILE_ID = 'profile-reporter-1';
const AUTHOR_PROFILE_ID = 'profile-author-1';
const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const SUGGESTION_ID = '22222222-2222-2222-2222-222222222222';
const MEDIA_ID = '33333333-3333-3333-3333-333333333333';

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown, sub: string | null): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-report', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** Store seeded with a reporter profile, one article, and one suggestion. */
function seededStore() {
  const built = createInMemoryMyNewsStore({
    profiles: [
      { id: REPORTER_PROFILE_ID, userId: REPORTER_USER_ID, pubkey: '' },
      { id: AUTHOR_PROFILE_ID, userId: 'auth-author-1', pubkey: 'ab'.repeat(32) },
    ],
  });
  built.state.articles.set(ARTICLE_ID, {
    id: ARTICLE_ID,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: AUTHOR_PROFILE_ID,
    authorPubkey: 'ab'.repeat(32),
    currentRev: 1,
    newsroomId: null,
    publishedAt: '2026-07-01T00:00:00.000Z',
  });
  built.state.suggestions.set(SUGGESTION_ID, {
    id: SUGGESTION_ID,
    articleId: ARTICLE_ID,
    baseRev: 1,
    editorProfileId: AUTHOR_PROFILE_ID,
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

const validBody = () => ({
  targetKind: 'article',
  targetId: ARTICLE_ID,
  reason: 'harassment',
  detail: 'abusive language',
});

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('handleReportRequest', () => {
  it('rejects non-POST', async () => {
    const { store } = seededStore();
    const res = await handleReportRequest(
      new Request('http://local/mynews-report', { method: 'GET' }),
      { store },
    );
    expect(res.status).toBe(405);
  });

  it('rejects a missing session (anonymous flood is closed)', async () => {
    const { store, state } = seededStore();
    const res = await handleReportRequest(post(validBody(), null), { store });
    expect(res.status).toBe(401);
    expect((await readJson(res)).error).toBe('not-signed-in');
    expect(state.reports.length).toBe(0);
  });

  it('rejects a malformed payload', async () => {
    const { store } = seededStore();
    const res = await handleReportRequest(
      post({ targetKind: 'article', targetId: ARTICLE_ID, reason: 'nope' }, REPORTER_USER_ID),
      { store },
    );
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe('bad-payload');
  });

  it('rejects a caller with no profile row', async () => {
    const { store } = seededStore();
    const res = await handleReportRequest(post(validBody(), 'auth-stranger'), { store });
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('no-profile');
  });

  it('submits a valid report with reporter_id set', async () => {
    const { store, state } = seededStore();
    const res = await handleReportRequest(post(validBody(), REPORTER_USER_ID), { store });
    expect(res.status).toBe(200);
    expect((await readJson(res)).data).toEqual({ status: 'submitted' });
    expect(state.reports.length).toBe(1);
    expect(state.reports[0]?.reporterProfileId).toBe(REPORTER_PROFILE_ID);
    expect(state.reports[0]?.reason).toBe('harassment');
  });

  it('reports a suggestion target', async () => {
    const { store, state } = seededStore();
    const res = await handleReportRequest(
      post({ targetKind: 'suggestion', targetId: SUGGESTION_ID, reason: 'spam', detail: '' }, REPORTER_USER_ID),
      { store },
    );
    expect(res.status).toBe(200);
    expect(state.reports[0]?.targetKind).toBe('suggestion');
  });

  it('rejects an article target that does not exist (bad-target)', async () => {
    const { store, state } = seededStore();
    const res = await handleReportRequest(
      post({ ...validBody(), targetId: '99999999-9999-9999-9999-999999999999' }, REPORTER_USER_ID),
      { store },
    );
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe('bad-target');
    expect(state.reports.length).toBe(0);
  });

  it('rejects a suggestion target that does not exist (bad-target)', async () => {
    const { store } = seededStore();
    const res = await handleReportRequest(
      post({ targetKind: 'suggestion', targetId: 'nope', reason: 'spam' }, REPORTER_USER_ID),
      { store },
    );
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe('bad-target');
  });

  it('is idempotent: a second open report on the same target returns already-reported', async () => {
    const { store, state } = seededStore();
    const first = await handleReportRequest(post(validBody(), REPORTER_USER_ID), { store });
    expect((await readJson(first)).data).toEqual({ status: 'submitted' });
    const second = await handleReportRequest(post(validBody(), REPORTER_USER_ID), { store });
    expect(second.status).toBe(200);
    expect((await readJson(second)).data).toEqual({ status: 'already-reported' });
    expect(state.reports.length).toBe(1);
  });

  it('rate-limits a burst of recent reports from one reporter (429)', async () => {
    const { store, state } = seededStore();
    const nowMs = Date.parse('2026-07-03T12:00:00.000Z');
    // Seed 10 recent reports directly (bypassing the handler) to trip the limit.
    for (let i = 0; i < 10; i += 1) {
      await store.insertReport({
        reporterProfileId: REPORTER_PROFILE_ID,
        targetKind: 'media',
        targetId: `blob-${i}`,
        reason: 'spam',
        detail: '',
      });
    }
    const res = await handleReportRequest(post(validBody(), REPORTER_USER_ID), {
      store,
      now: () => nowMs,
    });
    expect(res.status).toBe(429);
    expect((await readJson(res)).error).toBe('rate-limited');
    // The new report was not inserted; only the 10 seeded remain.
    expect(state.reports.length).toBe(10);
  });

  it('fails closed when the throttle count errors', async () => {
    const { store: base, state } = seededStore();
    const store: MyNewsStore = {
      ...base,
      countRecentReports: async () => {
        throw new Error('count boom');
      },
    };
    const res = await handleReportRequest(post(validBody(), REPORTER_USER_ID), { store });
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe('intake-unavailable');
    expect(state.reports.length).toBe(0);
  });

  it('rejects a media target with no authoritative asset row', async () => {
    const { store, state } = seededStore();
    const res = await handleReportRequest(
      post({ targetKind: 'media', targetId: MEDIA_ID, reason: 'spam' }, REPORTER_USER_ID),
      { store },
    );
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe('bad-target');
    expect(state.reports.length).toBe(0);
  });

  it('accepts a media target backed by an authoritative asset row', async () => {
    const { store, state } = seededStore();
    state.mediaAssets.set(MEDIA_ID, {
      id: MEDIA_ID,
      ownerProfileId: AUTHOR_PROFILE_ID,
      storagePath: 'mynews/media/asset-1',
      sha256: 'ab'.repeat(32),
      status: 'approved',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    const res = await handleReportRequest(
      post({ targetKind: 'media', targetId: MEDIA_ID, reason: 'spam' }, REPORTER_USER_ID),
      { store },
    );
    expect(res.status).toBe(200);
    expect((await readJson(res)).data).toEqual({ status: 'submitted' });
    expect(state.reports).toHaveLength(1);
  });

  it('allows a suspended reporter to submit within the three-per-hour tier', async () => {
    const { store, state } = seededStore();
    const nowMs = Date.now();
    await store.moderateSuspendProfile({
      profileId: REPORTER_PROFILE_ID,
      until: '2999-08-01T00:00:00.000Z',
      moderatorRef: 'mod@ops',
      note: 'abuse',
    });
    for (let i = 0; i < 2; i += 1) {
      await store.insertReport({
        reporterProfileId: REPORTER_PROFILE_ID,
        targetKind: 'media',
        targetId: `seed-${i}`,
        reason: 'spam',
        detail: '',
      });
    }
    const res = await handleReportRequest(post(validBody(), REPORTER_USER_ID), {
      store,
      now: () => nowMs,
    });
    expect(res.status).toBe(200);
    expect((await readJson(res)).data).toEqual({ status: 'submitted' });
    expect(state.reports.length).toBe(3);
  });

  it('rate-limits a suspended reporter on the fourth report within an hour', async () => {
    const { store, state } = seededStore();
    const nowMs = Date.now();
    await store.moderateSuspendProfile({
      profileId: REPORTER_PROFILE_ID,
      until: '2999-08-01T00:00:00.000Z',
      moderatorRef: 'mod@ops',
      note: 'abuse',
    });
    for (let i = 0; i < 3; i += 1) {
      await store.insertReport({
        reporterProfileId: REPORTER_PROFILE_ID,
        targetKind: 'media',
        targetId: `seed-${i}`,
        reason: 'spam',
        detail: '',
      });
    }
    const res = await handleReportRequest(post(validBody(), REPORTER_USER_ID), {
      store,
      now: () => nowMs,
    });
    expect(res.status).toBe(429);
    expect((await readJson(res)).error).toBe('rate-limited');
    expect(state.reports.length).toBe(3);
  });

  it('allows a reporter whose suspension has lapsed', async () => {
    const { store, state } = seededStore();
    const nowMs = Date.parse('2026-07-03T12:00:00.000Z');
    await store.moderateSuspendProfile({
      profileId: REPORTER_PROFILE_ID,
      until: '2026-07-01T00:00:00.000Z',
      moderatorRef: 'mod@ops',
      note: 'lapsed',
    });
    const res = await handleReportRequest(post(validBody(), REPORTER_USER_ID), {
      store,
      now: () => nowMs,
    });
    expect(res.status).toBe(200);
    expect(state.reports.length).toBe(1);
  });

  it('an ncii article report opens a case and holds the target immediately (TAKE IT DOWN)', async () => {
    const { store, state } = seededStore();
    const res = await handleReportRequest(
      post({ targetKind: 'article', targetId: ARTICLE_ID, reason: 'ncii', detail: 'NCII' }, REPORTER_USER_ID),
      { store },
    );
    expect(res.status).toBe(200);
    // The article is retracted before any human review (take-down-first).
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('retracted');
    // A case exists with a 48h deadline and status 'removed'.
    expect(state.nciiCases.length).toBe(1);
    const c = state.nciiCases[0]!;
    expect(c.status).toBe('removed');
    const deadline = Date.parse(c.deadlineAt);
    const created = Date.parse(c.createdAt);
    expect(deadline - created).toBeGreaterThanOrEqual(48 * 3600_000 - 5_000);
    expect(deadline - created).toBeLessThanOrEqual(48 * 3600_000 + 5_000);
  });

  it('escalates an open spam report to ncii and performs the atomic takedown', async () => {
    const { store, state } = seededStore();
    await store.insertReport({
      reporterProfileId: REPORTER_PROFILE_ID,
      targetKind: 'article',
      targetId: ARTICLE_ID,
      reason: 'spam',
      detail: 'initial spam concern',
    });
    const createdAt = state.reports[0]!.createdAt;

    const res = await handleReportRequest(
      post(
        { targetKind: 'article', targetId: ARTICLE_ID, reason: 'ncii', detail: 'urgent evidence' },
        REPORTER_USER_ID,
      ),
      { store },
    );

    expect(res.status).toBe(200);
    expect((await readJson(res)).data).toEqual({ status: 'escalated' });
    expect(state.reports).toHaveLength(1);
    expect(state.reports[0]).toMatchObject({
      reason: 'ncii',
      detail: 'initial spam concern\n---escalated---\nurgent evidence',
      createdAt,
    });
    expect(state.reportEscalations).toHaveLength(1);
    expect(state.nciiCases).toHaveLength(1);
    expect(state.nciiCases[0]?.status).toBe('removed');
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('retracted');
  });

  it('keeps an equal or higher-severity open report unchanged', async () => {
    const { store, state } = seededStore();
    await store.insertReport({
      reporterProfileId: REPORTER_PROFILE_ID,
      targetKind: 'article',
      targetId: ARTICLE_ID,
      reason: 'harassment',
      detail: 'original detail',
    });
    const before = { ...state.reports[0]! };

    const res = await handleReportRequest(
      post(
        { targetKind: 'article', targetId: ARTICLE_ID, reason: 'spam', detail: 'lower detail' },
        REPORTER_USER_ID,
      ),
      { store },
    );

    expect(res.status).toBe(200);
    expect((await readJson(res)).data).toEqual({ status: 'already-reported' });
    expect(state.reports).toEqual([before]);
    expect(state.reportEscalations).toHaveLength(0);
    expect(state.nciiCases).toHaveLength(0);
  });

  it('a non-ncii report opens no case', async () => {
    const { store, state } = seededStore();
    const res = await handleReportRequest(post(validBody(), REPORTER_USER_ID), { store });
    expect(res.status).toBe(200);
    expect(state.nciiCases.length).toBe(0);
  });

  it('fails closed when atomic ncii intake is unavailable', async () => {
    const { store: base, state } = seededStore();
    const store: MyNewsStore = {
      ...base,
      submitReport: async () => {
        throw new Error('intake boom');
      },
    };
    const res = await handleReportRequest(
      post({ targetKind: 'article', targetId: ARTICLE_ID, reason: 'ncii', detail: 'NCII' }, REPORTER_USER_ID),
      { store },
    );
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe('intake-unavailable');
    expect(state.reports.length).toBe(0);
    expect(state.nciiCases.length).toBe(0);
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('published');
  });
});
