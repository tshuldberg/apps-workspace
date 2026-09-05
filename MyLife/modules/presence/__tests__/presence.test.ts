import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import type { DatabaseAdapter } from '@mylife/db';
import { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS, V2_INDEXES, V2_TABLES } from '../src/db/schema';
import {
  upsertDailyUsage,
  getDailyUsageByDate,
  getDailyUsageRange,
  createAppUsage,
  getAppUsageByDate,
  getTopApps,
  createGoal,
  getActiveGoal,
  getAllGoals,
  createFocusSession,
  completeFocusSession,
  updateFocusSessionRating,
  abandonFocusSession,
  getFocusSession,
  getFocusSessions,
  upsertAppIntention,
  getAppIntention,
  getAllActiveIntentions,
  deactivateIntention,
  recordAppOpen,
  rateAppOpen,
  getAppOpensForDate,
  countAppOpensForDate,
  awardXP,
  getTotalXP,
  getXPForDate,
  getSetting,
  setSetting,
} from '../src/db';
import {
  calculateStreaks,
  isStreakAtRisk,
  calculateXP,
  calculateStreakBonus,
  getLevelForXP,
  xpForLevel,
  getXPProgress,
  buildDailySummary,
  buildWeeklySummary,
  buildCategoryBreakdown,
  buildPresenceRecommendations,
  formatScreenTime,
  calculateImprovement,
} from '../src/engines';
import {
  getPresenceBadgePreview,
  getPresenceLevelTitle,
} from '../src/badges';
import { PRESENCE_MODULE } from '../src/definition';
import type { DailyUsage, AppUsage } from '../src/types';

function createTestAdapter(): DatabaseAdapter {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const adapter: DatabaseAdapter = {
    execute(sql: string, params?: unknown[]): void {
      db.prepare(sql).run(...(params ?? []));
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      return db.prepare(sql).all(...(params ?? [])) as T[];
    },
    transaction(fn: () => void): void {
      db.transaction(fn)();
    },
  };

  // Run V1 migration
  for (const sql of ALL_TABLES) adapter.execute(sql);
  for (const sql of CREATE_INDEXES) adapter.execute(sql);
  for (const sql of SEED_SETTINGS) adapter.execute(sql);
  for (const sql of V2_TABLES) adapter.execute(sql);
  for (const sql of V2_INDEXES) adapter.execute(sql);

  return adapter;
}

// ── Module Definition ─────────────────────────────────────────────────────

describe('PRESENCE_MODULE definition', () => {
  it('has correct id and prefix', () => {
    expect(PRESENCE_MODULE.id).toBe('presence');
    expect(PRESENCE_MODULE.tablePrefix).toBe('pr_');
  });

  it('has the current schema migrations', () => {
    expect(PRESENCE_MODULE.migrations).toHaveLength(2);
    expect(PRESENCE_MODULE.schemaVersion).toBe(2);
  });

  it('has 4 tabs and 15 screens', () => {
    expect(PRESENCE_MODULE.navigation.tabs).toHaveLength(4);
    expect(PRESENCE_MODULE.navigation.screens).toHaveLength(15);
  });
});

describe('presence progression helpers', () => {
  it('maps levels to the correct editorial titles', () => {
    expect(getPresenceLevelTitle(1)).toBe('Beginner');
    expect(getPresenceLevelTitle(18)).toBe('Focused');
    expect(getPresenceLevelTitle(50)).toBe('Zen Master');
  });

  it('returns a mixed badge preview for the home rail', () => {
    const preview = getPresenceBadgePreview({
      totalXP: 1400,
      level: 12,
      currentStreak: 4,
      longestStreak: 9,
      completedSessions: 7,
      totalDays: 12,
      activeIntentions: 1,
    });

    expect(preview).toHaveLength(6);
    expect(preview.some((badge) => badge.earned)).toBe(true);
    expect(preview.some((badge) => !badge.earned)).toBe(true);
  });
});

// ── Daily Usage CRUD ──────────────────────────────────────────────────────

