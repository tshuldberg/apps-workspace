import { describe, expect, it } from 'vitest';

import { handleReportRequest } from '../index.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';
import {
  EDGE_REPORT_SLA_HOURS,
  EDGE_REPORT_URGENT_REASONS,
  createInMemoryMyNewsStore,
  type MyNewsStore,
  type ReportReason,
} from '../../_shared/mynews-store.ts';
import {
  REPORT_SEVERITY_RANK,
  REPORT_SLA_HOURS,
  REPORT_URGENT_REASONS,
} from '../../../../modules/mynews/src/taxonomy';
import { REPORT_REASONS } from '../../../../modules/mynews/src/models';

/**
 * Report taxonomy expansion and the shared urgent lane (plan 48 WP8).
 *
 * WP1 built the urgent lane for NCII alone, at a hardcoded 48 hours. This suite
 * pins the generalized version: every routed reason is accepted, child-safety
 * opens a case in the same lane at 24 hours, the severity rank still escalates
 * in the right direction, and the edge twin agrees with the module tables.
 */

const REPORTER_USER_ID = 'auth-reporter-1';
const REPORTER_PROFILE_ID = 'profile-reporter-1';
const AUTHOR_PROFILE_ID = 'profile-author-1';
const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const NOW_MS = Date.parse('2026-07-30T12:00:00.000Z');

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown): Request {
  return new Request('http://local/mynews-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtFor(REPORTER_USER_ID)}`,
    },
    body: JSON.stringify(body),
  });
}

function seededStore() {
  const built = createInMemoryMyNewsStore({
    profiles: [
      { id: REPORTER_PROFILE_ID, userId: REPORTER_USER_ID, pubkey: 'ab'.repeat(32) },
      { id: AUTHOR_PROFILE_ID, userId: 'auth-author-1', pubkey: 'cd'.repeat(32) },
    ],
    termsAcceptances: [{ userId: REPORTER_USER_ID, version: EDGE_CURRENT_TERMS_VERSION }],
  });
  built.state.articles.set(ARTICLE_ID, {
    id: ARTICLE_ID,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: AUTHOR_PROFILE_ID,
    authorPubkey: 'cd'.repeat(32),
    currentRev: 1,
  });
  return built;
}

const deps = (store: MyNewsStore) => ({ store, now: () => NOW_MS });

describe('report taxonomy: acceptance', () => {
  for (const reason of REPORT_REASONS) {
    it(`accepts a '${reason}' report`, async () => {
      const { store, state } = seededStore();
      const res = await handleReportRequest(
        post({ targetKind: 'article', targetId: ARTICLE_ID, reason, detail: 'why' }),
        deps(store),
      );
      expect(res.status).toBe(200);
      expect(state.reports).toHaveLength(1);
      expect(state.reports[0]!.reason).toBe(reason);
    });
  }

  it('still rejects a reason outside the taxonomy', async () => {
    const { store, state } = seededStore();
    const res = await handleReportRequest(
      post({ targetKind: 'article', targetId: ARTICLE_ID, reason: 'vibes', detail: 'why' }),
      deps(store),
    );
    expect(res.status).toBe(400);
    expect(state.reports).toHaveLength(0);
  });
});

