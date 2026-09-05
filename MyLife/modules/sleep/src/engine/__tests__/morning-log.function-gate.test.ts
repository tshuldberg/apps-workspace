import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  buildMorningLogEntryInput,
  getMorningLogSummary,
  type MorningLogDraft,
} from '../morning-log';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

function makeDraft(rng: () => number, index: number): {
  draft: MorningLogDraft;
  now: Date;
} {
  const now = new Date(2026, 3, 1 + (index % 20), 7, 30, 0, 0);
  const wakeMinutes = randomInt(rng, 5 * 60, 10 * 60);
  const durationMinutes = randomInt(rng, 4 * 60, 10 * 60);
  const bedtimeMinutes = wakeMinutes - durationMinutes;

  return {
    now,
    draft: {
      bedtimeTime: formatTime(bedtimeMinutes),
      wakeTime: formatTime(wakeMinutes),
      qualityRating: randomInt(rng, 1, 5),
      wakeFeeling: ['refreshed', 'groggy', 'exhausted', 'energized'][
        randomInt(rng, 0, 3)
      ] as MorningLogDraft['wakeFeeling'],
      wakeCount: randomInt(rng, 0, 5),
      notesMd: index % 2 === 0 ? `note ${index}` : '',
    },
  };
}

describe('buildMorningLogEntryInput function quality gate', () => {
  it('matches the core overnight contract', () => {
    const result = buildMorningLogEntryInput(
      {
        bedtimeTime: '23:00',
        wakeTime: '07:00',
        qualityRating: 4,
        wakeFeeling: 'refreshed',
        wakeCount: 1,
      },
      new Date(2026, 3, 20, 7, 15),
    );

    const bedtime = new Date(result.bedtime);
    const wake = new Date(result.wake_time);
    expect(wake.getTime()).toBeGreaterThan(bedtime.getTime());
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildMorningLogEntryInput fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng, index) => makeDraft(rng, index),
      assertCase: async ({ draft, now }) => {
        const input = buildMorningLogEntryInput(draft, now);
        const bedtime = new Date(input.bedtime);
        const wake = new Date(input.wake_time);
        expect(wake.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(wake.getTime()).toBeGreaterThan(bedtime.getTime());
        expect(input.quality_rating).toBeGreaterThanOrEqual(1);
        expect(input.quality_rating).toBeLessThanOrEqual(5);
      },
    });
  });

  it('stays within linear complexity slope budget for batched summaries', async () => {
    await assertComplexitySlope({
      label: 'getMorningLogSummary batched calls',
      sizes: [250, 500, 1000],
      expected: 'linear',
      sampleRuns: 3,
      maxRatios: [4.2, 4.2],
      setup: (size) => {
        let index = 0;
        return Array.from({ length: size }, () =>
          makeDraft(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        for (const input of inputs) {
          getMorningLogSummary(input.draft, input.now);
        }
      },
    });
  });

  it('stays within memory budget under repeated conversions', async () => {
    await assertMemoryBudget({
      label: 'buildMorningLogEntryInput repeated calls',
      repeats: 10,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => {
        let index = 0;
        return Array.from({ length: 250 }, () =>
          makeDraft(() => ((index += 1), (index % 10) / 10), index),
        );
      },
      run: async (inputs) => {
        for (const input of inputs) {
          buildMorningLogEntryInput(input.draft, input.now);
        }
      },
    });
  });
});
