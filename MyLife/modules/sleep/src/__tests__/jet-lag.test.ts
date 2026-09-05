import { describe, expect, it } from 'vitest';
import type { SleepEntry } from '../models/schemas';
import {
  createJetLagTracker,
  getAdjustmentProgress,
  getRecommendation,
  getRecommendedSleepTime,
} from '../engine/jet-lag';

function makeEntry(
  id: string,
  date: string,
  bedtimeClock: string,
): SleepEntry {
  const bedtimeDate = bedtimeClock >= '12:00' ? date : date;

  return {
    id,
    date,
    bedtime: `${bedtimeDate}T${bedtimeClock}:00.000Z`,
    sleep_onset_time: `${bedtimeDate}T${bedtimeClock}:00.000Z`,
    wake_time: `${date}T07:00:00.000Z`,
    duration_minutes: 480,
    quality_rating: 4,
    wake_count: 1,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T07:00:00.000Z`,
    updated_at: `${date}T07:00:00.000Z`,
  };
}

describe('jet lag engine', () => {
  it('calculates eastward timezone difference and one hour per day adjustment', () => {
    const tracker = createJetLagTracker(
      'America/Los_Angeles',
      'America/New_York',
      '2026-04-24',
    );

    expect(tracker).toMatchObject({
      timeZoneDifferenceHours: 3,
      direction: 'eastward',
      targetBedtime: '23:00',
      bodyAlignedBedtime: '02:00',
      dailyAdjustmentHours: 1,
      estimatedAdjustmentDays: 3,
    });
    expect(getRecommendedSleepTime(tracker, 1)).toBe('01:00');
    expect(getRecommendation(tracker, 3)).toBe(
      'Try to sleep at 23:00 local time tonight.',
    );
  });

  it('calculates westward timezone difference and 1.5 hour daily adjustment', () => {
    const tracker = createJetLagTracker(
      'America/New_York',
      'America/Los_Angeles',
      '2026-04-24',
    );

    expect(tracker.direction).toBe('westward');
    expect(tracker.timeZoneDifferenceHours).toBe(-3);
    expect(tracker.bodyAlignedBedtime).toBe('20:00');
    expect(getRecommendedSleepTime(tracker, 1)).toBe('21:30');
    expect(getRecommendedSleepTime(tracker, 2)).toBe('23:00');
  });

  it('estimates adjustment progress from post-arrival bedtime shift', () => {
    const tracker = createJetLagTracker(
      'America/Los_Angeles',
      'America/New_York',
      '2026-04-24',
    );

    expect(
      getAdjustmentProgress(tracker, [
        makeEntry('entry-1', '2026-04-24', '02:00'),
      ]),
    ).toBe(0);
    expect(
      getAdjustmentProgress(tracker, [
        makeEntry('entry-1', '2026-04-24', '23:00'),
      ]),
    ).toBe(100);
  });

  it('treats same-timezone travel as already adjusted', () => {
    const tracker = createJetLagTracker(
      'America/Los_Angeles',
      'America/Los_Angeles',
      '2026-04-24',
    );

    expect(tracker.direction).toBe('none');
    expect(getAdjustmentProgress(tracker, [])).toBe(100);
    expect(getRecommendedSleepTime(tracker, 5)).toBe('23:00');
  });
});
