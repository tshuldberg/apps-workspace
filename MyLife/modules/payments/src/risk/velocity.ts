import {
  formatCurrency,
  resolvePaymentsTierLimits,
} from '../compliance/tiers';
import type { PaymentsTierAssessment } from '../compliance/types';
import type {
  PaymentsRiskPaymentType,
  PaymentsRiskReason,
  PaymentsVelocityHistory,
  PaymentsVelocityPolicy,
} from './types';

const BASE_COUNT_THRESHOLDS: Record<
  PaymentsTierAssessment['approvedTier'],
  Pick<
    PaymentsVelocityPolicy,
    'count24hMax' | 'distinctCounterparty24hMax' | 'pendingReview24hMax'
  >
> = {
  unverified: {
    count24hMax: 0,
    distinctCounterparty24hMax: 0,
    pendingReview24hMax: 0,
  },
  basic: {
    count24hMax: 6,
    distinctCounterparty24hMax: 4,
    pendingReview24hMax: 1,
  },
  standard: {
    count24hMax: 20,
    distinctCounterparty24hMax: 10,
    pendingReview24hMax: 3,
  },
  full: {
    count24hMax: 50,
    distinctCounterparty24hMax: 25,
    pendingReview24hMax: 5,
  },
};

function scaleThreshold(value: number, multiplier: number): number {
  return Math.max(0, Math.floor(value * multiplier));
}

export function resolvePaymentsVelocityPolicy(input: {
  assessment: PaymentsTierAssessment;
  paymentType: PaymentsRiskPaymentType;
  instant?: boolean;
}): PaymentsVelocityPolicy {
  const limits = resolvePaymentsTierLimits(input.assessment.approvedTier);
  const base = BASE_COUNT_THRESHOLDS[input.assessment.approvedTier];
  const instantMultiplier = input.instant ? 0.5 : 1;

  switch (input.paymentType) {
    case 'funding':
      return {
        paymentType: input.paymentType,
        tier: input.assessment.approvedTier,
        singleMaxCents: Math.min(
          limits.receiveRollingDailyMaxCents,
          limits.walletBalanceMaxCents,
        ),
        rolling24hMaxCents: limits.receiveRollingDailyMaxCents,
        rolling7dMaxCents: limits.receiveRollingDailyMaxCents * 3,
        count24hMax: scaleThreshold(base.count24hMax, 1.2),
        distinctCounterparty24hMax: scaleThreshold(
          base.distinctCounterparty24hMax,
          1.2,
        ),
        pendingReview24hMax: base.pendingReview24hMax,
      };
    case 'withdrawal':
      return {
        paymentType: input.paymentType,
        tier: input.assessment.approvedTier,
        singleMaxCents: scaleThreshold(limits.sendSingleMaxCents, instantMultiplier),
        rolling24hMaxCents: scaleThreshold(
          limits.sendRollingDailyMaxCents,
          instantMultiplier,
        ),
        rolling7dMaxCents: scaleThreshold(
          limits.sendRollingDailyMaxCents * 3,
          instantMultiplier,
        ),
        count24hMax: scaleThreshold(base.count24hMax, instantMultiplier),
        distinctCounterparty24hMax: scaleThreshold(
          base.distinctCounterparty24hMax,
          instantMultiplier,
        ),
        pendingReview24hMax: base.pendingReview24hMax,
      };
    case 'merchant':
      return {
        paymentType: input.paymentType,
        tier: input.assessment.approvedTier,
        singleMaxCents:
          limits.merchantSettlementRollingDailyMaxCents > 0
            ? limits.merchantSettlementRollingDailyMaxCents
            : limits.sendSingleMaxCents,
        rolling24hMaxCents:
          limits.merchantSettlementRollingDailyMaxCents > 0
            ? limits.merchantSettlementRollingDailyMaxCents
            : limits.sendRollingDailyMaxCents,
        rolling7dMaxCents:
          limits.merchantSettlementRollingDailyMaxCents > 0
            ? limits.merchantSettlementRollingDailyMaxCents * 5
            : limits.sendRollingDailyMaxCents * 5,
        count24hMax: scaleThreshold(base.count24hMax, 1.5),
        distinctCounterparty24hMax: scaleThreshold(
          base.distinctCounterparty24hMax,
          1.5,
        ),
        pendingReview24hMax: base.pendingReview24hMax + 1,
      };
    case 'remittance':
      return {
        paymentType: input.paymentType,
        tier: input.assessment.approvedTier,
        singleMaxCents: Math.min(
          limits.sendSingleMaxCents,
          limits.remittanceRollingDailyMaxCents,
        ),
        rolling24hMaxCents: limits.remittanceRollingDailyMaxCents,
        rolling7dMaxCents:
          limits.remittanceRollingDailyMaxCents > 0
            ? limits.remittanceRollingDailyMaxCents * 4
            : null,
        count24hMax: scaleThreshold(base.count24hMax, 0.5),
        distinctCounterparty24hMax: scaleThreshold(
          base.distinctCounterparty24hMax,
          0.7,
        ),
        pendingReview24hMax: base.pendingReview24hMax,
      };
    case 'p2p':
    default:
      return {
        paymentType: input.paymentType,
        tier: input.assessment.approvedTier,
        singleMaxCents: limits.sendSingleMaxCents,
        rolling24hMaxCents: limits.sendRollingDailyMaxCents,
        rolling7dMaxCents: limits.sendRollingDailyMaxCents * 4,
        count24hMax: base.count24hMax,
        distinctCounterparty24hMax: base.distinctCounterparty24hMax,
        pendingReview24hMax: base.pendingReview24hMax,
      };
  }
}

