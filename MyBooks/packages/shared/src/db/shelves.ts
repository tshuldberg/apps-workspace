/**
 * Shelf CRUD operations.
 */

import type { DatabaseAdapter } from './migrations';
import type { Shelf, ShelfInsert } from '../models/schemas';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createShelf(
  db: DatabaseAdapter,
  id: string,
  input: ShelfInsert,
): Shelf {
  const now = new Date().toISOString();
  const shelf: Shelf = {
    id,
    name: input.name,
    slug: input.slug,
    icon: input.icon ?? null,
    color: input.color ?? null,
    is_system: input.is_system ?? 0,
    sort_order: input.sort_order ?? 0,
    book_count: input.book_count ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO shelves (id, name, slug, icon, color, is_system, sort_order, book_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [shelf.id, shelf.name, shelf.slug, shelf.icon, shelf.color,
     shelf.is_system, shelf.sort_order, shelf.book_count, shelf.created_at],
  );

  return shelf;
}

export function getShelf(db: DatabaseAdapter, id: string): Shelf | null {
  const rows = db.query<Shelf>(
    `SELECT * FROM shelves WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getShelves(db: DatabaseAdapter): Shelf[] {
  return db.query<Shelf>(
    `SELECT * FROM shelves ORDER BY sort_order, name`,
  );
}

export function getSystemShelves(db: DatabaseAdapter): Shelf[] {
  return db.query<Shelf>(
    `SELECT * FROM shelves WHERE is_system = 1 ORDER BY sort_order`,
  );
}

export function updateShelf(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<Shelf, 'name' | 'slug' | 'icon' | 'color' | 'sort_order'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.slug !== undefined) {
    fields.push('slug = ?');
    values.push(updates.slug);
  }
  if (updates.icon !== undefined) {
    fields.push('icon = ?');
    values.push(updates.icon);
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }
  if (updates.sort_order !== undefined) {
    fields.push('sort_order = ?');
    values.push(updates.sort_order);
  }

  if (fields.length === 0) return;
  values.push(id);

  db.execute(
    `UPDATE shelves SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteShelf(db: DatabaseAdapter, id: string): void {
  // Only allow deleting non-system shelves
  db.execute(`DELETE FROM shelves WHERE id = ? AND is_system = 0`, [id]);
}

/**
 * Recalculate book_count for a shelf from the book_shelves junction table.
 */
export function refreshShelfCount(db: DatabaseAdapter, shelfId: string): void {
  db.execute(
    `UPDATE shelves SET book_count = (
       SELECT COUNT(*) FROM book_shelves WHERE shelf_id = ?
     ) WHERE id = ?`,
    [shelfId, shelfId],
  );
}

export { slugify };
