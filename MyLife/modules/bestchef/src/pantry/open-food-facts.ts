import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GrocerySection,
  NutritionBreakdown,
  NutritionProviderAdapter,
  NutritionProviderResult,
  NutritionProviderStatus,
} from '../types';
import { callNutritionBroker, type BrokerNutritionSource } from '../cloud/provider-broker';

const OFF_API_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const USER_AGENT = 'MyRecipes/1.0 (privacy-first recipe app)';
const TIMEOUT_MS = 10_000;

type FetchLike = typeof fetch;

/** Zod schema for Open Food Facts API response (lenient parsing). */
const OffProductSchema = z.object({
  code: z.string(),
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional().default(''),
      brands: z.string().optional().default(''),
      categories_tags: z.array(z.string()).optional().default([]),
      nutriments: z
        .object({
          'energy-kcal_100g': z.number().optional(),
          fat_100g: z.number().optional(),
          'saturated-fat_100g': z.number().optional(),
          carbohydrates_100g: z.number().optional(),
          fiber_100g: z.number().optional(),
          sugars_100g: z.number().optional(),
          proteins_100g: z.number().optional(),
          sodium_100g: z.number().optional(),
        })
        .optional()
        .default({}),
      serving_size: z.string().optional(),
      image_url: z.string().optional(),
    })
    .optional(),
});

export interface OffNutritionData {
  source: 'open_food_facts';
  source_id: string;
  barcode: string;
  product_name: string | null;
  brand: string | null;
  serving_size_text: string | null;
  serving_basis: 'per_100g';
  confidence: number;
  calories: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  protein_g: number | null;
  sodium_mg: number | null;
}

export interface OffLookupResult {
  found: boolean;
  productName: string | null;
  brand: string | null;
  category: GrocerySection;
  nutrition: OffNutritionData | null;
  imageUrl: string | null;
}

export const NOT_FOUND: OffLookupResult = {
  found: false,
  productName: null,
  brand: null,
  category: 'other',
  nutrition: null,
  imageUrl: null,
};

function emptyNutrients(): NutritionBreakdown {
  return {
    calories: null,
    fat_g: null,
    saturated_fat_g: null,
    carbs_g: null,
    fiber_g: null,
    sugar_g: null,
    protein_g: null,
    sodium_mg: null,
  };
}

/**
 * Look up a barcode via the Open Food Facts API.
 * Only called on explicit user action (barcode scan).
 * Returns product info and nutrition data when available.
 */
export async function lookupBarcode(
  barcode: string,
  fetchImpl: FetchLike = fetch,
): Promise<OffLookupResult> {
  let response: Response;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    response = await fetchImpl(`${OFF_API_BASE}/${barcode}.json`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    clearTimeout(timer);
  } catch {
    return NOT_FOUND;
  }

  if (!response.ok) return NOT_FOUND;

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return NOT_FOUND;
  }

  const parsed = OffProductSchema.safeParse(json);
  if (!parsed.success || !parsed.data.product || parsed.data.status !== 1) {
    return NOT_FOUND;
  }

  const { product } = parsed.data;
  const productName = product.product_name || null;
  const brand = product.brands || null;
  const category = mapOffCategoryToSection(product.categories_tags);
  const imageUrl = product.image_url ?? null;

  const n = product.nutriments;
  const hasAnyNutrition =
    n['energy-kcal_100g'] !== undefined ||
    n.fat_100g !== undefined ||
    n.proteins_100g !== undefined ||
    n.carbohydrates_100g !== undefined;

  const nutrition: OffNutritionData | null = hasAnyNutrition
    ? {
        source: 'open_food_facts',
        source_id: barcode,
        barcode,
        product_name: productName,
        brand,
        serving_size_text: product.serving_size ?? null,
        serving_basis: 'per_100g',
        confidence: 0.8,
        calories: n['energy-kcal_100g'] ?? null,
        fat_g: n.fat_100g ?? null,
        saturated_fat_g: n['saturated-fat_100g'] ?? null,
        carbs_g: n.carbohydrates_100g ?? null,
        fiber_g: n.fiber_100g ?? null,
        sugar_g: n.sugars_100g ?? null,
        protein_g: n.proteins_100g ?? null,
        sodium_mg:
          n.sodium_100g !== undefined
            ? Math.round(n.sodium_100g * 1000)
            : null,
      }
    : null;

  return {
    found: true,
    productName,
    brand,
    category,
    nutrition,
    imageUrl,
  };
}

