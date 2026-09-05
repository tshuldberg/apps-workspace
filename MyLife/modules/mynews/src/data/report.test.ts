import { describe, expect, it } from 'vitest';
import { InMemoryCloudAdapter, type ArticleView, type ProfileView } from './cloud';
import {
  REPORT_REASON_HINTS,
  REPORT_REASON_LABELS,
  REPORT_SEVERITY_RANK,
  REPORT_SLA_HOURS,
  REPORT_URGENT_REASONS,
  isUrgentReportReason,
  reportDeadlineAtMs,
  reportErrorMessage,
  submitReport,
  type ReportErrorCode,
} from './report';
import { REPORT_REASONS } from '../models';

function profile(over: Partial<ProfileView>): ProfileView {
  return {
    id: 'reporter-1',
    userId: 'u-reporter',
    handle: 'reader',
    displayName: 'A Reader',
    pubkeyEd25519: '',
    kind: 'reader',
    ...over,
  };
}

function article(over: Partial<ArticleView>): ArticleView {
  return {
    articleId: 'a1',
    slug: 'owens-valley',
    headline: 'Owens Valley water dispute deepens',
    dek: 'Filings show a drop.',
    kind: 'news',
    rev: 1,
    publishedAt: '2026-07-03T10:00:00.000Z',
    authorHandle: 'rosamarin',
    authorDisplayName: 'Rosa Marín',
    authorPubkey: 'pub-rosa',
    authorTier: 'verified',
    status: 'published',
    bodyMd: 'Body.',
    signature: 'sig',
    signerPubkey: 'pub-rosa',
    createdAt: '2026-07-03T09:00:00.000Z',
    revisionSummaries: [],
    ...over,
  };
}

function seededPort(): InMemoryCloudAdapter {
  const port = new InMemoryCloudAdapter();
  port.sessionUserId = 'u-reporter';
  port.profiles = [profile({}), profile({ id: 'author-1', userId: 'u-author', handle: 'rosamarin' })];
  port.articles = [article({})];
  return port;
}

describe('InMemoryCloudAdapter report methods', () => {
  it('rejects reporting when signed out (not-signed-in)', async () => {
    const port = seededPort();
    port.sessionUserId = null;
    const res = await port.submitReport({
      targetKind: 'article',
      targetId: 'a1',
      reason: 'harassment',
    });
    expect(res).toEqual({ ok: false, error: 'not-signed-in' });
  });

  it('submits a report and lists it for the reporter only', async () => {
    const port = seededPort();
    const res = await port.submitReport({
      targetKind: 'article',
      targetId: 'a1',
      reason: 'spam',
      detail: 'ad copy',
    });
    expect(res).toEqual({ ok: true, status: 'submitted' });
    const mine = await port.getMyReports('reporter-1');
    expect(mine.length).toBe(1);
    expect(mine[0]).toMatchObject({ targetKind: 'article', targetId: 'a1', reason: 'spam', status: 'open' });
    // A different reporter sees nothing.
    expect(await port.getMyReports('author-1')).toEqual([]);
  });

  it('rejects a target that does not exist (bad-target)', async () => {
    const port = seededPort();
    const res = await port.submitReport({ targetKind: 'article', targetId: 'ghost', reason: 'spam' });
    expect(res).toEqual({ ok: false, error: 'bad-target' });
  });

  it('is idempotent on a second open report of the same target', async () => {
    const port = seededPort();
    await port.submitReport({ targetKind: 'article', targetId: 'a1', reason: 'spam' });
    const again = await port.submitReport({ targetKind: 'article', targetId: 'a1', reason: 'violence' });
    expect(again).toEqual({ ok: true, status: 'already-reported' });
    expect((await port.getMyReports('reporter-1')).length).toBe(1);
  });

  it('validates a media target as a non-empty ref', async () => {
    const port = seededPort();
    expect(await port.submitReport({ targetKind: 'media', targetId: 'blob:x', reason: 'ncii' })).toEqual({
      ok: true,
      status: 'submitted',
    });
    expect(await port.submitReport({ targetKind: 'media', targetId: '  ', reason: 'ncii' })).toEqual({
      ok: false,
      error: 'bad-target',
    });
  });
});

