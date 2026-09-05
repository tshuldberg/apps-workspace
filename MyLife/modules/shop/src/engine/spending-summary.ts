/**
 * Spending summary engine. Pure functions over Purchase[] (no DB, no platform).
 *
 * All amounts are in cents. Months are 1-12 (calendar month). Year is the
 * 4-digit year. Date filtering uses purchaseDate parsed as ISO `YYYY-MM-DD`.
 */

import type { Purchase } from '../models/schemas';

export interface MonthlySummary {
  totalCents: number;
  itemCount: number;
  avgCents: number;
  topCategory: string | null;
  topStore: string | null;
}

export interface CategoryBreakdownRow {
  category: string;
  totalCents: number;
  count: number;
  percentage: number;
}

export interface SaleRatio {
  saleCount: number;
  fullPriceCount: number;
  salePercentage: number;
}

export interface MonthTrendRow {
  year: number;
  month: number;
  totalCents: number;
  count: number;
}

function parseYearMonth(purchaseDate: string): { y: number; m: number } | null {
  if (!purchaseDate || typeof purchaseDate !== 'string') return null;
  const m = purchaseDate.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { y: year, m: month };
}

function isInMonth(p: Purchase, year: number, month: number): boolean {
  const ym = parseYearMonth(p.purchaseDate);
  return !!ym && ym.y === year && ym.m === month;
}

function topByTotal(
  purchases: Purchase[],
  pick: (p: Purchase) => string | null,
): string | null {
  const totals = new Map<string, number>();
  for (const p of purchases) {
    const key = pick(p);
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + p.priceCents);
  }
  let best: string | null = null;
  let bestTotal = -1;
  for (const [k, v] of totals) {
    if (v > bestTotal) {
      bestTotal = v;
      best = k;
    }
  }
  return best;
}

/**
 * Roll up totals for a single calendar month.
 */
export function getMonthlySummary(
  purchases: Purchase[],
  year: number,
  month: number,
): MonthlySummary {
  const inMonth = purchases.filter((p) => isInMonth(p, year, month));
  const totalCents = inMonth.reduce((s, p) => s + p.priceCents, 0);
  const itemCount = inMonth.length;
  const avgCents = itemCount > 0 ? Math.round(totalCents / itemCount) : 0;
  return {
    totalCents,
    itemCount,
    avgCents,
    topCategory: topByTotal(inMonth, (p) => p.category),
    topStore: topByTotal(inMonth, (p) => p.store),
  };
}

/**
 * Per-category totals for a single month, sorted by totalCents DESC.
 * Percentages are integer-rounded but adjusted on the largest row so the
 * visible percentages sum to 100 when there is at least one purchase.
 */
export function getCategoryBreakdown(
  purchases: Purchase[],
  year: number,
  month: number,
): CategoryBreakdownRow[] {
  const inMonth = purchases.filter((p) => isInMonth(p, year, month));
  if (inMonth.length === 0) return [];

  const map = new Map<string, { totalCents: number; count: number }>();
  for (const p of inMonth) {
    const cur = map.get(p.category) ?? { totalCents: 0, count: 0 };
    cur.totalCents += p.priceCents;
    cur.count += 1;
    map.set(p.category, cur);
  }

  const grandTotal = inMonth.reduce((s, p) => s + p.priceCents, 0);
  const rows: CategoryBreakdownRow[] = Array.from(map.entries()).map(
    ([category, v]) => ({
      category,
      totalCents: v.totalCents,
      count: v.count,
      percentage:
        grandTotal > 0 ? Math.round((v.totalCents / grandTotal) * 100) : 0,
    }),
  );

  rows.sort((a, b) => b.totalCents - a.totalCents);

  // Adjust the largest row's percentage so the visible breakdown sums to 100
  // when grandTotal is positive. This avoids rounding drift like 99 or 101.
  if (grandTotal > 0 && rows.length > 0) {
    const sum = rows.reduce((s, r) => s + r.percentage, 0);
    const drift = 100 - sum;
    if (drift !== 0) {
      rows[0]!.percentage += drift;
    }
  }

  return rows;
}

/**
 * Lifetime sum for a single category across all provided purchases.
 */
export function getCostOfOwnership(
  purchases: Purchase[],
  category: string,
): number {
  if (!category) return 0;
  let total = 0;
  for (const p of purchases) {
    if (p.category === category) total += p.priceCents;
  }
  return total;
}

/**
 * Sale vs full-price ratio. The current Purchase shape has no `is_on_sale`
 * column, so this returns zeros (no inferable sale data) until that column is
 * added. The shape stays stable for downstream UI.
 */
export function getSaleRatio(
  _purchases: Purchase[],
  _range?: { fromMs?: number; toMs?: number },
): SaleRatio {
  return { saleCount: 0, fullPriceCount: 0, salePercentage: 0 };
}

function shiftMonth(year: number, month: number, deltaMonths: number): { y: number; m: number } {
  const idx = year * 12 + (month - 1) + deltaMonths;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { y, m };
}

/**
 * 6-month spending trend ending at the anchor month. Returns oldest first so
 * that bar charts render naturally left-to-right.
 */
export function getSixMonthTrend(
  purchases: Purchase[],
  anchorYear: number,
  anchorMonth: number,
): MonthTrendRow[] {
  const out: MonthTrendRow[] = [];
  for (let offset = -5; offset <= 0; offset += 1) {
    const { y, m } = shiftMonth(anchorYear, anchorMonth, offset);
    const inMonth = purchases.filter((p) => isInMonth(p, y, m));
    out.push({
      year: y,
      month: m,
      totalCents: inMonth.reduce((s, p) => s + p.priceCents, 0),
      count: inMonth.length,
    });
  }
  return out;
}
