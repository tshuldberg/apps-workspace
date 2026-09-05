import { describe, expect, it } from 'vitest';
import {
  dateToPlanString,
  formatPlanLabel,
  planStringToDate,
  roundToNextHalfHour,
} from '../datetime';

describe('planStringToDate', () => {
  it('parses the canonical plan format as local wall time', () => {
    const d = planStringToDate('2026-07-04T20:00');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6);
    expect(d!.getDate()).toBe(4);
    expect(d!.getHours()).toBe(20);
    expect(d!.getMinutes()).toBe(0);
  });

  it('rejects malformed and rolled-over values', () => {
    expect(planStringToDate('')).toBeNull();
    expect(planStringToDate('tonight 8pm')).toBeNull();
    expect(planStringToDate('2026-07-04')).toBeNull();
    expect(planStringToDate('2026-13-04T20:00')).toBeNull();
    expect(planStringToDate('2026-02-30T20:00')).toBeNull();
    expect(planStringToDate('2026-07-04T24:30')).toBeNull();
  });

  it('round-trips through dateToPlanString', () => {
    const value = '2026-12-31T09:05';
    expect(dateToPlanString(planStringToDate(value)!)).toBe(value);
  });
});

describe('formatPlanLabel', () => {
  it('returns a human label for valid values and null otherwise', () => {
    expect(formatPlanLabel('2026-07-04T20:00')).toMatch(/Jul/);
    expect(formatPlanLabel('not a date')).toBeNull();
  });
});

describe('roundToNextHalfHour', () => {
  it('rounds up to the next half-hour boundary', () => {
    const base = new Date(2026, 5, 9, 18, 12);
    const rounded = roundToNextHalfHour(base);
    expect(rounded.getHours()).toBe(18);
    expect(rounded.getMinutes()).toBe(30);
    expect(rounded.getSeconds()).toBe(0);
  });

  it('rolls to the next hour when past the half-hour', () => {
    const base = new Date(2026, 5, 9, 18, 45);
    const rounded = roundToNextHalfHour(base);
    expect(rounded.getHours()).toBe(19);
    expect(rounded.getMinutes()).toBe(0);
  });

  it('keeps exact boundaries as-is', () => {
    const base = new Date(2026, 5, 9, 18, 30, 0, 0);
    expect(roundToNextHalfHour(base).getTime()).toBe(base.getTime());
  });
});
