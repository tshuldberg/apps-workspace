/**
 * Cost normalization for subscription dashboard.
 *
 * Converts any billing cycle to monthly/annual/daily equivalent.
 * All amounts are integer cents.
 */

import type { BillingCycle, BudgetSubscription } from '../types';

/**
 * Normalize a subscription price to its monthly equivalent in cents.
 */
export function normalizeToMonthly(
  price: number,
  billingCycle: BillingCycle,
  customDays?: number | null,
): number {
  switch (billingCycle) {
    case 'weekly':
      return Math.round((price * 52) / 12);
    case 'monthly':
      return price;
    case 'quarterly':
      return Math.round(price / 3);
    case 'semi_annual':
      return Math.round(price / 6);
    case 'annual':
      return Math.round(price / 12);
    case 'custom': {
      if (!customDays || customDays < 1) {
        throw new Error('custom billing cycle requires customDays >= 1');
      }
      return Math.round((price * (365 / customDays)) / 12);
    }
  }
}

/**
 * Normalize a subscription price to its annual equivalent in cents.
 */
export function normalizeToAnnual(
  price: number,
  billingCycle: BillingCycle,
  customDays?: number | null,
): number {
  switch (billingCycle) {
    case 'weekly':
      return Math.round(price * 52);
    case 'monthly':
      return Math.round(price * 12);
    case 'quarterly':
      return Math.round(price * 4);
    case 'semi_annual':
      return Math.round(price * 2);
    case 'annual':
      return price;
    case 'custom': {
      if (!customDays || customDays < 1) {
        throw new Error('custom billing cycle requires customDays >= 1');
      }
      return Math.round(price * (365 / customDays));
    }
  }
}

/**
 * Normalize a subscription price to its daily equivalent in cents.
 */
export function normalizeToDaily(
  price: number,
  billingCycle: BillingCycle,
  customDays?: number | null,
): number {
  const annual = normalizeToAnnual(price, billingCycle, customDays);
  return Math.round(annual / 365);
}

export interface EnvelopeCostSummary {
  envelopeId: string | null;
  monthlyCost: number;
  count: number;
}

export interface SubscriptionCostSummary {
  monthlyTotal: number;
  annualTotal: number;
  dailyCost: number;
  byEnvelope: EnvelopeCostSummary[];
  activeCount: number;
  totalCount: number;
}

/**
 * Calculate an aggregate cost summary across all subscriptions.
 * Only active and trial subscriptions are counted in cost totals.
 */
export function calculateSubscriptionSummary(
  subscriptions: BudgetSubscription[],
): SubscriptionCostSummary {
  const envelopeMap = new Map<string | null, EnvelopeCostSummary>();
  let monthlyTotal = 0;

  const billable = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trial',
  );

  for (const sub of billable) {
    const monthly = normalizeToMonthly(sub.price, sub.billing_cycle, sub.custom_days);
    monthlyTotal += monthly;

    const key = sub.envelope_id ?? null;
    const existing = envelopeMap.get(key);
    if (existing) {
      existing.monthlyCost += monthly;
      existing.count += 1;
    } else {
      envelopeMap.set(key, { envelopeId: key, monthlyCost: monthly, count: 1 });
    }
  }

  const annualTotal = Math.round(monthlyTotal * 12);
  const dailyCost = Math.round(annualTotal / 365);

  return {
    monthlyTotal,
    annualTotal,
    dailyCost,
    byEnvelope: Array.from(envelopeMap.values()).sort(
      (a, b) => b.monthlyCost - a.monthlyCost,
    ),
    activeCount: billable.length,
    totalCount: subscriptions.length,
  };
}
