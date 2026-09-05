/**
 * Operator safety-queue alerts (Plan 43 WP-43C, AC-43.11).
 *
 * A PURE evaluator that turns bounded safety-queue metrics into typed alert records against
 * configured thresholds. It is consumed by the private metrics/log surface (never a public route)
 * and drives operator attention to overdue safety work: NCMEC escalations + overdue filings, DMCA
 * items unresolved past their response deadline, and scanner/queue backlog.
 *
 * Privacy discipline (NC-42.3-style): an alert payload carries ONLY references and COUNTS -- a
 * fixed alert kind, a severity, a numeric measurement, and its threshold. It NEVER carries a
 * persona key, a publication id, a claimant identity, a report id, or any evidence. A per-identity
 * alert would be a metadata leak, so callers aggregate before evaluating.
 */

import type { NcmecQueueCounts } from './ncmec-queue';
import type { DmcaClaimRecord } from './dmca-intake';
import type { DmcaDeadlinePolicy } from './dmca-config';

export type OperatorAlertSeverity = 'warning' | 'critical';

export type OperatorAlertKind =
  | 'ncmec_escalations_present'
  | 'ncmec_filing_backlog'
  | 'ncmec_queue_stalled'
  | 'dmca_unresolved_past_deadline'
  | 'dmca_counter_notice_window_open'
  | 'scanner_backlog'
  | 'seeder_drift';

/**
 * One typed alert. Counts and thresholds only; no identity, no evidence. `measured` is the observed
 * quantity (a count or an age in ms) and `threshold` is the boundary it crossed.
 */
export interface OperatorAlert {
  kind: OperatorAlertKind;
  severity: OperatorAlertSeverity;
  measured: number;
  threshold: number;
  /** A fixed unit label for the numbers so the surface renders them correctly. */
  unit: 'count' | 'ms';
}

export interface OperatorAlertThresholds {
  /** Any escalated NCMEC record is at least a warning; this count flips it critical. */
  ncmecEscalationsCritical: number;
  /** Queued NCMEC records awaiting filing above this count is a filing backlog warning. */
  ncmecFilingBacklogWarning: number;
  ncmecFilingBacklogCritical: number;
  /** DMCA items unresolved past deadline: this many is a warning, the critical count flips it. */
  dmcaOverdueWarning: number;
  dmcaOverdueCritical: number;
  /** Scanner backlog (jobs awaiting scan) warning/critical counts. */
  scannerBacklogWarning: number;
  scannerBacklogCritical: number;
  /** Recent archive object/pin reconciliation drift events. */
  seederDriftWarning: number;
  seederDriftCritical: number;
}

export const DEFAULT_OPERATOR_ALERT_THRESHOLDS: OperatorAlertThresholds = {
  ncmecEscalationsCritical: 1,
  ncmecFilingBacklogWarning: 25,
  ncmecFilingBacklogCritical: 100,
  dmcaOverdueWarning: 1,
  dmcaOverdueCritical: 10,
  scannerBacklogWarning: 50,
  scannerBacklogCritical: 250,
  seederDriftWarning: 1,
  seederDriftCritical: 10,
};

/** The aggregated, identity-free inputs the evaluator reads. Callers aggregate before calling. */
export interface SafetyQueueSnapshot {
  ncmec: NcmecQueueCounts;
  /** Jobs sitting in the scanner backlog (quarantined + scanning), a pure count. */
  scannerBacklog: number;
  /** Drift/missing-object observations in the operator's bounded lookback window. */
  seederDrift?: number;
  /** Counts derived from the DMCA claim set against the deadline policy (see evaluateDmcaDeadlines). */
  dmca: DmcaDeadlineCounts;
}

