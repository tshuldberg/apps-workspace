import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleDefinition, ActivityItem } from '@mylife/module-registry';
import { createHubTables } from '@mylife/db';
import { ensureEngagementTables } from '../schema';
import {
  recordDailyActivity,
  getStreakRecord,
  getStreakStatus,
  backfillStreaks,
  getStreakHistory,
  getPreviousDate,
  getNextDate,
} from '../streaks';
import { generateWeeklyDigest } from '../digest';
import { getMemoryCard, getAvailableMemories, getDateYearsAgo } from '../memories';
import {
  isStreakEnabled,
  isDigestEnabled,
  isMemoryEnabled,
  setStreakEnabled,
  setDigestEnabled,
  setMemoryEnabled,
  getDigestDay,
  setDigestDay,
} from '../preferences';
import { STREAK_THRESHOLD } from '../types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestDb(): DatabaseAdapter {
  const raw = new Database(':memory:');
  const db: DatabaseAdapter = {
    execute: (sql: string, params?: unknown[]) => {
      raw.prepare(sql).run(...(params ?? []));
    },
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] => {
      return raw.prepare(sql).all(...(params ?? [])) as T[];
    },
    transaction: (fn: () => void) => {
      raw.transaction(fn)();
    },
  };
  createHubTables(db);
  ensureEngagementTables(db);
  return db;
}

/**
 * Create a mock module that returns specific activities for given dates.
 * The `activityMap` is keyed by YYYY-MM-DD date strings.
 */
function makeModule(
  id: string,
  name: string,
  activityMap: Record<string, ActivityItem[]>,
): ModuleDefinition {
  return {
    id,
    name,
    tagline: `${name} module`,
    icon: '📦',
    accentColor: '#000',
    tier: 'premium',
    storageType: 'sqlite',
    navigation: { tabs: [], screens: [] },
    requiresAuth: false,
    requiresNetwork: false,
    version: '0.1.0',
    crossModule: {
      getActivityFeed: (_db: unknown, since: Date) => {
        const sinceDate = since.toISOString().slice(0, 10);
        const items: ActivityItem[] = [];
        for (const date of Object.keys(activityMap)) {
          if (date >= sinceDate) {
            items.push(...activityMap[date]);
          }
        }
        return items;
      },
    },
  } as ModuleDefinition;
}

