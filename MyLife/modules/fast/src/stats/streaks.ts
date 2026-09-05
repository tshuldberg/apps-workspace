import type { DatabaseAdapter } from '@mylife/db';
import type { StreakCache } from '../types';

/**
 * Compute streak data from the ft_fasts table.
 *
 * Rules:
 * - A fast "counts" for the day it was STARTED (not ended).
 * - A day is a "streak day" if at least one fast started on that day hit its target.
 * - Current streak = consecutive days (ending at today or yesterday) with at least one target-hit fast.
 * - Longest streak = all-time max consecutive target-hit days.
 */
export function computeStreaks(db: DatabaseAdapter): StreakCache {
  const rows = db.query<{ fast_date: string }>(
    `SELECT DISTINCT date(started_at) as fast_date
     FROM ft_fasts
     WHERE hit_target = 1 AND ended_at IS NOT NULL
     ORDER BY fast_date DESC
     LIMIT 3650`,
  );

  const totalRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM ft_fasts WHERE ended_at IS NOT NULL`,
  );
  const totalFasts = totalRows[0]?.count ?? 0;

  if (rows.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalFasts };
  }

  const dates = rows.map((r) => r.fast_date);

  function toDayNumber(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  }

  const dayNumbers = dates.map(toDayNumber);

  const now = new Date();
  const todayDayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);

  let currentStreak = 0;
  const mostRecentDay = dayNumbers[0];

  if (todayDayNumber - mostRecentDay <= 1) {
    currentStreak = 1;
    for (let i = 1; i < dayNumbers.length; i++) {
      if (dayNumbers[i - 1] - dayNumbers[i] === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let longestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < dayNumbers.length; i++) {
    if (dayNumbers[i - 1] - dayNumbers[i] === 1) {
      runLength++;
      if (runLength > longestStreak) {
        longestStreak = runLength;
      }
    } else {
      runLength = 1;
    }
  }

  return { currentStreak, longestStreak, totalFasts };
}

/** Recompute streaks and write to the ft_streak_cache table */
export function refreshStreakCache(db: DatabaseAdapter): StreakCache {
  const streaks = computeStreaks(db);

  db.transaction(() => {
    const now = new Date().toISOString();
    const entries: [string, number][] = [
      ['current_streak', streaks.currentStreak],
      ['longest_streak', streaks.longestStreak],
      ['total_fasts', streaks.totalFasts],
    ];

    for (const [key, value] of entries) {
      db.execute(
        `INSERT OR REPLACE INTO ft_streak_cache (key, value, updated_at) VALUES (?, ?, ?)`,
        [key, value, now],
      );
    }
  });

  return streaks;
}

/** Read cached streak values. Falls back to computing if cache is empty. */
export function getStreaks(db: DatabaseAdapter): StreakCache {
  const currentRows = db.query<{ value: number }>(`SELECT value FROM ft_streak_cache WHERE key = 'current_streak'`);
  const longestRows = db.query<{ value: number }>(`SELECT value FROM ft_streak_cache WHERE key = 'longest_streak'`);
  const totalRows = db.query<{ value: number }>(`SELECT value FROM ft_streak_cache WHERE key = 'total_fasts'`);

  if (currentRows[0] !== undefined && longestRows[0] !== undefined && totalRows[0] !== undefined) {
    return {
      currentStreak: currentRows[0].value,
      longestStreak: longestRows[0].value,
      totalFasts: totalRows[0].value,
    };
  }

  return refreshStreakCache(db);
}
