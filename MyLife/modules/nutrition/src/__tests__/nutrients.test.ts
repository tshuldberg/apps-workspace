import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import { createFood } from '../db/foods';
import { addFoodLogItem, createFoodLogEntry } from '../db/food-log';
import { getDailyNutrientTotals, setFoodNutrient } from '../db/nutrients';

describe('nutrition daily nutrient totals', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;

    createFood(adapter, 'salmon', {
      name: 'Salmon',
      servingSize: 100,
      servingUnit: 'g',
      calories: 200,
      proteinG: 25,
      carbsG: 0,
      fatG: 12,
    });
  });

  afterEach(() => {
    closeDb();
  });

  it('aggregates nutrient totals only for the requested date', () => {
    const vitaminD = adapter.query<{ id: string }>(
      "SELECT id FROM nu_nutrients WHERE name = 'Vitamin D' LIMIT 1",
    )[0];

    setFoodNutrient(adapter, 'food-nutrient-1', 'salmon', vitaminD.id, 10);

    createFoodLogEntry(adapter, 'log-today', { date: '2024-01-15', mealType: 'dinner' });
    addFoodLogItem(adapter, 'item-today', {
      logId: 'log-today',
      foodId: 'salmon',
      servingCount: 1,
      calories: 200,
      proteinG: 25,
      carbsG: 0,
      fatG: 12,
    });

    createFoodLogEntry(adapter, 'log-other', { date: '2024-01-16', mealType: 'dinner' });
    addFoodLogItem(adapter, 'item-other', {
      logId: 'log-other',
      foodId: 'salmon',
      servingCount: 2,
      calories: 400,
      proteinG: 50,
      carbsG: 0,
      fatG: 24,
    });

    const totals = getDailyNutrientTotals(adapter, '2024-01-15');
    const vitaminDTotal = totals.find((item) => item.nutrientId === vitaminD.id);

    expect(vitaminDTotal?.total).toBe(10);
    expect(vitaminDTotal?.percentage).toBeGreaterThan(0);
  });
});
