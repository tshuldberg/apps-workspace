import type { DatabaseAdapter } from '@mylife/db';
import type { MoodCalendarEntry } from '../models/mood-entry';
import type { MoodEntry } from '../models/mood-entry';
import type { SymptomLog } from '../models/symptom';
import type { MoodActivity } from '../models/mood-entry';
import { escapeLike } from '../db/crud';
import { moodColor } from './vocabulary';

// ---------------------------------------------------------------------------
// Calendar queries
// ---------------------------------------------------------------------------

/**
 * Get a full year of mood calendar data (365 or 366 entries).
 * Each day has the dominant mood, color, and whether data exists.
 */
export function getMoodCalendar(
  db: DatabaseAdapter,
  year: number,
): MoodCalendarEntry[] {
  // Get all mood entries for the year
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const rows = db.query<{
    day: string;
    mood: string;
    pleasantness: string;
    cnt: number;
  }>(
    `SELECT
       DATE(recorded_at) as day,
       mood,
       pleasantness,
       COUNT(*) as cnt
     FROM md_mood_entries
     WHERE recorded_at >= ? AND recorded_at < ?
     GROUP BY DATE(recorded_at)
     ORDER BY cnt DESC`,
    [startDate, `${year + 1}-01-01`],
  );

  // Build a map of day -> dominant mood data (the most frequent mood for that day)
  const dayMap = new Map<string, { mood: string; pleasantness: string }>();
  for (const row of rows) {
    // First entry per day wins (sorted by count DESC)
    if (!dayMap.has(row.day)) {
      dayMap.set(row.day, { mood: row.mood, pleasantness: row.pleasantness });
    }
  }

  // Generate calendar entries for every day of the year
  const calendar: MoodCalendarEntry[] = [];
  const d = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  while (d < yearEnd) {
    const dateStr = d.toISOString().slice(0, 10);
    const data = dayMap.get(dateStr);

    calendar.push({
      date: dateStr,
      dominantMood: data?.mood ?? null,
      pleasantness: data ? (data.pleasantness as MoodCalendarEntry['pleasantness']) : null,
      color: data ? moodColor(data.pleasantness as 'pleasant' | 'unpleasant') : '#9E9E9E',
      hasData: !!data,
    });

    d.setDate(d.getDate() + 1);
  }

  return calendar;
}

/**
 * Get mood calendar data for a single month.
 */
export function getMoodCalendarMonth(
  db: DatabaseAdapter,
  year: number,
  month: number,
): MoodCalendarEntry[] {
  const calendar = getMoodCalendar(db, year);
  return calendar.filter((entry) => {
    const entryMonth = parseInt(entry.date.slice(5, 7), 10);
    return entryMonth === month;
  });
}

// ---------------------------------------------------------------------------
// Row mappers (local to this file)
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

function rowToActivity(row: Record<string, unknown>): MoodActivity {
  return {
    id: row.id as string,
    moodEntryId: row.mood_entry_id as string,
    activity: row.activity as string,
    createdAt: row.created_at as string,
  };
}

function rowToSymptomLog(row: Record<string, unknown>): SymptomLog {
  return {
    id: row.id as string,
    symptomId: row.symptom_id as string,
    severity: row.severity as number,
    notes: (row.notes as string) ?? null,
    loggedAt: row.logged_at as string,
    createdAt: row.created_at as string,
  };
}

/**
 * Get full detail for a single day: mood entries, activities, and symptom logs.
 */
export function getDayDetail(
  db: DatabaseAdapter,
  date: string,
): {
  entries: MoodEntry[];
  activities: MoodActivity[];
  symptoms: SymptomLog[];
} {
  const entries = db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_mood_entries WHERE recorded_at LIKE ? ESCAPE '\\' ORDER BY recorded_at DESC`,
      [`${escapeLike(date)}%`],
    )
    .map(rowToMoodEntry);

  const activities =
    entries.length > 0
      ? db
          .query<Record<string, unknown>>(
            `SELECT a.* FROM md_mood_activities a
             JOIN md_mood_entries e ON a.mood_entry_id = e.id
             WHERE e.recorded_at LIKE ? ESCAPE '\\'
             ORDER BY a.created_at ASC`,
            [`${escapeLike(date)}%`],
          )
          .map(rowToActivity)
      : [];

  const symptoms = db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_symptom_logs WHERE logged_at LIKE ? ESCAPE '\\' ORDER BY logged_at DESC`,
      [`${escapeLike(date)}%`],
    )
    .map(rowToSymptomLog);

  return { entries, activities, symptoms };
}
