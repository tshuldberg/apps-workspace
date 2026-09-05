/**
 * Book Club CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface BookClub {
  id: string;
  name: string;
  description: string | null;
  current_book_id: string | null;
  reading_start_date: string | null;
  reading_end_date: string | null;
  mode: 'local' | 'connected';
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface BookClubInsert {
  name: string;
  description?: string | null;
  current_book_id?: string | null;
  reading_start_date?: string | null;
  reading_end_date?: string | null;
  mode?: 'local' | 'connected';
}

export function createClub(
  db: DatabaseAdapter,
  id: string,
  input: BookClubInsert,
): BookClub {
  const now = new Date().toISOString();
  const club: BookClub = {
    id,
    name: input.name,
    description: input.description ?? null,
    current_book_id: input.current_book_id ?? null,
    reading_start_date: input.reading_start_date ?? null,
    reading_end_date: input.reading_end_date ?? null,
    mode: input.mode ?? 'local',
    is_active: 1,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bk_book_clubs (id, name, description, current_book_id, reading_start_date,
       reading_end_date, mode, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      club.id, club.name, club.description, club.current_book_id,
      club.reading_start_date, club.reading_end_date, club.mode,
      club.is_active, club.created_at, club.updated_at,
    ],
  );

  return club;
}

export function getClub(db: DatabaseAdapter, id: string): BookClub | null {
  const rows = db.query<BookClub>(
    `SELECT * FROM bk_book_clubs WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getActiveClubs(db: DatabaseAdapter): BookClub[] {
  return db.query<BookClub>(
    `SELECT * FROM bk_book_clubs WHERE is_active = 1 ORDER BY created_at DESC`,
  );
}

export function getAllClubs(db: DatabaseAdapter): BookClub[] {
  return db.query<BookClub>(
    `SELECT * FROM bk_book_clubs ORDER BY created_at DESC`,
  );
}

export function updateClub(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<BookClub, 'name' | 'description' | 'current_book_id' | 'reading_start_date' | 'reading_end_date'>>,
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
  if (updates.current_book_id !== undefined) {
    fields.push('current_book_id = ?');
    values.push(updates.current_book_id);
  }
  if (updates.reading_start_date !== undefined) {
    fields.push('reading_start_date = ?');
    values.push(updates.reading_start_date);
  }
  if (updates.reading_end_date !== undefined) {
    fields.push('reading_end_date = ?');
    values.push(updates.reading_end_date);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bk_book_clubs SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function setCurrentBook(
  db: DatabaseAdapter,
  clubId: string,
  bookId: string,
  startDate?: string,
  endDate?: string,
): void {
  const fields = ['current_book_id = ?'];
  const values: unknown[] = [bookId];

  if (startDate !== undefined) {
    fields.push('reading_start_date = ?');
    values.push(startDate);
  }
  if (endDate !== undefined) {
    fields.push('reading_end_date = ?');
    values.push(endDate);
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(clubId);

  db.execute(
    `UPDATE bk_book_clubs SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deactivateClub(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE bk_book_clubs SET is_active = 0, updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

export function deleteClub(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_book_clubs WHERE id = ?`, [id]);
}
