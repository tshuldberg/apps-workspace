import type { DatabaseAdapter } from '@mylife/db';
import type { CbtEntry, CbtExerciseType } from '../types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_cbt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createCbtEntry(
  db: DatabaseAdapter,
  data: Omit<CbtEntry, 'id' | 'created_at'>,
): CbtEntry {
  if (!data.response || data.response.trim().length === 0) {
    throw new Error('CBT entry must have a non-empty response');
  }
  const id = createId();
  db.execute(
    `INSERT INTO hl_cbt_entries (id, exercise_type, prompt, response, mood_before, mood_after, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.exercise_type, data.prompt, data.response, data.mood_before ?? null, data.mood_after ?? null, data.tags ?? null],
  );
  return getCbtEntryById(db, id)!;
}

export function getCbtEntryById(db: DatabaseAdapter, id: string): CbtEntry | null {
  const rows = db.query<CbtEntry>('SELECT * FROM hl_cbt_entries WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export function getCbtEntries(db: DatabaseAdapter, limit = 100): CbtEntry[] {
  return db.query<CbtEntry>(
    'SELECT * FROM hl_cbt_entries ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export function getCbtEntriesByType(db: DatabaseAdapter, type: CbtExerciseType, limit = 100): CbtEntry[] {
  return db.query<CbtEntry>(
    'SELECT * FROM hl_cbt_entries WHERE exercise_type = ? ORDER BY created_at DESC LIMIT ?',
    [type, limit],
  );
}

export function deleteCbtEntry(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_cbt_entries WHERE id = ?', [id]);
}
