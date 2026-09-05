/**
 * Year in Review engine. Pure functions over pre-fetched arrays. No DB calls,
 * no platform APIs. Inputs are passed in by the caller; output is a plain
 * object suitable for direct rendering.
 */

import type {
  Gift,
  Purchase,
  Warranty,
  WishlistItem,
} from '../models/schemas';

export interface CategoryBreakdownRow {
  category: string;
  totalCents: number;
  count: number;
  percentage: number;
}

export interface OccasionBreakdownRow {
  occasion: string;
  count: number;
  totalCents: number;
}

export interface GiftSummary {
  peopleCount: number;
  totalSpentCents: number;
  mostGenerousOccasion: string | null;
  occasionBreakdown: OccasionBreakdownRow[];
}

export interface WarrantyUtilization {
  claimsFiledCount: number;
  savedCents: number;
  expiredUnusedCount: number;
}

export interface WishlistConversion {
  wishlistedCount: number;
  purchasedCount: number;
  conversionPercentage: number;
}

export interface ImpulseAudit {
  impulseCount: number;
  impulseRegretRate: number;
  regrettedSpendCents: number;
}

export interface MonthlyTrendRow {
  month: number;
  totalCents: number;
  count: number;
}

export interface YearReview {
  year: number;
  totalCents: number;
  itemCount: number;
  avgCents: number;
  categoryBreakdown: CategoryBreakdownRow[];
  bestPurchases: Purchase[];
  worstPurchases: Purchase[];
  giftSummary: GiftSummary;
  warrantyUtilization: WarrantyUtilization;
  wishlistConversion: WishlistConversion;
  impulseAudit: ImpulseAudit;
  monthlyTrend: MonthlyTrendRow[];
}

export interface GenerateReviewArgs {
  year: number;
  purchases: Purchase[];
  gifts: Gift[];
  warranties: Warranty[];
  wishlistItems: WishlistItem[];
}

function parseYearMonth(date: string): { y: number; m: number } | null {
  if (!date || typeof date !== 'string') return null;
  const m = date.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return null;
  if (mo < 1 || mo > 12) return null;
  return { y, m: mo };
}

function purchaseInYear(p: Purchase, year: number): boolean {
  const ym = parseYearMonth(p.purchaseDate);
  return !!ym && ym.y === year;
}

function msInYear(ms: number, year: number): boolean {
  if (!Number.isFinite(ms)) return false;
  const d = new Date(ms);
  return d.getUTCFullYear() === year;
}

function latestSatisfaction(p: Purchase): number | null {
  if (p.satisfaction90day != null) return p.satisfaction90day;
  if (p.satisfaction30day != null) return p.satisfaction30day;
  if (p.satisfactionInitial != null) return p.satisfactionInitial;
  return null;
}

function buildCategoryBreakdown(purchases: Purchase[]): CategoryBreakdownRow[] {
  if (purchases.length === 0) return [];
  const map = new Map<string, { totalCents: number; count: number }>();
  for (const p of purchases) {
    const cur = map.get(p.category) ?? { totalCents: 0, count: 0 };
    cur.totalCents += p.priceCents;
    cur.count += 1;
    map.set(p.category, cur);
  }
  const grand = purchases.reduce((s, p) => s + p.priceCents, 0);
  const rows: CategoryBreakdownRow[] = Array.from(map.entries()).map(
    ([category, v]) => ({
      category,
      totalCents: v.totalCents,
      count: v.count,
      percentage:
        grand > 0 ? Math.round((v.totalCents / grand) * 100) : 0,
    }),
  );
  rows.sort((a, b) => b.totalCents - a.totalCents);
  if (grand > 0 && rows.length > 0) {
    const sum = rows.reduce((s, r) => s + r.percentage, 0);
    const drift = 100 - sum;
    if (drift !== 0) rows[0]!.percentage += drift;
  }
  return rows;
}

function rankBySatisfaction(purchases: Purchase[]): Purchase[] {
  return [...purchases].sort((a, b) => {
    const sa = latestSatisfaction(a);
    const sb = latestSatisfaction(b);
    const na = sa == null ? -1 : sa;
    const nb = sb == null ? -1 : sb;
    if (nb !== na) return nb - na;
    return b.priceCents - a.priceCents;
  });
}

function buildGiftSummary(gifts: Gift[]): GiftSummary {
  if (gifts.length === 0) {
    return {
      peopleCount: 0,
      totalSpentCents: 0,
      mostGenerousOccasion: null,
      occasionBreakdown: [],
    };
  }
  const peopleSet = new Set<string>();
  const occMap = new Map<string, { count: number; totalCents: number }>();
  let totalSpentCents = 0;
  for (const g of gifts) {
    peopleSet.add(g.personId);
    const spend =
      g.isGroupGift && g.myShareCents != null ? g.myShareCents : g.amountCents;
    totalSpentCents += spend;
    const cur = occMap.get(g.occasion) ?? { count: 0, totalCents: 0 };
    cur.count += 1;
    cur.totalCents += spend;
    occMap.set(g.occasion, cur);
  }
  const occasionBreakdown: OccasionBreakdownRow[] = Array.from(
    occMap.entries(),
  ).map(([occasion, v]) => ({
    occasion,
    count: v.count,
    totalCents: v.totalCents,
  }));
  occasionBreakdown.sort((a, b) => b.totalCents - a.totalCents);
  const mostGenerousOccasion =
    occasionBreakdown.length > 0 ? occasionBreakdown[0]!.occasion : null;
  return {
    peopleCount: peopleSet.size,
    totalSpentCents,
    mostGenerousOccasion,
    occasionBreakdown,
  };
}

