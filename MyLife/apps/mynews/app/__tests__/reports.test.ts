import { describe, expect, it } from 'vitest';
import { InMemoryCloudAdapter, type ReportView } from '@mylife/mynews';
import { reportErrorMessage, type ReportErrorCode } from '../(root)/lib/report-errors';
import { toMyReportRow } from '../(root)/lib/reports';

describe('report-errors copy', () => {
  const codes: ReportErrorCode[] = [
    'validation',
    'not-signed-in',
    'no-profile',
    'bad-target',
    'rate-limited',
    'network',
    'unknown',
  ];

  it('gives honest, non-empty copy with no em dash per code', () => {
    for (const code of codes) {
      const { message } = reportErrorMessage(code);
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toContain('—');
    }
  });

  it('flags not-signed-in with the sign-in action', () => {
    expect(reportErrorMessage('not-signed-in').action).toBe('sign-in');
  });
});

describe('toMyReportRow', () => {
  const base: ReportView = {
    id: 'r1',
    targetKind: 'article',
    targetId: 'a1',
    reason: 'harassment',
    detail: 'abusive',
    status: 'open',
    createdAt: '2026-07-05T00:00:00.000Z',
  };

  it('renders an honest title, status label, and detail', () => {
    const row = toMyReportRow(base);
    expect(row.title).toContain('Article');
    expect(row.title).toContain('Harassment');
    expect(row.status).toBe('Under review');
    expect(row.detail).toBe('abusive');
  });

  it('maps resolved statuses to honest labels', () => {
    expect(toMyReportRow({ ...base, status: 'actioned' }).status).toBe('Action taken');
    expect(toMyReportRow({ ...base, status: 'no_action' }).status).toBe('No action needed');
  });
});

// End-to-end through the in-memory adapter: the Me tab reads only the reporter's
// own reports, mirroring the nw_reports_reporter_select RLS policy.
describe('my reports via the port', () => {
  it('returns the signed-in reporter rows only', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'u1';
    port.profiles = [
      { id: 'p1', userId: 'u1', handle: 'a', displayName: 'A', pubkeyEd25519: '', kind: 'reader' },
    ];
    port.articles = [
      {
        articleId: 'a1',
        slug: 's1',
        headline: 'H',
        kind: 'news',
        rev: 1,
        publishedAt: '2026-07-01T00:00:00.000Z',
        authorHandle: 'x',
        authorDisplayName: 'X',
        authorPubkey: 'k',
        authorTier: 'open',
        status: 'published',
        bodyMd: 'b',
        signature: 's',
        signerPubkey: 'k',
        createdAt: '2026-07-01T00:00:00.000Z',
        revisionSummaries: [],
      },
    ];
    await port.submitReport({ targetKind: 'article', targetId: 'a1', reason: 'spam' });
    const mine = await port.getMyReports('p1');
    expect(mine.map((r) => r.targetId)).toEqual(['a1']);
    expect(await port.getMyReports('p2')).toEqual([]);
  });
});
