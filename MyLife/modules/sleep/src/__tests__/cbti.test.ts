import { describe, expect, it } from 'vitest';
import type { Factor } from '../models/factor-schemas';
import type { SleepEntry } from '../models/schemas';
import {
  calculateSleepEfficiency,
  generateCBTIDiaryEntry,
  getEfficiencyTrend,
  getSleepRestrictionWindow,
} from '../engine/cbti';

function makeEntry(
  id: string,
  date: string,
  overrides: Partial<SleepEntry> = {},
): SleepEntry {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  const bedDate = overrides.bedtime?.slice(0, 10) ?? parsed.toISOString().slice(0, 10);

  return {
    id,
    date,
    bedtime: `${bedDate}T22:30:00.000Z`,
    sleep_onset_time: `${bedDate}T22:50:00.000Z`,
    wake_time: `${date}T06:30:00.000Z`,
    duration_minutes: 450,
    quality_rating: 4,
    wake_count: 2,
    sleep_latency_minutes: 20,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: 'Woke once after a dream.',
    created_at: `${date}T07:00:00.000Z`,
    updated_at: `${date}T07:00:00.000Z`,
    ...overrides,
  };
}

function makeFactor(entry: SleepEntry): Factor {
  return {
    id: `factor-${entry.id}`,
    sleep_entry_id: entry.id,
    date: entry.date,
    last_caffeine_time: '14:00',
    last_meal_time: '19:00',
    alcohol_drinks: 0,
    exercise_today: true,
    exercise_time: '17:30',
    screen_cutoff_time: '21:30',
    room_temp: 'cool',
    room_light: 'dark',
    room_noise: 'quiet',
    supplements: ['magnesium', 'melatonin'],
    stress_level: 2,
    pre_sleep_activities: ['reading'],
    notes: 'Therapist note',
    created_at: `${entry.date}T20:00:00.000Z`,
  };
}

describe('CBT-I sleep science helpers', () => {
  it('calculates sleep efficiency from total sleep time and time in bed', () => {
    const entry = makeEntry('entry-1', '2026-04-02');

    expect(calculateSleepEfficiency(entry)).toBe(93.8);
  });

  it('builds date-range efficiency trend points with empty days', () => {
    const entries = [
      makeEntry('entry-1', '2026-04-02'),
      makeEntry('entry-3', '2026-04-04', {
        duration_minutes: 390,
      }),
    ];

    expect(
      getEfficiencyTrend(entries, {
        startDate: '2026-04-02',
        endDate: '2026-04-04',
      }),
    ).toEqual([
      {
        date: '2026-04-02',
        sleepEfficiency: 93.8,
        timeInBedMinutes: 480,
        totalSleepTimeMinutes: 450,
        sampleSize: 1,
      },
      {
        date: '2026-04-03',
        sleepEfficiency: null,
        timeInBedMinutes: null,
        totalSleepTimeMinutes: null,
        sampleSize: 0,
      },
      {
        date: '2026-04-04',
        sleepEfficiency: 81.3,
        timeInBedMinutes: 480,
        totalSleepTimeMinutes: 390,
        sampleSize: 1,
      },
    ]);
  });

  it('never recommends less than the CBT-I 5.5 hour safety floor', () => {
    const window = getSleepRestrictionWindow(72, 85, {
      averageSleepMinutes: 240,
      currentTimeInBedMinutes: 480,
      preferredWakeTime: '06:30',
    });

    expect(window).toMatchObject({
      status: 'restrict',
      recommendedBedtime: '01:00',
      recommendedWakeTime: '06:30',
      recommendedTimeInBedMinutes: 330,
      safetyFloorMinutes: 330,
    });
    expect(window.adjustmentMinutes).toBe(-150);
  });

  it('expands the window by 15 minutes after efficiency reaches 90%', () => {
    const window = getSleepRestrictionWindow(91, 85, {
      averageSleepMinutes: 450,
      currentTimeInBedMinutes: 480,
      preferredWakeTime: '06:30',
    });

    expect(window.status).toBe('expand');
    expect(window.recommendedTimeInBedMinutes).toBe(495);
    expect(window.recommendedBedtime).toBe('22:15');
  });

  it('generates a therapist-readable CBT-I diary entry', () => {
    const entry = makeEntry('entry-1', '2026-04-02');

    expect(generateCBTIDiaryEntry(entry, makeFactor(entry))).toMatchObject({
      date: '2026-04-02',
      bedtime: '22:30',
      triedToSleep: '22:30',
      sleepOnset: '22:50',
      wakeTime: '06:30',
      outOfBedTime: '06:30',
      timeToFallAsleepMinutes: 20,
      timeInBedMinutes: 480,
      totalSleepTimeMinutes: 450,
      sleepEfficiency: 93.8,
      numberAwakenings: 2,
      wakeAfterSleepOnsetMinutes: 10,
      sleepQuality: 4,
      medicationsSupplements: 'magnesium, melatonin',
      notes: 'Woke once after a dream. | Therapist note',
    });
  });
});
