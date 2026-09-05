import type { PaymentVerificationState } from '../types';
import type {
  PaymentsIdentityFieldKey,
  PaymentsIdentityFields,
  PaymentsIdentityStatus,
  PaymentsIdentitySubjectType,
  PaymentsIdentityTier,
  PaymentsLimitBlockInput,
  PaymentsTierAssessment,
  PaymentsTierAssessmentInput,
  PaymentsTierCapabilities,
  PaymentsTierLimitProfile,
} from './types';

const TIER_ORDER: PaymentsIdentityTier[] = [
  'unverified',
  'basic',
  'standard',
  'full',
];

const TIER_REQUIREMENTS: Record<
  PaymentsIdentitySubjectType,
  Record<PaymentsIdentityTier, PaymentsIdentityFieldKey[]>
> = {
  individual: {
    unverified: [],
    basic: ['legalName', 'email', 'phoneE164'],
    standard: [
      'legalName',
      'email',
      'phoneE164',
      'dateOfBirth',
      'addressLine1',
      'city',
      'regionCode',
      'postalCode',
      'governmentIdLast4',
    ],
    full: [
      'legalName',
      'email',
      'phoneE164',
      'dateOfBirth',
      'addressLine1',
      'city',
      'regionCode',
      'postalCode',
      'governmentIdLast4',
      'taxIdLast4',
    ],
  },
  business: {
    unverified: [],
    basic: ['businessName', 'businessType', 'email', 'phoneE164'],
    standard: [
      'businessName',
      'businessType',
      'email',
      'phoneE164',
      'addressLine1',
      'city',
      'regionCode',
      'postalCode',
      'registrationNumber',
      'websiteUrl',
    ],
    full: [
      'businessName',
      'businessType',
      'email',
      'phoneE164',
      'addressLine1',
      'city',
      'regionCode',
      'postalCode',
      'registrationNumber',
      'websiteUrl',
      'taxIdLast4',
      'beneficialOwnerCount',
    ],
  },
};

const TIER_LIMITS: Record<PaymentsIdentityTier, PaymentsTierLimitProfile> = {
  unverified: {
    sendSingleMaxCents: 0,
    sendRollingDailyMaxCents: 0,
    receiveRollingDailyMaxCents: 0,
    walletBalanceMaxCents: 0,
    remittanceRollingDailyMaxCents: 0,
    merchantSettlementRollingDailyMaxCents: 0,
    capabilities: {
      canSend: false,
      canReceive: false,
      canRemit: false,
      canIssueCards: false,
      canAcceptMerchantQr: false,
      canReceiveMarketSellerPayouts: false,
    },
  },
  basic: {
    sendSingleMaxCents: 100_000,
    sendRollingDailyMaxCents: 250_000,
    receiveRollingDailyMaxCents: 500_000,
    walletBalanceMaxCents: 1_000_000,
    remittanceRollingDailyMaxCents: 0,
    merchantSettlementRollingDailyMaxCents: 0,
    capabilities: {
      canSend: true,
      canReceive: true,
      canRemit: false,
      canIssueCards: false,
      canAcceptMerchantQr: false,
      canReceiveMarketSellerPayouts: false,
    },
  },
  standard: {
    sendSingleMaxCents: 500_000,
    sendRollingDailyMaxCents: 2_000_000,
    receiveRollingDailyMaxCents: 5_000_000,
    walletBalanceMaxCents: 10_000_000,
    remittanceRollingDailyMaxCents: 1_000_000,
    merchantSettlementRollingDailyMaxCents: 0,
    capabilities: {
      canSend: true,
      canReceive: true,
      canRemit: true,
      canIssueCards: true,
      canAcceptMerchantQr: false,
      canReceiveMarketSellerPayouts: false,
    },
  },
  full: {
    sendSingleMaxCents: 2_500_000,
    sendRollingDailyMaxCents: 10_000_000,
    receiveRollingDailyMaxCents: 25_000_000,
    walletBalanceMaxCents: 50_000_000,
    remittanceRollingDailyMaxCents: 5_000_000,
    merchantSettlementRollingDailyMaxCents: 10_000_000,
    capabilities: {
      canSend: true,
      canReceive: true,
      canRemit: true,
      canIssueCards: true,
      canAcceptMerchantQr: true,
      canReceiveMarketSellerPayouts: true,
    },
  },
};

function isProvided(value: PaymentsIdentityFields[PaymentsIdentityFieldKey]): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value !== null && value !== undefined;
}

