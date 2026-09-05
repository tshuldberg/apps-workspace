import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  buildFactorCreateInput,
  createEmptyFactorLogDraft,
  formatFactorClockTime,
  getDefaultFactorLogMode,
  getFactorLogDraftFromFactor,
  getStressLevelMeta,
  resolveFactorLogDate,
} from '../engine/factor-log';

describe('factor log helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to tonight in the late afternoon and last night in the morning', () => {
    vi.setSystemTime(new Date(2026, 3, 22, 8, 15));
    expect(getDefaultFactorLogMode()).toBe('last_night');
    expect(resolveFactorLogDate('last_night')).toBe('2026-04-22');

    vi.setSystemTime(new Date(2026, 3, 22, 19, 45));
    expect(getDefaultFactorLogMode()).toBe('tonight');
    expect(resolveFactorLogDate('tonight')).toBe('2026-04-23');
  });

  it('builds a complete factor payload from draft state', () => {
    const input = buildFactorCreateInput(
      {
        lastCaffeineTime: '17:45',
        lastMealTime: '',
        alcoholDrinks: 2,
        exerciseToday: true,
        exerciseTime: '18:30',
        screenCutoffTime: '22:10',
        roomTemp: 'cool',
        roomLight: 'dark',
        roomNoise: 'quiet',
        supplements: ['magnesium', 'l_theanine'],
        stressLevel: 4,
        preSleepActivities: ['reading', 'meditation'],
        disturbancesNote: '  Cat woke me once.  ',
      },
      {
        date: '2026-04-22',
        sleepEntryId: 'entry-1',
      },
    );

    expect(input).toEqual({
      sleep_entry_id: 'entry-1',
      date: '2026-04-22',
      last_caffeine_time: '17:45',
      last_meal_time: null,
      alcohol_drinks: 2,
      exercise_today: true,
      exercise_time: '18:30',
      screen_cutoff_time: '22:10',
      room_temp: 'cool',
      room_light: 'dark',
      room_noise: 'quiet',
      supplements: ['magnesium', 'l_theanine'],
      stress_level: 4,
      pre_sleep_activities: ['reading', 'meditation'],
      notes: 'Cat woke me once.',
    });
  });

  it('creates an empty draft and restores draft state from saved factor data', () => {
    expect(createEmptyFactorLogDraft()).toEqual({
      lastCaffeineTime: '',
      lastMealTime: '',
      alcoholDrinks: 0,
      exerciseToday: false,
      exerciseTime: '',
      screenCutoffTime: '',
      roomTemp: null,
      roomLight: null,
      roomNoise: null,
      supplements: [],
      stressLevel: null,
      preSleepActivities: [],
      disturbancesNote: '',
    });

    expect(
      getFactorLogDraftFromFactor({
        id: 'factor-1',
        sleep_entry_id: 'entry-1',
        date: '2026-04-22',
        last_caffeine_time: '18:00',
        last_meal_time: '20:30',
        alcohol_drinks: 1,
        exercise_today: true,
        exercise_time: '17:15',
        screen_cutoff_time: '21:45',
        room_temp: 'comfortable',
        room_light: 'dim',
        room_noise: 'moderate',
        supplements: ['magnesium'],
        stress_level: 3,
        pre_sleep_activities: ['reading', 'journaling'],
        notes: 'Late text thread.',
        created_at: '2026-04-22T07:30:00Z',
      }),
    ).toEqual({
      lastCaffeineTime: '18:00',
      lastMealTime: '20:30',
      alcoholDrinks: 1,
      exerciseToday: true,
      exerciseTime: '17:15',
      screenCutoffTime: '21:45',
      roomTemp: 'comfortable',
      roomLight: 'dim',
      roomNoise: 'moderate',
      supplements: ['magnesium'],
      stressLevel: 3,
      preSleepActivities: ['reading', 'journaling'],
      disturbancesNote: 'Late text thread.',
    });
  });

  it('formats clock labels and stress metadata for detail screens', () => {
    expect(formatFactorClockTime('00:05')).toBe('12:05 AM');
    expect(formatFactorClockTime('18:30')).toBe('6:30 PM');
    expect(getStressLevelMeta(4)).toMatchObject({
      value: 4,
      emoji: '😣',
      label: 'High',
    });
    expect(getStressLevelMeta(null)).toBeNull();
  });
});
