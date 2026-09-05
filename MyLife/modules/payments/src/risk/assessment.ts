import {
  resolvePaymentsTierLimits,
} from '../compliance/tiers';
import type { PaymentsTierAssessment } from '../compliance/types';
import {
  assertPaymentsInvariant,
} from '../engine/errors';
import {
  transitionTransferStatus,
} from '../engine/fsm';
import type {
  PaymentsComplianceHoldEffect,
} from '../engine/types';
import {
  evaluatePaymentsBehaviorRisk,
} from './behavior';
import {
  screenPaymentsSanctions,
} from './screening';
import {
  evaluatePaymentsVelocity,
} from './velocity';
import type {
  PaymentsRiskActorProfile,
  PaymentsRiskAssessment,
  PaymentsRiskCaseDecisionInput,
  PaymentsRiskCaseDecisionResult,
  PaymentsRiskCaseReference,
  PaymentsRiskCategory,
  PaymentsRiskGuardInput,
  PaymentsRiskMetadata,
  PaymentsRiskPaymentType,
  PaymentsRiskReason,
  PaymentsRiskReviewQueueItem,
  PaymentsRiskSeverity,
  PaymentsRiskWorkflowTag,
  PaymentsTransferRiskInput,
} from './types';

const SEVERITY_ORDER: Record<PaymentsRiskSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function compareReasons(left: PaymentsRiskReason, right: PaymentsRiskReason): number {
  if (left.action !== right.action) {
    return left.action === 'reject' ? -1 : 1;
  }
  return SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity];
}

function resolvePaymentType(
  input: PaymentsTransferRiskInput,
): PaymentsRiskPaymentType {
  if (
    input.command.destinationRail === 'remittance' ||
    input.command.sourceRail === 'remittance' ||
    input.command.feeProfile === 'remittance'
  ) {
    return 'remittance';
  }

  if (
    input.command.destinationRail === 'merchant' ||
    input.command.sourceRail === 'merchant' ||
    input.command.feeProfile === 'merchant'
  ) {
    return 'merchant';
  }

  switch (input.command.type) {
    case 'fund':
      return 'funding';
    case 'withdraw':
      return 'withdrawal';
    case 'send':
    default:
      return 'p2p';
  }
}

function resolveReviewedProfile(
  input: PaymentsTransferRiskInput,
  paymentType: PaymentsRiskPaymentType,
): PaymentsRiskActorProfile | null {
  if (paymentType === 'funding') {
    return input.destinationProfile ?? input.sourceProfile ?? null;
  }

  if (paymentType === 'merchant' && input.merchantProfile) {
    return input.sourceProfile ?? input.destinationProfile ?? input.merchantProfile;
  }

  return input.sourceProfile ?? input.destinationProfile ?? null;
}

function resolveFallbackAssessment(): PaymentsTierAssessment {
  return {
    approvedTier: 'unverified',
    completedTier: 'unverified',
    nextTier: 'basic',
    missingFields: [],
    upgradeReady: false,
    currentLimits: resolvePaymentsTierLimits('unverified'),
  };
}

function resolveHoldEffect(
  paymentType: PaymentsRiskPaymentType,
): PaymentsComplianceHoldEffect {
  return paymentType === 'funding' ? 'receive_only' : 'send_only';
}

function highestSeverity(reasons: PaymentsRiskReason[]): PaymentsRiskSeverity {
  return reasons.reduce<PaymentsRiskSeverity>(
    (current, reason) =>
      SEVERITY_ORDER[reason.severity] > SEVERITY_ORDER[current]
        ? reason.severity
        : current,
    'low',
  );
}

function buildUserSafeExplanation(reasons: PaymentsRiskReason[]): string | null {
  if (reasons.length === 0) {
    return null;
  }

  const ordered = [...reasons].sort(compareReasons);
  const leading = ordered[0];
  if (!leading) {
    return null;
  }

  const uniqueMessages = unique(
    ordered.map((reason) => reason.userSafeExplanation),
  );
  if (uniqueMessages.length === 1) {
    return uniqueMessages[0] ?? null;
  }

  return `${leading.userSafeExplanation} Additional review signals were also recorded for this payment.`;
}

function caseConfigForCategory(category: PaymentsRiskCategory): {
  caseType: PaymentsRiskCaseReference['caseType'];
  assignedQueue: string;
  workflowTags: PaymentsRiskWorkflowTag[];
} {
  switch (category) {
    case 'sanctions':
      return {
        caseType: 'ofac_screening',
        assignedQueue: 'compliance-ofac',
        workflowTags: ['ofac_screening'],
      };
    case 'behavior':
      return {
        caseType: 'fraud_review',
        assignedQueue: 'risk-fraud',
        workflowTags: ['sar_candidate', 'manual_hold'],
      };
    case 'velocity':
    default:
      return {
        caseType: 'aml_review',
        assignedQueue: 'risk-velocity',
        workflowTags: ['sar_candidate'],
      };
  }
}

