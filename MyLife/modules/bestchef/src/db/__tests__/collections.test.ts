import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
} from '../collections';
import { createRecipe } from '../crud';

describe('collections', () => {
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

  describe('getCollections', () => {
    it('returns empty list initially', () => {
      expect(getCollections(adapter)).toHaveLength(0);
    });
  });

  describe('createCollection', () => {
    it('creates and returns a collection', () => {
      const col = createCollection(adapter, 'col-1', { name: 'Weeknight Dinners' });

      expect(col.id).toBe('col-1');
      expect(col.name).toBe('Weeknight Dinners');
      expect(col.description).toBeNull();
      expect(col.sort_order).toBe(0);
      expect(col.created_at).toBeDefined();

      expect(getCollections(adapter)).toHaveLength(1);
    });
  });

  describe('updateCollection', () => {
    it('updates name', () => {
      createCollection(adapter, 'col-1', { name: 'Old Name' });

      updateCollection(adapter, 'col-1', { name: 'New Name' });

      const collections = getCollections(adapter);
      expect(collections[0].name).toBe('New Name');
    });
  });

  describe('deleteCollection', () => {
    it('removes collection', () => {
      createCollection(adapter, 'col-1', { name: 'To Delete' });
      expect(getCollections(adapter)).toHaveLength(1);

      deleteCollection(adapter, 'col-1');
      expect(getCollections(adapter)).toHaveLength(0);
    });
  });

  describe('addRecipeToCollection / removeRecipeFromCollection', () => {
    it('links and unlinks a recipe', () => {
      createRecipe(adapter, 'test-r1', { title: 'Linked Recipe' });
      createCollection(adapter, 'col-1', { name: 'Favorites' });

      addRecipeToCollection(adapter, 'test-r1', 'col-1');

      // Verify via direct query on the junction table
      const inCollection = adapter.query<{ recipe_id: string }>(
        'SELECT recipe_id FROM rc_recipe_collections WHERE collection_id = ?',
        ['col-1'],
      );
      expect(inCollection).toHaveLength(1);
      expect(inCollection[0].recipe_id).toBe('test-r1');

      removeRecipeFromCollection(adapter, 'test-r1', 'col-1');

      const afterRemove = adapter.query<{ recipe_id: string }>(
        'SELECT recipe_id FROM rc_recipe_collections WHERE collection_id = ?',
        ['col-1'],
      );
      expect(afterRemove).toHaveLength(0);
    });

    it('addRecipeToCollection is idempotent (INSERT OR IGNORE)', () => {
      createRecipe(adapter, 'test-r1', { title: 'Recipe' });
      createCollection(adapter, 'col-1', { name: 'Collection' });

      addRecipeToCollection(adapter, 'test-r1', 'col-1');
      addRecipeToCollection(adapter, 'test-r1', 'col-1');

      const inCollection = adapter.query<{ recipe_id: string }>(
        'SELECT recipe_id FROM rc_recipe_collections WHERE collection_id = ?',
        ['col-1'],
      );
      expect(inCollection).toHaveLength(1);
    });
  });
});
