// Stubs prepared for future @mylife/music module. Helpers are pure and
// future-compatible. The music module does not exist yet; these helpers let
// shop-side UI and tests reason about "what would land in Music" without any
// partner-module schema dependency. Disabled or missing partner = safe no-op.

import type { Purchase, WishlistItem } from '../models/schemas';

/**
 * Music collection suggestion shape. The future @mylife/music module would
 * map this into its own collection/library table. Pure data; no IO.
 */
export interface MusicCollectionSuggestion {
  itemName: string;
  purchaseDate: string;
  priceCents: number;
  sourceModule: 'shop';
  sourcePurchaseId: string;
}

/** True iff the purchase is in the `music` shop category. */
export function isMusicPurchase(purchase: Purchase): boolean {
  return purchase?.category === 'music';
}

/**
 * Pure transform from a Shop Purchase row to a future music-collection
 * suggestion. Once @mylife/music exists, its importer will accept this shape.
 */
export function buildMusicCollectionSuggestion(
  purchase: Purchase,
): MusicCollectionSuggestion {
  return {
    itemName: purchase.name,
    purchaseDate: purchase.purchaseDate,
    priceCents: purchase.priceCents,
    sourceModule: 'shop',
    sourcePurchaseId: purchase.id,
  };
}

/**
 * Filter wishlist items down to the music category. The future MyMusic
 * "wishlist surface" can render these without duplicating sh_wishlist_items.
 */
export function getMusicWishlistItems(
  wishlistItems: WishlistItem[],
): WishlistItem[] {
  if (!wishlistItems || wishlistItems.length === 0) return [];
  return wishlistItems.filter((item) => item.category === 'music');
}