function buildCaseReferences(input: {
  transferInput: PaymentsTransferRiskInput;
  paymentType: PaymentsRiskPaymentType;
  outcome: 'hold' | 'reject';
  reasons: PaymentsRiskReason[];
  reviewedProfile: PaymentsRiskActorProfile | null;
}): PaymentsRiskCaseReference[] {
  const createId = input.transferInput.createId ?? defaultCreateId;
  const grouped = new Map<PaymentsRiskCategory, PaymentsRiskReason[]>();

  for (const reason of input.reasons) {
    const existing = grouped.get(reason.category) ?? [];
    existing.push(reason);
    grouped.set(reason.category, existing);
  }

  const identityIds = unique(
    [
      input.transferInput.sourceProfile?.identityId ?? null,
      input.transferInput.destinationProfile?.identityId ?? null,
      input.transferInput.merchantProfile?.identityId ?? null,
      ...(input.transferInput.sanctionsParties ?? []).map(
        (party) => party.identityId ?? null,
      ),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
  const providerReferences = unique(
    [
      ...(input.transferInput.sanctionsParties ?? []).flatMap((party) =>
        [
          party.providerReference ?? null,
          party.screeningReference ?? null,
        ].filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        ),
      ),
    ],
  );

  return [...grouped.entries()].map(([category, reasons]) => {
    const config = caseConfigForCategory(category);
    const primary = [...reasons].sort(compareReasons)[0]!;
    return {
      caseId: createId('pay_case'),
      caseType: config.caseType,
      status: input.outcome === 'hold' ? 'open' : 'under_review',
      severity: highestSeverity(reasons),
      holdEffect: input.outcome === 'hold' ? resolveHoldEffect(input.paymentType) : 'none',
      assignedQueue: config.assignedQueue,
      openedReason: primary.machineExplanation,
      machineReasonCodes: reasons.map((reason) => reason.code),
      userSafeExplanation: primary.userSafeExplanation,
      workflowTags: config.workflowTags,
      walletId: input.reviewedProfile?.walletId ?? null,
      transferId: input.transferInput.transferId ?? null,
      identityIds,
      providerReferences,
      metadata: {
        paymentType: input.paymentType,
        outcome: input.outcome,
        reasonCount: reasons.length,
        reviewedTier:
          input.reviewedProfile?.tierAssessment.approvedTier ?? 'unverified',
        occurredAt: input.transferInput.now.toISOString(),
      },
    };
  });
}

function buildReviewQueueItem(
  assessment: Pick<
    PaymentsRiskAssessment,
    'caseReferences' | 'holdEffect' | 'machineReasons' | 'userSafeExplanation'
  >,
  transferId: string | null | undefined,
): PaymentsRiskReviewQueueItem | null {
  if (!transferId || assessment.caseReferences.length === 0) {
    return null;
  }

  return {
    queue: 'payments-risk-review',
    transferId,
    caseIds: assessment.caseReferences.map((caseReference) => caseReference.caseId),
    identityIds: unique(
      assessment.caseReferences.flatMap((caseReference) => caseReference.identityIds),
    ),
    providerReferences: unique(
      assessment.caseReferences.flatMap(
        (caseReference) => caseReference.providerReferences,
      ),
    ),
    machineReasonCodes: assessment.machineReasons.map((reason) => reason.code),
    holdEffect: assessment.holdEffect,
    userSafeExplanation:
      assessment.userSafeExplanation ??
      'This payment is pending review before funds move.',
  };
}

function buildMetadata(
  input: {
    outcome: PaymentsRiskAssessment['outcome'];
    paymentType: PaymentsRiskPaymentType;
    reviewedTier: PaymentsTierAssessment['approvedTier'];
    reasons: PaymentsRiskReason[];
    caseReferences: PaymentsRiskCaseReference[];
  },
): PaymentsRiskMetadata {
  return {
    outcome: input.outcome,
    paymentType: input.paymentType,
    reviewedTier: input.reviewedTier,
    machineReasonCodes: input.reasons.map((reason) => reason.code),
    userSafeExplanation: buildUserSafeExplanation(input.reasons),
    caseIds: input.caseReferences.map((caseReference) => caseReference.caseId),
    workflowTags: unique(
      input.caseReferences.flatMap((caseReference) => caseReference.workflowTags),
    ),
  };
}

export function assessPaymentsTransferRisk(
  input: PaymentsRiskGuardInput,
): PaymentsRiskAssessment {
  const paymentType = resolvePaymentType(input);
  const reviewedProfile = resolveReviewedProfile(input, paymentType);
  const reviewedAssessment =
    reviewedProfile?.tierAssessment ?? resolveFallbackAssessment();
  const exposureAmount =
    paymentType === 'funding'
      ? input.command.amountCents
      : input.feeQuote.totalDebitCents;
  const reasons = [
    ...screenPaymentsSanctions({
      parties: input.sanctionsParties ?? [],
      watchlist: input.watchlist,
      blockedCountryCodes: input.blockedCountryCodes,
    }),
    ...evaluatePaymentsVelocity({
      assessment: reviewedAssessment,
      paymentType,
      amountCents: exposureAmount,
      history: input.velocityHistory,
      instant:
        input.command.type === 'withdraw' && input.command.speed === 'instant',
    }),
    ...evaluatePaymentsBehaviorRisk({
      assessment: reviewedAssessment,
      paymentType,
      amountCents: exposureAmount,
      behavior: input.behaviorContext,
    }),
  ].sort(compareReasons);

  const rejectReasons = reasons.filter((reason) => reason.action === 'reject');
  const holdReasons = reasons.filter((reason) => reason.action === 'hold');
  const outcome: PaymentsRiskAssessment['outcome'] =
    rejectReasons.length > 0
      ? 'reject'
      : holdReasons.length > 0
        ? 'hold'
        : 'approve';
  const appliedReasons =
    outcome === 'reject'
      ? rejectReasons
      : outcome === 'hold'
        ? holdReasons
        : [];
  const caseReferences =
    outcome === 'approve'
      ? []
      : buildCaseReferences({
          transferInput: input,
          paymentType,
          outcome,
          reasons: appliedReasons,
          reviewedProfile,
        });

  const metadata = buildMetadata({
    outcome,
    paymentType,
    reviewedTier: reviewedAssessment.approvedTier,
    reasons: appliedReasons,
    caseReferences,
  });

  const assessment: PaymentsRiskAssessment = {
    outcome,
    paymentType,
    reviewedTier: reviewedAssessment.approvedTier,
    recommendedTransferStatus:
      outcome === 'approve'
        ? input.requestedStatus
        : outcome === 'hold'
          ? 'pending_review'
          : null,
    domainErrorCode:
      outcome !== 'reject'
        ? null
        : rejectReasons.some((reason) => reason.category === 'velocity')
          ? 'limit_blocked'
          : 'compliance_hold',
    holdEffect: outcome === 'hold' ? resolveHoldEffect(paymentType) : 'none',
    machineReasons: appliedReasons,
    userSafeExplanation: metadata.userSafeExplanation,
    caseReferences,
    reviewQueueItem: null,
    metadata,
  };

  if (outcome === 'hold') {
    assessment.reviewQueueItem = buildReviewQueueItem(
      assessment,
      input.transferId,
    );
  }

  return assessment;
}

export function resolvePaymentsRiskCaseDecision(
  input: PaymentsRiskCaseDecisionInput,
): PaymentsRiskCaseDecisionResult {
  assertPaymentsInvariant(
    input.currentTransferStatus === 'pending_review',
    'invalid_transition',
    'Risk case decisions require a pending_review transfer',
    {
      currentTransferStatus: input.currentTransferStatus,
      caseId: input.caseReference.caseId,
    },
  );

  if (input.action === 'release') {
    const nextTransferStatus = input.releaseToStatus ?? 'pending_provider';
    const transition = transitionTransferStatus(
      input.currentTransferStatus,
      nextTransferStatus,
    );

    return {
      action: 'release',
      caseId: input.caseReference.caseId,
      caseStatus: 'cleared',
      holdEffect: 'none',
      nextTransferStatus,
      eventType: transition.eventType,
      userSafeExplanation:
        'Review completed. This payment can continue.',
      metadata: {
        caseId: input.caseReference.caseId,
        caseType: input.caseReference.caseType,
        note: input.note ?? null,
        workflowTags: input.caseReference.workflowTags,
      },
    };
  }

  const transition = transitionTransferStatus(
    input.currentTransferStatus,
    'failed',
  );

  return {
    action: 'reject',
    caseId: input.caseReference.caseId,
    caseStatus:
      input.reportingDisposition === 'report' ? 'reported' : 'closed',
    holdEffect: input.caseReference.holdEffect,
    nextTransferStatus: 'failed',
    eventType: transition.eventType,
    userSafeExplanation:
      'This payment could not be approved after review.',
    metadata: {
      caseId: input.caseReference.caseId,
      caseType: input.caseReference.caseType,
      note: input.note ?? null,
      reportingDisposition: input.reportingDisposition ?? 'none',
      workflowTags: input.caseReference.workflowTags,
    },
  };
}
