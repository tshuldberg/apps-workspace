/**
 * MyCloset <- MyShop importer (P8-C, partner side).
 *
 * Accepts a `ClosetItemSuggestion` produced by `@mylife/shop`'s pure
 * `buildClosetItemSuggestionFromPurchase` adapter and inserts it as a closet
 * item. Provenance is encoded in the `notes` field with a stable
 * `[shop:<id>]` prefix because cl_items has no source_module /
 * source_purchase_id columns today (a future closet migration could add
 * them).
 *
 * `importFromPurchase` is the only non-pure helper here; everything else is
 * a pure filter.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { createClothingItem } from '../db';
import type { ClothingItem } from '../types';

/**
 * Suggestion shape mirrors `@mylife/shop`'s `ClosetItemSuggestion`. We
 * redeclare it here so closet does not take a hard dependency on the shop
 * package; the public shape is what matters.
 */
export interface ClosetItemSuggestion {
  name: string;
  brand?: string;
  purchaseDate: string;
  priceCents: number;
  sourceModule: 'shop';
  sourcePurchaseId: string;
}

/** Stable prefix that marks a closet item as imported from a shop purchase. */
const SHOP_NOTE_PREFIX = '[shop:';

function shopMarker(sourcePurchaseId: string): string {
  return `${SHOP_NOTE_PREFIX}${sourcePurchaseId}]`;
}

/**
 * Inserts a closet item from a shop suggestion. Closet's `cl_items` table has
 * no FK to shop today, so we encode the source purchase id into `notes` with
 * a stable `[shop:<id>]` prefix for dedup tracking.
 *
 * Future migration: add `source_module TEXT` + `source_purchase_id TEXT` to
 * `cl_items` and prefer those columns over the notes-prefix marker.
 *
 * Non-pure: writes to `db`. Generates a deterministic id of the form
 * `cl_shop_<sourcePurchaseId>` so a second import for the same purchase
 * fails the unique-id constraint at the DB level (double safety net on top
 * of the pre-flight `getPendingShopImports` check).
 */
export function importFromPurchase(
  db: DatabaseAdapter,
  suggestion: ClosetItemSuggestion,
): ClothingItem {
  const id = `cl_shop_${suggestion.sourcePurchaseId}`;
  const marker = shopMarker(suggestion.sourcePurchaseId);

  return createClothingItem(db, id, {
    name: suggestion.name,
    // Closet requires a category; default to `other` for shop-imports since
    // shop's clothing category does not map cleanly to closet's specific
    // sub-categories (tops/bottoms/outerwear/etc). Users can edit after.
    category: 'other',
    brand: suggestion.brand ?? null,
    purchasePriceCents: suggestion.priceCents,
    purchaseDate: suggestion.purchaseDate,
    notes: marker,
  });
}

/**
 * Pure filter: returns suggestions that have not yet been imported into
 * closet. Dedup is by `[shop:<id>]` marker in the notes field of existing
 * items (since cl_items lacks an FK column).
 */
export function getPendingShopImports(
  suggestions: ClosetItemSuggestion[],
  existingItems: ClothingItem[],
): ClosetItemSuggestion[] {
  if (!suggestions || suggestions.length === 0) return [];
  if (!existingItems || existingItems.length === 0) return suggestions;

  const importedIds = new Set<string>();
  for (const item of existingItems) {
    const notes = item.notes ?? '';
    const start = notes.indexOf(SHOP_NOTE_PREFIX);
    if (start === -1) continue;
    const end = notes.indexOf(']', start + SHOP_NOTE_PREFIX.length);
    if (end === -1) continue;
    importedIds.add(notes.slice(start + SHOP_NOTE_PREFIX.length, end));
  }

  return suggestions.filter((s) => !importedIds.has(s.sourcePurchaseId));
}

/**
 * Re-export of the shop-side helper, kept here for symmetric API on the
 * closet surface. Pure passthrough; closet UI can render shared sizes
 * without importing from `@mylife/shop` directly.
 */
export function getSharedSizesFromShop<T extends { type: string }>(
  shopSizes: T[],
): T[] {
  if (!shopSizes || shopSizes.length === 0) return [];
  return shopSizes.filter((s) => s.type === 'clothing' || s.type === 'shoe');
}