export function evaluatePaymentsVelocity(input: {
  assessment: PaymentsTierAssessment;
  paymentType: PaymentsRiskPaymentType;
  amountCents: number;
  history?: PaymentsVelocityHistory;
  instant?: boolean;
}): PaymentsRiskReason[] {
  const history = input.history ?? {
    rolling24h: {
      approvedAmountCents: 0,
      approvedCount: 0,
      distinctCounterpartyCount: 0,
      pendingReviewCount: 0,
    },
  };
  const policy = resolvePaymentsVelocityPolicy({
    assessment: input.assessment,
    paymentType: input.paymentType,
    instant: input.instant,
  });
  const findings: PaymentsRiskReason[] = [];
  const projected24h = history.rolling24h.approvedAmountCents + input.amountCents;
  const projected7d =
    (history.rolling7d?.approvedAmountCents ?? history.rolling24h.approvedAmountCents) +
    input.amountCents;

  if (policy.singleMaxCents >= 0 && input.amountCents > policy.singleMaxCents) {
    findings.push({
      code: 'velocity.single_limit_exceeded',
      category: 'velocity',
      action: 'reject',
      severity: 'high',
      machineExplanation: `Transfer amount ${input.amountCents} exceeds the ${policy.paymentType} single-limit ${policy.singleMaxCents} for tier ${policy.tier}.`,
      userSafeTitle: 'Payment blocked',
      userSafeExplanation: `This payment exceeds the per-transaction limit for your ${policy.tier} verification tier (${formatCurrency(policy.singleMaxCents)}).`,
      metadata: {
        amountCents: input.amountCents,
        singleMaxCents: policy.singleMaxCents,
        paymentType: policy.paymentType,
        tier: policy.tier,
      },
    });
  }

  if (
    policy.rolling24hMaxCents >= 0 &&
    projected24h > policy.rolling24hMaxCents
  ) {
    findings.push({
      code: 'velocity.rolling_24h_exceeded',
      category: 'velocity',
      action: 'reject',
      severity: 'high',
      machineExplanation: `Projected 24h volume ${projected24h} exceeds the ${policy.paymentType} rolling limit ${policy.rolling24hMaxCents}.`,
      userSafeTitle: 'Payment blocked',
      userSafeExplanation: `This payment would exceed your current 24-hour ${policy.paymentType} limit (${formatCurrency(policy.rolling24hMaxCents)}).`,
      metadata: {
        projected24h,
        rolling24hMaxCents: policy.rolling24hMaxCents,
        paymentType: policy.paymentType,
        tier: policy.tier,
      },
    });
  }

  if (
    policy.rolling7dMaxCents !== null &&
    projected7d > policy.rolling7dMaxCents
  ) {
    findings.push({
      code: 'velocity.rolling_7d_exceeded',
      category: 'velocity',
      action: 'reject',
      severity: 'high',
      machineExplanation: `Projected 7d volume ${projected7d} exceeds the ${policy.paymentType} rolling 7-day limit ${policy.rolling7dMaxCents}.`,
      userSafeTitle: 'Payment blocked',
      userSafeExplanation:
        'This payment would exceed the current multi-day risk limit for your account.',
      metadata: {
        projected7d,
        rolling7dMaxCents: policy.rolling7dMaxCents,
        paymentType: policy.paymentType,
        tier: policy.tier,
      },
    });
  }

  if (history.rolling24h.pendingReviewCount > policy.pendingReview24hMax) {
    findings.push({
      code: 'velocity.review_backlog',
      category: 'velocity',
      action: 'hold',
      severity: 'medium',
      machineExplanation: `Pending-review backlog ${history.rolling24h.pendingReviewCount} exceeded limit ${policy.pendingReview24hMax}.`,
      userSafeTitle: 'Payment pending review',
      userSafeExplanation:
        'This payment needs an additional review because there are already several recent transfers awaiting review.',
      metadata: {
        pendingReviewCount: history.rolling24h.pendingReviewCount,
        pendingReview24hMax: policy.pendingReview24hMax,
        paymentType: policy.paymentType,
      },
    });
  }

  if (history.rolling24h.approvedCount + 1 > policy.count24hMax) {
    findings.push({
      code: 'velocity.transaction_count_burst',
      category: 'velocity',
      action: 'hold',
      severity: 'medium',
      machineExplanation: `Projected transaction count ${history.rolling24h.approvedCount + 1} exceeded limit ${policy.count24hMax}.`,
      userSafeTitle: 'Payment pending review',
      userSafeExplanation:
        'This payment needs an additional review because your recent transfer activity is above the normal limit.',
      metadata: {
        projectedCount24h: history.rolling24h.approvedCount + 1,
        count24hMax: policy.count24hMax,
        paymentType: policy.paymentType,
      },
    });
  }

  if (
    history.rolling24h.distinctCounterpartyCount >
    policy.distinctCounterparty24hMax
  ) {
    findings.push({
      code: 'velocity.counterparty_burst',
      category: 'velocity',
      action: 'hold',
      severity: 'medium',
      machineExplanation: `Distinct counterparties ${history.rolling24h.distinctCounterpartyCount} exceeded limit ${policy.distinctCounterparty24hMax}.`,
      userSafeTitle: 'Payment pending review',
      userSafeExplanation:
        'This payment needs an additional review because it follows an unusual burst of new counterparties.',
      metadata: {
        distinctCounterpartyCount: history.rolling24h.distinctCounterpartyCount,
        distinctCounterparty24hMax: policy.distinctCounterparty24hMax,
        paymentType: policy.paymentType,
      },
    });
  }

  return findings;
}
