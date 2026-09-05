import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../definition';
import { createRecipe, addIngredient } from '../db/crud';
import {
  createShoppingList,
  getShoppingLists,
  getShoppingListById,
  updateShoppingList,
  deleteShoppingList,
  archiveShoppingList,
  restoreShoppingList,
  completeShoppingList,
  duplicateShoppingList,
  addShoppingListItem,
  getShoppingListItems,
  updateShoppingListItem,
  deleteShoppingListItem,
  toggleItemChecked,
  uncheckAllItems,
  addRecipeToShoppingList,
  removeRecipeFromShoppingList,
  addCustomItem,
  addCheckedItemsToPantry,
  getShoppingListSummary,
  getRecipesInShoppingList,
  setRecipeGroceryFlag,
  removeRecipeGroceryFlag,
  isRecipeFlaggedForGrocery,
  getGroceryFlaggedRecipes,
  addFlaggedRecipesToShoppingList,
} from '../db/shopping-lists';

describe('shopping lists', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;
  let idCounter = 0;

  function nextId(): string {
    return `test-id-${++idCounter}`;
  }

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
    idCounter = 0;
  });

  afterEach(() => {
    closeDb();
  });

  describe('list CRUD', () => {
    it('creates and retrieves a shopping list', () => {
      createShoppingList(db, 'list-1', 'Groceries', {
        store_name: 'Market Basket',
        event_name: 'Dinner Party',
        event_date: '2026-05-04',
      });
      const list = getShoppingListById(db, 'list-1');
      expect(list).not.toBeNull();
      expect(list!.name).toBe('Groceries');
      expect(list!.store_name).toBe('Market Basket');
      expect(list!.event_name).toBe('Dinner Party');
      expect(list!.event_date).toBe('2026-05-04');
      expect(list!.is_active).toBe(1);
      expect(list!.archived_at).toBeNull();
    });

    it('returns null for non-existent list', () => {
      expect(getShoppingListById(db, 'nope')).toBeNull();
    });

    it('gets active lists by default and supports archived filters', () => {
      createShoppingList(db, 'list-1', 'Active');
      createShoppingList(db, 'list-2', 'Will Complete');
      completeShoppingList(db, 'list-2');

      const active = getShoppingLists(db);
      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('Active');

      const archived = getShoppingLists(db, 'archived');
      expect(archived).toHaveLength(1);
      expect(archived[0].name).toBe('Will Complete');
      expect(archived[0].archived_at).not.toBeNull();

      const all = getShoppingLists(db, false);
      expect(all).toHaveLength(2);
    });

    it('updates list name and metadata', () => {
      createShoppingList(db, 'list-1', 'Old Name');
      updateShoppingList(db, 'list-1', {
        name: 'New Name',
        store_name: 'Costco',
        event_name: 'Meal Prep',
        event_date: '2026-05-08',
      });
      const list = getShoppingListById(db, 'list-1')!;
      expect(list.name).toBe('New Name');
      expect(list.store_name).toBe('Costco');
      expect(list.event_name).toBe('Meal Prep');
      expect(list.event_date).toBe('2026-05-08');
    });

    it('deletes a list', () => {
      createShoppingList(db, 'list-1', 'To Delete');
      deleteShoppingList(db, 'list-1');
      expect(getShoppingListById(db, 'list-1')).toBeNull();
    });

    it('completes a list (sets is_active = 0)', () => {
      createShoppingList(db, 'list-1', 'Trip');
      completeShoppingList(db, 'list-1');
      expect(getShoppingListById(db, 'list-1')!.is_active).toBe(0);
    });

    it('archives and restores a list with archived timestamp', () => {
      createShoppingList(db, 'list-1', 'Trip');

      archiveShoppingList(db, 'list-1');
      const archived = getShoppingListById(db, 'list-1')!;
      expect(archived.is_active).toBe(0);
      expect(archived.archived_at).not.toBeNull();

      restoreShoppingList(db, 'list-1');
      const restored = getShoppingListById(db, 'list-1')!;
      expect(restored.is_active).toBe(1);
      expect(restored.archived_at).toBeNull();
    });

    it('duplicates a list with metadata and unchecked copied items by default', () => {
      createShoppingList(db, 'list-1', 'Weekly', {
        store_name: 'Trader Joe\'s',
        event_name: 'Sunday Prep',
      });
      addShoppingListItem(db, 'item-1', 'list-1', {
        item: 'Milk',
        quantity: 1,
        unit: 'gallon',
        grocery_section: 'dairy',
        sort_order: 0,
      });
      toggleItemChecked(db, 'item-1');

      const copied = duplicateShoppingList(db, 'list-1', 'list-2', nextId);

      expect(copied).toMatchObject({
        id: 'list-2',
        name: 'Weekly Copy',
        store_name: 'Trader Joe\'s',
        event_name: 'Sunday Prep',
        is_active: 1,
      });
      const copiedItems = getShoppingListItems(db, 'list-2');
      expect(copiedItems).toHaveLength(1);
      expect(copiedItems[0]).toMatchObject({
        item: 'Milk',
        quantity: 1,
        unit: 'gallon',
        grocery_section: 'dairy',
        is_checked: 0,
      });
    });

    it('can duplicate a list while preserving checked state and overriding metadata', () => {
      createShoppingList(db, 'list-1', 'Weekly');
      addShoppingListItem(db, 'item-1', 'list-1', {
        item: 'Bread',
        grocery_section: 'bakery',
      });
      toggleItemChecked(db, 'item-1');

      const copied = duplicateShoppingList(db, 'list-1', 'list-2', nextId, {
        name: 'Party',
        event_name: 'Birthday',
        includeCheckedState: true,
      });

      expect(copied?.name).toBe('Party');
      expect(copied?.event_name).toBe('Birthday');
      expect(getShoppingListItems(db, 'list-2')[0].is_checked).toBe(1);
    });

    it('returns null when duplicating a missing list', () => {
      expect(duplicateShoppingList(db, 'missing', 'list-2', nextId)).toBeNull();
    });
  });

  describe('item CRUD', () => {
    beforeEach(() => {
      createShoppingList(db, 'list-1', 'Test List');
    });

    it('adds and retrieves items', () => {
      addShoppingListItem(db, 'item-1', 'list-1', {
        item: 'Milk',
        quantity: 1,
        unit: 'gallon',
        grocery_section: 'dairy',
      });
      addShoppingListItem(db, 'item-2', 'list-1', {
        item: 'Bread',
        grocery_section: 'bakery',
      });

      const items = getShoppingListItems(db, 'list-1');
      expect(items).toHaveLength(2);
    });

    it('updates an item', () => {
      addShoppingListItem(db, 'item-1', 'list-1', {
        item: 'Eggs',
        quantity: 12,
        grocery_section: 'dairy',
      });
      updateShoppingListItem(db, 'item-1', { quantity: 24 });

      const items = getShoppingListItems(db, 'list-1');
      expect(items[0].quantity).toBe(24);
    });

    it('deletes an item', () => {
      addShoppingListItem(db, 'item-1', 'list-1', { item: 'Butter', grocery_section: 'dairy' });
      deleteShoppingListItem(db, 'item-1');
      expect(getShoppingListItems(db, 'list-1')).toHaveLength(0);
    });

    it('toggles item checked state', () => {
      addShoppingListItem(db, 'item-1', 'list-1', { item: 'Flour', grocery_section: 'pantry' });

      const checked = toggleItemChecked(db, 'item-1');
      expect(checked).toBe(true);

      const unchecked = toggleItemChecked(db, 'item-1');
      expect(unchecked).toBe(false);
    });

    it('unchecks all items in a list', () => {
      addShoppingListItem(db, 'item-1', 'list-1', { item: 'A', grocery_section: 'other' });
      addShoppingListItem(db, 'item-2', 'list-1', { item: 'B', grocery_section: 'other' });
      toggleItemChecked(db, 'item-1');
      toggleItemChecked(db, 'item-2');

      uncheckAllItems(db, 'list-1');

      const items = getShoppingListItems(db, 'list-1');
      expect(items.every((i) => !i.is_checked)).toBe(true);
    });
  });

  describe('recipe integration', () => {
    beforeEach(() => {
      createShoppingList(db, 'list-1', 'Meal Prep');

      // Create a recipe with ingredients
      createRecipe(db, 'recipe-1', { title: 'Pasta', servings: 4 });
      addIngredient(db, 'ing-1', {
        recipe_id: 'recipe-1',
        name: 'spaghetti',
        item: 'spaghetti',
        quantity: '400',
        quantity_value: 400,
        unit: 'g',
        sort_order: 0,
      });
      addIngredient(db, 'ing-2', {
        recipe_id: 'recipe-1',
        name: 'olive oil',
        item: 'olive oil',
        quantity: '2',
        quantity_value: 2,
        unit: 'tbsp',
        sort_order: 1,
      });
    });

    it('adds recipe ingredients to shopping list', () => {
      addRecipeToShoppingList(db, 'list-1', 'recipe-1', 1, nextId);

      const items = getShoppingListItems(db, 'list-1');
      expect(items).toHaveLength(2);
      expect(items.some((i) => i.item === 'spaghetti')).toBe(true);
      expect(items.some((i) => i.item === 'olive oil')).toBe(true);
    });

    it('keeps unquantified recipe ingredient lines intact for grocery review', () => {
      addIngredient(db, 'ing-3', {
        recipe_id: 'recipe-1',
        name: 'salt and pepper, to taste',
        item: 'salt and pepper',
        quantity: null,
        quantity_value: null,
        unit: null,
        prep_note: 'to taste',
        sort_order: 2,
      });

      addRecipeToShoppingList(db, 'list-1', 'recipe-1', 1, nextId);

      const items = getShoppingListItems(db, 'list-1');
      expect(items.find((i) => i.item === 'salt and pepper, to taste')).toMatchObject({
        quantity: null,
        unit: null,
        recipe_id: 'recipe-1',
      });
    });

    it('scales ingredient quantities by multiplier', () => {
      addRecipeToShoppingList(db, 'list-1', 'recipe-1', 2, nextId);

      const items = getShoppingListItems(db, 'list-1');
      const spaghetti = items.find((i) => i.item === 'spaghetti');
      expect(spaghetti!.quantity).toBe(800);
    });

    it('removes recipe items from shopping list', () => {
      addRecipeToShoppingList(db, 'list-1', 'recipe-1', 1, nextId);
      expect(getShoppingListItems(db, 'list-1')).toHaveLength(2);

      removeRecipeFromShoppingList(db, 'list-1', 'recipe-1');
      expect(getShoppingListItems(db, 'list-1')).toHaveLength(0);
    });

    it('tracks which recipes are in the list', () => {
      addRecipeToShoppingList(db, 'list-1', 'recipe-1', 2, nextId);

      const recipes = getRecipesInShoppingList(db, 'list-1');
      expect(recipes).toHaveLength(1);
      expect(recipes[0].recipe_title).toBe('Pasta');
      expect(recipes[0].multiplier).toBe(2);
    });
  });

  describe('custom items', () => {
    beforeEach(() => {
      createShoppingList(db, 'list-1', 'Quick Run');
    });

    it('adds a custom item with NLP parsing', () => {
      addCustomItem(db, 'c1', 'list-1', '2 cups flour');

      const items = getShoppingListItems(db, 'list-1');
      expect(items).toHaveLength(1);
      expect(items[0].is_custom).toBe(1);
      expect(items[0].item).toBe('flour');
      expect(items[0].quantity).toBe(2);
      expect(items[0].unit).toBe('cup');
    });

    it('adds a simple item without quantity', () => {
      addCustomItem(db, 'c1', 'list-1', 'bananas');

      const items = getShoppingListItems(db, 'list-1');
      expect(items).toHaveLength(1);
      expect(items[0].item).toBe('bananas');
    });
  });

  describe('pantry sync', () => {
    beforeEach(() => {
      createShoppingList(db, 'list-1', 'Trip');
      addShoppingListItem(db, 'item-1', 'list-1', {
        item: 'Milk',
        quantity: 1,
        unit: 'gallon',
        grocery_section: 'dairy',
      });
      addShoppingListItem(db, 'item-2', 'list-1', {
        item: 'Bread',
        grocery_section: 'bakery',
      });
      // Check both items
      toggleItemChecked(db, 'item-1');
      toggleItemChecked(db, 'item-2');
    });

    it('adds checked items to pantry', () => {
      const count = addCheckedItemsToPantry(db, 'list-1', nextId);
      expect(count).toBe(2);

      // Verify pantry items exist
      const pantryItems = db.query<{ name: string }>(
        `SELECT name FROM rc_pantry_items ORDER BY name`,
      );
      expect(pantryItems).toHaveLength(2);
      expect(pantryItems[0].name).toBe('Bread');
      expect(pantryItems[1].name).toBe('Milk');
    });

    it('skips duplicate pantry items', () => {
      addCheckedItemsToPantry(db, 'list-1', nextId);
      const count2 = addCheckedItemsToPantry(db, 'list-1', nextId);
      expect(count2).toBe(0);
    });
  });

  describe('summary', () => {
    it('returns summary with counts', () => {
      createShoppingList(db, 'list-1', 'Weekly');
      addShoppingListItem(db, 'i1', 'list-1', { item: 'A', grocery_section: 'other', is_custom: 1 });
      addShoppingListItem(db, 'i2', 'list-1', { item: 'B', grocery_section: 'other' });
      addShoppingListItem(db, 'i3', 'list-1', { item: 'C', grocery_section: 'other' });
      toggleItemChecked(db, 'i1');

      const summary = getShoppingListSummary(db, 'list-1');
      expect(summary).not.toBeNull();
      expect(summary!.totalItems).toBe(3);
      expect(summary!.checkedItems).toBe(1);
      expect(summary!.customItemCount).toBe(1);
    });

    it('returns null for non-existent list', () => {
      expect(getShoppingListSummary(db, 'nope')).toBeNull();
    });
  });

  describe('recipe grocery flags', () => {
    beforeEach(() => {
      createRecipe(db, 'recipe-1', { title: 'Pasta', servings: 4 });
      addIngredient(db, 'ing-1', {
        recipe_id: 'recipe-1',
        name: 'spaghetti',
        item: 'spaghetti',
        quantity: '400',
        quantity_value: 400,
        unit: 'g',
      });
      createRecipe(db, 'recipe-2', { title: 'Soup', servings: 2 });
      addIngredient(db, 'ing-2', {
        recipe_id: 'recipe-2',
        name: 'carrots',
        item: 'carrots',
        quantity: '3',
        quantity_value: 3,
        unit: null,
      });
    });

    it('sets, lists, and removes grocery flags', () => {
      expect(isRecipeFlaggedForGrocery(db, 'recipe-1')).toBe(false);

      const flag = setRecipeGroceryFlag(db, 'recipe-1', 2);
      expect(flag).toMatchObject({ recipe_id: 'recipe-1', default_multiplier: 2 });
      expect(isRecipeFlaggedForGrocery(db, 'recipe-1')).toBe(true);

      const flagged = getGroceryFlaggedRecipes(db);
      expect(flagged).toHaveLength(1);
      expect(flagged[0]).toMatchObject({
        recipe_id: 'recipe-1',
        recipe_title: 'Pasta',
        ingredient_count: 1,
      });

      expect(removeRecipeGroceryFlag(db, 'recipe-1')).toBe(true);
      expect(getGroceryFlaggedRecipes(db)).toHaveLength(0);
    });

    it('adds flagged recipes to a selected shopping list', () => {
      createShoppingList(db, 'list-1', 'Weekly');
      setRecipeGroceryFlag(db, 'recipe-1', 2);
      setRecipeGroceryFlag(db, 'recipe-2', 1);

      const addedCount = addFlaggedRecipesToShoppingList(db, 'list-1', nextId);

      expect(addedCount).toBe(2);
      const items = getShoppingListItems(db, 'list-1');
      expect(items.map((item) => item.item).sort()).toEqual(['carrots', 'spaghetti']);
      expect(items.find((item) => item.item === 'spaghetti')?.quantity).toBe(800);
    });

    it('ignores flags for missing shopping lists', () => {
      setRecipeGroceryFlag(db, 'recipe-1', 1);
      expect(addFlaggedRecipesToShoppingList(db, 'missing-list', nextId)).toBe(0);
    });
  });
});
