import { describe, it, expect } from 'vitest';
import { detectWaves } from '../waves';
import type { GpsTrackPoint } from '../../types';

// ── Helpers ──

function makePoint(
  index: number,
  overrides?: Partial<GpsTrackPoint>,
): GpsTrackPoint {
  const base: GpsTrackPoint = {
    latitude: 37.75 + index * 0.0001,
    longitude: -122.51 + index * 0.0001,
    timestamp: new Date(Date.UTC(2026, 2, 8, 10, 0, index)).toISOString(),
    speedMps: 0,
    headingDegrees: null,
  };
  return { ...base, ...overrides };
}

describe('detectWaves', () => {
  // ── Empty / degenerate inputs ──

  it('returns empty array for empty input', () => {
    expect(detectWaves([])).toEqual([]);
  });

  it('returns empty array for a single point', () => {
    expect(detectWaves([makePoint(0)])).toEqual([]);
  });

  it('returns 0 waves for stationary points (speed = 0)', () => {
    const points = Array.from({ length: 10 }, (_, i) => makePoint(i, { speedMps: 0 }));
    expect(detectWaves(points)).toHaveLength(0);
  });

  // ── Single wave detection ──

  it('detects a single wave from a speed burst followed by stop', () => {
    const points: GpsTrackPoint[] = [
      // Stationary
      ...Array.from({ length: 3 }, (_, i) =>
        makePoint(i, { speedMps: 0, headingDegrees: 180 }),
      ),
      // Wave ride (fast, with direction change)
      ...Array.from({ length: 6 }, (_, i) =>
        makePoint(3 + i, {
          speedMps: 4, // ~7.8 kts, above 5 kt threshold
          headingDegrees: i < 3 ? 180 : 210, // direction change
        }),
      ),
      // Stationary again
      ...Array.from({ length: 3 }, (_, i) =>
        makePoint(9 + i, { speedMps: 0, headingDegrees: 210 }),
      ),
    ];

    const waves = detectWaves(points);
    expect(waves.length).toBe(1);
    expect(waves[0]!.durationSeconds).toBeGreaterThanOrEqual(3);
    expect(waves[0]!.maxSpeedKts).toBeGreaterThan(5);
  });

  // ── Multiple wave detection ──

  it('detects multiple waves from separate speed bursts', () => {
    const points: GpsTrackPoint[] = [
      // Stationary
      ...Array.from({ length: 3 }, (_, i) =>
        makePoint(i, { speedMps: 0, headingDegrees: 180 }),
      ),
      // Wave 1
      ...Array.from({ length: 6 }, (_, i) =>
        makePoint(3 + i, {
          speedMps: 4,
          headingDegrees: i < 3 ? 180 : 210,
        }),
      ),
      // Paddle back (slow)
      ...Array.from({ length: 5 }, (_, i) =>
        makePoint(9 + i, { speedMps: 0.5, headingDegrees: 0 }),
      ),
      // Wave 2
      ...Array.from({ length: 6 }, (_, i) =>
        makePoint(14 + i, {
          speedMps: 5,
          headingDegrees: i < 3 ? 190 : 220,
        }),
      ),
      // Stationary
      ...Array.from({ length: 3 }, (_, i) =>
        makePoint(20 + i, { speedMps: 0, headingDegrees: 220 }),
      ),
    ];

    const waves = detectWaves(points);
    expect(waves.length).toBe(2);
  });

  // ── Below threshold ──

  it('does not detect waves below speed threshold', () => {
    const points = Array.from({ length: 10 }, (_, i) =>
      makePoint(i, {
        speedMps: 1, // ~1.94 kts, below 5 kt default
        headingDegrees: i < 5 ? 180 : 220,
      }),
    );
    expect(detectWaves(points)).toHaveLength(0);
  });

  it('does not detect waves below duration threshold', () => {
    const points: GpsTrackPoint[] = [
      makePoint(0, { speedMps: 0, headingDegrees: 180 }),
      // Very short burst (1 second)
      makePoint(1, { speedMps: 4, headingDegrees: 180 }),
      makePoint(2, { speedMps: 4, headingDegrees: 220 }),
      makePoint(3, { speedMps: 0, headingDegrees: 220 }),
    ];
    // Duration is only 1 second, below the 3s default
    const waves = detectWaves(points);
    expect(waves.length).toBe(0);
  });

  // ── Custom thresholds ──

  it('respects custom minSpeedKts threshold', () => {
    const points = Array.from({ length: 10 }, (_, i) =>
      makePoint(i, {
        speedMps: 2, // ~3.9 kts
        headingDegrees: i < 5 ? 180 : 220,
      }),
    );
    // Default 5 kts threshold: no waves
    expect(detectWaves(points)).toHaveLength(0);
    // Lower threshold: should detect
    const waves = detectWaves(points, { minSpeedKts: 3 });
    expect(waves.length).toBeGreaterThanOrEqual(1);
  });

  it('respects custom minDurationSeconds', () => {
    const points: GpsTrackPoint[] = [
      makePoint(0, { speedMps: 0, headingDegrees: 180 }),
      ...Array.from({ length: 5 }, (_, i) =>
        makePoint(1 + i, {
          speedMps: 4,
          headingDegrees: i < 2 ? 180 : 210,
        }),
      ),
      makePoint(6, { speedMps: 0, headingDegrees: 210 }),
    ];

    // Default 3s: should detect
    expect(detectWaves(points).length).toBeGreaterThanOrEqual(1);
    // Strict 10s: should not detect (only ~4s of ride)
    expect(detectWaves(points, { minDurationSeconds: 10 })).toHaveLength(0);
  });

  // ── Wave properties ──

  it('computes wave properties correctly', () => {
    const points: GpsTrackPoint[] = [
      makePoint(0, { speedMps: 0, headingDegrees: 180 }),
      ...Array.from({ length: 8 }, (_, i) =>
        makePoint(1 + i, {
          speedMps: 5,
          headingDegrees: i < 4 ? 180 : 215,
        }),
      ),
      makePoint(9, { speedMps: 0, headingDegrees: 215 }),
    ];

    const waves = detectWaves(points);
    expect(waves.length).toBe(1);

    const wave = waves[0]!;
    expect(wave.startTime).toBeTruthy();
    expect(wave.endTime).toBeTruthy();
    expect(wave.durationSeconds).toBeGreaterThan(0);
    expect(wave.maxSpeedKts).toBeGreaterThan(0);
    expect(wave.distanceMeters).toBeGreaterThan(0);
    expect(wave.startIndex).toBeGreaterThanOrEqual(0);
    expect(wave.endIndex).toBeGreaterThan(wave.startIndex);
  });

  // ── Sorting ──

  it('sorts out-of-order timestamps before processing', () => {
    const ordered = [
      makePoint(0, { speedMps: 0, headingDegrees: 180 }),
      ...Array.from({ length: 6 }, (_, i) =>
        makePoint(1 + i, {
          speedMps: 4,
          headingDegrees: i < 3 ? 180 : 210,
        }),
      ),
      makePoint(7, { speedMps: 0, headingDegrees: 210 }),
    ];

    // Shuffle the points
    const shuffled = [...ordered].reverse();
    const waves = detectWaves(shuffled);
    expect(waves.length).toBeGreaterThanOrEqual(1);
  });
});
