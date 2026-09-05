import { describe, expect, it } from 'vitest';
import {
  isAutoPartsPurchase,
  buildMaintenanceLogEntry,
  getCarRelatedWarranties,
} from '../integrations/car-link';
import type { Purchase, Warranty } from '../models/schemas';

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: overrides.id ?? 'p',
    name: 'Item',
    category: 'tech',
    priceCents: 5000,
    purchaseDate: '2026-04-15',
    store: null,
    paymentMethod: null,
    brand: null,
    url: null,
    receiptPhotoId: null,
    satisfactionInitial: null,
    satisfaction30day: null,
    satisfaction90day: null,
    isImpulse: false,
    researchNotesMd: null,
    returnDeadline: null,
    returned: false,
    returnReason: null,
    wishlistItemId: null,
    notesMd: null,
    photoId: null,
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
    ...overrides,
  };
}

function warranty(overrides: Partial<Warranty> = {}): Warranty {
  return {
    id: overrides.id ?? 'w',
    purchaseId: null,
    itemName: 'thing',
    coverageType: 'manufacturer',
    startDate: 1700000000000,
    expiryDate: 1800000000000,
    coverageDetailsMd: null,
    serialNumber: null,
    registrationNumber: null,
    claimFiled: false,
    claimNotes: null,
    reminderDaysBefore: 30,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

describe('isAutoPartsPurchase', () => {
  it('returns true for tech purchases with auto keywords', () => {
    expect(isAutoPartsPurchase(purchase({ name: 'Motor Oil 5W30' }))).toBe(true);
    expect(isAutoPartsPurchase(purchase({ name: 'Brake pads' }))).toBe(true);
    expect(isAutoPartsPurchase(purchase({ name: 'Car battery' }))).toBe(true);
    expect(isAutoPartsPurchase(purchase({ name: 'New Tires' }))).toBe(true);
  });

  it('returns false when category is not tech', () => {
    expect(isAutoPartsPurchase(purchase({ category: 'home', name: 'Motor Oil' }))).toBe(false);
  });

  it('returns false for tech purchases without auto keywords', () => {
    expect(isAutoPartsPurchase(purchase({ name: 'Headphones' }))).toBe(false);
    expect(isAutoPartsPurchase(purchase({ name: 'USB Cable' }))).toBe(false);
  });
});

describe('buildMaintenanceLogEntry', () => {
  it('produces a maintenance log entry shape from a purchase', () => {
    const p = purchase({ id: 'p1', name: 'Brake pads', priceCents: 8500, purchaseDate: '2026-04-10' });
    expect(buildMaintenanceLogEntry(p)).toEqual({
      description: 'Brake pads',
      partType: 'other',
      costCents: 8500,
      occurredAt: '2026-04-10',
      sourcePurchaseId: 'p1',
    });
  });
});

describe('getCarRelatedWarranties', () => {
  it('returns [] for empty inputs', () => {
    expect(getCarRelatedWarranties([], [])).toEqual([]);
    expect(getCarRelatedWarranties([warranty()], [])).toEqual([]);
    expect(getCarRelatedWarranties([], [purchase()])).toEqual([]);
  });

  it('returns warranties whose purchaseId is an auto-parts purchase', () => {
    const purchases: Purchase[] = [
      purchase({ id: 'p1', name: 'Motor Oil' }),
      purchase({ id: 'p2', name: 'Headphones' }),
      purchase({ id: 'p3', name: 'Brake pads' }),
    ];
    const warranties: Warranty[] = [
      warranty({ id: 'w1', purchaseId: 'p1' }),
      warranty({ id: 'w2', purchaseId: 'p2' }),
      warranty({ id: 'w3', purchaseId: 'p3' }),
      warranty({ id: 'w4', purchaseId: null }),
    ];
    const result = getCarRelatedWarranties(warranties, purchases);
    expect(result.map((w) => w.id).sort()).toEqual(['w1', 'w3']);
  });
});
