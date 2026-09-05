import type { DatabaseAdapter } from '@mylife/db';
import type { SnoreSession, SnoreEvent } from '../types';

function createId(prefix: string): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// --- Snore Sessions ---

export function startSnoreSession(db: DatabaseAdapter, startTime: string): string {
  const id = createId('snr');
  db.execute(
    `INSERT INTO hl_snore_sessions (id, start_time, status)
     VALUES (?, ?, 'recording')`,
    [id, startTime],
  );
  return id;
}

export function finalizeSnoreSession(
  db: DatabaseAdapter,
  sessionId: string,
  data: {
    end_time: string;
    duration_minutes: number;
    snore_score: number;
    snore_minutes: number;
    snore_percentage: number;
    loudest_db: number;
    average_db: number;
    event_count: number;
    sleep_session_id?: string | null;
  },
): void {
  db.execute(
    `UPDATE hl_snore_sessions SET
       end_time = ?, duration_minutes = ?, snore_score = ?,
       snore_minutes = ?, snore_percentage = ?, loudest_db = ?,
       average_db = ?, event_count = ?, status = 'completed',
       sleep_session_id = ?
     WHERE id = ?`,
    [
      data.end_time,
      data.duration_minutes,
      data.snore_score,
      data.snore_minutes,
      data.snore_percentage,
      data.loudest_db,
      data.average_db,
      data.event_count,
      data.sleep_session_id ?? null,
      sessionId,
    ],
  );
}

export function cancelSnoreSession(db: DatabaseAdapter, sessionId: string, endTime: string): void {
  db.execute(
    "UPDATE hl_snore_sessions SET end_time = ?, status = 'cancelled' WHERE id = ?",
    [endTime, sessionId],
  );
}

export function getSnoreSessionById(db: DatabaseAdapter, id: string): SnoreSession | null {
  const rows = db.query<SnoreSession>(
    'SELECT * FROM hl_snore_sessions WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export function getSnoreHistory(db: DatabaseAdapter, limit = 30): SnoreSession[] {
  return db.query<SnoreSession>(
    "SELECT * FROM hl_snore_sessions WHERE status = 'completed' ORDER BY start_time DESC LIMIT ?",
    [limit],
  );
}

export function deleteSnoreSession(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_snore_sessions WHERE id = ?', [id]);
}

// --- Snore Events ---

export function createSnoreEvent(
  db: DatabaseAdapter,
  sessionId: string,
  data: {
    timestamp: string;
    duration_seconds: number;
    intensity: string;
    decibels: number | null;
    audio_clip_path: string | null;
  },
): string {
  const id = createId('sne');
  db.execute(
    `INSERT INTO hl_snore_events (id, session_id, timestamp, duration_seconds, intensity, decibels, audio_clip_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, sessionId, data.timestamp, data.duration_seconds, data.intensity, data.decibels, data.audio_clip_path],
  );
  return id;
}

export function getSnoreEvents(db: DatabaseAdapter, sessionId: string): SnoreEvent[] {
  return db.query<SnoreEvent>(
    'SELECT * FROM hl_snore_events WHERE session_id = ? ORDER BY timestamp ASC',
    [sessionId],
  );
}

export function deleteSnoreEvent(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_snore_events WHERE id = ?', [id]);
}
