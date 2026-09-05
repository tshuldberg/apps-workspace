import { describe, expect, it } from 'vitest';
import {
  isMusicPurchase,
  buildMusicCollectionSuggestion,
  getMusicWishlistItems,
} from '../integrations/music-link';
import type { Purchase, WishlistItem } from '../models/schemas';

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: overrides.id ?? 'p',
    name: 'Album',
    category: 'music',
    priceCents: 1499,
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
    name: 'Vinyl',
    category: 'music',
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

describe('isMusicPurchase', () => {
  it('returns true only for the music category', () => {
    expect(isMusicPurchase(purchase({ category: 'music' }))).toBe(true);
    expect(isMusicPurchase(purchase({ category: 'tech' }))).toBe(false);
  });
});

describe('buildMusicCollectionSuggestion', () => {
  it('produces the future-compatible music collection suggestion shape', () => {
    const p = purchase({ id: 'p1', name: 'Kind of Blue', priceCents: 2499, purchaseDate: '2026-04-10' });
    expect(buildMusicCollectionSuggestion(p)).toEqual({
      itemName: 'Kind of Blue',
      purchaseDate: '2026-04-10',
      priceCents: 2499,
      sourceModule: 'shop',
      sourcePurchaseId: 'p1',
    });
  });
});

describe('getMusicWishlistItems', () => {
  it('returns [] for empty input', () => {
    expect(getMusicWishlistItems([])).toEqual([]);
  });

  it('keeps only music-category wishlist items', () => {
    const items: WishlistItem[] = [
      wishlistItem({ id: 'a', category: 'music' }),
      wishlistItem({ id: 'b', category: 'tech' }),
      wishlistItem({ id: 'c', category: 'music' }),
    ];
    expect(getMusicWishlistItems(items).map((i) => i.id).sort()).toEqual(['a', 'c']);
  });
});
