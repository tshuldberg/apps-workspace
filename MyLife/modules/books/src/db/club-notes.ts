/**
 * Club Note CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface ClubNote {
  id: string;
  club_id: string;
  book_id: string | null;
  content: string;
  note_type: 'discussion' | 'prompt' | 'schedule' | 'milestone';
  created_at: string;
}

export interface ClubNoteInsert {
  club_id: string;
  book_id?: string | null;
  content: string;
  note_type?: 'discussion' | 'prompt' | 'schedule' | 'milestone';
}

export function createClubNote(
  db: DatabaseAdapter,
  id: string,
  input: ClubNoteInsert,
): ClubNote {
  const now = new Date().toISOString();
  const note: ClubNote = {
    id,
    club_id: input.club_id,
    book_id: input.book_id ?? null,
    content: input.content,
    note_type: input.note_type ?? 'discussion',
    created_at: now,
  };

  db.execute(
    `INSERT INTO bk_club_notes (id, club_id, book_id, content, note_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [note.id, note.club_id, note.book_id, note.content, note.note_type, note.created_at],
  );

  return note;
}

export function getClubNote(db: DatabaseAdapter, id: string): ClubNote | null {
  const rows = db.query<ClubNote>(
    `SELECT * FROM bk_club_notes WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getNotesForClub(db: DatabaseAdapter, clubId: string): ClubNote[] {
  return db.query<ClubNote>(
    `SELECT * FROM bk_club_notes WHERE club_id = ? ORDER BY created_at DESC`,
    [clubId],
  );
}

export function getNotesForClubAndBook(
  db: DatabaseAdapter,
  clubId: string,
  bookId: string,
): ClubNote[] {
  return db.query<ClubNote>(
    `SELECT * FROM bk_club_notes WHERE club_id = ? AND book_id = ? ORDER BY created_at DESC`,
    [clubId, bookId],
  );
}

export function deleteClubNote(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_club_notes WHERE id = ?`, [id]);
}
