/**
 * Subscription cancellation assist engine.
 *
 * Scores active subscriptions on a "cancellation opportunity" scale (0-100)
 * based on usage signals, price increases, cost, and category duplication.
 * Provides actionable suggestions for users to save money.
 *
 * Pure functions for scoring. DB operations for action logging are separate.
 * All amounts in integer cents.
 */

import { normalizeToMonthly, normalizeToAnnual } from './cost';
import type { BudgetSubscription, PriceHistory } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CancellationOpportunity {
  subscriptionId: string;
  subscriptionName: string;
  score: number;          // 0-100
  monthlyCost: number;    // cents
  annualCost: number;     // cents
  reasons: string[];
  priority: 'high' | 'standard';
  icon: string | null;
  url: string | null;
}

export interface CancellationActionData {
  subscriptionId: string;
  action: CancellationActionType;
  savingsAmount: number | null; // cents (annualized)
  notes: string | null;
}

export type CancellationActionType =
  | 'dismissed'
  | 'reminded'
  | 'cancelled'
  | 'downgraded'
  | 'kept';

export interface CancellationActionRecord {
  id: string;
  subscriptionId: string;
  action: CancellationActionType;
  savingsAmount: number | null;
  notes: string | null;
  actedOn: string;
  createdAt: string;
}

export interface ScoreInput {
  subscription: BudgetSubscription;
  priceHistory: PriceHistory[];
  activeSameCategory: number;    // count of other active subs in the same catalog category
  recentActions: CancellationActionRecord[];
  today: string;                 // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cooldown periods in days by action type. */
const COOLDOWN_DAYS: Record<CancellationActionType, number> = {
  dismissed: 60,
  reminded: 30,
  cancelled: Infinity,
  downgraded: 90,
  kept: 90,
};

const ROUND_THRESHOLDS = [50, 70] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(earlier: string, later: string): number {
  const a = new Date(earlier + 'T00:00:00Z');
  const b = new Date(later + 'T00:00:00Z');
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

// ---------------------------------------------------------------------------
// Core scoring
// ---------------------------------------------------------------------------

/**
 * Check if an opportunity should be shown based on cooldown periods.
 */
export function shouldShowOpportunity(
  actions: CancellationActionRecord[],
  today: string,
): boolean {
  if (actions.length === 0) return true;

  // Sort by most recent first
  const sorted = [...actions].sort((a, b) => b.actedOn.localeCompare(a.actedOn));
  const last = sorted[0];

  const cooldown = COOLDOWN_DAYS[last.action];
  if (cooldown === Infinity) return false;

  const daysSince = daysBetween(last.actedOn.substring(0, 10), today);
  return daysSince >= cooldown;
}

/**
 * Score a single subscription for cancellation opportunity (0-100).
 * Returns 0 for cancelled/inactive subscriptions or those in cooldown.
 */
export function scoreSubscription(input: ScoreInput): {
  score: number;
  reasons: string[];
} {
  const { subscription: sub, priceHistory, activeSameCategory, recentActions, today } = input;

  // Skip cancelled/inactive subscriptions
  if (sub.status === 'cancelled') return { score: 0, reasons: [] };

  // Check cooldown
  if (!shouldShowOpportunity(recentActions, today)) return { score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];

  // --- Unused signal (0-40 points) ---

  // Trial ending soon
  if (sub.status === 'trial' && sub.trial_end_date) {
    const daysUntilEnd = daysBetween(today, sub.trial_end_date);
    if (daysUntilEnd <= 7) {
      score += 30;
      reasons.push(`Trial ending in ${daysUntilEnd} days`);
    }
  }

  // Long-running subscription (>12 months)
  const monthsActive = daysBetween(sub.start_date, today) / 30;
  if (monthsActive > 12 && priceHistory.length <= 1) {
    score += 10;
    reasons.push(`Active for ${Math.round(monthsActive)} months with no changes`);
  }

  // --- Price increase signal (0-30 points) ---

  if (priceHistory.length >= 2) {
    const sorted = [...priceHistory].sort((a, b) =>
      a.effective_date.localeCompare(b.effective_date),
    );
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];

    if (latest.price > previous.price) {
      const increasePercent = Math.round(
        ((latest.price - previous.price) / previous.price) * 100,
      );

      // Recent increase (within 6 months)
      const monthsSinceIncrease = daysBetween(latest.effective_date, today) / 30;
      if (monthsSinceIncrease <= 6) {
        if (increasePercent > 20) {
          score += 30;
          reasons.push(`Price increased ${increasePercent}% in the last 6 months`);
        } else {
          score += 20;
          reasons.push(`Price increased ${increasePercent}% recently`);
        }
      }
    }

    // Multiple price increases
    let increaseCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].price > sorted[i - 1].price) increaseCount++;
    }
    if (increaseCount >= 2) {
      score += 5; // bonus for pattern of increases (already counted one above)
      reasons.push(`${increaseCount} price increases in history`);
    }
  }

  // --- Cost signal (0-20 points) ---

  const monthly = normalizeToMonthly(sub.price, sub.billing_cycle, sub.custom_days);
  if (monthly >= 2000) {
    score += 20;
    reasons.push('Monthly cost exceeds $20');
  } else if (monthly >= 1000) {
    score += 10;
    reasons.push('Monthly cost exceeds $10');
  } else if (monthly >= 500) {
    score += 5;
    reasons.push('Monthly cost exceeds $5');
  }

  // --- Duplicate signal (0-10 points) ---

  if (activeSameCategory > 0 && sub.catalog_id) {
    score += 10;
    reasons.push(`${activeSameCategory} other subscription(s) in the same category`);
  }

  return { score: Math.min(score, 100), reasons };
}

