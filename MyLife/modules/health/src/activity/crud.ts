import type { DatabaseAdapter } from '@mylife/db';
import type { ActivitySummary } from '../types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_act_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createActivitySummary(
  db: DatabaseAdapter,
  data: Omit<ActivitySummary, 'id' | 'created_at' | 'updated_at'>,
): ActivitySummary {
  const id = createId();
  db.execute(
    `INSERT OR REPLACE INTO hl_activity_summaries
     (id, date, steps, steps_goal, active_energy_cal, active_energy_goal, move_minutes, move_minutes_goal, distance_meters, floors_climbed, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.date, data.steps, data.steps_goal, data.active_energy_cal, data.active_energy_goal,
     data.move_minutes, data.move_minutes_goal, data.distance_meters ?? null, data.floors_climbed ?? null, data.source],
  );
  return getActivitySummaryByDate(db, data.date)!;
}

export function getActivitySummaryByDate(db: DatabaseAdapter, date: string): ActivitySummary | null {
  const rows = db.query<ActivitySummary>('SELECT * FROM hl_activity_summaries WHERE date = ?', [date]);
  return rows[0] ?? null;
}

export function getActivityHistory(db: DatabaseAdapter, limit = 30): ActivitySummary[] {
  return db.query<ActivitySummary>(
    'SELECT * FROM hl_activity_summaries ORDER BY date DESC LIMIT ?',
    [limit],
  );
}

export function deleteActivitySummary(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_activity_summaries WHERE id = ?', [id]);
}
