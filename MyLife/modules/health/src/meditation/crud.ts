import type { DatabaseAdapter } from '@mylife/db';
import type { MeditationSession } from '../types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_med_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createMeditationSession(
  db: DatabaseAdapter,
  data: Omit<MeditationSession, 'id' | 'created_at'>,
): MeditationSession {
  const id = createId();
  db.execute(
    `INSERT INTO hl_meditation_sessions (id, meditation_type, duration_seconds, completed, mood_before, mood_after, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.meditation_type, data.duration_seconds, data.completed, data.mood_before ?? null, data.mood_after ?? null, data.notes ?? null],
  );
  return getMeditationSessionById(db, id)!;
}

export function getMeditationSessionById(db: DatabaseAdapter, id: string): MeditationSession | null {
  const rows = db.query<MeditationSession>('SELECT * FROM hl_meditation_sessions WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export function getMeditationSessions(db: DatabaseAdapter, limit = 100): MeditationSession[] {
  return db.query<MeditationSession>(
    'SELECT * FROM hl_meditation_sessions ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export function deleteMeditationSession(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_meditation_sessions WHERE id = ?', [id]);
}
