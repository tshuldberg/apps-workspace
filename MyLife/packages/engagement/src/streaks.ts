/**
 * Life Engagement Streak engine.
 *
 * Tracks consecutive days where the user logged data in 3+ modules.
 * Uses the crossModule.getActivityFeed() interface to detect activity
 * per module on a given date.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleDefinition } from '@mylife/module-registry';
import type { StreakRecord, StreakStatus } from './types';
import { STREAK_THRESHOLD } from './types';

interface StreakRow {
  date: string;
  modules_active: number;
  module_ids: string;
  streak_count: number;
}

/**
 * Record which modules had activity on a given date.
 *
 * Scans all enabled modules' activity feeds for the given date and
 * stores the result. Recalculates the streak count based on the
 * previous day's record.
 */
export function recordDailyActivity(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
  date: string,
): StreakRecord {
  const dayStart = new Date(`${date}T00:00:00.000Z`);

  const activeModuleIds: string[] = [];

  for (const mod of modules) {
    if (!mod.crossModule?.getActivityFeed) continue;
    try {
      const items = mod.crossModule.getActivityFeed(db, dayStart);
      // Filter to only items on this specific date
      const dayItems = items.filter((item) => {
        const ts = item.timestamp.slice(0, 10);
        return ts === date;
      });
      if (dayItems.length > 0) {
        activeModuleIds.push(mod.id);
      }
    } catch {
      // Skip failing modules
    }
  }

  const modulesActive = activeModuleIds.length;

  // Calculate streak count
  let streakCount = 0;
  if (modulesActive >= STREAK_THRESHOLD) {
    const previousDate = getPreviousDate(date);
    const prev = getStreakRecord(db, previousDate);
    streakCount = prev && prev.streakCount > 0 ? prev.streakCount + 1 : 1;
  }

  const moduleIdsJson = JSON.stringify(activeModuleIds);

  db.execute(
    `INSERT OR REPLACE INTO hub_engagement_streaks (date, modules_active, module_ids, streak_count)
     VALUES (?, ?, ?, ?)`,
    [date, modulesActive, moduleIdsJson, streakCount],
  );

  return {
    date,
    modulesActive,
    moduleIds: activeModuleIds,
    streakCount,
  };
}

/**
 * Get the streak record for a specific date.
 */
export function getStreakRecord(
  db: DatabaseAdapter,
  date: string,
): StreakRecord | null {
  const rows = db.query<StreakRow>(
    `SELECT date, modules_active, module_ids, streak_count
     FROM hub_engagement_streaks
     WHERE date = ?
     LIMIT 1`,
    [date],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    date: row.date,
    modulesActive: row.modules_active,
    moduleIds: parseModuleIds(row.module_ids),
    streakCount: row.streak_count,
  };
}

/**
 * Get the current streak status.
 *
 * Looks at today and yesterday to determine if the streak is active.
 * If today doesn't qualify yet, the streak is based on yesterday.
 */
export function getStreakStatus(
  db: DatabaseAdapter,
  today: string,
): StreakStatus {
  const todayRecord = getStreakRecord(db, today);
  const yesterdayRecord = getStreakRecord(db, getPreviousDate(today));

  const todayQualifies = (todayRecord?.modulesActive ?? 0) >= STREAK_THRESHOLD;
  const todayModuleCount = todayRecord?.modulesActive ?? 0;

  // Current streak: today's if qualifying, else yesterday's if it was qualifying
  let currentStreak = 0;
  if (todayQualifies) {
    currentStreak = todayRecord?.streakCount ?? 0;
  } else if (yesterdayRecord && yesterdayRecord.streakCount > 0) {
    // Streak is still "alive" -- user has until end of today to extend it
    currentStreak = yesterdayRecord.streakCount;
  }

  // Longest streak: query the max
  const longestRows = db.query<{ max_streak: number }>(
    `SELECT MAX(streak_count) as max_streak FROM hub_engagement_streaks`,
  );
  const longestStreak = longestRows[0]?.max_streak ?? 0;

  // Last active date
  const lastRows = db.query<{ date: string }>(
    `SELECT date FROM hub_engagement_streaks
     WHERE modules_active >= ?
     ORDER BY date DESC
     LIMIT 1`,
    [STREAK_THRESHOLD],
  );
  const lastActiveDate = lastRows[0]?.date ?? null;

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastActiveDate,
    todayQualifies,
    todayModuleCount,
  };
}

/**
 * Backfill streak records for a date range.
 *
 * Useful when the engagement system is first enabled and needs to
 * retroactively calculate streaks from existing module data.
 */
export function backfillStreaks(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
  startDate: string,
  endDate: string,
): StreakRecord[] {
  const records: StreakRecord[] = [];
  let current = startDate;

  while (current <= endDate) {
    const record = recordDailyActivity(db, modules, current);
    records.push(record);
    current = getNextDate(current);
  }

  return records;
}

/**
 * Get streak history for display (most recent first).
 */
export function getStreakHistory(
  db: DatabaseAdapter,
  limit = 30,
): StreakRecord[] {
  const rows = db.query<StreakRow>(
    `SELECT date, modules_active, module_ids, streak_count
     FROM hub_engagement_streaks
     ORDER BY date DESC
     LIMIT ?`,
    [limit],
  );

  return rows.map((row) => ({
    date: row.date,
    modulesActive: row.modules_active,
    moduleIds: parseModuleIds(row.module_ids),
    streakCount: row.streak_count,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseModuleIds(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** Get the previous calendar date (YYYY-MM-DD). */
export function getPreviousDate(date: string): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Get the next calendar date (YYYY-MM-DD). */
export function getNextDate(date: string): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
