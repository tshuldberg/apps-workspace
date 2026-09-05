import type { DatabaseAdapter } from '@mylife/db';
import type { Food } from '../types';

// ---------------------------------------------------------------------------
// Row mapper
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

function generateFoodId(): string {
  return `nu-food-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createFood(
  db: DatabaseAdapter,
  id: string,
  input: {
    name: string;
    brand?: string;
    servingSize: number;
    servingUnit: string;
    calories: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    source?: string;
    barcode?: string;
    usdaNdbNumber?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nu_foods (id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, barcode, usda_ndb_number, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.brand ?? null,
      input.servingSize,
      input.servingUnit,
      input.calories,
      input.proteinG ?? 0,
      input.carbsG ?? 0,
      input.fatG ?? 0,
      input.fiberG ?? 0,
      input.sugarG ?? 0,
      input.sodiumMg ?? 0,
      input.source ?? 'custom',
      input.barcode ?? null,
      input.usdaNdbNumber ?? null,
      now,
      now,
    ],
  );
}

export function getFoodById(db: DatabaseAdapter, id: string): Food | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM nu_foods WHERE id = ?', [id]);
  return rows.length > 0 ? rowToFood(rows[0]) : null;
}

export function getFoodByBarcode(db: DatabaseAdapter, barcode: string): Food | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM nu_foods WHERE barcode = ?', [barcode]);
  return rows.length > 0 ? rowToFood(rows[0]) : null;
}

export function getRecentFoods(db: DatabaseAdapter, limit = 12): Food[] {
  const rows = db.query<{ food_id: string }>(
    `SELECT i.food_id, MAX(i.rowid) as last_rowid
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     GROUP BY i.food_id
     ORDER BY last_rowid DESC
     LIMIT ?`,
    [limit],
  );

  return rows
    .map((row) => getFoodById(db, row.food_id))
    .filter((food): food is Food => food !== null);
}

export function searchFoodsFTS(db: DatabaseAdapter, query: string, limit = 50): Food[] {
  // Sanitize for FTS5: strip non-word chars, wrap each token in quotes to prevent syntax injection
  const sanitized = query.replace(/[^\w\s]/g, '').trim();
  if (!sanitized) return [];
  const ftsQuery = sanitized.split(/\s+/).map((w) => `"${w}"`).join(' ');

  return db
    .query<Record<string, unknown>>(
      `SELECT f.* FROM nu_foods f
       JOIN nu_foods_fts fts ON f.rowid = fts.rowid
       WHERE nu_foods_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      [ftsQuery, limit],
    )
    .map(rowToFood);
}

export function searchFoods(db: DatabaseAdapter, query: string, limit = 50): Food[] {
  const escaped = query.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM nu_foods WHERE name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT ?`,
      [pattern, pattern, limit],
    )
    .map(rowToFood);
}

export function updateFood(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    name: string;
    brand: string;
    servingSize: number;
    servingUnit: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
    source: string;
    barcode: string;
    usdaNdbNumber: string;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
  if (updates.brand !== undefined) { sets.push('brand = ?'); params.push(updates.brand); }
  if (updates.servingSize !== undefined) { sets.push('serving_size = ?'); params.push(updates.servingSize); }
  if (updates.servingUnit !== undefined) { sets.push('serving_unit = ?'); params.push(updates.servingUnit); }
  if (updates.calories !== undefined) { sets.push('calories = ?'); params.push(updates.calories); }
  if (updates.proteinG !== undefined) { sets.push('protein_g = ?'); params.push(updates.proteinG); }
  if (updates.carbsG !== undefined) { sets.push('carbs_g = ?'); params.push(updates.carbsG); }
  if (updates.fatG !== undefined) { sets.push('fat_g = ?'); params.push(updates.fatG); }
  if (updates.fiberG !== undefined) { sets.push('fiber_g = ?'); params.push(updates.fiberG); }
  if (updates.sugarG !== undefined) { sets.push('sugar_g = ?'); params.push(updates.sugarG); }
  if (updates.sodiumMg !== undefined) { sets.push('sodium_mg = ?'); params.push(updates.sodiumMg); }
  if (updates.source !== undefined) { sets.push('source = ?'); params.push(updates.source); }
  if (updates.barcode !== undefined) { sets.push('barcode = ?'); params.push(updates.barcode); }
  if (updates.usdaNdbNumber !== undefined) { sets.push('usda_ndb_number = ?'); params.push(updates.usdaNdbNumber); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  db.execute(`UPDATE nu_foods SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteFood(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_foods WHERE id = ?', [id]);
}

export function createCustomFood(
  db: DatabaseAdapter,
  input: {
    name: string;
    brand?: string;
    servingSize: number;
    servingUnit: string;
    calories: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    barcode?: string;
  },
): Food {
  const id = generateFoodId();
  createFood(db, id, {
    ...input,
    source: 'custom',
  });

  return getFoodById(db, id)!;
}

/**
 * Create a food entry from an AI photo estimate.
 * The food is saved with source='ai_photo' so it can be re-logged quickly.
 */
export function createFoodFromAIEstimate(
  db: DatabaseAdapter,
  estimate: {
    name: string;
    servingSize: string;
    servingUnit: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  },
): Food {
  const id = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nu_foods (id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'ai_photo', ?, ?)`,
    [id, estimate.name, parseFloat(estimate.servingSize) || 100, estimate.servingUnit, estimate.calories, estimate.proteinG, estimate.carbsG, estimate.fatG, now, now],
  );
  return getFoodById(db, id)!;
}
