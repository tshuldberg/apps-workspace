import { describe, expect, it } from 'vitest';
import {
  evaluateOperatorAlerts,
  evaluateDmcaDeadlines,
  DEFAULT_OPERATOR_ALERT_THRESHOLDS,
  type SafetyQueueSnapshot,
} from '../operator-alerts';
import { DEFAULT_DMCA_DEADLINE_POLICY } from '../dmca-config';
import type { DmcaClaimRecord } from '../dmca-intake';
import type { NcmecQueueCounts } from '../ncmec-queue';

const NOW = Date.parse('2026-07-11T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function counts(overrides: Partial<NcmecQueueCounts> = {}): NcmecQueueCounts {
  return { queued: 0, exported: 0, filed: 0, escalated: 0, total: 0, ...overrides };
}

function baseSnapshot(overrides: Partial<SafetyQueueSnapshot> = {}): SafetyQueueSnapshot {
  return {
    ncmec: counts(),
    scannerBacklog: 0,
    dmca: { unresolvedPastDeadline: 0, counterNoticeWindowOpen: 0 },
    ...overrides,
  };
}

function claim(overrides: Partial<DmcaClaimRecord>): DmcaClaimRecord {
  return {
    id: 'c'.repeat(64),
    workDescription: 'work',
    claimedPostIds: ['p1'],
    claimedUrls: [],
    claimant: { name: 'n', email: 'e@example.com', address: 'a' },
    goodFaithStatement: true,
    accuracyStatement: true,
    signature: 'sig',
    receivedAt: new Date(NOW).toISOString(),
    status: 'received',
    lifecycleVersion: 1,
    ...overrides,
  };
}

describe('evaluateOperatorAlerts', () => {
  it('emits no alerts for an empty, healthy snapshot', () => {
    expect(evaluateOperatorAlerts(baseSnapshot())).toEqual([]);
  });

  it('any NCMEC escalation is at least a warning and flips critical at the threshold', () => {
    const alerts = evaluateOperatorAlerts(baseSnapshot({ ncmec: counts({ escalated: 1, total: 1 }) }));
    expect(alerts).toContainEqual({
      kind: 'ncmec_escalations_present', severity: 'critical', measured: 1, threshold: 1, unit: 'count',
    });
  });

  it('NCMEC filing backlog crosses warning then critical', () => {
    const warn = evaluateOperatorAlerts(baseSnapshot({ ncmec: counts({ queued: 25, total: 25 }) }));
    expect(warn.find((a) => a.kind === 'ncmec_filing_backlog')?.severity).toBe('warning');
    const crit = evaluateOperatorAlerts(baseSnapshot({ ncmec: counts({ queued: 100, total: 100 }) }));
    expect(crit.find((a) => a.kind === 'ncmec_filing_backlog')?.severity).toBe('critical');
    const none = evaluateOperatorAlerts(baseSnapshot({ ncmec: counts({ queued: 24, total: 24 }) }));
    expect(none.find((a) => a.kind === 'ncmec_filing_backlog')).toBeUndefined();
  });

  it('DMCA overdue and scanner backlog thresholds fire', () => {
    const alerts = evaluateOperatorAlerts(baseSnapshot({
      dmca: { unresolvedPastDeadline: 12, counterNoticeWindowOpen: 2 },
      scannerBacklog: 300,
    }));
    expect(alerts.find((a) => a.kind === 'dmca_unresolved_past_deadline')?.severity).toBe('critical');
    expect(alerts.find((a) => a.kind === 'dmca_counter_notice_window_open')?.severity).toBe('warning');
    expect(alerts.find((a) => a.kind === 'scanner_backlog')?.severity).toBe('critical');
  });

  it('surfaces recent seeder drift without any object identifiers', () => {
    const alerts = evaluateOperatorAlerts(baseSnapshot({ seederDrift: 10 }));
    expect(alerts.find((alert) => alert.kind === 'seeder_drift')).toEqual({
      kind: 'seeder_drift', severity: 'critical', measured: 10, threshold: 1, unit: 'count',
    });
  });

  it('alert payloads carry only counts + thresholds, never an identity', () => {
    const alerts = evaluateOperatorAlerts(baseSnapshot({ ncmec: counts({ escalated: 3, queued: 200, total: 203 }) }));
    for (const alert of alerts) {
      expect(Object.keys(alert).sort()).toEqual(['kind', 'measured', 'severity', 'threshold', 'unit']);
      expect(typeof alert.measured).toBe('number');
    }
  });

  it('respects custom thresholds', () => {
    const alerts = evaluateOperatorAlerts(
      baseSnapshot({ scannerBacklog: 5 }),
      { ...DEFAULT_OPERATOR_ALERT_THRESHOLDS, scannerBacklogWarning: 5, scannerBacklogCritical: 6 },
    );
    expect(alerts.find((a) => a.kind === 'scanner_backlog')?.severity).toBe('warning');
  });
});

describe('evaluateDmcaDeadlines', () => {
  it('flags a received claim past the notification deadline', () => {
    const old = claim({ receivedAt: new Date(NOW - 10 * DAY).toISOString() });
    const fresh = claim({ receivedAt: new Date(NOW - 1 * DAY).toISOString() });
    const result = evaluateDmcaDeadlines([old, fresh], DEFAULT_DMCA_DEADLINE_POLICY, NOW);
    expect(result.unresolvedPastDeadline).toBe(1);
  });

  it('flags an actioned claim with lingering unresolved items past deadline', () => {
    const partial = claim({
      status: 'actioned',
      unresolvedItems: ['https://x.example/post'],
      receivedAt: new Date(NOW - 10 * DAY).toISOString(),
    });
    // Note: status 'actioned' with unresolvedItems still counts as open work.
    const result = evaluateDmcaDeadlines([partial], DEFAULT_DMCA_DEADLINE_POLICY, NOW);
    expect(result.unresolvedPastDeadline).toBe(1);
  });

  it('does not flag a rejected or fully actioned claim', () => {
    const rejected = claim({ status: 'rejected', receivedAt: new Date(NOW - 30 * DAY).toISOString() });
    const done = claim({ status: 'actioned', receivedAt: new Date(NOW - 30 * DAY).toISOString() });
    const result = evaluateDmcaDeadlines([rejected, done], DEFAULT_DMCA_DEADLINE_POLICY, NOW);
    expect(result.unresolvedPastDeadline).toBe(0);
  });

  it('counts an open counter-notice restoration window', () => {
    const countered = claim({
      status: 'counter_noticed',
      counterNotice: { statement: 's', signature: 'sig', submittedAt: new Date(NOW - 2 * DAY).toISOString() },
    });
    const result = evaluateDmcaDeadlines([countered], DEFAULT_DMCA_DEADLINE_POLICY, NOW);
    expect(result.counterNoticeWindowOpen).toBe(1);
  });
});