describe('daily usage CRUD', () => {
  let db: DatabaseAdapter;
  beforeEach(() => { db = createTestAdapter(); });

  it('upserts and retrieves daily usage', () => {
    const result = upsertDailyUsage(db, {
      date: '2026-03-29',
      total_minutes: 185,
      goal_minutes: 180,
      goal_met: true,
      pickups: 42,
    });
    expect(result.date).toBe('2026-03-29');
    expect(result.total_minutes).toBe(185);
    expect(result.goal_met).toBe(1);

    const fetched = getDailyUsageByDate(db, '2026-03-29');
    expect(fetched).not.toBeNull();
    expect(fetched!.pickups).toBe(42);
  });

  it('updates on conflict', () => {
    upsertDailyUsage(db, { date: '2026-03-29', total_minutes: 100 });
    upsertDailyUsage(db, { date: '2026-03-29', total_minutes: 200 });
    const fetched = getDailyUsageByDate(db, '2026-03-29');
    expect(fetched!.total_minutes).toBe(200);
  });

  it('queries range', () => {
    upsertDailyUsage(db, { date: '2026-03-27', total_minutes: 100 });
    upsertDailyUsage(db, { date: '2026-03-28', total_minutes: 150 });
    upsertDailyUsage(db, { date: '2026-03-29', total_minutes: 200 });
    const range = getDailyUsageRange(db, '2026-03-27', '2026-03-29');
    expect(range).toHaveLength(3);
  });
});

// ── App Usage CRUD ────────────────────────────────────────────────────────

describe('app usage CRUD', () => {
  let db: DatabaseAdapter;
  beforeEach(() => { db = createTestAdapter(); });

  it('creates and queries app usage', () => {
    createAppUsage(db, { date: '2026-03-29', app_id: 'com.instagram', app_name: 'Instagram', category: 'social', minutes: 45, opens: 12 });
    createAppUsage(db, { date: '2026-03-29', app_id: 'com.tiktok', app_name: 'TikTok', category: 'entertainment', minutes: 30, opens: 8 });
    const usage = getAppUsageByDate(db, '2026-03-29');
    expect(usage).toHaveLength(2);
    expect(usage[0].app_name).toBe('Instagram'); // sorted by minutes desc
  });

  it('gets top apps', () => {
    createAppUsage(db, { date: '2026-03-29', app_id: 'a', app_name: 'AppA', minutes: 60 });
    createAppUsage(db, { date: '2026-03-29', app_id: 'b', app_name: 'AppB', minutes: 30 });
    const top = getTopApps(db, '2026-03-29', '2026-03-29', 1);
    expect(top).toHaveLength(1);
    expect(top[0].app_name).toBe('AppA');
  });
});

// ── Goals CRUD ────────────────────────────────────────────────────────────

describe('goals CRUD', () => {
  let db: DatabaseAdapter;
  beforeEach(() => { db = createTestAdapter(); });

  it('creates and retrieves active goal', () => {
    createGoal(db, { daily_minutes: 180, effective_date: '2026-03-01' });
    createGoal(db, { daily_minutes: 150, effective_date: '2026-03-15' });
    const active = getActiveGoal(db, '2026-03-20');
    expect(active!.daily_minutes).toBe(150);
  });

  it('lists all goals', () => {
    createGoal(db, { daily_minutes: 180, effective_date: '2026-03-01' });
    createGoal(db, { daily_minutes: 150, effective_date: '2026-03-15' });
    expect(getAllGoals(db)).toHaveLength(2);
  });
});

// ── Focus Sessions CRUD ───────────────────────────────────────────────────

describe('focus sessions CRUD', () => {
  let db: DatabaseAdapter;
  beforeEach(() => { db = createTestAdapter(); });

  it('creates and completes a session', () => {
    const session = createFocusSession(db, { planned_minutes: 30 });
    expect(session.completed).toBe(0);
    expect(session.type).toBe('solo');

    completeFocusSession(db, session.id, 28, 4);
    const updated = getFocusSession(db, session.id);
    expect(updated!.completed).toBe(1);
    expect(updated!.actual_minutes).toBe(28);
    expect(updated!.rating).toBe(4);
  });

  it('abandons a session', () => {
    const session = createFocusSession(db, { planned_minutes: 60, type: 'beast' });
    abandonFocusSession(db, session.id, 15);
    const updated = getFocusSession(db, session.id);
    expect(updated!.completed).toBe(0);
    expect(updated!.actual_minutes).toBe(15);
  });

  it('lists sessions', () => {
    createFocusSession(db, { planned_minutes: 30 });
    createFocusSession(db, { planned_minutes: 45 });
    expect(getFocusSessions(db)).toHaveLength(2);
  });

  it('updates rating after completion without overwriting timing', () => {
    const session = createFocusSession(db, { planned_minutes: 45 });
    completeFocusSession(db, session.id, 43);
    updateFocusSessionRating(db, session.id, 5);

    const updated = getFocusSession(db, session.id);
    expect(updated!.completed).toBe(1);
    expect(updated!.actual_minutes).toBe(43);
    expect(updated!.rating).toBe(5);
  });
});

// ── App Intentions CRUD ───────────────────────────────────────────────────

