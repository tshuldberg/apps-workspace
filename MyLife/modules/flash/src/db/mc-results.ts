import type { DatabaseAdapter } from '@mylife/db';

export interface MCResultRecord {
  id: string;
  deckId: string;
  questionCount: number;
  correctCount: number;
  incorrectCount: number;
  scorePercent: number;
  timeMs: number;
  playedAt: string;
}

function rowToMCResult(row: Record<string, unknown>): MCResultRecord {
  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    questionCount: row.question_count as number,
    correctCount: row.correct_count as number,
    incorrectCount: row.incorrect_count as number,
    scorePercent: row.score_percent as number,
    timeMs: row.time_ms as number,
    playedAt: row.played_at as string,
  };
}

export function saveMCResult(
  db: DatabaseAdapter,
  id: string,
  input: {
    deckId: string;
    questionCount: number;
    correctCount: number;
    incorrectCount: number;
    scorePercent: number;
    timeMs: number;
  },
): MCResultRecord {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO fl_mc_results (id, deck_id, question_count, correct_count, incorrect_count, score_percent, time_ms, played_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.deckId, input.questionCount, input.correctCount, input.incorrectCount, input.scorePercent, input.timeMs, now],
  );
  return { id, ...input, playedAt: now };
}

export function listMCResults(
  db: DatabaseAdapter,
  deckId: string,
  limit: number = 20,
): MCResultRecord[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_mc_results WHERE deck_id = ? ORDER BY played_at DESC LIMIT ?`,
    [deckId, limit],
  );
  return rows.map(rowToMCResult);
}
