/**
 * BestChef nutrition broker Edge Function.
 *
 * Routes nutrition lookups to USDA FoodData Central (paid key) and
 * Open Food Facts (keyless, User-Agent only). Provider credentials live
 * in `Deno.env`; never in the Expo bundle. Receipt-derived inputs are
 * redacted at the call site before reaching this function — the function
 * itself only forwards `query`/`brand`/`barcode`.
 */

import {
  classifyUpstreamStatus,
  createInMemoryRateLimiter,
  createServiceQuotaCheck,
  envelopeError,
  envelopeOk,
  getUserIdFromAuth,
  isAnonymousAuth,
  isProviderKillSwitchEnabled,
  type BrokerDeps,
} from '../_shared/broker.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

const USDA_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1';
const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const NUTRITION_RATE_LIMIT = { max: 60, windowMs: 60_000 };
/** Anonymous sessions are free to mint; give them a third of the window. */
const NUTRITION_ANON_MAX = 20;

interface NutritionRequestBody {
  source?: string;
  barcode?: string;
  query?: string;
  brand?: string;
}

interface BrokerNutritionCandidate {
  source: string;
  source_id: string;
  source_url: string | null;
  barcode: string | null;
  product_name: string | null;
  brand: string | null;
  serving_size_text: string | null;
  serving_basis: 'per_100g' | 'per_item' | 'per_serving';
  serving_quantity: number;
  serving_unit: string;
  nutrients: {
    calories: number | null;
    fat_g: number | null;
    saturated_fat_g: number | null;
    carbs_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    protein_g: number | null;
    sodium_mg: number | null;
  };
  confidence: number;
  quality_flags?: string[];
}

interface NutritionResponse {
  candidates: BrokerNutritionCandidate[];
  status: { code: 'ok' | 'skipped' | 'not_configured' | 'error' | 'rate_limited'; message: string };
}

function findUsdaNutrient(
  nutrients: Array<{ nutrientName?: string; unitName?: string; value?: number }> | undefined,
  match: RegExp,
): number | null {
  if (!Array.isArray(nutrients)) return null;
  const n = nutrients.find((entry) => entry.nutrientName && match.test(entry.nutrientName));
  return n?.value ?? null;
}

function mapUsdaFood(food: {
  fdcId: number;
  description: string;
  brandName?: string;
  gtinUpc?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: Array<{ nutrientName?: string; unitName?: string; value?: number }>;
}): BrokerNutritionCandidate {
  const sodium = findUsdaNutrient(food.foodNutrients, /^Sodium/i);
  const dataType = food.dataType ?? 'FoodData Central';
  return {
    source: 'usda_fdc',
    source_id: String(food.fdcId),
    source_url: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`,
    barcode: food.gtinUpc ?? null,
    product_name: food.description,
    brand: food.brandName ?? null,
    serving_size_text:
      food.servingSize && food.servingSizeUnit ? `${food.servingSize} ${food.servingSizeUnit}` : null,
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

async function lookupUsda(
  body: NutritionRequestBody,
  deps: BrokerDeps,
): Promise<NutritionResponse | { status: number; failure: NutritionResponse }> {
  const apiKey = deps.env('USDA_FDC_API_KEY');
  if (!apiKey) {
    return {
      candidates: [],
      status: { code: 'not_configured', message: 'USDA FDC API key is not configured.' },
    };
  }
  const query = (body.query || body.barcode || '').trim();
  if (!query) {
    return {
      candidates: [],
      status: { code: 'skipped', message: 'USDA lookup requires a query or barcode.' },
    };
  }

  let upstream: Response;
  try {
    upstream = await deps.fetch(`${USDA_ENDPOINT}/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BestChef/1.0 (privacy-first nutrition broker)',
      },
      body: JSON.stringify({
        query,
        pageSize: 5,
        dataType: ['Foundation', 'Survey (FNDDS)', 'SR Legacy', 'Branded'],
        brandOwner: body.brand ?? undefined,
      }),
    });
  } catch (err) {
    return {
      candidates: [],
      status: {
        code: 'error',
        message: err instanceof Error ? err.message : 'USDA upstream unreachable.',
      },
    };
  }

  if (!upstream.ok) {
    return {
      candidates: [],
      status: {
        code: upstream.status === 429 ? 'rate_limited' : 'error',
        message: `USDA returned HTTP ${upstream.status}.`,
      },
    };
  }

  const json = (await upstream.json().catch(() => null)) as { foods?: unknown } | null;
  const foods = Array.isArray(json?.foods) ? (json!.foods as Array<Parameters<typeof mapUsdaFood>[0]>) : [];
  return {
    candidates: foods.map(mapUsdaFood),
    status: { code: 'ok', message: `USDA returned ${foods.length} candidate(s).` },
  };
}

interface OffApiProduct {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  image_url?: string;
  nutriments?: Record<string, number | undefined>;
}

