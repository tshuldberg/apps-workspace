import { describe, expect, it } from 'vitest';
import type { Factor } from '../models/factor-schemas';
import type { SleepEntry } from '../models/schemas';
import {
  exportToCBTIFormat,
  exportToCSV,
} from '../engine/export';

function makeEntry(
  id: string,
  date: string,
  overrides: Partial<SleepEntry> = {},
): SleepEntry {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  const bedDate = parsed.toISOString().slice(0, 10);

  return {
    id,
    date,
    bedtime: `${bedDate}T22:30:00.000Z`,
    sleep_onset_time: `${bedDate}T22:45:00.000Z`,
    wake_time: `${date}T06:30:00.000Z`,
    duration_minutes: 465,
    quality_rating: 5,
    wake_count: 1,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: 'Slept well, felt "clear".',
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
    last_caffeine_time: '13:30',
    last_meal_time: '19:00',
    alcohol_drinks: 0,
    exercise_today: true,
    exercise_time: '17:30',
    screen_cutoff_time: '21:00',
    room_temp: 'cool',
    room_light: 'dark',
    room_noise: 'quiet',
    supplements: ['magnesium'],
    stress_level: 2,
    pre_sleep_activities: ['reading'],
    notes: 'No late screens',
    created_at: `${entry.date}T20:00:00.000Z`,
  };
}

describe('sleep CSV exports', () => {
  it('exports CBT-I diary rows in therapist-facing format', () => {
    const first = makeEntry('entry-1', '2026-04-02');
    const second = makeEntry('entry-2', '2026-04-03', {
      quality_rating: 3,
      duration_minutes: 390,
    });
    const result = exportToCBTIFormat(
      [second, first],
      [makeFactor(first), makeFactor(second)],
      { startDate: '2026-04-02', endDate: '2026-04-03' },
    );
    const lines = result.content.split('\n');

    expect(result).toMatchObject({
      filename: 'mysleep-cbti-diary-2026-04-02-to-2026-04-03.csv',
      mimeType: 'text/csv',
      rowCount: 2,
    });
    expect(lines[0]).toBe(
      'date,bedtime,tried_to_sleep,sleep_onset,wake_time,out_of_bed_time,time_to_fall_asleep_minutes,time_in_bed_minutes,total_sleep_time_minutes,sleep_efficiency_percent,number_awakenings,wake_after_sleep_onset_minutes,sleep_quality_1_to_5,medications_supplements,notes',
    );
    expect(lines[1]).toContain('2026-04-02,22:30,22:30,22:45,06:30,06:30,15,480,465,96.9,1,0,5,magnesium');
    expect(lines[1]).toContain('"Slept well, felt ""clear"". | No late screens"');
    expect(lines[2]).toContain('2026-04-03,22:30,22:30,22:45,06:30,06:30,15,480,390,81.3,1,75,3,magnesium');
  });

  it('exports generic sleep data with factor columns and CSV escaping', () => {
    const entry = makeEntry('entry-1', '2026-04-02');
    const result = exportToCSV([entry], [makeFactor(entry)]);

    expect(result.filename).toBe('mysleep-all-sleep-data-2026-04-02.csv');
    expect(result.rowCount).toBe(1);
    expect(result.content).toContain('factor_supplements');
    expect(result.content).toContain('"Slept well, felt ""clear""."');
    expect(result.content).toContain('magnesium');
  });

  it('still produces a valid header-only CSV for empty exports', () => {
    const result = exportToCBTIFormat([], [], {
      startDate: '2026-04-02',
      endDate: '2026-04-03',
    });

    expect(result.rowCount).toBe(0);
    expect(result.content.split('\n')).toHaveLength(1);
  });
});
