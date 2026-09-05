import type { DatabaseAdapter } from '@mylife/db';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  totalDaysLogged: number;
}

/**
 * Calculate logging streaks from the food log.
 * A "day" counts if at least one food log entry exists for that date.
 */
export function getStreakInfo(db: DatabaseAdapter): StreakInfo {
  const rows = db.query<{ log_date: string }>(
    'SELECT DISTINCT date AS log_date FROM nu_food_log ORDER BY date DESC',
  );

  if (rows.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalDaysLogged: 0 };
  }

  const dates = rows.map((r) => r.log_date);
  const totalDaysLogged = dates.length;

  // Current streak: count consecutive days ending at today (or yesterday)
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let currentStreak = 0;
  if (dates[0] === today || dates[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const curr = new Date(dates[i] + 'T00:00:00');
      const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Longest streak: scan all dates
  let longestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00');
    const curr = new Date(dates[i] + 'T00:00:00');
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (diffDays === 1) {
      runLength++;
      if (runLength > longestStreak) longestStreak = runLength;
    } else {
      runLength = 1;
    }
  }

  return { currentStreak, longestStreak, totalDaysLogged };
}
