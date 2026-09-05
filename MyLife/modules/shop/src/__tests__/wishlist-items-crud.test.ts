import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createWishlist,
  createWishlistItem,
  getWishlistItemById,
  updateWishlistItem,
  deleteWishlistItem,
  listItemsByWishlist,
  listItemsByCategory,
  listItemsByPriority,
  markAsPurchased,
  moveItemToList,
  searchItems,
  type WishlistItem,
} from '../index';

let testDb: InMemoryTestDatabase;
let listId: string;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
  const list = createWishlist(testDb.adapter, { name: 'Main' });
  listId = list.id;
});

afterEach(() => {
  testDb.close();
});

describe('wishlist item CRUD', () => {
  it('creates an item with defaults (priority want)', () => {
    const item = createWishlistItem(testDb.adapter, {
      listId,
      name: 'AirPods Pro',
      category: 'tech',
    });
    expect(item.name).toBe('AirPods Pro');
    expect(item.category).toBe('tech');
    expect(item.priority).toBe('want');
    expect(item.isPurchased).toBe(false);
    expect(item.priceCents).toBeNull();
  });

  it('persists all optional fields', () => {
    const item = createWishlistItem(testDb.adapter, {
      listId,
      name: 'Kindle',
      category: 'books',
      priority: 'need',
      priceCents: 12900,
      priceRangeLow: 10000,
      priceRangeHigh: 15000,
      url: 'https://amazon.com',
      store: 'Amazon',
      brand: 'Amazon',
      notesMd: 'Waterproof model',
      sizeNotes: '6in',
      descriptionMd: 'Paperwhite 11th gen',
      occasionTag: 'birthday',
      isGiftFor: 'person-7',
    });
    expect(item.priority).toBe('need');
    expect(item.priceCents).toBe(12900);
    expect(item.store).toBe('Amazon');
    expect(item.isGiftFor).toBe('person-7');
  });

  it('reads missing item as null', () => {
    expect(getWishlistItemById(testDb.adapter, 'missing')).toBeNull();
  });

  it('updates partial fields', () => {
    const item = createWishlistItem(testDb.adapter, {
      listId,
      name: 'Original',
      category: 'home',
    });
    const updated = updateWishlistItem(testDb.adapter, item.id, {
      name: 'New name',
      priority: 'dream',
      priceCents: 5000,
    });
    expect(updated?.name).toBe('New name');
    expect(updated?.priority).toBe('dream');
    expect(updated?.priceCents).toBe(5000);
    expect(updated?.category).toBe('home');
  });

  it('returns null updating missing item', () => {
    expect(updateWishlistItem(testDb.adapter, 'missing', { name: 'x' })).toBeNull();
  });

  it('deletes an item', () => {
    const item = createWishlistItem(testDb.adapter, {
      listId,
      name: 'Doomed',
      category: 'other',
    });
    expect(deleteWishlistItem(testDb.adapter, item.id)).toBe(true);
    expect(getWishlistItemById(testDb.adapter, item.id)).toBeNull();
    expect(deleteWishlistItem(testDb.adapter, item.id)).toBe(false);
  });
});

