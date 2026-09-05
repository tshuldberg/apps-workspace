/**
 * Subscription ROI scoring engine.
 *
 * Scores each subscription on a usage/value basis:
 * - ACTIVE: recent transaction activity suggests active use
 * - UNDERUSED: some activity but declining
 * - UNUSED: no activity in a significant period
 *
 * Builds on the existing cancellation-assist engine and subscription catalog.
 * All amounts in integer cents.
 */

import { normalizeToMonthly, normalizeToAnnual } from './cost';
import type { BudgetSubscription } from '../types';

export type UsageStatus = 'active' | 'underused' | 'unused';

export interface SubscriptionROI {
  subscriptionId: string;
  subscriptionName: string;
  /** Monthly cost in cents. */
  monthlyCostCents: number;
  /** Annual cost in cents. */
  annualCostCents: number;
  /** Usage status based on transaction activity. */
  usageStatus: UsageStatus;
  /** Days since last related transaction. null if never seen. */
  daysSinceLastActivity: number | null;
  /** Number of related transactions in the evaluation window. */
  activityCount: number;
  /** Human-readable ROI summary. */
  summary: string;
  /** Icon from subscription record. */
  icon: string | null;
}

export interface ROIInput {
  subscription: BudgetSubscription;
  /** Dates of transactions related to this subscription (YYYY-MM-DD). */
  relatedTransactionDates: string[];
  /** Current date as YYYY-MM-DD. */
  today: string;
}

function daysBetween(earlier: string, later: string): number {
  const a = new Date(earlier + 'T00:00:00Z');
  const b = new Date(later + 'T00:00:00Z');
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

/**
 * Classify usage status based on transaction recency.
 *
 * - ACTIVE: last activity within 30 days
 * - UNDERUSED: last activity 31-60 days ago
 * - UNUSED: last activity 60+ days ago or never
 */
export function classifyUsage(
  daysSinceLastActivity: number | null,
): UsageStatus {
  if (daysSinceLastActivity === null) return 'unused';
  if (daysSinceLastActivity <= 30) return 'active';
  if (daysSinceLastActivity <= 60) return 'underused';
  return 'unused';
}

/**
 * Score a single subscription's ROI.
 */
export function scoreSubscriptionROI(input: ROIInput): SubscriptionROI {
  const { subscription: sub, relatedTransactionDates, today } = input;

  const monthlyCostCents = normalizeToMonthly(sub.price, sub.billing_cycle, sub.custom_days);
  const annualCostCents = normalizeToAnnual(sub.price, sub.billing_cycle, sub.custom_days);

  // Find most recent activity
  let daysSinceLastActivity: number | null = null;
  if (relatedTransactionDates.length > 0) {
    const sorted = [...relatedTransactionDates].sort().reverse();
    daysSinceLastActivity = daysBetween(sorted[0], today);
  }

  const usageStatus = classifyUsage(daysSinceLastActivity);
  const activityCount = relatedTransactionDates.length;

  // Build summary
  const monthlyDollars = (monthlyCostCents / 100).toFixed(2);
  let summary: string;
  switch (usageStatus) {
    case 'active':
      summary = `${sub.name}: $${monthlyDollars}/mo, last used ${daysSinceLastActivity} days ago`;
      break;
    case 'underused':
      summary = `${sub.name}: $${monthlyDollars}/mo, declining use (${daysSinceLastActivity} days since last activity)`;
      break;
    case 'unused':
      if (daysSinceLastActivity !== null) {
        summary = `${sub.name}: $${monthlyDollars}/mo, unused for ${daysSinceLastActivity} days -- consider canceling`;
      } else {
        summary = `${sub.name}: $${monthlyDollars}/mo, no activity detected -- consider canceling`;
      }
      break;
  }

  return {
    subscriptionId: sub.id,
    subscriptionName: sub.name,
    monthlyCostCents,
    annualCostCents,
    usageStatus,
    daysSinceLastActivity,
    activityCount,
    summary,
    icon: sub.icon,
  };
}

/**
 * Score all subscriptions and return sorted by ROI urgency
 * (unused first, then underused, then active).
 */
export function getROIReport(inputs: ROIInput[]): {
  subscriptions: SubscriptionROI[];
  unusedMonthlyCostCents: number;
  unusedAnnualCostCents: number;
  unusedCount: number;
  underusedCount: number;
  activeCount: number;
} {
  const subscriptions = inputs
    .filter((i) => i.subscription.status === 'active' || i.subscription.status === 'trial')
    .map((i) => scoreSubscriptionROI(i));

  // Sort: unused first (highest urgency), then underused, then active
  const statusOrder: Record<UsageStatus, number> = { unused: 0, underused: 1, active: 2 };
  subscriptions.sort((a, b) => {
    const orderDiff = statusOrder[a.usageStatus] - statusOrder[b.usageStatus];
    if (orderDiff !== 0) return orderDiff;
    // Within same status, sort by cost descending (most expensive first)
    return b.monthlyCostCents - a.monthlyCostCents;
  });

  let unusedMonthlyCostCents = 0;
  let unusedAnnualCostCents = 0;
  let unusedCount = 0;
  let underusedCount = 0;
  let activeCount = 0;

  for (const sub of subscriptions) {
    switch (sub.usageStatus) {
      case 'unused':
        unusedMonthlyCostCents += sub.monthlyCostCents;
        unusedAnnualCostCents += sub.annualCostCents;
        unusedCount++;
        break;
      case 'underused':
        underusedCount++;
        break;
      case 'active':
        activeCount++;
        break;
    }
  }

  return {
    subscriptions,
    unusedMonthlyCostCents,
    unusedAnnualCostCents,
    unusedCount,
    underusedCount,
    activeCount,
  };
}
