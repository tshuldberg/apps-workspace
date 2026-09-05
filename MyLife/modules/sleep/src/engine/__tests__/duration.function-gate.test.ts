import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { calculateDuration } from '../duration';

interface DurationCase {
  bedtime: string;
  wakeTime: string;
  expected: number;
}

function pad(day: number): string {
  return String(day).padStart(2, '0');
}

function makeDurationCase(rng: () => number, index: number): DurationCase {
  const day = 1 + (index % 20);
  const bedtimeHour = randomInt(rng, 20, 23);
  const bedtimeMinute = randomInt(rng, 0, 5) * 10;
  const expected = randomInt(rng, 300, 640);
  const bedtime = new Date(
    `2026-03-${pad(day)}T${String(bedtimeHour).padStart(2, '0')}:${String(
      bedtimeMinute,
    ).padStart(2, '0')}:00Z`,
  );
  const wake = new Date(bedtime.getTime() + expected * 60_000);

  return {
    bedtime: bedtime.toISOString().replace('.000Z', 'Z'),
    wakeTime: wake.toISOString().replace('.000Z', 'Z'),
    expected,
  };
}

describe('calculateDuration function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    expect(
      calculateDuration(
        '2026-03-01T23:00:00Z',
        '2026-03-02T07:00:00Z',
      ),
    ).toBe(480);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'calculateDuration fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng, index) => makeDurationCase(rng, index),
      assertCase: async (input) => {
        const result = calculateDuration(input.bedtime, input.wakeTime);
        expect(result).toBe(input.expected);
        expect(result).toBeGreaterThan(0);
      },
    });
  });

  it('stays within linear complexity slope budget for batched calculations', async () => {
    await assertComplexitySlope({
      label: 'calculateDuration batched calls',
      sizes: [250, 500, 1000],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) => {
        let index = 0;
        return Array.from({ length: size }, () =>
          makeDurationCase(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        for (const input of inputs) {
          calculateDuration(input.bedtime, input.wakeTime);
        }
      },
    });
  });

  it('stays within memory budget under repeated calculations', async () => {
    await assertMemoryBudget({
      label: 'calculateDuration repeated calls',
      repeats: 10,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => {
        let index = 0;
        return Array.from({ length: 250 }, () =>
          makeDurationCase(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        for (const input of inputs) {
          calculateDuration(input.bedtime, input.wakeTime);
        }
      },
    });
  });
});
