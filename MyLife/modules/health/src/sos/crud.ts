import type { DatabaseAdapter } from '@mylife/db';
import type { SosSession } from '../types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_sos_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSosSession(
  db: DatabaseAdapter,
  data: Omit<SosSession, 'id' | 'created_at'>,
): SosSession {
  const id = createId();
  db.execute(
    `INSERT INTO hl_sos_sessions (id, trigger_source, tools_used, duration_seconds, mood_before, mood_after, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.trigger_source, data.tools_used ?? null, data.duration_seconds ?? null,
     data.mood_before ?? null, data.mood_after ?? null, data.notes ?? null],
  );
  return getSosSessionById(db, id)!;
}

export function getSosSessionById(db: DatabaseAdapter, id: string): SosSession | null {
  const rows = db.query<SosSession>('SELECT * FROM hl_sos_sessions WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export function getSosSessions(db: DatabaseAdapter, limit = 100): SosSession[] {
  return db.query<SosSession>(
    'SELECT * FROM hl_sos_sessions ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export function deleteSosSession(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_sos_sessions WHERE id = ?', [id]);
}
