import type { DatabaseAdapter } from '@mylife/db';
import type { MoodActivity } from '../models/mood-entry';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToActivity(row: Record<string, unknown>): MoodActivity {
  return {
    id: row.id as string,
    moodEntryId: row.mood_entry_id as string,
    activity: row.activity as string,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function addActivity(
  db: DatabaseAdapter,
  id: string,
  moodEntryId: string,
  activity: string,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_mood_activities (id, mood_entry_id, activity, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, moodEntryId, activity, now],
  );
}

export function getActivities(
  db: DatabaseAdapter,
  moodEntryId: string,
): MoodActivity[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_mood_activities WHERE mood_entry_id = ? ORDER BY created_at ASC',
      [moodEntryId],
    )
    .map(rowToActivity);
}

export function removeActivity(db: DatabaseAdapter, activityId: string): void {
  db.execute('DELETE FROM md_mood_activities WHERE id = ?', [activityId]);
}
