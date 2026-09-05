/**
 * Challenge progress CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ChallengeProgress, ChallengeProgressInsert } from '../models/schemas';

export function logChallengeProgress(
  db: DatabaseAdapter,
  id: string,
  input: ChallengeProgressInsert,
): ChallengeProgress {
  const now = new Date().toISOString();
  const progress: ChallengeProgress = {
    id,
    challenge_id: input.challenge_id,
    book_id: input.book_id ?? null,
    session_id: input.session_id ?? null,
    value_added: input.value_added,
    note: input.note ?? null,
    logged_at: now,
  };

  db.execute(
    `INSERT INTO bk_challenge_progress (id, challenge_id, book_id, session_id, value_added, note, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      progress.id, progress.challenge_id, progress.book_id,
      progress.session_id, progress.value_added, progress.note, progress.logged_at,
    ],
  );

  return progress;
}

export function getProgressForChallenge(
  db: DatabaseAdapter,
  challengeId: string,
): ChallengeProgress[] {
  return db.query<ChallengeProgress>(
    `SELECT * FROM bk_challenge_progress WHERE challenge_id = ? ORDER BY logged_at DESC`,
    [challengeId],
  );
}

export function getTotalProgress(
  db: DatabaseAdapter,
  challengeId: string,
): number {
  const rows = db.query<{ total: number | null }>(
    `SELECT COALESCE(SUM(value_added), 0) as total
     FROM bk_challenge_progress WHERE challenge_id = ?`,
    [challengeId],
  );
  return rows[0]?.total ?? 0;
}

export function deleteChallengeProgress(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_challenge_progress WHERE id = ?`, [id]);
}
