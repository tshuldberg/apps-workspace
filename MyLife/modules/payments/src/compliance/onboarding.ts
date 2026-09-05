import type { PaymentVerificationState } from '../types';
import {
  getPaymentsTierRequirements,
} from './tiers';
import type {
  PaymentsBusinessOnboardingDraft,
  PaymentsIdentityFieldKey,
  PaymentsIdentityStatus,
  PaymentsIdentitySubjectType,
  PaymentsKybEntryPoint,
  PaymentsKybProduct,
  PaymentsTierAssessment,
} from './types';

function kybActionForStatus(status: PaymentsKybEntryPoint['status']): string {
  switch (status) {
    case 'available':
      return 'Business onboarding is ready to start without refactoring the P2P identity track.';
    case 'requires_business_identity':
      return 'Create a separate business identity track before enabling this payout or merchant surface.';
    case 'requires_full_kyc':
      return 'Complete full business verification before activating this surface.';
    case 'pending_review':
      return 'Business verification is in review. Keep the surface disabled until the review completes.';
    case 'restricted':
      return 'Business onboarding is blocked until the compliance restriction is cleared.';
  }
}

function resolveKybStatus(input: {
  subjectType: PaymentsIdentitySubjectType;
  identityStatus: PaymentsIdentityStatus;
  verificationState: PaymentVerificationState;
  assessment: PaymentsTierAssessment;
}): PaymentsKybEntryPoint['status'] {
  if (
    input.identityStatus === 'restricted' ||
    input.identityStatus === 'rejected'
  ) {
    return 'restricted';
  }
  if (input.subjectType !== 'business') {
    return 'requires_business_identity';
  }
  if (
    input.identityStatus === 'pending' ||
    input.verificationState === 'review'
  ) {
    return 'pending_review';
  }
  if (
    input.identityStatus !== 'verified' ||
    input.verificationState !== 'verified' ||
    input.assessment.approvedTier !== 'full'
  ) {
    return 'requires_full_kyc';
  }
  return 'available';
}

function requiredBusinessFields(): PaymentsIdentityFieldKey[] {
  return getPaymentsTierRequirements('business', 'full');
}

export function buildPaymentsKybEntryPoints(input: {
  subjectType: PaymentsIdentitySubjectType;
  identityStatus: PaymentsIdentityStatus;
  verificationState: PaymentVerificationState;
  assessment: PaymentsTierAssessment;
}): PaymentsKybEntryPoint[] {
  const products: PaymentsKybProduct[] = [
    'merchant_qr',
    'market_seller_payout',
  ];

  return products.map((product) => {
    const status = resolveKybStatus(input);
    return {
      product,
      status,
      requiredTier: 'full',
      distinctIdentityTrack: true,
      recommendedWalletType: 'merchant',
      requiredFields: requiredBusinessFields(),
      nextAction: kybActionForStatus(status),
    };
  });
}

export function createPaymentsBusinessOnboardingDraft(input: {
  ownerUserId: string;
  product: PaymentsKybProduct;
  sourceSurface: PaymentsBusinessOnboardingDraft['sourceSurface'];
}): PaymentsBusinessOnboardingDraft {
  return {
    ownerUserId: input.ownerUserId,
    product: input.product,
    status: 'draft',
    subjectType: 'business',
    requiredTier: 'full',
    recommendedWalletType: 'merchant',
    sourceSurface: input.sourceSurface,
  };
}