export function offLookupToProviderResult(
  barcode: string,
  result: OffLookupResult,
): NutritionProviderResult | null {
  if (!result.found) return null;

  if (!result.nutrition) {
    return {
      source: 'open_food_facts',
      source_id: barcode,
      source_url: `https://world.openfoodfacts.org/product/${barcode}`,
      barcode,
      product_name: result.productName,
      brand: result.brand,
      serving_size_text: null,
      serving_basis: 'per_item',
      serving_quantity: 1,
      serving_unit: 'item',
      nutrients: emptyNutrients(),
      confidence: 0.35,
      quality_flags: ['Open Food Facts product found, but no usable nutrition facts were returned'],
    };
  }

  return {
    source: result.nutrition.source,
    source_id: result.nutrition.source_id,
    source_url: `https://world.openfoodfacts.org/product/${barcode}`,
    barcode,
    product_name: result.nutrition.product_name,
    brand: result.nutrition.brand,
    serving_size_text: result.nutrition.serving_size_text,
    serving_basis: result.nutrition.serving_basis,
    serving_quantity: 100,
    serving_unit: 'g',
    nutrients: {
      calories: result.nutrition.calories,
      fat_g: result.nutrition.fat_g,
      saturated_fat_g: result.nutrition.saturated_fat_g,
      carbs_g: result.nutrition.carbs_g,
      fiber_g: result.nutrition.fiber_g,
      sugar_g: result.nutrition.sugar_g,
      protein_g: result.nutrition.protein_g,
      sodium_mg: result.nutrition.sodium_mg,
    },
    confidence: result.nutrition.confidence,
  };
}

export function createOpenFoodFactsNutritionAdapter(
  fetchImpl: FetchLike = fetch,
): NutritionProviderAdapter {
  return {
    source: 'open_food_facts',
    async search(input) {
      if (!input.barcode) {
        return {
          candidates: [],
          status: {
            source: 'open_food_facts',
            status: 'skipped',
            message: 'Open Food Facts lookup requires a barcode.',
          },
        };
      }

      const result = await lookupBarcode(input.barcode, fetchImpl);
      const candidate = offLookupToProviderResult(input.barcode, result);
      return {
        candidates: candidate ? [candidate] : [],
        status: {
          source: 'open_food_facts',
          status: 'ok',
          message: candidate ? 'Open Food Facts candidate returned.' : 'No Open Food Facts product found.',
        },
      };
    },
  };
}

const UsdaFoodSearchSchema = z.object({
  foods: z.array(
    z.object({
      fdcId: z.number(),
      description: z.string(),
      brandName: z.string().optional(),
      gtinUpc: z.string().optional(),
      dataType: z.string().optional(),
      servingSize: z.number().optional(),
      servingSizeUnit: z.string().optional(),
      foodNutrients: z
        .array(
          z.object({
            nutrientName: z.string().optional(),
            unitName: z.string().optional(),
            value: z.number().optional(),
          }),
        )
        .optional()
        .default([]),
    }),
  ),
});

function findUsdaNutrient(
  nutrients: Array<{ nutrientName?: string; unitName?: string; value?: number }>,
  match: RegExp,
): number | null {
  const nutrient = nutrients.find((entry) => entry.nutrientName && match.test(entry.nutrientName));
  return nutrient?.value ?? null;
}

