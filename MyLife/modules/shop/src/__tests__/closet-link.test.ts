import { describe, expect, it } from 'vitest';
import {
  isClothingPurchase,
  buildClosetItemSuggestionFromPurchase,
  getSharedClothingSizes,
  getClosetSuggestionsFromPurchases,
} from '../integrations/closet-link';
import type { Purchase, Size } from '../models/schemas';

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    name: 'Item',
    category: 'clothing',
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

function size(overrides: Partial<Size> = {}): Size {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    type: 'clothing',
    brand: 'Acme',
    sizeValue: 'M',
    fitNotes: null,
    lastVerified: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('isClothingPurchase', () => {
  it('returns true only for the clothing category', () => {
    expect(isClothingPurchase(purchase({ category: 'clothing' }))).toBe(true);
    expect(isClothingPurchase(purchase({ category: 'tech' }))).toBe(false);
    expect(isClothingPurchase(purchase({ category: 'gifts' }))).toBe(false);
  });
});

describe('buildClosetItemSuggestionFromPurchase', () => {
  it('produces a suggestion shape carrying name, brand, date, price, source', () => {
    const p = purchase({
      id: 'p1',
      name: 'Navy Blazer',
      brand: 'Brooks',
      priceCents: 12999,
      purchaseDate: '2026-04-10',
    });
    expect(buildClosetItemSuggestionFromPurchase(p)).toEqual({
      name: 'Navy Blazer',
      brand: 'Brooks',
      purchaseDate: '2026-04-10',
      priceCents: 12999,
      sourceModule: 'shop',
      sourcePurchaseId: 'p1',
    });
  });

  it('omits brand when null', () => {
    const p = purchase({ id: 'p2', name: 'Tee', brand: null });
    const s = buildClosetItemSuggestionFromPurchase(p);
    expect(s.brand).toBeUndefined();
    expect(s.name).toBe('Tee');
    expect(s.sourcePurchaseId).toBe('p2');
  });
});

describe('getSharedClothingSizes', () => {
  it('returns [] for empty input', () => {
    expect(getSharedClothingSizes([])).toEqual([]);
  });

  it('keeps only clothing and shoe sizes', () => {
    const sizes: Size[] = [
      size({ id: 'a', type: 'clothing' }),
      size({ id: 'b', type: 'shoe' }),
      size({ id: 'c', type: 'ring' }),
      size({ id: 'd', type: 'other' }),
    ];
    const filtered = getSharedClothingSizes(sizes);
    expect(filtered.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });
});

describe('getClosetSuggestionsFromPurchases', () => {
  it('returns [] for empty input', () => {
    expect(getClosetSuggestionsFromPurchases([])).toEqual([]);
  });

  it('filters non-clothing and returned purchases, maps the rest', () => {
    const purchases: Purchase[] = [
      purchase({ id: 'p1', category: 'clothing', name: 'Jeans' }),
      purchase({ id: 'p2', category: 'tech', name: 'Phone' }),
      purchase({ id: 'p3', category: 'clothing', name: 'Returned shirt', returned: true }),
      purchase({ id: 'p4', category: 'clothing', name: 'Hat' }),
    ];
    const result = getClosetSuggestionsFromPurchases(purchases);
    expect(result.map((s) => s.sourcePurchaseId).sort()).toEqual(['p1', 'p4']);
    expect(result.every((s) => s.sourceModule === 'shop')).toBe(true);
  });
});
