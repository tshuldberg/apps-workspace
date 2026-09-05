import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '../definition';
import {
  createEntry,
  createFactor,
  createGoal,
  deleteEntry,
  getEntriesByDateRange,
  getEntry,
  getFactorByEntry,
  getLatestEntry,
  getStreakHistory,
  getStreaks,
  listEntries,
  updateEntry,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
});

afterEach(() => {
  testDb.close();
});

describe('sleep entry CRUD', () => {
  it('creates an entry with derived duration, date, and sleep latency', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-03-01T23:00:00Z',
      sleep_onset_time: '2026-03-01T23:20:00Z',
      wake_time: '2026-03-02T07:15:00Z',
      quality_rating: 4,
      wake_count: 2,
      snooze_count: 1,
      wake_feeling: 'groggy',
      notes_md: 'Woke up once from noise.',
    });

    expect(entry.id).toBeTruthy();
    expect(entry.date).toBe('2026-03-02');
    expect(entry.duration_minutes).toBe(495);
    expect(entry.sleep_latency_minutes).toBe(20);
    expect(entry.notes_md).toBe('Woke up once from noise.');
  });

  it('retrieves and updates an entry while recalculating derived fields', () => {
    const created = createEntry(testDb.adapter, {
      bedtime: '2026-03-03T22:30:00Z',
      wake_time: '2026-03-04T06:30:00Z',
      quality_rating: 3,
      wake_feeling: 'refreshed',
    });

    const found = getEntry(testDb.adapter, created.id);
    expect(found).not.toBeNull();
    expect(found?.duration_minutes).toBe(480);

    const updated = updateEntry(testDb.adapter, created.id, {
      wake_time: '2026-03-04T07:00:00Z',
      bedtime: '2026-03-03T23:00:00Z',
      sleep_onset_time: '2026-03-03T23:30:00Z',
      quality_rating: 5,
      wake_feeling: 'energized',
    });

    expect(updated).not.toBeNull();
    expect(updated?.duration_minutes).toBe(480);
    expect(updated?.sleep_latency_minutes).toBe(30);
    expect(updated?.quality_rating).toBe(5);
    expect(updated?.wake_feeling).toBe('energized');
    expect(Date.parse(updated!.updated_at)).toBeGreaterThanOrEqual(
      Date.parse(created.updated_at),
    );
  });

  it('lists entries with date filters and latest-entry lookup', () => {
    createEntry(testDb.adapter, {
      bedtime: '2026-03-01T22:30:00Z',
      wake_time: '2026-03-02T06:30:00Z',
      quality_rating: 2,
      wake_feeling: 'exhausted',
    });
    createEntry(testDb.adapter, {
      bedtime: '2026-03-02T23:15:00Z',
      wake_time: '2026-03-03T07:00:00Z',
      quality_rating: 4,
      wake_feeling: 'groggy',
    });
    const last = createEntry(testDb.adapter, {
      bedtime: '2026-03-03T22:45:00Z',
      wake_time: '2026-03-04T07:30:00Z',
      quality_rating: 5,
      wake_feeling: 'refreshed',
    });

    const marchRange = getEntriesByDateRange(
      testDb.adapter,
      '2026-03-03',
      '2026-03-04',
    );
    expect(marchRange).toHaveLength(2);

    const paged = listEntries(testDb.adapter, {
      limit: 1,
      offset: 1,
    });
    expect(paged).toHaveLength(1);
    expect(getLatestEntry(testDb.adapter)?.id).toBe(last.id);
  });

  it('deletes an entry and cascades to dreams and factors', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-03-05T23:00:00Z',
      wake_time: '2026-03-06T07:00:00Z',
      quality_rating: 4,
      wake_feeling: 'refreshed',
    });

    testDb.adapter.execute(
      `INSERT INTO sl_dreams
        (id, sleep_entry_id, date, content_md, type, themes, people, emotions, is_lucid, is_recurring, created_at)
       VALUES (?, ?, ?, ?, 'normal', '[]', '[]', '[]', 0, 0, ?)`,
      [
        'dream-1',
        entry.id,
        entry.date,
        'Flying dream',
        '2026-03-06T07:10:00Z',
      ],
    );
    testDb.adapter.execute(
      `INSERT INTO sl_factors
        (id, sleep_entry_id, date, alcohol_drinks, exercise_today, supplements, pre_sleep_activities, created_at)
       VALUES (?, ?, ?, 0, 0, '[]', '[]', ?)`,
      ['factor-1', entry.id, entry.date, '2026-03-06T07:10:00Z'],
    );

    expect(
      testDb.adapter.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM sl_dreams WHERE sleep_entry_id = ?`,
        [entry.id],
      )[0].count,
    ).toBe(1);

    expect(deleteEntry(testDb.adapter, entry.id)).toBe(true);
    expect(getEntry(testDb.adapter, entry.id)).toBeNull();
    expect(
      testDb.adapter.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM sl_dreams WHERE sleep_entry_id = ?`,
        [entry.id],
      )[0].count,
    ).toBe(0);
    expect(
      testDb.adapter.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM sl_factors WHERE sleep_entry_id = ?`,
        [entry.id],
      )[0].count,
    ).toBe(0);
  });

  it('auto-links an unlinked factor saved before the morning entry exists', () => {
    const factor = createFactor(testDb.adapter, {
      date: '2026-03-07',
      last_caffeine_time: '18:30',
      stress_level: 2,
    });

    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-03-06T23:15:00Z',
      wake_time: '2026-03-07T07:05:00Z',
      quality_rating: 4,
      wake_feeling: 'refreshed',
    });

    expect(getFactorByEntry(testDb.adapter, entry.id)).toMatchObject({
      id: factor.id,
      sleep_entry_id: entry.id,
      date: entry.date,
      last_caffeine_time: '18:30',
    });
  });

  it('updates streak summaries when entries are created', () => {
    createGoal(testDb.adapter, {
      type: 'duration',
      target_value: 8,
      start_date: '2026-03-01',
    });
    createGoal(testDb.adapter, {
      type: 'bedtime',
      target_value: '22:45',
      start_date: '2026-03-01',
    });

    createEntry(testDb.adapter, {
      bedtime: '2026-03-09T22:30:00Z',
      wake_time: '2026-03-10T06:45:00Z',
      quality_rating: 4,
      snooze_count: 0,
      wake_feeling: 'refreshed',
    });
    createEntry(testDb.adapter, {
      bedtime: '2026-03-10T23:30:00Z',
      wake_time: '2026-03-11T06:30:00Z',
      quality_rating: 2,
      snooze_count: 1,
      wake_feeling: 'groggy',
    });

    const streaks = getStreaks(testDb.adapter);
    expect(streaks.find((streak) => streak.type === 'target_hours')).toMatchObject({
      current_count: 0,
      longest_count: 1,
      last_date: '2026-03-11',
    });
    expect(streaks.find((streak) => streak.type === 'quality_above_3')).toMatchObject({
      current_count: 0,
      longest_count: 1,
      last_date: '2026-03-11',
    });
    expect(getStreakHistory(testDb.adapter, 'target_hours')).toHaveLength(2);
  });

  it('keeps linked factor dates aligned when an entry date changes', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-03-07T23:00:00Z',
      wake_time: '2026-03-08T07:00:00Z',
      quality_rating: 3,
      wake_feeling: 'groggy',
    });

    createFactor(testDb.adapter, {
      sleep_entry_id: entry.id,
      date: entry.date,
      screen_cutoff_time: '21:30',
    });

    const updated = updateEntry(testDb.adapter, entry.id, {
      wake_time: '2026-03-09T07:00:00Z',
      bedtime: '2026-03-08T23:30:00Z',
      wake_feeling: 'energized',
    });

    expect(updated?.date).toBe('2026-03-09');
    expect(getFactorByEntry(testDb.adapter, entry.id)).toMatchObject({
      sleep_entry_id: entry.id,
      date: '2026-03-09',
      screen_cutoff_time: '21:30',
    });
  });

  it('rejects invalid quality ratings and future datetimes', () => {
    expect(() =>
      createEntry(testDb.adapter, {
        bedtime: '2026-03-01T23:00:00Z',
        wake_time: '2026-03-02T07:00:00Z',
        quality_rating: 6,
        wake_feeling: 'refreshed',
      }),
    ).toThrow();

    expect(() =>
      createEntry(testDb.adapter, {
        bedtime: '2999-03-01T23:00:00Z',
        wake_time: '2999-03-02T07:00:00Z',
        quality_rating: 4,
        wake_feeling: 'refreshed',
      }),
    ).toThrow(/future/i);
  });
});
