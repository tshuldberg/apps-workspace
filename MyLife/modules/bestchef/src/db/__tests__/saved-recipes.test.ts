import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import {
  addIngredient,
  addTag,
  createRecipe,
  toggleFavorite,
  updateRecipe,
} from '../crud';
import {
  listDistinctSavedRecipeCuisines,
  listDistinctSavedRecipeIngredients,
  searchSavedRecipes,
} from '../saved-recipes';

describe('saved recipe search facets', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
    seed(adapter);
  });

  afterEach(() => {
    closeDb();
  });

  it('returns all recipes when no filters are provided', () => {
    const rows = searchSavedRecipes(adapter);
    const titles = rows.map((row) => row.title).sort();
    expect(titles).toEqual(['Chicken Curry', 'Pad Thai', 'Tomato Soup']);
  });

  it('filters by case-insensitive title substring', () => {
    const rows = searchSavedRecipes(adapter, { title: 'curry' });
    expect(rows.map((row) => row.title)).toEqual(['Chicken Curry']);
  });

  it('matches recipes containing any of the requested ingredients (OR within facet)', () => {
    const rows = searchSavedRecipes(adapter, { ingredients: ['chicken', 'noodles'] });
    const titles = rows.map((row) => row.title).sort();
    expect(titles).toEqual(['Chicken Curry', 'Pad Thai']);
  });

  it('matches ingredient values stored in the parsed item column', () => {
    // tomato is the parsed item even though the raw line includes quantity/unit prefix
    const rows = searchSavedRecipes(adapter, { ingredients: ['tomato'] });
    expect(rows.map((row) => row.title)).toEqual(['Tomato Soup']);
  });

  it('filters by cuisine multi-select', () => {
    const rows = searchSavedRecipes(adapter, { cuisines: ['Thai', 'Indian'] });
    const titles = rows.map((row) => row.title).sort();
    expect(titles).toEqual(['Chicken Curry', 'Pad Thai']);
  });

  it('caps results by maxTimeMins (uses total_time_mins, falls back to prep + cook)', () => {
    const rows = searchSavedRecipes(adapter, { maxTimeMins: 30 });
    const titles = rows.map((row) => row.title).sort();
    expect(titles).toEqual(['Pad Thai', 'Tomato Soup']);
  });

  it('restricts to favorites when favoritedOnly is true', () => {
    toggleFavorite(adapter, 'recipe-pad-thai');
    const rows = searchSavedRecipes(adapter, { favoritedOnly: true });
    expect(rows.map((row) => row.title)).toEqual(['Pad Thai']);
  });

  it('combines facets with AND semantics across categories', () => {
    // Indian cuisine + chicken ingredient + total time at most 60 = Chicken Curry only.
    const rows = searchSavedRecipes(adapter, {
      cuisines: ['Indian'],
      ingredients: ['chicken'],
      maxTimeMins: 60,
    });
    expect(rows.map((row) => row.title)).toEqual(['Chicken Curry']);
  });

  it('returns ingredient_count, step_count, and grocery_flagged in each row', () => {
    const rows = searchSavedRecipes(adapter, { title: 'Pad Thai' });
    expect(rows).toHaveLength(1);
    expect(rows[0].ingredient_count).toBeGreaterThan(0);
    expect(rows[0].step_count).toBe(0);
    expect(rows[0].grocery_flagged).toBe(0);
  });

  it('lists distinct ingredient items for the facet picker', () => {
    const items = listDistinctSavedRecipeIngredients(adapter);
    // Items include parsed item names; deduped case-insensitively.
    expect(items.length).toBeGreaterThan(0);
    const lower = items.map((item) => item.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
    expect(lower).toEqual(expect.arrayContaining(['chicken', 'tomato']));
  });

  it('lists distinct cuisines from recipe tags', () => {
    const cuisines = listDistinctSavedRecipeCuisines(adapter);
    expect(cuisines).toEqual(expect.arrayContaining(['Indian', 'Thai']));
  });
});

function seed(adapter: DatabaseAdapter): void {
  // Pad Thai - quick, Thai, includes noodles + chicken
  createRecipe(adapter, 'recipe-pad-thai', {
    title: 'Pad Thai',
    prep_time_mins: 10,
    cook_time_mins: 15,
    total_time_mins: 25,
  });
  addIngredient(adapter, 'ing-pad-thai-noodles', {
    recipe_id: 'recipe-pad-thai',
    name: '8 oz rice noodles',
    quantity: '8',
    quantity_value: 8,
    unit: 'oz',
    item: 'rice noodles',
    sort_order: 0,
  });
  addIngredient(adapter, 'ing-pad-thai-chicken', {
    recipe_id: 'recipe-pad-thai',
    name: '1 lb chicken thighs',
    quantity: '1',
    quantity_value: 1,
    unit: 'lb',
    item: 'chicken',
    sort_order: 1,
  });
  addTag(adapter, 'tag-pad-thai-thai', 'recipe-pad-thai', 'Thai');

  // Chicken Curry - longer, Indian, has chicken
  createRecipe(adapter, 'recipe-chicken-curry', {
    title: 'Chicken Curry',
    prep_time_mins: 15,
    cook_time_mins: 45,
  });
  addIngredient(adapter, 'ing-curry-chicken', {
    recipe_id: 'recipe-chicken-curry',
    name: '2 lb chicken breast',
    quantity: '2',
    quantity_value: 2,
    unit: 'lb',
    item: 'chicken',
    sort_order: 0,
  });
  addIngredient(adapter, 'ing-curry-coconut', {
    recipe_id: 'recipe-chicken-curry',
    name: '1 can coconut milk',
    quantity: '1',
    quantity_value: 1,
    unit: 'can',
    item: 'coconut milk',
    sort_order: 1,
  });
  addTag(adapter, 'tag-curry-indian', 'recipe-chicken-curry', 'Indian');
  // Provide explicit total_time_mins to confirm the COALESCE branch.
  updateRecipe(adapter, 'recipe-chicken-curry', { total_time_mins: 60 });

  // Tomato Soup - quick, no cuisine tag
  createRecipe(adapter, 'recipe-tomato-soup', {
    title: 'Tomato Soup',
    prep_time_mins: 5,
    cook_time_mins: 20,
    total_time_mins: 25,
  });
  addIngredient(adapter, 'ing-soup-tomato', {
    recipe_id: 'recipe-tomato-soup',
    name: '4 large tomatoes',
    quantity: '4',
    quantity_value: 4,
    unit: 'piece',
    item: 'tomato',
    sort_order: 0,
  });
}
