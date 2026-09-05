import { describe, it, expect } from 'vitest';
import {
  computeTrackDistanceMeters,
  computeElevationGainLoss,
  computeDurationSeconds,
  computePaceMinutesPerKm,
  summarizeTrail,
} from '../trails';
import type { TrailTrackPoint } from '../../types';

// ── Helpers ──

function makeTrailPoint(overrides: Partial<TrailTrackPoint> & { latitude: number; longitude: number }): TrailTrackPoint {
  return {
    timestamp: '2026-03-08T10:00:00Z',
    ...overrides,
  };
}

describe('computeTrackDistanceMeters', () => {
  it('returns 0 for empty array', () => {
    expect(computeTrackDistanceMeters([])).toBe(0);
  });

  it('returns 0 for a single point', () => {
    const points = [makeTrailPoint({ latitude: 37.75, longitude: -122.51 })];
    expect(computeTrackDistanceMeters(points)).toBe(0);
  });

  it('computes distance between two points using haversine', () => {
    const points: TrailTrackPoint[] = [
      makeTrailPoint({ latitude: 37.75, longitude: -122.51 }),
      makeTrailPoint({ latitude: 37.76, longitude: -122.51 }),
    ];
    const dist = computeTrackDistanceMeters(points);
    // 0.01 degree latitude ~ 1.1 km = 1100 meters
    expect(dist).toBeGreaterThan(1000);
    expect(dist).toBeLessThan(1200);
  });

  it('sums distances across multiple segments', () => {
    const points: TrailTrackPoint[] = [
      makeTrailPoint({ latitude: 37.75, longitude: -122.51 }),
      makeTrailPoint({ latitude: 37.76, longitude: -122.51 }),
      makeTrailPoint({ latitude: 37.77, longitude: -122.51 }),
    ];
    const dist = computeTrackDistanceMeters(points);
    // Two segments of ~1100m each
    expect(dist).toBeGreaterThan(2000);
    expect(dist).toBeLessThan(2400);
  });
});

describe('computeElevationGainLoss', () => {
  it('returns 0 gain and 0 loss for empty array', () => {
    const result = computeElevationGainLoss([]);
    expect(result.gainMeters).toBe(0);
    expect(result.lossMeters).toBe(0);
  });

  it('counts only positive changes as gain', () => {
    const points: TrailTrackPoint[] = [
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 100 }),
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 150 }),
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 200 }),
    ];
    const result = computeElevationGainLoss(points);
    expect(result.gainMeters).toBe(100);
    expect(result.lossMeters).toBe(0);
  });

  it('counts only negative changes as loss', () => {
    const points: TrailTrackPoint[] = [
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 200 }),
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 150 }),
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 100 }),
    ];
    const result = computeElevationGainLoss(points);
    expect(result.gainMeters).toBe(0);
    expect(result.lossMeters).toBe(100);
  });

  it('tracks both gain and loss in a mixed profile', () => {
    const points: TrailTrackPoint[] = [
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 100 }),
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 200 }), // +100
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 150 }), // -50
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 300 }), // +150
    ];
    const result = computeElevationGainLoss(points);
    expect(result.gainMeters).toBe(250); // 100 + 150
    expect(result.lossMeters).toBe(50);
  });

  it('skips points with null elevation', () => {
    const points: TrailTrackPoint[] = [
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 100 }),
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: null }),
      makeTrailPoint({ latitude: 0, longitude: 0, elevationMeters: 200 }),
    ];
    const result = computeElevationGainLoss(points);
    // Skip null -> next valid is 200 vs 100 = +100
    // But the intermediate null point means both comparisons with it are skipped
    expect(result.gainMeters).toBe(0); // null-100 skipped, 200-null skipped
    expect(result.lossMeters).toBe(0);
  });
});

