import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import { addIngredient, createRecipe } from '../crud';
import { createPantryItem, getPantryBatches, getPantryItemById } from '../pantry';
import {
  addRecipeIngredientToPantry,
  applyRecipeCookPantryReview,
  getRecipeCookHistory,
  getRecipeCookPantryReview,
} from '../cooking';

describe('recipe cooking pantry review', () => {
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

  function seedRecipe(): void {
    createRecipe(adapter, 'recipe-pancakes', {
      title: 'Pancakes',
      servings: 2,
    });
    addIngredient(adapter, 'ing-milk', {
      recipe_id: 'recipe-pancakes',
      name: '1 cup milk',
      quantity: '1',
      quantity_value: 1,
      unit: 'cup',
      item: 'milk',
      sort_order: 0,
    });
    addIngredient(adapter, 'ing-egg', {
      recipe_id: 'recipe-pancakes',
      name: '1 egg',
      quantity: '1',
      quantity_value: 1,
      unit: 'item',
      item: 'egg',
      sort_order: 1,
    });
  }

  it('creates the cook history table as personal recipe data', () => {
    const rows = adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name = 'rc_recipe_cook_history'`,
    );

    expect(rows.map((row) => row.name)).toEqual(['rc_recipe_cook_history']);
    expect(RECIPES_MODULE.schemaVersion).toBe(34);
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'recipe_cook_history')?.maxScope,
    ).toBe('personal_replica');
  });

  it('builds editable pantry decrements and applies them with a cook timestamp', () => {
    seedRecipe();
    const milk = createPantryItem(adapter, {
      name: 'milk',
      quantity: 1000,
      unit: 'ml',
      storage_location: 'fridge',
      grocery_section: 'dairy',
    });

    const review = getRecipeCookPantryReview(adapter, 'recipe-pancakes', {
      servings: 2,
      cookedAt: '2026-04-27T18:30:00.000Z',
    });

    expect(review?.items.map((item) => [item.ingredientId, item.status])).toEqual([
      ['ing-milk', 'matched'],
      ['ing-egg', 'not_tracked'],
    ]);
    const milkReview = review?.items.find((item) => item.ingredientId === 'ing-milk');
    expect(milkReview?.suggestedDecrementUnit).toBe('ml');
    expect(milkReview?.suggestedDecrementQuantity).toBeCloseTo(473.176, 3);

    const result = applyRecipeCookPantryReview(adapter, {
      recipeId: 'recipe-pancakes',
      servings: 2,
      cookedAt: '2026-04-27T18:30:00.000Z',
      decrements: [
        {
          ingredientId: 'ing-milk',
          pantryItemId: milk.id,
          quantity: milkReview?.suggestedDecrementQuantity ?? 0,
          unit: milkReview?.suggestedDecrementUnit,
        },
      ],
    });

    expect(result.historyEntry.cooked_at).toBe('2026-04-27T18:30:00.000Z');
    expect(result.updatedPantryItems).toHaveLength(1);
    expect(getPantryItemById(adapter, milk.id)?.quantity).toBeCloseTo(526.824, 3);
    expect(getPantryBatches(adapter, milk.id)[0]?.quantity).toBeCloseTo(526.824, 3);
    expect(getRecipeCookHistory(adapter, 'recipe-pancakes')).toHaveLength(1);
  });

  it('adds an unmatched recipe ingredient to pantry from the cook review', () => {
    seedRecipe();

    const created = addRecipeIngredientToPantry(adapter, 'recipe-pancakes', 'ing-egg');

    expect(created).toMatchObject({
      name: 'egg',
      quantity: 1,
      unit: 'item',
      grocery_section: 'dairy',
    });
    expect(getRecipeCookPantryReview(adapter, 'recipe-pancakes')?.items.find((item) => item.ingredientId === 'ing-egg')).toMatchObject({
      pantryItemId: created?.id,
      status: 'matched',
    });
  });
});
