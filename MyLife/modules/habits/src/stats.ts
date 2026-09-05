import type { DatabaseAdapter } from '@mylife/db';
import type { HabitStats, OverallStats } from './types';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'night'];

// ---------------------------------------------------------------------------
// Per-habit statistics
// ---------------------------------------------------------------------------

/**
 * Completion rate broken down by day of week (0=Sun .. 6=Sat).
 */
export function getCompletionRateByDayOfWeek(
  db: DatabaseAdapter,
  habitId: string,
): Record<string, number> {
  const rows = db.query<{ dow: number; cnt: number }>(
    `SELECT CAST(strftime('%w', completed_at) AS INTEGER) as dow, COUNT(*) as cnt
     FROM hb_completions WHERE habit_id = ?
     GROUP BY dow`,
    [habitId],
  );
  const total = rows.reduce((sum, r) => sum + r.cnt, 0);
  const result: Record<string, number> = {};
  for (const day of DAY_NAMES) result[day] = 0;
  for (const row of rows) {
    result[DAY_NAMES[row.dow]] = total > 0 ? row.cnt / total : 0;
  }
  return result;
}

/**
 * Completion rate broken down by time of day.
 */
export function getCompletionRateByTimeOfDay(
  db: DatabaseAdapter,
  habitId: string,
): Record<string, number> {
  const rows = db.query<{ hour: number; cnt: number }>(
    `SELECT CAST(strftime('%H', completed_at) AS INTEGER) as hour, COUNT(*) as cnt
     FROM hb_completions WHERE habit_id = ?
     GROUP BY hour`,
    [habitId],
  );
  const total = rows.reduce((sum, r) => sum + r.cnt, 0);
  const buckets: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const row of rows) {
    const slot = hourToSlot(row.hour);
    buckets[slot] += row.cnt;
  }
  for (const slot of TIME_SLOTS) {
    buckets[slot] = total > 0 ? buckets[slot] / total : 0;
  }
  return buckets;
}

/**
 * Monthly completion rate for a given year.
 * Returns { "01": rate, "02": rate, ... "12": rate }.
 */
export function getMonthlyCompletionRate(
  db: DatabaseAdapter,
  habitId: string,
  year: number,
): Record<string, number> {
  const habitRows = db.query<{ created_at: string }>(
    'SELECT created_at FROM hb_habits WHERE id = ?',
    [habitId],
  );
  const createdDate = habitRows.length > 0 ? habitRows[0].created_at.slice(0, 10) : `${year}-01-01`;

  const rows = db.query<{ m: string; cnt: number }>(
    `SELECT strftime('%m', completed_at) as m, COUNT(DISTINCT DATE(completed_at)) as cnt
     FROM hb_completions
     WHERE habit_id = ? AND strftime('%Y', completed_at) = ?
     GROUP BY m`,
    [habitId, String(year)],
  );

  const result: Record<string, number> = {};
  for (let m = 1; m <= 12; m++) {
    const key = String(m).padStart(2, '0');
    const daysInMonth = new Date(year, m, 0).getDate();
    // Only count days from when habit was created
    const monthStart = `${year}-${key}-01`;
    const activeDays = createdDate > monthStart
      ? Math.max(0, daysInMonth - (new Date(createdDate).getDate() - 1))
      : daysInMonth;
    const found = rows.find((r) => r.m === key);
    result[key] = activeDays > 0 && found ? found.cnt / activeDays : 0;
  }
  return result;
}

/**
 * Yearly aggregate stats for a single habit.
 */
