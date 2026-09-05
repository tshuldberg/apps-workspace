import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { HABITS_MODULE } from '../definition';
import { createHabit, recordCompletion } from '../db/crud';
import {
  getSearchableContent,
  getDataSummary,
  getActivityFeed,
  getCorrelationData,
} from '../cross-module';

let adapter: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('habits', HABITS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ── getSearchableContent ─────────────────────────────────────────────────

describe('getSearchableContent', () => {
  it('returns empty array for empty database', () => {
    const items = getSearchableContent(adapter);
    expect(items).toEqual([]);
  });

  it('returns habits as searchable items', () => {
    createHabit(adapter, 'h1', {
      name: 'Morning Meditation',
      description: '10 minutes of mindfulness',
    });

    const items = getSearchableContent(adapter);
    expect(items).toHaveLength(1);
    expect(items[0].moduleId).toBe('habits');
    expect(items[0].type).toBe('habit');
    expect(items[0].title).toBe('Morning Meditation');
    expect(items[0].body).toBe('10 minutes of mindfulness');
    expect(items[0].tags).toContain('daily');
    expect(items[0].tags).toContain('standard');
    expect(items[0].itemId).toBe('h1');
    expect(items[0].updatedAt).toBeTruthy();
  });

  it('includes habit type and frequency in tags', () => {
    createHabit(adapter, 'h1', {
      name: 'Meditate',
      habitType: 'timed',
      frequency: 'weekly',
    });

    const items = getSearchableContent(adapter);
    expect(items[0].tags).toContain('weekly');
    expect(items[0].tags).toContain('timed');
  });

  it('tags archived habits', () => {
    createHabit(adapter, 'h1', { name: 'Old Habit' });
    adapter.execute(`UPDATE hb_habits SET is_archived = 1 WHERE id = 'h1'`);

    const items = getSearchableContent(adapter);
    expect(items[0].tags).toContain('archived');
  });

  it('handles habits without descriptions', () => {
    createHabit(adapter, 'h1', { name: 'Simple Habit' });

    const items = getSearchableContent(adapter);
    expect(items[0].body).toBeUndefined();
  });

  it('returns multiple habits', () => {
    createHabit(adapter, 'h1', { name: 'Exercise' });
    createHabit(adapter, 'h2', { name: 'Read' });
    createHabit(adapter, 'h3', { name: 'Journal' });

    const items = getSearchableContent(adapter);
    expect(items).toHaveLength(3);
  });
});

// ── getDataSummary ───────────────────────────────────────────────────────

describe('getDataSummary', () => {
  it('returns zeros for empty database', () => {
    const summary = getDataSummary(adapter);
    expect(summary.moduleId).toBe('habits');
    expect(summary.totalItems).toBe(0);
    expect(summary.stats.completedToday).toBe(0);
    expect(summary.stats.completionRate).toBe(0);
    expect(summary.stats.bestCurrentStreak).toBe(0);
    expect(summary.stats.bestLongestStreak).toBe(0);
  });

  it('counts active (non-archived) habits', () => {
    createHabit(adapter, 'h1', { name: 'Active' });
    createHabit(adapter, 'h2', { name: 'Archived' });
    adapter.execute(`UPDATE hb_habits SET is_archived = 1 WHERE id = 'h2'`);

    const summary = getDataSummary(adapter);
    expect(summary.totalItems).toBe(1);
  });

  it('computes today completion rate', () => {
    createHabit(adapter, 'h1', { name: 'Exercise' });
    createHabit(adapter, 'h2', { name: 'Read' });
    const today = new Date().toISOString();
    recordCompletion(adapter, 'c1', 'h1', today);

    const summary = getDataSummary(adapter);
    expect(summary.stats.completedToday).toBe(1);
    expect(summary.stats.completionRate).toBe(50);
  });

  it('includes last activity timestamp', () => {
    createHabit(adapter, 'h1', { name: 'Test' });
    recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');

    const summary = getDataSummary(adapter);
    expect(summary.lastActivity).toBeTruthy();
  });
});

// ── getActivityFeed ──────────────────────────────────────────────────────

describe('getActivityFeed', () => {
  it('returns empty array for empty database', () => {
    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    expect(items).toEqual([]);
  });

  it('returns completions as activity items', () => {
    createHabit(adapter, 'h1', { name: 'Exercise' });
    recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');

    const items = getActivityFeed(adapter, new Date('2026-01-01'));
    const completed = items.filter((i) => i.action === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].description).toBe('Completed "Exercise"');
    expect(completed[0].itemId).toBe('h1');
    expect(completed[0].itemType).toBe('habit');
  });

  it('returns new habits as created activities', () => {
    createHabit(adapter, 'h1', { name: 'New Habit' });

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const created = items.filter((i) => i.action === 'created');
    expect(created).toHaveLength(1);
    expect(created[0].description).toBe('Created habit "New Habit"');
  });

  it('filters out activities before since date', () => {
    createHabit(adapter, 'h1', { name: 'Old Habit' });
    recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');

    const items = getActivityFeed(adapter, new Date('2099-01-01'));
    expect(items).toHaveLength(0);
  });

  it('sorts activities by timestamp descending', () => {
    createHabit(adapter, 'h1', { name: 'Habit' });
    recordCompletion(adapter, 'c1', 'h1', '2026-01-10T08:00:00Z');
    recordCompletion(adapter, 'c2', 'h1', '2026-01-20T08:00:00Z');

    const items = getActivityFeed(adapter, new Date('2026-01-01'));
    const completions = items.filter((i) => i.action === 'completed');
    if (completions.length >= 2) {
      expect(completions[0].timestamp >= completions[1].timestamp).toBe(true);
    }
  });

  it('includes multiple activity types in a single feed', () => {
    createHabit(adapter, 'h1', { name: 'Exercise' });
    recordCompletion(adapter, 'c1', 'h1', new Date().toISOString());

    const items = getActivityFeed(adapter, new Date('2020-01-01'));
    const actions = items.map((i) => i.action);
    expect(actions).toContain('created');
    expect(actions).toContain('completed');
  });
});

