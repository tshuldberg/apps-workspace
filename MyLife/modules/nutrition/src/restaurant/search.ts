import type { DatabaseAdapter } from '@mylife/db';
import type { Restaurant, MenuItem, RestaurantCategory } from './types';

// ---------------------------------------------------------------------------
// Row mappers (duplicated to avoid circular imports)
// ---------------------------------------------------------------------------

function rowToRestaurant(row: Record<string, unknown>): Restaurant {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as RestaurantCategory,
    chain: Boolean(row.chain),
    logoEmoji: (row.logo_emoji as string) ?? null,
    logoUri: (row.logo_uri as string) ?? null,
    website: (row.website as string) ?? null,
    source: row.source as Restaurant['source'],
    verified: Boolean(row.verified),
    createdAt: row.created_at as string,
  };
}

function rowToMenuItem(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as string,
    restaurantId: row.restaurant_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    category: (row.category as string) ?? null,
    servingSize: (row.serving_size as string) ?? null,
    calories: row.calories as number,
    proteinG: row.protein_g as number,
    carbsG: row.carbs_g as number,
    fatG: row.fat_g as number,
    fiberG: row.fiber_g as number,
    sodiumMg: row.sodium_mg as number,
    source: row.source as MenuItem['source'],
    verified: Boolean(row.verified),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// FTS search
// ---------------------------------------------------------------------------

/**
 * Search restaurants by name using FTS5.
 * Falls back to LIKE query if FTS returns no results.
 */
export function searchRestaurants(db: DatabaseAdapter, query: string): Restaurant[] {
  if (!query.trim()) {
    return db
      .query<Record<string, unknown>>(
        'SELECT * FROM nu_restaurants ORDER BY chain DESC, name ASC LIMIT 50',
      )
      .map(rowToRestaurant);
  }

  // Try FTS first -- sanitize to prevent FTS5 syntax injection
  const sanitized = query.replace(/[^\w\s]/g, '').trim();
  if (!sanitized) {
    return db
      .query<Record<string, unknown>>(
        'SELECT * FROM nu_restaurants ORDER BY chain DESC, name ASC LIMIT 50',
      )
      .map(rowToRestaurant);
  }
  const ftsQuery = sanitized.split(/\s+/).map((w) => `"${w}"*`).join(' ');
  try {
    const ftsRows = db.query<Record<string, unknown>>(
      `SELECT r.* FROM nu_restaurants r
       JOIN nu_restaurants_fts fts ON fts.rowid = r.rowid
       WHERE nu_restaurants_fts MATCH ?
       ORDER BY rank
       LIMIT 50`,
      [ftsQuery],
    );
    if (ftsRows.length > 0) return ftsRows.map(rowToRestaurant);
  } catch {
    // FTS may not be available; fall through to LIKE
  }

  // Fallback to LIKE
  const escaped = query.replace(/[%_]/g, (c) => `\\${c}`);
  return db
    .query<Record<string, unknown>>(
      "SELECT * FROM nu_restaurants WHERE name LIKE ? ESCAPE '\\' ORDER BY chain DESC, name ASC LIMIT 50",
      [`%${escaped}%`],
    )
    .map(rowToRestaurant);
}

/**
 * Search menu items across all restaurants using FTS5.
 * Falls back to LIKE query if FTS returns no results.
 */
export function searchMenuItems(db: DatabaseAdapter, query: string): MenuItem[] {
  if (!query.trim()) return [];

  // Sanitize for FTS5: strip non-word chars, quote each token
  const sanitizedMenu = query.replace(/[^\w\s]/g, '').trim();
  if (!sanitizedMenu) return [];
  const ftsMenuQuery = sanitizedMenu.split(/\s+/).map((w) => `"${w}"*`).join(' ');
  try {
    const ftsRows = db.query<Record<string, unknown>>(
      `SELECT m.* FROM nu_menu_items m
       JOIN nu_menu_items_fts fts ON fts.rowid = m.rowid
       WHERE nu_menu_items_fts MATCH ?
       ORDER BY rank
       LIMIT 50`,
      [ftsMenuQuery],
    );
    if (ftsRows.length > 0) return ftsRows.map(rowToMenuItem);
  } catch {
    // FTS may not be available; fall through to LIKE
  }

  const escapedMenu = query.replace(/[%_]/g, (c) => `\\${c}`);
  return db
    .query<Record<string, unknown>>(
      "SELECT * FROM nu_menu_items WHERE name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT 50",
      [`%${escapedMenu}%`, `%${escapedMenu}%`],
    )
    .map(rowToMenuItem);
}
