// Stubs prepared for future @mylife/gaming module. Helpers are pure and
// future-compatible. The gaming module does not exist yet; these helpers let
// shop-side UI and tests reason about "what would land in Gaming" without any
// partner-module schema dependency. Disabled or missing partner = safe no-op.

import type { Purchase, WishlistItem } from '../models/schemas';

/**
 * Game-library suggestion shape. The future @mylife/gaming module would map
 * this into its own library/log table. Pure data; no IO.
 */
export interface GameLibrarySuggestion {
  gameTitle: string;
  purchaseDate: string;
  priceCents: number;
  sourceModule: 'shop';
  sourcePurchaseId: string;
}

/** True iff the purchase is in the `gaming` shop category. */
export function isGamingPurchase(purchase: Purchase): boolean {
  return purchase?.category === 'gaming';
}

/**
 * Pure transform from a Shop Purchase row to a future game-library suggestion.
 * Once @mylife/gaming exists, its importer will accept this shape.
 */
export function buildGameLibrarySuggestion(
  purchase: Purchase,
): GameLibrarySuggestion {
  return {
    gameTitle: purchase.name,
    purchaseDate: purchase.purchaseDate,
    priceCents: purchase.priceCents,
    sourceModule: 'shop',
    sourcePurchaseId: purchase.id,
  };
}

/**
 * Filter wishlist items down to the gaming category. The future MyGaming
 * "wishlist surface" can render these without duplicating sh_wishlist_items.
 */
export function getGameWishlistItems(
  wishlistItems: WishlistItem[],
): WishlistItem[] {
  if (!wishlistItems || wishlistItems.length === 0) return [];
  return wishlistItems.filter((item) => item.category === 'gaming');
}