describe('report taxonomy: urgent lane', () => {
  it('opens a child-safety case with an immediate takedown at 24 hours', async () => {
    const { store, state } = seededStore();
    const res = await handleReportRequest(
      post({ targetKind: 'article', targetId: ARTICLE_ID, reason: 'child-safety', detail: 'urgent' }),
      deps(store),
    );
    expect(res.status).toBe(200);
    // Take-down-first, exactly as the NCII lane behaves.
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('retracted');
    expect(state.nciiCases).toHaveLength(1);
    const caseRow = state.nciiCases[0]!;
    expect(caseRow.status).toBe('removed');
    const window = Date.parse(caseRow.deadlineAt) - Date.parse(caseRow.createdAt);
    expect(window).toBeGreaterThanOrEqual(24 * 3_600_000 - 5_000);
    expect(window).toBeLessThanOrEqual(24 * 3_600_000 + 5_000);
  });

  it('keeps NCII at 48 hours', async () => {
    const { store, state } = seededStore();
    await handleReportRequest(
      post({ targetKind: 'article', targetId: ARTICLE_ID, reason: 'ncii', detail: 'urgent' }),
      deps(store),
    );
    const caseRow = state.nciiCases[0]!;
    const window = Date.parse(caseRow.deadlineAt) - Date.parse(caseRow.createdAt);
    expect(window).toBeGreaterThanOrEqual(48 * 3_600_000 - 5_000);
    expect(window).toBeLessThanOrEqual(48 * 3_600_000 + 5_000);
  });

  it('does not open a case for a standard-lane reason', async () => {
    for (const reason of ['threats', 'hate', 'self-harm', 'doxxing-privacy', 'fraud-scam'] as const) {
      const { store, state } = seededStore();
      const res = await handleReportRequest(
        post({ targetKind: 'article', targetId: ARTICLE_ID, reason, detail: 'why' }),
        deps(store),
      );
      expect(res.status).toBe(200);
      expect(state.nciiCases, `${reason} must not open an urgent case`).toHaveLength(0);
      // Standard-lane reports do not take content down before review.
      expect(state.articles.get(ARTICLE_ID)?.status).toBe('published');
    }
  });

  it('escalates a spam report to child-safety and opens the urgent case', async () => {
    const { store, state } = seededStore();
    await handleReportRequest(
      post({ targetKind: 'article', targetId: ARTICLE_ID, reason: 'spam', detail: 'noise' }),
      deps(store),
    );
    expect(state.nciiCases).toHaveLength(0);

    const res = await handleReportRequest(
      post({
        targetKind: 'article',
        targetId: ARTICLE_ID,
        reason: 'child-safety',
        detail: 'actually much worse',
      }),
      deps(store),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ status: 'escalated' });
    expect(state.reports).toHaveLength(1);
    expect(state.reports[0]!.reason).toBe('child-safety');
    expect(state.nciiCases).toHaveLength(1);
    expect(state.articles.get(ARTICLE_ID)?.status).toBe('retracted');
  });

  it('does not de-escalate child-safety down to a lesser reason', async () => {
    const { store, state } = seededStore();
    await handleReportRequest(
      post({ targetKind: 'article', targetId: ARTICLE_ID, reason: 'child-safety', detail: 'urgent' }),
      deps(store),
    );
    const res = await handleReportRequest(
      post({ targetKind: 'article', targetId: ARTICLE_ID, reason: 'spam', detail: 'never mind' }),
      deps(store),
    );
    expect((await res.json()).data).toEqual({ status: 'already-reported' });
    expect(state.reports[0]!.reason).toBe('child-safety');
  });

  it('reports the urgent orphan scan across both lanes', async () => {
    const { store, state } = seededStore();
    await store.insertReport({
      reporterProfileId: REPORTER_PROFILE_ID,
      targetKind: 'article',
      targetId: ARTICLE_ID,
      reason: 'child-safety',
      detail: 'legacy row with no case',
    });
    expect(state.nciiCases).toHaveLength(0);
    const orphans = await store.findOrphanedNciiReports();
    expect(orphans).toHaveLength(1);
    // Reconciliation anchors the deadline to the report, at the routed hours.
    expect(await store.reconcileNciiCase(orphans[0]!)).toBe('ok');
    const caseRow = state.nciiCases[0]!;
    const window = Date.parse(caseRow.deadlineAt) - Date.parse(state.reports[0]!.createdAt);
    expect(window).toBeGreaterThanOrEqual(24 * 3_600_000 - 5_000);
    expect(window).toBeLessThanOrEqual(24 * 3_600_000 + 5_000);
  });

  it('reports not-ncii for a standard-lane report handed to the urgent reconciler', async () => {
    const { store } = seededStore();
    await store.insertReport({
      reporterProfileId: REPORTER_PROFILE_ID,
      targetKind: 'article',
      targetId: ARTICLE_ID,
      reason: 'hate',
      detail: 'standard lane',
    });
    const orphans = await store.findOrphanedNciiReports();
    expect(orphans).toHaveLength(0);
  });
});

describe('report taxonomy: edge twin agreement', () => {
  it('mirrors the module SLA table', () => {
    expect(EDGE_REPORT_SLA_HOURS).toEqual(REPORT_SLA_HOURS);
  });

  it('mirrors the module urgent lane', () => {
    expect([...EDGE_REPORT_URGENT_REASONS].sort()).toEqual([...REPORT_URGENT_REASONS].sort());
  });

  it('routes and ranks every reason the models expose', () => {
    for (const reason of REPORT_REASONS) {
      expect(EDGE_REPORT_SLA_HOURS[reason as ReportReason]).toBeGreaterThan(0);
      expect(REPORT_SEVERITY_RANK[reason]).toBeGreaterThan(0);
    }
  });

  it('keeps the urgent lane at the top of the severity rank', () => {
    const urgentRanks = REPORT_URGENT_REASONS.map((reason) => REPORT_SEVERITY_RANK[reason]);
    const others = REPORT_REASONS.filter(
      (reason) => !(REPORT_URGENT_REASONS as readonly string[]).includes(reason),
    ).map((reason) => REPORT_SEVERITY_RANK[reason]);
    expect(Math.min(...urgentRanks)).toBeGreaterThan(Math.max(...others));
  });
});
