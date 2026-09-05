/**
 * Grocery delivery provider abstraction.
 *
 * Supports Instacart, Amazon Fresh, and Walmart as delivery providers.
 * Product search and checkout are stub implementations (real API integration later).
 * Cart building and pantry subtraction are pure functions.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';
import { fuzzyItemMatch } from '../pantry/name-normalizer';
import type { PantryItem } from '../types';

// ── Types ─────────────────────────────────────────────────────────────

export type GroceryProvider = 'instacart' | 'amazon_fresh' | 'walmart';

export interface ProductMatch {
  providerId: string;
  providerName: GroceryProvider;
  productName: string;
  brandName: string | null;
  price: number | null;
  unit: string | null;
  imageUrl: string | null;
  affiliateUrl: string;
  confidence: number; // 0-1 match confidence
}

export interface CartItem {
  ingredientName: string;
  quantity: number;
  unit: string;
  matchedProduct: ProductMatch | null;
  inPantry: boolean;
}

export interface DeliveryCart {
  provider: GroceryProvider;
  items: CartItem[];
  estimatedTotal: number | null;
  checkoutUrl: string;
  affiliateTrackingId: string;
}

export interface ProviderAvailability {
  provider: GroceryProvider;
  available: boolean;
  zipCode: string;
}

export interface SearchProductsOptions {
  limit?: number;
  zipCode?: string;
}

export interface BuildCartOptions {
  subtractPantry?: PantryItem[];
  zipCode?: string;
}

export interface RecipeIngredientInput {
  name: string;
  quantity: number;
  unit: string;
}

export interface AffiliateOrder {
  orderId: string;
  provider: GroceryProvider;
  chefId: string | null;
  recipeId: string | null;
  trackingId: string;
  estimatedRevenueCents: number;
  createdAt: Date;
}

export interface AffiliateRevenueSummary {
  totalOrders: number;
  totalRevenueCents: number;
  byProvider: Record<GroceryProvider, number>;
}

// ── Provider Config ───────────────────────────────────────────────────

export interface ProviderConfig {
  name: string;
  color: string;
  affiliatePrefix: string;
}

export const PROVIDER_CONFIGS: Record<GroceryProvider, ProviderConfig> = {
  instacart: { name: 'Instacart', color: '#43B02A', affiliatePrefix: 'bc_inst_' },
  amazon_fresh: { name: 'Amazon Fresh', color: '#FF9900', affiliatePrefix: 'bc_amzn_' },
  walmart: { name: 'Walmart', color: '#0071CE', affiliatePrefix: 'bc_wmt_' },
};

const ALL_PROVIDERS: GroceryProvider[] = ['instacart', 'amazon_fresh', 'walmart'];

// ── Pure Functions ────────────────────────────────────────────────────

export function getProviderConfig(provider: GroceryProvider): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

/**
 * Generate an affiliate tracking ID for a given provider.
 * Format: `{affiliatePrefix}{timestamp}_{random}`
 */
