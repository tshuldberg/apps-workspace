import type {
  PaymentsBreakRecord,
  PaymentsProviderEventRecord,
} from './types';
import type {
  PaymentsDisputeCase,
} from '../compliance/disputes';
import type {
  PaymentsLaunchCapturedEvidenceRecord,
  PaymentsLaunchEvidenceCaptureEligibility,
  PaymentsLaunchEvidenceKind,
} from '../launch/evidence-store';
import type {
  PaymentsLaunchGateStatus,
  PaymentsLaunchOperatorRunbook,
  PaymentsLaunchOperatorRunbookDecision,
  PaymentsLaunchOperatorRunbookReasonId,
  PaymentsLaunchOperatorRunbookSectionId,
  PaymentsLaunchReleaseEvidenceReview,
  PaymentsLaunchReleaseEvidenceReviewItemId,
  PaymentsLaunchReleaseEvidenceReviewItemStatus,
  PaymentsLaunchReleaseEvidenceReviewStatus,
} from '../launch/readiness';

export type PaymentsOpsQueueId =
  | 'breaks'
  | 'compliance_holds'
  | 'disputes'
  | 'remittance_exceptions'
  | 'webhook_failures';

export interface PaymentsOpsQueueSummary {
  id: PaymentsOpsQueueId;
  label: string;
  count: number;
  highestSeverity: 'info' | 'warning' | 'critical';
}

export type PaymentsOpsLaunchEvidenceTimestampId =
  | 'provider_drills'
  | 'reconciliation_matrix'
  | 'dispute_ops'
  | 'approval_packet'
  | 'automated_evidence';

export type PaymentsOpsLaunchEvidenceTimestamps = Partial<
  Record<PaymentsOpsLaunchEvidenceTimestampId, string | null>
>;

export interface PaymentsOpsLaunchEvidenceTimestampLine {
  id: PaymentsOpsLaunchEvidenceTimestampId;
  label: string;
  value: string;
  missing: boolean;
}

export interface PaymentsOpsLaunchReviewReasonViewModel {
  id: PaymentsLaunchOperatorRunbookReasonId;
  label: string;
  evidence: string;
}

export interface PaymentsOpsLaunchReviewSectionViewModel {
  id: PaymentsLaunchOperatorRunbookSectionId;
  title: string;
  status: PaymentsLaunchGateStatus;
  summary: string;
  evidenceLineCount: number;
  evidencePreview: string[];
}

export interface PaymentsOpsLaunchReviewViewModel {
  title: 'Launch review';
  decision: PaymentsLaunchOperatorRunbookDecision;
  decisionLabel: string;
  summary: string;
  providerProfileLabel: string;
  hiddenStateLabel: string;
  paymentsFeatureHidden: boolean;
  generatedAt: string;
  evidenceTimestamps: PaymentsOpsLaunchEvidenceTimestampLine[];
  sections: PaymentsOpsLaunchReviewSectionViewModel[];
  doNotLaunchReasons: PaymentsOpsLaunchReviewReasonViewModel[];
}

export interface PaymentsOpsLaunchReleaseEvidenceReviewItemViewModel {
  id: PaymentsLaunchReleaseEvidenceReviewItemId;
  label: string;
  status: PaymentsLaunchReleaseEvidenceReviewItemStatus;
  evidence: string;
}

export interface PaymentsOpsLaunchReleaseEvidenceReviewViewModel {
  title: 'Captured release evidence';
  status: PaymentsLaunchReleaseEvidenceReviewStatus;
  statusLabel: string;
  summary: string;
  generatedAt: string;
  providerProfileLabel: string;
  automatedEvidenceLabel: string;
  releaseTicketLabel: string;
  targetReleaseStateLabel: string;
  hiddenStateLabel: string;
  items: PaymentsOpsLaunchReleaseEvidenceReviewItemViewModel[];
  operatorPreview: string[];
}

export interface PaymentsOpsLaunchReleaseEvidenceHistoryItemViewModel {
  evidenceId: string;
  kind: PaymentsLaunchEvidenceKind;
  kindLabel: string;
  capturedAt: string;
  capturedBy: string;
  operatorLabel: string;
  reviewerLabel: string;
  providerProfileLabel: string;
  automatedEvidenceLabel: string;
  releaseTicketLabel: string;
  targetReleaseStateLabel: string;
  payloadFingerprint: string;
  auditEntryLabel: string;
}