describe('computeDurationSeconds', () => {
  it('returns 0 for empty array', () => {
    expect(computeDurationSeconds([])).toBe(0);
  });

  it('returns 0 for a single point', () => {
    const points = [makeTrailPoint({ latitude: 0, longitude: 0, timestamp: '2026-03-08T10:00:00Z' })];
    expect(computeDurationSeconds(points)).toBe(0);
  });

  it('computes duration between first and last points', () => {
    const points: TrailTrackPoint[] = [
      makeTrailPoint({ latitude: 0, longitude: 0, timestamp: '2026-03-08T10:00:00Z' }),
      makeTrailPoint({ latitude: 0, longitude: 0, timestamp: '2026-03-08T10:05:00Z' }),
      makeTrailPoint({ latitude: 0, longitude: 0, timestamp: '2026-03-08T10:30:00Z' }),
    ];
    expect(computeDurationSeconds(points)).toBe(1800); // 30 minutes
  });
});

describe('computePaceMinutesPerKm', () => {
  it('returns 0 for zero distance', () => {
    expect(computePaceMinutesPerKm(0, 3600)).toBe(0);
  });

  it('returns 0 for zero duration', () => {
    expect(computePaceMinutesPerKm(1000, 0)).toBe(0);
  });

  it('computes correct pace: 1 km in 6 minutes = 6 min/km', () => {
    expect(computePaceMinutesPerKm(1000, 360)).toBe(6);
  });

  it('computes correct pace: 5 km in 30 minutes = 6 min/km', () => {
    expect(computePaceMinutesPerKm(5000, 1800)).toBe(6);
  });
});

describe('summarizeTrail', () => {
  it('returns zero summary for empty points', () => {
    const summary = summarizeTrail([]);
    expect(summary.distanceMeters).toBe(0);
    expect(summary.durationSeconds).toBe(0);
    expect(summary.elevationGainMeters).toBe(0);
    expect(summary.elevationLossMeters).toBe(0);
    expect(summary.paceMinutesPerKm).toBe(0);
  });

  it('combines all metrics into a single summary', () => {
    const points: TrailTrackPoint[] = [
      makeTrailPoint({
        latitude: 37.75,
        longitude: -122.51,
        elevationMeters: 10,
        timestamp: '2026-03-08T10:00:00Z',
      }),
      makeTrailPoint({
        latitude: 37.76,
        longitude: -122.51,
        elevationMeters: 50,
        timestamp: '2026-03-08T10:10:00Z',
      }),
      makeTrailPoint({
        latitude: 37.77,
        longitude: -122.51,
        elevationMeters: 30,
        timestamp: '2026-03-08T10:20:00Z',
      }),
    ];

    const summary = summarizeTrail(points);
    expect(summary.distanceMeters).toBeGreaterThan(0);
    expect(summary.durationSeconds).toBe(1200); // 20 minutes
    expect(summary.elevationGainMeters).toBeGreaterThan(0);
    expect(summary.elevationLossMeters).toBeGreaterThan(0);
    expect(summary.paceMinutesPerKm).toBeGreaterThan(0);
  });

  it('rounds values for clean output', () => {
    const points: TrailTrackPoint[] = [
      makeTrailPoint({
        latitude: 37.75,
        longitude: -122.51,
        elevationMeters: 10,
        timestamp: '2026-03-08T10:00:00Z',
      }),
      makeTrailPoint({
        latitude: 37.76,
        longitude: -122.51,
        elevationMeters: 50,
        timestamp: '2026-03-08T10:10:00Z',
      }),
    ];

    const summary = summarizeTrail(points);
    // distanceMeters rounded to 1 decimal
    expect(summary.distanceMeters).toBe(Math.round(summary.distanceMeters * 10) / 10);
    // durationSeconds rounded to integer
    expect(summary.durationSeconds).toBe(Math.round(summary.durationSeconds));
    // elevationGainMeters rounded to 1 decimal
    expect(summary.elevationGainMeters).toBe(Math.round(summary.elevationGainMeters * 10) / 10);
  });
});
