import type { DatabaseAdapter } from '@mylife/db';
import type {
  MoodEntry,
  CreateMoodEntryInput,
  DailyMoodSummary,
} from '../models/mood-entry';
import { escapeLike } from '../db/crud';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToMoodEntry(row: Record<string, unknown>): MoodEntry {
  return {
    id: row.id as string,
    mood: row.mood as string,
    energyLevel: row.energy_level as MoodEntry['energyLevel'],
    pleasantness: row.pleasantness as MoodEntry['pleasantness'],
    intensity: row.intensity as number,
    notes: (row.notes as string) ?? null,
    recordedAt: row.recorded_at as string,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function createMoodEntry(
  db: DatabaseAdapter,
  id: string,
  input: CreateMoodEntryInput,
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO md_mood_entries (id, mood, energy_level, pleasantness, intensity, notes, recorded_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.mood,
      input.energyLevel,
      input.pleasantness,
      input.intensity ?? 3,
      input.notes ?? null,
      input.recordedAt ?? now,
      now,
    ],
  );
}

export function getMoodEntryById(
  db: DatabaseAdapter,
  id: string,
): MoodEntry | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_mood_entries WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToMoodEntry(rows[0]) : null;
}

export function getMoodEntries(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
  limit: number = 1000,
): MoodEntry[] {
  let sql = 'SELECT * FROM md_mood_entries WHERE 1=1';
  const params: unknown[] = [];

  if (from) {
    sql += ' AND recorded_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND recorded_at <= ?';
    params.push(to);
  }

  sql += ' ORDER BY recorded_at DESC LIMIT ?';
  params.push(limit);
  return db.query<Record<string, unknown>>(sql, params).map(rowToMoodEntry);
}

export function deleteMoodEntry(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_mood_entries WHERE id = ?', [id]);
}

/**
 * Get all mood entries for a specific date (YYYY-MM-DD prefix match).
 */
export function getMoodEntriesForDate(
  db: DatabaseAdapter,
  date: string,
): MoodEntry[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_mood_entries WHERE recorded_at LIKE ? ESCAPE '\\' ORDER BY recorded_at DESC`,
      [`${escapeLike(date)}%`],
    )
    .map(rowToMoodEntry);
}

/**
 * Get daily mood summary: most recent mood, all activities, and average intensity.
 */
export function getDailyMoodSummary(
  db: DatabaseAdapter,
  date: string,
): DailyMoodSummary {
  // Get all entries for that day
  const entries = db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_mood_entries WHERE recorded_at LIKE ? ESCAPE '\\' ORDER BY recorded_at DESC`,
      [`${escapeLike(date)}%`],
    )
    .map(rowToMoodEntry);

  // Get all activities for entries on that day
  const activities =
    entries.length > 0
      ? db
          .query<{ activity: string }>(
            `SELECT DISTINCT a.activity FROM md_mood_activities a
             JOIN md_mood_entries e ON a.mood_entry_id = e.id
             WHERE e.recorded_at LIKE ? ESCAPE '\\'`,
            [`${escapeLike(date)}%`],
          )
          .map((r) => r.activity)
      : [];

  const dominantMood = entries.length > 0 ? entries[0].mood : null;
  const averageIntensity =
    entries.length > 0
      ? Math.round(
          (entries.reduce((sum, e) => sum + e.intensity, 0) / entries.length) *
            10,
        ) / 10
      : null;

  return {
    date,
    entries,
    activities,
    dominantMood,
    averageIntensity,
  };
}
