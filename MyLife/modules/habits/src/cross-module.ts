/**
 * Cross-module interface implementation for MyHabits.
 *
 * Exposes habit data for hub-level search, dashboard summaries,
 * activity feeds, and cross-module correlation analysis.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CrossModuleInterface,
  SearchableItem,
  ModuleSummary,
  ActivityItem,
  CorrelationDataset,
  CorrelationDataPoint,
} from '@mylife/module-registry';

const MODULE_ID = 'habits';

interface HabitRow {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  habit_type: string;
  is_archived: number;
  updated_at: string;
}

interface CountRow {
  count: number;
}

interface LastActivityRow {
  last_activity: string | null;
}

interface CompletionRow {
  id: string;
  habit_id: string;
  completed_at: string;
}

interface HabitNameRow {
  id: string;
  name: string;
}

interface StreakDateRow {
  d: string;
}

interface DailyRateRow {
  date: string;
  completions: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ---------------------------------------------------------------------------
// getSearchableContent
// ---------------------------------------------------------------------------

export function getSearchableContent(db: DatabaseAdapter): SearchableItem[] {
  const habits = db.query<HabitRow>(
    `SELECT id, name, description, frequency, habit_type, is_archived, updated_at
     FROM hb_habits`,
  );

  return habits.map((h) => {
    const tags: string[] = [h.frequency, h.habit_type];
    if (h.is_archived) tags.push('archived');
    return {
      moduleId: MODULE_ID,
      type: 'habit',
      title: h.name,
      body: h.description ?? undefined,
      tags,
      itemId: h.id,
      updatedAt: h.updated_at,
    };
  });
}

// ---------------------------------------------------------------------------
// getDataSummary
// ---------------------------------------------------------------------------

export function getDataSummary(db: DatabaseAdapter): ModuleSummary {
  const totalRows = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM hb_habits WHERE is_archived = 0`,
  );
  const totalItems = totalRows[0]?.count ?? 0;

  // Today's completions vs active habits
  const today = new Date().toISOString().slice(0, 10);
  const todayCompletions = db.query<CountRow>(
    `SELECT COUNT(DISTINCT habit_id) as count FROM hb_completions
     WHERE completed_at LIKE ? ESCAPE '\\'`,
    [`${escapeLike(today)}%`],
  );
  const completedToday = todayCompletions[0]?.count ?? 0;
  const completionRate = totalItems > 0
    ? Math.round((completedToday / totalItems) * 100)
    : 0;

  // Best current streak across all active habits (single query approach)
  // Fetch recent completions for all active habits in one query, bounded to last 400 days
  const cutoff = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
  const recentCompletions = db.query<{ habit_id: string; d: string }>(
    `SELECT c.habit_id, DATE(c.completed_at) as d
     FROM hb_completions c
     INNER JOIN hb_habits h ON h.id = c.habit_id
     WHERE h.is_archived = 0 AND DATE(c.completed_at) >= ?
     GROUP BY c.habit_id, DATE(c.completed_at)
     ORDER BY c.habit_id, d DESC`,
    [cutoff],
  );
  // Group by habit
  const habitDatesMap = new Map<string, string[]>();
  for (const row of recentCompletions) {
    const dates = habitDatesMap.get(row.habit_id);
    if (dates) dates.push(row.d);
    else habitDatesMap.set(row.habit_id, [row.d]);
  }
  let bestCurrentStreak = 0;
  let bestLongestStreak = 0;
  for (const dates of habitDatesMap.values()) {
    const { currentStreak, longestStreak } = computeStreaks(dates, today);
    if (currentStreak > bestCurrentStreak) bestCurrentStreak = currentStreak;
    if (longestStreak > bestLongestStreak) bestLongestStreak = longestStreak;
  }

  const lastRows = db.query<LastActivityRow>(
    `SELECT MAX(completed_at) as last_activity FROM hb_completions`,
  );
  const lastActivity = lastRows[0]?.last_activity ?? undefined;

  return {
    moduleId: MODULE_ID,
    totalItems,
    stats: {
      completedToday,
      completionRate,
      bestCurrentStreak,
      bestLongestStreak,
    },
    lastActivity,
  };
}

// ---------------------------------------------------------------------------
// getActivityFeed
// ---------------------------------------------------------------------------

export function getActivityFeed(db: DatabaseAdapter, since: Date): ActivityItem[] {
  const sinceISO = since.toISOString();
  const items: ActivityItem[] = [];

  // Build a name lookup for habits
  const habitNames = new Map<string, string>();
  const nameRows = db.query<HabitNameRow>(`SELECT id, name FROM hb_habits`);
  for (const row of nameRows) {
    habitNames.set(row.id, row.name);
  }

  // Completions since date (bounded to 500 most recent)
  const completions = db.query<CompletionRow>(
    `SELECT id, habit_id, completed_at FROM hb_completions
     WHERE completed_at >= ?
     ORDER BY completed_at DESC
     LIMIT 500`,
    [sinceISO],
  );

  for (const c of completions) {
    const name = habitNames.get(c.habit_id) ?? 'Unknown habit';
    items.push({
      moduleId: MODULE_ID,
      action: 'completed',
      description: `Completed "${name}"`,
      timestamp: c.completed_at,
      itemId: c.habit_id,
      itemType: 'habit',
    });
  }

  // New habits created since date
  const habitsWithCreatedAt = db.query<{ id: string; name: string; created_at: string }>(
    `SELECT id, name, created_at FROM hb_habits WHERE created_at >= ? ORDER BY created_at DESC`,
    [sinceISO],
  );

  for (const h of habitsWithCreatedAt) {
    items.push({
      moduleId: MODULE_ID,
      action: 'created',
      description: `Created habit "${h.name}"`,
      timestamp: h.created_at,
      itemId: h.id,
      itemType: 'habit',
    });
  }

  // Streak milestones: check active habits only, bounded to last 400 days
  const milestones = [7, 14, 30, 60, 100, 365];
  const today = new Date().toISOString().slice(0, 10);
  const milestoneCutoff = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
  const activeHabitRows = db.query<HabitNameRow>(
    `SELECT id, name FROM hb_habits WHERE is_archived = 0`,
  );
  for (const habit of activeHabitRows) {
    const rows = db.query<StreakDateRow>(
      `SELECT DISTINCT DATE(completed_at) as d FROM hb_completions
       WHERE habit_id = ? AND DATE(completed_at) >= ?
       ORDER BY d DESC`,
      [habit.id, milestoneCutoff],
    );
    if (rows.length === 0) continue;
    const { currentStreak } = computeStreaks(rows.map((r) => r.d), today);
    for (const m of milestones) {
      if (currentStreak === m) {
        items.push({
          moduleId: MODULE_ID,
          action: 'milestone',
          description: `${habit.name}: ${m}-day streak!`,
          timestamp: new Date().toISOString(),
          itemId: habit.id,
          itemType: 'habit',
        });
        break;
      }
    }
  }

  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return items;
}

// ---------------------------------------------------------------------------
// getCorrelationData
// ---------------------------------------------------------------------------

export function getCorrelationData(db: DatabaseAdapter): CorrelationDataset {
  // Daily completion rate: (distinct habits completed) / (total active habits) per day
  const activeCount = db.query<CountRow>(
    `SELECT COUNT(*) as count FROM hb_habits WHERE is_archived = 0`,
  );
  const totalActive = activeCount[0]?.count ?? 0;

  if (totalActive === 0) {
    return { moduleId: MODULE_ID, series: [] };
  }

  const correlationCutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const dailyRows = db.query<DailyRateRow>(
    `SELECT DATE(completed_at) as date, COUNT(DISTINCT habit_id) as completions
     FROM hb_completions
     WHERE DATE(completed_at) >= ?
     GROUP BY DATE(completed_at)
     ORDER BY date ASC`,
    [correlationCutoff],
  );

  const completionRateData: CorrelationDataPoint[] = dailyRows.map((row) => ({
    date: row.date,
    value: Math.round((row.completions / totalActive) * 100),
  }));

  // Daily total completions (absolute count)
  const completionCountData: CorrelationDataPoint[] = dailyRows.map((row) => ({
    date: row.date,
    value: row.completions,
  }));

  return {
    moduleId: MODULE_ID,
    series: [
      {
        metric: 'habit_completion_rate',
        label: 'Habit Completion Rate',
        unit: '%',
        data: completionRateData,
      },
      {
        metric: 'habit_completions',
        label: 'Habits Completed',
        unit: 'habits',
        data: completionCountData,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Assembled interface
// ---------------------------------------------------------------------------

export const habitsCrossModule: CrossModuleInterface = {
  getSearchableContent: (db: unknown) => getSearchableContent(db as DatabaseAdapter),
  getDataSummary: (db: unknown) => getDataSummary(db as DatabaseAdapter),
  getActivityFeed: (db: unknown, since: Date) => getActivityFeed(db as DatabaseAdapter, since),
  getCorrelationData: (db: unknown) => getCorrelationData(db as DatabaseAdapter),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStreaks(
  dates: string[],
  today: string,
): { currentStreak: number; longestStreak: number } {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 1;

  const isCurrentDay = dates[0] === today;
  if (isCurrentDay) currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00Z');
    const curr = new Date(dates[i] + 'T00:00:00Z');
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
      if (isCurrentDay && i < streak) currentStreak = streak;
    } else {
      if (streak > longestStreak) longestStreak = streak;
      streak = 1;
    }
  }
  if (streak > longestStreak) longestStreak = streak;
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  return { currentStreak, longestStreak };
}
