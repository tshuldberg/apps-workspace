import { describe, expect, it } from 'vitest';
import {
  mapShopCategoryToBudgetCategory,
  buildBudgetTransactionSuggestion,
  summarizeMonthlyShopSpendingForBudget,
} from '../integrations/budget-link';
import type { Purchase, Category } from '../models/schemas';

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

describe('mapShopCategoryToBudgetCategory', () => {
  it('maps every known shop category deterministically', () => {
    const expected: Record<Category, string> = {
      tech: 'Electronics',
      clothing: 'Clothing',
      books: 'Books',
      home: 'Home',
      kitchen: 'Home',
      gaming: 'Gaming',
      music: 'Music',
      sports: 'Sports',
      gifts: 'Gifts',
      hobby: 'Hobby',
      other: 'Shopping',
    };

    for (const [shop, budget] of Object.entries(expected)) {
      expect(mapShopCategoryToBudgetCategory(shop)).toBe(budget);
    }
  });

  it('falls back to "Shopping" for unknown categories', () => {
    expect(mapShopCategoryToBudgetCategory('unknown-cat')).toBe('Shopping');
    expect(mapShopCategoryToBudgetCategory('')).toBe('Shopping');
  });
});

describe('buildBudgetTransactionSuggestion', () => {
  it('produces a suggestion shape carrying category, amount, descriptor, date, and source', () => {
    const p = purchase({
      id: 'p1',
      name: 'Headphones',
      store: 'AcmeMart',
      category: 'tech',
      priceCents: 12999,
      purchaseDate: '2026-04-20',
    });

    expect(buildBudgetTransactionSuggestion(p)).toEqual({
      categoryName: 'Electronics',
      amountCents: 12999,
      descriptor: 'Headphones (AcmeMart)',
      occurredAt: '2026-04-20',
      sourceModule: 'shop',
      sourcePurchaseId: 'p1',
    });
  });

  it('omits the parenthetical store when not provided', () => {
    const p = purchase({ id: 'p2', name: 'Mug', store: null, category: 'kitchen' });
    const sug = buildBudgetTransactionSuggestion(p);
    expect(sug.descriptor).toBe('Mug');
    expect(sug.categoryName).toBe('Home');
  });
});

describe('summarizeMonthlyShopSpendingForBudget', () => {
  it('returns zeros for empty input', () => {
    expect(summarizeMonthlyShopSpendingForBudget([], 2026, 4)).toEqual({
      totalCents: 0,
      byCategory: {},
    });
  });

  it('aggregates by mapped budget category for the given month only', () => {
    const purchases: Purchase[] = [
      purchase({ category: 'tech', priceCents: 1000, purchaseDate: '2026-04-01' }),
      purchase({ category: 'tech', priceCents: 2500, purchaseDate: '2026-04-30' }),
      purchase({ category: 'home', priceCents: 800, purchaseDate: '2026-04-10' }),
      purchase({ category: 'kitchen', priceCents: 300, purchaseDate: '2026-04-12' }),
      // Out-of-range: different month + different year
      purchase({ category: 'tech', priceCents: 9999, purchaseDate: '2026-03-31' }),
      purchase({ category: 'tech', priceCents: 9999, purchaseDate: '2025-04-15' }),
    ];

    const result = summarizeMonthlyShopSpendingForBudget(purchases, 2026, 4);
    expect(result.totalCents).toBe(1000 + 2500 + 800 + 300);
    expect(result.byCategory).toEqual({
      Electronics: 3500,
      Home: 1100,
    });
  });

  it('skips returned purchases from the totals', () => {
    const purchases: Purchase[] = [
      purchase({ category: 'tech', priceCents: 1000, purchaseDate: '2026-04-01' }),
      purchase({
        category: 'tech',
        priceCents: 5000,
        purchaseDate: '2026-04-02',
        returned: true,
      }),
    ];

    const result = summarizeMonthlyShopSpendingForBudget(purchases, 2026, 4);
    expect(result.totalCents).toBe(1000);
    expect(result.byCategory).toEqual({ Electronics: 1000 });
  });

  it('handles single-digit month input by zero-padding', () => {
    const purchases: Purchase[] = [
      purchase({ category: 'tech', priceCents: 100, purchaseDate: '2026-01-15' }),
      purchase({ category: 'tech', priceCents: 100, purchaseDate: '2026-11-15' }),
    ];
    const jan = summarizeMonthlyShopSpendingForBudget(purchases, 2026, 1);
    expect(jan.totalCents).toBe(100);
  });
});