function mapUsdaFoodToProviderResult(food: z.infer<typeof UsdaFoodSearchSchema>['foods'][number]): NutritionProviderResult {
  const sodium = findUsdaNutrient(food.foodNutrients, /^Sodium/i);
  const dataType = food.dataType ?? 'FoodData Central';
  return {
    source: 'usda_fdc',
    source_id: String(food.fdcId),
    source_url: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`,
    barcode: food.gtinUpc ?? null,
    product_name: food.description,
    brand: food.brandName ?? null,
    serving_size_text: food.servingSize && food.servingSizeUnit ? `${food.servingSize} ${food.servingSizeUnit}` : null,
    serving_basis: 'per_100g',
    serving_quantity: 100,
    serving_unit: 'g',
    nutrients: {
      calories: findUsdaNutrient(food.foodNutrients, /^Energy/i),
      fat_g: findUsdaNutrient(food.foodNutrients, /Total lipid|Total fat/i),
      saturated_fat_g: findUsdaNutrient(food.foodNutrients, /saturated/i),
      carbs_g: findUsdaNutrient(food.foodNutrients, /Carbohydrate/i),
      fiber_g: findUsdaNutrient(food.foodNutrients, /Fiber/i),
      sugar_g: findUsdaNutrient(food.foodNutrients, /Sugars/i),
      protein_g: findUsdaNutrient(food.foodNutrients, /^Protein/i),
      sodium_mg: sodium,
    },
    confidence: dataType.toLowerCase().includes('foundation') ? 0.9 : 0.84,
    quality_flags: dataType.toLowerCase().includes('branded')
      ? ['USDA Branded Foods are label-based and may differ from analyzed generic foods']
      : [],
  };
}

export interface UsdaFoodDataCentralAdapterOptions {
  apiKey?: string | null;
  fetch?: FetchLike;
  endpoint?: string;
}

export function createUsdaFoodDataCentralAdapter(
  options: UsdaFoodDataCentralAdapterOptions = {},
): NutritionProviderAdapter {
  const fetchImpl = options.fetch ?? fetch;
  const endpoint = options.endpoint ?? 'https://api.nal.usda.gov/fdc/v1';

  return {
    source: 'usda_fdc',
    async search(input) {
      if (!options.apiKey) {
        return {
          candidates: [],
          status: {
            source: 'usda_fdc',
            status: 'not_configured',
            message: 'USDA FoodData Central requires a data.gov API key. No live request was made.',
          },
        };
      }

      const query = (input.query || input.barcode || '').trim();
      if (!query) {
        return {
          candidates: [],
          status: {
            source: 'usda_fdc',
            status: 'skipped',
            message: 'USDA FoodData Central lookup requires a query or barcode.',
          },
        };
      }

      const response = await fetchImpl(`${endpoint}/foods/search?api_key=${encodeURIComponent(options.apiKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          query,
          pageSize: 5,
          dataType: ['Foundation', 'Survey (FNDDS)', 'SR Legacy', 'Branded'],
          brandOwner: input.brand ?? undefined,
        }),
      });

      if (!response.ok) {
        const status: NutritionProviderStatus = {
          source: 'usda_fdc',
          status: response.status === 429 ? 'rate_limited' : 'error',
          message: `USDA FoodData Central request failed with HTTP ${response.status}.`,
        };
        return { candidates: [], status };
      }

      const parsed = UsdaFoodSearchSchema.safeParse(await response.json());
      if (!parsed.success) {
        return {
          candidates: [],
          status: {
            source: 'usda_fdc',
            status: 'error',
            message: 'USDA FoodData Central response did not match the expected search shape.',
          },
        };
      }

      return {
        candidates: parsed.data.foods.map(mapUsdaFoodToProviderResult),
        status: {
          source: 'usda_fdc',
          status: 'ok',
          message: `USDA FoodData Central returned ${parsed.data.foods.length} candidate(s).`,
        },
      };
    },
  };
}

/**
 * Nutrition adapter backed by the BestChef nutrition broker. Public
 * launch builds use this adapter so USDA / OFF credentials stay
 * server-side. The broker normalizes USDA vs OFF responses into the
 * shared `NutritionProviderResult` shape.
 */
export function createBrokerNutritionAdapter(
  supabase: SupabaseClient,
  source: BrokerNutritionSource,
): NutritionProviderAdapter {
  return {
    source,
    async search(input) {
      if (source === 'open_food_facts' && !input.barcode) {
        return {
          candidates: [],
          status: {
            source,
            status: 'skipped',
            message: 'Open Food Facts lookup requires a barcode.',
          },
        };
      }

      const result = await callNutritionBroker(supabase, {
        source,
        barcode: input.barcode ?? null,
        query: input.query ?? null,
        brand: input.brand ?? null,
      });

      if (!result.ok) {
        return {
          candidates: [],
          status: {
            source,
            status: result.errorKind === 'rate_limit' ? 'rate_limited' : 'error',
            message: result.message,
          },
        };
      }

      const code = result.data.status.code;
      const status: NutritionProviderStatus = {
        source,
        status:
          code === 'ok'
            ? 'ok'
            : code === 'skipped'
              ? 'skipped'
              : code === 'not_configured'
                ? 'not_configured'
                : code === 'rate_limited'
                  ? 'rate_limited'
                  : 'error',
        message: result.data.status.message,
      };

      const candidates: NutritionProviderResult[] = result.data.candidates.map((entry) => ({
        source: entry.source,
        source_id: entry.source_id,
        source_url: entry.source_url,
        barcode: entry.barcode,
        product_name: entry.product_name,
        brand: entry.brand,
        serving_size_text: entry.serving_size_text,
        serving_basis: entry.serving_basis,
        serving_quantity: entry.serving_quantity,
        serving_unit: entry.serving_unit,
        nutrients: entry.nutrients,
        confidence: entry.confidence,
        quality_flags: entry.quality_flags,
      }));

      return { candidates, status };
    },
  };
}

