/**
 * MyShop -> MyCloset integration adapters (P8-C).
 *
 * Pure helpers. No DB writes here. The Shop module never inserts into Closet
 * tables. Instead, it builds suggestion shapes that Closet can consume via its
 * own CRUD. If MyCloset is disabled, callers simply do not invoke these
 * helpers; nothing throws and no partner-module schema is assumed.
 */

import type { Purchase, Size } from '../models/schemas';

/**
 * Suggestion shape MyCloset can ingest. Pure data; no IO.
 *
 * Note: cl_items has no source_module / source_purchase_id columns today, so
 * the closet-side importer encodes provenance into the `notes` field with a
 * stable `[shop:<id>]` prefix for dedup tracking. The fields below remain in
 * the suggestion shape so the UI layer can show "from Shop" without a DB
 * schema change.
 */
export interface ClosetItemSuggestion {
  name: string;
  brand?: string;
  purchaseDate: string;
  priceCents: number;
  sourceModule: 'shop';
  sourcePurchaseId: string;
}

/** True iff the purchase is in the `clothing` shop category. */
export function isClothingPurchase(purchase: Purchase): boolean {
  return purchase?.category === 'clothing';
}

/**
 * Pure transform from a Shop Purchase row to a Closet item suggestion. The
 * closet-side importer is responsible for inserting; this helper never touches
 * a DB.
 */
export function buildClosetItemSuggestionFromPurchase(
  purchase: Purchase,
): ClosetItemSuggestion {
  const suggestion: ClosetItemSuggestion = {
    name: purchase.name,
    purchaseDate: purchase.purchaseDate,
    priceCents: purchase.priceCents,
    sourceModule: 'shop',
    sourcePurchaseId: purchase.id,
  };
  if (purchase.brand) suggestion.brand = purchase.brand;
  return suggestion;
}

/**
 * Filter shop sizes to only clothing and shoe types. Closet can call this to
 * render per-brand size lookup using the SAME data source as MyShop, keeping
 * the two modules consistent without duplicating the sh_sizes table.
 */
export function getSharedClothingSizes(sizes: Size[]): Size[] {
  if (!sizes || sizes.length === 0) return [];
  return sizes.filter((s) => s.type === 'clothing' || s.type === 'shoe');
}

/**
 * Map a list of shop purchases to closet item suggestions, filtering for
 * clothing-category purchases that are not returned. Pure.
 */
export function getClosetSuggestionsFromPurchases(
  purchases: Purchase[],
): ClosetItemSuggestion[] {
  if (!purchases || purchases.length === 0) return [];
  return purchases
    .filter((p) => isClothingPurchase(p) && !p.returned)
    .map(buildClosetItemSuggestionFromPurchase);
}
