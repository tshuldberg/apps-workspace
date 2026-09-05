import { describe, expect, it } from 'vitest';
import {
  isPetSupplyPurchase,
  buildPetSupplyEntry,
  getVetRecommendedPurchases,
} from '../integrations/pets-link';
import type { Purchase } from '../models/schemas';

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: overrides.id ?? 'p',
    name: 'Item',
    category: 'other',
    priceCents: 1500,
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

describe('isPetSupplyPurchase', () => {
  it('matches purchases with pet keywords in the name', () => {
    expect(isPetSupplyPurchase(purchase({ name: 'Dog food 25lb' }))).toBe(true);
    expect(isPetSupplyPurchase(purchase({ name: 'Cat litter' }))).toBe(true);
    expect(isPetSupplyPurchase(purchase({ name: 'Chew toy for puppy' }))).toBe(true);
    expect(isPetSupplyPurchase(purchase({ name: 'Treat bag' }))).toBe(true);
    expect(isPetSupplyPurchase(purchase({ name: 'Vet checkup' }))).toBe(true);
    expect(isPetSupplyPurchase(purchase({ name: 'Leash' }))).toBe(true);
  });

  it('does not match unrelated purchases', () => {
    expect(isPetSupplyPurchase(purchase({ name: 'Headphones' }))).toBe(false);
    expect(isPetSupplyPurchase(purchase({ name: 'Coffee table' }))).toBe(false);
  });
});

describe('buildPetSupplyEntry', () => {
  it('produces a pet supply entry shape, marking vet products', () => {
    const p = purchase({
      id: 'p1',
      name: 'Vet prescription rx',
      priceCents: 4500,
      purchaseDate: '2026-04-10',
    });
    expect(buildPetSupplyEntry(p)).toEqual({
      description: 'Vet prescription rx',
      costCents: 4500,
      occurredAt: '2026-04-10',
      sourcePurchaseId: 'p1',
      isVetProduct: true,
    });
  });

  it('marks non-vet pet products with isVetProduct=false', () => {
    const p = purchase({ id: 'p2', name: 'Dog toy' });
    const entry = buildPetSupplyEntry(p);
    expect(entry.isVetProduct).toBe(false);
    expect(entry.sourcePurchaseId).toBe('p2');
  });
});

describe('getVetRecommendedPurchases', () => {
  it('returns [] for empty input', () => {
    expect(getVetRecommendedPurchases([])).toEqual([]);
  });

  it('keeps only vet-flagged pet purchases', () => {
    const purchases: Purchase[] = [
      purchase({ id: 'p1', name: 'Dog vet medication' }),
      purchase({ id: 'p2', name: 'Cat toy' }),
      purchase({ id: 'p3', name: 'Vet prescription rx for dog' }),
      purchase({ id: 'p4', name: 'Headphones' }),
    ];
    const result = getVetRecommendedPurchases(purchases);
    expect(result.map((p) => p.id).sort()).toEqual(['p1', 'p3']);
  });
});
