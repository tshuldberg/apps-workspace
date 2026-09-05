/**
 * MyPets <- MyShop importer (P8-D, partner side).
 *
 * Accepts a `PetSupplyEntry` produced by `@mylife/shop`'s pure
 * `buildPetSupplyEntry` adapter and inserts it as a pet expense row.
 * Provenance is encoded into the `notes` field with a stable
 * `[shop:<id>]` prefix because pt_expenses has no source_module /
 * source_purchase_id columns today (a future pets migration could add them).
 *
 * Constraint: pets' `createPetExpense` requires a `petId` and a `category`
 * from the pets `ExpenseCategory` enum. Shop purchases do not know which
 * pet they belong to, so callers must pass the target pet id explicitly.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { createPetExpense } from '../db';
import type { PetExpense, ExpenseCategory } from '../types';

/** Mirrors `@mylife/shop`'s `PetSupplyEntry` to avoid a hard dep. */
export interface PetSupplyEntry {
  description: string;
  costCents: number;
  occurredAt: string;
  sourcePurchaseId: string;
  isVetProduct: boolean;
}

const SHOP_NOTE_PREFIX = '[shop:';

function shopMarker(sourcePurchaseId: string): string {
  return `${SHOP_NOTE_PREFIX}${sourcePurchaseId}]`;
}

/**
 * Inserts a pet expense row from a shop pet-supply suggestion. Encodes
 * `[shop:<id>]` into the `notes` field for dedup tracking. Vet-flagged
 * entries land in the `medication` expense category; everything else lands
 * in `supplies`.
 *
 * Returns `null` if `petId` is empty (defensive: pets CRUD would still
 * insert but the row would be orphaned and unreachable via
 * `listExpensesForPet`).
 *
 * Non-pure: writes to `db`. Returns the inserted expense row, or null on a
 * soft no-op.
 */
export function importPetSupplyFromPurchase(
  db: DatabaseAdapter,
  petId: string,
  entry: PetSupplyEntry,
): PetExpense | null {
  if (!petId) return null;
  const id = `pt_shop_${entry.sourcePurchaseId}`;
  const marker = shopMarker(entry.sourcePurchaseId);
  const category: ExpenseCategory = entry.isVetProduct ? 'medication' : 'supplies';

  return createPetExpense(db, id, {
    petId,
    category,
    label: entry.description.slice(0, 120),
    amountCents: entry.costCents,
    spentOn: entry.occurredAt,
    notes: marker,
  });
}

/**
 * Pure filter: returns suggestions that have not yet been imported. Dedup
 * is by `[shop:<id>]` marker in the notes field of existing expense rows
 * (since pt_expenses lacks a source_purchase_id column).
 */
export function getPendingPetImports<E extends { notes?: string | null }>(
  entries: PetSupplyEntry[],
  existingSupplies: E[],
): PetSupplyEntry[] {
  if (!entries || entries.length === 0) return [];
  if (!existingSupplies || existingSupplies.length === 0) return entries;

  const importedIds = new Set<string>();
  for (const e of existingSupplies) {
    const notes = e.notes ?? '';
    const start = notes.indexOf(SHOP_NOTE_PREFIX);
    if (start === -1) continue;
    const end = notes.indexOf(']', start + SHOP_NOTE_PREFIX.length);
    if (end === -1) continue;
    importedIds.add(notes.slice(start + SHOP_NOTE_PREFIX.length, end));
  }

  return entries.filter((e) => !importedIds.has(e.sourcePurchaseId));
}