export interface PaymentsOpsLaunchReleaseEvidenceHistoryViewModel {
  title: 'Persisted release evidence';
  recordCount: number;
  summary: string;
  items: PaymentsOpsLaunchReleaseEvidenceHistoryItemViewModel[];
}

export interface PaymentsOpsLaunchReleaseEvidenceCaptureReasonViewModel {
  id: string;
  label: string;
  evidence: string;
}

export interface PaymentsOpsLaunchReleaseEvidenceCaptureEligibilityItemViewModel {
  kind: PaymentsLaunchEvidenceKind;
  kindLabel: string;
  statusLabel: 'Eligible' | 'Blocked';
  eligible: boolean;
  operatorLabel: string;
  reviewerLabel: string;
  requiredRolesLabel: string;
  providerProfileLabel: string;
  automatedEvidenceLabel: string;
  releaseTicketLabel: string;
  targetReleaseStateLabel: string;
  idempotencyKeyLabel: string;
  rejectionReasons: PaymentsOpsLaunchReleaseEvidenceCaptureReasonViewModel[];
}

export interface PaymentsOpsLaunchReleaseEvidenceCaptureEligibilityViewModel {
  title: 'Release evidence capture eligibility';
  eligibleCount: number;
  itemCount: number;
  summary: string;
  items: PaymentsOpsLaunchReleaseEvidenceCaptureEligibilityItemViewModel[];
}

export interface PaymentsOpsConsoleSnapshot {
  breaks: PaymentsBreakRecord[];
  disputes: PaymentsDisputeCase[];
  providerEvents: PaymentsProviderEventRecord[];
  remittanceExceptionIds: string[];
  complianceHoldWalletIds: string[];
  launchRunbook?: PaymentsLaunchOperatorRunbook | null;
  launchEvidenceTimestamps?: PaymentsOpsLaunchEvidenceTimestamps;
  launchReleaseEvidenceReview?: PaymentsLaunchReleaseEvidenceReview | null;
  launchReleaseEvidenceRecords?: PaymentsLaunchCapturedEvidenceRecord[];
  launchReleaseEvidenceCaptureEligibility?: PaymentsLaunchEvidenceCaptureEligibility[];
}

export interface PaymentsOpsConsoleViewModel {
  title: 'Payments Ops';
  queues: PaymentsOpsQueueSummary[];
  traceSearchPlaceholder: string;
  launchReview: PaymentsOpsLaunchReviewViewModel | null;
  launchReleaseEvidenceReview: PaymentsOpsLaunchReleaseEvidenceReviewViewModel | null;
  launchReleaseEvidenceCaptureEligibility: PaymentsOpsLaunchReleaseEvidenceCaptureEligibilityViewModel;
  launchReleaseEvidenceHistory: PaymentsOpsLaunchReleaseEvidenceHistoryViewModel;
}

function severity(count: number): PaymentsOpsQueueSummary['highestSeverity'] {
  if (count >= 5) {
    return 'critical';
  }
  if (count > 0) {
    return 'warning';
  }
  return 'info';
}

function launchDecisionLabel(decision: PaymentsLaunchOperatorRunbookDecision): string {
  return decision === 'ready_for_release_owner_review'
    ? 'Ready for release-owner review'
    : 'Do not launch';
}

function launchTimestampLine(
  id: PaymentsOpsLaunchEvidenceTimestampId,
  label: string,
  timestamps: PaymentsOpsLaunchEvidenceTimestamps,
): PaymentsOpsLaunchEvidenceTimestampLine {
  const value = timestamps[id] ?? null;

  return {
    id,
    label,
    value: value ?? 'Missing',
    missing: value === null,
  };
}

