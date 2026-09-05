import type { FoodSearchResult } from './types';
import { createRateLimiter } from './rate-limiter';

const OFF_API_BASE = 'https://world.openfoodfacts.org';
const OFF_ATTRIBUTION = 'Data from Open Food Facts (openfoodfacts.org), licensed under ODbL';

// 100 requests per minute = ~1.67/sec
const limiter = createRateLimiter(100, 1.67);

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseOFFProduct(product: Record<string, unknown>, rawJson: string): FoodSearchResult | null {
  const name = (product.product_name as string) || (product.product_name_en as string);
  if (!name) return null;

  const nutriments = (product.nutriments as Record<string, unknown>) || {};
  const servingSize = parseNumber(product.serving_quantity) || 100;
  const servingUnit = (product.serving_quantity_unit as string) || 'g';

  return {
    name,
    brand: (product.brands as string) || null,
    servingSize,
    servingUnit,
    calories: parseNumber(nutriments['energy-kcal_100g']),
    proteinG: parseNumber(nutriments.proteins_100g),
    carbsG: parseNumber(nutriments.carbohydrates_100g),
    fatG: parseNumber(nutriments.fat_100g),
    fiberG: parseNumber(nutriments.fiber_100g),
    sugarG: parseNumber(nutriments.sugars_100g),
    sodiumMg: parseNumber(nutriments.sodium_100g) * 1000,
    barcode: (product.code as string) || null,
    source: 'open_food_facts',
    rawJson,
    attribution: OFF_ATTRIBUTION,
  };
}

/**
 * Search Open Food Facts by text query.
 */
export async function searchOFF(
  query: string,
  page = 1,
  limit = 20,
): Promise<FoodSearchResult[]> {
  if (!limiter.tryConsume()) {
    await limiter.waitForToken();
  }

  const url = `${OFF_API_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=true&page=${page}&page_size=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MyNutrition/1.0 (trey@mylife.app)' },
    });
    if (!res.ok) return [];

    const rawJson = await res.text();
    const data = JSON.parse(rawJson) as { products?: Record<string, unknown>[] };
    if (!data.products) return [];

    return data.products
      .map((p) => parseOFFProduct(p, JSON.stringify(p)))
      .filter((r): r is FoodSearchResult => r !== null);
  } catch {
    return [];
  }
}

/**
 * Look up a product by barcode on Open Food Facts.
 */
export async function lookupBarcodeOFF(barcode: string): Promise<FoodSearchResult | null> {
  if (!limiter.tryConsume()) {
    await limiter.waitForToken();
  }

  const url = `${OFF_API_BASE}/api/v2/product/${encodeURIComponent(barcode)}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MyNutrition/1.0 (trey@mylife.app)' },
    });
    if (!res.ok) return null;

    const rawJson = await res.text();
    const data = JSON.parse(rawJson) as { status?: number; product?: Record<string, unknown> };
    if (data.status !== 1 || !data.product) return null;

    return parseOFFProduct(data.product, rawJson);
  } catch {
    return null;
  }
}
