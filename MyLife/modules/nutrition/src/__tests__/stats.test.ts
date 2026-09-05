import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import { createFood } from '../db/foods';
import { createFoodLogEntry, addFoodLogItem } from '../db/food-log';
import { createDailyGoals } from '../db/goals';
import { getDailySummary, getDailyGoalProgress, getMealBreakdown } from '../stats/daily-summary';
import { getMacroRatios } from '../stats/trends';

describe('stats', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;

    // Set up test data
    createFood(adapter, 'chicken', { name: 'Chicken', servingSize: 100, servingUnit: 'g', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    createFood(adapter, 'rice', { name: 'Rice', servingSize: 100, servingUnit: 'g', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 });

    createFoodLogEntry(adapter, 'breakfast', { date: '2024-01-15', mealType: 'breakfast' });
    addFoodLogItem(adapter, 'b-item', { logId: 'breakfast', foodId: 'rice', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 });

    createFoodLogEntry(adapter, 'lunch', { date: '2024-01-15', mealType: 'lunch' });
    addFoodLogItem(adapter, 'l-item1', { logId: 'lunch', foodId: 'chicken', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
    addFoodLogItem(adapter, 'l-item2', { logId: 'lunch', foodId: 'rice', calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 });
  });

  afterEach(() => {
    closeDb();
  });

  describe('daily summary', () => {
    it('calculates correct totals', () => {
      const summary = getDailySummary(adapter, '2024-01-15');
      expect(summary.calories).toBe(425);
      expect(summary.proteinG).toBeCloseTo(36.4, 1);
      expect(summary.carbsG).toBe(56);
      expect(summary.fatG).toBeCloseTo(4.2, 1);
      expect(summary.mealCount).toBe(2);
    });

    it('returns zeros for empty date', () => {
      const summary = getDailySummary(adapter, '2099-12-31');
      expect(summary.calories).toBe(0);
      expect(summary.mealCount).toBe(0);
    });
  });

  describe('meal breakdown', () => {
    it('breaks down by meal type', () => {
      const breakdown = getMealBreakdown(adapter, '2024-01-15');
      expect(breakdown).toHaveLength(2);
      const breakfast = breakdown.find((m) => m.mealType === 'breakfast');
      const lunch = breakdown.find((m) => m.mealType === 'lunch');
      expect(breakfast!.calories).toBe(130);
      expect(lunch!.calories).toBe(295);
      expect(lunch!.itemCount).toBe(2);
    });
  });

  describe('goal progress', () => {
    it('calculates percentages against goals', () => {
      createDailyGoals(adapter, 'g1', { calories: 2000, proteinG: 150, carbsG: 250, fatG: 67, effectiveDate: '2024-01-01' });
      const progress = getDailyGoalProgress(adapter, '2024-01-15');
      expect(progress).not.toBeNull();
      expect(progress!.calories.consumed).toBe(425);
      expect(progress!.calories.goal).toBe(2000);
      expect(progress!.calories.percentage).toBe(21);
    });

    it('returns null when no goals set', () => {
      expect(getDailyGoalProgress(adapter, '2024-01-15')).toBeNull();
    });
  });

  describe('macro ratios', () => {
    it('calculates protein/carb/fat percentages', () => {
      const ratios = getMacroRatios(adapter, '2024-01-15', '2024-01-15');
      // protein: 36.4 * 4 = 145.6 cal
      // carbs: 56 * 4 = 224 cal
      // fat: 4.2 * 9 = 37.8 cal
      // total macro cal: 407.4
      expect(ratios.proteinPct).toBeGreaterThan(30);
      expect(ratios.carbsPct).toBeGreaterThan(50);
      expect(ratios.fatPct).toBeGreaterThan(5);
      expect(ratios.proteinPct + ratios.carbsPct + ratios.fatPct).toBeCloseTo(100, -1);
    });
  });
});
