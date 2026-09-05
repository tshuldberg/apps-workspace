import { describe, expect, it } from 'vitest';

import {
  evaluatePaymentsTierAssessment,
  explainPaymentsLimitBlock,
  getPaymentsTierRequirements,
} from '../index';

describe('payments compliance tiers', () => {
  it('computes tier readiness and missing fields for individual accounts', () => {
    const assessment = evaluatePaymentsTierAssessment({
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

    expect(assessment.approvedTier).toBe('basic');
    expect(assessment.completedTier).toBe('basic');
    expect(assessment.nextTier).toBe('standard');
    expect(assessment.missingFields).toEqual(
      expect.arrayContaining(['dateOfBirth', 'addressLine1', 'governmentIdLast4']),
    );
    expect(assessment.currentLimits.capabilities.canSend).toBe(true);
    expect(assessment.currentLimits.capabilities.canRemit).toBe(false);
  });

  it('resolves full business readiness and exposes merchant capabilities only at full tier', () => {
    const assessment = evaluatePaymentsTierAssessment({
      subjectType: 'business',
      identityStatus: 'verified',
      verificationState: 'verified',
      fields: {
        businessName: 'Acme Goods',
        businessType: 'llc',
        email: 'ops@acme.test',
        phoneE164: '+14155550199',
        addressLine1: '1 Market St',
        city: 'San Francisco',
        regionCode: 'CA',
        postalCode: '94105',
        registrationNumber: 'REG-123',
        websiteUrl: 'https://acme.test',
        taxIdLast4: '1234',
        beneficialOwnerCount: 2,
      },
    });

    expect(assessment.approvedTier).toBe('full');
    expect(assessment.completedTier).toBe('full');
    expect(assessment.nextTier).toBeNull();
    expect(assessment.currentLimits.capabilities.canAcceptMerchantQr).toBe(true);
    expect(assessment.currentLimits.capabilities.canReceiveMarketSellerPayouts).toBe(true);
  });

  it('explains limit blocks with explicit tier language', () => {
    const assessment = evaluatePaymentsTierAssessment({
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

    const explanation = explainPaymentsLimitBlock({
      assessment,
      operation: 'send',
      requestedAmountCents: 250_000,
    });

    expect(explanation).toContain('identity tier is basic');
    expect(explanation).toContain('Upgrade to standard');
    expect(getPaymentsTierRequirements('business', 'full')).toContain('beneficialOwnerCount');
  });
});