describe('submitReport orchestrator', () => {
  it('validates before hitting the port', async () => {
    const port = seededPort();
    const res = await submitReport({
      targetKind: 'article',
      targetId: '',
      reason: 'spam',
      port,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('validation');
  });

  it('maps a successful submit', async () => {
    const port = seededPort();
    const res = await submitReport({ targetKind: 'article', targetId: 'a1', reason: 'spam', port });
    expect(res).toEqual({ ok: true, status: 'submitted' });
  });

  it('maps an escalated success status', async () => {
    const res = await submitReport({
      targetKind: 'article',
      targetId: 'a1',
      reason: 'ncii',
      port: {
        submitReport: async () => ({ ok: true, status: 'escalated' }),
      },
    });
    expect(res).toEqual({ ok: true, status: 'escalated' });
  });

  it('maps a typed server error to a known code', async () => {
    const port = seededPort();
    const res = await submitReport({ targetKind: 'article', targetId: 'ghost', reason: 'spam', port });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('bad-target');
  });

  it('maps an unknown server error to unknown', async () => {
    const port = seededPort();
    port.submitReport = async () => ({ ok: false, error: 'weird-server-thing' });
    const res = await submitReport({ targetKind: 'article', targetId: 'a1', reason: 'spam', port });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('unknown');
  });

  it('maps an unavailable intake to its retryable error code', async () => {
    const port = seededPort();
    port.submitReport = async () => ({ ok: false, error: 'intake-unavailable' });
    const res = await submitReport({ targetKind: 'article', targetId: 'a1', reason: 'spam', port });
    expect(res).toEqual({
      ok: false,
      code: 'intake-unavailable',
      detail: 'intake-unavailable',
    });
  });

  it('maps a thrown network error', async () => {
    const port = seededPort();
    port.submitReport = async () => {
      throw new Error('offline');
    };
    const res = await submitReport({ targetKind: 'article', targetId: 'a1', reason: 'spam', port });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('network');
  });
});

describe('reportErrorMessage', () => {
  const codes: ReportErrorCode[] = [
    'validation',
    'not-signed-in',
    'no-profile',
    'bad-target',
    'rate-limited',
    'intake-unavailable',
    'network',
    'unknown',
  ];

  it('returns honest, non-empty copy without em dashes for every code', () => {
    const emDash = String.fromCodePoint(0x2014);
    for (const code of codes) {
      const { message } = reportErrorMessage(code);
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toContain(emDash);
    }
  });

  it('flags not-signed-in with a sign-in action', () => {
    expect(reportErrorMessage('not-signed-in').action).toBe('sign-in');
  });

  it('labels every reason', () => {
    for (const reason of REPORT_REASONS) {
      expect(REPORT_REASON_LABELS[reason].length).toBeGreaterThan(2);
    }
  });
});

describe('REPORT_SEVERITY_RANK', () => {
  it('pins the audit-approved severity ordering', () => {
    // WP1's seven ranks are unchanged; the six plan 48 WP8 reasons enter at
    // their assigned tiers. A change here is a product decision that must land
    // with nw_report_severity_rank in 20260730000009 and the edge twin.
    expect(REPORT_SEVERITY_RANK).toEqual({
      'child-safety': 100,
      ncii: 100,
      threats: 80,
      violence: 80,
      'self-harm': 70,
      hate: 60,
      harassment: 60,
      impersonation: 60,
      'doxxing-privacy': 60,
      copyright: 40,
      'fraud-scam': 40,
      spam: 20,
      other: 20,
    });
  });

  it('keeps the WP1 relative ordering intact', () => {
    expect(REPORT_SEVERITY_RANK.ncii).toBeGreaterThan(REPORT_SEVERITY_RANK.violence);
    expect(REPORT_SEVERITY_RANK.violence).toBeGreaterThan(REPORT_SEVERITY_RANK.harassment);
    expect(REPORT_SEVERITY_RANK.harassment).toBe(REPORT_SEVERITY_RANK.impersonation);
    expect(REPORT_SEVERITY_RANK.harassment).toBeGreaterThan(REPORT_SEVERITY_RANK.copyright);
    expect(REPORT_SEVERITY_RANK.copyright).toBeGreaterThan(REPORT_SEVERITY_RANK.spam);
    expect(REPORT_SEVERITY_RANK.spam).toBe(REPORT_SEVERITY_RANK.other);
  });

  it('puts child-safety at the ncii tier so it shares the urgent lane', () => {
    expect(REPORT_SEVERITY_RANK['child-safety']).toBe(REPORT_SEVERITY_RANK.ncii);
    expect(REPORT_URGENT_REASONS).toEqual(['child-safety', 'ncii']);
    expect(isUrgentReportReason('child-safety')).toBe(true);
    expect(isUrgentReportReason('ncii')).toBe(true);
    expect(isUrgentReportReason('threats')).toBe(false);
  });

  it('lists reasons in descending severity order for the report sheets', () => {
    const ranks = REPORT_REASONS.map((reason) => REPORT_SEVERITY_RANK[reason]);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]!).toBeLessThanOrEqual(ranks[i - 1]!);
    }
  });
});

describe('REPORT_SLA_HOURS', () => {
  it('pins every routed deadline', () => {
    // Twin of the nw_report_sla seed in 20260730000009. The urgent lane reads
    // these numbers for its case deadline, so a change is an operational
    // commitment change.
    expect(REPORT_SLA_HOURS).toEqual({
      'child-safety': 24,
      ncii: 48,
      threats: 24,
      violence: 24,
      'self-harm': 24,
      'doxxing-privacy': 48,
      hate: 72,
      harassment: 72,
      impersonation: 72,
      'fraud-scam': 72,
      copyright: 240,
      spam: 168,
      other: 168,
    });
  });

  it('routes every reason', () => {
    for (const reason of REPORT_REASONS) {
      expect(REPORT_SLA_HOURS[reason]).toBeGreaterThan(0);
    }
  });

  it('gives child-safety the tightest urgent deadline', () => {
    expect(REPORT_SLA_HOURS['child-safety']).toBeLessThan(REPORT_SLA_HOURS.ncii);
    for (const reason of REPORT_REASONS) {
      expect(REPORT_SLA_HOURS['child-safety']).toBeLessThanOrEqual(REPORT_SLA_HOURS[reason]);
    }
  });

  it('computes a deadline from the reason and the report time', () => {
    const created = Date.parse('2026-07-30T00:00:00.000Z');
    expect(reportDeadlineAtMs('child-safety', created)).toBe(
      Date.parse('2026-07-31T00:00:00.000Z'),
    );
    expect(reportDeadlineAtMs('ncii', created)).toBe(Date.parse('2026-08-01T00:00:00.000Z'));
  });
});

describe('REPORT_REASON_HINTS', () => {
  it('explains every reason without an em dash', () => {
    for (const reason of REPORT_REASONS) {
      const hint = REPORT_REASON_HINTS[reason];
      expect(hint.length).toBeGreaterThan(10);
      expect(hint).not.toContain('—');
    }
  });
});
