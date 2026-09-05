import { describe, expect, it } from 'vitest';
import { generateReview } from '../engine/year-in-review';
import type {
  Gift,
  Purchase,
  Warranty,
  WishlistItem,
} from '../models/schemas';

function p(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    name: 'Item',
    category: 'tech',
    priceCents: 1000,
    purchaseDate: '2026-01-15',
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
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

function g(overrides: Partial<Gift> = {}): Gift {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    personId: 'person-1',
    personName: 'A',
    itemDescription: 'gift',
    occasion: 'birthday',
    occasionLabel: null,
    purchaseId: null,
    amountCents: 5000,
    giftDate: Date.UTC(2026, 5, 1),
    reactionNotes: null,
    photoId: null,
    isGroupGift: false,
    groupTotalCents: null,
    myShareCents: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function w(overrides: Partial<Warranty> = {}): Warranty {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    purchaseId: null,
    itemName: 'Thing',
    coverageType: 'manufacturer',
    startDate: Date.UTC(2026, 0, 1),
    expiryDate: Date.UTC(2027, 0, 1),
    coverageDetailsMd: null,
    serialNumber: null,
    registrationNumber: null,
    claimFiled: false,
    claimNotes: null,
    reminderDaysBefore: 30,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function wl(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    listId: 'list-1',
    name: 'Item',
    category: 'tech',
    descriptionMd: null,
    priceCents: null,
    priceRangeLow: null,
    priceRangeHigh: null,
    priority: 'want',
    url: null,
    photoId: null,
    store: null,
    brand: null,
    occasionTag: null,
    notesMd: null,
    sizeNotes: null,
    isPurchased: false,
    purchasedAt: null,
    purchaseId: null,
    isGiftFor: null,
    giftForPersonId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('generateReview', () => {
  it('returns zeros for an empty year', () => {
    const r = generateReview({
      year: 2026,
      purchases: [],
      gifts: [],
      warranties: [],
      wishlistItems: [],
    });
    expect(r.year).toBe(2026);
    expect(r.totalCents).toBe(0);
    expect(r.itemCount).toBe(0);
    expect(r.avgCents).toBe(0);
    expect(r.categoryBreakdown).toEqual([]);
    expect(r.bestPurchases).toEqual([]);
    expect(r.worstPurchases).toEqual([]);
    expect(r.giftSummary.peopleCount).toBe(0);
    expect(r.giftSummary.mostGenerousOccasion).toBeNull();
    expect(r.warrantyUtilization.claimsFiledCount).toBe(0);
    expect(r.wishlistConversion.conversionPercentage).toBe(0);
    expect(r.impulseAudit.impulseCount).toBe(0);
    expect(r.monthlyTrend).toHaveLength(12);
    expect(r.monthlyTrend.every((m) => m.count === 0)).toBe(true);
  });

  it('handles a single purchase in a single month', () => {
    const purchases = [p({ priceCents: 5000, purchaseDate: '2026-03-10' })];
    const r = generateReview({
      year: 2026,
      purchases,
      gifts: [],
      warranties: [],
      wishlistItems: [],
    });
    expect(r.totalCents).toBe(5000);
    expect(r.itemCount).toBe(1);
    expect(r.avgCents).toBe(5000);
    expect(r.monthlyTrend[2]!.count).toBe(1);
    expect(r.monthlyTrend[2]!.totalCents).toBe(5000);
    expect(r.bestPurchases).toHaveLength(1);
    expect(r.worstPurchases).toHaveLength(1);
  });

  it('aggregates monthly totals across multiple months', () => {
    const purchases = [
      p({ priceCents: 1000, purchaseDate: '2026-01-05' }),
      p({ priceCents: 2000, purchaseDate: '2026-01-20' }),
      p({ priceCents: 5000, purchaseDate: '2026-04-01' }),
      p({ priceCents: 9000, purchaseDate: '2026-12-31' }),
    ];
    const r = generateReview({
      year: 2026,
      purchases,
      gifts: [],
      warranties: [],
      wishlistItems: [],
    });
    expect(r.totalCents).toBe(17000);
    expect(r.itemCount).toBe(4);
    expect(r.monthlyTrend[0]!.totalCents).toBe(3000);
    expect(r.monthlyTrend[3]!.totalCents).toBe(5000);
    expect(r.monthlyTrend[11]!.totalCents).toBe(9000);
  });

  it('excludes purchases from other years', () => {
    const purchases = [
      p({ priceCents: 1000, purchaseDate: '2025-12-31' }),
      p({ priceCents: 2000, purchaseDate: '2026-01-01' }),
      p({ priceCents: 3000, purchaseDate: '2027-01-01' }),
    ];
    const r = generateReview({
      year: 2026,
      purchases,
      gifts: [],
      warranties: [],
      wishlistItems: [],
    });
    expect(r.totalCents).toBe(2000);
    expect(r.itemCount).toBe(1);
  });

  it('category breakdown sums to 100 percent and sorts by spend', () => {
    const purchases = [
      p({ category: 'tech', priceCents: 8000, purchaseDate: '2026-02-01' }),
      p({ category: 'kitchen', priceCents: 3000, purchaseDate: '2026-02-02' }),
      p({ category: 'kitchen', priceCents: 2000, purchaseDate: '2026-02-03' }),
    ];
    const r = generateReview({
      year: 2026,
      purchases,
      gifts: [],
      warranties: [],
      wishlistItems: [],
    });
    expect(r.categoryBreakdown[0]!.category).toBe('tech');
    expect(r.categoryBreakdown[0]!.totalCents).toBe(8000);
    expect(r.categoryBreakdown[1]!.category).toBe('kitchen');
    const sumPct = r.categoryBreakdown.reduce((s, c) => s + c.percentage, 0);
    expect(sumPct).toBe(100);
  });

  it('ranks best/worst by latest satisfaction with price tiebreak', () => {
    const a = p({
      id: 'a',
      priceCents: 1000,
      purchaseDate: '2026-01-01',
      satisfaction90day: 5,
    });
    const b = p({
      id: 'b',
      priceCents: 9000,
      purchaseDate: '2026-01-02',
      satisfaction30day: 5,
    });
    const c = p({
      id: 'c',
      priceCents: 200,
      purchaseDate: '2026-01-03',
      satisfactionInitial: 1,
    });
    const r = generateReview({
      year: 2026,
      purchases: [a, b, c],
      gifts: [],
      warranties: [],
      wishlistItems: [],
    });
    // b > a because both rate 5 and b is more expensive
    expect(r.bestPurchases[0]!.id).toBe('b');
    expect(r.bestPurchases[1]!.id).toBe('a');
    expect(r.worstPurchases[0]!.id).toBe('c');
  });

  it('summarises gifts: people, occasion, group share', () => {
    const gifts = [
      g({ personId: 'p1', amountCents: 4000, occasion: 'birthday' }),
      g({ personId: 'p1', amountCents: 1000, occasion: 'birthday' }),
      g({
        personId: 'p2',
        amountCents: 10000,
        myShareCents: 2500,
        isGroupGift: true,
        occasion: 'holiday',
      }),
    ];
    const r = generateReview({
      year: 2026,
      purchases: [],
      gifts,
      warranties: [],
      wishlistItems: [],
    });
    expect(r.giftSummary.peopleCount).toBe(2);
    expect(r.giftSummary.totalSpentCents).toBe(4000 + 1000 + 2500);
    expect(r.giftSummary.mostGenerousOccasion).toBe('birthday');
  });

  it('warranty utilization counts claims and expired-unused', () => {
    const yearMs = Date.UTC(2026, 5, 1);
    const purchase = p({
      id: 'pur-1',
      priceCents: 50000,
      purchaseDate: '2026-01-01',
    });
    const warranties = [
      w({
        purchaseId: 'pur-1',
        claimFiled: true,
        updatedAt: yearMs,
        expiryDate: Date.UTC(2027, 0, 1),
      }),
      w({
        claimFiled: false,
        expiryDate: Date.UTC(2026, 6, 1),
      }),
      w({
        claimFiled: false,
        expiryDate: Date.UTC(2025, 5, 1),
      }),
    ];
    const r = generateReview({
      year: 2026,
      purchases: [purchase],
      gifts: [],
      warranties,
      wishlistItems: [],
    });
    expect(r.warrantyUtilization.claimsFiledCount).toBe(1);
    expect(r.warrantyUtilization.savedCents).toBe(50000);
    expect(r.warrantyUtilization.expiredUnusedCount).toBe(1);
  });

  it('wishlist conversion uses unique purchases that link a wishlist item', () => {
    const wishlistItems = [wl({ id: 'w1' }), wl({ id: 'w2' }), wl({ id: 'w3' })];
    const purchases = [
      p({ wishlistItemId: 'w1', purchaseDate: '2026-02-01' }),
      p({ wishlistItemId: 'w2', purchaseDate: '2026-03-01' }),
      p({ wishlistItemId: 'w2', purchaseDate: '2026-04-01' }),
      p({ wishlistItemId: null, purchaseDate: '2026-05-01' }),
    ];
    const r = generateReview({
      year: 2026,
      purchases,
      gifts: [],
      warranties: [],
      wishlistItems,
    });
    expect(r.wishlistConversion.wishlistedCount).toBe(3);
    expect(r.wishlistConversion.purchasedCount).toBe(2);
    expect(r.wishlistConversion.conversionPercentage).toBe(67);
  });

  it('impulse audit counts regret and regret spend only when satisfaction < 3', () => {
    const purchases = [
      p({
        purchaseDate: '2026-02-01',
        isImpulse: true,
        priceCents: 5000,
        satisfaction90day: 1,
      }),
      p({
        purchaseDate: '2026-02-02',
        isImpulse: true,
        priceCents: 8000,
        satisfaction30day: 4,
      }),
      p({
        purchaseDate: '2026-02-03',
        isImpulse: true,
        priceCents: 2000,
        // no satisfaction recorded yet, should not count as regret
      }),
      p({ purchaseDate: '2026-02-04', isImpulse: false, priceCents: 9999 }),
    ];
    const r = generateReview({
      year: 2026,
      purchases,
      gifts: [],
      warranties: [],
      wishlistItems: [],
    });
    expect(r.impulseAudit.impulseCount).toBe(3);
    expect(r.impulseAudit.regrettedSpendCents).toBe(5000);
    expect(r.impulseAudit.impulseRegretRate).toBeCloseTo(1 / 3, 5);
  });

  it('monthlyTrend length is always 12 in calendar order', () => {
    const r = generateReview({
      year: 2026,
      purchases: [],
      gifts: [],
      warranties: [],
      wishlistItems: [],
    });
    expect(r.monthlyTrend.map((m) => m.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it('handles missing satisfaction across all purchases (no errors)', () => {
    const purchases = [
      p({ purchaseDate: '2026-04-01', priceCents: 1000 }),
      p({ purchaseDate: '2026-04-02', priceCents: 2000 }),
    ];
    const r = generateReview({
      year: 2026,
      purchases,
      gifts: [],
      warranties: [],
      wishlistItems: [],
    });
    expect(r.bestPurchases).toHaveLength(2);
    expect(r.worstPurchases).toHaveLength(2);
  });
});
