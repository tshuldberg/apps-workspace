import type { InsurancePolicy } from '../types';

export type ExpirationStatus = 'active' | 'expiring_soon' | 'expired' | 'unknown';

/**
 * Determine the expiration status of an insurance policy.
 * - expired: end date is in the past
 * - expiring_soon: end date is within 30 days
 * - active: end date is more than 30 days away
 * - unknown: no end date provided
 */
export function getExpirationStatus(endDate: string | null, currentDate: string): ExpirationStatus {
  if (endDate === null) return 'unknown';

  const endMs = new Date(endDate + 'T00:00:00Z').getTime();
  const currentMs = new Date(currentDate + 'T00:00:00Z').getTime();
  const dayMs = 86400000;

  if (currentMs > endMs) return 'expired';
  if (endMs - currentMs <= 30 * dayMs) return 'expiring_soon';
  return 'active';
}

/**
 * Convert a premium amount to annual cents based on payment frequency.
 * - monthly: x12
 * - quarterly: x4
 * - semi_annual: x2
 * - annual: x1
 */
export function annualizePremium(premiumCents: number, frequency: string): number {
  switch (frequency) {
    case 'monthly': return premiumCents * 12;
    case 'quarterly': return premiumCents * 4;
    case 'semi_annual': return premiumCents * 2;
    case 'annual': return premiumCents;
    default: return premiumCents;
  }
}

/**
 * Sum the annualized premiums for all policies that have both
 * premiumCents and premiumFrequency defined.
 */
export function getTotalAnnualPremium(policies: InsurancePolicy[]): number {
  let total = 0;
  for (const p of policies) {
    if (p.premiumCents !== null && p.premiumFrequency !== null) {
      total += annualizePremium(p.premiumCents, p.premiumFrequency);
    }
  }
  return total;
}

/**
 * Mask a policy number, showing only the last 4 characters.
 * E.g., "ABC123456" -> "*****3456"
 */
export function maskPolicyNumber(policyNumber: string): string {
  if (policyNumber.length <= 4) return policyNumber;
  const visible = policyNumber.slice(-4);
  const masked = '*'.repeat(policyNumber.length - 4);
  return masked + visible;
}
