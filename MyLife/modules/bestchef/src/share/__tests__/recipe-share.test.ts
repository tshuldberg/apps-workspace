import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import { createRecipe } from '../../db/crud';
import type { StructuredIngredient, Step } from '../../types';
import {
  generateShareText,
  generateShareToken,
  getRecipeByShareToken,
  getShareTokenViewCount,
} from '../recipe-share';

describe('recipe sharing', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  function makeIngredient(overrides: Partial<StructuredIngredient> = {}): StructuredIngredient {
    return {
      id: 'i1',
      recipe_id: 'r1',
      section: null,
      quantity_value: 2,
      quantity: '2',
      unit: 'cups',
      item: 'flour',
      name: 'flour',
      prep_note: null,
      is_optional: 0,
      sort_order: 0,
      ...overrides,
    };
  }

  function makeStep(overrides: Partial<Step> = {}): Step {
    return {
      id: 's1',
      recipe_id: 'r1',
      step_number: 1,
      instruction: 'Mix ingredients',
      timer_minutes: null,
      sort_order: 0,
      ...overrides,
    };
  }

  describe('generateShareText', () => {
    it('includes title, ingredients, steps in correct format', () => {
      const recipe = createRecipe(db, 'r1', { title: 'Pasta', servings: 4, prep_time_mins: 10, cook_time_mins: 20 });
      const ingredients = [
        makeIngredient({ item: 'spaghetti', quantity_value: 1, unit: 'lb' }),
        makeIngredient({ id: 'i2', item: 'garlic', quantity_value: 3, unit: 'cloves' }),
      ];
      const steps = [
        makeStep({ instruction: 'Boil water' }),
        makeStep({ id: 's2', step_number: 2, instruction: 'Cook pasta', sort_order: 1 }),
      ];

      const text = generateShareText(recipe, ingredients, steps);
      expect(text).toContain('Pasta');
      expect(text).toContain('spaghetti');
      expect(text).toContain('garlic');
      expect(text).toContain('Boil water');
      expect(text).toContain('Cook pasta');
    });

    it('omits empty sections gracefully', () => {
      const recipe = createRecipe(db, 'r2', { title: 'Simple' });
      const text = generateShareText(recipe, [], []);
      expect(text).toContain('Simple');
      expect(text).not.toContain('Ingredients:');
      expect(text).not.toContain('Steps:');
    });

    it('includes "Shared from MyLife" footer', () => {
      const recipe = createRecipe(db, 'r3', { title: 'Test' });
      const text = generateShareText(recipe, [], []);
      expect(text).toContain('Shared from MyLife');
    });

    it('formats quantities using formatQuantity', () => {
      const recipe = createRecipe(db, 'r4', { title: 'Baking' });
      const ingredients = [
        makeIngredient({ item: 'sugar', quantity_value: 0.5, unit: 'cup' }),
      ];
      const text = generateShareText(recipe, ingredients, []);
      expect(text).toContain('1/2');
    });

    it('formats times using formatDuration', () => {
      const recipe = createRecipe(db, 'r5', { title: 'Slow Cook', prep_time_mins: 15, cook_time_mins: 120 });
      const text = generateShareText(recipe, [], []);
      expect(text).toContain('Prep: 15 min');
      expect(text).toContain('Cook: 2 hrs');
    });

    it('excludes recipe notes (private)', () => {
      const recipe = createRecipe(db, 'r6', { title: 'Private', notes: 'My secret notes' });
      const text = generateShareText(recipe, [], []);
      expect(text).not.toContain('My secret notes');
    });
  });

  describe('generateShareToken', () => {
    it('creates a valid token in rc_share_tokens with recipe_id', () => {
      createRecipe(db, 'r1', { title: 'Shared Recipe' });
      const token = generateShareToken(db, 'r1');

      expect(token.recipe_id).toBe('r1');
      expect(token.token).toBeTruthy();
      expect(token.view_count).toBe(0);
    });
  });

  describe('getRecipeByShareToken', () => {
    it('returns recipe for valid token', () => {
      createRecipe(db, 'r1', { title: 'Shared Recipe' });
      const shareToken = generateShareToken(db, 'r1');

      const recipe = getRecipeByShareToken(db, shareToken.token);
      expect(recipe).not.toBeNull();
      expect(recipe!.title).toBe('Shared Recipe');
    });

    it('returns null for invalid token', () => {
      const recipe = getRecipeByShareToken(db, 'nonexistent-token');
      expect(recipe).toBeNull();
    });

    it('increments view_count', () => {
      createRecipe(db, 'r1', { title: 'Viewed Recipe' });
      const shareToken = generateShareToken(db, 'r1');

      expect(getShareTokenViewCount(db, shareToken.token)).toBe(0);

      getRecipeByShareToken(db, shareToken.token);
      expect(getShareTokenViewCount(db, shareToken.token)).toBe(1);

      getRecipeByShareToken(db, shareToken.token);
      expect(getShareTokenViewCount(db, shareToken.token)).toBe(2);
    });
  });
});
