import type { DatabaseAdapter } from '@mylife/db';
import type { SleepRoutine } from '../types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_sr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSleepRoutine(
  db: DatabaseAdapter,
  data: Omit<SleepRoutine, 'id' | 'created_at'>,
): SleepRoutine {
  const id = createId();
  db.execute(
    `INSERT INTO hl_sleep_routines (id, routine_type, routine_name, duration_seconds, completed, sleep_session_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.routine_type, data.routine_name, data.duration_seconds, data.completed, data.sleep_session_id ?? null],
  );
  return getSleepRoutineById(db, id)!;
}

export function getSleepRoutineById(db: DatabaseAdapter, id: string): SleepRoutine | null {
  const rows = db.query<SleepRoutine>('SELECT * FROM hl_sleep_routines WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export function getSleepRoutines(db: DatabaseAdapter, limit = 100): SleepRoutine[] {
  return db.query<SleepRoutine>(
    'SELECT * FROM hl_sleep_routines ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export function linkRoutineToSleep(db: DatabaseAdapter, routineId: string, sleepSessionId: string): void {
  db.execute(
    'UPDATE hl_sleep_routines SET sleep_session_id = ? WHERE id = ?',
    [sleepSessionId, routineId],
  );
}

export function deleteSleepRoutine(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_sleep_routines WHERE id = ?', [id]);
}
