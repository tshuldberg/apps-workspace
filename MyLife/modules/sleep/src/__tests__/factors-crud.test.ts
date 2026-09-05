import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '../definition';
import {
  createEntry,
  createFactor,
  deleteFactor,
  getFactor,
  getFactorByDate,
  getFactorByEntry,
  getFactorCorrelations,
  listFactors,
  saveFactorLog,
  updateFactor,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
});

afterEach(() => {
  testDb.close();
});

describe('factor CRUD', () => {
  it('creates linked factor records and normalizes seeded taxonomy arrays', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-03-09T23:00:00Z',
      wake_time: '2026-03-10T07:00:00Z',
      quality_rating: 4,
      wake_feeling: 'refreshed',
    });

    const factor = createFactor(testDb.adapter, {
      sleep_entry_id: entry.id,
      date: entry.date,
      last_caffeine_time: '18:30',
      last_meal_time: '20:00',
      alcohol_drinks: 1,
      exercise_today: true,
      exercise_time: '17:15',
      screen_cutoff_time: '22:00',
      room_temp: 'comfortable',
      room_light: 'dim',
      room_noise: 'quiet',
      supplements: [' Magnesium ', 'L Theanine', 'magnesium'],
      stress_level: 3,
      pre_sleep_activities: [
        ' Reading ',
        'screen-time',
        'reading',
        'social media',
      ],
      notes: '  Long day but a calm wind-down.  ',
    });

    expect(factor.sleep_entry_id).toBe(entry.id);
    expect(factor.supplements).toEqual(['magnesium', 'l_theanine']);
    expect(factor.pre_sleep_activities).toEqual([
      'reading',
      'screen_time',
      'social_media',
    ]);
    expect(factor.notes).toBe('Long day but a calm wind-down.');
    expect(getFactor(testDb.adapter, factor.id)).toEqual(factor);
    expect(getFactorByEntry(testDb.adapter, entry.id)).toEqual(factor);

    const stored = testDb.adapter.query<{
      supplements: string;
      pre_sleep_activities: string;
    }>(
      `SELECT supplements, pre_sleep_activities
       FROM sl_factors
       WHERE id = ?`,
      [factor.id],
    )[0];

    expect(stored).toEqual({
      supplements: '["magnesium","l_theanine"]',
      pre_sleep_activities: '["reading","screen_time","social_media"]',
    });
  });

  it('updates, lists, and deletes factor records', () => {
    const firstEntry = createEntry(testDb.adapter, {
      bedtime: '2026-03-10T23:00:00Z',
      wake_time: '2026-03-11T07:00:00Z',
      quality_rating: 2,
      wake_feeling: 'groggy',
    });
    const secondEntry = createEntry(testDb.adapter, {
      bedtime: '2026-03-11T22:30:00Z',
      wake_time: '2026-03-12T06:45:00Z',
      quality_rating: 4,
      wake_feeling: 'refreshed',
    });

    const firstFactor = createFactor(testDb.adapter, {
      sleep_entry_id: firstEntry.id,
      date: firstEntry.date,
      pre_sleep_activities: ['screen_time'],
      room_noise: 'loud',
      alcohol_drinks: 2,
      notes: 'Too much scrolling.',
    });
    const secondFactor = createFactor(testDb.adapter, {
      sleep_entry_id: secondEntry.id,
      date: secondEntry.date,
      exercise_today: true,
      exercise_time: '18:00',
      pre_sleep_activities: ['reading'],
      room_noise: 'quiet',
    });

    const updated = updateFactor(testDb.adapter, firstFactor.id, {
      last_caffeine_time: null,
      room_temp: 'cool',
      pre_sleep_activities: ['screen_time', 'podcast'],
      notes: null,
    });

    expect(updated).toMatchObject({
      id: firstFactor.id,
      room_temp: 'cool',
      notes: null,
      pre_sleep_activities: ['screen_time', 'podcast'],
    });

    expect(
      listFactors(testDb.adapter, {
        startDate: '2026-03-11',
        endDate: '2026-03-12',
      }).map((factor) => factor.id),
    ).toEqual([secondFactor.id, firstFactor.id]);

    expect(deleteFactor(testDb.adapter, secondFactor.id)).toBe(true);
    expect(getFactor(testDb.adapter, secondFactor.id)).toBeNull();
    expect(deleteFactor(testDb.adapter, secondFactor.id)).toBe(false);
  });

  it('gets factors by date and upserts a single record per night', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-03-13T23:00:00Z',
      wake_time: '2026-03-14T07:00:00Z',
      quality_rating: 4,
      wake_feeling: 'refreshed',
    });

    const firstSave = saveFactorLog(testDb.adapter, {
      date: entry.date,
      last_caffeine_time: '18:45',
      stress_level: 2,
    });

    const secondSave = saveFactorLog(testDb.adapter, {
      sleep_entry_id: entry.id,
      date: entry.date,
      last_caffeine_time: null,
      last_meal_time: '20:15',
      alcohol_drinks: 1,
      exercise_today: true,
      exercise_time: '17:30',
      screen_cutoff_time: null,
      room_temp: 'cool',
      room_light: 'dark',
      room_noise: 'quiet',
      supplements: ['magnesium'],
      stress_level: 4,
      pre_sleep_activities: ['reading'],
      notes: 'Updated after the morning log.',
    });

    expect(secondSave.id).toBe(firstSave.id);
    expect(firstSave.sleep_entry_id).toBe(entry.id);
    expect(getFactorByDate(testDb.adapter, entry.date)).toEqual(secondSave);
    expect(getFactorByEntry(testDb.adapter, entry.id)).toEqual(secondSave);
    expect(
      testDb.adapter.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM sl_factors WHERE date = ?`,
        [entry.date],
      )[0].count,
    ).toBe(1);
  });

  it('enforces entry-link and enum validation rules', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-03-12T23:00:00Z',
      wake_time: '2026-03-13T07:00:00Z',
      quality_rating: 3,
      wake_feeling: 'groggy',
    });

    expect(() =>
      createFactor(testDb.adapter, {
        sleep_entry_id: entry.id,
        date: '2026-03-12',
      }),
    ).toThrow(/must match the linked sleep entry date/i);

    expect(() =>
      createFactor(testDb.adapter, {
        sleep_entry_id: entry.id,
        date: entry.date,
        room_temp: 'freezing' as never,
      }),
    ).toThrow(/invalid enum value/i);

    expect(() =>
      createFactor(testDb.adapter, {
        sleep_entry_id: entry.id,
        date: entry.date,
        pre_sleep_activities: ['doomscrolling'],
      }),
    ).toThrow(/invalid pre_sleep_activity/i);

    expect(() =>
      createFactor(testDb.adapter, {
        sleep_entry_id: entry.id,
        date: entry.date,
        exercise_today: false,
        exercise_time: '19:00',
      }),
    ).toThrow(/exercise_time requires exercise_today to be true/i);

    createFactor(testDb.adapter, {
      sleep_entry_id: entry.id,
      date: entry.date,
      pre_sleep_activities: ['reading'],
    });

    expect(() =>
      createFactor(testDb.adapter, {
        sleep_entry_id: entry.id,
        date: entry.date,
        pre_sleep_activities: ['podcast'],
      }),
    ).toThrow(/already exists for this sleep entry/i);
  });

  it('allows tonight factors dated one day ahead for evening logging', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T16:30:00Z'));

    try {
      const factor = createFactor(testDb.adapter, {
        date: '2026-03-21',
        stress_level: 3,
        pre_sleep_activities: ['reading'],
      });

      expect(factor.date).toBe('2026-03-21');
    } finally {
      vi.useRealTimers();
    }
  });

  it('builds a P4-ready correlation summary from linked factor data', () => {
    const qualities = [1, 2, 3, 4, 5];
    const stressLevels = [5, 4, 3, 2, 1];
    const caffeineCutoffs = ['22:30', '22:00', '21:30', '21:00', '20:30'];

    for (let index = 0; index < qualities.length; index += 1) {
      const day = String(index + 1).padStart(2, '0');
      const nextDay = String(index + 2).padStart(2, '0');

      const entry = createEntry(testDb.adapter, {
        bedtime: `2026-03-${day}T23:00:00Z`,
        wake_time: `2026-03-${nextDay}T07:00:00Z`,
        quality_rating: qualities[index],
        wake_feeling:
          qualities[index] >= 4 ? 'refreshed' : 'groggy',
      });

      createFactor(testDb.adapter, {
        sleep_entry_id: entry.id,
        date: entry.date,
        last_caffeine_time: caffeineCutoffs[index],
        last_meal_time: '20:00',
        alcohol_drinks: index,
        exercise_today: index >= 2,
        exercise_time: index >= 2 ? '18:30' : undefined,
        screen_cutoff_time: index >= 2 ? '21:00' : '22:30',
        room_temp: index >= 2 ? 'cool' : 'warm',
        room_light: index >= 2 ? 'dark' : 'bright',
        room_noise: index >= 2 ? 'quiet' : 'loud',
        supplements: index >= 2 ? ['melatonin'] : [],
        stress_level: stressLevels[index],
        pre_sleep_activities:
          index >= 2 ? ['reading'] : ['screen_time'],
      });
    }

    const correlations = getFactorCorrelations(testDb.adapter);
    const stress = correlations.numericCorrelations.find(
      (item) => item.metric === 'stressLevel',
    );
    const caffeine = correlations.numericCorrelations.find(
      (item) => item.metric === 'lastCaffeineMinutesBeforeBed',
    );
    const reading = correlations.activityAssociations.find(
      (item) => item.value === 'reading',
    );
    const screenTime = correlations.activityAssociations.find(
      (item) => item.value === 'screen_time',
    );

    expect(correlations.sampleSize).toBe(5);
    expect(correlations.points).toHaveLength(5);
    expect(correlations.points[0]).toMatchObject({
      date: '2026-03-02',
      qualityRating: 1,
      lastCaffeineMinutesBeforeBed: 30,
      roomNoise: 'loud',
    });
    expect(stress).toMatchObject({
      metric: 'stressLevel',
      coefficient: -1,
      sampleSize: 5,
    });
    expect(caffeine?.sampleSize).toBe(5);
    expect(caffeine?.coefficient).toBe(1);
    expect(reading?.averageQualityRating).toBeGreaterThan(
      screenTime?.averageQualityRating ?? 0,
    );
    expect(
      correlations.roomNoiseAssociations.find((item) => item.value === 'quiet')
        ?.averageQualityRating,
    ).toBeGreaterThan(
      correlations.roomNoiseAssociations.find((item) => item.value === 'loud')
        ?.averageQualityRating ?? 0,
    );
  });
});
