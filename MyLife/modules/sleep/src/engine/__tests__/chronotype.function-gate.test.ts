import { describe, expect, it } from 'vitest';
import type { SleepEntry } from '../../models/schemas';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  assessChronotype,
  getChronotypeAssessment,
  getCircadianProfile,
  type Chronotype,
} from '../chronotype';

const CHRONOTYPES: Chronotype[] = [
  'early_bird',
  'moderate_morning',
  'intermediate',
  'moderate_evening',
  'night_owl',
];

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function makeEntry(index: number, bedtime = '22:30', wakeTime = '06:30'): SleepEntry {
  const date = shiftDate('2026-01-03', index * 7);
  const bedtimeDate = bedtime >= '12:00' ? shiftDate(date, -1) : date;

  return {
    id: `entry-${index}`,
    date,
    bedtime: `${bedtimeDate}T${bedtime}:00.000Z`,
    sleep_onset_time: `${bedtimeDate}T${bedtime}:00.000Z`,
    wake_time: `${date}T${wakeTime}:00.000Z`,
    duration_minutes: 480,
    quality_rating: 4,
    wake_count: index % 3,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:00:00.000Z`,
    updated_at: `${date}T07:00:00.000Z`,
  };
}

function makeDataset(size: number): SleepEntry[] {
  return Array.from({ length: size }, (_, index) =>
    makeEntry(index, index % 2 === 0 ? '22:30' : '23:00', '07:00'),
  );
}

describe('chronotype function quality gate', () => {
  it('matches chronotype contract for known cases', () => {
    const entries = Array.from({ length: 14 }, (_, index) =>
      makeEntry(index, '01:30', '10:30'),
    );

    expect(assessChronotype(entries)).toBe('moderate_evening');
    expect(getChronotypeAssessment(entries).status).toBe('assessed');
    expect(getCircadianProfile(entries).points).toHaveLength(24);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getChronotypeAssessment fuzz',
      iterations: 80,
      seed: 88,
      makeCase: (rng) => {
        const count = randomInt(rng, 0, 28);
        const bedtimes = ['21:30', '22:30', '23:30', '00:30', '01:30'];
        const wakeTimes = ['05:30', '06:30', '07:30', '08:30', '09:30'];
        return Array.from({ length: count }, (_, index) =>
          makeEntry(
            index,
            bedtimes[randomInt(rng, 0, bedtimes.length - 1)],
            wakeTimes[randomInt(rng, 0, wakeTimes.length - 1)],
          ),
        );
      },
      assertCase: async (entries) => {
        const result = getChronotypeAssessment(entries);
        expect(result.freeDaySampleSize).toBe(entries.length);
        if (entries.length < 14) {
          expect(result.status).toBe('insufficient_data');
          expect(result.chronotype).toBeNull();
        } else {
          expect(result.status).toBe('assessed');
          expect(CHRONOTYPES).toContain(result.chronotype);
        }
      },
    });
  });

  it('stays within nlogn complexity for median-based assessment', async () => {
    await assertComplexitySlope({
      label: 'getChronotypeAssessment',
      sizes: [500, 1000, 2000],
      expected: 'nlogn',
      maxRatios: [4.0, 4.0],
      sampleRuns: 3,
      setup: makeDataset,
      run: async (entries) => {
        getChronotypeAssessment(entries);
      },
    });
  });

  it('stays within memory budget under repeated assessment', async () => {
    await assertMemoryBudget({
      label: 'getChronotypeAssessment memory',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeDataset(500),
      run: async (entries) => {
        getChronotypeAssessment(entries);
        getCircadianProfile(entries);
      },
    });
  });
});
