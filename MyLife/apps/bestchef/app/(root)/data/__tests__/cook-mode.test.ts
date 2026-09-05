import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '@mylife/bestchef';
import { createSavedRecipe } from '../kitchen';
import { getSavedRecipeCookMode } from '../cook-mode';

describe('getSavedRecipeCookMode (audit M11)', () => {
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

  it('loads a saved recipe title and steps in order for cook mode', () => {
    const recipeId = createSavedRecipe(db, {
      title: 'Weeknight Pasta',
      ingredientsText: '200 g spaghetti',
      stepsText: 'Boil water\nCook pasta for 10 minutes\nDrain and serve',
    });

    const cook = getSavedRecipeCookMode(db, recipeId);
    expect(cook).not.toBeNull();
    expect(cook?.title).toBe('Weeknight Pasta');
    expect(cook?.steps).toEqual([
      'Boil water',
      'Cook pasta for 10 minutes',
      'Drain and serve',
    ]);
  });

  it('returns null for a missing recipe id', () => {
    expect(getSavedRecipeCookMode(db, null)).toBeNull();
    expect(getSavedRecipeCookMode(db, 'does-not-exist')).toBeNull();
  });

  it('returns an empty step list for a recipe with no steps', () => {
    const recipeId = createSavedRecipe(db, {
      title: 'Just a note',
      ingredientsText: 'nothing',
      stepsText: '',
    });
    const cook = getSavedRecipeCookMode(db, recipeId);
    expect(cook?.title).toBe('Just a note');
    expect(cook?.steps).toEqual([]);
  });
});