/**
 * Get all cancellation opportunities, sorted by score descending.
 * Only returns subscriptions scoring >= threshold.
 */
export function getOpportunities(
  inputs: ScoreInput[],
  threshold = 50,
): CancellationOpportunity[] {
  const opportunities: CancellationOpportunity[] = [];

  for (const input of inputs) {
    const { score, reasons } = scoreSubscription(input);
    if (score < threshold) continue;

    const sub = input.subscription;
    const monthly = normalizeToMonthly(sub.price, sub.billing_cycle, sub.custom_days);
    const annual = normalizeToAnnual(sub.price, sub.billing_cycle, sub.custom_days);

    opportunities.push({
      subscriptionId: sub.id,
      subscriptionName: sub.name,
      score,
      monthlyCost: monthly,
      annualCost: annual,
      reasons,
      priority: score >= ROUND_THRESHOLDS[1] ? 'high' : 'standard',
      icon: sub.icon,
      url: sub.url,
    });
  }

  opportunities.sort((a, b) => b.score - a.score);
  return opportunities;
}

/**
 * Calculate total savings from cancellation/downgrade actions for a given year.
 */
export function calculateTotalSavings(
  actions: CancellationActionRecord[],
  year: number,
): { monthlySavings: number; annualSavings: number; actionCount: number } {
  const yearStr = String(year);
  let annualSavings = 0;
  let actionCount = 0;

  for (const action of actions) {
    if (action.action !== 'cancelled' && action.action !== 'downgraded') continue;
    if (!action.actedOn.startsWith(yearStr)) continue;
    if (action.savingsAmount && action.savingsAmount > 0) {
      annualSavings += action.savingsAmount;
      actionCount++;
    }
  }

  return {
    monthlySavings: Math.round(annualSavings / 12),
    annualSavings,
    actionCount,
  };
}

/**
 * Calculate total potential savings if all opportunities are acted upon.
 */
export function calculatePotentialSavings(opportunities: CancellationOpportunity[]): {
  monthlyTotal: number;
  annualTotal: number;
} {
  let monthlyTotal = 0;
  let annualTotal = 0;

  for (const opp of opportunities) {
    monthlyTotal += opp.monthlyCost;
    annualTotal += opp.annualCost;
  }

  return { monthlyTotal, annualTotal };
}