export function generateAffiliateTrackingId(provider: GroceryProvider): string {
  const config = PROVIDER_CONFIGS[provider];
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${config.affiliatePrefix}${ts}_${rand}`;
}

/**
 * Generate a checkout URL for a provider with affiliate tracking.
 */
export function generateCheckoutUrl(
  provider: GroceryProvider,
  trackingId: string,
): string {
  const baseUrls: Record<GroceryProvider, string> = {
    instacart: 'https://www.instacart.com/store/checkout',
    amazon_fresh: 'https://www.amazon.com/alm/storefront',
    walmart: 'https://www.walmart.com/cart',
  };
  return `${baseUrls[provider]}?ref=${trackingId}`;
}

/**
 * Compute estimated cart total from matched products.
 * Returns null if any product has no price.
 */
export function computeCartTotal(items: CartItem[]): number | null {
  const priced = items.filter((i) => !i.inPantry && i.matchedProduct !== null);
  if (priced.length === 0) return null;
  const allHavePrices = priced.every((i) => i.matchedProduct!.price !== null);
  if (!allHavePrices) return null;
  return priced.reduce((sum, i) => sum + (i.matchedProduct!.price ?? 0), 0);
}

/**
 * Check whether an ingredient is covered by pantry inventory.
 */
export function isInPantry(
  ingredientName: string,
  pantryItems: PantryItem[],
): boolean {
  return pantryItems.some(
    (p) => fuzzyItemMatch(ingredientName, p.name) >= 0.6,
  );
}

/**
 * Build cart items from recipe ingredients, optionally subtracting pantry stock.
 * Pure function: no network calls.
 */
export function buildCartItems(
  ingredients: RecipeIngredientInput[],
  products: Map<string, ProductMatch>,
  pantryItems: PantryItem[],
): CartItem[] {
  return ingredients.map((ing) => ({
    ingredientName: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    matchedProduct: products.get(ing.name) ?? null,
    inPantry: isInPantry(ing.name, pantryItems),
  }));
}

// ── Stub Implementations (API integration later) ──────────────────────

/**
 * Search a provider's product catalog for a query string.
 * Stub: returns a single synthetic match for now.
 */
export async function searchProducts(
  provider: GroceryProvider,
  query: string,
  options?: SearchProductsOptions,
): Promise<ProductMatch[]> {
  const _limit = options?.limit ?? 5;
  const trackingId = generateAffiliateTrackingId(provider);

  // Stub: return a single synthetic product match
  return [
    {
      providerId: `${provider}_${query.replace(/\s+/g, '_').toLowerCase()}`,
      providerName: provider,
      productName: query,
      brandName: null,
      price: null,
      unit: null,
      imageUrl: null,
      affiliateUrl: generateCheckoutUrl(provider, trackingId),
      confidence: 0.5,
    },
  ];
}

/**
 * Build a delivery cart from recipe ingredients.
 * Searches for product matches and optionally subtracts pantry items.
 */
export async function buildCart(
  provider: GroceryProvider,
  ingredients: RecipeIngredientInput[],
  options?: BuildCartOptions,
): Promise<DeliveryCart> {
  const pantryItems = options?.subtractPantry ?? [];
  const trackingId = generateAffiliateTrackingId(provider);

  // Search for product matches for each ingredient
  const productMap = new Map<string, ProductMatch>();
  for (const ing of ingredients) {
    const results = await searchProducts(provider, ing.name, {
      limit: 1,
      zipCode: options?.zipCode,
    });
    if (results.length > 0) {
      productMap.set(ing.name, results[0]);
    }
  }

  const items = buildCartItems(ingredients, productMap, pantryItems);
  const estimatedTotal = computeCartTotal(items);

  return {
    provider,
    items,
    estimatedTotal,
    checkoutUrl: generateCheckoutUrl(provider, trackingId),
    affiliateTrackingId: trackingId,
  };
}

/**
 * Generate an affiliate checkout URL for a provider with given cart items.
 */
export function getCheckoutUrl(
  provider: GroceryProvider,
  _cartItems: CartItem[],
): string {
  const trackingId = generateAffiliateTrackingId(provider);
  return generateCheckoutUrl(provider, trackingId);
}

/**
 * Check which grocery delivery providers are available in a zip code.
 * Stub: returns all providers as available for now.
 */
export async function checkProviderAvailability(
  zipCode: string,
): Promise<ProviderAvailability[]> {
  return ALL_PROVIDERS.map((provider) => ({
    provider,
    available: true,
    zipCode,
  }));
}

/**
 * Record an affiliate order for revenue tracking.
 * Persists to bc_affiliate_orders in Supabase.
 */
export async function trackAffiliateOrder(
  orderId: string,
  provider: GroceryProvider,
  chefId?: string,
  recipeId?: string,
): Promise<BestChefResult<AffiliateOrder>> {
  const supabase = getBestChefClient();
  const trackingId = generateAffiliateTrackingId(provider);

  const row = {
    order_id: orderId,
    provider,
    chef_id: chefId ?? null,
    recipe_id: recipeId ?? null,
    tracking_id: trackingId,
    estimated_revenue_cents: 0,
    created_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from('bc_affiliate_orders')
    .insert(row);

  if (insertError) return err(insertError.message);

  return ok({
    orderId,
    provider,
    chefId: chefId ?? null,
    recipeId: recipeId ?? null,
    trackingId,
    estimatedRevenueCents: 0,
    createdAt: new Date(),
  });
}

/**
 * Get aggregate affiliate revenue for a chef.
 */
export async function getAffiliateRevenue(
  chefId: string,
): Promise<BestChefResult<AffiliateRevenueSummary>> {
  const supabase = getBestChefClient();

  const { data, error: queryError } = await supabase
    .from('bc_affiliate_orders')
    .select('provider, estimated_revenue_cents')
    .eq('chef_id', chefId);

  if (queryError) return err(queryError.message);

  const rows = data ?? [];
  const byProvider: Record<GroceryProvider, number> = {
    instacart: 0,
    amazon_fresh: 0,
    walmart: 0,
  };

  let totalRevenueCents = 0;
  for (const row of rows) {
    const p = row.provider as GroceryProvider;
    const cents = (row.estimated_revenue_cents as number) ?? 0;
    if (p in byProvider) byProvider[p] += cents;
    totalRevenueCents += cents;
  }

  return ok({
    totalOrders: rows.length,
    totalRevenueCents,
    byProvider,
  });
}
