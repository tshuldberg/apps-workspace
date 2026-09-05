import type { MoodStreak, WeeklyReport } from '../types';

/**
 * Calculate mood logging streaks from a sorted array of distinct dates (DESC order).
 * Pure function - no I/O.
 */
export function calculateStreaks(
  distinctDates: string[],
  referenceDate: string,
): MoodStreak {
  if (distinctDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastLogDate: null };
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;
  let expectedDate = referenceDate;
  let currentFound = false;

  for (const date of distinctDates) {
    if (date === expectedDate) {
      runningStreak++;
      expectedDate = previousDay(expectedDate);
    } else {
      if (!currentFound) {
        currentStreak = runningStreak;
        currentFound = true;
      }
      if (runningStreak > longestStreak) longestStreak = runningStreak;

      // Check if this date is the day before (grace: allow 1-day gap for current streak)
      if (!currentFound && runningStreak === 0 && date === previousDay(referenceDate)) {
        runningStreak = 1;
        expectedDate = previousDay(date);
      } else {
        runningStreak = 1;
        expectedDate = previousDay(date);
      }
    }
  }

  if (!currentFound) currentStreak = runningStreak;
  if (runningStreak > longestStreak) longestStreak = runningStreak;

  return {
    currentStreak,
    longestStreak,
    lastLogDate: distinctDates[0],
  };
}

function previousDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Map a 1-10 mood score to a Year-in-Pixels color.
 * Returns a hex color string.
 */
export function scoreToPixelColor(score: number): string {
  const colors: Record<number, string> = {
    1: '#EF4444',
    2: '#F87171',
    3: '#F97316',
    4: '#FB923C',
    5: '#EAB308',
    6: '#FACC15',
    7: '#22C55E',
    8: '#4ADE80',
    9: '#3B82F6',
    10: '#60A5FA',
  };
  return colors[Math.max(1, Math.min(10, Math.round(score)))] ?? '#6B7280';
}

/**
 * Calculate Pearson correlation coefficient between two numeric arrays.
 * Returns null if arrays have fewer than 5 data points or zero variance.
 */
export function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 5) return null;

  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) { sumX += x[i]; sumY += y[i]; }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return null;

  return Math.round((numerator / denom) * 1000) / 1000;
}

/**
 * Determine if a Pearson r value indicates a significant correlation.
 * Uses |r| >= 0.3 as the significance threshold per spec.
 */
export function isSignificantCorrelation(r: number | null): boolean {
  if (r === null) return false;
  return Math.abs(r) >= 0.3;
}

// ── Weekly Report ────────────────────────────────────────────────────

export interface WeeklyReportEntry {
  score: number;
  date: string;
  activityNames: string[];
  emotions: string[];
}

/**
 * Generate a weekly report from entry data.
 * Pure function -- no I/O. Takes a date range and entry data, returns a WeeklyReport.
 */
export function generateWeeklyReport(
  weekStart: string,
  weekEnd: string,
  entries: WeeklyReportEntry[],
): WeeklyReport {
  if (entries.length === 0) {
    return {
      weekStart,
      weekEnd,
      average: 0,
      high: 0,
      low: 0,
      entryCount: 0,
      topActivities: [],
      topEmotions: [],
    };
  }

  const scores = entries.map((e) => e.score);
  const average = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  const high = Math.max(...scores);
  const low = Math.min(...scores);

  // Count activities
  const activityCounts: Record<string, number> = {};
  for (const e of entries) {
    for (const name of e.activityNames) {
      activityCounts[name] = (activityCounts[name] ?? 0) + 1;
    }
  }
  const topActivities = Object.entries(activityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Count emotions
  const emotionCounts: Record<string, number> = {};
  for (const e of entries) {
    for (const emotion of e.emotions) {
      emotionCounts[emotion] = (emotionCounts[emotion] ?? 0) + 1;
    }
  }
  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emotion, count]) => ({ emotion, count }));

  return {
    weekStart,
    weekEnd,
    average,
    high,
    low,
    entryCount: entries.length,
    topActivities,
    topEmotions,
  };
}
