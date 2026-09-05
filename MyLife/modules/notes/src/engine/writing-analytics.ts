/**
 * Writing analytics engine for MyNotes.
 * Tracks note creation patterns, word count trends, and topic evolution.
 * All pure functions operating on existing Note data.
 */

import type { Note } from '../types';

// ── Note Creation Trends ─────────────────────────────────────────────

export interface CreationTrend {
  period: string; // ISO date (day) or YYYY-WW (week)
  count: number;
  totalWords: number;
}

/**
 * Compute note creation trends grouped by day.
 * Returns the last N days of activity.
 */
export function computeDailyCreationTrend(
  notes: Note[],
  days = 30,
  now: string = new Date().toISOString(),
): CreationTrend[] {
  const nowDate = new Date(now);
  const cutoff = new Date(nowDate);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();

  // Initialize all days in range
  const dayMap = new Map<string, CreationTrend>();
  for (let d = 0; d < days; d++) {
    const date = new Date(nowDate);
    date.setDate(date.getDate() - d);
    const key = date.toISOString().slice(0, 10);
    dayMap.set(key, { period: key, count: 0, totalWords: 0 });
  }

  for (const note of notes) {
    if (note.createdAt < cutoffIso) continue;
    const day = note.createdAt.slice(0, 10);
    const entry = dayMap.get(day);
    if (entry) {
      entry.count++;
      entry.totalWords += note.wordCount;
    }
  }

  return Array.from(dayMap.values()).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Compute note creation trends grouped by week.
 */
export function computeWeeklyCreationTrend(
  notes: Note[],
  weeks = 12,
  now: string = new Date().toISOString(),
): CreationTrend[] {
  const nowDate = new Date(now);
  const cutoff = new Date(nowDate);
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const cutoffIso = cutoff.toISOString();

  const weekMap = new Map<string, CreationTrend>();

  for (const note of notes) {
    if (note.createdAt < cutoffIso) continue;
    const d = new Date(note.createdAt);
    const week = getIsoWeek(d);
    if (!weekMap.has(week)) {
      weekMap.set(week, { period: week, count: 0, totalWords: 0 });
    }
    const entry = weekMap.get(week)!;
    entry.count++;
    entry.totalWords += note.wordCount;
  }

  return Array.from(weekMap.values()).sort((a, b) => a.period.localeCompare(b.period));
}

function getIsoWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Word Count Distribution ──────────────────────────────────────────

export interface WordCountBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

/**
 * Distribute notes into word count buckets for histogram display.
 */
export function computeWordCountDistribution(notes: Note[]): WordCountBucket[] {
  const buckets: WordCountBucket[] = [
    { label: 'Quick (0-50)', min: 0, max: 50, count: 0 },
    { label: 'Short (51-200)', min: 51, max: 200, count: 0 },
    { label: 'Medium (201-500)', min: 201, max: 500, count: 0 },
    { label: 'Long (501-1000)', min: 501, max: 1000, count: 0 },
    { label: 'Deep (1000+)', min: 1001, max: Infinity, count: 0 },
  ];

  for (const note of notes) {
    for (const bucket of buckets) {
      if (note.wordCount >= bucket.min && note.wordCount <= bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  return buckets;
}

// ── Writing Velocity ─────────────────────────────────────────────────

export interface WritingVelocity {
  notesPerWeek: number;
  wordsPerWeek: number;
  avgWordsPerNote: number;
  longestNote: { id: string; title: string; wordCount: number } | null;
  mostProductiveDay: string | null; // 'Monday', 'Tuesday', etc.
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Compute writing velocity metrics over a given period.
 */
export function computeWritingVelocity(
  notes: Note[],
  weeks = 4,
  now: string = new Date().toISOString(),
): WritingVelocity {
  const nowDate = new Date(now);
  const cutoff = new Date(nowDate);
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const cutoffIso = cutoff.toISOString();

  const recent = notes.filter((n) => n.createdAt >= cutoffIso);

  if (recent.length === 0) {
    return {
      notesPerWeek: 0,
      wordsPerWeek: 0,
      avgWordsPerNote: 0,
      longestNote: null,
      mostProductiveDay: null,
    };
  }

  const totalWords = recent.reduce((sum, n) => sum + n.wordCount, 0);

  // Find most productive day of week
  const dayCounts = new Array(7).fill(0);
  for (const note of recent) {
    const day = new Date(note.createdAt).getDay();
    dayCounts[day]++;
  }
  const maxDayIdx = dayCounts.indexOf(Math.max(...dayCounts));

  // Find longest note
  const longest = recent.reduce((max, n) => n.wordCount > max.wordCount ? n : max, recent[0]);

  return {
    notesPerWeek: Math.round((recent.length / weeks) * 10) / 10,
    wordsPerWeek: Math.round(totalWords / weeks),
    avgWordsPerNote: Math.round(totalWords / recent.length),
    longestNote: { id: longest.id, title: longest.title, wordCount: longest.wordCount },
    mostProductiveDay: DAY_NAMES[maxDayIdx],
  };
}

// ── Streak Tracking ──────────────────────────────────────────────────

export interface WritingStreak {
  currentStreak: number; // consecutive days with at least one note
  longestStreak: number;
  totalActiveDays: number;
}

/**
 * Compute writing streak from note creation dates.
 * A streak counts consecutive calendar days with at least one note created.
 */
export function computeWritingStreak(
  notes: Note[],
  now: string = new Date().toISOString(),
): WritingStreak {
  if (notes.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalActiveDays: 0 };
  }

  // Collect unique active days
  const activeDays = new Set<string>();
  for (const note of notes) {
    activeDays.add(note.createdAt.slice(0, 10));
  }

  const sorted = Array.from(activeDays).sort();
  const totalActiveDays = sorted.length;

  // Compute streaks
  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentRun++;
    } else {
      longestStreak = Math.max(longestStreak, currentRun);
      currentRun = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentRun);

  // Check if current streak is active (last note today or yesterday)
  const today = now.slice(0, 10);
  const yesterday = new Date(new Date(now).getTime() - 86400000).toISOString().slice(0, 10);
  const lastDay = sorted[sorted.length - 1];

  let currentStreak = 0;
  if (lastDay === today || lastDay === yesterday) {
    currentStreak = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const curr = new Date(sorted[i + 1]);
      const prev = new Date(sorted[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak, totalActiveDays };
}

// ── Aggregate Insights ───────────────────────────────────────────────

export interface WritingAnalyticsInsights {
  velocity: WritingVelocity;
  streak: WritingStreak;
  wordCountDistribution: WordCountBucket[];
  dailyTrend: CreationTrend[];
  weeklyTrend: CreationTrend[];
}

/**
 * Compute all writing analytics insights.
 */
export function computeWritingAnalytics(
  notes: Note[],
  now?: string,
): WritingAnalyticsInsights {
  return {
    velocity: computeWritingVelocity(notes, 4, now),
    streak: computeWritingStreak(notes, now),
    wordCountDistribution: computeWordCountDistribution(notes),
    dailyTrend: computeDailyCreationTrend(notes, 30, now),
    weeklyTrend: computeWeeklyCreationTrend(notes, 12, now),
  };
}