export function getYearlyStats(
  db: DatabaseAdapter,
  habitId: string,
): HabitStats {
  const totalRows = db.query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM hb_completions WHERE habit_id = ?',
    [habitId],
  );
  const totalCompletions = totalRows[0].cnt;

  // Days with at least one completion
  const distinctDays = db.query<{ cnt: number }>(
    'SELECT COUNT(DISTINCT DATE(completed_at)) as cnt FROM hb_completions WHERE habit_id = ?',
    [habitId],
  );

  // Days since habit created
  const habitRows = db.query<{ created_at: string }>(
    'SELECT created_at FROM hb_habits WHERE id = ?',
    [habitId],
  );
  const createdDate = habitRows.length > 0 ? habitRows[0].created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = Math.max(1, daysBetween(createdDate, today));
  const completionRate = distinctDays[0].cnt / totalDays;

  // Best day of week
  const byDow = getCompletionRateByDayOfWeek(db, habitId);
  const bestDay = Object.entries(byDow).reduce((a, b) => b[1] > a[1] ? b : a, ['none', 0])[0];

  // Best time of day
  const byTod = getCompletionRateByTimeOfDay(db, habitId);
  const bestTimeOfDay = Object.entries(byTod).reduce((a, b) => b[1] > a[1] ? b : a, ['none', 0])[0];

  // Monthly rates for current year
  const currentYear = new Date().getFullYear();
  const monthlyRates = getMonthlyCompletionRate(db, habitId, currentYear);

  // Weeks since created
  const weeks = Math.max(1, totalDays / 7);
  const averagePerWeek = totalCompletions / weeks;

  // Best streak
  const streakRows = db.query<{ d: string }>(
    `SELECT DISTINCT DATE(completed_at) as d FROM hb_completions WHERE habit_id = ? ORDER BY d ASC`,
    [habitId],
  );
  let bestStreak = 0;
  let streak = 1;
  for (let i = 1; i < streakRows.length; i++) {
    const gap = daysBetween(streakRows[i - 1].d, streakRows[i].d);
    if (gap === 1) {
      streak++;
    } else {
      if (streak > bestStreak) bestStreak = streak;
      streak = 1;
    }
  }
  if (streak > bestStreak) bestStreak = streak;
  if (streakRows.length === 0) bestStreak = 0;

  return {
    totalCompletions,
    completionRate,
    bestDay,
    bestTimeOfDay,
    monthlyRates,
    averagePerWeek,
    bestStreak,
  };
}

// ---------------------------------------------------------------------------
// Overall statistics
// ---------------------------------------------------------------------------

/**
 * Aggregate stats across all habits.
 */
export function getOverallStats(db: DatabaseAdapter): OverallStats {
  const habitCount = db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM hb_habits')[0].cnt;
  const completionCount = db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM hb_completions')[0].cnt;

  // Per-habit completion counts
  const perHabit = db.query<{ id: string; name: string; cnt: number }>(
    `SELECT h.id, h.name, COUNT(c.id) as cnt
     FROM hb_habits h LEFT JOIN hb_completions c ON h.id = c.habit_id
     GROUP BY h.id
     ORDER BY cnt DESC`,
  );

  let averageCompletionRate = 0;
  let bestHabit: OverallStats['bestHabit'] = null;

  if (perHabit.length > 0) {
    const today = new Date().toISOString().slice(0, 10);

    // Single query: get created_at + distinct completion days per habit
    const rateRows = db.query<{ id: string; name: string; created_at: string; distinct_days: number }>(
      `SELECT h.id, h.name, h.created_at,
              COUNT(DISTINCT DATE(c.completed_at)) as distinct_days
       FROM hb_habits h
       LEFT JOIN hb_completions c ON h.id = c.habit_id
       GROUP BY h.id`,
    );

    let totalRate = 0;
    let bestRate = 0;
    for (const row of rateRows) {
      const created = row.created_at.slice(0, 10);
      const days = Math.max(1, daysBetween(created, today));
      const rate = row.distinct_days / days;
      totalRate += rate;
      if (rate > bestRate && row.distinct_days > 0) {
        bestRate = rate;
        bestHabit = { id: row.id, name: row.name, completionRate: rate };
      }
    }
    averageCompletionRate = rateRows.length > 0 ? totalRate / rateRows.length : 0;
  }

  return {
    totalHabits: habitCount,
    totalCompletions: completionCount,
    averageCompletionRate,
    bestHabit,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hourToSlot(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function daysBetween(earlier: string, later: string): number {
  const d1 = new Date(earlier + 'T00:00:00Z');
  const d2 = new Date(later + 'T00:00:00Z');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}