export interface DmcaDeadlineCounts {
  /** Received/received-with-unresolved claims whose notification deadline has passed. */
  unresolvedPastDeadline: number;
  /** Counter-noticed claims still inside the restoration hold window (informational). */
  counterNoticeWindowOpen: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Reduce a DMCA claim set to identity-free deadline counts. A claim is "unresolved past deadline"
 * when it is still `received` (or carries unresolved items) and more than notificationDeadlineDays
 * have elapsed since it was received. A counter-noticed claim is "window open" while fewer than
 * counterNoticeDeadlineDays have elapsed since the counter-notice was submitted.
 */
export function evaluateDmcaDeadlines(
  claims: readonly DmcaClaimRecord[],
  policy: DmcaDeadlinePolicy,
  nowMs: number,
): DmcaDeadlineCounts {
  let unresolvedPastDeadline = 0;
  let counterNoticeWindowOpen = 0;
  const notificationMs = policy.notificationDeadlineDays * MS_PER_DAY;
  const counterMs = policy.counterNoticeDeadlineDays * MS_PER_DAY;
  for (const claim of claims) {
    const receivedMs = Date.parse(claim.receivedAt);
    const isOpen = claim.status === 'received'
      || (claim.unresolvedItems !== undefined && claim.unresolvedItems.length > 0
        && claim.status !== 'rejected' && claim.status !== 'counter_noticed');
    if (isOpen && Number.isFinite(receivedMs) && nowMs - receivedMs > notificationMs) {
      unresolvedPastDeadline += 1;
    }
    if (claim.status === 'counter_noticed' && claim.counterNotice) {
      const submittedMs = Date.parse(claim.counterNotice.submittedAt);
      if (Number.isFinite(submittedMs) && nowMs - submittedMs <= counterMs) {
        counterNoticeWindowOpen += 1;
      }
    }
  }
  return { unresolvedPastDeadline, counterNoticeWindowOpen };
}

/**
 * Evaluate the safety-queue snapshot into a bounded list of typed alerts. No alert is emitted when
 * a measurement is below its warning threshold. The result is deterministic and identity-free.
 */
export function evaluateOperatorAlerts(
  snapshot: SafetyQueueSnapshot,
  thresholds: OperatorAlertThresholds = DEFAULT_OPERATOR_ALERT_THRESHOLDS,
): OperatorAlert[] {
  const alerts: OperatorAlert[] = [];

  // NCMEC escalations: ANY escalated record is a warning (a filing that will never succeed on its
  // own); the critical threshold reflects an accumulating dead-letter the operator must clear.
  const escalated = snapshot.ncmec.escalated;
  if (escalated > 0) {
    alerts.push({
      kind: 'ncmec_escalations_present',
      severity: escalated >= thresholds.ncmecEscalationsCritical ? 'critical' : 'warning',
      measured: escalated,
      threshold: thresholds.ncmecEscalationsCritical,
      unit: 'count',
    });
  }

  // NCMEC filing backlog: queued records awaiting the filing worker. A large backlog can mean the
  // worker is down or the client is unavailable (records stay queued, never falsely filed).
  const queued = snapshot.ncmec.queued;
  if (queued >= thresholds.ncmecFilingBacklogWarning) {
    alerts.push({
      kind: 'ncmec_filing_backlog',
      severity: queued >= thresholds.ncmecFilingBacklogCritical ? 'critical' : 'warning',
      measured: queued,
      threshold: thresholds.ncmecFilingBacklogWarning,
      unit: 'count',
    });
  }

  // DMCA items unresolved past their notification deadline.
  const overdue = snapshot.dmca.unresolvedPastDeadline;
  if (overdue >= thresholds.dmcaOverdueWarning) {
    alerts.push({
      kind: 'dmca_unresolved_past_deadline',
      severity: overdue >= thresholds.dmcaOverdueCritical ? 'critical' : 'warning',
      measured: overdue,
      threshold: thresholds.dmcaOverdueWarning,
      unit: 'count',
    });
  }

  // Counter-notice restoration windows currently open (informational warning: an operator may need
  // to restore content once the window closes if no court action arrives).
  const counterOpen = snapshot.dmca.counterNoticeWindowOpen;
  if (counterOpen > 0) {
    alerts.push({
      kind: 'dmca_counter_notice_window_open',
      severity: 'warning',
      measured: counterOpen,
      threshold: 1,
      unit: 'count',
    });
  }

  // Scanner backlog: jobs awaiting a scan decision (nothing served until clean-scanned).
  const backlog = snapshot.scannerBacklog;
  if (backlog >= thresholds.scannerBacklogWarning) {
    alerts.push({
      kind: 'scanner_backlog',
      severity: backlog >= thresholds.scannerBacklogCritical ? 'critical' : 'warning',
      measured: backlog,
      threshold: thresholds.scannerBacklogWarning,
      unit: 'count',
    });
  }

  const drift = snapshot.seederDrift ?? 0;
  if (drift >= thresholds.seederDriftWarning) {
    alerts.push({
      kind: 'seeder_drift',
      severity: drift >= thresholds.seederDriftCritical ? 'critical' : 'warning',
      measured: drift,
      threshold: thresholds.seederDriftWarning,
      unit: 'count',
    });
  }

  return alerts;
}