async function lookupOpenFoodFacts(
  body: NutritionRequestBody,
  deps: BrokerDeps,
): Promise<NutritionResponse> {
  const barcode = body.barcode?.trim();
  if (!barcode) {
    return {
      candidates: [],
      status: { code: 'skipped', message: 'Open Food Facts requires a barcode.' },
    };
  }
  const userAgent = deps.env('OPEN_FOOD_FACTS_USER_AGENT') ?? 'BestChef/1.0 (broker)';
  let upstream: Response;
  try {
    upstream = await deps.fetch(`${OFF_ENDPOINT}/${encodeURIComponent(barcode)}.json`, {
      headers: { 'User-Agent': userAgent },
    });
  } catch (err) {
    return {
      candidates: [],
      status: {
        code: 'error',
        message: err instanceof Error ? err.message : 'OFF upstream unreachable.',
      },
    };
  }

  if (!upstream.ok) {
    return {
      candidates: [],
      status: {
        code: upstream.status === 429 ? 'rate_limited' : 'error',
        message: `OFF returned HTTP ${upstream.status}.`,
      },
    };
  }

  const json = (await upstream.json().catch(() => null)) as
    | { status?: number; product?: OffApiProduct }
    | null;
  if (!json || json.status !== 1 || !json.product) {
    return {
      candidates: [],
      status: { code: 'ok', message: 'No Open Food Facts product found.' },
    };
  }
  const product = json.product;
  const n = product.nutriments ?? {};
  const candidate: BrokerNutritionCandidate = {
    source: 'open_food_facts',
    source_id: barcode,
    source_url: `https://world.openfoodfacts.org/product/${barcode}`,
    barcode,
    product_name: product.product_name ?? null,
    brand: product.brands ?? null,
    serving_size_text: product.serving_size ?? null,
    serving_basis: 'per_100g',
    serving_quantity: 100,
    serving_unit: 'g',
    nutrients: {
      calories: n['energy-kcal_100g'] ?? null,
      fat_g: n.fat_100g ?? null,
      saturated_fat_g: n['saturated-fat_100g'] ?? null,
      carbs_g: n.carbohydrates_100g ?? null,
      fiber_g: n.fiber_100g ?? null,
      sugar_g: n.sugars_100g ?? null,
      protein_g: n.proteins_100g ?? null,
      sodium_mg: n.sodium_100g !== undefined ? Math.round(n.sodium_100g * 1000) : null,
    },
    confidence: 0.8,
  };
  return {
    candidates: [candidate],
    status: { code: 'ok', message: 'Open Food Facts candidate returned.' },
  };
}

export async function handleNutritionRequest(
  req: Request,
  deps: BrokerDeps,
): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  const userId = getUserIdFromAuth(authHeader);
  if (!userId) {
    return envelopeError('auth', 'Missing or invalid Authorization header.', 401);
  }
  if (isProviderKillSwitchEnabled(deps.env)) {
    return envelopeError('provider_outage', 'Nutrition broker is temporarily disabled.', 503, 'usda');
  }
  const quotaMax = isAnonymousAuth(authHeader) ? NUTRITION_ANON_MAX : NUTRITION_RATE_LIMIT.max;
  if (
    !deps.rateLimit.consume(
      userId,
      'nutrition',
      quotaMax,
      NUTRITION_RATE_LIMIT.windowMs,
    )
  ) {
    return envelopeError('rate_limit', 'Nutrition broker rate limit exceeded.', 429);
  }
  const quota = await deps.quota(userId, 'nutrition', quotaMax, NUTRITION_RATE_LIMIT.windowMs);
  if (!quota.allowed) {
    if (quota.reason === 'user_rate_limit' || quota.reason === 'global_daily_cap') {
      return envelopeError('rate_limit', 'Nutrition broker quota exceeded.', 429);
    }
    return envelopeError('provider_outage', 'Nutrition broker is temporarily unavailable.', 503, 'usda');
  }

  let body: NutritionRequestBody;
  try {
    body = (await req.json()) as NutritionRequestBody;
  } catch {
    return envelopeError('invalid_input', 'Request body must be valid JSON.', 400);
  }

  if (body.source !== 'usda_fdc' && body.source !== 'open_food_facts') {
    return envelopeError('invalid_input', 'Unsupported nutrition source.', 400);
  }

  let response: NutritionResponse;
  try {
    response = body.source === 'usda_fdc'
      ? await lookupUsda(body, deps) as NutritionResponse
      : await lookupOpenFoodFacts(body, deps);
  } catch (err) {
    const failure = err instanceof Response ? classifyUpstreamStatus(err.status) : null;
    if (failure) {
      return envelopeError(failure.errorKind, failure.message, failure.status, body.source);
    }
    return envelopeError(
      'provider_outage',
      err instanceof Error ? err.message : 'Nutrition broker failed.',
      503,
      body.source,
    );
  }

  return envelopeOk({
    provider: body.source,
    source: body.source,
    confidence: response.candidates[0]?.confidence ?? null,
    data: response,
  });
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const rateLimit = createInMemoryRateLimiter();
  const denoEnv = Deno.env;
  const env = (key: string) => denoEnv.get(key);
  const quota = createServiceQuotaCheck(env, fetch);
  Deno.serve((req) =>
    handleNutritionRequest(req, {
      env,
      fetch,
      now: () => Date.now(),
      rateLimit,
      quota,
    }),
  );
}
