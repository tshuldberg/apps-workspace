import { describe, expect, it } from 'vitest';
import {
  getGiftHistoryForPerson,
  getGiftIdeasForPerson,
  getSizeMemoryForPerson,
  surfaceInFriendProfile,
} from '../integrations/friends-link';
import type { Gift, Size, WishlistItem } from '../models/schemas';

function wishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    listId: 'list1',
    name: 'Item',
    category: 'gifts',
    descriptionMd: null,
    priceCents: 1000,
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

function gift(overrides: Partial<Gift> = {}): Gift {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    personId: 'person_a',
    personName: 'Alice',
    itemDescription: 'A gift',
    occasion: 'birthday',
    occasionLabel: null,
    purchaseId: null,
    amountCents: 5000,
    giftDate: 1700000000,
    reactionNotes: null,
    photoId: null,
    isGroupGift: false,
    groupTotalCents: null,
    myShareCents: null,
    createdAt: 1700000000,
    updatedAt: 1700000000,
    ...overrides,
  };
}

describe('getGiftIdeasForPerson', () => {
  it('returns [] for empty inputs', () => {
    expect(getGiftIdeasForPerson([], 'p1')).toEqual([]);
    expect(getGiftIdeasForPerson([wishlistItem()], '')).toEqual([]);
  });

  it('filters wishlist items by giftForPersonId and sorts createdAt DESC', () => {
    const items = [
      wishlistItem({ id: 'a', giftForPersonId: 'p1', createdAt: '2026-04-01T00:00:00Z' }),
      wishlistItem({ id: 'b', giftForPersonId: 'p2', createdAt: '2026-04-02T00:00:00Z' }),
      wishlistItem({ id: 'c', giftForPersonId: 'p1', createdAt: '2026-04-05T00:00:00Z' }),
      wishlistItem({ id: 'd', giftForPersonId: null, createdAt: '2026-04-06T00:00:00Z' }),
    ];

    const result = getGiftIdeasForPerson(items, 'p1');
    expect(result.map((i) => i.id)).toEqual(['c', 'a']);
  });
});

describe('getGiftHistoryForPerson', () => {
  it('returns [] for empty inputs', () => {
    expect(getGiftHistoryForPerson([], 'person_a')).toEqual([]);
    expect(getGiftHistoryForPerson([gift()], '')).toEqual([]);
  });

  it('filters by personId and sorts giftDate DESC', () => {
    const gifts = [
      gift({ id: 'g1', personId: 'person_a', giftDate: 1000 }),
      gift({ id: 'g2', personId: 'person_b', giftDate: 9999 }),
      gift({ id: 'g3', personId: 'person_a', giftDate: 5000 }),
    ];
    const result = getGiftHistoryForPerson(gifts, 'person_a');
    expect(result.map((g) => g.id)).toEqual(['g3', 'g1']);
  });
});

describe('getSizeMemoryForPerson', () => {
  it('returns [] today (sh_sizes has no person_id column until v9)', () => {
    const sizes: Size[] = [
      {
        id: 's1',
        type: 'clothing',
        brand: 'Acme',
        sizeValue: 'M',
        fitNotes: null,
        lastVerified: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    expect(getSizeMemoryForPerson(sizes, 'person_a')).toEqual([]);
    expect(getSizeMemoryForPerson([], 'person_a')).toEqual([]);
  });
});

describe('surfaceInFriendProfile', () => {
  it('returns a zeroed rollup for empty inputs', () => {
    expect(
      surfaceInFriendProfile({
        wishlistItems: [],
        gifts: [],
        sizes: [],
        personId: 'p1',
      }),
    ).toEqual({
      ideasCount: 0,
      ideas: [],
      pastGiftsCount: 0,
      totalSpentOnPersonCents: 0,
      knownSizes: [],
    });
  });

  it('rolls up ideas, gift history, and group-gift share spending', () => {
    const items = [
      wishlistItem({ id: 'a', giftForPersonId: 'p1', createdAt: '2026-04-01T00:00:00Z' }),
      wishlistItem({ id: 'b', giftForPersonId: 'p1', createdAt: '2026-04-05T00:00:00Z' }),
      wishlistItem({ id: 'c', giftForPersonId: 'p2', createdAt: '2026-04-06T00:00:00Z' }),
    ];
    const gifts = [
      gift({ id: 'g1', personId: 'p1', amountCents: 2000, giftDate: 100 }),
      gift({
        id: 'g2',
        personId: 'p1',
        amountCents: 10000,
        isGroupGift: true,
        groupTotalCents: 10000,
        myShareCents: 3000,
        giftDate: 200,
      }),
      gift({ id: 'g3', personId: 'p2', amountCents: 7777, giftDate: 300 }),
    ];

    const result = surfaceInFriendProfile({
      wishlistItems: items,
      gifts,
      sizes: [],
      personId: 'p1',
    });

    expect(result.ideasCount).toBe(2);
    expect(result.ideas.map((i) => i.id)).toEqual(['b', 'a']);
    expect(result.pastGiftsCount).toBe(2);
    expect(result.totalSpentOnPersonCents).toBe(2000 + 3000);
    expect(result.knownSizes).toEqual([]);
  });
});
