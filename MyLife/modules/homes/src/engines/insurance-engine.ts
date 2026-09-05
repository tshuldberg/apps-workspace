import type { InsurancePolicy, PolicyType } from '../types';

export interface PolicyCostSummary {
  totalAnnualPremium: number;
  totalCoverage: number;
  totalDeductible: number;
  policyCount: number;
}

/**
 * Return policies whose endDate is on or after `today` (i.e., not yet expired).
 */
export function getActivePolicies(
  policies: InsurancePolicy[],
  today?: string,
): InsurancePolicy[] {
  const todayStr = today ?? new Date().toISOString().slice(0, 10);

  return policies.filter((p) => p.endDate >= todayStr);
}

/**
 * Return policies whose endDate falls within `withinDays` from `today`.
 * Only includes policies that are still active (endDate >= today).
 */
export function getExpiringPolicies(
  policies: InsurancePolicy[],
  withinDays: number,
  today?: string,
): InsurancePolicy[] {
  const todayDate = today ? new Date(today) : new Date();
  const todayStr = todayDate.toISOString().slice(0, 10);
  const cutoff = new Date(todayDate);
  cutoff.setDate(cutoff.getDate() + withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return policies.filter(
    (p) => p.endDate >= todayStr && p.endDate <= cutoffStr,
  );
}

/**
 * Aggregate premium, coverage, and deductible totals across all provided policies.
 */
export function getPolicyCostSummary(
  policies: InsurancePolicy[],
): PolicyCostSummary {
  let totalAnnualPremium = 0;
  let totalCoverage = 0;
  let totalDeductible = 0;

  for (const p of policies) {
    totalAnnualPremium += p.annualPremiumCents;
    totalCoverage += p.coverageAmountCents;
    totalDeductible += p.deductibleCents;
  }

  return {
    totalAnnualPremium,
    totalCoverage,
    totalDeductible,
    policyCount: policies.length,
  };
}

/**
 * Check for missing coverage types based on ownership.
 * Owners should have: homeowners.
 * Renters should have: renters.
 * Both should consider: flood, earthquake, umbrella.
 * Returns a list of human-readable gap descriptions.
 */
export function checkCoverageGaps(
  policies: InsurancePolicy[],
  ownershipType: 'own' | 'rent',
): string[] {
  const types = new Set<PolicyType>(policies.map((p) => p.policyType));
  const gaps: string[] = [];

  if (ownershipType === 'own' && !types.has('homeowners')) {
    gaps.push('Missing homeowners insurance');
  }
  if (ownershipType === 'rent' && !types.has('renters')) {
    gaps.push('Missing renters insurance');
  }
  if (!types.has('flood')) {
    gaps.push('No flood insurance');
  }
  if (!types.has('earthquake')) {
    gaps.push('No earthquake insurance');
  }
  if (!types.has('umbrella')) {
    gaps.push('No umbrella insurance');
  }

  return gaps;
}
