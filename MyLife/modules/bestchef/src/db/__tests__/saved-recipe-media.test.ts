import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import { createRecipe, deleteRecipe } from '../crud';
import {
  addSavedRecipeMedia,
  countSavedRecipeMedia,
  getSavedRecipeMedia,
  removeSavedRecipeMedia,
  reorderSavedRecipeMedia,
} from '../saved-recipe-media';

describe('saved recipe media gallery', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
    createRecipe(adapter, 'recipe-pad-thai', { title: 'Pad Thai' });
  });

  afterEach(() => {
    closeDb();
  });

  it('migrates the saved recipe media table at the current schema version', () => {
    const rows = adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name = 'rc_saved_recipe_media'`,
    );
    expect(rows.map((row) => row.name)).toEqual(['rc_saved_recipe_media']);
    expect(RECIPES_MODULE.schemaVersion).toBe(34);
  });

  it('adds photos and assigns contiguous sort_order', () => {
    const a = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://a.jpg' });
    const b = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://b.jpg' });
    const c = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://c.jpg' });

    expect([a.sort_order, b.sort_order, c.sort_order]).toEqual([0, 1, 2]);
    expect(getSavedRecipeMedia(adapter, 'recipe-pad-thai').map((row) => row.uri)).toEqual([
      'file://a.jpg',
      'file://b.jpg',
      'file://c.jpg',
    ]);
    expect(countSavedRecipeMedia(adapter, 'recipe-pad-thai')).toBe(3);
  });

  it('rejects empty uris', () => {
    expect(() =>
      addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: '   ' }),
    ).toThrow(/empty media uri/);
  });

  it('removes a photo and re-packs sort_order', () => {
    const a = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://a.jpg' });
    const b = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://b.jpg' });
    const c = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://c.jpg' });

    const removed = removeSavedRecipeMedia(adapter, { id: b.id });
    expect(removed).toBe(true);
    expect(getSavedRecipeMedia(adapter, 'recipe-pad-thai')).toEqual([
      expect.objectContaining({ id: a.id, sort_order: 0 }),
      expect.objectContaining({ id: c.id, sort_order: 1 }),
    ]);
  });

  it('reorder ignores unknown ids and appends missing rows defensively', () => {
    const a = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://a.jpg' });
    const b = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://b.jpg' });
    const c = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://c.jpg' });

    const reordered = reorderSavedRecipeMedia(adapter, {
      recipeId: 'recipe-pad-thai',
      orderedIds: [c.id, 'unknown-id', a.id],
    });
    expect(reordered.map((row) => row.id)).toEqual([c.id, a.id, b.id]);
    expect(reordered.map((row) => row.sort_order)).toEqual([0, 1, 2]);
  });

  it('cascades media when the parent saved recipe is deleted', () => {
    addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://a.jpg' });
    addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://b.jpg' });
    expect(countSavedRecipeMedia(adapter, 'recipe-pad-thai')).toBe(2);

    deleteRecipe(adapter, 'recipe-pad-thai');
    expect(countSavedRecipeMedia(adapter, 'recipe-pad-thai')).toBe(0);
  });

  it('round-trips add and remove without losing siblings', () => {
    const a = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://a.jpg' });
    const b = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://b.jpg' });
    removeSavedRecipeMedia(adapter, { id: a.id });
    const c = addSavedRecipeMedia(adapter, { recipeId: 'recipe-pad-thai', uri: 'file://c.jpg' });

    expect(getSavedRecipeMedia(adapter, 'recipe-pad-thai').map((row) => row.uri)).toEqual([
      'file://b.jpg',
      'file://c.jpg',
    ]);
    expect(b.sort_order).toBe(1);
    // c was added after re-pack so it should land at the end.
    expect(c.sort_order).toBeGreaterThanOrEqual(1);
  });
});
