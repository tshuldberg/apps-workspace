import { describe, expect, it } from 'vitest';

import {
  buildPaymentsProfile,
} from '../../compliance';
import {
  calculatePaymentsFee,
} from '../../engine';
import {
  assessPaymentsTransferRisk,
  resolvePaymentsRiskCaseDecision,
} from '../index';

function makeSourceProfile() {
  return buildPaymentsProfile({
    ownerUserId: 'user_sender',
    primaryWalletId: 'wallet_sender',
    handle: '@sender',
    countryCode: 'US',
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: 'basic',
    fields: {
      legalName: 'Sender Example',
      email: 'sender@example.com',
      phoneE164: '+14155550123',
    },
  });
}

function makeDestinationProfile() {
  return buildPaymentsProfile({
    ownerUserId: 'user_receiver',
    primaryWalletId: 'wallet_receiver',
    handle: '@receiver',
    countryCode: 'US',
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: 'basic',
    fields: {
      legalName: 'Receiver Example',
      email: 'receiver@example.com',
      phoneE164: '+14155550124',
    },
  });
}

describe('payments risk assessment', () => {
  it('builds hold cases and a review queue item for combined sanctions and behavior signals', () => {
    const sourceProfile = makeSourceProfile();
    const destinationProfile = makeDestinationProfile();
    const assessment = assessPaymentsTransferRisk({
      transferId: 'pay_transfer_123',
      command: {
        type: 'send',
        idempotencyKey: 'send-risk-1',
        sourceWalletId: 'wallet_sender',
        destinationWalletId: 'wallet_receiver',
        amountCents: 60_000,
        currency: 'USD',
      },
      requestedStatus: 'completed',
      sourceWallet: {
        walletId: 'wallet_sender',
        ownerUserId: 'user_sender',
        status: 'active',
        defaultCurrency: 'USD',
        balances: { available: 250_000 },
        complianceHold: 'none',
      },
      destinationWallet: {
        walletId: 'wallet_receiver',
        ownerUserId: 'user_receiver',
        status: 'active',
        defaultCurrency: 'USD',
        balances: { available: 10_000 },
        complianceHold: 'none',
      },
      feeQuote: calculatePaymentsFee({
        kind: 'p2p',
        amountCents: 60_000,
        sourceRail: 'wallet',
        destinationRail: 'wallet',
      }),
      sourceProfile: {
        ownerUserId: sourceProfile.ownerUserId,
        walletId: sourceProfile.primaryWalletId,
        identityId: 'identity_sender',
        countryCode: sourceProfile.countryCode,
        walletType: sourceProfile.walletType,
        tierAssessment: sourceProfile.tierAssessment,
      },
      destinationProfile: {
        ownerUserId: destinationProfile.ownerUserId,
        walletId: destinationProfile.primaryWalletId,
        identityId: 'identity_receiver',
        countryCode: destinationProfile.countryCode,
        walletType: destinationProfile.walletType,
        tierAssessment: destinationProfile.tierAssessment,
      },
      sanctionsParties: [
        {
          partyId: 'party_receiver',
          role: 'recipient',
          displayName: 'Receiver Example',
          screeningState: 'potential_match',
          screeningReference: 'screen_123',
        },
      ],
      behaviorContext: {
        trustedDevice: false,
        deviceAgeHours: 2,
        expectedCountryCode: 'US',
        sessionCountryCode: 'US',
      },
      now: new Date('2026-04-22T12:00:00.000Z'),
    });

    expect(assessment.outcome).toBe('hold');
    expect(assessment.recommendedTransferStatus).toBe('pending_review');
    expect(assessment.caseReferences.map((caseReference) => caseReference.caseType)).toEqual(
      expect.arrayContaining(['ofac_screening', 'fraud_review']),
    );
    expect(assessment.reviewQueueItem).not.toBeNull();
    expect(assessment.reviewQueueItem?.transferId).toBe('pay_transfer_123');
    expect(assessment.metadata.caseIds).toHaveLength(2);
  });

  it('models release and reject decisions for held transfers', () => {
    const releaseDecision = resolvePaymentsRiskCaseDecision({
      caseReference: {
        caseId: 'pay_case_1',
        caseType: 'aml_review',
        holdEffect: 'send_only',
        workflowTags: ['sar_candidate'],
      },
      currentTransferStatus: 'pending_review',
      action: 'release',
      releaseToStatus: 'pending_provider',
    });
    const rejectDecision = resolvePaymentsRiskCaseDecision({
      caseReference: {
        caseId: 'pay_case_2',
        caseType: 'ofac_screening',
        holdEffect: 'send_only',
        workflowTags: ['ofac_screening'],
      },
      currentTransferStatus: 'pending_review',
      action: 'reject',
      reportingDisposition: 'report',
    });

    expect(releaseDecision.eventType).toBe('hold_released');
    expect(releaseDecision.caseStatus).toBe('cleared');
    expect(releaseDecision.nextTransferStatus).toBe('pending_provider');
    expect(rejectDecision.eventType).toBe('failed');
    expect(rejectDecision.caseStatus).toBe('reported');
    expect(rejectDecision.nextTransferStatus).toBe('failed');
  });
});