function buildLaunchReviewViewModel(
  runbook: PaymentsLaunchOperatorRunbook,
  timestamps: PaymentsOpsLaunchEvidenceTimestamps,
): PaymentsOpsLaunchReviewViewModel {
  const blockerCount = runbook.doNotLaunchReasons.length;

  return {
    title: 'Launch review',
    decision: runbook.decision,
    decisionLabel: launchDecisionLabel(runbook.decision),
    summary: runbook.readyForReleaseOwnerReview
      ? 'Launch evidence is packaged for final release-owner review.'
      : `${blockerCount} launch blocker${blockerCount === 1 ? '' : 's'} must clear before MyPay can go live.`,
    providerProfileLabel: runbook.providerProfile ?? 'Missing',
    hiddenStateLabel: runbook.paymentsFeatureHidden ? 'Hidden' : 'Visible in supplied evidence',
    paymentsFeatureHidden: runbook.paymentsFeatureHidden,
    generatedAt: runbook.generatedAt,
    evidenceTimestamps: [
      launchTimestampLine('provider_drills', 'Provider drills', timestamps),
      launchTimestampLine('reconciliation_matrix', 'Reconciliation matrix', timestamps),
      launchTimestampLine('dispute_ops', 'Dispute ops', timestamps),
      launchTimestampLine('approval_packet', 'Approval packet', timestamps),
      launchTimestampLine('automated_evidence', 'Automated evidence', timestamps),
    ],
    sections: runbook.sections.map((section) => ({
      id: section.id,
      title: section.title,
      status: section.status,
      summary: section.summary,
      evidenceLineCount: section.evidenceLines.length,
      evidencePreview: section.evidenceLines.slice(0, 2),
    })),
    doNotLaunchReasons: runbook.doNotLaunchReasons.map((reason) => ({
      id: reason.id,
      label: reason.label,
      evidence: reason.evidence,
    })),
  };
}

function buildLaunchReleaseEvidenceReviewViewModel(
  review: PaymentsLaunchReleaseEvidenceReview,
): PaymentsOpsLaunchReleaseEvidenceReviewViewModel {
  return {
    title: 'Captured release evidence',
    status: review.status,
    statusLabel: review.statusLabel,
    summary: review.summary,
    generatedAt: review.generatedAt,
    providerProfileLabel: review.providerProfile ?? 'Missing',
    automatedEvidenceLabel: review.automatedEvidenceGeneratedAt ?? 'Missing',
    releaseTicketLabel: review.releaseTicketId ?? 'Pending',
    targetReleaseStateLabel: review.targetReleaseState ?? 'Pending',
    hiddenStateLabel: review.paymentsFeatureHidden
      ? 'Payments remains hidden'
      : 'Payments is visible in supplied evidence',
    items: review.items.map((item) => ({
      id: item.id,
      label: item.label,
      status: item.status,
      evidence: item.evidence,
    })),
    operatorPreview: review.operatorLines.slice(0, 3),
  };
}

function launchEvidenceKindLabel(kind: PaymentsLaunchEvidenceKind): string {
  if (kind === 'legal_review') {
    return 'Legal review';
  }
  if (kind === 'pilot_approval') {
    return 'Pilot approval';
  }
  if (kind === 'release_owner_signoff') {
    return 'Release-owner signoff';
  }
  return 'Hidden-state acknowledgement';
}

function buildLaunchReleaseEvidenceHistoryViewModel(
  records: PaymentsLaunchCapturedEvidenceRecord[],
): PaymentsOpsLaunchReleaseEvidenceHistoryViewModel {
  const sortedRecords = [...records].sort((left, right) => {
    const leftMs = new Date(left.capturedAt).getTime();
    const rightMs = new Date(right.capturedAt).getTime();

    if (leftMs !== rightMs) {
      return leftMs - rightMs;
    }

    return left.evidenceId.localeCompare(right.evidenceId);
  });
  const recordCount = sortedRecords.length;

  return {
    title: 'Persisted release evidence',
    recordCount,
    summary:
      recordCount === 0
        ? 'No immutable release evidence has been captured. The current review stays pending until real approvals are supplied.'
        : `${recordCount} immutable release evidence record${recordCount === 1 ? '' : 's'} captured for operator review.`,
    items: sortedRecords.map((record) => ({
      evidenceId: record.evidenceId,
      kind: record.kind,
      kindLabel: launchEvidenceKindLabel(record.kind),
      capturedAt: record.capturedAt,
      capturedBy: record.capturedBy,
      operatorLabel:
        record.operatorIdentity.displayName ??
        record.operatorIdentity.email ??
        record.operatorIdentity.actorId,
      reviewerLabel: record.reviewerIdentity
        ? record.reviewerIdentity.displayName ??
          record.reviewerIdentity.email ??
          record.reviewerIdentity.actorId
        : 'Not required',
      providerProfileLabel: record.immutableReference.providerProfile,
      automatedEvidenceLabel:
        record.immutableReference.automatedEvidenceGeneratedAt,
      releaseTicketLabel: record.immutableReference.releaseTicketId,
      targetReleaseStateLabel: record.immutableReference.targetReleaseState,
      payloadFingerprint: record.payloadFingerprint,
      auditEntryLabel: record.auditEntryId ?? 'Pending audit entry',
    })),
  };
}

