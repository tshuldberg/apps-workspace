import { describe, it, expect } from 'vitest';
import {
  getExpirationStatus,
  annualizePremium,
  getTotalAnnualPremium,
  maskPolicyNumber,
} from '../engines/insurance-engine';
import type { InsurancePolicy } from '../types';

// ---------------------------------------------------------------------------
// getExpirationStatus
// ---------------------------------------------------------------------------

describe('getExpirationStatus', () => {
  it('returns "active" when end date is more than 30 days away', () => {
    expect(getExpirationStatus('2026-12-31', '2026-01-01')).toBe('active');
  });

  it('returns "expiring_soon" when end date is within 30 days', () => {
    expect(getExpirationStatus('2026-01-25', '2026-01-01')).toBe('expiring_soon');
  });

  it('returns "expiring_soon" when end date is exactly 30 days away', () => {
    expect(getExpirationStatus('2026-01-31', '2026-01-01')).toBe('expiring_soon');
  });

  it('returns "expired" when end date is in the past', () => {
    expect(getExpirationStatus('2025-12-31', '2026-01-01')).toBe('expired');
  });

  it('returns "unknown" when end date is null', () => {
    expect(getExpirationStatus(null, '2026-01-01')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// annualizePremium
// ---------------------------------------------------------------------------

describe('annualizePremium', () => {
  it('multiplies monthly premium by 12', () => {
    expect(annualizePremium(10000, 'monthly')).toBe(120000);
  });

  it('multiplies quarterly premium by 4', () => {
    expect(annualizePremium(30000, 'quarterly')).toBe(120000);
  });

  it('multiplies semi_annual premium by 2', () => {
    expect(annualizePremium(60000, 'semi_annual')).toBe(120000);
  });

  it('returns annual premium unchanged', () => {
    expect(annualizePremium(120000, 'annual')).toBe(120000);
  });
});

// ---------------------------------------------------------------------------
// getTotalAnnualPremium
// ---------------------------------------------------------------------------

describe('getTotalAnnualPremium', () => {
  const makePolicy = (premiumCents: number | null, premiumFrequency: string | null): InsurancePolicy => ({
    id: 'p1',
    vehicleId: 'v1',
    provider: 'Test',
    policyNumber: null,
    coverageType: 'liability',
    premiumCents,
    premiumFrequency: premiumFrequency as InsurancePolicy['premiumFrequency'],
    deductibleCents: null,
    startDate: null,
    endDate: null,
    agentName: null,
    agentPhone: null,
    agentEmail: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });

  it('sums annualized premiums across multiple policies', () => {
    const policies = [
      makePolicy(10000, 'monthly'),   // 120000 annual
      makePolicy(60000, 'semi_annual'), // 120000 annual
    ];
    expect(getTotalAnnualPremium(policies)).toBe(240000);
  });

  it('returns 0 for empty array', () => {
    expect(getTotalAnnualPremium([])).toBe(0);
  });

  it('skips policies with null premiumCents or premiumFrequency', () => {
    const policies = [
      makePolicy(10000, 'monthly'),
      makePolicy(null, 'monthly'),
      makePolicy(10000, null),
    ];
    expect(getTotalAnnualPremium(policies)).toBe(120000);
  });
});

// ---------------------------------------------------------------------------
// maskPolicyNumber
// ---------------------------------------------------------------------------

describe('maskPolicyNumber', () => {
  it('masks all but the last 4 characters', () => {
    expect(maskPolicyNumber('ABC123456')).toBe('*****3456');
  });

  it('returns short strings as-is when 4 or fewer characters', () => {
    expect(maskPolicyNumber('AB12')).toBe('AB12');
  });

  it('returns single character as-is', () => {
    expect(maskPolicyNumber('X')).toBe('X');
  });

  it('handles empty string', () => {
    expect(maskPolicyNumber('')).toBe('');
  });

  it('masks a 5-character string showing last 4', () => {
    expect(maskPolicyNumber('12345')).toBe('*2345');
  });
});
