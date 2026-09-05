import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createPurchase,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
  listPurchases,
  markReturned,
  updateSatisfaction,
  getPendingSatisfactionReviews,
  type Purchase,
} from '../index';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function seedOne(overrides: Partial<Parameters<typeof createPurchase>[1]> = {}): Purchase {
  return createPurchase(testDb.adapter, {
    name: 'AirPods',
    category: 'tech',
    priceCents: 24900,
    purchaseDate: '2026-04-01',
    ...overrides,
  });
}

describe('purchase CRUD', () => {
  it('creates a purchase with required fields and defaults', () => {
    const p = seedOne();
    expect(p.name).toBe('AirPods');
    expect(p.priceCents).toBe(24900);
    expect(p.isImpulse).toBe(false);
    expect(p.returned).toBe(false);
    expect(p.satisfactionInitial).toBeNull();
    expect(p.satisfaction30day).toBeNull();
    expect(p.returnDeadline).toBeNull();
  });

  it('auto-calculates return_deadline when policyDays is provided', () => {
    const p = seedOne({ purchaseDate: '2026-01-15', policyDays: 30 });
    expect(p.returnDeadline).toBe('2026-02-14');
  });

  it('persists explicit returnDeadline over policyDays when both given', () => {
    const p = seedOne({
      purchaseDate: '2026-01-15',
      returnDeadline: '2026-03-01',
      policyDays: 30,
    });
    expect(p.returnDeadline).toBe('2026-03-01');
  });

  it('persists optional fields (store, payment, brand, url, impulse, notes)', () => {
    const p = seedOne({
      store: 'Apple',
      paymentMethod: 'credit_card',
      brand: 'Apple',
      url: 'https://apple.com',
      isImpulse: true,
      researchNotesMd: 'Compared Sony WF-1000XM5',
      notesMd: 'Gift from self',
    });
    expect(p.store).toBe('Apple');
    expect(p.paymentMethod).toBe('credit_card');
    expect(p.isImpulse).toBe(true);
    expect(p.researchNotesMd).toContain('Sony');
  });

  it('reads missing purchase as null', () => {
    expect(getPurchaseById(testDb.adapter, 'missing')).toBeNull();
  });

  it('updates partial fields', () => {
    const p = seedOne();
    const updated = updatePurchase(testDb.adapter, p.id, {
      name: 'AirPods Pro',
      priceCents: 24900,
      store: 'Amazon',
    });
    expect(updated?.name).toBe('AirPods Pro');
    expect(updated?.store).toBe('Amazon');
    expect(updated?.category).toBe('tech');
  });

  it('returns null updating missing purchase', () => {
    expect(updatePurchase(testDb.adapter, 'missing', { name: 'x' })).toBeNull();
  });

  it('deletes a purchase', () => {
    const p = seedOne();
    expect(deletePurchase(testDb.adapter, p.id)).toBe(true);
    expect(getPurchaseById(testDb.adapter, p.id)).toBeNull();
    expect(deletePurchase(testDb.adapter, p.id)).toBe(false);
  });
});

describe('listPurchases filtering', () => {
  function seedMany() {
    seedOne({ name: 'A', category: 'tech', priceCents: 1000, purchaseDate: '2026-01-01', store: 'Apple' });
    seedOne({ name: 'B', category: 'clothing', priceCents: 5000, purchaseDate: '2026-02-01', store: 'Nordstrom' });
    seedOne({ name: 'C', category: 'tech', priceCents: 20000, purchaseDate: '2026-03-01', store: 'Apple', isImpulse: true });
    seedOne({ name: 'D', category: 'home', priceCents: 800, purchaseDate: '2026-04-01' });
  }

  it('returns all purchases ordered by date desc by default', () => {
    seedMany();
    const all = listPurchases(testDb.adapter);
    expect(all.map((p) => p.name)).toEqual(['D', 'C', 'B', 'A']);
  });

  it('filters by category', () => {
    seedMany();
    const tech = listPurchases(testDb.adapter, { category: 'tech' });
    expect(tech.map((p) => p.name).sort()).toEqual(['A', 'C']);
  });

  it('filters by store', () => {
    seedMany();
    const apple = listPurchases(testDb.adapter, { store: 'Apple' });
    expect(apple).toHaveLength(2);
  });

  it('filters by date range', () => {
    seedMany();
    const feb = listPurchases(testDb.adapter, { dateFrom: '2026-02-01', dateTo: '2026-02-28' });
    expect(feb.map((p) => p.name)).toEqual(['B']);
  });

  it('filters to impulse purchases only', () => {
    seedMany();
    const impulse = listPurchases(testDb.adapter, { impulseOnly: true });
    expect(impulse.map((p) => p.name)).toEqual(['C']);
  });

  it('filters by price range', () => {
    seedMany();
    const mid = listPurchases(testDb.adapter, { priceMin: 1000, priceMax: 10000 });
    expect(mid.map((p) => p.name).sort()).toEqual(['A', 'B']);
  });

  it('filters by returned status', () => {
    seedMany();
    const all = listPurchases(testDb.adapter);
    markReturned(testDb.adapter, all[0]!.id, { returnReason: 'doesn\'t fit' });
    expect(listPurchases(testDb.adapter, { returned: true })).toHaveLength(1);
    expect(listPurchases(testDb.adapter, { returned: false })).toHaveLength(3);
  });
});

