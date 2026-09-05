import type { DatabaseAdapter } from '@mylife/db';

export interface MatchResultRecord {
  id: string;
  deckId: string;
  boardSize: number;
  timeMs: number;
  mistakes: number;
  stars: number;
  cardIds: string[];
  playedAt: string;
}

export interface MatchBestRecord {
  deckId: string;
  boardSize: number;
  bestTimeMs: number;
  bestStars: number;
  achievedAt: string;
}

function rowToMatchResult(row: Record<string, unknown>): MatchResultRecord {
  let cardIds: string[] = [];
  try {
    cardIds = JSON.parse((row.card_ids_json as string) || '[]');
  } catch { /* empty */ }
  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    boardSize: row.board_size as number,
    timeMs: row.time_ms as number,
    mistakes: row.mistakes as number,
    stars: row.stars as number,
    cardIds,
    playedAt: row.played_at as string,
  };
}

function rowToMatchBest(row: Record<string, unknown>): MatchBestRecord {
  return {
    deckId: row.deck_id as string,
    boardSize: row.board_size as number,
    bestTimeMs: row.best_time_ms as number,
    bestStars: row.best_stars as number,
    achievedAt: row.achieved_at as string,
  };
}

export function saveMatchResult(
  db: DatabaseAdapter,
  id: string,
  input: {
    deckId: string;
    boardSize: number;
    timeMs: number;
    mistakes: number;
    stars: number;
    cardIds: string[];
  },
): MatchResultRecord {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO fl_match_results (id, deck_id, board_size, time_ms, mistakes, stars, card_ids_json, played_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.deckId, input.boardSize, input.timeMs, input.mistakes, input.stars, JSON.stringify(input.cardIds), now],
  );
  return { id, ...input, playedAt: now };
}

export function getMatchBest(
  db: DatabaseAdapter,
  deckId: string,
  boardSize: number,
): MatchBestRecord | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_match_bests WHERE deck_id = ? AND board_size = ?`,
    [deckId, boardSize],
  );
  return rows.length > 0 ? rowToMatchBest(rows[0]) : null;
}

export function updateMatchBest(
  db: DatabaseAdapter,
  deckId: string,
  boardSize: number,
  timeMs: number,
  stars: number,
): MatchBestRecord {
  const now = new Date().toISOString();
  db.execute(
    `INSERT OR REPLACE INTO fl_match_bests (deck_id, board_size, best_time_ms, best_stars, achieved_at)
     VALUES (?, ?, ?, ?, ?)`,
    [deckId, boardSize, timeMs, stars, now],
  );
  return { deckId, boardSize, bestTimeMs: timeMs, bestStars: stars, achievedAt: now };
}

export function listMatchResults(
  db: DatabaseAdapter,
  deckId: string,
  limit: number = 20,
): MatchResultRecord[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_match_results WHERE deck_id = ? ORDER BY played_at DESC LIMIT ?`,
    [deckId, limit],
  );
  return rows.map(rowToMatchResult);
}
