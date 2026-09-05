import type { DatabaseAdapter } from '@mylife/db';
import { getMoodMedicationCorrelation, type MoodMedicationCorrelation } from '../analytics';
import { getMedications } from '../db/crud';
import type { MoodActivity, MoodEntry, Pleasantness } from '../models/mood-entry';
import { addActivity, getActivities } from './activities';
import { getMoodEntries } from './check-in';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const SCORE_BY_LABEL: Record<string, number> = {
  great: 10,
  good: 8,
  neutral: 6,
  bad: 4,
  terrible: 2,
};

export interface MoodTrendDay {
  date: string;
  averageScore: number;
  averageIntensity: number;
  dominantMood: string | null;
  pleasantness: Pleasantness | null;
  entryCount: number;
}

export interface MoodDayOfWeekAverage {
  dayIndex: number;
  dayLabel: string;
  averageScore: number;
  entryCount: number;
}

export interface MoodTrends {
  averageScore: number;
  totalEntries: number;
  daily: MoodTrendDay[];
  dayOfWeek: MoodDayOfWeekAverage[];
  recentEntries: MoodEntry[];
}

export interface MoodActivityCorrelation {
  activity: string;
  averageScore: number;
  averageIntensity: number;
  sampleSize: number;
  direction: 'positive' | 'negative' | 'neutral';
}

export type MoodMedicationImpact = MoodMedicationCorrelation & {
  medicationId: string;
  direction: 'improved' | 'declined' | 'flat';
};

export interface MoodCorrelations {
  activities: MoodActivityCorrelation[];
  medications: MoodMedicationImpact[];
}

function normalizeLowerBound(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length === 10 ? `${value}T00:00:00.000Z` : value;
}

function normalizeUpperBound(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
}

function scoreFromPleasantness(
  pleasantness: Pleasantness,
  intensity: number,
): number {
  if (pleasantness === 'pleasant') {
    return 5 + intensity;
  }
  if (pleasantness === 'unpleasant') {
    return 6 - intensity;
  }
  return 6;
}

export function getMoodScore(entry: MoodEntry): number {
  const normalizedMood = entry.mood.trim().toLowerCase();
  if (normalizedMood in SCORE_BY_LABEL) {
    return SCORE_BY_LABEL[normalizedMood];
  }

  return scoreFromPleasantness(entry.pleasantness, entry.intensity);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function deriveDominantMood(entries: MoodEntry[]): {
  dominantMood: string | null;
  pleasantness: Pleasantness | null;
} {
  if (entries.length === 0) {
    return {
      dominantMood: null,
      pleasantness: null,
    };
  }

  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
  }

  const dominantMood = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? entries[0].mood;
  const dominantEntry = entries.find((entry) => entry.mood === dominantMood) ?? entries[0];

  return {
    dominantMood,
    pleasantness: dominantEntry.pleasantness,
  };
}

function buildActivityRows(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
): Array<{
  activity: string;
  moodEntryId: string;
}> {
  let sql = `
    SELECT a.activity, a.mood_entry_id
    FROM md_mood_activities a
    JOIN md_mood_entries e ON e.id = a.mood_entry_id
    WHERE 1 = 1
  `;
  const params: unknown[] = [];

  if (from) {
    sql += ' AND e.recorded_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND e.recorded_at <= ?';
    params.push(to);
  }

  sql += ' ORDER BY e.recorded_at DESC';

  return db
    .query<{ activity: string; mood_entry_id: string }>(sql, params)
    .map((row) => ({
      activity: row.activity,
      moodEntryId: row.mood_entry_id,
    }));
}

function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getMoodActivities(
  db: DatabaseAdapter,
  moodEntryId: string,
): MoodActivity[] {
  return getActivities(db, moodEntryId);
}

export function linkActivitiesToMood(
  db: DatabaseAdapter,
  moodEntryId: string,
  activities: string[],
): void {
  const uniqueActivities = [...new Set(activities.map((activity) => activity.trim()).filter(Boolean))];

  db.transaction(() => {
    for (const activity of uniqueActivities) {
      addActivity(db, createLocalId('mood-activity'), moodEntryId, activity);
    }
  });
}

