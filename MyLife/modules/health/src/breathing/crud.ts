import type { DatabaseAdapter } from '@mylife/db';
import type { BreathingSession, BreathingSessionInsert } from '../types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_br_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createBreathingSession(
  db: DatabaseAdapter,
  data: BreathingSessionInsert,
): BreathingSession {
  const id = createId();
  db.execute(
    `INSERT INTO hl_breathing_sessions (id, pattern, duration_seconds, cycles_completed, completed, mood_before, mood_after)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.pattern, data.duration_seconds, data.cycles_completed, data.completed, data.mood_before ?? null, data.mood_after ?? null],
  );
  return getBreathingSessionById(db, id)!;
}

export function getBreathingSessionById(db: DatabaseAdapter, id: string): BreathingSession | null {
  const rows = db.query<BreathingSession>('SELECT * FROM hl_breathing_sessions WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export function getBreathingSessions(db: DatabaseAdapter, limit = 100): BreathingSession[] {
  return db.query<BreathingSession>(
    'SELECT * FROM hl_breathing_sessions ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export function deleteBreathingSession(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_breathing_sessions WHERE id = ?', [id]);
}
