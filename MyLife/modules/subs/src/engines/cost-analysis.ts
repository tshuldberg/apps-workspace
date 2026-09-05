import type { DatabaseAdapter } from '@mylife/db';
import type {
  CostSummary,
  CategoryBreakdown,
  CycleBreakdown,
  PriceChangeAnalysis,
  BillingCycle,
} from '../types';
import { listSubscriptions, listCategories, getPriceHistory, normalizeToMonthlyCents } from '../db/crud';

export function getCostSummary(db: DatabaseAdapter): CostSummary {
  const all = listSubscriptions(db, { sortBy: 'name', sortOrder: 'asc' });
  const active = all.filter(s => s.status === 'active');
  const paused = all.filter(s => s.status === 'paused');
  const cancelled = all.filter(s => s.status === 'cancelled');
  const trial = all.filter(s => s.status === 'trial');

  const monthlyCosts = active.map(s => ({
    name: s.name,
    monthlyCents: normalizeToMonthlyCents(s.costCents, s.billingCycle),
  }));

  const totalMonthlyCents = monthlyCosts.reduce((sum, c) => sum + c.monthlyCents, 0);
  const totalAnnualCents = Math.round(totalMonthlyCents * 12);
  const totalWeeklyCents = Math.round(totalMonthlyCents * 12 / 52);

  const sorted = [...monthlyCosts].sort((a, b) => b.monthlyCents - a.monthlyCents);
  const nonZero = sorted.filter(c => c.monthlyCents > 0);

  return {
    totalMonthlyCents,
    totalAnnualCents,
    totalWeeklyCents,
    activeCount: active.length,
    pausedCount: paused.length,
    cancelledCount: cancelled.length,
    trialCount: trial.length,
    averageMonthlyCents: active.length > 0 ? Math.round(totalMonthlyCents / active.length) : 0,
    mostExpensive: nonZero.length > 0 ? { name: nonZero[0].name, monthlyCents: nonZero[0].monthlyCents } : null,
    cheapest: nonZero.length > 0 ? { name: nonZero[nonZero.length - 1].name, monthlyCents: nonZero[nonZero.length - 1].monthlyCents } : null,
  };
}

export function getCategoryBreakdown(db: DatabaseAdapter): CategoryBreakdown[] {
  const active = listSubscriptions(db, { status: 'active', sortBy: 'name', sortOrder: 'asc' });
  const categories = listCategories(db);
  const catMap = new Map(categories.map(c => [c.id, c]));

  const groups = new Map<string | null, { monthlyCents: number; count: number }>();

  for (const sub of active) {
    const key = sub.categoryId;
    const existing = groups.get(key) ?? { monthlyCents: 0, count: 0 };
    existing.monthlyCents += normalizeToMonthlyCents(sub.costCents, sub.billingCycle);
    existing.count += 1;
    groups.set(key, existing);
  }

  const totalMonthly = active.reduce((sum, s) => sum + normalizeToMonthlyCents(s.costCents, s.billingCycle), 0);

  const result: CategoryBreakdown[] = [];
  for (const [catId, data] of groups) {
    const cat = catId ? catMap.get(catId) : null;
    result.push({
      categoryId: catId,
      categoryName: cat?.name ?? 'Other',
      categoryColor: cat?.color ?? '#6B7280',
      monthlyCents: data.monthlyCents,
      annualCents: Math.round(data.monthlyCents * 12),
      percentage: totalMonthly > 0 ? Math.round(data.monthlyCents / totalMonthly * 100) : 0,
      subscriptionCount: data.count,
    });
  }

  return result.sort((a, b) => b.monthlyCents - a.monthlyCents);
}

export function getCycleBreakdown(db: DatabaseAdapter): CycleBreakdown[] {
  const active = listSubscriptions(db, { status: 'active', sortBy: 'name', sortOrder: 'asc' });
  const groups = new Map<BillingCycle, { count: number; totalMonthlyCents: number }>();

  for (const sub of active) {
    const existing = groups.get(sub.billingCycle) ?? { count: 0, totalMonthlyCents: 0 };
    existing.count += 1;
    existing.totalMonthlyCents += normalizeToMonthlyCents(sub.costCents, sub.billingCycle);
    groups.set(sub.billingCycle, existing);
  }

  const totalMonthly = active.reduce((sum, s) => sum + normalizeToMonthlyCents(s.costCents, s.billingCycle), 0);

  const result: CycleBreakdown[] = [];
  for (const [cycle, data] of groups) {
    result.push({
      cycle,
      count: data.count,
      totalMonthlyCents: data.totalMonthlyCents,
      percentage: totalMonthly > 0 ? Math.round(data.totalMonthlyCents / totalMonthly * 100) : 0,
    });
  }

  return result.sort((a, b) => b.totalMonthlyCents - a.totalMonthlyCents);
}

export function getPriceChanges(db: DatabaseAdapter): PriceChangeAnalysis[] {
  const subs = listSubscriptions(db, { sortBy: 'name', sortOrder: 'asc' });
  const result: PriceChangeAnalysis[] = [];

  for (const sub of subs) {
    const history = getPriceHistory(db, sub.id);
    if (history.length === 0) continue;

    const sorted = [...history].sort((a, b) => a.changedOn.localeCompare(b.changedOn));
    const original = sorted[0].oldCostCents;
    const current = sub.costCents;
    const totalChange = current - original;
    const totalChangePercent = original > 0 ? Math.round(totalChange / original * 100) : 0;

    const changes = sorted.map(h => ({
      date: h.changedOn,
      oldCents: h.oldCostCents,
      newCents: h.newCostCents,
      changeCents: h.newCostCents - h.oldCostCents,
      changePercent: h.oldCostCents > 0 ? Math.round((h.newCostCents - h.oldCostCents) / h.oldCostCents * 100) : 0,
    }));

    result.push({
      subscriptionId: sub.id,
      subscriptionName: sub.name,
      currentCostCents: current,
      originalCostCents: original,
      totalChangeCents: totalChange,
      totalChangePercent,
      changes,
      direction: totalChange > 0 ? 'increased' : totalChange < 0 ? 'decreased' : 'stable',
    });
  }

  return result.sort((a, b) => b.totalChangeCents - a.totalChangeCents);
}

export function getSpendingProjection(db: DatabaseAdapter): { next30DaysCents: number; next90DaysCents: number; next12MonthsCents: number } {
  const active = listSubscriptions(db, { status: 'active', sortBy: 'name', sortOrder: 'asc' });
  const totalMonthly = active.reduce((sum, s) => sum + normalizeToMonthlyCents(s.costCents, s.billingCycle), 0);

  return {
    next30DaysCents: totalMonthly,
    next90DaysCents: Math.round(totalMonthly * 3),
    next12MonthsCents: Math.round(totalMonthly * 12),
  };
}
