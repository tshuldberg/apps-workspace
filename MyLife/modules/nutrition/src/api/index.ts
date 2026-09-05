import type { DatabaseAdapter } from '@mylife/db';
import type { Food } from '../types';
import type { FoodSearchResult, APIFoodSearchOptions, BarcodeResult } from './types';
import { searchLocalFoods } from '../search/food-search';
import { searchOFF, lookupBarcodeOFF } from './open-food-facts';
import { searchFatSecret } from './fatsecret';
import { getCachedBarcode, setCachedBarcode } from '../db/barcode-cache';
import { createFood, getFoodById } from '../db/foods';

export type { FoodSearchResult, APIFoodSearchOptions, BarcodeResult, RateLimitConfig } from './types';
export { searchOFF, lookupBarcodeOFF } from './open-food-facts';
export { searchFatSecret, lookupFatSecretFood } from './fatsecret';
export { createRateLimiter, RateLimiter } from './rate-limiter';

function generateId(): string {
  return `nu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapFoodToSearchResult(
  food: Food,
  rawJson: string | null,
): FoodSearchResult {
  return {
    name: food.name,
    brand: food.brand,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    fiberG: food.fiberG,
    sugarG: food.sugarG,
    sodiumMg: food.sodiumMg,
    barcode: food.barcode,
    source: food.source === 'fatsecret' ? 'fatsecret' : 'open_food_facts',
    rawJson: rawJson ?? '',
    attribution:
      food.source === 'fatsecret'
        ? 'FatSecret nutrition data'
        : 'Data from Open Food Facts (openfoodfacts.org), licensed under ODbL',
  };
}

/**
 * Cache an API food result into nu_foods and nu_barcode_cache.
 * Returns the food ID.
 */
function cacheAPIResult(db: DatabaseAdapter, result: FoodSearchResult): string {
  const id = generateId();
  createFood(db, id, {
    name: result.name,
    brand: result.brand ?? undefined,
    servingSize: result.servingSize,
    servingUnit: result.servingUnit,
    calories: result.calories,
    proteinG: result.proteinG,
    carbsG: result.carbsG,
    fatG: result.fatG,
    fiberG: result.fiberG,
    sugarG: result.sugarG,
    sodiumMg: result.sodiumMg,
    source: result.source,
    barcode: result.barcode ?? undefined,
  });

  if (result.barcode) {
    // Cache barcode for 30 days
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setCachedBarcode(db, result.barcode, {
      foodId: id,
      source: result.source,
      rawJson: result.rawJson,
      expiresAt,
    });
  }

  return id;
}

/**
 * Unified food search: local first, then APIs.
 * Caches all API results in SQLite immediately.
 * Never throws -- returns empty array on failure.
 */
export async function searchFoodUnified(
  db: DatabaseAdapter,
  options: APIFoodSearchOptions,
): Promise<Food[]> {
  const { query, limit = 50, source = 'all' } = options;

  // 1. Local search (always first)
  const localResults = searchLocalFoods(db, query, { limit, source: 'all' });

  // If source is not 'all' and matches a local-only type, or we have enough results, return early
  if (localResults.length >= limit) return localResults;

  // 2. Try Open Food Facts (if applicable)
  if (source === 'all' || source === 'open_food_facts') {
    try {
      const offResults = await searchOFF(query, 1, limit - localResults.length);
      for (const result of offResults) {
        cacheAPIResult(db, result);
      }
    } catch {
      // Graceful degradation
    }
  }

  // 3. Try FatSecret (fallback)
  if (source === 'all' || source === 'fatsecret') {
    try {
      const fsResults = await searchFatSecret(db, query, 0, limit - localResults.length);
      for (const result of fsResults) {
        cacheAPIResult(db, result);
      }
    } catch {
      // Graceful degradation
    }
  }

  // 4. Re-query local to include freshly cached results
  return searchLocalFoods(db, query, { limit, source: 'all' });
}

/**
 * Look up a barcode: cache -> OFF -> FatSecret.
 * Caches result in SQLite. Never throws.
 */
export async function lookupBarcode(
  db: DatabaseAdapter,
  barcode: string,
): Promise<BarcodeResult> {
  // 1. Check local cache
  const cached = getCachedBarcode(db, barcode);
  if (cached && cached.foodId) {
    const cachedFood = getFoodById(db, cached.foodId);
    return {
      found: true,
      food: cachedFood ? mapFoodToSearchResult(cachedFood, cached.rawJson) : null,
      source: 'cache',
    };
  }

  // 2. Try Open Food Facts
  try {
    const offResult = await lookupBarcodeOFF(barcode);
    if (offResult) {
      cacheAPIResult(db, offResult);
      return { found: true, food: offResult, source: 'open_food_facts' };
    }
  } catch {
    // Fall through
  }

  // 3. Try FatSecret (no barcode endpoint in basic tier, but cache empty result)
  setCachedBarcode(db, barcode, {
    source: 'not_found',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return { found: false, food: null, source: null };
}
