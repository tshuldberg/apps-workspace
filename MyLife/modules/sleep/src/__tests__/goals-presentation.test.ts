import { describe, expect, it } from 'vitest';
import type { SleepEntryRecord, SleepGoal, SleepStreak } from '../index';
import {
  buildWeeklyGoalDots,
  calculateReminderFireDate,
  formatGoalProgress,
  formatGoalTarget,
  formatGoalTypeLabel,
  formatReminderSummary,
  formatStreakTypeLabel,
  isNewLongestStreak,
} from '../engine/goals-presentation';

const goal: SleepGoal = {
  id: 'goal-duration',
  type: 'duration',
  target_value: '8',
  start_date: '2026-04-01',
  end_date: null,
  is_active: true,
  notes: null,
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
};

function entry(date: string, durationMinutes: number): SleepEntryRecord {
  return {
    id: `entry-${date}`,
    date,
    bedtime: `${date}T22:00:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T06:30:00.000Z`,
    duration_minutes: durationMinutes,
    quality_rating: 4,
    wake_count: 1,
    sleep_latency_minutes: null,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:00:00.000Z`,
    updated_at: `${date}T07:00:00.000Z`,
  };
}

describe('goals presentation helpers', () => {
  it('formats goal and streak labels for the UI', () => {
    expect(formatGoalTypeLabel('duration')).toBe('Target hours');
    expect(formatGoalTarget('bedtime', '22:30')).toBe('10:30 PM');
    expect(formatGoalTarget('consistency', '30')).toBe('within 30 min');
    expect(formatStreakTypeLabel('no_snooze')).toBe('No snooze');
  });

  it('builds weekly dot states from active goals', () => {
    const dots = buildWeeklyGoalDots(
      [entry('2026-04-06', 500), entry('2026-04-07', 420)],
      [goal],
      '2026-04-06',
    );

    expect(dots.map((dot) => dot.status).slice(0, 3)).toEqual([
      'met',
      'missed',
      'empty',
    ]);
  });

  it('formats progress and detects current records', () => {
    expect(
      formatGoalProgress({
        goalId: goal.id,
        type: 'duration',
        met: 5,
        missed: 2,
        streak: 4,
        percentage: 71.4,
        totalEvaluated: 7,
      }),
    ).toBe('5 of 7 nights on target');

    const streak: SleepStreak = {
      id: 'streak-1',
      type: 'target_hours',
      current_count: 7,
      longest_count: 7,
      last_date: '2026-04-12',
      created_at: '2026-04-01T00:00:00.000Z',
    };
    expect(isNewLongestStreak(streak)).toBe(true);
  });

  it('calculates the next reminder fire date', () => {
    const fireDate = calculateReminderFireDate(
      '22:30',
      30,
      new Date('2026-04-24T20:00:00.000Z'),
    );

    expect(fireDate.getHours()).toBe(22);
    expect(fireDate.getMinutes()).toBe(0);
    expect(formatReminderSummary(true, '22:30', 30)).toBe(
      'Wind-down reminder 30 minutes before 10:30 PM.',
    );
  });
});
