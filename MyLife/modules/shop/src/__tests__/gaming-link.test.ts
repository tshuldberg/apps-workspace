import { describe, expect, it } from 'vitest';
import {
  isGamingPurchase,
  buildGameLibrarySuggestion,
  getGameWishlistItems,
} from '../integrations/gaming-link';
import type { Purchase, WishlistItem } from '../models/schemas';

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: overrides.id ?? 'p',
    name: 'Game',
    category: 'gaming',
    priceCents: 5999,
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

function wishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: overrides.id ?? 'w',
    listId: 'list1',
    name: 'Item',
    category: 'gaming',
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
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('isGamingPurchase', () => {
  it('returns true only for the gaming category', () => {
    expect(isGamingPurchase(purchase({ category: 'gaming' }))).toBe(true);
    expect(isGamingPurchase(purchase({ category: 'tech' }))).toBe(false);
  });
});

describe('buildGameLibrarySuggestion', () => {
  it('produces the future-compatible game-library suggestion shape', () => {
    const p = purchase({ id: 'p1', name: 'Awesome Game', priceCents: 5999, purchaseDate: '2026-04-10' });
    expect(buildGameLibrarySuggestion(p)).toEqual({
      gameTitle: 'Awesome Game',
      purchaseDate: '2026-04-10',
      priceCents: 5999,
      sourceModule: 'shop',
      sourcePurchaseId: 'p1',
    });
  });
});

describe('getGameWishlistItems', () => {
  it('returns [] for empty input', () => {
    expect(getGameWishlistItems([])).toEqual([]);
  });

  it('keeps only gaming-category wishlist items', () => {
    const items: WishlistItem[] = [
      wishlistItem({ id: 'a', category: 'gaming' }),
      wishlistItem({ id: 'b', category: 'tech' }),
      wishlistItem({ id: 'c', category: 'gaming' }),
    ];
    expect(getGameWishlistItems(items).map((i) => i.id).sort()).toEqual(['a', 'c']);
  });
});
