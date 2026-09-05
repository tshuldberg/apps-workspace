import { describe, it, expect } from 'vitest';
import {
  PROVIDER_CONFIGS,
  getProviderConfig,
  generateAffiliateTrackingId,
  generateCheckoutUrl,
  computeCartTotal,
  isInPantry,
  buildCartItems,
  type CartItem,
  type ProductMatch,
  type GroceryProvider,
  type RecipeIngredientInput,
} from '../grocery-delivery';
import type { PantryItem } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────

function makePantryItem(name: string): PantryItem {
  return {
    id: '1',
    name,
    quantity: 1,
    unit: null,
    storage_location: 'pantry',
    expiration_date: null,
    purchase_date: null,
    barcode: null,
    photo_path: null,
    notes: null,
    grocery_section: 'pantry',
    is_staple: 0,
    product_id: null,
    nutrition_data_id: null,
    confirmation_status: 'unconfirmed',
    confirmed_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}

function makeProduct(
  name: string,
  provider: GroceryProvider,
  price: number | null = null,
): ProductMatch {
  return {
    providerId: `${provider}_${name}`,
    providerName: provider,
    productName: name,
    brandName: null,
    price,
    unit: null,
    imageUrl: null,
    affiliateUrl: `https://example.com/${name}`,
    confidence: 0.8,
  };
}

// ── PROVIDER_CONFIGS ──────────────────────────────────────────────────

describe('PROVIDER_CONFIGS', () => {
  it('has all 3 providers', () => {
    const keys = Object.keys(PROVIDER_CONFIGS);
    expect(keys).toHaveLength(3);
    expect(keys).toContain('instacart');
    expect(keys).toContain('amazon_fresh');
    expect(keys).toContain('walmart');
  });

  it('each provider has name, color, and affiliatePrefix', () => {
    for (const config of Object.values(PROVIDER_CONFIGS)) {
      expect(config.name).toBeTruthy();
      expect(config.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(config.affiliatePrefix).toMatch(/^bc_/);
    }
  });
});

// ── getProviderConfig ─────────────────────────────────────────────────

describe('getProviderConfig', () => {
  it('returns Instacart config', () => {
    const config = getProviderConfig('instacart');
    expect(config.name).toBe('Instacart');
    expect(config.color).toBe('#43B02A');
    expect(config.affiliatePrefix).toBe('bc_inst_');
  });

  it('returns Amazon Fresh config', () => {
    const config = getProviderConfig('amazon_fresh');
    expect(config.name).toBe('Amazon Fresh');
    expect(config.color).toBe('#FF9900');
    expect(config.affiliatePrefix).toBe('bc_amzn_');
  });

  it('returns Walmart config', () => {
    const config = getProviderConfig('walmart');
    expect(config.name).toBe('Walmart');
    expect(config.color).toBe('#0071CE');
    expect(config.affiliatePrefix).toBe('bc_wmt_');
  });
});

// ── generateAffiliateTrackingId ───────────────────────────────────────

describe('generateAffiliateTrackingId', () => {
  it('starts with provider affiliate prefix', () => {
    const id = generateAffiliateTrackingId('instacart');
    expect(id.startsWith('bc_inst_')).toBe(true);
  });

  it('generates unique IDs', () => {
    const ids = new Set(
      Array.from({ length: 20 }, () => generateAffiliateTrackingId('walmart')),
    );
    expect(ids.size).toBe(20);
  });
});

// ── generateCheckoutUrl ───────────────────────────────────────────────

describe('generateCheckoutUrl', () => {
  it('returns instacart URL with ref param', () => {
    const url = generateCheckoutUrl('instacart', 'bc_inst_abc');
    expect(url).toBe('https://www.instacart.com/store/checkout?ref=bc_inst_abc');
  });

  it('returns amazon fresh URL with ref param', () => {
    const url = generateCheckoutUrl('amazon_fresh', 'bc_amzn_xyz');
    expect(url).toBe('https://www.amazon.com/alm/storefront?ref=bc_amzn_xyz');
  });

  it('returns walmart URL with ref param', () => {
    const url = generateCheckoutUrl('walmart', 'bc_wmt_123');
    expect(url).toBe('https://www.walmart.com/cart?ref=bc_wmt_123');
  });
});

// ── computeCartTotal ──────────────────────────────────────────────────

describe('computeCartTotal', () => {
  it('sums prices of non-pantry matched items', () => {
    const items: CartItem[] = [
      { ingredientName: 'flour', quantity: 1, unit: 'lb', matchedProduct: makeProduct('flour', 'instacart', 3.49), inPantry: false },
      { ingredientName: 'sugar', quantity: 1, unit: 'lb', matchedProduct: makeProduct('sugar', 'instacart', 2.99), inPantry: false },
    ];
    expect(computeCartTotal(items)).toBeCloseTo(6.48);
  });

  it('excludes pantry items from total', () => {
    const items: CartItem[] = [
      { ingredientName: 'flour', quantity: 1, unit: 'lb', matchedProduct: makeProduct('flour', 'instacart', 3.49), inPantry: true },
      { ingredientName: 'sugar', quantity: 1, unit: 'lb', matchedProduct: makeProduct('sugar', 'instacart', 2.99), inPantry: false },
    ];
    expect(computeCartTotal(items)).toBeCloseTo(2.99);
  });

  it('returns null when no non-pantry items have products', () => {
    const items: CartItem[] = [
      { ingredientName: 'flour', quantity: 1, unit: 'lb', matchedProduct: null, inPantry: false },
    ];
    expect(computeCartTotal(items)).toBeNull();
  });

  it('returns null when a matched product has no price', () => {
    const items: CartItem[] = [
      { ingredientName: 'flour', quantity: 1, unit: 'lb', matchedProduct: makeProduct('flour', 'instacart', 3.49), inPantry: false },
      { ingredientName: 'sugar', quantity: 1, unit: 'lb', matchedProduct: makeProduct('sugar', 'instacart', null), inPantry: false },
    ];
    expect(computeCartTotal(items)).toBeNull();
  });

  it('returns null for empty cart', () => {
    expect(computeCartTotal([])).toBeNull();
  });

  it('returns null when all items are in pantry', () => {
    const items: CartItem[] = [
      { ingredientName: 'flour', quantity: 1, unit: 'lb', matchedProduct: makeProduct('flour', 'instacart', 3.49), inPantry: true },
    ];
    expect(computeCartTotal(items)).toBeNull();
  });
});

// ── isInPantry ────────────────────────────────────────────────────────

describe('isInPantry', () => {
  it('returns true for exact match', () => {
    expect(isInPantry('flour', [makePantryItem('flour')])).toBe(true);
  });

  it('returns true for fuzzy match (all-purpose flour vs flour)', () => {
    expect(isInPantry('flour', [makePantryItem('all-purpose flour')])).toBe(true);
  });

  it('returns false when pantry is empty', () => {
    expect(isInPantry('flour', [])).toBe(false);
  });

  it('returns false for unrelated items', () => {
    expect(isInPantry('chicken', [makePantryItem('flour')])).toBe(false);
  });
});

// ── buildCartItems ────────────────────────────────────────────────────

describe('buildCartItems', () => {
  const ingredients: RecipeIngredientInput[] = [
    { name: 'flour', quantity: 2, unit: 'cups' },
    { name: 'sugar', quantity: 1, unit: 'cup' },
    { name: 'butter', quantity: 0.5, unit: 'cup' },
  ];

  it('builds cart with matched products', () => {
    const products = new Map<string, ProductMatch>([
      ['flour', makeProduct('flour', 'instacart', 3.49)],
      ['sugar', makeProduct('sugar', 'instacart', 2.99)],
    ]);
    const items = buildCartItems(ingredients, products, []);
    expect(items).toHaveLength(3);
    expect(items[0].matchedProduct).not.toBeNull();
    expect(items[1].matchedProduct).not.toBeNull();
    expect(items[2].matchedProduct).toBeNull(); // butter not in products
  });

  it('marks pantry items correctly', () => {
    const pantry = [makePantryItem('flour'), makePantryItem('sugar')];
    const items = buildCartItems(ingredients, new Map(), pantry);
    expect(items[0].inPantry).toBe(true);  // flour
    expect(items[1].inPantry).toBe(true);  // sugar
    expect(items[2].inPantry).toBe(false); // butter
  });

  it('preserves ingredient name, quantity, and unit', () => {
    const items = buildCartItems(ingredients, new Map(), []);
    expect(items[0]).toMatchObject({ ingredientName: 'flour', quantity: 2, unit: 'cups' });
    expect(items[1]).toMatchObject({ ingredientName: 'sugar', quantity: 1, unit: 'cup' });
    expect(items[2]).toMatchObject({ ingredientName: 'butter', quantity: 0.5, unit: 'cup' });
  });

  it('returns empty array for empty ingredients', () => {
    expect(buildCartItems([], new Map(), [])).toEqual([]);
  });
});
