import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../definition';
import {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  countRecipes,
  addIngredient,
  getIngredients,
  updateIngredient,
  deleteIngredient,
  addStep,
  getSteps,
  updateStep,
  deleteStep,
  duplicateRecipe,
  addTag,
  getTags,
  deleteTag,
  getSetting,
  setSetting,
} from '../db/crud';

describe('@mylife/bestchef', () => {
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

  describe('RECIPES_MODULE definition', () => {
    it('has correct metadata', () => {
      expect(RECIPES_MODULE.id).toBe('recipes');
      expect(RECIPES_MODULE.tier).toBe('premium');
      expect(RECIPES_MODULE.storageType).toBe('sqlite');
      expect(RECIPES_MODULE.tablePrefix).toBe('rc_');
    });

    it('has BestChef navigation tabs', () => {
      expect(RECIPES_MODULE.name).toBe('BestChef');
      expect(RECIPES_MODULE.navigation.tabs).toHaveLength(4);
    });
  });

  describe('recipes CRUD', () => {
    it('starts empty', () => {
      expect(countRecipes(adapter)).toBe(0);
    });

    it('creates and retrieves a recipe', () => {
      const r = createRecipe(adapter, 'r1', { title: 'Pasta Carbonara' });
      expect(r.title).toBe('Pasta Carbonara');
      expect(r.is_favorite).toBe(0);
      const found = getRecipeById(adapter, 'r1');
      expect(found).not.toBeNull();
      expect(found!.title).toBe('Pasta Carbonara');
    });

    it('creates recipe with full details', () => {
      const r = createRecipe(adapter, 'r1', {
        title: 'Steak', servings: 2, prep_time_mins: 10,
        cook_time_mins: 15, total_time_mins: 25, difficulty: 'medium',
        rating: 4, is_favorite: 1,
      });
      expect(r.servings).toBe(2);
      expect(r.difficulty).toBe('medium');
      expect(r.rating).toBe(4);
    });

    it('persists public submission source attribution', () => {
      createRecipe(adapter, 'r1', {
        title: 'Saved Pad Thai',
        source_url: 'https://bestchef.app/recipe/sub-1',
        source_submission_id: 'sub-1',
        source_chef_id: 'chef-1',
        source_chef_name: 'Somchai K.',
        source_chef_handle: 'somchai_bkk',
      });

      expect(getRecipeById(adapter, 'r1')).toMatchObject({
        source_url: 'https://bestchef.app/recipe/sub-1',
        source_submission_id: 'sub-1',
        source_chef_id: 'chef-1',
        source_chef_name: 'Somchai K.',
        source_chef_handle: 'somchai_bkk',
      });
    });

    it('duplicates sourced recipes as independent local copies', () => {
      createRecipe(adapter, 'r1', {
        title: 'Saved Pad Thai',
        source_url: 'https://bestchef.app/recipe/sub-1',
        source_submission_id: 'sub-1',
        source_chef_id: 'chef-1',
        source_chef_name: 'Somchai K.',
        source_chef_handle: 'somchai_bkk',
      });

      expect(duplicateRecipe(adapter, 'r1', 'r2', [], [], [])).toBe('r2');

      expect(getRecipeById(adapter, 'r2')).toMatchObject({
        title: 'Saved Pad Thai (Copy)',
        source_url: 'https://bestchef.app/recipe/sub-1',
        source_submission_id: null,
        source_chef_name: 'Somchai K.',
      });
    });

    it('lists recipes newest first', () => {
      createRecipe(adapter, 'r1', { title: 'First' });
      createRecipe(adapter, 'r2', { title: 'Second' });
      const recipes = getRecipes(adapter);
      expect(recipes).toHaveLength(2);
      expect(recipes[0].id).toBe('r2');
    });

    it('filters by difficulty', () => {
      createRecipe(adapter, 'r1', { title: 'Easy', difficulty: 'easy' });
      createRecipe(adapter, 'r2', { title: 'Hard', difficulty: 'hard' });
      const results = getRecipes(adapter, { difficulty: 'easy' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Easy');
    });

    it('filters by search', () => {
      createRecipe(adapter, 'r1', { title: 'Pasta Carbonara' });
      createRecipe(adapter, 'r2', { title: 'Steak Frites' });
      const results = getRecipes(adapter, { search: 'Pasta' });
      expect(results).toHaveLength(1);
    });

    it('updates a recipe', () => {
      createRecipe(adapter, 'r1', { title: 'Old' });
      updateRecipe(adapter, 'r1', { title: 'New' });
      expect(getRecipeById(adapter, 'r1')!.title).toBe('New');
    });

    it('deletes a recipe', () => {
      createRecipe(adapter, 'r1', { title: 'Test' });
      deleteRecipe(adapter, 'r1');
      expect(countRecipes(adapter)).toBe(0);
    });
  });

  describe('ingredients', () => {
    it('adds and retrieves ingredients', () => {
      createRecipe(adapter, 'r1', { title: 'Pasta' });
      addIngredient(adapter, 'i1', { recipe_id: 'r1', name: 'Spaghetti', quantity: '200', unit: 'g' });
      addIngredient(adapter, 'i2', { recipe_id: 'r1', name: 'Eggs', quantity: '3' });
      const ingredients = getIngredients(adapter, 'r1');
      expect(ingredients).toHaveLength(2);
      expect(ingredients[0].name).toBe('Spaghetti');
    });

    it('updates an ingredient', () => {
      createRecipe(adapter, 'r1', { title: 'Pasta' });
      addIngredient(adapter, 'i1', { recipe_id: 'r1', name: 'Old' });
      updateIngredient(adapter, 'i1', { name: 'New' });
      const ingredients = getIngredients(adapter, 'r1');
      expect(ingredients[0].name).toBe('New');
    });

    it('deletes an ingredient', () => {
      createRecipe(adapter, 'r1', { title: 'Pasta' });
      addIngredient(adapter, 'i1', { recipe_id: 'r1', name: 'Salt' });
      deleteIngredient(adapter, 'i1');
      expect(getIngredients(adapter, 'r1')).toHaveLength(0);
    });
  });

  describe('steps', () => {
    beforeEach(() => {
      createRecipe(adapter, 'r1', { title: 'Pasta' });
    });

    it('adds, updates, and deletes preparation steps', () => {
      addStep(adapter, 's1', {
        recipe_id: 'r1',
        step_number: 1,
        instruction: 'Boil water',
      });
      addStep(adapter, 's2', {
        recipe_id: 'r1',
        step_number: 2,
        instruction: 'Cook pasta for 10 minutes',
        timer_minutes: 10,
      });

      expect(getSteps(adapter, 'r1').map((step) => step.instruction)).toEqual([
        'Boil water',
        'Cook pasta for 10 minutes',
      ]);

      updateStep(adapter, 's2', { instruction: 'Cook pasta until al dente' });
      expect(getSteps(adapter, 'r1')[1].instruction).toBe('Cook pasta until al dente');

      deleteStep(adapter, 's1');
      expect(getSteps(adapter, 'r1')).toHaveLength(1);
    });
  });

  describe('tags', () => {
    it('adds and retrieves tags', () => {
      createRecipe(adapter, 'r1', { title: 'Pasta' });
      addTag(adapter, 't1', 'r1', 'italian');
      addTag(adapter, 't2', 'r1', 'quick');
      expect(getTags(adapter, 'r1')).toHaveLength(2);
    });

    it('filters recipes by tag', () => {
      createRecipe(adapter, 'r1', { title: 'Pasta' });
      createRecipe(adapter, 'r2', { title: 'Sushi' });
      addTag(adapter, 't1', 'r1', 'italian');
      addTag(adapter, 't2', 'r2', 'japanese');
      const results = getRecipes(adapter, { tag: 'italian' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Pasta');
    });

    it('deletes a tag', () => {
      createRecipe(adapter, 'r1', { title: 'Pasta' });
      addTag(adapter, 't1', 'r1', 'test');
      deleteTag(adapter, 't1');
      expect(getTags(adapter, 'r1')).toHaveLength(0);
    });
  });

  describe('settings', () => {
    it('sets and gets a setting', () => {
      setSetting(adapter, 'measurement', 'metric');
      expect(getSetting(adapter, 'measurement')).toBe('metric');
    });
  });
});
