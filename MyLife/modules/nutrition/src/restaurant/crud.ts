import type { DatabaseAdapter } from '@mylife/db';
import type {
  Restaurant,
  MenuItem,
  RestaurantWithCount,
  RestaurantCategory,
  RestaurantSource,
  MenuItemSource,
  RestaurantVisitStats,
} from './types';

// ---------------------------------------------------------------------------
// Row mappers
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
    source: row.source as RestaurantSource,
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
    source: row.source as MenuItemSource,
    verified: Boolean(row.verified),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Restaurant CRUD
// ---------------------------------------------------------------------------

export function createRestaurant(
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    category?: RestaurantCategory;
    chain?: boolean;
    logoEmoji?: string;
    logoUri?: string;
    website?: string;
    source?: RestaurantSource;
  },
): void {
  db.execute(
    `INSERT INTO nu_restaurants (id, name, category, chain, logo_emoji, logo_uri, website, source, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
    [
      id,
      input.name,
      input.category ?? 'other',
      input.chain ? 1 : 0,
      input.logoEmoji ?? null,
      input.logoUri ?? null,
      input.website ?? null,
      input.source ?? 'user',
    ],
  );
}

export function getRestaurantById(db: DatabaseAdapter, id: string): RestaurantWithCount | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT r.*, (SELECT COUNT(*) FROM nu_menu_items WHERE restaurant_id = r.id) as menu_item_count
     FROM nu_restaurants r WHERE r.id = ?`,
    [id],
  );
  if (rows.length === 0) return null;
  const r = rowToRestaurant(rows[0]);
  return { ...r, menuItemCount: (rows[0].menu_item_count as number) ?? 0 };
}

export function getRestaurantsByCategory(
  db: DatabaseAdapter,
  category: RestaurantCategory,
  limit = 200,
): Restaurant[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_restaurants WHERE category = ? ORDER BY name ASC LIMIT ?',
      [category, limit],
    )
    .map(rowToRestaurant);
}

export function getRestaurants(
  db: DatabaseAdapter,
  options?: {
    category?: RestaurantCategory;
    limit?: number;
  },
): RestaurantWithCount[] {
  const limit = options?.limit ?? 200;
  const params: unknown[] = [];
  const where =
    options?.category != null
      ? (() => {
          params.push(options.category);
          return 'WHERE r.category = ?';
        })()
      : '';

  params.push(limit);

  return db
    .query<Record<string, unknown>>(
      `SELECT
         r.*,
         COUNT(m.id) AS menu_item_count
       FROM nu_restaurants r
       LEFT JOIN nu_menu_items m ON m.restaurant_id = r.id
       ${where}
       GROUP BY r.id
       ORDER BY r.chain DESC, r.name ASC
       LIMIT ?`,
      params,
    )
    .map((row) => ({
      ...rowToRestaurant(row),
      menuItemCount: Number(row.menu_item_count ?? 0),
    }));
}

export function getPopularChains(db: DatabaseAdapter, limit = 200): Restaurant[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_restaurants WHERE chain = 1 ORDER BY name ASC LIMIT ?',
      [limit],
    )
    .map(rowToRestaurant);
}

export function getAllRestaurants(db: DatabaseAdapter, limit = 500): Restaurant[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_restaurants ORDER BY name ASC LIMIT ?',
      [limit],
    )
    .map(rowToRestaurant);
}

