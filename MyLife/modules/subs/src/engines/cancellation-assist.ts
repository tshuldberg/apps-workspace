import type { DatabaseAdapter } from '@mylife/db';
import type { OpportunityScore, Subscription } from '../types';
import { listSubscriptions, getPriceHistory, normalizeToMonthlyCents, normalizeToAnnualCents } from '../db/crud';

export function scoreSubscription(
  sub: Subscription,
  priceHistory: { changedOn: string; oldCostCents: number; newCostCents: number }[],
  allActiveSubs: Subscription[],
  now?: Date,
): OpportunityScore {
  const today = now ?? new Date();
  const reasons: OpportunityScore['reasons'] = [];
  let totalScore = 0;

  if (sub.status === 'cancelled' || sub.status === 'expired') {
    return { subscriptionId: sub.id, subscriptionName: sub.name, totalScore: 0, reasons: [], monthlySavingsCents: 0, annualSavingsCents: 0, priority: 'medium' };
  }

  // 1. Duration signal (0-30)
  const startDate = new Date(sub.startDate + 'T00:00:00Z');
  const monthsActive = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

  if (sub.status === 'trial' && sub.trialEndDate) {
    const trialEnd = new Date(sub.trialEndDate + 'T00:00:00Z');
    const daysUntilEnd = Math.floor((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilEnd <= 7 && daysUntilEnd >= 0) {
      const pts = 25;
      totalScore += pts;
      reasons.push({ signal: 'trial', points: pts, description: `Trial ending in ${daysUntilEnd} days` });
    }
  } else if (monthsActive > 12) {
    totalScore += 30;
    reasons.push({ signal: 'duration', points: 30, description: `Active for ${monthsActive} months, possibly forgotten` });
  } else if (monthsActive > 6) {
    totalScore += 15;
    reasons.push({ signal: 'duration', points: 15, description: `Active for ${monthsActive} months` });
  } else if (monthsActive > 3) {
    totalScore += 5;
    reasons.push({ signal: 'duration', points: 5, description: `Active for ${monthsActive} months` });
  }

  // 2. Price increase signal (0-30)
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentIncreases = priceHistory.filter(h => {
    const d = new Date(h.changedOn);
    return d >= sixMonthsAgo && h.newCostCents > h.oldCostCents;
  });

  if (recentIncreases.length > 0) {
    const lastIncrease = recentIncreases[recentIncreases.length - 1];
    const pctIncrease = lastIncrease.oldCostCents > 0
      ? Math.round((lastIncrease.newCostCents - lastIncrease.oldCostCents) / lastIncrease.oldCostCents * 100)
      : 0;

    if (pctIncrease > 20) {
      totalScore += 30;
      reasons.push({ signal: 'price_increase', points: 30, description: `Price increased ${pctIncrease}% in the last 6 months` });
    } else if (pctIncrease > 0) {
      totalScore += 20;
      reasons.push({ signal: 'price_increase', points: 20, description: `Price increased ${pctIncrease}% in the last 6 months` });
    }
  }
  if (priceHistory.filter(h => h.newCostCents > h.oldCostCents).length > 1) {
    totalScore += 25;
    reasons.push({ signal: 'multiple_increases', points: 25, description: 'Multiple price increases in history' });
  }

  // 3. Cost signal (0-25)
  const monthlyCents = normalizeToMonthlyCents(sub.costCents, sub.billingCycle);
  if (monthlyCents > 3000) {
    totalScore += 25;
    reasons.push({ signal: 'high_cost', points: 25, description: `Monthly cost exceeds $30` });
  } else if (monthlyCents > 2000) {
    totalScore += 20;
    reasons.push({ signal: 'high_cost', points: 20, description: `Monthly cost exceeds $20` });
  } else if (monthlyCents > 1000) {
    totalScore += 10;
    reasons.push({ signal: 'moderate_cost', points: 10, description: `Monthly cost exceeds $10` });
  } else if (monthlyCents > 500) {
    totalScore += 5;
    reasons.push({ signal: 'cost', points: 5, description: `Monthly cost exceeds $5` });
  }

  // 4. Duplicate signal (0-15)
  if (sub.categoryId) {
    const sameCat = allActiveSubs.filter(s => s.categoryId === sub.categoryId && s.id !== sub.id && (s.status === 'active' || s.status === 'trial'));
    if (sameCat.length > 0) {
      totalScore += 15;
      const names = sameCat.map(s => s.name).slice(0, 3).join(', ');
      reasons.push({ signal: 'duplicate', points: 15, description: `Duplicate: you also have ${names} in the same category` });
    }
  }

  return {
    subscriptionId: sub.id,
    subscriptionName: sub.name,
    totalScore,
    reasons,
    monthlySavingsCents: monthlyCents,
    annualSavingsCents: normalizeToAnnualCents(sub.costCents, sub.billingCycle),
    priority: totalScore >= 60 ? 'high' : 'medium',
  };
}

export function getOpportunities(db: DatabaseAdapter, threshold?: number): OpportunityScore[] {
  const cutoff = threshold ?? 40;
  const allSubs = listSubscriptions(db, { sortBy: 'name', sortOrder: 'asc' });
  const activeSubs = allSubs.filter(s => s.status === 'active' || s.status === 'paused' || s.status === 'trial');

  const results: OpportunityScore[] = [];

  for (const sub of activeSubs) {
    // Check cooldowns
    if (!shouldShowOpportunity(db, sub.id)) continue;

    const history = getPriceHistory(db, sub.id);
    const score = scoreSubscription(sub, history, activeSubs);

    if (score.totalScore >= cutoff) {
      results.push(score);
    }
  }

  return results.sort((a, b) => b.totalScore - a.totalScore);
}

export function shouldShowOpportunity(db: DatabaseAdapter, subscriptionId: string): boolean {
  const cooldowns: Record<string, number> = {
    kept: 90,
    reminded: 30,
    dismissed: 60,
  };

  for (const [action, days] of Object.entries(cooldowns)) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();
    const rows = db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM sb_cancellation_actions
       WHERE subscription_id = ? AND action = ?
       AND acted_on > ?`,
      [subscriptionId, action, cutoffIso],
    );
    if ((rows[0]?.count ?? 0) > 0) return false;
  }

  return true;
}

export function calculateTotalSavings(db: DatabaseAdapter, year?: number): { totalCents: number; cancelledCount: number; downgradedCount: number } {
  const y = year ?? new Date().getFullYear();
  const yearStr = String(y);

  const rows = db.query<Record<string, unknown>>(
    `SELECT action, COALESCE(savings_cents, 0) as savings_cents
     FROM sb_cancellation_actions
     WHERE action IN ('cancelled', 'downgraded')
     AND strftime('%Y', acted_on) = ?`,
    [yearStr],
  );

  let totalCents = 0;
  let cancelledCount = 0;
  let downgradedCount = 0;

  for (const row of rows) {
    totalCents += row.savings_cents as number;
    if (row.action === 'cancelled') cancelledCount++;
    else if (row.action === 'downgraded') downgradedCount++;
  }

  return { totalCents, cancelledCount, downgradedCount };
}
