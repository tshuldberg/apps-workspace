import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  deleteGiftBudget,
  getGiftBudget,
  listGiftBudgetsForPerson,
  setGiftBudget,
} from '../index';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('gift-budgets CRUD', () => {
  it('creates a default per-person budget when occasion is null', () => {
    const b = setGiftBudget(testDb.adapter, {
      personId: 'p1',
      amountCents: 10000,
    });
    expect(b.personId).toBe('p1');
    expect(b.occasion).toBeNull();
    expect(b.amountCents).toBe(10000);
  });

  it('upserts on (personId, occasion) -- second call updates the same row', () => {
    const a = setGiftBudget(testDb.adapter, {
      personId: 'p1',
      occasion: 'birthday',
      amountCents: 5000,
    });
    const b = setGiftBudget(testDb.adapter, {
      personId: 'p1',
      occasion: 'birthday',
      amountCents: 7500,
    });
    expect(b.id).toBe(a.id);
    expect(b.amountCents).toBe(7500);
  });

  it('keeps occasion-specific and default budgets as separate rows', () => {
    const def = setGiftBudget(testDb.adapter, {
      personId: 'p1',
      amountCents: 20000,
    });
    const bday = setGiftBudget(testDb.adapter, {
      personId: 'p1',
      occasion: 'birthday',
      amountCents: 6000,
    });
    expect(def.id).not.toBe(bday.id);
    const list = listGiftBudgetsForPerson(testDb.adapter, 'p1');
    expect(list).toHaveLength(2);
  });

  it('getGiftBudget retrieves by occasion or default', () => {
    setGiftBudget(testDb.adapter, { personId: 'p1', amountCents: 20000 });
    setGiftBudget(testDb.adapter, {
      personId: 'p1',
      occasion: 'holiday',
      amountCents: 5000,
    });
    expect(getGiftBudget(testDb.adapter, 'p1')?.amountCents).toBe(20000);
    expect(getGiftBudget(testDb.adapter, 'p1', 'holiday')?.amountCents).toBe(5000);
    expect(getGiftBudget(testDb.adapter, 'p1', 'graduation')).toBeNull();
  });

  it('deletes a budget', () => {
    const b = setGiftBudget(testDb.adapter, {
      personId: 'p1',
      amountCents: 1000,
    });
    expect(deleteGiftBudget(testDb.adapter, b.id)).toBe(true);
    expect(getGiftBudget(testDb.adapter, 'p1')).toBeNull();
    expect(deleteGiftBudget(testDb.adapter, b.id)).toBe(false);
  });

  it('list returns default first then occasion-specific alphabetical', () => {
    setGiftBudget(testDb.adapter, {
      personId: 'p1',
      occasion: 'holiday',
      amountCents: 5000,
    });
    setGiftBudget(testDb.adapter, { personId: 'p1', amountCents: 20000 });
    setGiftBudget(testDb.adapter, {
      personId: 'p1',
      occasion: 'birthday',
      amountCents: 6000,
    });
    const list = listGiftBudgetsForPerson(testDb.adapter, 'p1');
    expect(list.map((b) => b.occasion)).toEqual([null, 'birthday', 'holiday']);
  });
});
