import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createComparison,
  getComparisonById,
  updateComparison,
  deleteComparison,
  listComparisons,
  listComparisonsByCategory,
  listRecentComparisons,
  linkComparisonToPurchase,
  searchComparisonsByCategory,
  createPurchase,
} from '../index';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('comparisons CRUD', () => {
  it('creates a comparison and round-trips items_json', () => {
    const c = createComparison(testDb.adapter, {
      category: 'headphones',
      title: 'WH-1000XM5 vs QC45',
      items: [
        {
          name: 'Sony WH-1000XM5',
          pros: ['Best ANC', 'Light'],
          cons: ['Pricey'],
          priceCents: 39900,
          rating: 5,
          url: 'https://example.com/sony',
        },
        {
          name: 'Bose QC45',
          pros: ['Comfy'],
          cons: ['Older drivers'],
          priceCents: 32900,
          rating: 4,
        },
      ],
    });
    expect(c.id).toBeDefined();
    expect(c.items).toHaveLength(2);
    expect(c.items[0]!.pros).toEqual(['Best ANC', 'Light']);
    expect(c.items[1]!.priceCents).toBe(32900);
    expect(c.winner).toBeNull();
    expect(c.purchaseId).toBeNull();

    const fetched = getComparisonById(testDb.adapter, c.id);
    expect(fetched?.title).toBe('WH-1000XM5 vs QC45');
    expect(fetched?.items[0]!.url).toBe('https://example.com/sony');
  });

  it('returns null for missing id', () => {
    expect(getComparisonById(testDb.adapter, 'nope')).toBeNull();
  });

  it('updates items, winner, and reasoning', () => {
    const c = createComparison(testDb.adapter, {
      category: 'monitors',
      title: 'M1 vs M2',
      items: [
        { name: 'A', pros: [], cons: [] },
        { name: 'B', pros: [], cons: [] },
      ],
    });
    const updated = updateComparison(testDb.adapter, c.id, {
      winner: 'A',
      reasoningMd: 'Cheaper, same panel.',
      items: [
        { name: 'A', pros: ['cheaper'], cons: [] },
        { name: 'B', pros: [], cons: ['expensive'] },
      ],
    });
    expect(updated?.winner).toBe('A');
    expect(updated?.reasoningMd).toBe('Cheaper, same panel.');
    expect(updated?.items[0]!.pros).toEqual(['cheaper']);
  });

  it('updateComparison returns null for missing id', () => {
    expect(
      updateComparison(testDb.adapter, 'missing', { winner: 'X' }),
    ).toBeNull();
  });

  it('deletes a comparison', () => {
    const c = createComparison(testDb.adapter, {
      category: 'tech',
      title: 'X',
      items: [{ name: 'A', pros: [], cons: [] }],
    });
    expect(deleteComparison(testDb.adapter, c.id)).toBe(true);
    expect(getComparisonById(testDb.adapter, c.id)).toBeNull();
    expect(deleteComparison(testDb.adapter, c.id)).toBe(false);
  });

  it('listComparisons returns all rows', () => {
    const a = createComparison(testDb.adapter, {
      category: 'tech',
      title: 'A',
      items: [{ name: 'x', pros: [], cons: [] }],
    });
    const b = createComparison(testDb.adapter, {
      category: 'tech',
      title: 'B',
      items: [{ name: 'x', pros: [], cons: [] }],
    });
    const all = listComparisons(testDb.adapter);
    expect(all).toHaveLength(2);
    const ids = all.map((c) => c.id).sort();
    expect(ids).toEqual([a.id, b.id].sort());
  });

  it('listComparisonsByCategory filters', () => {
    createComparison(testDb.adapter, {
      category: 'tech',
      title: 'A',
      items: [{ name: 'x', pros: [], cons: [] }],
    });
    createComparison(testDb.adapter, {
      category: 'kitchen',
      title: 'B',
      items: [{ name: 'x', pros: [], cons: [] }],
    });
    expect(listComparisonsByCategory(testDb.adapter, 'tech')).toHaveLength(1);
    expect(listComparisonsByCategory(testDb.adapter, 'kitchen')).toHaveLength(1);
    expect(listComparisonsByCategory(testDb.adapter, 'absent')).toHaveLength(0);
  });

  it('listRecentComparisons caps results', () => {
    for (let i = 0; i < 5; i += 1) {
      createComparison(testDb.adapter, {
        category: 'tech',
        title: `T${i}`,
        items: [{ name: 'x', pros: [], cons: [] }],
      });
    }
    expect(listRecentComparisons(testDb.adapter, 3)).toHaveLength(3);
  });

  it('linkComparisonToPurchase sets purchase_id and decided_at', () => {
    const purchase = createPurchase(testDb.adapter, {
      name: 'Sony WH-1000XM5',
      category: 'tech',
      priceCents: 39900,
      purchaseDate: '2026-04-15',
    });
    const c = createComparison(testDb.adapter, {
      category: 'headphones',
      title: 'XM5 vs QC45',
      items: [
        { name: 'Sony', pros: [], cons: [] },
        { name: 'Bose', pros: [], cons: [] },
      ],
    });
    const linked = linkComparisonToPurchase(testDb.adapter, c.id, purchase.id);
    expect(linked?.purchaseId).toBe(purchase.id);
    expect(linked?.decidedAt).not.toBeNull();
  });

  it('linkComparisonToPurchase returns null for missing id', () => {
    expect(
      linkComparisonToPurchase(testDb.adapter, 'missing', 'whatever'),
    ).toBeNull();
  });

  it('searchComparisonsByCategory does case-insensitive LIKE match', () => {
    createComparison(testDb.adapter, {
      category: 'home-office',
      title: 'Desk',
      items: [{ name: 'x', pros: [], cons: [] }],
    });
    createComparison(testDb.adapter, {
      category: 'kitchen',
      title: 'Knife',
      items: [{ name: 'x', pros: [], cons: [] }],
    });
    expect(searchComparisonsByCategory(testDb.adapter, 'office')).toHaveLength(1);
    expect(searchComparisonsByCategory(testDb.adapter, 'KITCH')).toHaveLength(1);
    expect(searchComparisonsByCategory(testDb.adapter, '')).toHaveLength(0);
  });

  it('rejects empty items array', () => {
    expect(() =>
      createComparison(testDb.adapter, {
        category: 'tech',
        title: 'Empty',
        items: [],
      }),
    ).toThrow();
  });
});
