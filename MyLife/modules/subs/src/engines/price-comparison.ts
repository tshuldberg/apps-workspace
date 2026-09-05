import type { DatabaseAdapter } from '@mylife/db';
import type { BillingCycle, PriceAlternative } from '../types';
import { getSubscription, listSubscriptions, listAlternatives, normalizeToMonthlyCents } from '../db/crud';
import { ALTERNATIVES_DATA, type AlternativesEntry } from './alternatives-catalog';

export interface TierComparison {
  tierName: string;
  monthlyCents: number;
  savingsCents: number;
  savingsPercent: number;
  features: string[];
  missingFeatures: string[];
}

export interface AnnualDiscount {
  annualCostCents: number;
  monthlyEquivalentCents: number;
  monthlySavingsCents: number;
  annualSavingsCents: number;
  savingsPercent: number;
}

export interface AlternativeComparison {
  name: string;
  monthlyCents: number;
  savingsCents: number;
  savingsPercent: number;
  freeOptionAvailable: boolean;
  url: string;
  differentiators: string[];
}

export interface ComparisonResult {
  subscriptionId: string;
  subscriptionName: string;
  currentCostCents: number;
  currentBillingCycle: BillingCycle;
  currentMonthlyCents: number;
  cheaperTiers: TierComparison[];
  annualSavings: AnnualDiscount | null;
  alternatives: AlternativeComparison[];
  userAlternatives: PriceAlternative[];
  totalPotentialSavingsCents: number;
}

export function matchToCatalog(subscriptionName: string): AlternativesEntry | null {
  const normalized = subscriptionName.toLowerCase().replace(/\s*(standard|premium|plus|pro|basic)\s*/gi, '').trim();

  // Exact match first
  for (const entry of ALTERNATIVES_DATA) {
    if (entry.serviceName.toLowerCase() === normalized) return entry;
    if (entry.serviceName.toLowerCase() === subscriptionName.toLowerCase()) return entry;
  }

  // Substring match
  for (const entry of ALTERNATIVES_DATA) {
    const entryNorm = entry.serviceName.toLowerCase();
    if (normalized.includes(entryNorm) || entryNorm.includes(normalized)) return entry;
  }

  return null;
}

export function getComparison(db: DatabaseAdapter, subscriptionId: string): ComparisonResult | null {
  const sub = getSubscription(db, subscriptionId);
  if (!sub) return null;

  const currentMonthly = normalizeToMonthlyCents(sub.costCents, sub.billingCycle);
  const catalogMatch = matchToCatalog(sub.name);
  const userAlts = listAlternatives(db, subscriptionId);

  const cheaperTiers: TierComparison[] = [];
  let annualSavings: AnnualDiscount | null = null;
  const alternatives: AlternativeComparison[] = [];

  if (catalogMatch) {
    // Find cheaper tiers
    for (const tier of catalogMatch.tiers) {
      const tierMonthly = normalizeToMonthlyCents(tier.costCents, tier.billingCycle);
      if (tierMonthly < currentMonthly) {
        cheaperTiers.push({
          tierName: tier.name,
          monthlyCents: tierMonthly,
          savingsCents: currentMonthly - tierMonthly,
          savingsPercent: currentMonthly > 0 ? Math.round((currentMonthly - tierMonthly) / currentMonthly * 100) : 0,
          features: tier.features,
          missingFeatures: tier.missingFeatures ?? [],
        });
      }
    }

    // Annual discount
    if (sub.billingCycle === 'monthly' && catalogMatch.annualCostCents) {
      const monthlyEquiv = Math.round(catalogMatch.annualCostCents / 12);
      if (monthlyEquiv < currentMonthly) {
        annualSavings = {
          annualCostCents: catalogMatch.annualCostCents,
          monthlyEquivalentCents: monthlyEquiv,
          monthlySavingsCents: currentMonthly - monthlyEquiv,
          annualSavingsCents: (currentMonthly * 12) - catalogMatch.annualCostCents,
          savingsPercent: Math.round((currentMonthly - monthlyEquiv) / currentMonthly * 100),
        };
      }
    }

    // Alternative services
    for (const alt of catalogMatch.alternatives) {
      const altMonthly = normalizeToMonthlyCents(alt.costCents, alt.billingCycle);
      if (altMonthly < currentMonthly || alt.freeOptionAvailable) {
        alternatives.push({
          name: alt.name,
          monthlyCents: altMonthly,
          savingsCents: currentMonthly - altMonthly,
          savingsPercent: currentMonthly > 0 ? Math.round((currentMonthly - altMonthly) / currentMonthly * 100) : 0,
          freeOptionAvailable: alt.freeOptionAvailable,
          url: alt.url,
          differentiators: alt.differentiators,
        });
      }
    }
  }

  const bestSavings = Math.max(
    ...cheaperTiers.map(t => t.savingsCents),
    annualSavings?.monthlySavingsCents ?? 0,
    ...alternatives.map(a => a.savingsCents),
    0,
  );

  return {
    subscriptionId: sub.id,
    subscriptionName: sub.name,
    currentCostCents: sub.costCents,
    currentBillingCycle: sub.billingCycle,
    currentMonthlyCents: currentMonthly,
    cheaperTiers: cheaperTiers.sort((a, b) => a.monthlyCents - b.monthlyCents),
    annualSavings,
    alternatives: alternatives.sort((a, b) => a.monthlyCents - b.monthlyCents),
    userAlternatives: userAlts,
    totalPotentialSavingsCents: bestSavings,
  };
}

export function getComparisonSummary(db: DatabaseAdapter): { totalMonthlySavingsCents: number; subscriptionsWithSavings: number; topOpportunity: string | null } {
  const subs = listSubscriptions(db, { status: 'active', sortBy: 'name', sortOrder: 'asc' });

  let totalSavings = 0;
  let withSavings = 0;
  let topOpp: string | null = null;
  let topSavings = 0;

  for (const sub of subs) {
    const comparison = getComparison(db, sub.id);
    if (comparison && comparison.totalPotentialSavingsCents > 0) {
      totalSavings += comparison.totalPotentialSavingsCents;
      withSavings++;
      if (comparison.totalPotentialSavingsCents > topSavings) {
        topSavings = comparison.totalPotentialSavingsCents;
        topOpp = sub.name;
      }
    }
  }

  return {
    totalMonthlySavingsCents: totalSavings,
    subscriptionsWithSavings: withSavings,
    topOpportunity: topOpp,
  };
}
