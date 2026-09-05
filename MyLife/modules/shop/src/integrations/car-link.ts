/**
 * MyShop -> MyCar integration adapters (P8-D).
 *
 * Pure helpers. No DB writes here. The shop module never inserts into car
 * tables. Instead, it builds maintenance-log suggestion shapes that MyCar can
 * consume via its own CRUD. If MyCar is disabled, callers simply do not
 * invoke these helpers; nothing throws and no partner-module schema is
 * assumed.
 */

import type { Purchase, Warranty } from '../models/schemas';

/**
 * Maintenance-log entry shape MyCar can ingest. Pure data; no IO.
 *
 * Note: `cr_maintenance` has no `source_purchase_id` column today, so the
 * car-side importer encodes provenance into the `description` field with a
 * stable `[shop:<id>]` prefix for dedup tracking.
 */
export interface MaintenanceLogEntry {
  description: string;
  partType: string;
  costCents: number;
  occurredAt: string;
  sourcePurchaseId: string;
}

// Heuristic: "tech" purchases whose name matches a clear automotive keyword
// are treated as auto parts. We do NOT misclassify electronics as auto parts;
// we require both signals.
const AUTO_KEYWORD_RE = /\b(auto|car|motor|tire|tires|oil|brake|brakes|battery)\b/i;

/**
 * True iff the purchase looks like an auto part. Today we use the `tech`
 * category plus a name keyword check; if a future `auto` shop category is
 * introduced this helper should be updated to match.
 */
export function isAutoPartsPurchase(purchase: Purchase): boolean {
  if (!purchase) return false;
  if (purchase.category !== 'tech') return false;
  return AUTO_KEYWORD_RE.test(purchase.name ?? '');
}

/**
 * Pure transform from a Shop Purchase row to a Car maintenance-log entry.
 * The car-side importer is responsible for inserting under a specific
 * vehicle id; this helper never touches a DB.
 */
export function buildMaintenanceLogEntry(
  purchase: Purchase,
): MaintenanceLogEntry {
  return {
    description: purchase.name,
    partType: 'other',
    costCents: purchase.priceCents,
    occurredAt: purchase.purchaseDate,
    sourcePurchaseId: purchase.id,
  };
}

/**
 * Find warranties tied to auto-parts purchases. Useful for car module to
 * surface "active coverage on parts you bought" in the vehicle detail view.
 */
export function getCarRelatedWarranties(
  warranties: Warranty[],
  purchases: Purchase[],
): Warranty[] {
  if (!warranties || warranties.length === 0) return [];
  if (!purchases || purchases.length === 0) return [];

  const autoPurchaseIds = new Set(
    purchases.filter(isAutoPartsPurchase).map((p) => p.id),
  );
  if (autoPurchaseIds.size === 0) return [];

  return warranties.filter(
    (w) => w.purchaseId !== null && autoPurchaseIds.has(w.purchaseId),
  );
}