function buildLaunchReleaseEvidenceCaptureEligibilityViewModel(
  eligibility: PaymentsLaunchEvidenceCaptureEligibility[],
): PaymentsOpsLaunchReleaseEvidenceCaptureEligibilityViewModel {
  const eligibleCount = eligibility.filter((item) => item.eligible).length;
  const itemCount = eligibility.length;

  return {
    title: 'Release evidence capture eligibility',
    eligibleCount,
    itemCount,
    summary:
      itemCount === 0
        ? 'No release evidence capture workflow has been evaluated.'
        : `${eligibleCount} of ${itemCount} capture workflow${
            itemCount === 1 ? '' : 's'
          } eligible. Blocked items are not persisted.`,
    items: eligibility.map((item) => ({
      kind: item.kind,
      kindLabel: item.kindLabel,
      statusLabel: item.statusLabel,
      eligible: item.eligible,
      operatorLabel: item.operatorLabel,
      reviewerLabel: item.reviewerLabel,
      requiredRolesLabel: item.requiredRoleLabels.join(', '),
      providerProfileLabel: item.providerProfileLabel,
      automatedEvidenceLabel: item.automatedEvidenceLabel,
      releaseTicketLabel: item.releaseTicketLabel,
      targetReleaseStateLabel: item.targetReleaseStateLabel,
      idempotencyKeyLabel: item.idempotencyKeyLabel,
      rejectionReasons: item.rejectionReasons.map((reason) => ({
        id: reason.id,
        label: reason.label,
        evidence: reason.evidence,
      })),
    })),
  };
}

export function buildPaymentsOpsConsoleViewModel(
  snapshot: PaymentsOpsConsoleSnapshot,
): PaymentsOpsConsoleViewModel {
  const webhookFailures = snapshot.providerEvents.filter((event) => event.status === 'failed').length;
  const activeDisputes = snapshot.disputes.filter((dispute) => (
    dispute.status === 'awaiting_customer' ||
    dispute.status === 'under_review' ||
    dispute.status === 'submitted_to_provider'
  )).length;

  return {
    title: 'Payments Ops',
    traceSearchPlaceholder: 'Search wallet, transfer, provider event, request, remittance, or dispute ID',
    launchReview: snapshot.launchRunbook
      ? buildLaunchReviewViewModel(
          snapshot.launchRunbook,
          snapshot.launchEvidenceTimestamps ?? {},
        )
      : null,
    launchReleaseEvidenceReview: snapshot.launchReleaseEvidenceReview
      ? buildLaunchReleaseEvidenceReviewViewModel(snapshot.launchReleaseEvidenceReview)
      : null,
    launchReleaseEvidenceCaptureEligibility:
      buildLaunchReleaseEvidenceCaptureEligibilityViewModel(
        snapshot.launchReleaseEvidenceCaptureEligibility ?? [],
      ),
    launchReleaseEvidenceHistory: buildLaunchReleaseEvidenceHistoryViewModel(
      snapshot.launchReleaseEvidenceRecords ?? [],
    ),
    queues: [
      {
        id: 'breaks',
        label: 'Reconciliation breaks',
        count: snapshot.breaks.length,
        highestSeverity: severity(snapshot.breaks.length),
      },
      {
        id: 'compliance_holds',
        label: 'Compliance holds',
        count: snapshot.complianceHoldWalletIds.length,
        highestSeverity: severity(snapshot.complianceHoldWalletIds.length),
      },
      {
        id: 'disputes',
        label: 'Disputes',
        count: activeDisputes,
        highestSeverity: severity(activeDisputes),
      },
      {
        id: 'remittance_exceptions',
        label: 'Remittance exceptions',
        count: snapshot.remittanceExceptionIds.length,
        highestSeverity: severity(snapshot.remittanceExceptionIds.length),
      },
      {
        id: 'webhook_failures',
        label: 'Webhook failures',
        count: webhookFailures,
        highestSeverity: severity(webhookFailures),
      },
    ],
  };
}
