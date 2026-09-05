import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  calculateElevationGain,
  calculatePace,
  formatDuration,
  estimateCalories,
} from '../engine/geo';

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    const d = haversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
    expect(d).toBe(0);
  });

  it('calculates distance between SF and LA (~559 km)', () => {
    const d = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
    // Expected: ~559 km
    expect(d).toBeGreaterThan(550_000);
    expect(d).toBeLessThan(570_000);
  });

  it('calculates a short distance (~111 km for 1 degree latitude)', () => {
    const d = haversineDistance(0, 0, 1, 0);
    // 1 degree of latitude at equator ~111.19 km
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('works across the antimeridian', () => {
    const d = haversineDistance(0, 179, 0, -179);
    // ~222 km at equator
    expect(d).toBeGreaterThan(220_000);
    expect(d).toBeLessThan(225_000);
  });

  it('handles negative latitudes (southern hemisphere)', () => {
    const d = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    // Sydney to Melbourne ~714 km
    expect(d).toBeGreaterThan(700_000);
    expect(d).toBeLessThan(730_000);
  });
});

describe('calculateElevationGain', () => {
  it('returns 0 for empty array', () => {
    expect(calculateElevationGain([])).toBe(0);
  });

  it('returns 0 for single element', () => {
    expect(calculateElevationGain([100])).toBe(0);
  });

  it('returns 0 for flat terrain', () => {
    expect(calculateElevationGain([100, 100, 100])).toBe(0);
  });

  it('sums positive deltas only', () => {
    // 100 -> 200 (+100), 200 -> 150 (ignored), 150 -> 300 (+150)
    expect(calculateElevationGain([100, 200, 150, 300])).toBe(250);
  });

  it('filters noise below 3m threshold', () => {
    // 100 -> 102 (+2, filtered), 102 -> 106 (+4, counted)
    expect(calculateElevationGain([100, 102, 106])).toBe(4);
  });

  it('filters exactly 3m as noise (not counted)', () => {
    expect(calculateElevationGain([100, 103])).toBe(0);
  });

  it('handles descending only terrain', () => {
    expect(calculateElevationGain([300, 200, 100])).toBe(0);
  });

  it('handles realistic undulating terrain', () => {
    // 100 -> 110 (+10), 110 -> 108 (down), 108 -> 120 (+12), 120 -> 115 (down), 115 -> 125 (+10)
    const elevations = [100, 110, 108, 120, 115, 125];
    expect(calculateElevationGain(elevations)).toBe(32);
  });
});

describe('calculatePace', () => {
  it('calculates pace for a 5km run in 30 minutes', () => {
    const pace = calculatePace(5000, 1800);
    expect(pace).toBe(6); // 6 min/km
  });

  it('calculates pace for a 10km hike in 2 hours', () => {
    const pace = calculatePace(10000, 7200);
    expect(pace).toBe(12); // 12 min/km
  });

  it('returns Infinity for zero distance', () => {
    expect(calculatePace(0, 3600)).toBe(Infinity);
  });

  it('returns Infinity for negative distance', () => {
    expect(calculatePace(-100, 3600)).toBe(Infinity);
  });

  it('handles zero duration', () => {
    const pace = calculatePace(5000, 0);
    expect(pace).toBe(0); // 0 minutes / 5 km = 0
  });
});

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats under an hour', () => {
    expect(formatDuration(2700)).toBe('45m');
  });

  it('formats exactly one hour', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(4980)).toBe('1h 23m');
  });

  it('formats multiple hours', () => {
    expect(formatDuration(7800)).toBe('2h 10m');
  });

  it('handles negative seconds as zero', () => {
    expect(formatDuration(-100)).toBe('0m');
  });
});

describe('estimateCalories', () => {
  it('estimates calories for a flat 5km walk (70kg)', () => {
    const cal = estimateCalories(5000, 0, 70);
    // 0.05 * 70 * 5 + 0.1 * 70 * 0 = 17.5 -> 18 (rounded)
    expect(cal).toBe(18);
  });

  it('estimates calories with elevation gain', () => {
    const cal = estimateCalories(10000, 500, 75);
    // 0.05 * 75 * 10 + 0.1 * 75 * 0.5 = 37.5 + 3.75 = 41.25 -> 41
    expect(cal).toBe(41);
  });

  it('returns 0 for zero distance and zero elevation', () => {
    expect(estimateCalories(0, 0, 70)).toBe(0);
  });

  it('increases with weight', () => {
    const light = estimateCalories(5000, 200, 50);
    const heavy = estimateCalories(5000, 200, 100);
    expect(heavy).toBeGreaterThan(light);
  });
});