describe('listing + filtering', () => {
  function seed(): WishlistItem[] {
    const items: WishlistItem[] = [];
    items.push(createWishlistItem(testDb.adapter, {
      listId, name: 'Monitor', category: 'tech', priority: 'need',
    }));
    items.push(createWishlistItem(testDb.adapter, {
      listId, name: 'Desk', category: 'home', priority: 'want',
    }));
    items.push(createWishlistItem(testDb.adapter, {
      listId, name: 'Chair', category: 'home', priority: 'someday',
    }));
    items.push(createWishlistItem(testDb.adapter, {
      listId, name: 'Rug', category: 'home', priority: 'dream',
    }));
    return items;
  }

  it('lists items by wishlist ordered by priority (need first)', () => {
    seed();
    const items = listItemsByWishlist(testDb.adapter, listId);
    expect(items.map((i) => i.name)).toEqual(['Monitor', 'Desk', 'Chair', 'Rug']);
  });

  it('filters by category', () => {
    seed();
    const homeItems = listItemsByWishlist(testDb.adapter, listId, { category: 'home' });
    expect(homeItems).toHaveLength(3);
    expect(homeItems.every((i) => i.category === 'home')).toBe(true);
  });

  it('filters by priority', () => {
    seed();
    const wants = listItemsByWishlist(testDb.adapter, listId, { priority: 'want' });
    expect(wants).toHaveLength(1);
    expect(wants[0]!.name).toBe('Desk');
  });

  it('filters by isPurchased', () => {
    const items = seed();
    markAsPurchased(testDb.adapter, items[0]!.id, { purchasedAt: '2026-04-21T00:00:00Z' });
    expect(listItemsByWishlist(testDb.adapter, listId, { isPurchased: false })).toHaveLength(3);
    expect(listItemsByWishlist(testDb.adapter, listId, { isPurchased: true })).toHaveLength(1);
  });

  it('lists globally by category across lists', () => {
    const list2 = createWishlist(testDb.adapter, { name: 'Other' });
    createWishlistItem(testDb.adapter, { listId, name: 'A', category: 'tech' });
    createWishlistItem(testDb.adapter, { listId: list2.id, name: 'B', category: 'tech' });
    createWishlistItem(testDb.adapter, { listId, name: 'C', category: 'music' });
    expect(listItemsByCategory(testDb.adapter, 'tech')).toHaveLength(2);
    expect(listItemsByCategory(testDb.adapter, 'music')).toHaveLength(1);
  });

  it('lists globally by priority across lists', () => {
    createWishlistItem(testDb.adapter, { listId, name: 'A', category: 'tech', priority: 'need' });
    createWishlistItem(testDb.adapter, { listId, name: 'B', category: 'tech', priority: 'want' });
    createWishlistItem(testDb.adapter, { listId, name: 'C', category: 'tech', priority: 'need' });
    expect(listItemsByPriority(testDb.adapter, 'need')).toHaveLength(2);
  });
});

describe('markAsPurchased', () => {
  it('sets is_purchased, purchased_at, and optional purchase_id', () => {
    const item = createWishlistItem(testDb.adapter, {
      listId, name: 'Book', category: 'books',
    });
    const updated = markAsPurchased(testDb.adapter, item.id, {
      purchasedAt: '2026-04-21T00:00:00Z',
      purchaseId: 'purchase-1',
    });
    expect(updated?.isPurchased).toBe(true);
    expect(updated?.purchasedAt).toBe('2026-04-21T00:00:00Z');
    expect(updated?.purchaseId).toBe('purchase-1');
  });

  it('returns null for missing item', () => {
    expect(
      markAsPurchased(testDb.adapter, 'missing', { purchasedAt: '2026-04-21' }),
    ).toBeNull();
  });
});

describe('moveItemToList', () => {
  it('re-parents item to new list', () => {
    const item = createWishlistItem(testDb.adapter, {
      listId, name: 'Gadget', category: 'tech',
    });
    const newList = createWishlist(testDb.adapter, { name: 'Other' });
    const moved = moveItemToList(testDb.adapter, item.id, newList.id);
    expect(moved?.listId).toBe(newList.id);
    expect(listItemsByWishlist(testDb.adapter, listId)).toHaveLength(0);
    expect(listItemsByWishlist(testDb.adapter, newList.id)).toHaveLength(1);
  });

  it('returns null for missing item', () => {
    expect(moveItemToList(testDb.adapter, 'missing', listId)).toBeNull();
  });
});

describe('searchItems', () => {
  it('matches by name (case-insensitive)', () => {
    createWishlistItem(testDb.adapter, { listId, name: 'Apple Watch', category: 'tech' });
    createWishlistItem(testDb.adapter, { listId, name: 'Banana stand', category: 'home' });
    expect(searchItems(testDb.adapter, 'APPLE')).toHaveLength(1);
    expect(searchItems(testDb.adapter, 'stand')).toHaveLength(1);
  });

  it('matches inside notes_md', () => {
    createWishlistItem(testDb.adapter, {
      listId, name: 'Headphones', category: 'tech',
      notesMd: 'Great for commuting on the train',
    });
    expect(searchItems(testDb.adapter, 'commuting')).toHaveLength(1);
  });

  it('returns empty for blank query', () => {
    createWishlistItem(testDb.adapter, { listId, name: 'Thing', category: 'other' });
    expect(searchItems(testDb.adapter, '   ')).toEqual([]);
  });
});
