export interface InsuranceSummary {
  totalPolicies: number;
  activePolicies: number;
  annualPremiumCents: number;
  totalClaimsCents: number;
  totalReimbursedCents: number;
  reimbursementRate: number;
  pendingClaims: number;
}

export function calculateAnnualInsuranceCost(
  policies: Array<{ monthlyPremiumCents: number | null; endDate: string | null }>,
  referenceDate: string,
): number {
  return policies
    .filter((p) => !p.endDate || p.endDate >= referenceDate)
    .reduce((sum, p) => sum + (p.monthlyPremiumCents ?? 0) * 12, 0);
}

export function calculateClaimReimbursementRate(
  claims: Array<{ amountCents: number; reimbursementCents: number | null; status: string }>,
): number {
  const resolved = claims.filter((c) => c.status === 'approved' || c.status === 'denied');
  if (resolved.length === 0) return 0;
  const totalClaimed = resolved.reduce((sum, c) => sum + c.amountCents, 0);
  const totalReimbursed = resolved.reduce((sum, c) => sum + (c.reimbursementCents ?? 0), 0);
  if (totalClaimed === 0) return 0;
  return Math.round((totalReimbursed / totalClaimed) * 100);
}

export function getInsuranceSummary(
  policies: Array<{ monthlyPremiumCents: number | null; endDate: string | null }>,
  claims: Array<{ amountCents: number; reimbursementCents: number | null; status: string }>,
  referenceDate: string,
): InsuranceSummary {
  const activePolicies = policies.filter((p) => !p.endDate || p.endDate >= referenceDate).length;
  return {
    totalPolicies: policies.length,
    activePolicies,
    annualPremiumCents: calculateAnnualInsuranceCost(policies, referenceDate),
    totalClaimsCents: claims.reduce((sum, c) => sum + c.amountCents, 0),
    totalReimbursedCents: claims.reduce((sum, c) => sum + (c.reimbursementCents ?? 0), 0),
    reimbursementRate: calculateClaimReimbursementRate(claims),
    pendingClaims: claims.filter((c) => c.status === 'submitted' || c.status === 'pending').length,
  };
}
