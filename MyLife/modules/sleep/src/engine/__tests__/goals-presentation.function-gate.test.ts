import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { SleepGoal } from '../../models/goal-schemas';
import type { SleepEntry } from '../../models/schemas';
import { buildWeeklyGoalDots } from '../goals-presentation';

const WEEK_START = '2026-04-06';

function formatDate(index: number): string {
  const date = new Date(`${WEEK_START}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}

function makeGoal(targetValue = '8'): SleepGoal {
  return {
    id: `goal-${targetValue}`,
    type: 'duration',
    target_value: targetValue,
    start_date: '2026-04-01',
    end_date: null,
    is_active: true,
    notes: null,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  };
}

function makeEntry(index: number, durationMinutes: number): SleepEntry {
  const date = formatDate(index);
  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T22:30:00.000Z`,
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

describe('buildWeeklyGoalDots function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const dots = buildWeeklyGoalDots(
      [makeEntry(0, 500), makeEntry(1, 420)],
      [makeGoal()],
      WEEK_START,
    );

    expect(dots).toHaveLength(7);
    expect(dots.map((dot) => dot.status).slice(0, 3)).toEqual([
      'met',
      'missed',
      'empty',
    ]);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildWeeklyGoalDots fuzz',
      iterations: 160,
      seed: 42,
      makeCase: (rng) => {
        const count = randomInt(rng, 0, 7);
        return Array.from({ length: count }, (_, index) =>
          makeEntry(index, randomInt(rng, 360, 540)),
        );
      },
      assertCase: async (entries) => {
        const result = buildWeeklyGoalDots(entries, [makeGoal()], WEEK_START);
        expect(result).toHaveLength(7);
        expect(result.every((dot) => dot.date >= WEEK_START)).toBe(true);
        expect(result.every((dot) => dot.label.length > 0)).toBe(true);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildWeeklyGoalDots',
      sizes: [250, 500, 1000],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) =>
        Array.from({ length: size }, (_, index) =>
          makeEntry(index % 7, index % 2 === 0 ? 500 : 420),
        ),
      run: async (entries) => {
        buildWeeklyGoalDots(entries, [makeGoal()], WEEK_START);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'buildWeeklyGoalDots',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () =>
        Array.from({ length: 1000 }, (_, index) =>
          makeEntry(index % 7, index % 2 === 0 ? 500 : 420),
        ),
      run: async (entries) => {
        buildWeeklyGoalDots(entries, [makeGoal()], WEEK_START);
      },
    });
  });
});
