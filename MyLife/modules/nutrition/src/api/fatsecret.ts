import type { DatabaseAdapter } from '@mylife/db';
import type { FoodSearchResult } from './types';
import { createRateLimiter } from './rate-limiter';
import { getSetting } from '../db/settings';

const FS_API_BASE = 'https://platform.fatsecret.com/rest';
const FS_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';

// 5000 calls/day = ~0.058/sec, but burst-friendly
const limiter = createRateLimiter(50, 0.058);

let cachedToken: { token: string; expiresAt: number } | null = null;

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Get OAuth 2.0 access token using client credentials.
 */
async function getAccessToken(db: DatabaseAdapter): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = getSetting(db, 'fatsecret_client_id');
  const clientSecret = getSetting(db, 'fatsecret_client_secret');
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(FS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=basic`,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return cachedToken.token;
  } catch {
    return null;
  }
}

function parseFSFood(food: Record<string, unknown>): FoodSearchResult | null {
  const name = food.food_name as string;
  if (!name) return null;

  const description = (food.food_description as string) || '';
  // FatSecret format: "Per 100g - Calories: 120kcal | Fat: 2.60g | Carbs: 0.00g | Protein: 22.50g"
  const calMatch = description.match(/Calories:\s*([\d.]+)/);
  const fatMatch = description.match(/Fat:\s*([\d.]+)/);
  const carbMatch = description.match(/Carbs:\s*([\d.]+)/);
  const proteinMatch = description.match(/Protein:\s*([\d.]+)/);

  return {
    name,
    brand: (food.brand_name as string) || null,
    servingSize: 100,
    servingUnit: 'g',
    calories: calMatch ? parseNumber(calMatch[1]) : 0,
    proteinG: proteinMatch ? parseNumber(proteinMatch[1]) : 0,
    carbsG: carbMatch ? parseNumber(carbMatch[1]) : 0,
    fatG: fatMatch ? parseNumber(fatMatch[1]) : 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
    barcode: null,
    source: 'fatsecret',
    rawJson: JSON.stringify(food),
    attribution: null,
  };
}

/**
 * Search FatSecret by text query.
 */
export async function searchFatSecret(
  db: DatabaseAdapter,
  query: string,
  page = 0,
  limit = 20,
): Promise<FoodSearchResult[]> {
  const token = await getAccessToken(db);
  if (!token) return [];

  if (!limiter.tryConsume()) {
    await limiter.waitForToken();
  }

  try {
    const url = `${FS_API_BASE}/foods/search/v1?search_expression=${encodeURIComponent(query)}&page_number=${page}&max_results=${limit}&format=json`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { foods_search?: { results?: { food?: Record<string, unknown>[] } } };
    const foods = data.foods_search?.results?.food;
    if (!foods) return [];

    return foods
      .map((f) => parseFSFood(f))
      .filter((r): r is FoodSearchResult => r !== null);
  } catch {
    return [];
  }
}

/**
 * Look up a specific food by FatSecret food_id.
 */
export async function lookupFatSecretFood(
  db: DatabaseAdapter,
  foodId: string,
): Promise<FoodSearchResult | null> {
  const token = await getAccessToken(db);
  if (!token) return null;

  if (!limiter.tryConsume()) {
    await limiter.waitForToken();
  }

  try {
    const url = `${FS_API_BASE}/food/v4?food_id=${encodeURIComponent(foodId)}&format=json`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { food?: Record<string, unknown> };
    if (!data.food) return null;

    return parseFSFood(data.food);
  } catch {
    return null;
  }
}
