import { describe, expect, it } from 'vitest';

import {
  evaluatePaymentsTierAssessment,
} from '../../compliance';
import {
  evaluatePaymentsVelocity,
  resolvePaymentsVelocityPolicy,
} from '../index';

function makeBasicAssessment() {
  return evaluatePaymentsTierAssessment({
    subjectType: 'individual',
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: 'basic',
    fields: {
      legalName: 'Alice Example',
      email: 'alice@example.com',
      phoneE164: '+14155550123',
    },
  });
}

describe('payments velocity controls', () => {
  it('rejects payments that exceed the tier single or rolling cap', () => {
    const assessment = makeBasicAssessment();
    const findings = evaluatePaymentsVelocity({
      assessment,
      paymentType: 'p2p',
      amountCents: 150_000,
      history: {
        rolling24h: {
          approvedAmountCents: 120_000,
          approvedCount: 2,
          distinctCounterpartyCount: 2,
          pendingReviewCount: 0,
        },
      },
    });

    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'velocity.single_limit_exceeded',
        'velocity.rolling_24h_exceeded',
      ]),
    );
    expect(findings.every((finding) => finding.action === 'reject')).toBe(true);
  });

  it('holds unusual bursts even when the explicit dollar cap is still available', () => {
    const assessment = makeBasicAssessment();
    const policy = resolvePaymentsVelocityPolicy({
      assessment,
      paymentType: 'p2p',
    });
    const findings = evaluatePaymentsVelocity({
      assessment,
      paymentType: 'p2p',
      amountCents: 10_000,
      history: {
        rolling24h: {
          approvedAmountCents: 20_000,
          approvedCount: policy.count24hMax,
          distinctCounterpartyCount: policy.distinctCounterparty24hMax + 1,
          pendingReviewCount: policy.pendingReview24hMax + 1,
        },
      },
    });

    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'velocity.transaction_count_burst',
        'velocity.counterparty_burst',
        'velocity.review_backlog',
      ]),
    );
    expect(findings.every((finding) => finding.action === 'hold')).toBe(true);
  });
});
