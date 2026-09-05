import { describe, expect, it } from 'vitest';
import type { SleepEntry } from '../../models/schemas';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  evaluateShiftSleep,
  getExpectedSleepWindow,
  setShiftPattern,
  type ShiftBlock,
} from '../shift-work';

function makeBlock(index: number, matchingDay = 1): ShiftBlock {
  return {
    startTime: index % 2 === 0 ? '22:00' : '09:00',
    endTime: index % 2 === 0 ? '06:00' : '17:00',
    daysOfWeek: [index === 0 ? matchingDay : 5],
  };
}

function makePattern(size: number): ShiftBlock[] {
  return Array.from({ length: size }, (_, index) => makeBlock(index, 1));
}

function makeEntry(
  bedtime = '2026-04-07T07:30:00.000Z',
  wakeTime = '2026-04-07T15:30:00.000Z',
): SleepEntry {
  return {
    id: 'entry-1',
    date: '2026-04-07',
    bedtime,
    sleep_onset_time: bedtime,
    wake_time: wakeTime,
    duration_minutes: 480,
    quality_rating: 4,
    wake_count: 1,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: wakeTime,
    updated_at: wakeTime,
  };
}

describe('shift work function quality gate', () => {
  it('matches expected sleep window and evaluation contracts', () => {
    const pattern = setShiftPattern([
      {
        startTime: '22:00',
        endTime: '06:00',
        daysOfWeek: [1],
      },
    ]);
    const window = getExpectedSleepWindow('2026-04-06', pattern);

    expect(window?.sleepStartTime).toBe('07:30');
    expect(window?.sleepEndTime).toBe('15:30');
    expect(evaluateShiftSleep(makeEntry(), window)).toMatchObject({
      score: 100,
      matched: true,
      rating: 'aligned',
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'shift work fuzz',
      iterations: 80,
      seed: 89,
      makeCase: (rng) => ({
        start: ['06:00', '09:00', '15:00', '22:00'][randomInt(rng, 0, 3)],
        end: ['14:00', '17:00', '23:00', '06:00'][randomInt(rng, 0, 3)],
        day: randomInt(rng, 0, 6),
      }),
      assertCase: async ({ start, end, day }) => {
        const pattern = setShiftPattern([
          {
            startTime: start,
            endTime: end,
            daysOfWeek: [day],
          },
        ]);
        const window = getExpectedSleepWindow('2026-04-05', pattern);
        if (day === 0) {
          expect(window).not.toBeNull();
          expect(window?.sleepStartTime).toMatch(/^\d{2}:\d{2}$/);
        } else {
          expect(window).toBeNull();
        }
      },
    });
  });

  it('stays within linear complexity for pattern lookup', async () => {
    await assertComplexitySlope({
      label: 'getExpectedSleepWindow',
      sizes: [1000, 2000, 4000],
      expected: 'linear',
      maxRatios: [4.0, 4.0],
      warmupRuns: 2,
      sampleRuns: 5,
      setup: makePattern,
      run: async (pattern) => {
        getExpectedSleepWindow('2026-04-07', pattern);
      },
    });
  });

  it('stays within memory budget under repeated window evaluation', async () => {
    await assertMemoryBudget({
      label: 'getExpectedSleepWindow memory',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makePattern(500),
      run: async (pattern) => {
        const window = getExpectedSleepWindow('2026-04-07', pattern);
        evaluateShiftSleep(makeEntry(), window);
      },
    });
  });
});
