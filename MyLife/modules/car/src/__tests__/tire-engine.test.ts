import { describe, it, expect } from 'vitest';
import {
  getTireHealth,
  getPositionHealth,
  calculateWearRate,
  predictReplacementMiles,
  getRecommendedRotationOdometer,
  getTireCostPerMile,
} from '../engines/tire-engine';
import type { TireMeasurement } from '../types';

// ---------------------------------------------------------------------------
// Helper to build TireMeasurement test fixtures
// ---------------------------------------------------------------------------

function makeMeasurement(overrides: Partial<TireMeasurement> & { position: string; treadDepth32nds: number }): TireMeasurement {
  return {
    id: 'm-1',
    tireSetId: 'ts-1',
    measuredAt: '2025-06-01T00:00:00Z',
    odometerAt: null,
    notes: null,
    createdAt: '2025-06-01T00:00:00Z',
    ...overrides,
  } as TireMeasurement;
}

// ---------------------------------------------------------------------------
// getTireHealth
// ---------------------------------------------------------------------------

describe('getTireHealth', () => {
  it('returns "replace" for depth <= 2', () => {
    expect(getTireHealth(2)).toBe('replace');
    expect(getTireHealth(1)).toBe('replace');
    expect(getTireHealth(0)).toBe('replace');
  });

  it('returns "low" for depth 3-4', () => {
    expect(getTireHealth(3)).toBe('low');
    expect(getTireHealth(4)).toBe('low');
  });

  it('returns "fair" for depth 5-6', () => {
    expect(getTireHealth(5)).toBe('fair');
    expect(getTireHealth(6)).toBe('fair');
  });

  it('returns "good" for depth > 6', () => {
    expect(getTireHealth(7)).toBe('good');
    expect(getTireHealth(10)).toBe('good');
    expect(getTireHealth(32)).toBe('good');
  });
});

// ---------------------------------------------------------------------------
// getPositionHealth
// ---------------------------------------------------------------------------

describe('getPositionHealth', () => {
  it('returns latest measurement per position', () => {
    const measurements: TireMeasurement[] = [
      makeMeasurement({ id: 'm-1', position: 'FL', treadDepth32nds: 8, measuredAt: '2025-01-01T00:00:00Z' }),
      makeMeasurement({ id: 'm-2', position: 'FL', treadDepth32nds: 5, measuredAt: '2025-06-01T00:00:00Z' }),
      makeMeasurement({ id: 'm-3', position: 'FR', treadDepth32nds: 7, measuredAt: '2025-06-01T00:00:00Z' }),
    ];
    const result = getPositionHealth(measurements);
    expect(result).toHaveLength(2);

    const fl = result.find((r) => r.position === 'FL');
    expect(fl?.treadDepth32nds).toBe(5);
    expect(fl?.health).toBe('fair');

    const fr = result.find((r) => r.position === 'FR');
    expect(fr?.treadDepth32nds).toBe(7);
    expect(fr?.health).toBe('good');
  });

  it('handles all positions', () => {
    const measurements: TireMeasurement[] = [
      makeMeasurement({ id: 'm-1', position: 'FL', treadDepth32nds: 10 }),
      makeMeasurement({ id: 'm-2', position: 'FR', treadDepth32nds: 9 }),
      makeMeasurement({ id: 'm-3', position: 'RL', treadDepth32nds: 4 }),
      makeMeasurement({ id: 'm-4', position: 'RR', treadDepth32nds: 2 }),
      makeMeasurement({ id: 'm-5', position: 'spare', treadDepth32nds: 11 }),
    ];
    const result = getPositionHealth(measurements);
    expect(result).toHaveLength(5);
    // Verify sorted order: FL, FR, RL, RR, spare
    expect(result.map((r) => r.position)).toEqual(['FL', 'FR', 'RL', 'RR', 'spare']);
  });
});

// ---------------------------------------------------------------------------
// calculateWearRate
// ---------------------------------------------------------------------------

