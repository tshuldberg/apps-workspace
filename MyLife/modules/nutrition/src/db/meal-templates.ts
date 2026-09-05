import type { DatabaseAdapter } from '@mylife/db';
import { addFoodLogItem, createFoodLogEntry, getFoodLogEntries } from './food-log';
import { getFoodById } from './foods';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealTemplate {
  id: string;
  name: string;
  mealType: MealType;
  createdAt: string;
  updatedAt: string;
}

export interface MealTemplateItem {
  id: string;
  templateId: string;
  foodId: string;
  servingCount: number;
  createdAt: string;
}

function rowToTemplate(row: Record<string, unknown>): MealTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    mealType: row.meal_type as MealType,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToItem(row: Record<string, unknown>): MealTemplateItem {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    foodId: row.food_id as string,
    servingCount: row.serving_count as number,
    createdAt: row.created_at as string,
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createMealTemplate(
  db: DatabaseAdapter,
  id: string,
  name: string,
  mealType: MealType,
): void {
  db.execute(
    'INSERT INTO nu_meal_templates (id, name, meal_type) VALUES (?, ?, ?)',
    [id, name, mealType],
  );
}

export function getMealTemplates(db: DatabaseAdapter): MealTemplate[] {
  const rows = db.query('SELECT * FROM nu_meal_templates ORDER BY updated_at DESC');
  return rows.map(rowToTemplate);
}

export function getMealTemplateById(db: DatabaseAdapter, id: string): MealTemplate | null {
  const rows = db.query('SELECT * FROM nu_meal_templates WHERE id = ?', [id]);
  return rows.length > 0 ? rowToTemplate(rows[0]) : null;
}

export function deleteMealTemplate(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_meal_template_items WHERE template_id = ?', [id]);
  db.execute('DELETE FROM nu_meal_templates WHERE id = ?', [id]);
}

export function addMealTemplateItem(
  db: DatabaseAdapter,
  id: string,
  templateId: string,
  foodId: string,
  servingCount: number,
): void {
  db.execute(
    'INSERT INTO nu_meal_template_items (id, template_id, food_id, serving_count) VALUES (?, ?, ?, ?)',
    [id, templateId, foodId, servingCount],
  );
}

export function getMealTemplateItems(db: DatabaseAdapter, templateId: string): MealTemplateItem[] {
  const rows = db.query(
    'SELECT * FROM nu_meal_template_items WHERE template_id = ? ORDER BY created_at',
    [templateId],
  );
  return rows.map(rowToItem);
}

export function deleteMealTemplateItem(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM nu_meal_template_items WHERE id = ?', [id]);
}

export function getMealTemplateCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>('SELECT COUNT(*) as count FROM nu_meal_templates');
  return rows[0]?.count ?? 0;
}

export function logMealTemplate(
  db: DatabaseAdapter,
  templateId: string,
  mealType: MealType,
  date: string,
): number {
  const templateItems = getMealTemplateItems(db, templateId);
  if (templateItems.length === 0) {
    return 0;
  }

  const existingEntry = getFoodLogEntries(db, date).find(
    (entry) => entry.mealType === mealType,
  );
  const logId = existingEntry?.id ?? generateId('nu-log');

  if (!existingEntry) {
    createFoodLogEntry(db, logId, { date, mealType });
  }

  let insertedItems = 0;
  for (const templateItem of templateItems) {
    const food = getFoodById(db, templateItem.foodId);
    if (!food) {
      continue;
    }

    addFoodLogItem(db, generateId('nu-log-item'), {
      logId,
      foodId: food.id,
      servingCount: templateItem.servingCount,
      calories: Math.round(food.calories * templateItem.servingCount),
      proteinG: Math.round(food.proteinG * templateItem.servingCount * 10) / 10,
      carbsG: Math.round(food.carbsG * templateItem.servingCount * 10) / 10,
      fatG: Math.round(food.fatG * templateItem.servingCount * 10) / 10,
    });
    insertedItems += 1;
  }

  return insertedItems;
}
