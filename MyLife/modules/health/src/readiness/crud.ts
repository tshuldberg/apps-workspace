import type { DatabaseAdapter } from '@mylife/db';
import type { ReadinessScore } from '../types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_rs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function saveReadinessScore(
  db: DatabaseAdapter,
  data: Omit<ReadinessScore, 'id' | 'created_at'>,
): ReadinessScore {
  const id = createId();
  db.execute(
    `INSERT OR REPLACE INTO hl_readiness_scores
     (id, date, score, sleep_factor, hrv_factor, rhr_factor, activity_factor, strain_factor, recommendation, data_completeness)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.date, data.score, data.sleep_factor, data.hrv_factor, data.rhr_factor,
     data.activity_factor, data.strain_factor, data.recommendation, data.data_completeness],
  );
  return getReadinessScoreByDate(db, data.date)!;
}

export function getReadinessScoreByDate(db: DatabaseAdapter, date: string): ReadinessScore | null {
  const rows = db.query<ReadinessScore>('SELECT * FROM hl_readiness_scores WHERE date = ?', [date]);
  return rows[0] ?? null;
}

export function getRecentReadinessScores(db: DatabaseAdapter, limit = 7): ReadinessScore[] {
  return db.query<ReadinessScore>(
    'SELECT * FROM hl_readiness_scores ORDER BY date DESC LIMIT ?',
    [limit],
  );
}

export function deleteReadinessScore(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_readiness_scores WHERE id = ?', [id]);
}
