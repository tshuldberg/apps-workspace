/**
 * Impulse purchase tracker. Pure functions over Purchase[] (no DB, no platform).
 *
 * Uses the existing `isImpulse` flag on Purchase plus the satisfaction history
 * (`satisfactionInitial`, `satisfaction30day`, `satisfaction90day`) to compute
 * regret signals. A regretted impulse purchase is one where the latest
 * available satisfaction rating is below 3.
 */

import type { Purchase } from '../models/schemas';

export interface ImpulseStats {
  impulseCount: number;
  impulseCents: number;
  plannedCount: number;
  plannedCents: number;
  impulsePercentage: number;
}

export interface ImpulseRegretRate {
  totalImpulse: number;
  regretted: number;
  regretRate: number;
}

export interface TopImpulseCategory {
  category: string;
  count: number;
  totalCents: number;
}

export interface DateRange {
  fromMs?: number;
  toMs?: number;
}

function purchaseDateMs(p: Purchase): number {
  // purchaseDate is ISO `YYYY-MM-DD` (or full ISO). Date.parse handles both.
  const t = Date.parse(p.purchaseDate);
  return Number.isFinite(t) ? t : 0;
}

function inRange(p: Purchase, range?: DateRange): boolean {
  if (!range) return true;
  const t = purchaseDateMs(p);
  if (range.fromMs != null && t < range.fromMs) return false;
  if (range.toMs != null && t > range.toMs) return false;
  return true;
}

function latestSatisfaction(p: Purchase): number | null {
  if (p.satisfaction90day != null) return p.satisfaction90day;
  if (p.satisfaction30day != null) return p.satisfaction30day;
  if (p.satisfactionInitial != null) return p.satisfactionInitial;
  return null;
}

/**
 * Roll up impulse vs planned counts/spend across the (optionally filtered)
 * purchases list. `impulsePercentage` is integer-rounded.
 */
export function getImpulseStats(
  purchases: Purchase[],
  range?: DateRange,
): ImpulseStats {
  let impulseCount = 0;
  let impulseCents = 0;
  let plannedCount = 0;
  let plannedCents = 0;

  for (const p of purchases) {
    if (!inRange(p, range)) continue;
    if (p.isImpulse) {
      impulseCount += 1;
      impulseCents += p.priceCents;
    } else {
      plannedCount += 1;
      plannedCents += p.priceCents;
    }
  }

  const total = impulseCount + plannedCount;
  const impulsePercentage =
    total > 0 ? Math.round((impulseCount / total) * 100) : 0;

  return {
    impulseCount,
    impulseCents,
    plannedCount,
    plannedCents,
    impulsePercentage,
  };
}

/**
 * Of all impulse purchases, how many are "regretted" (latest available
 * satisfaction < 3). Purchases without any satisfaction rating do not count
 * as regretted.
 */
export function getImpulseRegretRate(purchases: Purchase[]): ImpulseRegretRate {
  let totalImpulse = 0;
  let regretted = 0;
  for (const p of purchases) {
    if (!p.isImpulse) continue;
    totalImpulse += 1;
    const sat = latestSatisfaction(p);
    if (sat != null && sat < 3) regretted += 1;
  }
  const regretRate = totalImpulse > 0 ? regretted / totalImpulse : 0;
  return { totalImpulse, regretted, regretRate };
}

/**
 * Top categories by impulse count, sorted by count DESC. Ties broken by
 * totalCents DESC, then category ASC for deterministic output.
 */
export function getTopImpulseCategories(
  purchases: Purchase[],
  limit = 5,
): TopImpulseCategory[] {
  const map = new Map<string, { count: number; totalCents: number }>();
  for (const p of purchases) {
    if (!p.isImpulse) continue;
    const cur = map.get(p.category) ?? { count: 0, totalCents: 0 };
    cur.count += 1;
    cur.totalCents += p.priceCents;
    map.set(p.category, cur);
  }
  const rows: TopImpulseCategory[] = Array.from(map.entries()).map(
    ([category, v]) => ({ category, count: v.count, totalCents: v.totalCents }),
  );
  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.totalCents !== a.totalCents) return b.totalCents - a.totalCents;
    return a.category.localeCompare(b.category);
  });
  return rows.slice(0, Math.max(0, limit));
}
