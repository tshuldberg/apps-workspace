/**
 * Dish CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { CreateDishSchema, UpdateDishSchema } from '../../models/schemas';
import type { Dish, CreateDishInput, UpdateDishInput } from '../../models/schemas';

const DISH_COLUMNS = [
  'id',
  'visit_id',
  'restaurant_id',
  'name',
  'course',
  'price_cents',
  'rating',
  'would_order_again',
  'allergens',
  'notes',
  'photo_id',
  'created_at',
  'updated_at',
].join(', ');

export function createDish(
  db: DatabaseAdapter,
  id: string,
  input: CreateDishInput,
): Dish {
  const parsed = CreateDishSchema.parse(input);
  const now = new Date().toISOString();

  const dish: Dish = {
    id,
    visit_id: parsed.visit_id ?? null,
    restaurant_id: parsed.restaurant_id,
    name: parsed.name,
    course: parsed.course ?? null,
    price_cents: parsed.price_cents ?? null,
    rating: parsed.rating ?? null,
    would_order_again: parsed.would_order_again ?? 0,
    allergens: parsed.allergens ?? null,
    notes: parsed.notes ?? null,
    photo_id: parsed.photo_id ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO dn_dishes (${DISH_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dish.id,
      dish.visit_id,
      dish.restaurant_id,
      dish.name,
      dish.course,
      dish.price_cents,
      dish.rating,
      dish.would_order_again,
      dish.allergens,
      dish.notes,
      dish.photo_id,
      dish.created_at,
      dish.updated_at,
    ],
  );

  return dish;
}

export function getDish(
  db: DatabaseAdapter,
  id: string,
): Dish | null {
  const rows = db.query<Dish>(
    `SELECT ${DISH_COLUMNS} FROM dn_dishes WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;
  return rows[0];
}

export function updateDish(
  db: DatabaseAdapter,
  id: string,
  input: UpdateDishInput,
): void {
  const parsed = UpdateDishSchema.parse(input);
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    visit_id: parsed.visit_id,
    name: parsed.name,
    course: parsed.course,
    price_cents: parsed.price_cents,
    rating: parsed.rating,
    would_order_again: parsed.would_order_again,
    allergens: parsed.allergens,
    notes: parsed.notes,
    photo_id: parsed.photo_id,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE dn_dishes SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteDish(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM dn_dishes WHERE id = ?', [id]);
}

export function listDishesByVisit(
  db: DatabaseAdapter,
  visitId: string,
): Dish[] {
  return db.query<Dish>(
    `SELECT ${DISH_COLUMNS} FROM dn_dishes WHERE visit_id = ? ORDER BY created_at`,
    [visitId],
  );
}

export function listDishesByRestaurant(
  db: DatabaseAdapter,
  restaurantId: string,
  opts?: { limit?: number; offset?: number },
): Dish[] {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  return db.query<Dish>(
    `SELECT ${DISH_COLUMNS} FROM dn_dishes
     WHERE restaurant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [restaurantId, limit, offset],
  );
}

export function listTopDishes(
  db: DatabaseAdapter,
  opts?: { limit?: number; offset?: number },
): Dish[] {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  return db.query<Dish>(
    `SELECT ${DISH_COLUMNS} FROM dn_dishes
     WHERE rating >= 4
     ORDER BY rating DESC, name ASC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

export interface AllergenMatch {
  dish: Dish;
  matchedAllergens: string[];
}

export function checkAllergens(
  db: DatabaseAdapter,
  restaurantId: string,
  userAllergens: string[],
): AllergenMatch[] {
  if (userAllergens.length === 0) return [];

  const dishes = db.query<Dish>(
    `SELECT ${DISH_COLUMNS} FROM dn_dishes
     WHERE restaurant_id = ? AND allergens IS NOT NULL`,
    [restaurantId],
  );

  const results: AllergenMatch[] = [];
  const userSet = new Set(userAllergens.map((a) => a.toLowerCase()));

  for (const dish of dishes) {
    if (!dish.allergens) continue;

    let dishAllergens: string[];
    try {
      dishAllergens = JSON.parse(dish.allergens) as string[];
    } catch {
      continue;
    }

    const matched = dishAllergens.filter((a) => userSet.has(a.toLowerCase()));
    if (matched.length > 0) {
      results.push({ dish, matchedAllergens: matched });
    }
  }

  return results;
}
