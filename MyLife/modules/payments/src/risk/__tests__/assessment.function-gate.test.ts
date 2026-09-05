import { describe, expect, it } from 'vitest';

import {
  buildPaymentsProfile,
} from '../../compliance';
import {
  calculatePaymentsFee,
} from '../../engine';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  assessPaymentsTransferRisk,
} from '../index';
import type {
  PaymentsTransferRiskInput,
} from '../types';

function makeRiskInput(counterpartyCount: number): PaymentsTransferRiskInput {
  const sourceProfile = buildPaymentsProfile({
    ownerUserId: 'user_sender',
    primaryWalletId: 'wallet_sender',
    countryCode: 'US',
    handle: '@sender',
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: 'standard',
    fields: {
      legalName: 'Sender Example',
      email: 'sender@example.com',
      phoneE164: '+14155550123',
      dateOfBirth: '1991-01-01',
      addressLine1: '1 Main St',
      city: 'San Francisco',
      regionCode: 'CA',
      postalCode: '94105',
      governmentIdLast4: '1234',
    },
  });
  const destinationProfile = buildPaymentsProfile({
    ownerUserId: 'user_receiver',
    primaryWalletId: 'wallet_receiver',
    countryCode: 'US',
    handle: '@receiver',
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: 'standard',
    fields: {
      legalName: 'Receiver Example',
      email: 'receiver@example.com',
      phoneE164: '+14155550124',
      dateOfBirth: '1992-01-01',
      addressLine1: '2 Main St',
      city: 'San Francisco',
      regionCode: 'CA',
      postalCode: '94105',
      governmentIdLast4: '5678',
    },
  });

  return {
    transferId: 'pay_transfer_fn_gate',
    command: {
      type: 'send',
      idempotencyKey: 'risk-fn-gate',
      sourceWalletId: 'wallet_sender',
      destinationWalletId: 'wallet_receiver',
      amountCents: 25_000,
      currency: 'USD',
    },
    requestedStatus: 'completed',
    sourceWallet: {
      walletId: 'wallet_sender',
      ownerUserId: 'user_sender',
      status: 'active',
      defaultCurrency: 'USD',
      balances: { available: 500_000 },
      complianceHold: 'none',
    },
    destinationWallet: {
      walletId: 'wallet_receiver',
      ownerUserId: 'user_receiver',
      status: 'active',
      defaultCurrency: 'USD',
      balances: { available: 20_000 },
      complianceHold: 'none',
    },
    feeQuote: calculatePaymentsFee({
      kind: 'p2p',
      amountCents: 25_000,
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
    sanctionsParties: Array.from({ length: counterpartyCount }, (_, index) => ({
      partyId: `party_${index}`,
      role: index === 0 ? 'recipient' : 'sender',
      displayName: `Counterparty ${index}`,
      screeningState: 'clear',
    })),
    velocityHistory: {
      rolling24h: {
        approvedAmountCents: 50_000,
        approvedCount: Math.min(counterpartyCount, 10),
        distinctCounterpartyCount: Math.min(counterpartyCount, 10),
        pendingReviewCount: 0,
      },
    },
    behaviorContext: {
      trustedDevice: true,
      expectedCountryCode: 'US',
      sessionCountryCode: 'US',
    },
    now: new Date('2026-04-22T12:00:00.000Z'),
  };
}

describe('assessPaymentsTransferRisk function quality gate', () => {
  it('matches contract behavior for a clean transfer', () => {
    const assessment = assessPaymentsTransferRisk(makeRiskInput(2));
    expect(assessment.outcome).toBe('approve');
    expect(assessment.caseReferences).toHaveLength(0);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'assessPaymentsTransferRisk fuzz',
      iterations: 80,
      seed: 42,
      makeCase: (rng) => makeRiskInput(randomInt(rng, 1, 8)),
      assertCase: async (input) => {
        const assessment = assessPaymentsTransferRisk(input);
        expect(assessment.metadata.outcome).toBe(assessment.outcome);
        expect(assessment.metadata.caseIds).toHaveLength(
          assessment.caseReferences.length,
        );
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'assessPaymentsTransferRisk',
      sizes: [100, 200, 400],
      expected: 'linear',
      warmupRuns: 2,
      sampleRuns: 6,
      maxRatios: [4.0, 4.0],
      setup: (size) => makeRiskInput(size),
      run: async (input) => {
        for (let index = 0; index < 40; index += 1) {
          assessPaymentsTransferRisk(input);
        }
      },
    });
  });

  it('stays within memory budget under repeated assessment', async () => {
    await assertMemoryBudget({
      label: 'assessPaymentsTransferRisk',
      repeats: 12,
      maxHeapDeltaBytes: 10 * 1024 * 1024,
      setup: () => makeRiskInput(150),
      run: async (input) => {
        assessPaymentsTransferRisk(input);
      },
    });
  });
});
