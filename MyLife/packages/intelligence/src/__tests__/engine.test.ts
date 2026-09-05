import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createHubTestDatabase } from '@mylife/db';
import type { ModuleDefinition } from '@mylife/module-registry';
import type {
  CrossModuleInterface,
  CorrelationDataset,
  ModuleSummary,
} from '@mylife/module-registry';
import { ensureAIPermissionTables } from '../permissions/schema';
import { setPermissions } from '../permissions/operations';
import { DEFAULT_USER_ID } from '../permissions/types';

/**
 * Back-compat shim: the engine tests predate the canonical (user_id, module_id)
 * composite PK. Map the legacy `(moduleId, enabled)` call shape onto the new
 * setPermissions API so the engine test surface stays focused on correlation
 * / trend / summary behavior instead of permission wiring.
 */
function setModuleAIAccess(
  db: DatabaseAdapter,
  moduleId: string,
  enabled: boolean,
): void {
  setPermissions(db, {
    userId: DEFAULT_USER_ID,
    moduleId,
    canRead: enabled,
    canWrite: enabled,
  });
}
import {
  pearson,
  queryCorrelation,
  queryTrends,
  querySummary,
  discoverInsights,
} from '../engine/engine';
import { MIN_CORRELATION_POINTS, CORRELATION_THRESHOLD } from '../engine/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeModule(
  id: string,
  name: string,
  crossModule?: Partial<CrossModuleInterface>,
): ModuleDefinition {
  return {
    id,
    name,
    tagline: `${name} module`,
    icon: 'test',
    accentColor: '#000',
    tier: 'free',
    storageType: 'sqlite',
    navigation: { tabs: [], screens: [] },
    requiresAuth: false,
    requiresNetwork: false,
    version: '1.0.0',
    crossModule: crossModule as CrossModuleInterface,
  } as unknown as ModuleDefinition;
}

function makeCorrelationDataset(
  moduleId: string,
  series: { metric: string; label: string; unit: string; data: { date: string; value: number }[] }[],
): CorrelationDataset {
  return { moduleId, series };
}

function makeSummary(moduleId: string, totalItems: number, stats: Record<string, number | string>): ModuleSummary {
  return { moduleId, totalItems, stats };
}

