import { describe, expect, it } from 'vitest';
import type { SleepEntry } from '../models/schemas';
import {
  assessChronotype,
  getChronotypeAssessment,
  getCircadianProfile,
} from '../engine/chronotype';

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function makeEntry(
  id: string,
  date: string,
  bedtimeClock = '22:30',
  wakeClock = '06:30',
): SleepEntry {
  const bedtimeDate = bedtimeClock >= '12:00' ? shiftDate(date, -1) : date;

  return {
    id,
    date,
    bedtime: `${bedtimeDate}T${bedtimeClock}:00.000Z`,
    sleep_onset_time: `${bedtimeDate}T${bedtimeClock}:00.000Z`,
    wake_time: `${date}T${wakeClock}:00.000Z`,
    duration_minutes: 480,
    quality_rating: 4,
    wake_count: 1,
    sleep_latency_minutes: 15,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T${wakeClock}:00.000Z`,
    updated_at: `${date}T${wakeClock}:00.000Z`,
  };
}

function makeWeekendEntries(
  count: number,
  bedtimeClock: string,
  wakeClock: string,
): SleepEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const date = shiftDate('2026-01-03', index * 7);
    return makeEntry(`entry-${index}`, date, bedtimeClock, wakeClock);
  });
}

describe('chronotype engine', () => {
  it('requires 14 free-day entries before exposing a chronotype', () => {
    const entries = makeWeekendEntries(13, '22:30', '06:30');
    const result = getChronotypeAssessment(entries);

    expect(result.status).toBe('insufficient_data');
    expect(result.freeDaySampleSize).toBe(13);
    expect(result.chronotype).toBeNull();
    expect(() => assessChronotype(entries)).toThrow(/14 free-day entries/);
  });

  it('classifies early and late free-day patterns from midpoint timing', () => {
    const early = makeWeekendEntries(14, '21:30', '05:00');
    const late = makeWeekendEntries(14, '02:30', '10:30');

    expect(assessChronotype(early)).toBe('early_bird');
    expect(assessChronotype(late)).toBe('night_owl');
    expect(getChronotypeAssessment(late)).toMatchObject({
      status: 'assessed',
      chronotype: 'night_owl',
      medianBedtime: '02:30',
      medianWakeTime: '10:30',
      midpoint: '06:30',
      confidence: 'medium',
    });
  });

  it('builds a 24 hour circadian profile around typical wake time', () => {
    const entries = makeWeekendEntries(14, '22:00', '06:00');
    const profile = getCircadianProfile(entries);

    expect(profile.recommendedWakeTime).toBe('06:00');
    expect(profile.points).toHaveLength(24);
    expect(profile.points[8]).toMatchObject({
      hour: 8,
      hoursAfterWake: 2,
      phase: 'peak',
      alertness: 92,
    });
    expect(profile.points[13]).toMatchObject({
      hour: 13,
      hoursAfterWake: 7,
      phase: 'dip',
    });
    expect(profile.points[16]).toMatchObject({
      hour: 16,
      hoursAfterWake: 10,
      phase: 'secondary_peak',
    });
  });
});
