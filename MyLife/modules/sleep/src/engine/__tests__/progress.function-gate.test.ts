import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { SleepGoal } from '../../models/goal-schemas';
import type { SleepEntry } from '../../models/schemas';
import { evaluateEntry, getWeeklySummary } from '../progress';

function formatDate(index: number): string {
  return new Date(Date.UTC(2026, 2, index + 1, 12, 0, 0, 0))
    .toISOString()
    .slice(0, 10);
}

function makeEntry(index: number, durationMinutes = 480): SleepEntry {
  const date = formatDate(index);
  return {
    id: `entry-${index}`,
    date,
    bedtime: `${date}T22:45:00.000Z`,
    sleep_onset_time: `${date}T23:00:00.000Z`,
    wake_time: `${date}T07:00:00.000Z`,
    duration_minutes: durationMinutes,
    quality_rating: 1 + (index % 5),
    wake_count: index % 3,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: index % 2,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:05:00.000Z`,
    updated_at: `${date}T07:05:00.000Z`,
  };
}

function makeGoal(id: string, targetValue: string): SleepGoal {
  return {
    id,
    type: 'duration',
    target_value: targetValue,
    start_date: null,
    end_date: null,
    is_active: true,
    notes: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  };
}

describe('sleep progress function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const goal = makeGoal('duration-goal', '8');
    const met = evaluateEntry(makeEntry(0, 500), [goal]);
    const missed = evaluateEntry(makeEntry(1, 420), [goal]);

    expect(met.goalsMet).toHaveLength(1);
    expect(met.goalsMissed).toHaveLength(0);
    expect(missed.goalsMet).toHaveLength(0);
    expect(missed.goalsMissed).toHaveLength(1);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'evaluateEntry fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng, index) => {
        const duration = randomInt(rng, 300, 600);
        return {
          entry: makeEntry(index, duration),
          goal: makeGoal(`goal-${index}`, String(randomInt(rng, 6, 9))),
        };
      },
      assertCase: async ({ entry, goal }) => {
        const result = evaluateEntry(entry, [goal], [entry]);
        expect(result.results).toHaveLength(1);
        expect(result.goalsMet.length + result.goalsMissed.length).toBe(1);
        expect(result.results[0].met).toBe(
          entry.duration_minutes >= Number(goal.target_value) * 60,
        );
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getWeeklySummary',
      sizes: [500, 1000, 2000],
      expected: 'nlogn',
      warmupRuns: 2,
      sampleRuns: 7,
      maxRatios: [5.5, 5.5],
      setup: (size) => ({
        entries: Array.from({ length: size }, (_, index) => makeEntry(index)),
        goals: [makeGoal('duration-goal', '8')],
      }),
      run: async ({ entries, goals }) => {
        for (let index = 0; index < 20; index += 1) {
          getWeeklySummary(entries, goals, formatDate(0));
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'evaluateEntry memory',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => ({
        entries: Array.from({ length: 120 }, (_, index) => makeEntry(index)),
        goals: [makeGoal('duration-goal', '8')],
      }),
      run: async ({ entries, goals }) => {
        evaluateEntry(entries[entries.length - 1], goals, entries);
      },
    });
  });
});
