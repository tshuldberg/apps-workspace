import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  addToWaitList,
  getWaitItemById,
  listWaitingItems,
  listAllWaitItems,
  markBought,
  markSkipped,
  deleteWaitItem,
} from '../index';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('thirty-day-rule CRUD', () => {
  it('adds an item with defaults', () => {
    const item = addToWaitList(testDb.adapter, {
      itemName: 'Standing desk',
      priceCents: 45000,
    });
    expect(item.itemName).toBe('Standing desk');
    expect(item.decision).toBe('waiting');
    expect(item.decidedAt).toBeNull();
    expect(item.purchaseId).toBeNull();
    expect(item.reasonMd).toBeNull();
  });

  it('round-trips via getWaitItemById', () => {
    const created = addToWaitList(testDb.adapter, {
      itemName: 'Thing',
      priceCents: 1000,
      reasonMd: 'curious',
    });
    const fetched = getWaitItemById(testDb.adapter, created.id);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.reasonMd).toBe('curious');
  });

  it('returns null for an unknown id', () => {
    expect(getWaitItemById(testDb.adapter, 'missing')).toBeNull();
  });

  it('lists waiting items sorted by addedAt DESC', () => {
    addToWaitList(testDb.adapter, { itemName: 'A', priceCents: 100 });
    // slight delay to ensure distinct timestamps
    const b = addToWaitList(testDb.adapter, { itemName: 'B', priceCents: 200 });
    markBought(testDb.adapter, b.id);
    addToWaitList(testDb.adapter, { itemName: 'C', priceCents: 300 });
    const waiting = listWaitingItems(testDb.adapter);
    expect(waiting).toHaveLength(2);
    expect(waiting.map((w) => w.itemName).sort()).toEqual(['A', 'C']);
  });

  it('markBought sets decision + decided_at without a linked purchase', () => {
    const created = addToWaitList(testDb.adapter, {
      itemName: 'Headphones',
      priceCents: 20000,
    });
    const updated = markBought(testDb.adapter, created.id);
    expect(updated?.decision).toBe('bought');
    expect(updated?.purchaseId).toBeNull();
    expect(updated?.decidedAt).not.toBeNull();
  });

  it('markSkipped sets decision + decided_at with no purchase', () => {
    const created = addToWaitList(testDb.adapter, {
      itemName: 'Skip it',
      priceCents: 5000,
    });
    const updated = markSkipped(testDb.adapter, created.id);
    expect(updated?.decision).toBe('skipped');
    expect(updated?.purchaseId).toBeNull();
    expect(updated?.decidedAt).not.toBeNull();
  });

  it('markBought/markSkipped return null for missing id', () => {
    expect(markBought(testDb.adapter, 'missing')).toBeNull();
    expect(markSkipped(testDb.adapter, 'missing')).toBeNull();
  });

  it('listAllWaitItems filters by decision', () => {
    const a = addToWaitList(testDb.adapter, { itemName: 'A', priceCents: 1 });
    const b = addToWaitList(testDb.adapter, { itemName: 'B', priceCents: 2 });
    markBought(testDb.adapter, a.id);
    markSkipped(testDb.adapter, b.id);
    addToWaitList(testDb.adapter, { itemName: 'C', priceCents: 3 });
    expect(listAllWaitItems(testDb.adapter, { decision: 'bought' })).toHaveLength(1);
    expect(listAllWaitItems(testDb.adapter, { decision: 'skipped' })).toHaveLength(1);
    expect(listAllWaitItems(testDb.adapter, { decision: 'waiting' })).toHaveLength(1);
    expect(listAllWaitItems(testDb.adapter)).toHaveLength(3);
  });

  it('deleteWaitItem removes the row', () => {
    const item = addToWaitList(testDb.adapter, { itemName: 'Gone', priceCents: 1 });
    expect(deleteWaitItem(testDb.adapter, item.id)).toBe(true);
    expect(getWaitItemById(testDb.adapter, item.id)).toBeNull();
    expect(deleteWaitItem(testDb.adapter, item.id)).toBe(false);
  });
});
