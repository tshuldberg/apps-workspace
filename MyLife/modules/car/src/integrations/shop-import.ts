/**
 * MyCar <- MyShop importer (P8-D, partner side).
 *
 * Accepts a `MaintenanceLogEntry` produced by `@mylife/shop`'s pure
 * `buildMaintenanceLogEntry` adapter and inserts it as a maintenance row.
 * Provenance is encoded into the `description` field with a stable
 * `[shop:<id>]` prefix because cr_maintenance has no source_module /
 * source_purchase_id columns today (a future car migration could add them).
 *
 * Constraint: car's `createMaintenance` requires a `vehicleId`. Shop
 * purchases do not know which vehicle they belong to, so callers must pass
 * the target vehicle id explicitly.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { createMaintenance, getMaintenanceByVehicle } from '../db';
import type { Maintenance } from '../types';

/** Mirrors `@mylife/shop`'s `MaintenanceLogEntry` to avoid a hard dep. */
export interface MaintenanceLogEntry {
  description: string;
  partType: string;
  costCents: number;
  occurredAt: string;
  sourcePurchaseId: string;
}

const SHOP_NOTE_PREFIX = '[shop:';

function shopMarker(sourcePurchaseId: string): string {
  return `${SHOP_NOTE_PREFIX}${sourcePurchaseId}]`;
}

/**
 * Inserts a car maintenance row from a shop maintenance suggestion. Encodes
 * `[shop:<id>]` into the description for dedup tracking.
 *
 * Returns `null` if `vehicleId` is empty (defensive: car's CRUD would still
 * insert but the row would be orphaned and unreachable via
 * `getMaintenanceByVehicle`).
 *
 * Non-pure: writes to `db`. Returns the inserted maintenance row, or null
 * on a soft no-op.
 */
export function importMaintenanceFromPurchase(
  db: DatabaseAdapter,
  vehicleId: string,
  entry: MaintenanceLogEntry,
): Maintenance | null {
  if (!vehicleId) return null;
  const id = `cr_shop_${entry.sourcePurchaseId}`;
  const marker = shopMarker(entry.sourcePurchaseId);
  const description = `${entry.description} ${marker}`;

  createMaintenance(db, id, vehicleId, {
    type: 'other',
    performedAt: entry.occurredAt,
    description,
    costCents: entry.costCents,
  });

  // Re-read via the canonical row mapper to keep the partner module's
  // schema-projection logic in one place.
  const all = getMaintenanceByVehicle(db, vehicleId, 1000);
  return all.find((m) => m.id === id) ?? null;
}

/**
 * Pure filter: returns suggestions that have not yet been imported. Dedup is
 * by `[shop:<id>]` marker in the description field of existing maintenance
 * rows (since cr_maintenance lacks a source_purchase_id column).
 */
export function getPendingCarImports<
  M extends { description?: string | null },
>(
  entries: MaintenanceLogEntry[],
  existingMaintenance: M[],
): MaintenanceLogEntry[] {
  if (!entries || entries.length === 0) return [];
  if (!existingMaintenance || existingMaintenance.length === 0) return entries;

  const importedIds = new Set<string>();
  for (const m of existingMaintenance) {
    const desc = m.description ?? '';
    const start = desc.indexOf(SHOP_NOTE_PREFIX);
    if (start === -1) continue;
    const end = desc.indexOf(']', start + SHOP_NOTE_PREFIX.length);
    if (end === -1) continue;
    importedIds.add(desc.slice(start + SHOP_NOTE_PREFIX.length, end));
  }

  return entries.filter((e) => !importedIds.has(e.sourcePurchaseId));
}
