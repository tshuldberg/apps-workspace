import { describe, expect, it } from 'vitest';
import type { SleepEntry } from '../models/schemas';
import {
  evaluateShiftSleep,
  getExpectedSleepWindow,
  setShiftPattern,
} from '../engine/shift-work';

function makeEntry(
  id: string,
  date: string,
  bedtime: string,
  wakeTime: string,
): SleepEntry {
  return {
    id,
    date,
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

describe('shift work engine', () => {
  it('normalizes shift patterns and matches days of week', () => {
    const pattern = setShiftPattern([
      {
        startTime: '22:00',
        endTime: '06:00',
        daysOfWeek: [1, 1, 3],
      },
    ]);

    expect(pattern.blocks[0].daysOfWeek).toEqual([1, 3]);
    expect(getExpectedSleepWindow('2026-04-07', pattern)).toBeNull();
  });

  it('identifies the expected daytime sleep window after an overnight shift', () => {
    const pattern = setShiftPattern([
      {
        startTime: '22:00',
        endTime: '06:00',
        daysOfWeek: [1],
      },
    ]);
    const window = getExpectedSleepWindow('2026-04-06', pattern);

    expect(window).toMatchObject({
      shiftDate: '2026-04-06',
      sleepStartTime: '07:30',
      sleepEndTime: '15:30',
      sleepDurationMinutes: 480,
    });
    expect(window?.shiftStart).toBe('2026-04-06T22:00:00.000Z');
    expect(window?.shiftEnd).toBe('2026-04-07T06:00:00.000Z');
    expect(window?.sleepStart).toBe('2026-04-07T07:30:00.000Z');
  });

  it('keeps day shifts on a normal night sleep window', () => {
    const pattern = setShiftPattern([
      {
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1],
      },
    ]);
    const window = getExpectedSleepWindow('2026-04-06', pattern);

    expect(window).toMatchObject({
      sleepStartTime: '22:30',
      sleepEndTime: '06:30',
    });
  });

  it('scores sleep against the expected shift sleep window', () => {
    const pattern = setShiftPattern([
      {
        startTime: '22:00',
        endTime: '06:00',
        daysOfWeek: [1],
      },
    ]);
    const window = getExpectedSleepWindow('2026-04-06', pattern);
    const entry = makeEntry(
      'entry-1',
      '2026-04-07',
      '2026-04-07T07:30:00.000Z',
      '2026-04-07T15:30:00.000Z',
    );

    expect(evaluateShiftSleep(entry, window)).toMatchObject({
      score: 100,
      matched: true,
      rating: 'aligned',
      overlapMinutes: 480,
      expectedDurationMinutes: 480,
      actualDurationMinutes: 480,
    });
  });
});
