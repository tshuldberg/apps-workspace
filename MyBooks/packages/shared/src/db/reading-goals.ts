/**
 * Reading goal CRUD operations.
 */

import type { DatabaseAdapter } from './migrations';
import type { ReadingGoal, ReadingGoalInsert } from '../models/schemas';

export function createGoal(
  db: DatabaseAdapter,
  id: string,
  input: ReadingGoalInsert,
): ReadingGoal {
  const now = new Date().toISOString();
  const goal: ReadingGoal = {
    id,
    year: input.year,
    target_books: input.target_books,
    target_pages: input.target_pages ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO reading_goals (id, year, target_books, target_pages, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [goal.id, goal.year, goal.target_books, goal.target_pages,
     goal.created_at, goal.updated_at],
  );

  return goal;
}

export function getGoal(db: DatabaseAdapter, id: string): ReadingGoal | null {
  const rows = db.query<ReadingGoal>(
    `SELECT * FROM reading_goals WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getGoalForYear(db: DatabaseAdapter, year: number): ReadingGoal | null {
  const rows = db.query<ReadingGoal>(
    `SELECT * FROM reading_goals WHERE year = ?`,
    [year],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function updateGoal(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<ReadingGoal, 'target_books' | 'target_pages'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.target_books !== undefined) {
    fields.push('target_books = ?');
    values.push(updates.target_books);
  }
  if (updates.target_pages !== undefined) {
    fields.push('target_pages = ?');
    values.push(updates.target_pages);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE reading_goals SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export interface GoalProgress {
  goal: ReadingGoal;
  booksRead: number;
  pagesRead: number;
  bookPercent: number;
  pagePercent: number | null;
  onTrack: boolean;
}

/**
 * Calculate progress toward a reading goal for a given year.
 */
export function getGoalProgress(db: DatabaseAdapter, year: number): GoalProgress | null {
  const goal = getGoalForYear(db, year);
  if (!goal) return null;

  const yearStart = `${year}-01-01T00:00:00`;
  const yearEnd = `${year + 1}-01-01T00:00:00`;

  const bookRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM reading_sessions
     WHERE status = 'finished' AND finished_at >= ? AND finished_at < ?`,
    [yearStart, yearEnd],
  );

  const pageRows = db.query<{ total: number | null }>(
    `SELECT COALESCE(SUM(b.page_count), 0) as total
     FROM reading_sessions rs
     INNER JOIN books b ON rs.book_id = b.id
     WHERE rs.status = 'finished' AND rs.finished_at >= ? AND rs.finished_at < ?`,
    [yearStart, yearEnd],
  );

  const booksRead = bookRows[0]?.count ?? 0;
  const pagesRead = pageRows[0]?.total ?? 0;

  // Calculate whether on track: compare books read to expected at current point in year
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24),
  );
  const expectedBooks = (goal.target_books / 365) * Math.min(dayOfYear, 365);

  return {
    goal,
    booksRead,
    pagesRead,
    bookPercent: Math.round((booksRead / goal.target_books) * 100),
    pagePercent: goal.target_pages
      ? Math.round((pagesRead / goal.target_pages) * 100)
      : null,
    onTrack: booksRead >= expectedBooks,
  };
}
