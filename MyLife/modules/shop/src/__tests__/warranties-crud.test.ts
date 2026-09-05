import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createPurchase,
  createWarranty,
  deletePurchase,
  deleteWarranty,
  fileClaim,
  getWarrantiesByPurchase,
  getWarrantyById,
  listActiveWarranties,
  listExpiredWarranties,
  listExpiringSoon,
  listWarranties,
  updateWarranty,
  type Warranty,
} from '../index';

let testDb: InMemoryTestDatabase;

const DAY = 86_400_000;
const NOW = new Date('2026-04-21T00:00:00Z').getTime();

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function seed(overrides: Partial<Parameters<typeof createWarranty>[1]> = {}): Warranty {
  return createWarranty(testDb.adapter, {
    itemName: 'MacBook Pro',
    coverageType: 'manufacturer',
    startDate: NOW - 30 * DAY,
    expiryDate: NOW + 365 * DAY,
    ...overrides,
  });
}

describe('warranty CRUD', () => {
  it('creates a warranty with defaults', () => {
    const w = seed();
    expect(w.itemName).toBe('MacBook Pro');
    expect(w.coverageType).toBe('manufacturer');
    expect(w.claimFiled).toBe(false);
    expect(w.reminderDaysBefore).toBe(30);
    expect(w.purchaseId).toBeNull();
    expect(w.createdAt).toBeGreaterThan(0);
  });

  it('persists optional fields', () => {
    const w = seed({
      serialNumber: 'C02XG123',
      registrationNumber: 'APL-999',
      coverageDetailsMd: '1-year limited warranty',
      reminderDaysBefore: 14,
    });
    expect(w.serialNumber).toBe('C02XG123');
    expect(w.registrationNumber).toBe('APL-999');
    expect(w.coverageDetailsMd).toBe('1-year limited warranty');
    expect(w.reminderDaysBefore).toBe(14);
  });

  it('rejects expiry before start', () => {
    expect(() =>
      seed({ startDate: NOW, expiryDate: NOW - DAY }),
    ).toThrow();
  });

  it('reads missing as null', () => {
    expect(getWarrantyById(testDb.adapter, 'missing')).toBeNull();
  });

  it('updates partial fields', () => {
    const w = seed();
    const updated = updateWarranty(testDb.adapter, w.id, {
      itemName: 'MacBook Pro 14"',
      serialNumber: 'SN-1',
    });
    expect(updated?.itemName).toBe('MacBook Pro 14"');
    expect(updated?.serialNumber).toBe('SN-1');
    expect(updated?.coverageType).toBe('manufacturer');
  });

  it('update rejects expiry < start', () => {
    const w = seed();
    expect(() =>
      updateWarranty(testDb.adapter, w.id, { expiryDate: w.startDate - DAY }),
    ).toThrow();
  });

  it('returns null updating missing', () => {
    expect(
      updateWarranty(testDb.adapter, 'missing', { itemName: 'x' }),
    ).toBeNull();
  });

  it('deletes a warranty', () => {
    const w = seed();
    expect(deleteWarranty(testDb.adapter, w.id)).toBe(true);
    expect(getWarrantyById(testDb.adapter, w.id)).toBeNull();
    expect(deleteWarranty(testDb.adapter, w.id)).toBe(false);
  });
});

describe('list queries', () => {
  function seedSet() {
    // active, expiring in 10 days
    seed({ itemName: 'Phone', expiryDate: Date.now() + 10 * DAY });
    // active, expiring in 400 days
    seed({
      itemName: 'TV',
      coverageType: 'extended',
      expiryDate: Date.now() + 400 * DAY,
    });
    // expired
    seed({
      itemName: 'Toaster',
      expiryDate: Date.now() - 5 * DAY,
      startDate: Date.now() - 400 * DAY,
    });
    // active but claim filed
    const c = seed({
      itemName: 'Laptop',
      coverageType: 'protection',
      expiryDate: Date.now() + 200 * DAY,
    });
    fileClaim(testDb.adapter, c.id, { notes: 'screen cracked' });
  }

  it('listWarranties returns all by default', () => {
    seedSet();
    const all = listWarranties(testDb.adapter);
    expect(all).toHaveLength(4);
    // ordered by expiry_date asc
    expect(all[0]!.itemName).toBe('Toaster');
  });

  it('listWarranties filters by coverage type', () => {
    seedSet();
    const ext = listWarranties(testDb.adapter, { coverageType: 'extended' });
    expect(ext.map((w) => w.itemName)).toEqual(['TV']);
  });

  it('listWarranties excludes expired when includeExpired:false', () => {
    seedSet();
    const live = listWarranties(testDb.adapter, { includeExpired: false });
    expect(live.map((w) => w.itemName).sort()).toEqual([
      'Laptop',
      'Phone',
      'TV',
    ]);
  });

  it('listActiveWarranties excludes expired + claimed', () => {
    seedSet();
    const active = listActiveWarranties(testDb.adapter);
    expect(active.map((w) => w.itemName).sort()).toEqual(['Phone', 'TV']);
  });

  it('listExpiredWarranties returns only expired', () => {
    seedSet();
    const expired = listExpiredWarranties(testDb.adapter);
    expect(expired.map((w) => w.itemName)).toEqual(['Toaster']);
  });

  it('listExpiringSoon filters by days-ahead window', () => {
    seedSet();
    const soon = listExpiringSoon(testDb.adapter, 30);
    expect(soon.map((w) => w.itemName)).toEqual(['Phone']);
    const far = listExpiringSoon(testDb.adapter, 500);
    expect(far.map((w) => w.itemName).sort()).toEqual([
      'Laptop',
      'Phone',
      'TV',
    ]);
  });

  it('listExpiringSoon returns empty for negative days', () => {
    seedSet();
    expect(listExpiringSoon(testDb.adapter, -1)).toEqual([]);
  });
});

describe('fileClaim', () => {
  it('sets claim_filed + notes', () => {
    const w = seed();
    const claimed = fileClaim(testDb.adapter, w.id, {
      notes: 'screen stopped working',
    });
    expect(claimed?.claimFiled).toBe(true);
    expect(claimed?.claimNotes).toBe('screen stopped working');
  });

  it('returns null for missing warranty', () => {
    expect(
      fileClaim(testDb.adapter, 'missing', { notes: 'x' }),
    ).toBeNull();
  });

  it('rejects empty notes', () => {
    const w = seed();
    expect(() => fileClaim(testDb.adapter, w.id, { notes: '' })).toThrow();
  });
});

describe('getWarrantiesByPurchase + cascade', () => {
  it('returns warranties linked to a purchase', () => {
    const purchase = createPurchase(testDb.adapter, {
      name: 'AirPods',
      category: 'tech',
      priceCents: 24900,
      purchaseDate: '2026-04-01',
    });
    seed({ purchaseId: purchase.id, itemName: 'AirPods' });
    seed({ itemName: 'Unrelated' });

    const linked = getWarrantiesByPurchase(testDb.adapter, purchase.id);
    expect(linked).toHaveLength(1);
    expect(linked[0]!.itemName).toBe('AirPods');
  });

  it('sets purchase_id to NULL on purchase delete (ON DELETE SET NULL)', () => {
    const purchase = createPurchase(testDb.adapter, {
      name: 'AirPods',
      category: 'tech',
      priceCents: 24900,
      purchaseDate: '2026-04-01',
    });
    const w = seed({ purchaseId: purchase.id });
    deletePurchase(testDb.adapter, purchase.id);

    const after = getWarrantyById(testDb.adapter, w.id);
    expect(after).not.toBeNull();
    expect(after!.purchaseId).toBeNull();
  });
});
