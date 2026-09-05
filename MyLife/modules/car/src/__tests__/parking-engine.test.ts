import { describe, it, expect } from 'vitest';
import {
  getMeterStatus,
  getMinutesRemaining,
  formatDuration,
  isStaleParking,
  calculateWalkingTime,
  validateCoordinates,
} from '../engines/parking-engine';

describe('getMeterStatus', () => {
  it('returns no_meter when meterExpiresAt is null', () => {
    expect(getMeterStatus(null, '2026-03-22T10:00:00Z')).toBe('no_meter');
  });

  it('returns active when expiration is more than 10 minutes away', () => {
    expect(
      getMeterStatus('2026-03-22T10:30:00Z', '2026-03-22T10:00:00Z'),
    ).toBe('active');
  });

  it('returns expiring_soon when within 10 minutes', () => {
    expect(
      getMeterStatus('2026-03-22T10:08:00Z', '2026-03-22T10:00:00Z'),
    ).toBe('expiring_soon');
  });

  it('returns expiring_soon at exactly 10 minutes', () => {
    expect(
      getMeterStatus('2026-03-22T10:10:00Z', '2026-03-22T10:00:00Z'),
    ).toBe('expiring_soon');
  });

  it('returns expired when past expiration', () => {
    expect(
      getMeterStatus('2026-03-22T09:30:00Z', '2026-03-22T10:00:00Z'),
    ).toBe('expired');
  });

  it('returns expired when exactly at expiration', () => {
    expect(
      getMeterStatus('2026-03-22T10:00:00Z', '2026-03-22T10:00:00Z'),
    ).toBe('expired');
  });
});

describe('getMinutesRemaining', () => {
  it('returns positive minutes when time remains', () => {
    expect(
      getMinutesRemaining('2026-03-22T10:30:00Z', '2026-03-22T10:00:00Z'),
    ).toBe(30);
  });

  it('returns negative minutes when expired', () => {
    expect(
      getMinutesRemaining('2026-03-22T09:45:00Z', '2026-03-22T10:00:00Z'),
    ).toBe(-15);
  });

  it('returns zero when exactly at expiration', () => {
    expect(
      getMinutesRemaining('2026-03-22T10:00:00Z', '2026-03-22T10:00:00Z'),
    ).toBe(0);
  });

  it('rounds to nearest integer', () => {
    // 10:07:30 to 10:00:00 = 7.5 minutes, rounds to 8
    expect(
      getMinutesRemaining('2026-03-22T10:07:30Z', '2026-03-22T10:00:00Z'),
    ).toBe(8);
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes for >= 60 min', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('formats minutes only for < 60 min', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('returns Expired for negative values', () => {
    expect(formatDuration(-5)).toBe('Expired');
  });

  it('formats zero minutes', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats exact hours', () => {
    expect(formatDuration(120)).toBe('2h 0m');
  });
});

describe('isStaleParking', () => {
  it('returns false when within default 24h threshold', () => {
    expect(
      isStaleParking('2026-03-22T08:00:00Z', '2026-03-22T20:00:00Z'),
    ).toBe(false);
  });

  it('returns true when beyond 24h', () => {
    expect(
      isStaleParking('2026-03-20T08:00:00Z', '2026-03-22T10:00:00Z'),
    ).toBe(true);
  });

  it('returns false at exactly 24h (not stale yet)', () => {
    expect(
      isStaleParking('2026-03-21T10:00:00Z', '2026-03-22T10:00:00Z'),
    ).toBe(false);
  });

  it('respects custom maxHours threshold', () => {
    // 4 hours apart, threshold of 2h -> stale
    expect(
      isStaleParking('2026-03-22T06:00:00Z', '2026-03-22T10:00:00Z', 2),
    ).toBe(true);
  });

  it('returns false with custom threshold when within range', () => {
    // 1 hour apart, threshold of 2h -> not stale
    expect(
      isStaleParking('2026-03-22T09:00:00Z', '2026-03-22T10:00:00Z', 2),
    ).toBe(false);
  });
});

describe('calculateWalkingTime', () => {
  it('calculates walking time for a short distance', () => {
    // 100m at 1.4 m/s = 71.4s = 1.19 min -> ceil to 2
    expect(calculateWalkingTime(100)).toBe(2);
  });

  it('calculates walking time for a longer distance', () => {
    // 1000m at 1.4 m/s = 714.3s = 11.9 min -> ceil to 12
    expect(calculateWalkingTime(1000)).toBe(12);
  });

  it('rounds up to next minute', () => {
    // 210m at 1.4 m/s = 150s = 2.5 min -> ceil to 3
    expect(calculateWalkingTime(210)).toBe(3);
  });

  it('respects custom speed', () => {
    // 100m at 2.0 m/s = 50s = 0.833 min -> ceil to 1
    expect(calculateWalkingTime(100, 2.0)).toBe(1);
  });
});

describe('validateCoordinates', () => {
  it('returns true for valid coordinates', () => {
    expect(validateCoordinates(37.7749, -122.4194)).toBe(true);
  });

  it('returns true for boundary values', () => {
    expect(validateCoordinates(90, 180)).toBe(true);
    expect(validateCoordinates(-90, -180)).toBe(true);
  });

  it('returns false for invalid latitude', () => {
    expect(validateCoordinates(91, -122.4194)).toBe(false);
    expect(validateCoordinates(-91, -122.4194)).toBe(false);
  });

  it('returns false for invalid longitude', () => {
    expect(validateCoordinates(37.7749, 181)).toBe(false);
    expect(validateCoordinates(37.7749, -181)).toBe(false);
  });

  it('returns true for zero coordinates', () => {
    expect(validateCoordinates(0, 0)).toBe(true);
  });
});