function highestCompletedTier(
  subjectType: PaymentsIdentitySubjectType,
  fields: PaymentsIdentityFields,
): PaymentsIdentityTier {
  let highest: PaymentsIdentityTier = 'unverified';

  for (const tier of TIER_ORDER.slice(1)) {
    const requirements = TIER_REQUIREMENTS[subjectType][tier];
    const satisfied = requirements.every((field) => isProvided(fields[field]));
    if (!satisfied) {
      break;
    }
    highest = tier;
  }

  return highest;
}

function defaultApprovedTier(input: {
  approvedTier?: PaymentsIdentityTier;
  identityStatus: PaymentsIdentityStatus;
  verificationState: PaymentVerificationState;
  completedTier: PaymentsIdentityTier;
}): PaymentsIdentityTier {
  if (input.approvedTier) {
    return input.approvedTier;
  }
  if (
    input.identityStatus === 'verified' &&
    input.verificationState === 'verified'
  ) {
    return input.completedTier;
  }
  return 'unverified';
}

function nextTier(afterTier: PaymentsIdentityTier): PaymentsIdentityTier | null {
  const index = TIER_ORDER.indexOf(afterTier);
  if (index < 0 || index === TIER_ORDER.length - 1) {
    return null;
  }
  return TIER_ORDER[index + 1] ?? null;
}

export function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

export function getPaymentsTierRequirements(
  subjectType: PaymentsIdentitySubjectType,
  tier: PaymentsIdentityTier,
): PaymentsIdentityFieldKey[] {
  return [...TIER_REQUIREMENTS[subjectType][tier]];
}

export function resolvePaymentsTierLimits(
  tier: PaymentsIdentityTier,
): PaymentsTierLimitProfile {
  return {
    ...TIER_LIMITS[tier],
    capabilities: {
      ...TIER_LIMITS[tier].capabilities,
    },
  };
}

export function evaluatePaymentsTierAssessment(
  input: PaymentsTierAssessmentInput,
): PaymentsTierAssessment {
  const fields = input.fields ?? {};
  const completedTier = highestCompletedTier(input.subjectType, fields);
  const approvedTier = defaultApprovedTier({
    approvedTier: input.approvedTier,
    identityStatus: input.identityStatus,
    verificationState: input.verificationState,
    completedTier,
  });
  const next = nextTier(approvedTier);
  const missingFields = next
    ? TIER_REQUIREMENTS[input.subjectType][next].filter(
        (field) => !isProvided(fields[field]),
      )
    : [];

  return {
    approvedTier,
    completedTier,
    nextTier: next,
    missingFields,
    upgradeReady:
      next !== null &&
      missingFields.length === 0 &&
      input.identityStatus !== 'restricted' &&
      input.identityStatus !== 'rejected',
    currentLimits: resolvePaymentsTierLimits(approvedTier),
  };
}

export function explainPaymentsLimitBlock(
  input: PaymentsLimitBlockInput,
): string {
  const tier = input.assessment.approvedTier;
  const next = input.assessment.nextTier;

  switch (input.operation) {
    case 'send':
      if (input.assessment.currentLimits.sendSingleMaxCents === 0) {
        return `Your current identity tier is ${tier}. Complete basic verification before sending money.`;
      }
      return `Your current identity tier is ${tier}. ${formatCurrency(input.assessment.currentLimits.sendSingleMaxCents)} is the current send limit per transfer.${next ? ` Upgrade to ${next} for higher limits.` : ''}`;
    case 'receive':
      if (!input.assessment.currentLimits.capabilities.canReceive) {
        return `Your current identity tier is ${tier}. Receiving funds unlocks after your identity moves beyond unverified.`;
      }
      return `Your current identity tier is ${tier}. ${formatCurrency(input.assessment.currentLimits.receiveRollingDailyMaxCents)} is the daily receive ceiling.${next ? ` Upgrade to ${next} for higher limits.` : ''}`;
    case 'remittance':
      if (!input.assessment.currentLimits.capabilities.canRemit) {
        return `Your current identity tier is ${tier}. Cross-border remittances unlock at standard verification or above.`;
      }
      return `Your current identity tier is ${tier}. ${formatCurrency(input.assessment.currentLimits.remittanceRollingDailyMaxCents)} is the daily remittance limit.${next ? ` Upgrade to ${next} for more room.` : ''}`;
    case 'merchant_qr':
      return `Your current identity tier is ${tier}. Merchant QR acceptance uses the separate business onboarding track and requires full verification.`;
    case 'market_seller_payout':
      return `Your current identity tier is ${tier}. Market seller payouts use the separate business onboarding track and require full verification.`;
  }
}