function buildWarrantyUtilization(
  warranties: Warranty[],
  purchases: Purchase[],
  year: number,
): WarrantyUtilization {
  const purchasesById = new Map(purchases.map((p) => [p.id, p]));
  let claimsFiledCount = 0;
  let savedCents = 0;
  let expiredUnusedCount = 0;
  for (const w of warranties) {
    const expiredThisYear = msInYear(w.expiryDate, year);
    if (w.claimFiled) {
      // Claim activity is yearly when the warranty was active any time in the
      // year. Use updated_at as a proxy for claim activity to avoid a separate
      // claim-date column.
      if (msInYear(w.updatedAt, year)) {
        claimsFiledCount += 1;
        if (w.purchaseId) {
          const p = purchasesById.get(w.purchaseId);
          if (p) savedCents += p.priceCents;
        }
      }
    } else if (expiredThisYear) {
      expiredUnusedCount += 1;
    }
  }
  return { claimsFiledCount, savedCents, expiredUnusedCount };
}

function buildWishlistConversion(
  wishlistItems: WishlistItem[],
  purchases: Purchase[],
  year: number,
): WishlistConversion {
  const wishlistedCount = wishlistItems.length;
  const purchaseWishIds = new Set<string>();
  for (const p of purchases) {
    if (!purchaseInYear(p, year)) continue;
    if (p.wishlistItemId) purchaseWishIds.add(p.wishlistItemId);
  }
  const purchasedCount = purchaseWishIds.size;
  const conversionPercentage =
    wishlistedCount > 0
      ? Math.round((purchasedCount / wishlistedCount) * 100)
      : 0;
  return { wishlistedCount, purchasedCount, conversionPercentage };
}

function buildImpulseAudit(purchases: Purchase[]): ImpulseAudit {
  let impulseCount = 0;
  let regretted = 0;
  let regrettedSpendCents = 0;
  for (const p of purchases) {
    if (!p.isImpulse) continue;
    impulseCount += 1;
    const sat = latestSatisfaction(p);
    if (sat != null && sat < 3) {
      regretted += 1;
      regrettedSpendCents += p.priceCents;
    }
  }
  const impulseRegretRate = impulseCount > 0 ? regretted / impulseCount : 0;
  return { impulseCount, impulseRegretRate, regrettedSpendCents };
}

function buildMonthlyTrend(purchases: Purchase[]): MonthlyTrendRow[] {
  const totals = new Array(12).fill(0).map(() => ({ totalCents: 0, count: 0 }));
  for (const p of purchases) {
    const ym = parseYearMonth(p.purchaseDate);
    if (!ym) continue;
    const idx = ym.m - 1;
    totals[idx]!.totalCents += p.priceCents;
    totals[idx]!.count += 1;
  }
  return totals.map((t, i) => ({
    month: i + 1,
    totalCents: t.totalCents,
    count: t.count,
  }));
}

/**
 * Build the annual recap from pre-fetched purchases/gifts/warranties/wishlist.
 */
export function generateReview(args: GenerateReviewArgs): YearReview {
  const { year } = args;
  const yearPurchases = args.purchases.filter((p) => purchaseInYear(p, year));
  const yearGifts = args.gifts.filter((g) => msInYear(g.giftDate, year));
  const totalCents = yearPurchases.reduce((s, p) => s + p.priceCents, 0);
  const itemCount = yearPurchases.length;
  const avgCents = itemCount > 0 ? Math.round(totalCents / itemCount) : 0;
  const ranked = rankBySatisfaction(yearPurchases);
  const bestPurchases = ranked.slice(0, 5);
  const worstPurchases = [...ranked].reverse().slice(0, 5);
  return {
    year,
    totalCents,
    itemCount,
    avgCents,
    categoryBreakdown: buildCategoryBreakdown(yearPurchases),
    bestPurchases,
    worstPurchases,
    giftSummary: buildGiftSummary(yearGifts),
    warrantyUtilization: buildWarrantyUtilization(
      args.warranties,
      args.purchases,
      year,
    ),
    wishlistConversion: buildWishlistConversion(
      args.wishlistItems,
      args.purchases,
      year,
    ),
    impulseAudit: buildImpulseAudit(yearPurchases),
    monthlyTrend: buildMonthlyTrend(yearPurchases),
  };
}
