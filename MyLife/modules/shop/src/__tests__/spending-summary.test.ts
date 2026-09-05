import { describe, expect, it } from 'vitest';
import {
  getMonthlySummary,
  getCategoryBreakdown,
  getCostOfOwnership,
  getSaleRatio,
  getSixMonthTrend,
} from '../engine/spending-summary';
import type { Purchase } from '../models/schemas';

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    name: 'item',
    category: 'tech',
    priceCents: 1000,
    purchaseDate: '2026-04-15',
    store: null,
    paymentMethod: null,
    brand: null,
    url: null,
    receiptPhotoId: null,
    satisfactionInitial: null,
    satisfaction30day: null,
    satisfaction90day: null,
    isImpulse: false,
    researchNotesMd: null,
    returnDeadline: null,
    returned: false,
    returnReason: null,
    wishlistItemId: null,
    notesMd: null,
    photoId: null,
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
    ...overrides,
  };
}

describe('getMonthlySummary', () => {
  it('returns zeros for empty input', () => {
    const out = getMonthlySummary([], 2026, 4);
    expect(out.totalCents).toBe(0);
    expect(out.itemCount).toBe(0);
    expect(out.avgCents).toBe(0);
    expect(out.topCategory).toBeNull();
    expect(out.topStore).toBeNull();
  });

  it('aggregates totals for the targeted month only', () => {
    const out = getMonthlySummary(
      [
        purchase({ purchaseDate: '2026-04-01', priceCents: 1000, category: 'tech', store: 'A' }),
        purchase({ purchaseDate: '2026-04-30', priceCents: 3000, category: 'tech', store: 'A' }),
        purchase({ purchaseDate: '2026-03-15', priceCents: 99999 }),
      ],
      2026,
      4,
    );
    expect(out.totalCents).toBe(4000);
    expect(out.itemCount).toBe(2);
    expect(out.avgCents).toBe(2000);
    expect(out.topCategory).toBe('tech');
    expect(out.topStore).toBe('A');
  });
});

describe('getCategoryBreakdown', () => {
  it('returns empty for no matches', () => {
    expect(getCategoryBreakdown([], 2026, 4)).toEqual([]);
  });

  it('sums per-category totals and percentages adjust to 100', () => {
    const rows = getCategoryBreakdown(
      [
        purchase({ category: 'tech', priceCents: 6000 }),
        purchase({ category: 'clothing', priceCents: 3000 }),
        purchase({ category: 'home', priceCents: 1000 }),
      ],
      2026,
      4,
    );
    const sum = rows.reduce((s, r) => s + r.percentage, 0);
    expect(sum).toBe(100);
    expect(rows[0]!.category).toBe('tech');
    expect(rows[0]!.totalCents).toBe(6000);
  });
});

describe('getCostOfOwnership', () => {
  it('returns 0 for empty category', () => {
    expect(getCostOfOwnership([purchase()], '')).toBe(0);
  });

  it('sums everything in a category across all dates', () => {
    expect(
      getCostOfOwnership(
        [
          purchase({ category: 'tech', priceCents: 100 }),
          purchase({ category: 'tech', priceCents: 200 }),
          purchase({ category: 'home', priceCents: 999 }),
        ],
        'tech',
      ),
    ).toBe(300);
  });
});

describe('getSaleRatio', () => {
  it('returns zeros (no inferable sale data yet)', () => {
    expect(getSaleRatio([purchase()])).toEqual({
      saleCount: 0,
      fullPriceCount: 0,
      salePercentage: 0,
    });
  });
});

describe('getSixMonthTrend', () => {
  it('returns 6 contiguous months ending at the anchor (oldest first)', () => {
    const rows = getSixMonthTrend([], 2026, 4);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ year: 2025, month: 11 });
    expect(rows[5]).toMatchObject({ year: 2026, month: 4 });
  });

  it('aggregates totals into the right month bucket', () => {
    const rows = getSixMonthTrend(
      [
        purchase({ purchaseDate: '2026-04-15', priceCents: 100 }),
        purchase({ purchaseDate: '2026-02-15', priceCents: 200 }),
        purchase({ purchaseDate: '2025-12-15', priceCents: 300 }),
        purchase({ purchaseDate: '2024-01-01', priceCents: 99999 }),
      ],
      2026,
      4,
    );
    const apr = rows.find((r) => r.year === 2026 && r.month === 4)!;
    const feb = rows.find((r) => r.year === 2026 && r.month === 2)!;
    const dec = rows.find((r) => r.year === 2025 && r.month === 12)!;
    expect(apr.totalCents).toBe(100);
    expect(feb.totalCents).toBe(200);
    expect(dec.totalCents).toBe(300);
  });
});
