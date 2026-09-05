import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../definition';
import { createRecipe, addIngredient } from '../db/crud';
import { detectStepTimerMinutes } from '../db/cooking';
import { generateMealPlanShoppingList, upsertMealPlanItem } from '../db/meal-planner';

describe('@mylife/bestchef mygarden features', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('detects step timer from instruction text', () => {
    expect(detectStepTimerMinutes('Bake for 25 minutes at 350F')).toBe(25);
    expect(detectStepTimerMinutes('Simmer for 1 hour 10 minutes')).toBe(70);
  });

  it('aggregates grocery list for meal plans', () => {
    createRecipe(adapter, 'r1', { title: 'Soup' });
    addIngredient(adapter, 'i1', { recipe_id: 'r1', name: 'onion', quantity: '1', unit: 'whole' });
    createRecipe(adapter, 'r2', { title: 'Stew' });
    addIngredient(adapter, 'i2', { recipe_id: 'r2', name: 'onion', quantity: '2', unit: 'whole' });

    upsertMealPlanItem(adapter, {
      weekStartDate: '2026-03-02',
      dayOfWeek: 1,
      mealSlot: 'dinner',
      recipeId: 'r1',
    });
    upsertMealPlanItem(adapter, {
      weekStartDate: '2026-03-02',
      dayOfWeek: 2,
      mealSlot: 'dinner',
      recipeId: 'r2',
    });

    const list = generateMealPlanShoppingList(adapter, '2026-03-02');
    const onion = list.find((item) => item.item === 'onion');
    expect(onion?.quantity).toBe(3);
  });

  // Garden and events tests removed: V7 drops gd_* and ev_* tables.
  // Garden data is now owned by modules/garden, events by modules/rsvp.
});
