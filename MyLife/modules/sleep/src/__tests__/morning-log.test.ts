import { describe, expect, it } from 'vitest';
import {
  buildMorningLogEntryInput,
  buildMorningLogEntryInputForDate,
  formatDurationLabel,
  getMorningLogDraftFromEntry,
  getMorningLogSummary,
  getMorningLogSummaryForDate,
} from '../engine/morning-log';

describe('morning log helpers', () => {
  it('maps an overnight draft onto the previous night', () => {
    const input = buildMorningLogEntryInput(
      {
        bedtimeTime: '23:15',
        wakeTime: '07:00',
        qualityRating: 4,
        wakeFeeling: 'refreshed',
        wakeCount: 1,
      },
      new Date(2026, 3, 20, 7, 15),
    );

    const bedtime = new Date(input.bedtime);
    const wake = new Date(input.wake_time);

    expect([
      bedtime.getFullYear(),
      bedtime.getMonth(),
      bedtime.getDate(),
      bedtime.getHours(),
      bedtime.getMinutes(),
    ]).toEqual([2026, 3, 19, 23, 15]);
    expect([
      wake.getFullYear(),
      wake.getMonth(),
      wake.getDate(),
      wake.getHours(),
      wake.getMinutes(),
    ]).toEqual([2026, 3, 20, 7, 0]);
  });

  it('shifts wake time back a day when the selected time would be in the future', () => {
    const input = buildMorningLogEntryInput(
      {
        bedtimeTime: '21:45',
        wakeTime: '22:30',
        qualityRating: 3,
        wakeFeeling: 'groggy',
        wakeCount: 0,
      },
      new Date(2026, 3, 20, 7, 15),
    );

    const bedtime = new Date(input.bedtime);
    const wake = new Date(input.wake_time);

    expect([
      bedtime.getFullYear(),
      bedtime.getMonth(),
      bedtime.getDate(),
      bedtime.getHours(),
      bedtime.getMinutes(),
    ]).toEqual([2026, 3, 19, 21, 45]);
    expect([
      wake.getFullYear(),
      wake.getMonth(),
      wake.getDate(),
      wake.getHours(),
      wake.getMinutes(),
    ]).toEqual([2026, 3, 19, 22, 30]);
  });

  it('builds a save summary and trims notes', () => {
    const summary = getMorningLogSummary(
      {
        bedtimeTime: '23:00',
        wakeTime: '06:30',
        qualityRating: 5,
        wakeFeeling: 'energized',
        wakeCount: 0,
        notesMd: '  Slept through the night.  ',
      },
      new Date(2026, 3, 20, 6, 45),
    );

    expect(summary.durationMinutes).toBe(450);
    expect(summary.durationLabel).toBe('7h 30m');
    expect(summary.notesMd).toBe('Slept through the night.');
    expect(summary.wakeFeeling).toBe('energized');
  });

  it('keeps historical edits anchored to the existing wake date', () => {
    const input = buildMorningLogEntryInputForDate(
      {
        bedtimeTime: '23:30',
        wakeTime: '06:45',
        qualityRating: 4,
        wakeFeeling: 'groggy',
        wakeCount: 2,
      },
      '2026-02-14',
    );

    const bedtime = new Date(input.bedtime);
    const wake = new Date(input.wake_time);

    expect([
      bedtime.getFullYear(),
      bedtime.getMonth(),
      bedtime.getDate(),
      bedtime.getHours(),
      bedtime.getMinutes(),
    ]).toEqual([2026, 1, 13, 23, 30]);
    expect([
      wake.getFullYear(),
      wake.getMonth(),
      wake.getDate(),
      wake.getHours(),
      wake.getMinutes(),
    ]).toEqual([2026, 1, 14, 6, 45]);
  });

  it('builds summaries for a fixed wake date', () => {
    const summary = getMorningLogSummaryForDate(
      {
        bedtimeTime: '22:15',
        wakeTime: '06:45',
        qualityRating: 4,
        wakeFeeling: 'refreshed',
        wakeCount: 0,
      },
      '2026-01-11',
    );

    expect(summary.durationMinutes).toBe(510);
    expect(summary.durationLabel).toBe('8h 30m');
  });

  it('requires quality and wake feeling before save', () => {
    expect(() =>
      buildMorningLogEntryInput(
        {
          bedtimeTime: '23:00',
          wakeTime: '06:30',
          qualityRating: null,
          wakeFeeling: 'refreshed',
          wakeCount: 0,
        },
        new Date(2026, 3, 20, 6, 45),
      ),
    ).toThrow(/qualityRating is required/i);

    expect(() =>
      buildMorningLogEntryInput(
        {
          bedtimeTime: '23:00',
          wakeTime: '06:30',
          qualityRating: 4,
          wakeFeeling: null,
          wakeCount: 0,
        },
        new Date(2026, 3, 20, 6, 45),
      ),
    ).toThrow(/wakeFeeling is required/i);
  });

  it('formats short durations cleanly', () => {
    expect(formatDurationLabel(45)).toBe('45m');
    expect(formatDurationLabel(420)).toBe('7h');
  });

  it('derives a draft from an existing saved entry', () => {
    expect(
      getMorningLogDraftFromEntry({
        id: 'entry-1',
        date: '2026-03-18',
        bedtime: '2026-03-17T23:20:00.000Z',
        sleep_onset_time: null,
        wake_time: '2026-03-18T07:10:00.000Z',
        duration_minutes: 470,
        quality_rating: 5,
        wake_count: 1,
        sleep_latency_minutes: null,
        alarm_time: null,
        snooze_count: 0,
        wake_feeling: 'energized',
        notes_md: 'Strong night',
        created_at: '2026-03-18T07:15:00.000Z',
        updated_at: '2026-03-18T07:15:00.000Z',
      }),
    ).toEqual({
      bedtimeTime: '23:20',
      wakeTime: '07:10',
      qualityRating: 5,
      wakeFeeling: 'energized',
      wakeCount: 1,
      notesMd: 'Strong night',
    });
  });
});
