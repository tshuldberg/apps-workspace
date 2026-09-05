/**
 * Series CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Series, SeriesInsert } from '../models/schemas';

export function createSeries(
  db: DatabaseAdapter,
  id: string,
  input: SeriesInsert,
): Series {
  const now = new Date().toISOString();
  const series: Series = {
    id,
    name: input.name,
    description: input.description ?? null,
    total_books: input.total_books ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bk_series (id, name, description, total_books, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [series.id, series.name, series.description, series.total_books,
     series.created_at, series.updated_at],
  );

  return series;
}

export function getSeries(db: DatabaseAdapter, id: string): Series | null {
  const rows = db.query<Series>(
    `SELECT * FROM bk_series WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getAllSeries(db: DatabaseAdapter): Series[] {
  return db.query<Series>(
    `SELECT * FROM bk_series ORDER BY name`,
  );
}

export function updateSeries(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<Series, 'name' | 'description' | 'total_books'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.total_books !== undefined) {
    fields.push('total_books = ?');
    values.push(updates.total_books);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bk_series SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteSeries(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_series WHERE id = ?`, [id]);
}
