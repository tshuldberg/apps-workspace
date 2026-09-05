import { describe, expect, it } from 'vitest';
import {
  acknowledgmentSla,
  dmcaAgeLabel,
  dmcaStatusLabel,
  filterDmcaQueue,
  isDmcaAgeFilter,
  isDmcaOpen,
  waitingPeriodLabel,
  type DmcaQueueItem,
} from '../dmca-workflow';

const NOW = Date.parse('2026-07-12T12:00:00.000Z');

function item(overrides: Partial<DmcaQueueItem> = {}): DmcaQueueItem {
  return {
    id: 'notice-1',
    kind: 'takedown',
    workflowKind: 'takedown',
    legacy: false,
    status: 'received',
    submitterName: 'Ada',
    submitterEmail: 'ada@example.com',
    submitterAddress: '1 Main St',
    submitterPhone: null,
    material: 'A work',
    publicUrl: 'https://mynews.app/article/story',
    targetKind: 'article',
    targetId: 'article-1',
    signature: 'Ada',
    assignedModeratorRef: null,
    acknowledgmentDueAt: '2026-07-15T12:00:00.000Z',
    acknowledgedAt: null,
    forwardedAt: null,
    forwardedToEmail: null,
    waitingPeriodStartedAt: null,
    restorationEligibleAt: null,
    restorationDeadlineAt: null,
    restoredAt: null,
    litigationHoldAt: null,
    closedAt: null,
    disposition: null,
    reportId: null,
    originalNoticeId: null,
    originalNoticeReference: null,
    strikeProfileId: null,
    strikeActionId: null,
    attestations: [],
    createdAt: '2026-07-12T06:00:00.000Z',
    updatedAt: '2026-07-12T06:00:00.000Z',
    consoleVersion: 1,
    ...overrides,
  };
}

describe('filterDmcaQueue', () => {
  const rows = [
    item(),
    item({
      id: 'counter-1',
      kind: 'counter',
      workflowKind: 'counter',
      status: 'waiting_period',
      createdAt: '2026-07-10T12:00:00.000Z',
    }),
    item({ id: 'closed-1', status: 'closed', createdAt: '2026-07-08T00:00:00.000Z' }),
  ];

  it('shows every open kind by default and excludes terminal rows', () => {
    expect(
      filterDmcaQueue(rows, { kind: 'all', status: 'open', age: 'all' }, NOW).map(
        (row) => row.id,
      ),
    ).toEqual(['notice-1', 'counter-1']);
  });

  it('filters by kind, exact status, and age band', () => {
    expect(
      filterDmcaQueue(rows, { kind: 'counter', status: 'waiting_period', age: '24_to_72h' }, NOW),
    ).toHaveLength(1);
    expect(
      filterDmcaQueue(rows, { kind: 'all', status: 'all', age: 'over_72h' }, NOW).map(
        (row) => row.id,
      ),
    ).toEqual(['closed-1']);
  });

  it('keeps actioned and litigation-hold work open until disposition, with restored terminal', () => {
    expect(isDmcaOpen(item({ status: 'litigation_hold' }))).toBe(true);
    expect(isDmcaOpen(item({ status: 'restored' }))).toBe(false);
    expect(isDmcaOpen(item({ status: 'actioned' }))).toBe(true);
  });
});

describe('DMCA aging and SLA labels', () => {
  it('formats minute, hour, and day ages', () => {
    expect(dmcaAgeLabel('2026-07-12T11:30:00.000Z', NOW)).toBe('30m old');
    expect(dmcaAgeLabel('2026-07-12T06:00:00.000Z', NOW)).toBe('6h old');
    expect(dmcaAgeLabel('2026-07-09T12:00:00.000Z', NOW)).toBe('3d old');
  });

  it('flags an overdue 72-hour acknowledgment and recognizes completion', () => {
    expect(acknowledgmentSla('2026-07-12T10:00:00.000Z', null, NOW)).toEqual({
      label: 'ack overdue 2h',
      overdue: true,
      complete: false,
    });
    expect(
      acknowledgmentSla(
        '2026-07-12T10:00:00.000Z',
        '2026-07-11T10:00:00.000Z',
        NOW,
      ),
    ).toEqual({ label: 'acknowledged', overdue: false, complete: true });
  });

  it('shows pre-window, open-window, and overdue waiting-period states', () => {
    const waiting = {
      status: 'waiting_period',
      restorationEligibleAt: '2026-07-13T12:00:00.000Z',
      restorationDeadlineAt: '2026-07-17T12:00:00.000Z',
    };
    expect(waitingPeriodLabel(waiting, NOW)?.label).toContain('eligible in');
    expect(
      waitingPeriodLabel(
        { ...waiting, restorationEligibleAt: '2026-07-11T12:00:00.000Z' },
        NOW,
      )?.label,
    ).toContain('window open');
    expect(
      waitingPeriodLabel(
        {
          ...waiting,
          restorationEligibleAt: '2026-07-01T12:00:00.000Z',
          restorationDeadlineAt: '2026-07-10T12:00:00.000Z',
        },
        NOW,
      ),
    ).toEqual({ label: '14-business-day restoration deadline passed', urgent: true });
  });

  it('fails visibly when waiting dates are missing', () => {
    expect(
      waitingPeriodLabel(
        { status: 'waiting_period', restorationEligibleAt: null, restorationDeadlineAt: null },
        NOW,
      ),
    ).toEqual({ label: 'waiting dates missing', urgent: true });
  });
});

describe('DMCA filter/status parsing', () => {
  it('accepts only named age filters', () => {
    expect(isDmcaAgeFilter('under_24h')).toBe(true);
    expect(isDmcaAgeFilter('24_to_72h')).toBe(true);
    expect(isDmcaAgeFilter('over_72h')).toBe(true);
    expect(isDmcaAgeFilter('yesterday')).toBe(false);
  });

  it('humanizes database statuses', () => {
    expect(dmcaStatusLabel('forwarded_to_claimant')).toBe('Forwarded to claimant');
  });
});
