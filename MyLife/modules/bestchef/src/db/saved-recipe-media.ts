/**
 * Saved recipe media gallery (P14-A / F-014).
 *
 * Authors can attach multiple photos to a saved recipe with stable
 * sort order. The legacy single image_uri column on rc_recipes stays
 * the canonical "hero" thumbnail; this table is the gallery source
 * of truth and never deletes media unless the parent recipe is
 * removed (cascade) or the author explicitly removes a photo.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface SavedRecipeMediaRow {
  id: string;
  recipe_id: string;
  uri: string;
  sort_order: number;
  created_at: string;
}

export interface AddSavedRecipeMediaInput {
  recipeId: string;
  uri: string;
  /** Optional explicit id (tests). Defaults to a generated id. */
  id?: string;
}

export interface RemoveSavedRecipeMediaInput {
  id: string;
}

export interface ReorderSavedRecipeMediaInput {
  recipeId: string;
  /** Photo ids in the new sort order, lowest sort_order first. */
  orderedIds: string[];
}

function createMediaId(): string {
  return `srm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getSavedRecipeMedia(
  db: DatabaseAdapter,
  recipeId: string,
): SavedRecipeMediaRow[] {
  return db.query<SavedRecipeMediaRow>(
    `SELECT id, recipe_id, uri, sort_order, created_at
     FROM rc_saved_recipe_media
     WHERE recipe_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [recipeId],
  );
}

export function addSavedRecipeMedia(
  db: DatabaseAdapter,
  input: AddSavedRecipeMediaInput,
): SavedRecipeMediaRow {
  const trimmed = input.uri.trim();
  if (!trimmed) {
    throw new Error('Cannot add empty media uri');
  }
  const id = input.id ?? createMediaId();
  const existing = db.query<{ next_order: number | null }>(
    `SELECT MAX(sort_order) AS next_order
     FROM rc_saved_recipe_media
     WHERE recipe_id = ?`,
    [input.recipeId],
  );
  const nextOrder = (existing[0]?.next_order ?? -1) + 1;
  db.execute(
    `INSERT INTO rc_saved_recipe_media (id, recipe_id, uri, sort_order)
     VALUES (?, ?, ?, ?)`,
    [id, input.recipeId, trimmed, nextOrder],
  );
  const rows = db.query<SavedRecipeMediaRow>(
    `SELECT id, recipe_id, uri, sort_order, created_at
     FROM rc_saved_recipe_media
     WHERE id = ?`,
    [id],
  );
  if (!rows[0]) {
    throw new Error('Failed to insert saved recipe media row');
  }
  return rows[0];
}

export function removeSavedRecipeMedia(
  db: DatabaseAdapter,
  input: RemoveSavedRecipeMediaInput,
): boolean {
  const before = db.query<{ recipe_id: string }>(
    `SELECT recipe_id FROM rc_saved_recipe_media WHERE id = ?`,
    [input.id],
  );
  if (!before[0]) return false;
  const recipeId = before[0].recipe_id;
  db.execute(`DELETE FROM rc_saved_recipe_media WHERE id = ?`, [input.id]);
  // Re-pack sort_order so subsequent inserts/reorders stay contiguous.
  const remaining = getSavedRecipeMedia(db, recipeId);
  remaining.forEach((row, index) => {
    if (row.sort_order !== index) {
      db.execute(
        `UPDATE rc_saved_recipe_media SET sort_order = ? WHERE id = ?`,
        [index, row.id],
      );
    }
  });
  return true;
}

export function reorderSavedRecipeMedia(
  db: DatabaseAdapter,
  input: ReorderSavedRecipeMediaInput,
): SavedRecipeMediaRow[] {
  const current = getSavedRecipeMedia(db, input.recipeId);
  const allowed = new Set(current.map((row) => row.id));
  const seen = new Set<string>();
  let next = 0;
  db.transaction(() => {
    for (const id of input.orderedIds) {
      if (!allowed.has(id) || seen.has(id)) continue;
      seen.add(id);
      db.execute(
        `UPDATE rc_saved_recipe_media SET sort_order = ? WHERE id = ?`,
        [next, id],
      );
      next += 1;
    }
    // Append any rows the caller did not include (defensive: never lose data).
    for (const row of current) {
      if (seen.has(row.id)) continue;
      db.execute(
        `UPDATE rc_saved_recipe_media SET sort_order = ? WHERE id = ?`,
        [next, row.id],
      );
      next += 1;
    }
  });
  return getSavedRecipeMedia(db, input.recipeId);
}

export function countSavedRecipeMedia(
  db: DatabaseAdapter,
  recipeId: string,
): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM rc_saved_recipe_media WHERE recipe_id = ?`,
    [recipeId],
  );
  return rows[0]?.count ?? 0;
}