describe('app intentions CRUD', () => {
  let db: DatabaseAdapter;
  beforeEach(() => { db = createTestAdapter(); });

  it('upserts and retrieves intention', () => {
    upsertAppIntention(db, { app_id: 'com.instagram', app_name: 'Instagram', daily_open_limit: 3, per_open_minutes: 15 });
    const intention = getAppIntention(db, 'com.instagram');
    expect(intention!.daily_open_limit).toBe(3);
    expect(intention!.per_open_minutes).toBe(15);
  });

  it('deactivates intention', () => {
    upsertAppIntention(db, { app_id: 'com.tiktok', app_name: 'TikTok', daily_open_limit: 2 });
    deactivateIntention(db, 'com.tiktok');
    expect(getAppIntention(db, 'com.tiktok')).toBeNull();
    expect(getAllActiveIntentions(db)).toHaveLength(0);
  });
});

// ── App Opens CRUD ────────────────────────────────────────────────────────

describe('app opens CRUD', () => {
  let db: DatabaseAdapter;
  beforeEach(() => { db = createTestAdapter(); });

  it('records and counts opens', () => {
    recordAppOpen(db, { date: '2026-03-29', app_id: 'com.instagram', intention_text: 'Check messages' });
    recordAppOpen(db, { date: '2026-03-29', app_id: 'com.instagram' });
    expect(countAppOpensForDate(db, '2026-03-29', 'com.instagram')).toBe(2);
  });

  it('rates an open', () => {
    const open = recordAppOpen(db, { date: '2026-03-29', app_id: 'com.tiktok' });
    rateAppOpen(db, open.id, 2);
    const opens = getAppOpensForDate(db, '2026-03-29', 'com.tiktok');
    expect(opens[0].post_rating).toBe(2);
  });
});

// ── XP CRUD ───────────────────────────────────────────────────────────────

describe('XP CRUD', () => {
  let db: DatabaseAdapter;
  beforeEach(() => { db = createTestAdapter(); });

  it('awards and totals XP', () => {
    awardXP(db, { date: '2026-03-29', source: 'goal', amount: 100 });
    awardXP(db, { date: '2026-03-29', source: 'session', amount: 50 });
    expect(getTotalXP(db)).toBe(150);
    expect(getXPForDate(db, '2026-03-29')).toBe(150);
  });
});

// ── Settings CRUD ─────────────────────────────────────────────────────────

describe('settings CRUD', () => {
  let db: DatabaseAdapter;
  beforeEach(() => { db = createTestAdapter(); });

  it('reads seeded defaults', () => {
    expect(getSetting(db, 'daily_goal_minutes')).toBe('180');
    expect(getSetting(db, 'onboarding_completed')).toBe('0');
  });

  it('sets and reads settings', () => {
    setSetting(db, 'daily_goal_minutes', '120');
    expect(getSetting(db, 'daily_goal_minutes')).toBe('120');
  });
});

// ── Streak Engine ─────────────────────────────────────────────────────────

describe('streak engine', () => {
  it('calculates streaks from daily usage', () => {
    const records: DailyUsage[] = [
      { id: '1', date: '2026-03-27', total_minutes: 100, goal_minutes: 180, goal_met: 1, pickups: 0, first_pickup: null, last_pickup: null, created_at: '' },
      { id: '2', date: '2026-03-28', total_minutes: 100, goal_minutes: 180, goal_met: 1, pickups: 0, first_pickup: null, last_pickup: null, created_at: '' },
      { id: '3', date: '2026-03-29', total_minutes: 100, goal_minutes: 180, goal_met: 1, pickups: 0, first_pickup: null, last_pickup: null, created_at: '' },
    ];
    const streaks = calculateStreaks(records);
    expect(streaks.current).toBe(3);
    expect(streaks.longest).toBe(3);
  });

  it('returns zero for empty records', () => {
    const streaks = calculateStreaks([]);
    expect(streaks.current).toBe(0);
    expect(streaks.longest).toBe(0);
  });

  it('detects streak at risk', () => {
    expect(isStreakAtRisk(5, false, 20)).toBe(true);
    expect(isStreakAtRisk(5, true, 20)).toBe(false);
    expect(isStreakAtRisk(0, false, 20)).toBe(false);
    expect(isStreakAtRisk(5, false, 10)).toBe(false);
  });
});

// ── XP Engine ─────────────────────────────────────────────────────────────

describe('XP engine', () => {
  it('calculates XP for actions', () => {
    expect(calculateXP('goal')).toBe(100);
    expect(calculateXP('session', 60)).toBe(100); // 60/30 * 50
    expect(calculateXP('session', 15)).toBe(25);  // 15/30 * 50
    expect(calculateXP('intention')).toBe(25);
  });

  it('calculates streak bonus', () => {
    expect(calculateStreakBonus(6)).toBe(0);
    expect(calculateStreakBonus(7)).toBe(10);
    expect(calculateStreakBonus(14)).toBe(20);
  });

  it('calculates levels from XP', () => {
    expect(getLevelForXP(0)).toBe(1);
    expect(getLevelForXP(99)).toBe(1);
    expect(getLevelForXP(100)).toBe(2);
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
  });

  it('calculates XP progress', () => {
    const progress = getXPProgress(150);
    expect(progress.level).toBe(2);
    expect(progress.progress).toBeGreaterThan(0);
    expect(progress.xpToNext).toBeGreaterThan(0);
  });
});

