import type { DatabaseAdapter } from '@mylife/db';
import type { Food } from '../types';

// ---------------------------------------------------------------------------
// Row mapper (same as foods.ts -- shared for search results)
// ---------------------------------------------------------------------------

function rowToFood(row: Record<string, unknown>): Food {
  return {
    id: row.id as string,
    name: row.name as string,
    brand: (row.brand as string) ?? null,
    servingSize: row.serving_size as number,
    servingUnit: row.serving_unit as string,
    calories: row.calories as number,
    proteinG: row.protein_g as number,
    carbsG: row.carbs_g as number,
    fatG: row.fat_g as number,
    fiberG: row.fiber_g as number,
    sugarG: row.sugar_g as number,
    sodiumMg: row.sodium_mg as number,
    source: row.source as Food['source'],
    barcode: (row.barcode as string) ?? null,
    usdaNdbNumber: (row.usda_ndb_number as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Search options
// ---------------------------------------------------------------------------

export interface FoodSearchOptions {
  /** Maximum number of results (default 50). */
  limit?: number;
  /** Number of results to skip for pagination (default 0). */
  offset?: number;
  /** Filter by food source: 'usda', 'custom', 'all' (default 'all'). */
  source?: 'usda' | 'open_food_facts' | 'fatsecret' | 'custom' | 'ai_photo' | 'all';
}

// ---------------------------------------------------------------------------
// FTS5 search
// ---------------------------------------------------------------------------

/**
 * Search local foods using FTS5 full-text search.
 * Results are ranked by relevance (FTS5 rank).
 * Falls back to LIKE search if FTS match fails (e.g., partial query).
 */
export function searchLocalFoods(
  db: DatabaseAdapter,
  query: string,
  options?: FoodSearchOptions,
): Food[] {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const source = options?.source ?? 'all';

  // Sanitize query for FTS5: strip special chars, append wildcard for prefix matching
  const sanitized = query.replace(/[^\w\s]/g, '').trim();
  if (!sanitized) return [];

  const ftsQuery = sanitized.split(/\s+/).map((w) => `${w}*`).join(' ');

  const sourceFilter = source === 'all' ? '' : ' AND f.source = ?';
  const sourceParams: unknown[] = source === 'all' ? [] : [source];

  // Try FTS5 first
  try {
    const results = db.query<Record<string, unknown>>(
      `SELECT f.* FROM nu_foods f
       JOIN nu_foods_fts fts ON f.rowid = fts.rowid
       WHERE nu_foods_fts MATCH ?${sourceFilter}
       ORDER BY rank
       LIMIT ? OFFSET ?`,
      [ftsQuery, ...sourceParams, limit, offset],
    );
    if (results.length > 0) return results.map(rowToFood);
  } catch {
    // FTS table may not exist or query may be invalid, fall through to LIKE
  }

  // Fallback: LIKE search (escape LIKE wildcards)
  const escaped = sanitized.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM nu_foods WHERE (name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\')${source === 'all' ? '' : ' AND source = ?'}
       ORDER BY name ASC LIMIT ? OFFSET ?`,
      [pattern, pattern, ...sourceParams, limit, offset],
    )
    .map(rowToFood);
}
