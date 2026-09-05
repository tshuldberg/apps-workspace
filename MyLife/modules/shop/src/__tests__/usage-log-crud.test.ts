import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createPurchase,
  logUse,
  getUsageCount,
  getUsageHistory,
  deleteUsageEntry,
  deletePurchase,
  type Purchase,
} from '../index';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function seedPurchase(): Purchase {
  return createPurchase(testDb.adapter, {
    name: 'Running shoes',
    category: 'sports',
    priceCents: 12_000,
    purchaseDate: '2026-01-01',
  });
}

describe('usage log CRUD', () => {
  it('logs a use with default usedAt=now', () => {
    const p = seedPurchase();
    const before = Date.now();
    const entry = logUse(testDb.adapter, { purchaseId: p.id });
    const after = Date.now();

    expect(entry.purchaseId).toBe(p.id);
    expect(entry.usedAt).toBeGreaterThanOrEqual(before);
    expect(entry.usedAt).toBeLessThanOrEqual(after);
    expect(entry.notes).toBeNull();
    expect(entry.id).toBeTruthy();
  });

  it('logs a use with explicit usedAt and notes', () => {
    const p = seedPurchase();
    const entry = logUse(testDb.adapter, {
      purchaseId: p.id,
      usedAt: 1_700_000_000_000,
      notes: 'Morning run',
    });
    expect(entry.usedAt).toBe(1_700_000_000_000);
    expect(entry.notes).toBe('Morning run');
  });

  it('getUsageCount returns 0 when no entries exist', () => {
    const p = seedPurchase();
    expect(getUsageCount(testDb.adapter, p.id)).toBe(0);
  });

  it('getUsageCount increments with each log', () => {
    const p = seedPurchase();
    for (let i = 0; i < 10; i++) {
      logUse(testDb.adapter, { purchaseId: p.id, usedAt: 1_000 + i });
    }
    expect(getUsageCount(testDb.adapter, p.id)).toBe(10);
  });

  it('getUsageHistory orders most-recent first', () => {
    const p = seedPurchase();
    logUse(testDb.adapter, { purchaseId: p.id, usedAt: 1_000 });
    logUse(testDb.adapter, { purchaseId: p.id, usedAt: 3_000 });
    logUse(testDb.adapter, { purchaseId: p.id, usedAt: 2_000 });

    const history = getUsageHistory(testDb.adapter, p.id);
    expect(history.map((h) => h.usedAt)).toEqual([3_000, 2_000, 1_000]);
  });

  it('getUsageHistory respects limit', () => {
    const p = seedPurchase();
    for (let i = 0; i < 5; i++) {
      logUse(testDb.adapter, { purchaseId: p.id, usedAt: i * 1_000 });
    }
    const history = getUsageHistory(testDb.adapter, p.id, { limit: 2 });
    expect(history).toHaveLength(2);
  });

  it('deleteUsageEntry removes the row', () => {
    const p = seedPurchase();
    const entry = logUse(testDb.adapter, { purchaseId: p.id });
    expect(getUsageCount(testDb.adapter, p.id)).toBe(1);
    expect(deleteUsageEntry(testDb.adapter, entry.id)).toBe(true);
    expect(getUsageCount(testDb.adapter, p.id)).toBe(0);
  });

  it('deleteUsageEntry returns false for missing row', () => {
    expect(deleteUsageEntry(testDb.adapter, 'missing')).toBe(false);
  });

  it('entries cascade-delete when the purchase is removed', () => {
    const p = seedPurchase();
    logUse(testDb.adapter, { purchaseId: p.id });
    logUse(testDb.adapter, { purchaseId: p.id });
    expect(getUsageCount(testDb.adapter, p.id)).toBe(2);

    deletePurchase(testDb.adapter, p.id);
    expect(getUsageCount(testDb.adapter, p.id)).toBe(0);
  });

  it('only counts entries for the requested purchase', () => {
    const a = seedPurchase();
    const b = createPurchase(testDb.adapter, {
      name: 'Headphones',
      category: 'tech',
      priceCents: 20_000,
      purchaseDate: '2026-01-10',
    });
    logUse(testDb.adapter, { purchaseId: a.id });
    logUse(testDb.adapter, { purchaseId: b.id });
    logUse(testDb.adapter, { purchaseId: b.id });

    expect(getUsageCount(testDb.adapter, a.id)).toBe(1);
    expect(getUsageCount(testDb.adapter, b.id)).toBe(2);
  });
});
