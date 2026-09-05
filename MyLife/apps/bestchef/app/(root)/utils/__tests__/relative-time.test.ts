import { describe, expect, it } from 'vitest';
import { relativeTimeParts } from '../relative-time';

const NOW = new Date('2026-07-03T12:00:00.000Z');

describe('relativeTimeParts', () => {
  it('returns isNow under one minute', () => {
    expect(relativeTimeParts('2026-07-03T11:59:30.000Z', NOW)).toEqual({
      value: 0,
      unit: 'second',
      isNow: true,
    });
  });

  it('clamps future timestamps to now instead of going negative', () => {
    expect(relativeTimeParts('2026-07-03T12:05:00.000Z', NOW).isNow).toBe(true);
  });

  it('returns negative minute values for Intl.RelativeTimeFormat', () => {
    expect(relativeTimeParts('2026-07-03T11:15:00.000Z', NOW)).toEqual({
      value: -45,
      unit: 'minute',
      isNow: false,
    });
  });

  it('rolls minutes into hours at 60', () => {
    expect(relativeTimeParts('2026-07-03T09:59:00.000Z', NOW).unit).toBe('hour');
    expect(relativeTimeParts('2026-07-03T09:59:00.000Z', NOW).value).toBe(-2);
  });

  it('rolls hours into days at 24', () => {
    expect(relativeTimeParts('2026-07-01T12:00:00.000Z', NOW)).toEqual({
      value: -2,
      unit: 'day',
      isNow: false,
    });
  });

  it('rolls days into weeks at 7', () => {
    expect(relativeTimeParts('2026-06-24T12:00:00.000Z', NOW).unit).toBe('week');
  });

  it('rolls weeks into months at 5', () => {
    const parts = relativeTimeParts('2026-05-15T12:00:00.000Z', NOW);
    expect(parts.unit).toBe('month');
    expect(parts.value).toBe(-1);
  });

  it('rolls months into years at 12', () => {
    expect(relativeTimeParts('2024-06-01T12:00:00.000Z', NOW)).toEqual({
      value: -2,
      unit: 'year',
      isNow: false,
    });
  });

  it('clamps the month unit at 11 near the year boundary', () => {
    // 362 days ago: floor(362/30) = 12, but "0 years ago" must never render.
    expect(relativeTimeParts('2025-07-06T12:00:00.000Z', NOW)).toEqual({
      value: -11,
      unit: 'month',
      isNow: false,
    });
  });

  it('treats invalid timestamps as now instead of rendering NaN', () => {
    expect(relativeTimeParts('not-a-date', NOW)).toEqual({
      value: 0,
      unit: 'second',
      isNow: true,
    });
  });

  it('accepts Date instances', () => {
    expect(relativeTimeParts(new Date('2026-07-03T11:00:00.000Z'), NOW)).toEqual({
      value: -1,
      unit: 'hour',
      isNow: false,
    });
  });
});