export interface Gs1DataHubAdapterOptions {
  apiKey?: string | null;
  endpoint?: string | null;
}

export function createGs1DataHubIdentityAdapter(
  options: Gs1DataHubAdapterOptions = {},
): NutritionProviderAdapter {
  return {
    source: 'gs1',
    async search(input) {
      if (!input.barcode) {
        return {
          candidates: [],
          status: {
            source: 'gs1',
            status: 'skipped',
            message: 'GS1 identity lookup requires a GTIN or UPC barcode.',
          },
        };
      }

      if (!options.apiKey || !options.endpoint) {
        return {
          candidates: [],
          status: {
            source: 'gs1',
            status: 'not_configured',
            message: 'GS1 US Data Hub access requires a paid subscription, API add-on, endpoint, and API key. No live request was made.',
          },
        };
      }

      return {
        candidates: [],
        status: {
          source: 'gs1',
          status: 'skipped',
          message: 'GS1 adapter is configured as an identity stub until legal and subscription terms approve live product metadata use.',
        },
      };
    },
  };
}

/** Category tag prefixes mapped to grocery sections. */
const CATEGORY_MAP: ReadonlyArray<[string, GrocerySection]> = [
  ['en:dairies', 'dairy'],
  ['en:milks', 'dairy'],
  ['en:cheeses', 'dairy'],
  ['en:yogurts', 'dairy'],
  ['en:butters', 'dairy'],
  ['en:meats', 'meat'],
  ['en:poultry', 'meat'],
  ['en:fishes', 'meat'],
  ['en:seafoods', 'meat'],
  ['en:fruits', 'produce'],
  ['en:vegetables', 'produce'],
  ['en:fresh-foods', 'produce'],
  ['en:frozen-foods', 'frozen'],
  ['en:frozen', 'frozen'],
  ['en:breads', 'bakery'],
  ['en:pastries', 'bakery'],
  ['en:baked-goods', 'bakery'],
  ['en:beverages', 'beverages'],
  ['en:drinks', 'beverages'],
  ['en:waters', 'beverages'],
  ['en:juices', 'beverages'],
  ['en:sodas', 'beverages'],
  ['en:coffees', 'beverages'],
  ['en:teas', 'beverages'],
  ['en:snacks', 'snacks'],
  ['en:chips', 'snacks'],
  ['en:crackers', 'snacks'],
  ['en:chocolates', 'snacks'],
  ['en:candies', 'snacks'],
  ['en:sauces', 'condiments'],
  ['en:condiments', 'condiments'],
  ['en:mustards', 'condiments'],
  ['en:ketchups', 'condiments'],
  ['en:dressings', 'condiments'],
  ['en:vinegars', 'condiments'],
  ['en:spices', 'pantry'],
  ['en:cereals', 'pantry'],
  ['en:pastas', 'pantry'],
  ['en:rices', 'pantry'],
  ['en:canned-foods', 'pantry'],
  ['en:oils', 'pantry'],
  ['en:flours', 'pantry'],
  ['en:sugars', 'pantry'],
  ['en:legumes', 'pantry'],
  ['en:nuts', 'pantry'],
];

/**
 * Map Open Food Facts category tags to our 10 grocery sections.
 * Checks each tag against known prefixes and returns the first match.
 * Defaults to 'other' if no match found.
 */
export function mapOffCategoryToSection(tags: string[]): GrocerySection {
  for (const tag of tags) {
    for (const [prefix, section] of CATEGORY_MAP) {
      if (tag === prefix || tag.startsWith(prefix + ':')) {
        return section;
      }
    }
  }
  return 'other';
}