// ── getCorrelationData ───────────────────────────────────────────────────

describe('getCorrelationData', () => {
  it('returns empty series for empty database', () => {
    const dataset = getCorrelationData(adapter);
    expect(dataset.moduleId).toBe('habits');
    expect(dataset.series).toEqual([]);
  });

  it('returns empty series when all habits are archived', () => {
    createHabit(adapter, 'h1', { name: 'Archived' });
    adapter.execute(`UPDATE hb_habits SET is_archived = 1 WHERE id = 'h1'`);

    const dataset = getCorrelationData(adapter);
    expect(dataset.series).toEqual([]);
  });

  it('returns completion rate and completion count series', () => {
    createHabit(adapter, 'h1', { name: 'Exercise' });
    createHabit(adapter, 'h2', { name: 'Read' });
    recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');
    recordCompletion(adapter, 'c2', 'h1', '2026-01-16T08:00:00Z');
    recordCompletion(adapter, 'c3', 'h2', '2026-01-16T08:00:00Z');

    const dataset = getCorrelationData(adapter);
    expect(dataset.series).toHaveLength(2);

    const rateSeries = dataset.series.find((s: { metric: string }) => s.metric === 'habit_completion_rate');
    expect(rateSeries).toBeDefined();
    expect(rateSeries!.unit).toBe('%');
    expect(rateSeries!.data.length).toBeGreaterThan(0);

    // Jan 15: 1 of 2 habits = 50%, Jan 16: 2 of 2 = 100%
    const jan15 = rateSeries!.data.find((d) => d.date === '2026-01-15');
    const jan16 = rateSeries!.data.find((d) => d.date === '2026-01-16');
    expect(jan15?.value).toBe(50);
    expect(jan16?.value).toBe(100);

    const countSeries = dataset.series.find((s: { metric: string }) => s.metric === 'habit_completions');
    expect(countSeries).toBeDefined();
    expect(countSeries!.unit).toBe('habits');
    const jan15Count = countSeries!.data.find((d) => d.date === '2026-01-15');
    const jan16Count = countSeries!.data.find((d) => d.date === '2026-01-16');
    expect(jan15Count?.value).toBe(1);
    expect(jan16Count?.value).toBe(2);
  });

  it('data points are sorted by date ascending', () => {
    createHabit(adapter, 'h1', { name: 'Test' });
    recordCompletion(adapter, 'c1', 'h1', '2026-01-20T08:00:00Z');
    recordCompletion(adapter, 'c2', 'h1', '2026-01-10T08:00:00Z');

    const dataset = getCorrelationData(adapter);
    const rateSeries = dataset.series.find((s: { metric: string }) => s.metric === 'habit_completion_rate');
    expect(rateSeries!.data[0].date < rateSeries!.data[1].date).toBe(true);
  });
});

// ── Definition wiring ────────────────────────────────────────────────────

describe('habitsCrossModule via definition', () => {
  it('is wired into HABITS_MODULE.crossModule', () => {
    expect(HABITS_MODULE.crossModule).toBeDefined();
    expect(HABITS_MODULE.crossModule!.getSearchableContent).toBeTypeOf('function');
    expect(HABITS_MODULE.crossModule!.getDataSummary).toBeTypeOf('function');
    expect(HABITS_MODULE.crossModule!.getActivityFeed).toBeTypeOf('function');
    expect(HABITS_MODULE.crossModule!.getCorrelationData).toBeTypeOf('function');
  });

  it('works through the crossModule interface', () => {
    createHabit(adapter, 'h1', { name: 'Test Habit' });
    recordCompletion(adapter, 'c1', 'h1', '2026-01-15T08:00:00Z');

    const items = HABITS_MODULE.crossModule!.getSearchableContent!(adapter);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Test Habit');

    const summary = HABITS_MODULE.crossModule!.getDataSummary!(adapter);
    expect(summary.totalItems).toBe(1);

    const feed = HABITS_MODULE.crossModule!.getActivityFeed!(adapter, new Date('2020-01-01'));
    expect(feed.length).toBeGreaterThan(0);

    const correlation = HABITS_MODULE.crossModule!.getCorrelationData!(adapter);
    expect(correlation.moduleId).toBe('habits');
  });
});
