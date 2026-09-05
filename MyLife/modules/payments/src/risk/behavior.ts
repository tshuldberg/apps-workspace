import type { PaymentsTierAssessment } from '../compliance/types';
import type {
  PaymentsRiskBehaviorContext,
  PaymentsRiskPaymentType,
  PaymentsRiskReason,
} from './types';

function resolveHighValueThreshold(assessment: PaymentsTierAssessment): number {
  return Math.max(50_000, Math.floor(assessment.currentLimits.sendSingleMaxCents / 2));
}

export function evaluatePaymentsBehaviorRisk(input: {
  assessment: PaymentsTierAssessment;
  paymentType: PaymentsRiskPaymentType;
  amountCents: number;
  behavior?: PaymentsRiskBehaviorContext;
}): PaymentsRiskReason[] {
  const behavior = input.behavior;
  if (!behavior) {
    return [];
  }

  const findings: PaymentsRiskReason[] = [];
  const highValueThreshold = resolveHighValueThreshold(input.assessment);

  if (
    behavior.trustedDevice === false &&
    (behavior.deviceAgeHours ?? 0) <= 24 &&
    input.amountCents >= highValueThreshold
  ) {
    findings.push({
      code: 'behavior.new_device_high_value',
      category: 'behavior',
      action: 'hold',
      severity: 'high',
      machineExplanation: `High-value ${input.paymentType} attempted from an untrusted device younger than 24h.`,
      userSafeTitle: 'Payment pending review',
      userSafeExplanation:
        'This payment is pending review because it was started from a new device at a higher-than-normal amount.',
      metadata: {
        amountCents: input.amountCents,
        highValueThreshold,
        deviceAgeHours: behavior.deviceAgeHours ?? null,
        trustedDevice: behavior.trustedDevice,
      },
    });
  }

  if (
    behavior.expectedCountryCode &&
    behavior.sessionCountryCode &&
    behavior.expectedCountryCode !== behavior.sessionCountryCode
  ) {
    findings.push({
      code: 'behavior.country_mismatch',
      category: 'behavior',
      action: 'hold',
      severity: 'medium',
      machineExplanation: `Session country ${behavior.sessionCountryCode} did not match expected country ${behavior.expectedCountryCode}.`,
      userSafeTitle: 'Payment pending review',
      userSafeExplanation:
        'This payment is pending review because the current session location does not match the account country on file.',
      metadata: {
        expectedCountryCode: behavior.expectedCountryCode,
        sessionCountryCode: behavior.sessionCountryCode,
      },
    });
  }

  if (
    behavior.recentPasswordResetHours !== null &&
    behavior.recentPasswordResetHours !== undefined &&
    behavior.recentPasswordResetHours <= 24 &&
    (input.paymentType === 'p2p' ||
      input.paymentType === 'withdrawal' ||
      input.paymentType === 'remittance')
  ) {
    findings.push({
      code: 'behavior.password_reset_recent',
      category: 'behavior',
      action: 'hold',
      severity: 'high',
      machineExplanation: `Recent password reset (${behavior.recentPasswordResetHours}h) preceded a sensitive ${input.paymentType}.`,
      userSafeTitle: 'Payment pending review',
      userSafeExplanation:
        'This payment is pending review because account credentials were changed recently.',
      metadata: {
        recentPasswordResetHours: behavior.recentPasswordResetHours,
        paymentType: input.paymentType,
      },
    });
  }

  if (
    behavior.newCounterparty &&
    (behavior.priorRejectedTransfers30d ?? 0) >= 3
  ) {
    findings.push({
      code: 'behavior.repeat_rejections',
      category: 'behavior',
      action: 'hold',
      severity: 'medium',
      machineExplanation: `New counterparty activity followed ${behavior.priorRejectedTransfers30d} rejected transfers in 30d.`,
      userSafeTitle: 'Payment pending review',
      userSafeExplanation:
        'This payment is pending review because recent account activity needs an additional risk check.',
      metadata: {
        newCounterparty: behavior.newCounterparty,
        priorRejectedTransfers30d: behavior.priorRejectedTransfers30d ?? 0,
      },
    });
  }

  return findings;
}