export function deleteRestaurant(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_restaurants WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Menu Item CRUD
// ---------------------------------------------------------------------------

export function createMenuItem(
  db: DatabaseAdapter,
  id: string,
  input: {
    restaurantId: string;
    name: string;
    description?: string;
    category?: string;
    servingSize?: string;
    calories: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    fiberG?: number;
    sodiumMg?: number;
    source?: MenuItemSource;
  },
): void {
  db.execute(
    `INSERT INTO nu_menu_items (id, restaurant_id, name, description, category, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, source, verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
    [
      id,
      input.restaurantId,
      input.name,
      input.description ?? null,
      input.category ?? null,
      input.servingSize ?? null,
      input.calories,
      input.proteinG ?? 0,
      input.carbsG ?? 0,
      input.fatG ?? 0,
      input.fiberG ?? 0,
      input.sodiumMg ?? 0,
      input.source ?? 'user',
    ],
  );
}

export function updateMenuItem(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    category: string | null;
    servingSize: string | null;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sodiumMg: number;
    source: MenuItemSource;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    params.push(updates.description);
  }
  if (updates.category !== undefined) {
    sets.push('category = ?');
    params.push(updates.category);
  }
  if (updates.servingSize !== undefined) {
    sets.push('serving_size = ?');
    params.push(updates.servingSize);
  }
  if (updates.calories !== undefined) {
    sets.push('calories = ?');
    params.push(updates.calories);
  }
  if (updates.proteinG !== undefined) {
    sets.push('protein_g = ?');
    params.push(updates.proteinG);
  }
  if (updates.carbsG !== undefined) {
    sets.push('carbs_g = ?');
    params.push(updates.carbsG);
  }
  if (updates.fatG !== undefined) {
    sets.push('fat_g = ?');
    params.push(updates.fatG);
  }
  if (updates.fiberG !== undefined) {
    sets.push('fiber_g = ?');
    params.push(updates.fiberG);
  }
  if (updates.sodiumMg !== undefined) {
    sets.push('sodium_mg = ?');
    params.push(updates.sodiumMg);
  }
  if (updates.source !== undefined) {
    sets.push('source = ?');
    params.push(updates.source);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(id);
  db.execute(`UPDATE nu_menu_items SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function getMenuItems(db: DatabaseAdapter, restaurantId: string): MenuItem[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_menu_items WHERE restaurant_id = ? ORDER BY category ASC, name ASC',
      [restaurantId],
    )
    .map(rowToMenuItem);
}

export function getMenuItemById(db: DatabaseAdapter, id: string): MenuItem | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM nu_menu_items WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToMenuItem(rows[0]) : null;
}

export function deleteMenuItem(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_menu_items WHERE id = ?', [id]);
}

export function getRestaurantVisitStats(
  db: DatabaseAdapter,
  restaurantName: string,
): RestaurantVisitStats {
  const perVisitRows = db.query<Record<string, unknown>>(
    `SELECT
       l.id AS log_id,
       l.date AS date,
       SUM(i.calories) AS visit_calories
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     JOIN nu_foods f ON f.id = i.food_id
     WHERE f.brand = ?
     GROUP BY l.id, l.date
     ORDER BY l.date DESC, l.created_at DESC`,
    [restaurantName],
  );

  if (perVisitRows.length === 0) {
    return {
      visitCount: 0,
      averageCalories: 0,
      lastFiveAverageCalories: 0,
    };
  }

  const visitCalories = perVisitRows.map((row) => Number(row.visit_calories ?? 0));
  const averageCalories =
    visitCalories.reduce((sum, value) => sum + value, 0) / visitCalories.length;
  const lastFive = visitCalories.slice(0, 5);
  const lastFiveAverageCalories =
    lastFive.reduce((sum, value) => sum + value, 0) / lastFive.length;

  return {
    visitCount: perVisitRows.length,
    averageCalories: Math.round(averageCalories),
    lastFiveAverageCalories: Math.round(lastFiveAverageCalories),
  };
}

// ---------------------------------------------------------------------------
// Log menu item as meal
// ---------------------------------------------------------------------------

/**
 * Log a restaurant menu item to the food diary.
 *
 * Creates a nu_foods entry (source='user', brand=restaurant name)
 * and a nu_food_log_item in a transaction.
 */
export function logMenuItemAsMeal(
  db: DatabaseAdapter,
  ids: { foodId: string; logItemId: string },
  input: {
    menuItem: MenuItem;
    restaurantName: string;
    logId: string;
    servingCount?: number;
  },
): void {
  const count = input.servingCount ?? 1;
  const mi = input.menuItem;

  db.transaction(() => {
    // Create a food entry for this menu item
    db.execute(
      `INSERT OR IGNORE INTO nu_foods (id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 0, ?, 'custom', datetime('now'), datetime('now'))`,
      [
        ids.foodId,
        mi.name,
        input.restaurantName,
        mi.servingSize ?? '1 serving',
        mi.calories,
        mi.proteinG,
        mi.carbsG,
        mi.fatG,
        mi.fiberG,
        mi.sodiumMg,
      ],
    );

    // Add to food log
    db.execute(
      `INSERT INTO nu_food_log_items (id, log_id, food_id, serving_count, calories, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.logItemId,
        input.logId,
        ids.foodId,
        count,
        mi.calories * count,
        mi.proteinG * count,
        mi.carbsG * count,
        mi.fatG * count,
      ],
    );
  });
}
