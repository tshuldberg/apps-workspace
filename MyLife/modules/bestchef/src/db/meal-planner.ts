import type { DatabaseAdapter } from '@mylife/db';
import type {
  ConsolidatedShoppingItem,
  MealPlan,
  MealPlanItem,
  MealPlanWeek,
  MealSlot,
} from '../types';
import { generateShoppingList } from '../grocery';

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeWeekStartDate(date: string | Date): string {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00.000Z`) : new Date(date.getTime());
  const day = value.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  value.setUTCDate(value.getUTCDate() - diffToMonday);
  value.setUTCHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
}

function getMealPlan(db: DatabaseAdapter, weekStartDateInput: string): MealPlan | null {
  const weekStartDate = normalizeWeekStartDate(weekStartDateInput);
  const existing = db.query<MealPlan>(
    `SELECT id, week_start_date, created_at, updated_at
     FROM rc_meal_plans
     WHERE week_start_date = ?`,
    [weekStartDate],
  );
  return existing[0] ?? null;
}

function getOrCreateMealPlan(db: DatabaseAdapter, weekStartDateInput: string): MealPlan {
  const plan = getMealPlan(db, weekStartDateInput);
  if (plan) return plan;

  const weekStartDate = normalizeWeekStartDate(weekStartDateInput);
  const id = randomId('meal-plan');
  const now = nowIso();
  db.execute(
    `INSERT INTO rc_meal_plans (id, week_start_date, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [id, weekStartDate, now, now],
  );
  return {
    id,
    week_start_date: weekStartDate,
    created_at: now,
    updated_at: now,
  };
}

export function upsertMealPlanItem(
  db: DatabaseAdapter,
  input: {
    weekStartDate: string;
    dayOfWeek: number;
    mealSlot: MealSlot;
    recipeId: string;
    servings?: number;
  },
): MealPlanItem {
  const plan = getOrCreateMealPlan(db, input.weekStartDate);
  const now = nowIso();
  const servings = Math.max(1, input.servings ?? 1);

  const existing = db.query<MealPlanItem>(
    `SELECT id, meal_plan_id, recipe_id, day_of_week, meal_slot, servings, created_at, updated_at
     FROM rc_meal_plan_items
     WHERE meal_plan_id = ? AND day_of_week = ? AND meal_slot = ?`,
    [plan.id, input.dayOfWeek, input.mealSlot],
  );

  if (existing.length > 0) {
    db.execute(
      `UPDATE rc_meal_plan_items
       SET recipe_id = ?, servings = ?, updated_at = ?
       WHERE id = ?`,
      [input.recipeId, servings, now, existing[0].id],
    );
    return {
      ...existing[0],
      recipe_id: input.recipeId,
      servings,
      updated_at: now,
    };
  }

  const id = randomId('meal-item');
  db.execute(
    `INSERT INTO rc_meal_plan_items
      (id, meal_plan_id, recipe_id, day_of_week, meal_slot, servings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, plan.id, input.recipeId, input.dayOfWeek, input.mealSlot, servings, now, now],
  );

  return {
    id,
    meal_plan_id: plan.id,
    recipe_id: input.recipeId,
    day_of_week: input.dayOfWeek,
    meal_slot: input.mealSlot,
    servings,
    created_at: now,
    updated_at: now,
  };
}

export function removeMealPlanItem(db: DatabaseAdapter, mealPlanItemId: string): void {
  db.execute(`DELETE FROM rc_meal_plan_items WHERE id = ?`, [mealPlanItemId]);
}

/** Pure read -- returns empty array if no plan exists for this week. */
export function getMealPlanWeek(
  db: DatabaseAdapter,
  weekStartDate: string,
): Array<MealPlanItem & { recipe_title: string; recipe_image_uri: string | null }> {
  const weekDate = normalizeWeekStartDate(weekStartDate);
  return db.query<MealPlanItem & { recipe_title: string; recipe_image_uri: string | null }>(
    `SELECT
      i.id,
      i.meal_plan_id,
      i.recipe_id,
      i.day_of_week,
      i.meal_slot,
      i.servings,
      i.created_at,
      i.updated_at,
      r.title AS recipe_title,
      r.image_uri AS recipe_image_uri
     FROM rc_meal_plan_items i
     JOIN rc_recipes r ON r.id = i.recipe_id
     JOIN rc_meal_plans p ON p.id = i.meal_plan_id
     WHERE p.week_start_date = ?
     ORDER BY i.day_of_week ASC, i.meal_slot ASC`,
    [weekDate],
  );
}

/** Auto-creates a plan row if none exists (write-path entry point for planner UI). */
export function getMealPlanWeekBundle(db: DatabaseAdapter, weekStartDate: string): MealPlanWeek {
  const plan = getOrCreateMealPlan(db, weekStartDate);
  return {
    plan,
    items: getMealPlanWeek(db, weekStartDate),
  };
}

export function generateMealPlanShoppingList(
  db: DatabaseAdapter,
  weekStartDate: string,
): ConsolidatedShoppingItem[] {
  const items = getMealPlanWeek(db, weekStartDate);
  if (items.length === 0) {
    return [];
  }

  return generateShoppingList(db, {
    recipeIds: items.map((item) => item.recipe_id),
    subtractPantry: true,
    subtractStaples: true,
  }).map((item) => ({
    item: item.item,
    quantity: item.needed ?? item.quantity,
    unit: item.unit,
    in_stock: item.inPantry,
    grocery_section: item.grocerySection,
    needed: item.needed,
    recipe_ids: item.recipeIds,
  }));
}