// ── Stats Engine ──────────────────────────────────────────────────────────

describe('stats engine', () => {
  it('formats screen time', () => {
    expect(formatScreenTime(0)).toBe('0m');
    expect(formatScreenTime(45)).toBe('45m');
    expect(formatScreenTime(60)).toBe('1h');
    expect(formatScreenTime(90)).toBe('1h 30m');
    expect(formatScreenTime(135)).toBe('2h 15m');
  });

  it('calculates improvement', () => {
    expect(calculateImprovement(150, 200)).toBe(-25); // 25% less = good
    expect(calculateImprovement(200, 200)).toBe(0);
    expect(calculateImprovement(250, 200)).toBe(25);  // 25% more = bad
  });

  it('builds daily summary', () => {
    const daily: DailyUsage = { id: '1', date: '2026-03-29', total_minutes: 185, goal_minutes: 180, goal_met: true as unknown as number, pickups: 42, first_pickup: '08:00', last_pickup: '23:30', created_at: '' };
    const apps: AppUsage[] = [
      { id: 'a1', date: '2026-03-29', app_id: 'ig', app_name: 'Instagram', category: 'social', minutes: 45, opens: 12, created_at: '' },
      { id: 'a2', date: '2026-03-29', app_id: 'tt', app_name: 'TikTok', category: 'entertainment', minutes: 30, opens: 8, created_at: '' },
    ];
    const summary = buildDailySummary(daily, apps, 2);
    expect(summary.topApps).toHaveLength(2);
    expect(summary.topApps[0].appName).toBe('Instagram');
  });

  it('builds weekly summary', () => {
    const records: DailyUsage[] = [
      { id: '1', date: '2026-03-23', total_minutes: 200, goal_minutes: 180, goal_met: 0, pickups: 0, first_pickup: null, last_pickup: null, created_at: '' },
      { id: '2', date: '2026-03-24', total_minutes: 150, goal_minutes: 180, goal_met: 1, pickups: 0, first_pickup: null, last_pickup: null, created_at: '' },
    ];
    const summary = buildWeeklySummary(records, '2026-03-23');
    expect(summary.averageMinutes).toBe(175);
    expect(summary.daysMetGoal).toBe(1);
    expect(summary.bestDay).toBe('2026-03-24');
    expect(summary.worstDay).toBe('2026-03-23');
  });

  it('builds category breakdown', () => {
    const apps: AppUsage[] = [
      { id: '1', date: '2026-03-29', app_id: 'a', app_name: 'A', category: 'social', minutes: 60, opens: 0, created_at: '' },
      { id: '2', date: '2026-03-29', app_id: 'b', app_name: 'B', category: 'social', minutes: 40, opens: 0, created_at: '' },
      { id: '3', date: '2026-03-29', app_id: 'c', app_name: 'C', category: 'entertainment', minutes: 100, opens: 0, created_at: '' },
    ];
    const breakdown = buildCategoryBreakdown(apps);
    expect(breakdown).toHaveLength(2);
    const socialEntry = breakdown.find((b) => b.category === 'social')!;
    const entertainmentEntry = breakdown.find((b) => b.category === 'entertainment')!;
    expect(socialEntry.minutes).toBe(100);
    expect(socialEntry.percentage).toBe(50);
    expect(entertainmentEntry.minutes).toBe(100);
    expect(entertainmentEntry.percentage).toBe(50);
  });
});

describe('recommendations engine', () => {
  it('returns targeted suggestions in priority order', () => {
    const recommendations = buildPresenceRecommendations({
      summary: {
        date: '2026-03-29',
        totalMinutes: 245,
        goalMinutes: 180,
        goalMet: false,
        pickups: 38,
        topApps: [
          { appName: 'Instagram', minutes: 96, category: 'social' },
        ],
      },
      goalMinutes: 180,
      recentAverageMinutes: 210,
      completedSessions: 0,
      focusMinutes: 0,
      currentStreak: 2,
      intentionCompliance: 60,
      violatingApps: [{ appName: 'Instagram', overage: 4 }],
    });

    expect(recommendations).toHaveLength(3);
    expect(recommendations[0].type).toBe('goal');
    expect(recommendations[1].type).toBe('session');
    expect(recommendations[2].type).toBe('intention');
  });
});
