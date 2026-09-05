import { describe, expect, it } from 'vitest';
import type { SleepEntryRecord } from '..';
import {
  buildSleepTimelineSections,
  formatSleepEntryDateLabel,
  getSleepDurationTone,
  getSleepWakeFeelingMeta,
  getSleepWeekStart,
  renderSleepQualityStars,
} from '../engine/timeline';

function makeEntry(
  id: string,
  date: string,
  durationMinutes: number,
): SleepEntryRecord {
  return {
    id,
    date,
    bedtime: `${date}T06:00:00.000Z`,
    sleep_onset_time: null,
    wake_time: `${date}T14:00:00.000Z`,
    duration_minutes: durationMinutes,
    quality_rating: 4,
    wake_count: 1,
    sleep_latency_minutes: null,
    alarm_time: null,
    snooze_count: 0,
    wake_feeling: 'refreshed',
    notes_md: null,
    created_at: `${date}T14:05:00.000Z`,
    updated_at: `${date}T14:05:00.000Z`,
  };
}

describe('sleep timeline helpers', () => {
  it('groups entries into current, prior, and older week buckets', () => {
    const sections = buildSleepTimelineSections(
      [
        makeEntry('a', '2026-04-20', 480),
        makeEntry('b', '2026-04-18', 430),
        makeEntry('c', '2026-04-13', 410),
        makeEntry('d', '2026-04-07', 360),
      ],
      new Date(2026, 3, 20, 9, 0, 0, 0),
    );

    expect(sections).toEqual([
      {
        id: '2026-04-20',
        label: 'This Week',
        weekStart: '2026-04-20',
        entries: [makeEntry('a', '2026-04-20', 480)],
      },
      {
        id: '2026-04-13',
        label: 'Last Week',
        weekStart: '2026-04-13',
        entries: [
          makeEntry('b', '2026-04-18', 430),
          makeEntry('c', '2026-04-13', 410),
        ],
      },
      {
        id: '2026-04-06',
        label: 'Week of Apr 6',
        weekStart: '2026-04-06',
        entries: [makeEntry('d', '2026-04-07', 360)],
      },
    ]);
  });

  it('keeps week calculations anchored to the stored calendar date', () => {
    expect(getSleepWeekStart('2026-03-08')).toBe('2026-03-02');
    expect(getSleepWeekStart('2026-03-09')).toBe('2026-03-09');
  });

  it('formats entry metadata for list rows', () => {
    expect(formatSleepEntryDateLabel('2026-03-10')).toBe('Tue, Mar 10');
    expect(renderSleepQualityStars(4)).toBe('★★★★☆');
    expect(getSleepWakeFeelingMeta('energized')).toEqual({
      emoji: '⚡',
      label: 'Energized',
    });
  });

  it('maps duration tones against the target-hours threshold', () => {
    expect(getSleepDurationTone(480, 8)).toBe('success');
    expect(getSleepDurationTone(435, 8)).toBe('warning');
    expect(getSleepDurationTone(350, 8)).toBe('danger');
  });
});
