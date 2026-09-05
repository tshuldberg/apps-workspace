import { describe, expect, it } from 'vitest';
import { allDayDate, zoneOffsetMs, zonedWallTimeToInstant } from '../timezone';

const HOUR = 3_600_000;

describe('zoneOffsetMs', () => {
  it('returns the EST offset in January and the EDT offset in July', () => {
    expect(zoneOffsetMs(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-5 * HOUR);
    expect(zoneOffsetMs(new Date('2026-07-15T12:00:00Z'), 'America/New_York')).toBe(-4 * HOUR);
  });

  it('handles UTC and east-of-UTC zones', () => {
    expect(zoneOffsetMs(new Date('2026-06-09T12:00:00Z'), 'UTC')).toBe(0);
    expect(zoneOffsetMs(new Date('2026-06-09T12:00:00Z'), 'Asia/Tokyo')).toBe(9 * HOUR);
  });
});

describe('zonedWallTimeToInstant', () => {
  it('maps a winter NYC wall time to the EST instant', () => {
    const instant = zonedWallTimeToInstant('2026-01-15T20:00', 'America/New_York');
    expect(instant.toISOString()).toBe('2026-01-16T01:00:00.000Z');
  });

  it('maps a summer NYC wall time to the EDT instant', () => {
    const instant = zonedWallTimeToInstant('2026-07-04T20:00', 'America/New_York');
    expect(instant.toISOString()).toBe('2026-07-05T00:00:00.000Z');
  });

  it('is independent of the host machine timezone (seconds variant)', () => {
    const instant = zonedWallTimeToInstant('2026-07-04T20:00:30', 'Asia/Tokyo');
    expect(instant.toISOString()).toBe('2026-07-04T11:00:30.000Z');
  });

  it('resolves a nonexistent spring-forward time to a real nearby instant', () => {
    // 2026-03-08 02:30 does not exist in America/New_York (clocks jump 2->3).
    const instant = zonedWallTimeToInstant('2026-03-08T02:30', 'America/New_York');
    const candidates = ['2026-03-08T06:30:00.000Z', '2026-03-08T07:30:00.000Z'];
    expect(candidates).toContain(instant.toISOString());
  });

  it('falls back to naive parsing for malformed input', () => {
    const instant = zonedWallTimeToInstant('garbage', 'America/New_York');
    expect(Number.isNaN(instant.getTime())).toBe(true);
  });
});

describe('allDayDate', () => {
  it('anchors the calendar date at local noon so the day never shifts', () => {
    const date = allDayDate('2026-06-15T00:00');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(12);
  });

  it('accepts bare dates', () => {
    const date = allDayDate('2026-12-31');
    expect(date.getDate()).toBe(31);
    expect(date.getMonth()).toBe(11);
  });
});
