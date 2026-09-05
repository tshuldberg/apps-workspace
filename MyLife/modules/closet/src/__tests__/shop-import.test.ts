import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { CLOSET_MODULE } from '../definition';
import {
  importFromPurchase,
  getPendingShopImports,
  getSharedSizesFromShop,
  type ClosetItemSuggestion,
} from '../integrations/shop-import';
import { createClothingItem, listClothingItems } from '../db';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('closet', CLOSET_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function suggestion(overrides: Partial<ClosetItemSuggestion> = {}): ClosetItemSuggestion {
  return {
    name: 'Navy Blazer',
    brand: 'Brooks',
    purchaseDate: '2026-04-10',
    priceCents: 12999,
    sourceModule: 'shop',
    sourcePurchaseId: 'p1',
    ...overrides,
  };
}

describe('importFromPurchase', () => {
  it('inserts a closet item with shop provenance encoded into notes', () => {
    const item = importFromPurchase(testDb.adapter, suggestion({ sourcePurchaseId: 'p1' }));
    expect(item.id).toBe('cl_shop_p1');
    expect(item.name).toBe('Navy Blazer');
    expect(item.brand).toBe('Brooks');
    expect(item.purchasePriceCents).toBe(12999);
    expect(item.purchaseDate).toBe('2026-04-10');
    expect(item.notes).toBe('[shop:p1]');
  });

  it('persists the imported item so it shows up in listClothingItems', () => {
    importFromPurchase(testDb.adapter, suggestion({ sourcePurchaseId: 'p2' }));
    const all = listClothingItems(testDb.adapter, {});
    expect(all.find((i) => i.id === 'cl_shop_p2')).toBeTruthy();
  });
});

describe('getPendingShopImports', () => {
  it('returns [] for empty input', () => {
    expect(getPendingShopImports([], [])).toEqual([]);
  });

  it('returns all suggestions when no items exist', () => {
    const sugs = [suggestion({ sourcePurchaseId: 'p1' }), suggestion({ sourcePurchaseId: 'p2' })];
    expect(getPendingShopImports(sugs, []).length).toBe(2);
  });

  it('skips suggestions whose source purchase id appears in an existing item notes', () => {
    importFromPurchase(testDb.adapter, suggestion({ sourcePurchaseId: 'p1' }));
    const existing = listClothingItems(testDb.adapter, {});
    const sugs = [
      suggestion({ sourcePurchaseId: 'p1' }),
      suggestion({ sourcePurchaseId: 'p2' }),
    ];
    const pending = getPendingShopImports(sugs, existing);
    expect(pending.map((s) => s.sourcePurchaseId)).toEqual(['p2']);
  });

  it('ignores items whose notes do not contain the shop marker', () => {
    createClothingItem(testDb.adapter, 'manual-1', {
      name: 'Manually added',
      category: 'tops',
      notes: 'just a memo',
    });
    const existing = listClothingItems(testDb.adapter, {});
    const sugs = [suggestion({ sourcePurchaseId: 'p1' })];
    expect(getPendingShopImports(sugs, existing)).toEqual(sugs);
  });
});

describe('getSharedSizesFromShop', () => {
  it('returns [] for empty input', () => {
    expect(getSharedSizesFromShop([])).toEqual([]);
  });

  it('keeps only clothing and shoe sizes', () => {
    const sizes = [
      { id: 'a', type: 'clothing' },
      { id: 'b', type: 'shoe' },
      { id: 'c', type: 'ring' },
    ];
    expect(getSharedSizesFromShop(sizes).map((s) => s.id).sort()).toEqual(['a', 'b']);
  });
});
