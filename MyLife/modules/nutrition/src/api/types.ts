/** Normalized food result from any external API source. */
export interface FoodSearchResult {
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  barcode: string | null;
  source: 'open_food_facts' | 'fatsecret';
  /** Raw JSON response for caching. */
  rawJson: string;
  /** Attribution text required by the data source. */
  attribution: string | null;
}

export interface APIFoodSearchOptions {
  query: string;
  page?: number;
  limit?: number;
  source?: 'open_food_facts' | 'fatsecret' | 'all';
}

export interface BarcodeResult {
  found: boolean;
  food: FoodSearchResult | null;
  source: 'cache' | 'open_food_facts' | 'fatsecret' | null;
}

export interface RateLimitConfig {
  /** Maximum number of tokens in the bucket. */
  maxTokens: number;
  /** Tokens added per second. */
  refillRate: number;
}
