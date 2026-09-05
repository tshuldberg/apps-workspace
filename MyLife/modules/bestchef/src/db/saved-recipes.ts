/**
 * Saved recipe search facets (P14-C / F-036).
 *
 * Local-only filtered search over rc_recipes. Filters compose with AND
 * semantics; ingredient and cuisine multi-selects use ANY-of (OR within
 * the same facet) semantics so users can broaden a single facet without
 * tightening the others.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface SearchSavedRecipesInput {
  /** Substring match on title. Case-insensitive via SQLite LIKE. */
  title?: string;
  /** Match recipes containing ANY of these ingredient items (case-insensitive). */
  ingredients?: string[];
  /** Match recipes carrying ANY of these cuisine tags (case-insensitive). */
  cuisines?: string[];
  /** Filter recipes whose total cook + prep time is at most this many minutes. */
  maxTimeMins?: number | null;
  /** When true, restrict to favorites only. */
  favoritedOnly?: boolean;
  /** Hard cap. Defaults to 200. */
  limit?: number;
}

export interface SavedRecipeSearchRow {
  id: string;
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  total_time_mins: number | null;
  difficulty: string | null;
  source_url: string | null;
  source_submission_id: string | null;
  source_chef_id: string | null;
  source_chef_name: string | null;
  source_chef_handle: string | null;
  image_uri: string | null;
  is_favorite: number;
  rating: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ingredient_count: number;
  step_count: number;
  grocery_flagged: number;
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (ch) => `\\${ch}`);
}

function normalizeList(values: string[] | undefined): string[] {
  if (!values) return [];
  return values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

/**
 * Search saved recipes with combined facets. Returns the same row shape
 * the kitchen tab uses (recipe + ingredient_count, step_count, grocery_flagged).
 *
 * Designed for hundreds of saved recipes. Uses LIKE / IN subqueries rather
 * than FTS so it works without an additional virtual table migration.
 */
export function searchSavedRecipes(
  db: DatabaseAdapter,
  input: SearchSavedRecipesInput = {},
): SavedRecipeSearchRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const title = input.title?.trim() ?? '';
  if (title.length > 0) {
    conditions.push(`r.title LIKE ? ESCAPE '\\'`);
    params.push(`%${escapeLike(title)}%`);
  }

  const ingredients = normalizeList(input.ingredients);
  if (ingredients.length > 0) {
    const placeholders = ingredients.map(() => 'LOWER(i2.item) LIKE ? ESCAPE \'\\\' OR LOWER(i2.name) LIKE ? ESCAPE \'\\\'').join(' OR ');
    conditions.push(`r.id IN (
      SELECT DISTINCT i2.recipe_id
      FROM rc_ingredients i2
      WHERE ${placeholders}
    )`);
    for (const value of ingredients) {
      const like = `%${escapeLike(value)}%`;
      params.push(like, like);
    }
  }

  const cuisines = normalizeList(input.cuisines);
  if (cuisines.length > 0) {
    const placeholders = cuisines.map(() => '?').join(', ');
    conditions.push(`r.id IN (
      SELECT t2.recipe_id FROM rc_recipe_tags t2
      WHERE LOWER(t2.tag) IN (${placeholders})
    )`);
    for (const value of cuisines) params.push(value);
  }

  if (typeof input.maxTimeMins === 'number' && Number.isFinite(input.maxTimeMins) && input.maxTimeMins > 0) {
    // Use total_time_mins when set, otherwise sum prep + cook (treating null as 0).
    conditions.push(
      `COALESCE(r.total_time_mins, COALESCE(r.prep_time_mins, 0) + COALESCE(r.cook_time_mins, 0)) <= ?`,
    );
    params.push(input.maxTimeMins);
  }

  if (input.favoritedOnly) {
    conditions.push(`r.is_favorite = 1`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = input.limit ?? 200;
  params.push(limit);

  return db.query<SavedRecipeSearchRow>(
    `SELECT
       r.*,
       (SELECT COUNT(*) FROM rc_ingredients i WHERE i.recipe_id = r.id) AS ingredient_count,
       (SELECT COUNT(*) FROM rc_steps s WHERE s.recipe_id = r.id) AS step_count,
       CASE WHEN EXISTS (SELECT 1 FROM rc_recipe_grocery_flags f WHERE f.recipe_id = r.id) THEN 1 ELSE 0 END AS grocery_flagged
     FROM rc_recipes r
     ${where}
     ORDER BY r.updated_at DESC
     LIMIT ?`,
    params,
  );
}

/**
 * Distinct ingredient items across all saved recipes. Used to populate the
 * ingredient-facet picker without duplicating values that only differ by
 * case or trailing whitespace.
 */
export function listDistinctSavedRecipeIngredients(db: DatabaseAdapter): string[] {
  const rows = db.query<{ item: string | null; name: string }>(
    `SELECT item, name FROM rc_ingredients`,
  );
  const set = new Set<string>();
  for (const row of rows) {
    const candidate = (row.item && row.item.trim()) || (row.name && row.name.trim());
    if (!candidate) continue;
    // Lowercase key for dedupe; preserve display casing of first-seen value.
    const key = candidate.toLowerCase();
    if (!set.has(key)) set.add(key);
  }
  // Sort alphabetically for stable display order.
  return Array.from(set).sort((left, right) => left.localeCompare(right));
}

/**
 * Distinct cuisine tags across all saved recipes. Cuisine is stored in
 * rc_recipe_tags; we surface every tag so users can multi-select.
 */
export function listDistinctSavedRecipeCuisines(db: DatabaseAdapter): string[] {
  const rows = db.query<{ tag: string }>(
    `SELECT DISTINCT tag FROM rc_recipe_tags WHERE tag IS NOT NULL AND tag != ''`,
  );
  const set = new Set<string>();
  for (const row of rows) {
    const value = row.tag.trim();
    if (!value) continue;
    set.add(value);
  }
  return Array.from(set).sort((left, right) => left.localeCompare(right));
}
