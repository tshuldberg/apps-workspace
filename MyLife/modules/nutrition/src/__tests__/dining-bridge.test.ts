import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import {
  buildNutritionLogFromVisit,
  buildNutritionMealFromVisit,
  diningCourseToMealType,
} from '../integrations/dining';
import {
  createCustomFood,
  createFoodLogEntry,
  addFoodLogItem,
  getDailyTotals,
  getFoodLogEntries,
  getFoodLogItems,
} from '../db';

describe('dining bridge: spec building', () => {
  it('keeps the legacy prefill helper intact', () => {
    const result = buildNutritionLogFromVisit({
      restaurantName: 'Carbone',
      visitDate: '2026-06-24',
      dishes: [
        { name: 'Spicy Rigatoni', course: 'main' },
        { name: 'Tiramisu', course: 'dessert' },
      ],
    });
    expect(result.sourceModule).toBe('dining');
    expect(result.prefillMealLabel).toBe('Dining at Carbone');
    expect(result.prefillNotes).toContain('Spicy Rigatoni');
  });

  it('maps dining courses onto nutrition meal types', () => {
    expect(diningCourseToMealType('main')).toBe('dinner');
    expect(diningCourseToMealType('appetizer')).toBe('dinner');
    expect(diningCourseToMealType('dessert')).toBe('snack');
    expect(diningCourseToMealType('drink')).toBe('snack');
    expect(diningCourseToMealType(null)).toBe('dinner');
  });

  it('only includes dishes that carry positive calorie macros', () => {
    const spec = buildNutritionMealFromVisit(
      {
        restaurantName: 'Carbone',
        visitDate: '2026-06-24',
        dishes: [
          { name: 'Spicy Rigatoni', course: 'main' },
          { name: 'Bread Basket', course: 'side' },
          { name: 'Tiramisu', course: 'dessert' },
        ],
      },
      [
        { calories: 900, proteinG: 24, carbsG: 110, fatG: 38 },
        null,
        { calories: 0 },
      ],
    );
    expect(spec.foods).toHaveLength(1);
    expect(spec.foods[0].name).toBe('Spicy Rigatoni');
    expect(spec.foods[0].brand).toBe('Carbone');
    expect(spec.totals).toEqual({ calories: 900, proteinG: 24, carbsG: 110, fatG: 38 });
    expect(spec.mealType).toBe('dinner');
    expect(spec.date).toBe('2026-06-24');
  });

  it('aggregates totals across multiple macro dishes', () => {
    const spec = buildNutritionMealFromVisit(
      {
        restaurantName: 'Local Spot',
        visitDate: '2026-06-24',
        dishes: [
          { name: 'Burger', course: 'main' },
          { name: 'Fries', course: 'side' },
        ],
      },
      [
        { calories: 700, proteinG: 35, carbsG: 45, fatG: 40 },
        { calories: 300, proteinG: 4, carbsG: 38, fatG: 15 },
      ],
    );
    expect(spec.foods).toHaveLength(2);
    expect(spec.totals).toEqual({ calories: 1000, proteinG: 39, carbsG: 83, fatG: 55 });
  });

  it('returns no foods when no dish has macros', () => {
    const spec = buildNutritionMealFromVisit(
      {
        restaurantName: 'Carbone',
        visitDate: '2026-06-24',
        dishes: [{ name: 'Water', course: 'drink' }],
      },
      [null],
    );
    expect(spec.foods).toHaveLength(0);
    expect(spec.totals.calories).toBe(0);
  });
});

describe('dining bridge: real nutrition persistence', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('persists a real nu_food_log row and items from a dining meal spec', () => {
    const spec = buildNutritionMealFromVisit(
      {
        restaurantName: 'Carbone',
        visitDate: '2026-06-24',
        dishes: [
          { name: 'Spicy Rigatoni', course: 'main' },
          { name: 'Tiramisu', course: 'dessert' },
        ],
      },
      [
        { calories: 900, proteinG: 24, carbsG: 110, fatG: 38 },
        { calories: 450, proteinG: 6, carbsG: 52, fatG: 24 },
      ],
    );

    const logId = 'log-1';
    createFoodLogEntry(adapter, logId, {
      date: spec.date,
      mealType: spec.mealType,
      notes: spec.notes,
    });
    spec.foods.forEach((food, i) => {
      const created = createCustomFood(adapter, {
        name: food.name,
        brand: food.brand,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
      });
      addFoodLogItem(adapter, `item-${i}`, {
        logId,
        foodId: created.id,
        servingCount: 1,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
      });
    });

    const entries = getFoodLogEntries(adapter, '2026-06-24');
    expect(entries).toHaveLength(1);
    expect(entries[0].mealType).toBe('dinner');

    const items = getFoodLogItems(adapter, logId);
    expect(items).toHaveLength(2);

    const totals = getDailyTotals(adapter, '2026-06-24');
    expect(totals.calories).toBe(1350);
    expect(totals.proteinG).toBe(30);
    expect(totals.carbsG).toBe(162);
    expect(totals.fatG).toBe(62);
  });
});
