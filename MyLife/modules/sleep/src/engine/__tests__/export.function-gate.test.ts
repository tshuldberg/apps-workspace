import { describe, expect, it } from 'vitest';
import type { Factor } from '../../models/factor-schemas';
import type { SleepEntry } from '../../models/schemas';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { exportToCBTIFormat } from '../export';

function formatDate(index: number): string {
  return new Date(Date.UTC(2026, 0, index + 1, 12, 0, 0, 0))
    .toISOString()
    .slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function makeEntry(index: number): SleepEntry {
  const date = formatDate(index);
  const bedDate = shiftDate(date, -1);

  return {
    id: `entry-${index}`,
    date,
    bedtime: `${bedDate}T22:30:00.000Z`,
    sleep_onset_time: `${bedDate}T22:45:00.000Z`,
    wake_time: `${date}T06:30:00.000Z`,
    duration_minutes: 390 + (index % 91),
    quality_rating: 1 + (index % 5),
    wake_count: index % 4,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: index % 11 === 0 ? 'Quoted "note", comma included.' : null,
    created_at: `${date}T07:00:00.000Z`,
    updated_at: `${date}T07:00:00.000Z`,
  };
}

function makeFactor(entry: SleepEntry, index: number): Factor {
  return {
    id: `factor-${index}`,
    sleep_entry_id: entry.id,
    date: entry.date,
    last_caffeine_time: '13:30',
    last_meal_time: null,
    alcohol_drinks: index % 3,
    exercise_today: index % 2 === 0,
    exercise_time: index % 2 === 0 ? '17:30' : null,
    screen_cutoff_time: '21:30',
    room_temp: 'cool',
    room_light: 'dark',
    room_noise: 'quiet',
    supplements: index % 2 === 0 ? ['magnesium'] : [],
    stress_level: 1 + (index % 5),
    pre_sleep_activities: index % 2 === 0 ? ['reading'] : ['screen_time'],
    notes: null,
    created_at: `${entry.date}T20:00:00.000Z`,
  };
}

function makeDataset(size: number): {
  entries: SleepEntry[];
  factors: Factor[];
} {
  const entries = Array.from({ length: size }, (_, index) => makeEntry(index));
  const factors = entries.map(makeFactor);
  return { entries, factors };
}

describe('exportToCBTIFormat function quality gate', () => {
  it('matches CBT-I CSV export contract for known cases', () => {
    const { entries, factors } = makeDataset(2);
    const result = exportToCBTIFormat(entries, factors);

    expect(result.mimeType).toBe('text/csv');
    expect(result.filename).toBe('mysleep-cbti-diary-2026-01-01-to-2026-01-02.csv');
    expect(result.rowCount).toBe(2);
    expect(result.content.split('\n')).toHaveLength(3);
    expect(result.content).toContain('sleep_efficiency_percent');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'exportToCBTIFormat fuzz',
      iterations: 80,
      seed: 76,
      makeCase: (rng) => makeDataset(randomInt(rng, 0, 120)),
      assertCase: async ({ entries, factors }) => {
        const result = exportToCBTIFormat(entries, factors);
        expect(result.rowCount).toBe(entries.length);
        expect(result.content.split('\n')).toHaveLength(entries.length + 1);
        expect(result.content.startsWith('date,bedtime')).toBe(true);
      },
    });
  });

  it('stays within linear complexity for CSV generation', async () => {
    await assertComplexitySlope({
      label: 'exportToCBTIFormat',
      sizes: [500, 1000, 2000],
      expected: 'linear',
      maxRatios: [5.0, 5.0],
      sampleRuns: 3,
      setup: makeDataset,
      run: async ({ entries, factors }) => {
        exportToCBTIFormat(entries, factors);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'exportToCBTIFormat memory',
      repeats: 20,
      maxHeapDeltaBytes: 10 * 1024 * 1024,
      setup: () => makeDataset(500),
      run: async ({ entries, factors }) => {
        exportToCBTIFormat(entries, factors);
      },
    });
  });
});
