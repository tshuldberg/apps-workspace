/**
 * Club History CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface ClubHistory {
  id: string;
  club_id: string;
  book_id: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface ClubHistoryInsert {
  club_id: string;
  book_id: string;
  started_at?: string | null;
  finished_at?: string | null;
}

export function createClubHistory(
  db: DatabaseAdapter,
  id: string,
  input: ClubHistoryInsert,
): ClubHistory {
  const now = new Date().toISOString();
  const history: ClubHistory = {
    id,
    club_id: input.club_id,
    book_id: input.book_id,
    started_at: input.started_at ?? null,
    finished_at: input.finished_at ?? null,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bk_club_history (id, club_id, book_id, started_at, finished_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [history.id, history.club_id, history.book_id, history.started_at, history.finished_at, history.created_at],
  );

  return history;
}

export function getHistoryForClub(db: DatabaseAdapter, clubId: string): ClubHistory[] {
  return db.query<ClubHistory>(
    `SELECT * FROM bk_club_history WHERE club_id = ? ORDER BY created_at DESC`,
    [clubId],
  );
}

export function deleteClubHistory(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_club_history WHERE id = ?`, [id]);
}