function makeActivity(
  moduleId: string,
  date: string,
  action: string,
  description: string,
): ActivityItem {
  return {
    moduleId,
    action,
    description,
    timestamp: `${date}T12:00:00.000Z`,
  };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

describe('getPreviousDate', () => {
  it('returns the previous day', () => {
    expect(getPreviousDate('2026-03-15')).toBe('2026-03-14');
  });

  it('handles month boundary', () => {
    expect(getPreviousDate('2026-03-01')).toBe('2026-02-28');
  });

  it('handles year boundary', () => {
    expect(getPreviousDate('2026-01-01')).toBe('2025-12-31');
  });

  it('handles leap year', () => {
    expect(getPreviousDate('2024-03-01')).toBe('2024-02-29');
  });
});

describe('getNextDate', () => {
  it('returns the next day', () => {
    expect(getNextDate('2026-03-15')).toBe('2026-03-16');
  });

  it('handles month boundary', () => {
    expect(getNextDate('2026-02-28')).toBe('2026-03-01');
  });

  it('handles leap year', () => {
    expect(getNextDate('2024-02-28')).toBe('2024-02-29');
  });
});

// ---------------------------------------------------------------------------
// Streak engine
// ---------------------------------------------------------------------------

describe('recordDailyActivity', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
  });

  it('records active modules for a date', () => {
    const modules = [
      makeModule('books', 'MyBooks', {
        '2026-03-15': [makeActivity('books', '2026-03-15', 'created', 'Added a book')],
      }),
      makeModule('budget', 'MyBudget', {
        '2026-03-15': [makeActivity('budget', '2026-03-15', 'logged', 'Added transaction')],
      }),
      makeModule('workouts', 'MyWorkouts', {
        '2026-03-15': [makeActivity('workouts', '2026-03-15', 'completed', 'Finished workout')],
      }),
    ];

    const record = recordDailyActivity(db, modules, '2026-03-15');
    expect(record.modulesActive).toBe(3);
    expect(record.moduleIds).toEqual(['books', 'budget', 'workouts']);
    expect(record.streakCount).toBe(1);
  });

  it('starts streak at 1 for first qualifying day', () => {
    const modules = [
      makeModule('a', 'A', { '2026-03-15': [makeActivity('a', '2026-03-15', 'x', 'x')] }),
      makeModule('b', 'B', { '2026-03-15': [makeActivity('b', '2026-03-15', 'x', 'x')] }),
      makeModule('c', 'C', { '2026-03-15': [makeActivity('c', '2026-03-15', 'x', 'x')] }),
    ];

    const record = recordDailyActivity(db, modules, '2026-03-15');
    expect(record.streakCount).toBe(1);
  });

  it('increments streak from previous day', () => {
    const modules = [
      makeModule('a', 'A', {
        '2026-03-14': [makeActivity('a', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('a', '2026-03-15', 'x', 'x')],
      }),
      makeModule('b', 'B', {
        '2026-03-14': [makeActivity('b', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('b', '2026-03-15', 'x', 'x')],
      }),
      makeModule('c', 'C', {
        '2026-03-14': [makeActivity('c', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('c', '2026-03-15', 'x', 'x')],
      }),
    ];

    recordDailyActivity(db, modules, '2026-03-14');
    const record = recordDailyActivity(db, modules, '2026-03-15');
    expect(record.streakCount).toBe(2);
  });

  it('resets streak when below threshold', () => {
    const modules = [
      makeModule('a', 'A', {
        '2026-03-14': [makeActivity('a', '2026-03-14', 'x', 'x')],
      }),
      makeModule('b', 'B', {
        '2026-03-14': [makeActivity('b', '2026-03-14', 'x', 'x')],
      }),
      makeModule('c', 'C', {
        '2026-03-14': [makeActivity('c', '2026-03-14', 'x', 'x')],
      }),
    ];

    recordDailyActivity(db, modules, '2026-03-14');

    // Day 2: only 2 modules (below threshold)
    const day2Modules = [
      makeModule('a', 'A', {
        '2026-03-15': [makeActivity('a', '2026-03-15', 'x', 'x')],
      }),
      makeModule('b', 'B', {
        '2026-03-15': [makeActivity('b', '2026-03-15', 'x', 'x')],
      }),
    ];

    const record = recordDailyActivity(db, day2Modules, '2026-03-15');
    expect(record.modulesActive).toBe(2);
    expect(record.streakCount).toBe(0);
  });

  it('records zero modules when no activity', () => {
    const modules = [
      makeModule('books', 'MyBooks', {}),
    ];

    const record = recordDailyActivity(db, modules, '2026-03-15');
    expect(record.modulesActive).toBe(0);
    expect(record.streakCount).toBe(0);
  });

  it('handles modules that throw errors gracefully', () => {
    const throwingModule = {
      id: 'broken',
      name: 'Broken',
      tagline: 'broken',
      icon: '💥',
      accentColor: '#000',
      tier: 'premium',
      storageType: 'sqlite',
      navigation: { tabs: [], screens: [] },
      requiresAuth: false,
      requiresNetwork: false,
      version: '0.1.0',
      crossModule: {
        getActivityFeed: () => {
          throw new Error('Module crashed');
        },
      },
    } as unknown as ModuleDefinition;

    const goodModules = [
      makeModule('a', 'A', { '2026-03-15': [makeActivity('a', '2026-03-15', 'x', 'x')] }),
      makeModule('b', 'B', { '2026-03-15': [makeActivity('b', '2026-03-15', 'x', 'x')] }),
      makeModule('c', 'C', { '2026-03-15': [makeActivity('c', '2026-03-15', 'x', 'x')] }),
    ];

    const record = recordDailyActivity(db, [throwingModule, ...goodModules], '2026-03-15');
    expect(record.modulesActive).toBe(3);
    expect(record.streakCount).toBe(1);
  });
});

describe('getStreakRecord', () => {
  it('returns null for non-existent date', () => {
    const db = createTestDb();
    expect(getStreakRecord(db, '2026-03-15')).toBeNull();
  });

  it('returns the record after recording', () => {
    const db = createTestDb();
    const modules = [
      makeModule('a', 'A', { '2026-03-15': [makeActivity('a', '2026-03-15', 'x', 'x')] }),
    ];
    recordDailyActivity(db, modules, '2026-03-15');

    const record = getStreakRecord(db, '2026-03-15');
    expect(record).not.toBeNull();
    expect(record!.modulesActive).toBe(1);
    expect(record!.moduleIds).toEqual(['a']);
  });
});

describe('getStreakStatus', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns zero streak when no data', () => {
    const status = getStreakStatus(db, '2026-03-15');
    expect(status.currentStreak).toBe(0);
    expect(status.longestStreak).toBe(0);
    expect(status.lastActiveDate).toBeNull();
    expect(status.todayQualifies).toBe(false);
    expect(status.todayModuleCount).toBe(0);
  });

  it('shows current streak from today', () => {
    const modules = [
      makeModule('a', 'A', {
        '2026-03-14': [makeActivity('a', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('a', '2026-03-15', 'x', 'x')],
      }),
      makeModule('b', 'B', {
        '2026-03-14': [makeActivity('b', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('b', '2026-03-15', 'x', 'x')],
      }),
      makeModule('c', 'C', {
        '2026-03-14': [makeActivity('c', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('c', '2026-03-15', 'x', 'x')],
      }),
    ];

    recordDailyActivity(db, modules, '2026-03-14');
    recordDailyActivity(db, modules, '2026-03-15');

    const status = getStreakStatus(db, '2026-03-15');
    expect(status.currentStreak).toBe(2);
    expect(status.todayQualifies).toBe(true);
    expect(status.longestStreak).toBe(2);
  });

  it('keeps streak alive from yesterday when today not yet recorded', () => {
    const modules = [
      makeModule('a', 'A', {
        '2026-03-14': [makeActivity('a', '2026-03-14', 'x', 'x')],
      }),
      makeModule('b', 'B', {
        '2026-03-14': [makeActivity('b', '2026-03-14', 'x', 'x')],
      }),
      makeModule('c', 'C', {
        '2026-03-14': [makeActivity('c', '2026-03-14', 'x', 'x')],
      }),
    ];

    recordDailyActivity(db, modules, '2026-03-14');

    const status = getStreakStatus(db, '2026-03-15');
    expect(status.currentStreak).toBe(1);
    expect(status.todayQualifies).toBe(false);
  });
});

describe('backfillStreaks', () => {
  it('backfills a range of dates', () => {
    const db = createTestDb();
    const modules = [
      makeModule('a', 'A', {
        '2026-03-13': [makeActivity('a', '2026-03-13', 'x', 'x')],
        '2026-03-14': [makeActivity('a', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('a', '2026-03-15', 'x', 'x')],
      }),
      makeModule('b', 'B', {
        '2026-03-13': [makeActivity('b', '2026-03-13', 'x', 'x')],
        '2026-03-14': [makeActivity('b', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('b', '2026-03-15', 'x', 'x')],
      }),
      makeModule('c', 'C', {
        '2026-03-13': [makeActivity('c', '2026-03-13', 'x', 'x')],
        '2026-03-14': [makeActivity('c', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('c', '2026-03-15', 'x', 'x')],
      }),
    ];

    const records = backfillStreaks(db, modules, '2026-03-13', '2026-03-15');
    expect(records).toHaveLength(3);
    expect(records[0].streakCount).toBe(1);
    expect(records[1].streakCount).toBe(2);
    expect(records[2].streakCount).toBe(3);
  });

  it('handles gaps in activity', () => {
    const db = createTestDb();
    const modules = [
      makeModule('a', 'A', {
        '2026-03-13': [makeActivity('a', '2026-03-13', 'x', 'x')],
        '2026-03-15': [makeActivity('a', '2026-03-15', 'x', 'x')],
      }),
      makeModule('b', 'B', {
        '2026-03-13': [makeActivity('b', '2026-03-13', 'x', 'x')],
        '2026-03-15': [makeActivity('b', '2026-03-15', 'x', 'x')],
      }),
      makeModule('c', 'C', {
        '2026-03-13': [makeActivity('c', '2026-03-13', 'x', 'x')],
        '2026-03-15': [makeActivity('c', '2026-03-15', 'x', 'x')],
      }),
    ];

    const records = backfillStreaks(db, modules, '2026-03-13', '2026-03-15');
    expect(records[0].streakCount).toBe(1); // Day 1: streak starts
    expect(records[1].streakCount).toBe(0); // Day 2: gap
    expect(records[2].streakCount).toBe(1); // Day 3: new streak
  });
});

describe('getStreakHistory', () => {
  it('returns recent records most-recent first', () => {
    const db = createTestDb();
    const modules = [
      makeModule('a', 'A', {
        '2026-03-14': [makeActivity('a', '2026-03-14', 'x', 'x')],
        '2026-03-15': [makeActivity('a', '2026-03-15', 'x', 'x')],
      }),
    ];

    recordDailyActivity(db, modules, '2026-03-14');
    recordDailyActivity(db, modules, '2026-03-15');

    const history = getStreakHistory(db, 10);
    expect(history).toHaveLength(2);
    expect(history[0].date).toBe('2026-03-15');
    expect(history[1].date).toBe('2026-03-14');
  });
});

// ---------------------------------------------------------------------------
// Weekly Digest
// ---------------------------------------------------------------------------

describe('generateWeeklyDigest', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
  });

  it('aggregates activities from multiple modules', () => {
    const modules = [
      makeModule('books', 'MyBooks', {
        '2026-03-14': [
          makeActivity('books', '2026-03-14', 'completed', 'Finished "Dune"'),
          makeActivity('books', '2026-03-14', 'started', 'Started "Foundation"'),
        ],
      }),
      makeModule('workouts', 'MyWorkouts', {
        '2026-03-13': [makeActivity('workouts', '2026-03-13', 'completed', 'Leg day')],
        '2026-03-15': [makeActivity('workouts', '2026-03-15', 'completed', 'Push day')],
      }),
    ];

    const digest = generateWeeklyDigest(db, modules, '2026-03-15', 7);
    expect(digest.periodStart).toBe('2026-03-09');
    expect(digest.periodEnd).toBe('2026-03-15');
    expect(digest.totalActivities).toBe(4);
    expect(digest.modules).toHaveLength(2);
  });

  it('returns empty digest when no activities', () => {
    const modules = [makeModule('books', 'MyBooks', {})];
    const digest = generateWeeklyDigest(db, modules, '2026-03-15', 7);
    expect(digest.totalActivities).toBe(0);
    expect(digest.modules).toHaveLength(0);
    expect(digest.formattedSummary).toContain('No activity recorded');
  });

  it('filters activities outside the period', () => {
    const modules = [
      makeModule('books', 'MyBooks', {
        '2026-03-01': [makeActivity('books', '2026-03-01', 'created', 'Old activity')],
        '2026-03-14': [makeActivity('books', '2026-03-14', 'completed', 'Recent')],
      }),
    ];

    const digest = generateWeeklyDigest(db, modules, '2026-03-15', 7);
    expect(digest.totalActivities).toBe(1);
  });

  it('sorts modules by activity count descending', () => {
    const modules = [
      makeModule('books', 'MyBooks', {
        '2026-03-14': [makeActivity('books', '2026-03-14', 'created', 'one')],
      }),
      makeModule('workouts', 'MyWorkouts', {
        '2026-03-13': [makeActivity('workouts', '2026-03-13', 'completed', 'w1')],
        '2026-03-14': [makeActivity('workouts', '2026-03-14', 'completed', 'w2')],
        '2026-03-15': [makeActivity('workouts', '2026-03-15', 'completed', 'w3')],
      }),
    ];

    const digest = generateWeeklyDigest(db, modules, '2026-03-15', 7);
    expect(digest.modules[0].moduleId).toBe('workouts');
    expect(digest.modules[1].moduleId).toBe('books');
  });

  it('formats summary with module highlights', () => {
    const modules = [
      makeModule('books', 'MyBooks', {
        '2026-03-14': [makeActivity('books', '2026-03-14', 'completed', 'Finished a book')],
      }),
    ];

    const digest = generateWeeklyDigest(db, modules, '2026-03-15', 7);
    expect(digest.formattedSummary).toContain('Your week:');
    expect(digest.formattedSummary).toContain('MyBooks');
  });

  it('handles throwing modules gracefully', () => {
    const throwingModule = {
      id: 'broken',
      name: 'Broken',
      tagline: 'broken',
      icon: '💥',
      accentColor: '#000',
      tier: 'premium',
      storageType: 'sqlite',
      navigation: { tabs: [], screens: [] },
      requiresAuth: false,
      requiresNetwork: false,
      version: '0.1.0',
      crossModule: {
        getActivityFeed: () => {
          throw new Error('Crash');
        },
      },
    } as unknown as ModuleDefinition;

    const goodModule = makeModule('books', 'MyBooks', {
      '2026-03-14': [makeActivity('books', '2026-03-14', 'completed', 'Book done')],
    });

    const digest = generateWeeklyDigest(db, [throwingModule, goodModule], '2026-03-15', 7);
    expect(digest.totalActivities).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// This Day Last Year
// ---------------------------------------------------------------------------

describe('getDateYearsAgo', () => {
  it('returns same date one year back', () => {
    expect(getDateYearsAgo('2026-03-15', 1)).toBe('2025-03-15');
  });

  it('returns date two years back', () => {
    expect(getDateYearsAgo('2026-03-15', 2)).toBe('2024-03-15');
  });

  it('handles leap year Feb 29 to non-leap year', () => {
    expect(getDateYearsAgo('2024-02-29', 1)).toBe('2023-02-28');
  });

  it('handles leap year Feb 29 to leap year', () => {
    expect(getDateYearsAgo('2024-02-29', 4)).toBe('2020-02-29');
  });
});

describe('getMemoryCard', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
  });

  it('returns memories from one year ago', () => {
    const modules = [
      makeModule('books', 'MyBooks', {
        '2025-03-15': [
          makeActivity('books', '2025-03-15', 'completed', 'Finished "The Great Gatsby"'),
        ],
      }),
    ];

    const card = getMemoryCard(db, modules, '2026-03-15', 1);
    expect(card.hasMemories).toBe(true);
    expect(card.date).toBe('2025-03-15');
    expect(card.yearsAgo).toBe(1);
    expect(card.modules).toHaveLength(1);
    expect(card.modules[0].activities).toContain('Finished "The Great Gatsby"');
  });

  it('returns empty card when no memories', () => {
    const modules = [makeModule('books', 'MyBooks', {})];
    const card = getMemoryCard(db, modules, '2026-03-15', 1);
    expect(card.hasMemories).toBe(false);
    expect(card.modules).toHaveLength(0);
  });

  it('aggregates from multiple modules', () => {
    const modules = [
      makeModule('books', 'MyBooks', {
        '2025-03-15': [makeActivity('books', '2025-03-15', 'completed', 'Finished a book')],
      }),
      makeModule('workouts', 'MyWorkouts', {
        '2025-03-15': [makeActivity('workouts', '2025-03-15', 'completed', 'Ran 5k')],
      }),
    ];

    const card = getMemoryCard(db, modules, '2026-03-15', 1);
    expect(card.hasMemories).toBe(true);
    expect(card.modules).toHaveLength(2);
  });

  it('filters out activities from adjacent dates', () => {
    const modules = [
      makeModule('books', 'MyBooks', {
        '2025-03-14': [makeActivity('books', '2025-03-14', 'created', 'Wrong day')],
        '2025-03-15': [makeActivity('books', '2025-03-15', 'completed', 'Right day')],
        '2025-03-16': [makeActivity('books', '2025-03-16', 'created', 'Wrong day')],
      }),
    ];

    const card = getMemoryCard(db, modules, '2026-03-15', 1);
    expect(card.modules[0].activities).toHaveLength(1);
    expect(card.modules[0].activities[0]).toBe('Right day');
  });
});

describe('getAvailableMemories', () => {
  it('returns only cards with memories', () => {
    const db = createTestDb();
    const modules = [
      makeModule('books', 'MyBooks', {
        '2025-03-15': [makeActivity('books', '2025-03-15', 'completed', 'Year 1')],
        // No activity 2 years ago
        '2023-03-15': [makeActivity('books', '2023-03-15', 'completed', 'Year 3')],
      }),
    ];

    const cards = getAvailableMemories(db, modules, '2026-03-15', 3);
    expect(cards).toHaveLength(2);
    expect(cards[0].yearsAgo).toBe(1);
    expect(cards[1].yearsAgo).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

describe('engagement preferences', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
  });

  it('all features default to disabled', () => {
    expect(isStreakEnabled(db)).toBe(false);
    expect(isDigestEnabled(db)).toBe(false);
    expect(isMemoryEnabled(db)).toBe(false);
  });

  it('can enable and disable streak', () => {
    setStreakEnabled(db, true);
    expect(isStreakEnabled(db)).toBe(true);
    setStreakEnabled(db, false);
    expect(isStreakEnabled(db)).toBe(false);
  });

  it('can enable and disable digest', () => {
    setDigestEnabled(db, true);
    expect(isDigestEnabled(db)).toBe(true);
  });

  it('can enable and disable memory', () => {
    setMemoryEnabled(db, true);
    expect(isMemoryEnabled(db)).toBe(true);
  });

  it('digest day defaults to Monday (1)', () => {
    expect(getDigestDay(db)).toBe(1);
  });

  it('can set and get digest day', () => {
    setDigestDay(db, 0); // Sunday
    expect(getDigestDay(db)).toBe(0);
    setDigestDay(db, 5); // Friday
    expect(getDigestDay(db)).toBe(5);
  });

  it('clamps digest day to valid range', () => {
    setDigestDay(db, -1);
    expect(getDigestDay(db)).toBe(0);
    setDigestDay(db, 7);
    expect(getDigestDay(db)).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

describe('ensureEngagementTables', () => {
  it('creates tables without error (idempotent)', () => {
    const db = createTestDb();
    // Already called in createTestDb, call again to verify idempotency
    expect(() => ensureEngagementTables(db)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// STREAK_THRESHOLD constant
// ---------------------------------------------------------------------------

describe('STREAK_THRESHOLD', () => {
  it('is 3', () => {
    expect(STREAK_THRESHOLD).toBe(3);
  });
});
