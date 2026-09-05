import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import { createFood } from '../db/foods';
import { createFoodLogEntry, addFoodLogItem } from '../db/food-log';
import { exportFoodLogCSV, exportNutritionSummaryCSV } from '../export/csv';

describe('CSV export', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;

    createFood(adapter, 'chicken', { name: 'Chicken Breast', servingSize: 100, servingUnit: 'g', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    createFoodLogEntry(adapter, 'log1', { date: '2024-01-15', mealType: 'lunch' });
    addFoodLogItem(adapter, 'item1', { logId: 'log1', foodId: 'chicken', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
  });

  afterEach(() => {
    closeDb();
  });

  describe('food log CSV', () => {
    it('includes correct headers', () => {
      const csv = exportFoodLogCSV(adapter);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Date,Meal,Food,Servings,Unit,Calories,Protein (g),Carbs (g),Fat (g)');
    });

    it('includes food data row', () => {
      const csv = exportFoodLogCSV(adapter);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('2024-01-15');
      expect(lines[1]).toContain('lunch');
      expect(lines[1]).toContain('Chicken Breast');
    });

    it('filters by date range', () => {
      const csv = exportFoodLogCSV(adapter, '2024-02-01', '2024-02-28');
      const lines = csv.split('\n');
      expect(lines).toHaveLength(1); // header only
    });

    it('produces valid CSV with headers only when empty', () => {
      const csv = exportFoodLogCSV(adapter, '2099-01-01', '2099-12-31');
      expect(csv).toBe('Date,Meal,Food,Servings,Unit,Calories,Protein (g),Carbs (g),Fat (g)');
    });
  });

  describe('summary CSV', () => {
    it('includes correct headers', () => {
      const csv = exportNutritionSummaryCSV(adapter);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Date,Calories,Protein (g),Carbs (g),Fat (g),Meals');
    });

    it('aggregates daily totals', () => {
      const csv = exportNutritionSummaryCSV(adapter);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('2024-01-15');
    });
  });
});