describe('calculateWearRate', () => {
  it('returns 0 with insufficient data (0 or 1 measurement)', () => {
    expect(calculateWearRate([]).rate32ndsPerThousandMiles).toBe(0);
    expect(calculateWearRate([]).dataPoints).toBe(0);

    const single = [
      makeMeasurement({ position: 'FL', treadDepth32nds: 10, odometerAt: 30000 }),
    ];
    expect(calculateWearRate(single).rate32ndsPerThousandMiles).toBe(0);
    expect(calculateWearRate(single).dataPoints).toBe(1);
  });

  it('returns 0 when measurements have no odometer data', () => {
    const measurements = [
      makeMeasurement({ id: 'm-1', position: 'FL', treadDepth32nds: 10, odometerAt: null }),
      makeMeasurement({ id: 'm-2', position: 'FL', treadDepth32nds: 8, odometerAt: null }),
    ];
    expect(calculateWearRate(measurements).rate32ndsPerThousandMiles).toBe(0);
  });

  it('calculates wear rate with 2 data points', () => {
    const measurements: TireMeasurement[] = [
      makeMeasurement({ id: 'm-1', position: 'FL', treadDepth32nds: 10, odometerAt: 30000 }),
      makeMeasurement({ id: 'm-2', position: 'FL', treadDepth32nds: 8, odometerAt: 40000 }),
    ];
    const result = calculateWearRate(measurements);
    // Lost 2/32 over 10000 miles => 0.2 per 1000 miles
    expect(result.rate32ndsPerThousandMiles).toBeCloseTo(0.2, 1);
    expect(result.dataPoints).toBe(2);
  });

  it('handles multiple data points with linear regression', () => {
    const measurements: TireMeasurement[] = [
      makeMeasurement({ id: 'm-1', position: 'FL', treadDepth32nds: 10, odometerAt: 30000 }),
      makeMeasurement({ id: 'm-2', position: 'FL', treadDepth32nds: 9, odometerAt: 35000 }),
      makeMeasurement({ id: 'm-3', position: 'FL', treadDepth32nds: 8, odometerAt: 40000 }),
    ];
    const result = calculateWearRate(measurements);
    // Linear: 2/32 over 10000 miles => 0.2 per 1000
    expect(result.rate32ndsPerThousandMiles).toBeCloseTo(0.2, 1);
    expect(result.dataPoints).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// predictReplacementMiles
// ---------------------------------------------------------------------------

describe('predictReplacementMiles', () => {
  it('returns 0 if already at or below replacement threshold', () => {
    expect(predictReplacementMiles(2, 0.5)).toBe(0);
    expect(predictReplacementMiles(1, 0.5)).toBe(0);
  });

  it('returns 0 if wear rate is 0', () => {
    expect(predictReplacementMiles(8, 0)).toBe(0);
  });

  it('predicts miles to replacement', () => {
    // 8/32 current, 0.2/32 per 1000 miles => 6/32 remaining / 0.2 * 1000 = 30000 miles
    expect(predictReplacementMiles(8, 0.2)).toBe(30000);
  });

  it('predicts correctly at boundary', () => {
    // 3/32 current, 1/32 per 1000 miles => 1/32 remaining / 1 * 1000 = 1000 miles
    expect(predictReplacementMiles(3, 1)).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// getRecommendedRotationOdometer
// ---------------------------------------------------------------------------

describe('getRecommendedRotationOdometer', () => {
  it('returns null when no last rotation', () => {
    expect(getRecommendedRotationOdometer(null)).toBeNull();
  });

  it('adds default interval (7500) to last rotation', () => {
    expect(getRecommendedRotationOdometer(30000)).toBe(37500);
  });

  it('uses custom interval', () => {
    expect(getRecommendedRotationOdometer(30000, 5000)).toBe(35000);
  });
});

// ---------------------------------------------------------------------------
// getTireCostPerMile
// ---------------------------------------------------------------------------

describe('getTireCostPerMile', () => {
  it('returns 0 if no distance driven', () => {
    expect(getTireCostPerMile(80000, 30000, 30000)).toBe(0);
  });

  it('returns 0 if current odometer is less than purchase', () => {
    expect(getTireCostPerMile(80000, 30000, 29000)).toBe(0);
  });

  it('calculates cost per mile in cents', () => {
    // $800 (80000 cents) over 40000 miles => 2 cents/mile
    const result = getTireCostPerMile(80000, 10000, 50000);
    expect(result).toBe(2);
  });

  it('handles fractional cents', () => {
    // $500 (50000 cents) over 30000 miles => 1.6667 cents/mile
    const result = getTireCostPerMile(50000, 10000, 40000);
    expect(result).toBeCloseTo(1.67, 1);
  });
});