export function getMoodTrends(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
): MoodTrends {
  const normalizedFrom = normalizeLowerBound(from);
  const normalizedTo = normalizeUpperBound(to);
  const entries = getMoodEntries(db, normalizedFrom, normalizedTo, 1000);
  const chronologicalEntries = [...entries].sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));

  const byDate = new Map<string, MoodEntry[]>();
  const byDayOfWeek = new Map<number, number[]>();

  for (const entry of chronologicalEntries) {
    const date = entry.recordedAt.slice(0, 10);
    const dateEntries = byDate.get(date) ?? [];
    dateEntries.push(entry);
    byDate.set(date, dateEntries);

    const dayIndex = new Date(entry.recordedAt).getDay();
    const dayScores = byDayOfWeek.get(dayIndex) ?? [];
    dayScores.push(getMoodScore(entry));
    byDayOfWeek.set(dayIndex, dayScores);
  }

  const daily = [...byDate.entries()].map(([date, dateEntries]) => {
    const scores = dateEntries.map(getMoodScore);
    const { dominantMood, pleasantness } = deriveDominantMood(dateEntries);

    return {
      date,
      averageScore: average(scores),
      averageIntensity: average(dateEntries.map((entry) => entry.intensity)),
      dominantMood,
      pleasantness,
      entryCount: dateEntries.length,
    } satisfies MoodTrendDay;
  });

  const dayOfWeek = DAY_LABELS.map((dayLabel, dayIndex) => {
    const scores = byDayOfWeek.get(dayIndex) ?? [];
    return {
      dayIndex,
      dayLabel,
      averageScore: average(scores),
      entryCount: scores.length,
    } satisfies MoodDayOfWeekAverage;
  });

  return {
    averageScore: average(entries.map(getMoodScore)),
    totalEntries: entries.length,
    daily,
    dayOfWeek,
    recentEntries: entries.slice(0, 12),
  };
}

export function getMoodCorrelations(
  db: DatabaseAdapter,
  from?: string,
  to?: string,
): MoodCorrelations {
  const normalizedFrom = normalizeLowerBound(from);
  const normalizedTo = normalizeUpperBound(to);
  const entries = getMoodEntries(db, normalizedFrom, normalizedTo, 1000);
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const entryScoreMap = new Map(entries.map((entry) => [entry.id, getMoodScore(entry)]));
  const overallScore = average(entries.map(getMoodScore));

  const activityBuckets = new Map<string, Array<{ score: number; intensity: number }>>();
  for (const row of buildActivityRows(db, normalizedFrom, normalizedTo)) {
    const entry = entryMap.get(row.moodEntryId);
    const score = entryScoreMap.get(row.moodEntryId);
    if (!entry || score == null) {
      continue;
    }

    const bucket = activityBuckets.get(row.activity) ?? [];
    bucket.push({
      score,
      intensity: entry.intensity,
    });
    activityBuckets.set(row.activity, bucket);
  }

  const activities = [...activityBuckets.entries()]
    .map(([activity, values]) => {
      const averageScore = average(values.map((value) => value.score));
      const delta = averageScore - overallScore;

      return {
        activity,
        averageScore,
        averageIntensity: average(values.map((value) => value.intensity)),
        sampleSize: values.length,
        direction: delta >= 0.7 ? 'positive' : delta <= -0.7 ? 'negative' : 'neutral',
      } satisfies MoodActivityCorrelation;
    })
    .sort((left, right) => {
      if (right.sampleSize !== left.sampleSize) {
        return right.sampleSize - left.sampleSize;
      }
      return Math.abs(right.averageScore - overallScore) - Math.abs(left.averageScore - overallScore);
    });

  const medications = getMedications(db)
    .map((medication) => {
      try {
        const correlation = getMoodMedicationCorrelation(db, medication.id);
        if (!correlation) {
          return null;
        }
        const changePercent = correlation.changePercent ?? 0;
        return {
          ...correlation,
          medicationId: medication.id,
          direction: changePercent >= 5 ? 'improved' : changePercent <= -5 ? 'declined' : 'flat',
        } satisfies MoodMedicationImpact;
      } catch {
        return null;
      }
    })
    .filter((item): item is MoodMedicationImpact => item != null)
    .filter((item) => item.beforeDataPoints > 0 || item.afterDataPoints > 0)
    .sort((left, right) => {
      const leftMagnitude = Math.abs(left.changePercent ?? 0);
      const rightMagnitude = Math.abs(right.changePercent ?? 0);
      return rightMagnitude - leftMagnitude;
    });

  return {
    activities,
    medications,
  };
}
