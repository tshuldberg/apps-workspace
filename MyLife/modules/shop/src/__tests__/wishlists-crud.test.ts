import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createWishlist,
  getWishlistById,
  listWishlists,
  updateWishlist,
  deleteWishlist,
  generateShareToken,
  getWishlistByShareToken,
  createWishlistItem,
  listItemsByWishlist,
  getWishlistItemById,
} from '../index';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('wishlist CRUD', () => {
  it('creates and reads back a wishlist with defaults', () => {
    const list = createWishlist(testDb.adapter, { name: 'Birthday 2026' });
    expect(list.name).toBe('Birthday 2026');
    expect(list.description).toBeNull();
    expect(list.occasion).toBeNull();
    expect(list.isShareable).toBe(false);
    expect(list.shareToken).toBeNull();

    const found = getWishlistById(testDb.adapter, list.id);
    expect(found?.id).toBe(list.id);
  });

  it('creates with full fields', () => {
    const list = createWishlist(testDb.adapter, {
      name: 'Holiday gifts',
      description: 'Ideas for family',
      occasion: 'holiday',
      personId: 'person-42',
      isShareable: true,
    });
    expect(list.description).toBe('Ideas for family');
    expect(list.occasion).toBe('holiday');
    expect(list.personId).toBe('person-42');
    expect(list.isShareable).toBe(true);
  });

  it('returns null for missing id', () => {
    expect(getWishlistById(testDb.adapter, 'missing')).toBeNull();
  });

  it('lists wishlists ordered by created_at DESC', async () => {
    const a = createWishlist(testDb.adapter, { name: 'First' });
    await new Promise((r) => setTimeout(r, 10));
    const b = createWishlist(testDb.adapter, { name: 'Second' });

    const lists = listWishlists(testDb.adapter);
    expect(lists).toHaveLength(2);
    expect(lists[0]!.id).toBe(b.id);
    expect(lists[1]!.id).toBe(a.id);
  });

  it('filters lists by occasion / personId / isShareable', () => {
    createWishlist(testDb.adapter, { name: 'Birthday', occasion: 'birthday' });
    createWishlist(testDb.adapter, { name: 'Holiday', occasion: 'holiday' });
    createWishlist(testDb.adapter, {
      name: 'Gift for Pat',
      occasion: 'birthday',
      personId: 'pat',
    });
    createWishlist(testDb.adapter, { name: 'Shared', isShareable: true });

    expect(listWishlists(testDb.adapter, { occasion: 'birthday' })).toHaveLength(2);
    expect(listWishlists(testDb.adapter, { personId: 'pat' })).toHaveLength(1);
    expect(listWishlists(testDb.adapter, { isShareable: true })).toHaveLength(1);
  });

  it('updates a wishlist partially', () => {
    const list = createWishlist(testDb.adapter, { name: 'Old' });
    const updated = updateWishlist(testDb.adapter, list.id, { name: 'New', occasion: 'graduation' });
    expect(updated?.name).toBe('New');
    expect(updated?.occasion).toBe('graduation');
  });

  it('update returns null when id missing', () => {
    expect(updateWishlist(testDb.adapter, 'nope', { name: 'x' })).toBeNull();
  });

  it('deletes a wishlist and cascades items', () => {
    const list = createWishlist(testDb.adapter, { name: 'Doomed' });
    createWishlistItem(testDb.adapter, {
      listId: list.id,
      name: 'Thing',
      category: 'tech',
    });
    createWishlistItem(testDb.adapter, {
      listId: list.id,
      name: 'Another',
      category: 'books',
    });
    expect(listItemsByWishlist(testDb.adapter, list.id)).toHaveLength(2);

    const ok = deleteWishlist(testDb.adapter, list.id);
    expect(ok).toBe(true);
    expect(getWishlistById(testDb.adapter, list.id)).toBeNull();
    expect(listItemsByWishlist(testDb.adapter, list.id)).toHaveLength(0);
  });

  it('delete returns false for missing id', () => {
    expect(deleteWishlist(testDb.adapter, 'missing')).toBe(false);
  });
});

describe('share tokens', () => {
  it('generates and resolves an opaque token', () => {
    const list = createWishlist(testDb.adapter, { name: 'Shared' });
    expect(list.shareToken).toBeNull();

    const withToken = generateShareToken(testDb.adapter, list.id);
    expect(withToken).not.toBeNull();
    expect(withToken!.shareToken).toBeTruthy();
    expect(withToken!.isShareable).toBe(true);

    const resolved = getWishlistByShareToken(testDb.adapter, withToken!.shareToken!);
    expect(resolved?.id).toBe(list.id);
  });

  it('tokens differ across lists', () => {
    const a = createWishlist(testDb.adapter, { name: 'A' });
    const b = createWishlist(testDb.adapter, { name: 'B' });
    const ta = generateShareToken(testDb.adapter, a.id)!.shareToken!;
    const tb = generateShareToken(testDb.adapter, b.id)!.shareToken!;
    expect(ta).not.toBe(tb);
  });

  it('returns null resolving unknown token', () => {
    expect(getWishlistByShareToken(testDb.adapter, 'bogus')).toBeNull();
  });

  it('generateShareToken returns null for missing list', () => {
    expect(generateShareToken(testDb.adapter, 'nope')).toBeNull();
  });
});

describe('cascade integrity', () => {
  it('item fk integrity: items removed when parent list deleted', () => {
    const list = createWishlist(testDb.adapter, { name: 'Parent' });
    const item = createWishlistItem(testDb.adapter, {
      listId: list.id,
      name: 'Child',
      category: 'home',
    });
    deleteWishlist(testDb.adapter, list.id);
    expect(getWishlistItemById(testDb.adapter, item.id)).toBeNull();
  });
});
