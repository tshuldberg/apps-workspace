/**
 * MyShop -> MyPets integration adapters (P8-D).
 *
 * Pure helpers. No DB writes here. The shop module never inserts into pets
 * tables. Instead, it builds pet-supply suggestion shapes that MyPets can
 * consume via its own CRUD. If MyPets is disabled, callers simply do not
 * invoke these helpers; nothing throws and no partner-module schema is
 * assumed.
 */

import type { Purchase } from '../models/schemas';

/**
 * Pet-supply entry shape MyPets can ingest. Pure data; no IO.
 *
 * Note: `pt_expenses` has no `source_purchase_id` column today, so the pets-
 * side importer encodes provenance into the `notes` field with a stable
 * `[shop:<id>]` prefix for dedup tracking.
 */
export interface PetSupplyEntry {
  description: string;
  costCents: number;
  occurredAt: string;
  sourcePurchaseId: string;
  isVetProduct: boolean;
}

// Heuristic: a purchase is a pet supply if its name matches a pet-care
// keyword. We deliberately do NOT key off shop category since shop has no
// "pets" category today. Vet-product detection looks for vet/medication
// signals in the name.
const PET_KEYWORD_RE = /\b(pet|dog|cat|food|toy|treat|leash|litter|vet)\b/i;
const VET_KEYWORD_RE = /\b(vet|medication|prescription|rx)\b/i;

/** True iff the purchase looks like a pet supply by name heuristic. */
export function isPetSupplyPurchase(purchase: Purchase): boolean {
  if (!purchase) return false;
  return PET_KEYWORD_RE.test(purchase.name ?? '');
}

/**
 * Pure transform from a Shop Purchase row to a Pet supply entry. The pets-
 * side importer is responsible for inserting under a specific pet id; this
 * helper never touches a DB.
 */
export function buildPetSupplyEntry(purchase: Purchase): PetSupplyEntry {
  return {
    description: purchase.name,
    costCents: purchase.priceCents,
    occurredAt: purchase.purchaseDate,
    sourcePurchaseId: purchase.id,
    isVetProduct: VET_KEYWORD_RE.test(purchase.name ?? ''),
  };
}

/**
 * Filter purchases that look vet-recommended. Today we infer this from the
 * purchase name (vet/prescription/rx keywords) since shop has no
 * `is_vet_recommended` flag. A future shop migration could add an explicit
 * flag and this helper would prefer that signal.
 */
export function getVetRecommendedPurchases(
  purchases: Purchase[],
): Purchase[] {
  if (!purchases || purchases.length === 0) return [];
  return purchases.filter(
    (p) => isPetSupplyPurchase(p) && VET_KEYWORD_RE.test(p.name ?? ''),
  );
}
