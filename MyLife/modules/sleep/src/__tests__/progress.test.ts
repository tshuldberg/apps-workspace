import { describe, expect, it } from 'vitest';
import {
  evaluateEntry,
  evaluateStreakType,
  generateAccountabilityMessage,
  getWeeklySummary,
} from '../engine/progress';
import type { SleepGoal, SleepStreak } from '../models/goal-schemas';
import type { SleepEntry } from '../models/schemas';

function makeEntry(
  id: string,
  date: string,
  overrides: Partial<SleepEntry> = {},
): SleepEntry {
  return {
    id,
    date,
    bedtime: `${date}T22:45:00.000Z`,
    sleep_onset_time: `${date}T23:00:00.000Z`,
    wake_time: `${date}T07:00:00.000Z`,
    duration_minutes: 480,
    quality_rating: 4,
    wake_count: 0,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:05:00.000Z`,
    updated_at: `${date}T07:05:00.000Z`,
    ...overrides,
  };
}

function makeGoal(
  id: string,
  type: SleepGoal['type'],
  targetValue: string,
): SleepGoal {
  return {
    id,
    type,
    target_value: targetValue,
    start_date: null,
    end_date: null,
    is_active: true,
    notes: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  };
}

describe('sleep progress engine', () => {
  it('evaluates duration, bedtime, and wake goals for an entry', () => {
    const entry = makeEntry('entry-1', '2026-03-02', {
      sleep_onset_time: '2026-03-02T23:20:00.000Z',
      wake_time: '2026-03-02T07:20:00.000Z',
    });
    const goals = [
      makeGoal('duration', 'duration', '8'),
      makeGoal('bedtime', 'bedtime', '23:00'),
      makeGoal('wake', 'wake_time', '07:00'),
    ];

    const evaluation = evaluateEntry(entry, goals, [entry]);

    expect(evaluation.goalsMet.map((goal) => goal.id)).toEqual([
      'duration',
      'bedtime',
      'wake',
    ]);
    expect(evaluation.goalsMissed).toEqual([]);
  });

  it('uses rolling history for consistency goals', () => {
    const goals = [makeGoal('consistency', 'consistency', '30')];
    const entries = [
      makeEntry('entry-1', '2026-03-01'),
      makeEntry('entry-2', '2026-03-02', {
        sleep_onset_time: '2026-03-02T23:10:00.000Z',
        wake_time: '2026-03-02T07:05:00.000Z',
      }),
      makeEntry('entry-3', '2026-03-03', {
        sleep_onset_time: '2026-03-03T22:55:00.000Z',
        wake_time: '2026-03-03T06:55:00.000Z',
      }),
      makeEntry('entry-4', '2026-03-04', {
        sleep_onset_time: '2026-03-04T23:15:00.000Z',
        wake_time: '2026-03-04T07:15:00.000Z',
      }),
      makeEntry('entry-5', '2026-03-05', {
        sleep_onset_time: '2026-03-05T00:30:00.000Z',
        wake_time: '2026-03-05T09:00:00.000Z',
      }),
    ];

    expect(evaluateEntry(entries[3], goals, entries).goalsMet).toHaveLength(1);
    expect(evaluateEntry(entries[4], goals, entries).goalsMissed).toHaveLength(1);
  });

  it('summarizes weekly adherence and keeps copy gentle', () => {
    const goals = [
      makeGoal('duration', 'duration', '8'),
      makeGoal('bedtime', 'bedtime', '23:00'),
    ];
    const streaks: SleepStreak[] = [
      {
        id: 'streak-1',
        type: 'target_hours',
        current_count: 2,
        longest_count: 5,
        last_date: '2026-03-07',
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ];
    const entries = [
      makeEntry('entry-1', '2026-03-02'),
      makeEntry('entry-2', '2026-03-03', { duration_minutes: 420 }),
      makeEntry('entry-3', '2026-03-04'),
    ];

    const summary = getWeeklySummary(entries, goals, '2026-03-02', streaks);
    const message = generateAccountabilityMessage(summary);

    expect(summary).toMatchObject({
      daysOnTarget: 2,
      evaluatedDays: 3,
      avgQuality: 4,
      longestStreak: 5,
      goalsMet: 5,
      goalsMissed: 1,
    });
    expect(summary.goalAdherencePercentage).toBe(83.3);
    expect(message).toContain('2 of 3');
    expect(message).not.toMatch(/fail|failed|punish|bad/i);
  });

  it('evaluates streak types from a sleep entry', () => {
    const entry = makeEntry('entry-1', '2026-03-02', {
      duration_minutes: 510,
      quality_rating: 4,
      snooze_count: 0,
    });
    const goals = [makeGoal('bedtime', 'bedtime', '23:00')];

    expect(evaluateStreakType(entry, 'quality_above_3')).toBe(true);
    expect(evaluateStreakType(entry, 'target_hours', { targetHours: 8 }))
      .toBe(true);
    expect(evaluateStreakType(entry, 'no_snooze')).toBe(true);
    expect(evaluateStreakType(entry, 'on_time_bed', { goals })).toBe(true);
  });
});
