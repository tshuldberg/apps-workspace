import type { DatabaseAdapter } from '@mylife/db';
import type { Collection, CreateCollection } from '../types';

export function getCollections(db: DatabaseAdapter): Collection[] {
  return db.query<Collection>(
    `SELECT id, name, description, cover_recipe_id, sort_order, created_at, updated_at
     FROM rc_collections ORDER BY sort_order, name LIMIT 200`,
  );
}

export function createCollection(
  db: DatabaseAdapter,
  id: string,
  input: CreateCollection,
): Collection {
  const now = new Date().toISOString();
  const collection: Collection = {
    id,
    name: input.name,
    description: input.description ?? null,
    cover_recipe_id: input.cover_recipe_id ?? null,
    sort_order: input.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  };
  db.execute(
    `INSERT INTO rc_collections (id, name, description, cover_recipe_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [collection.id, collection.name, collection.description, collection.cover_recipe_id, collection.sort_order, collection.created_at, collection.updated_at],
  );
  return collection;
}

export function updateCollection(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<Collection, 'name' | 'description' | 'cover_recipe_id' | 'sort_order'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.cover_recipe_id !== undefined) { fields.push('cover_recipe_id = ?'); values.push(updates.cover_recipe_id); }
  if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(updates.sort_order); }
  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  db.execute(`UPDATE rc_collections SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteCollection(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_collections WHERE id = ?`, [id]);
}

export function addRecipeToCollection(db: DatabaseAdapter, recipeId: string, collectionId: string): void {
  db.execute(
    `INSERT OR IGNORE INTO rc_recipe_collections (recipe_id, collection_id, sort_order)
     VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM rc_recipe_collections WHERE collection_id = ?))`,
    [recipeId, collectionId, collectionId],
  );
}

export function removeRecipeFromCollection(db: DatabaseAdapter, recipeId: string, collectionId: string): void {
  db.execute(
    `DELETE FROM rc_recipe_collections WHERE recipe_id = ? AND collection_id = ?`,
    [recipeId, collectionId],
  );
}