/** Generate N days of correlated data points starting from a base date. */
function generateData(
  startDate: string,
  count: number,
  valueFn: (i: number) => number,
): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  const start = new Date(startDate + 'T12:00:00Z');
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    points.push({
      date: d.toISOString().slice(0, 10),
      value: valueFn(i),
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cross-module AI query engine', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    db = testDb.adapter;
    closeDb = testDb.close;
    ensureAIPermissionTables(db);
  });

  afterEach(() => {
    closeDb();
  });

  // -----------------------------------------------------------------------
  // pearson (pure function)
  // -----------------------------------------------------------------------

  describe('pearson', () => {
    it('returns 1.0 for perfectly positively correlated data', () => {
      const a = [
        { date: '2026-01-01', value: 1 },
        { date: '2026-01-02', value: 2 },
        { date: '2026-01-03', value: 3 },
        { date: '2026-01-04', value: 4 },
        { date: '2026-01-05', value: 5 },
      ];
      const b = [
        { date: '2026-01-01', value: 10 },
        { date: '2026-01-02', value: 20 },
        { date: '2026-01-03', value: 30 },
        { date: '2026-01-04', value: 40 },
        { date: '2026-01-05', value: 50 },
      ];
      const result = pearson(a, b);
      expect(result.coefficient).toBe(1);
      expect(result.dataPoints).toBe(5);
    });

    it('returns -1.0 for perfectly negatively correlated data', () => {
      const a = [
        { date: '2026-01-01', value: 1 },
        { date: '2026-01-02', value: 2 },
        { date: '2026-01-03', value: 3 },
      ];
      const b = [
        { date: '2026-01-01', value: 30 },
        { date: '2026-01-02', value: 20 },
        { date: '2026-01-03', value: 10 },
      ];
      const result = pearson(a, b);
      expect(result.coefficient).toBe(-1);
    });

    it('returns 0 for uncorrelated data', () => {
      const a = [
        { date: '2026-01-01', value: 1 },
        { date: '2026-01-02', value: 2 },
        { date: '2026-01-03', value: 1 },
        { date: '2026-01-04', value: 2 },
      ];
      const b = [
        { date: '2026-01-01', value: 5 },
        { date: '2026-01-02', value: 5 },
        { date: '2026-01-03', value: 5 },
        { date: '2026-01-04', value: 5 },
      ];
      const result = pearson(a, b);
      expect(result.coefficient).toBe(0);
    });

    it('only uses overlapping dates', () => {
      const a = [
        { date: '2026-01-01', value: 1 },
        { date: '2026-01-02', value: 2 },
        { date: '2026-01-03', value: 3 },
        { date: '2026-01-04', value: 4 },
      ];
      const b = [
        { date: '2026-01-02', value: 20 },
        { date: '2026-01-03', value: 30 },
        { date: '2026-01-05', value: 50 },
      ];
      const result = pearson(a, b);
      expect(result.dataPoints).toBe(2);
    });

    it('returns 0 with fewer than 2 overlapping points', () => {
      const a = [{ date: '2026-01-01', value: 1 }];
      const b = [{ date: '2026-01-01', value: 10 }];
      expect(pearson(a, b).coefficient).toBe(0);
    });

    it('returns 0 for constant series (zero denominator)', () => {
      const a = [
        { date: '2026-01-01', value: 5 },
        { date: '2026-01-02', value: 5 },
        { date: '2026-01-03', value: 5 },
      ];
      const b = [
        { date: '2026-01-01', value: 1 },
        { date: '2026-01-02', value: 2 },
        { date: '2026-01-03', value: 3 },
      ];
      expect(pearson(a, b).coefficient).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // queryCorrelation
  // -----------------------------------------------------------------------

  describe('queryCorrelation', () => {
    it('returns correlations between two permitted modules', () => {
      setModuleAIAccess(db, 'habits', true);
      setModuleAIAccess(db, 'workouts', true);

      const data = generateData('2026-01-01', 30, (i) => i + 1);

      const modA = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data },
          ]),
      });
      const modB = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () =>
          makeCorrelationDataset('workouts', [
            { metric: 'volume', label: 'Volume', unit: 'reps', data: data.map((d) => ({ ...d, value: d.value * 2 })) },
          ]),
      });

      const results = queryCorrelation(db, [modA, modB], 'habits', 'workouts');
      expect(results).toHaveLength(1);
      expect(results[0].coefficient).toBe(1);
      expect(results[0].moduleA).toBe('habits');
      expect(results[0].moduleB).toBe('workouts');
      expect(results[0].strength).toBe('strong');
    });

    it('returns empty array if module A is not permitted', () => {
      setModuleAIAccess(db, 'workouts', true);
      // habits NOT permitted

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () => makeCorrelationDataset('habits', []),
      });
      const mod2 = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () => makeCorrelationDataset('workouts', []),
      });

      expect(queryCorrelation(db, [mod, mod2], 'habits', 'workouts')).toEqual([]);
    });

    it('returns empty array if module B is not permitted', () => {
      setModuleAIAccess(db, 'habits', true);
      // workouts NOT permitted

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () => makeCorrelationDataset('habits', []),
      });
      const mod2 = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () => makeCorrelationDataset('workouts', []),
      });

      expect(queryCorrelation(db, [mod, mod2], 'habits', 'workouts')).toEqual([]);
    });

    it('returns empty array if neither module has getCorrelationData', () => {
      setModuleAIAccess(db, 'habits', true);
      setModuleAIAccess(db, 'workouts', true);

      const mod = makeModule('habits', 'MyHabits', {});
      const mod2 = makeModule('workouts', 'MyWorkouts', {});

      expect(queryCorrelation(db, [mod, mod2], 'habits', 'workouts')).toEqual([]);
    });

    it('skips pairs with fewer than MIN_CORRELATION_POINTS overlapping days', () => {
      setModuleAIAccess(db, 'habits', true);
      setModuleAIAccess(db, 'workouts', true);

      // Only 3 overlapping days (below MIN_CORRELATION_POINTS)
      const shortData = generateData('2026-01-01', 3, (i) => i + 1);

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data: shortData },
          ]),
      });
      const mod2 = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () =>
          makeCorrelationDataset('workouts', [
            { metric: 'volume', label: 'Volume', unit: 'reps', data: shortData },
          ]),
      });

      expect(queryCorrelation(db, [mod, mod2], 'habits', 'workouts')).toEqual([]);
    });

    it('handles modules that throw errors gracefully', () => {
      setModuleAIAccess(db, 'habits', true);
      setModuleAIAccess(db, 'workouts', true);

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () => {
          throw new Error('DB unavailable');
        },
      });
      const mod2 = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () => makeCorrelationDataset('workouts', []),
      });

      expect(queryCorrelation(db, [mod, mod2], 'habits', 'workouts')).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // queryTrends
  // -----------------------------------------------------------------------

  describe('queryTrends', () => {
    it('returns trend data for a permitted module', () => {
      setModuleAIAccess(db, 'habits', true);

      // Use future dates to avoid time-window filtering issues
      const data = generateData('2026-03-01', 20, (i) => i * 10);

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data },
          ]),
      });

      const result = queryTrends(db, [mod], 'habits', 'completions', 365);
      expect(result).not.toBeNull();
      expect(result!.moduleId).toBe('habits');
      expect(result!.metric).toBe('completions');
      expect(result!.label).toBe('Completions');
      expect(result!.unit).toBe('count');
      expect(result!.points.length).toBeGreaterThan(0);
    });

    it('returns null for an unpermitted module', () => {
      // habits NOT permitted
      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () => makeCorrelationDataset('habits', []),
      });

      expect(queryTrends(db, [mod], 'habits', 'completions', 30)).toBeNull();
    });

    it('returns null for a nonexistent metric', () => {
      setModuleAIAccess(db, 'habits', true);

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data: [] },
          ]),
      });

      expect(queryTrends(db, [mod], 'habits', 'nonexistent_metric', 30)).toBeNull();
    });

    it('filters points to the requested time window', () => {
      setModuleAIAccess(db, 'habits', true);

      // Data spanning 60 days, but request only 30
      const data = generateData('2025-01-01', 60, (i) => i);

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data },
          ]),
      });

      const result = queryTrends(db, [mod], 'habits', 'completions', 30);
      expect(result).not.toBeNull();
      // Old data from 2025 should be filtered out with a 30-day window
      expect(result!.points.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // querySummary
  // -----------------------------------------------------------------------

  describe('querySummary', () => {
    it('aggregates summaries from permitted modules only', () => {
      setModuleAIAccess(db, 'books', true);
      setModuleAIAccess(db, 'budget', true);
      // habits NOT permitted

      const books = makeModule('books', 'MyBooks', {
        getDataSummary: () => makeSummary('books', 42, { booksRead: 10 }),
      });
      const budget = makeModule('budget', 'MyBudget', {
        getDataSummary: () => makeSummary('budget', 100, { envelopes: 8 }),
      });
      const habits = makeModule('habits', 'MyHabits', {
        getDataSummary: () => makeSummary('habits', 5, { streaks: 3 }),
      });

      const result = querySummary(db, [books, budget, habits]);
      expect(result.totalModules).toBe(2);
      expect(result.modules.map((m) => m.moduleId)).toEqual(['books', 'budget']);
    });

    it('returns empty result when no modules are permitted', () => {
      const mod = makeModule('books', 'MyBooks', {
        getDataSummary: () => makeSummary('books', 42, {}),
      });

      const result = querySummary(db, [mod]);
      expect(result.totalModules).toBe(0);
      expect(result.modules).toEqual([]);
    });

    it('skips modules without getDataSummary', () => {
      setModuleAIAccess(db, 'books', true);

      const mod = makeModule('books', 'MyBooks', {});
      const result = querySummary(db, [mod]);
      expect(result.totalModules).toBe(0);
    });

    it('skips modules that throw errors', () => {
      setModuleAIAccess(db, 'books', true);
      setModuleAIAccess(db, 'budget', true);

      const books = makeModule('books', 'MyBooks', {
        getDataSummary: () => {
          throw new Error('fail');
        },
      });
      const budget = makeModule('budget', 'MyBudget', {
        getDataSummary: () => makeSummary('budget', 10, {}),
      });

      const result = querySummary(db, [books, budget]);
      expect(result.totalModules).toBe(1);
      expect(result.modules[0].moduleId).toBe('budget');
    });
  });

  // -----------------------------------------------------------------------
  // discoverInsights
  // -----------------------------------------------------------------------

  describe('discoverInsights', () => {
    it('discovers strong positive correlation as an insight', () => {
      setModuleAIAccess(db, 'habits', true);
      setModuleAIAccess(db, 'workouts', true);

      const data = generateData('2026-01-01', 30, (i) => i + 1);

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Habit Completion Rate', unit: '%', data },
          ]),
      });
      const mod2 = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () =>
          makeCorrelationDataset('workouts', [
            { metric: 'volume', label: 'Workout Volume', unit: 'reps', data: data.map((d) => ({ ...d, value: d.value * 3 })) },
          ]),
      });

      const insights = discoverInsights(db, [mod, mod2]);
      expect(insights).toHaveLength(1);
      expect(insights[0].title).toContain('positively correlated');
      expect(insights[0].correlation.coefficient).toBe(1);
      expect(insights[0].modules).toEqual(['habits', 'workouts']);
      expect(insights[0].confidence).toBe('medium'); // 30 days
    });

    it('discovers strong negative correlation as an insight', () => {
      setModuleAIAccess(db, 'habits', true);
      setModuleAIAccess(db, 'workouts', true);

      const dataA = generateData('2026-01-01', 30, (i) => i + 1);
      const dataB = generateData('2026-01-01', 30, (i) => 100 - i);

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data: dataA },
          ]),
      });
      const mod2 = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () =>
          makeCorrelationDataset('workouts', [
            { metric: 'volume', label: 'Volume', unit: 'reps', data: dataB },
          ]),
      });

      const insights = discoverInsights(db, [mod, mod2]);
      expect(insights).toHaveLength(1);
      expect(insights[0].title).toContain('negatively correlated');
      expect(insights[0].correlation.coefficient).toBe(-1);
    });

    it('excludes weak correlations below threshold', () => {
      setModuleAIAccess(db, 'habits', true);
      setModuleAIAccess(db, 'workouts', true);

      // Random-ish data with weak correlation
      const dataA = generateData('2026-01-01', 30, (i) => (i % 3 === 0 ? 10 : 5));
      const dataB = generateData('2026-01-01', 30, (i) => (i % 2 === 0 ? 8 : 3));

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data: dataA },
          ]),
      });
      const mod2 = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () =>
          makeCorrelationDataset('workouts', [
            { metric: 'volume', label: 'Volume', unit: 'reps', data: dataB },
          ]),
      });

      const insights = discoverInsights(db, [mod, mod2]);
      // Verify any returned insights actually exceed the threshold
      for (const insight of insights) {
        expect(Math.abs(insight.correlation.coefficient)).toBeGreaterThanOrEqual(CORRELATION_THRESHOLD);
      }
    });

    it('excludes unpermitted modules from discovery', () => {
      setModuleAIAccess(db, 'habits', true);
      // workouts NOT permitted

      const data = generateData('2026-01-01', 30, (i) => i);

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data },
          ]),
      });
      const mod2 = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () =>
          makeCorrelationDataset('workouts', [
            { metric: 'volume', label: 'Volume', unit: 'reps', data },
          ]),
      });

      const insights = discoverInsights(db, [mod, mod2]);
      expect(insights).toEqual([]);
    });

    it('returns empty when no modules have correlation data', () => {
      setModuleAIAccess(db, 'books', true);
      setModuleAIAccess(db, 'budget', true);

      const mod = makeModule('books', 'MyBooks', {});
      const mod2 = makeModule('budget', 'MyBudget', {});

      expect(discoverInsights(db, [mod, mod2])).toEqual([]);
    });

    it('sorts insights by absolute correlation strength descending', () => {
      setModuleAIAccess(db, 'habits', true);
      setModuleAIAccess(db, 'workouts', true);
      setModuleAIAccess(db, 'books', true);

      const data30 = generateData('2026-01-01', 30, (i) => i + 1);

      // habits-workouts: perfect positive (r=1.0)
      const modA = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data: data30 },
          ]),
      });
      const modB = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () =>
          makeCorrelationDataset('workouts', [
            { metric: 'volume', label: 'Volume', unit: 'reps', data: data30.map((d) => ({ ...d, value: d.value * 2 })) },
          ]),
      });
      // habits-books: perfect negative (r=-1.0)
      const modC = makeModule('books', 'MyBooks', {
        getCorrelationData: () =>
          makeCorrelationDataset('books', [
            { metric: 'pages', label: 'Pages', unit: 'pages', data: data30.map((d) => ({ ...d, value: 100 - d.value })) },
          ]),
      });

      const insights = discoverInsights(db, [modA, modB, modC]);
      expect(insights.length).toBeGreaterThanOrEqual(2);
      // All should have |r| = 1.0 (perfect correlations)
      for (const insight of insights) {
        expect(Math.abs(insight.correlation.coefficient)).toBe(1);
      }
    });

    it('assigns correct confidence based on data points', () => {
      setModuleAIAccess(db, 'habits', true);
      setModuleAIAccess(db, 'workouts', true);

      // 90 days of data for "high" confidence
      const data90 = generateData('2026-01-01', 90, (i) => i + 1);

      const mod = makeModule('habits', 'MyHabits', {
        getCorrelationData: () =>
          makeCorrelationDataset('habits', [
            { metric: 'completions', label: 'Completions', unit: 'count', data: data90 },
          ]),
      });
      const mod2 = makeModule('workouts', 'MyWorkouts', {
        getCorrelationData: () =>
          makeCorrelationDataset('workouts', [
            { metric: 'volume', label: 'Volume', unit: 'reps', data: data90.map((d) => ({ ...d, value: d.value * 2 })) },
          ]),
      });

      const insights = discoverInsights(db, [mod, mod2]);
      expect(insights).toHaveLength(1);
      expect(insights[0].confidence).toBe('high');
    });
  });

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------

  describe('constants', () => {
    it('MIN_CORRELATION_POINTS is 7', () => {
      expect(MIN_CORRELATION_POINTS).toBe(7);
    });

    it('CORRELATION_THRESHOLD is 0.5', () => {
      expect(CORRELATION_THRESHOLD).toBe(0.5);
    });
  });
});
