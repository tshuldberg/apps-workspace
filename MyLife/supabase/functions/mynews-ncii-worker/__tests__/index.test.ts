import { describe, expect, it } from 'vitest';
import { handleNciiWorkerRequest, runNciiWorker, type NciiWorkerDeps } from '../index.ts';
import { matchNciiHash, reportCsamToNcmec } from '../seams.ts';
import {
  createInMemoryMyNewsStore,
  type MyNewsStore,
} from '../../_shared/mynews-store.ts';

const REPORTER = 'profile-reporter';
const AUTHOR = 'profile-author';
const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';

function seededStore() {
  const built = createInMemoryMyNewsStore({
    profiles: [
      { id: REPORTER, userId: 'auth-reporter', pubkey: '', handle: 'reporter' },
      { id: AUTHOR, userId: 'auth-author', pubkey: 'ab'.repeat(32), handle: 'author' },
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
  return built;
}

// Open an article NCII case AND simulate a failed immediate hold: the case is
// left 'queued' with the article still live, so the worker's fail-closed backstop
// has real work to do (the common already-removed case is not due by design).
async function openUnheldArticleCase(built: ReturnType<typeof seededStore>) {
  const { store, state } = built;
  await store.insertReport({
    reporterProfileId: REPORTER,
    targetKind: 'article',
    targetId: ARTICLE_ID,
    reason: 'ncii',
    detail: 'NCII',
  });
  const reportId = await store.getOpenReportId(REPORTER, 'article', ARTICLE_ID);
  await store.openNciiCase(reportId!);
  state.nciiCases[0]!.status = 'queued';
  state.articles.get(ARTICLE_ID)!.status = 'published';
}

async function openMediaCase(store: ReturnType<typeof seededStore>['store'], ref: string) {
  await store.insertReport({
    reporterProfileId: REPORTER,
    targetKind: 'media',
    targetId: ref,
    reason: 'ncii',
    detail: 'NCII',
  });
  const reportId = await store.getOpenReportId(REPORTER, 'media', ref);
  await store.openNciiCase(reportId!);
}

// Far-future "now" so every case is past its 48h deadline (all cases are due).
const OVERDUE_NOW = new Date(Date.now() + 100 * 3600_000).toISOString();

function deps(
  store: ReturnType<typeof seededStore>['store'],
  overrides: Partial<NciiWorkerDeps> = {},
): NciiWorkerDeps {
  return {
    env: (key: string) => (key === 'MYNEWS_NCII_WORKER_SECRET' ? 's3cret' : undefined),
    now: () => OVERDUE_NOW,
    store,
    ...overrides,
  };
}

describe('mynews-ncii-worker (Plan 39 T10)', () => {
  it('reconciles an orphaned ncii report and takes down its target', async () => {
    const built = seededStore();
    const { store, state } = built;
    await store.insertReport({
      reporterProfileId: REPORTER,
      targetKind: 'article',
      targetId: ARTICLE_ID,
      reason: 'ncii',
      detail: 'legacy orphan',
    });
    const reportId = state.reports[0]!.id;
    expect(state.nciiCases).toHaveLength(0);

    const result = await runNciiWorker(deps(store));

    expect(result).toMatchObject({
      ok: true,
      reconciled: 1,
      reconciledIds: [reportId],
    });
    expect(state.nciiCases).toHaveLength(1);
    expect(state.nciiCases[0]).toMatchObject({ reportId, status: 'removed' });
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('retracted');
  });

  it('continues reconciling after one orphan repair fails', async () => {
    const built = seededStore();
    const { store: base, state } = built;
    await base.insertReport({
      reporterProfileId: REPORTER,
      targetKind: 'article',
      targetId: ARTICLE_ID,
      reason: 'ncii',
      detail: 'first orphan',
    });
    await base.insertReport({
      reporterProfileId: REPORTER,
      targetKind: 'media',
      targetId: 'legacy-media',
      reason: 'ncii',
      detail: 'second orphan',
    });
    let repairs = 0;
    const store: MyNewsStore = {
      ...base,
      reconcileNciiCase: async (reportId) => {
        repairs += 1;
        if (repairs === 1) throw new Error('repair boom');
        return base.reconcileNciiCase(reportId);
      },
    };

    const result = await runNciiWorker(deps(store));

    expect(result.ok).toBe(false);
    expect(result.reconciled).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(state.nciiCases).toHaveLength(1);
  });

  it('ensures an overdue content case is removed', async () => {
    const built = seededStore();
    const { store, state } = built;
    await openUnheldArticleCase(built);

    const result = await runNciiWorker(deps(store));
    expect(result).toMatchObject({ ok: true, scanned: 1, removed: 1, escalated: 0 });
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('retracted');
  });

  it('escalates an overdue media case with no content row (fail-closed)', async () => {
    const { store } = seededStore();
    await openMediaCase(store, 'blob-1');
    const result = await runNciiWorker(deps(store));
    expect(result).toMatchObject({ scanned: 1, removed: 0, escalated: 1 });
    // Case is now escalated, not cleared.
    const open = await store.getOpenNciiCases(10);
    expect(open[0]?.status).toBe('escalated');
  });

  it('is idempotent: a second pass over a removed content case is a no-op (not re-scanned)', async () => {
    const built = seededStore();
    const { store } = built;
    await openUnheldArticleCase(built);
    const first = await runNciiWorker(deps(store));
    expect(first.removed).toBe(1);
    // The case is now 'removed', so it is no longer due; the second pass scans
    // nothing and never re-processes it. Idempotent + fail-closed.
    const second = await runNciiWorker(deps(store));
    expect(second.scanned).toBe(0);
    expect(second.ok).toBe(true);
  });

  it('does not touch cases before their deadline', async () => {
    const { store } = seededStore();
    await openMediaCase(store, 'blob-not-due');
    // now = actual now, deadline is +48h, so nothing is due.
    const result = await runNciiWorker(deps(store, { now: () => new Date().toISOString() }));
    expect(result.scanned).toBe(0);
  });

  it('hash seam defaults to pending (human review), never auto-clears', async () => {
    const { store } = seededStore();
    await openMediaCase(store, 'blob-seam');
    // Default seams (unconfigured env): the injected default hash seam.
    const result = await runNciiWorker(deps(store));
    expect(result.escalated).toBe(1);
    const [c] = await store.getOpenNciiCases(10);
    // No vendor wired -> pending, never a fabricated match, never cleared.
    expect(c?.hashMatchStatus).toBe('pending');
    expect(c?.status).toBe('escalated');
    expect(c?.ncmecRef).toBeNull();
    expect(c?.note).toContain('[vendor-unconfigured]');
  });

  it('records the NCMEC ref only when the hash matches and the seam returns one', async () => {
    const built = seededStore();
    const { store } = built;
    await openUnheldArticleCase(built);
    const result = await runNciiWorker(
      deps(store, {
        matchHash: async () => ({ kind: 'match', source: 'test-vendor' }),
        reportCsam: async () => ({ ncmecRef: 'CT-999' }),
      }),
    );
    expect(result.ncmecReported).toBe(1);
    const [c] = await store.getOpenNciiCases(10);
    expect(c?.hashMatchStatus).toBe('match');
    expect(c?.ncmecRef).toBe('CT-999');
    // A match still does not clear the case.
    expect(c?.status).toBe('removed');
  });

  it('does not fabricate an NCMEC ref when the seam returns null', async () => {
    const built = seededStore();
    const { store } = built;
    await openUnheldArticleCase(built);
    const result = await runNciiWorker(
      deps(store, {
        matchHash: async () => ({ kind: 'match', source: 'test-vendor' }),
        reportCsam: async () => ({ ncmecRef: null }),
      }),
    );
    expect(result.ncmecReported).toBe(0);
    const [c] = await store.getOpenNciiCases(10);
    expect(c?.ncmecRef).toBeNull();
    expect(c?.note).toContain('[vendor-unconfigured] NCMEC reporting');
  });

  it('one failing case does not stop the batch', async () => {
    const built = seededStore();
    const { store } = built;
    await openUnheldArticleCase(built);
    await openMediaCase(store, 'blob-ok');
    let calls = 0;
    const result = await runNciiWorker(
      deps(store, {
        matchHash: async () => {
          calls += 1;
          if (calls === 1) throw new Error('vendor boom');
          return { kind: 'unconfigured' };
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(1);
    // The second case still processed.
    expect(result.escalated + result.removed).toBeGreaterThanOrEqual(1);
  });

  it('clamps the batch limit', async () => {
    const { store } = seededStore();
    for (let i = 0; i < 10; i += 1) await openMediaCase(store, `blob-${i}`);
    const result = await runNciiWorker(deps(store), 999);
    expect(result.scanned).toBeLessThanOrEqual(200);
    expect(result.scanned).toBe(10);
  });

  it('rejects requests without the worker secret (401)', async () => {
    const { store } = seededStore();
    const res = await handleNciiWorkerRequest(
      new Request('https://x/functions/v1/mynews-ncii-worker', { method: 'POST' }),
      deps(store),
    );
    expect(res.status).toBe(401);
  });

  it('rejects a wrong worker secret (401)', async () => {
    const { store } = seededStore();
    const res = await handleNciiWorkerRequest(
      new Request('https://x/f', { method: 'POST', headers: { 'X-MyNews-Worker-Secret': 'nope' } }),
      deps(store),
    );
    expect(res.status).toBe(401);
  });

  it('503s when the secret is not configured', async () => {
    const { store } = seededStore();
    const res = await handleNciiWorkerRequest(
      new Request('https://x/f', { method: 'POST' }),
      { env: () => undefined, now: () => OVERDUE_NOW, store },
    );
    expect(res.status).toBe(503);
  });

  it('405s non-POST', async () => {
    const { store } = seededStore();
    const res = await handleNciiWorkerRequest(new Request('https://x/f', { method: 'GET' }), deps(store));
    expect(res.status).toBe(405);
  });

  it('runs with a valid secret and returns counts', async () => {
    const built = seededStore();
    const { store } = built;
    await openUnheldArticleCase(built);
    const res = await handleNciiWorkerRequest(
      new Request('https://x/f', {
        method: 'POST',
        headers: { 'X-MyNews-Worker-Secret': 's3cret' },
        body: JSON.stringify({ limit: 10 }),
      }),
      deps(store),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { removed: number };
    expect(body.removed).toBe(1);
  });
});

describe('ncii seams (unimplemented-pending-vendor, safe defaults)', () => {
  const noEnv = () => undefined;
  const caseLike = { id: 'c1', targetKind: 'media', targetId: 'blob-1' };

  it('hash seam returns unconfigured when no vendor env is set', async () => {
    expect(await matchNciiHash(caseLike, noEnv)).toEqual({ kind: 'unconfigured' });
  });

  it('hash seam returns error (never a fabricated match) when configured but unimplemented', async () => {
    const env = (k: string) =>
      k === 'MYNEWS_NCII_HASH_VENDOR_URL' || k === 'MYNEWS_NCII_HASH_VENDOR_KEY' ? 'set' : undefined;
    const verdict = await matchNciiHash(caseLike, env);
    expect(verdict.kind).toBe('error');
  });

  it('NCMEC seam returns null ref when no creds are set (never fabricates)', async () => {
    expect(await reportCsamToNcmec(caseLike, noEnv)).toEqual({ ncmecRef: null });
  });

  it('NCMEC seam still returns null when configured but unimplemented (no fake ref)', async () => {
    const env = (k: string) =>
      k === 'MYNEWS_NCMEC_CYBERTIPLINE_URL' || k === 'MYNEWS_NCMEC_CYBERTIPLINE_CREDENTIALS'
        ? 'set'
        : undefined;
    expect(await reportCsamToNcmec(caseLike, env)).toEqual({ ncmecRef: null });
  });
});