describe('markReturned', () => {
  it('sets returned + reason', () => {
    const p = seedOne();
    const returned = markReturned(testDb.adapter, p.id, {
      returnReason: 'Wrong color',
      returnedAt: '2026-04-10T00:00:00Z',
    });
    expect(returned?.returned).toBe(true);
    expect(returned?.returnReason).toBe('Wrong color');
  });

  it('returns null for missing purchase', () => {
    expect(markReturned(testDb.adapter, 'missing', {})).toBeNull();
  });
});

describe('updateSatisfaction', () => {
  it('writes initial rating', () => {
    const p = seedOne();
    const u = updateSatisfaction(testDb.adapter, p.id, 'initial', 5);
    expect(u?.satisfactionInitial).toBe(5);
  });

  it('writes 30day rating', () => {
    const p = seedOne();
    const u = updateSatisfaction(testDb.adapter, p.id, '30day', 3);
    expect(u?.satisfaction30day).toBe(3);
    expect(u?.satisfaction90day).toBeNull();
  });

  it('writes 90day rating independently', () => {
    const p = seedOne();
    updateSatisfaction(testDb.adapter, p.id, '30day', 4);
    const u = updateSatisfaction(testDb.adapter, p.id, '90day', 2);
    expect(u?.satisfaction30day).toBe(4);
    expect(u?.satisfaction90day).toBe(2);
  });

  it('rejects rating outside 1-5', () => {
    const p = seedOne();
    expect(() => updateSatisfaction(testDb.adapter, p.id, '30day', 0)).toThrow();
    expect(() => updateSatisfaction(testDb.adapter, p.id, '30day', 6)).toThrow();
    expect(() => updateSatisfaction(testDb.adapter, p.id, '30day', 3.5)).toThrow();
  });

  it('returns null for missing purchase', () => {
    expect(updateSatisfaction(testDb.adapter, 'missing', '30day', 3)).toBeNull();
  });
});

describe('getPendingSatisfactionReviews', () => {
  it('returns purchases where 30d window has elapsed and rating is null', () => {
    seedOne({ purchaseDate: '2026-01-01', name: 'Old' });
    seedOne({ purchaseDate: '2026-04-20', name: 'Fresh' });

    const pending = getPendingSatisfactionReviews(
      testDb.adapter,
      '30day',
      '2026-04-21',
    );
    expect(pending.map((p) => p.name)).toEqual(['Old']);
  });

  it('excludes purchases already rated for that period', () => {
    const p = seedOne({ purchaseDate: '2026-01-01' });
    updateSatisfaction(testDb.adapter, p.id, '30day', 4);

    const pending = getPendingSatisfactionReviews(
      testDb.adapter,
      '30day',
      '2026-04-21',
    );
    expect(pending).toHaveLength(0);
  });

  it('excludes returned purchases', () => {
    const p = seedOne({ purchaseDate: '2026-01-01' });
    markReturned(testDb.adapter, p.id, {});
    const pending = getPendingSatisfactionReviews(
      testDb.adapter,
      '30day',
      '2026-04-21',
    );
    expect(pending).toHaveLength(0);
  });

  it('handles 90day window independently of 30day', () => {
    seedOne({ purchaseDate: '2026-01-01', name: 'Q1' });
    seedOne({ purchaseDate: '2026-03-01', name: 'Q2' });

    const pending30 = getPendingSatisfactionReviews(
      testDb.adapter,
      '30day',
      '2026-04-21',
    );
    expect(pending30.map((p) => p.name).sort()).toEqual(['Q1', 'Q2']);

    const pending90 = getPendingSatisfactionReviews(
      testDb.adapter,
      '90day',
      '2026-04-21',
    );
    expect(pending90.map((p) => p.name)).toEqual(['Q1']);
  });
});
