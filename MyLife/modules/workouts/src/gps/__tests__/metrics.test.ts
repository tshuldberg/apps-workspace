import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  calculateTotalDistance,
  calculatePace,
  calculateSpeed,
  calculateElevationGain,
  filterByAccuracy,
  filterNoise,
  estimateCalories,
  downsampleRoute,
  formatPace,
} from '../metrics';
import type { GpsPoint } from '../../types';

function makePoint(overrides: Partial<GpsPoint> = {}): GpsPoint {
  return {
    id: 1,
    routeId: 'route-1',
    latitude: 37.7749,
    longitude: -122.4194,
    altitudeMeters: 10,
    speedMps: 3.0,
    accuracyMeters: 5,
    timestampMs: Date.now(),
    segment: 0,
    ...overrides,
  };
}

describe('haversineDistance', () => {
  it('returns ~111 km for 0,0 to 0,1 degree longitude at equator', () => {
    const d = haversineDistance(0, 0, 0, 1);
    // Haversine at equator: ~111.195 km per degree
    expect(d / 1000).toBeCloseTo(111.2, 0);
  });

  it('returns 0 for same point', () => {
    expect(haversineDistance(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
  });

  it('calculates SF to LA approximately correctly', () => {
    // SF: 37.7749, -122.4194; LA: 34.0522, -118.2437
    const d = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
    // Should be ~559 km
    expect(d / 1000).toBeCloseTo(559, -1);
  });
});

describe('calculateTotalDistance', () => {
  it('sums sequential point distances', () => {
    const points: GpsPoint[] = [
      makePoint({ latitude: 0, longitude: 0 }),
      makePoint({ latitude: 0, longitude: 0.001 }),
      makePoint({ latitude: 0, longitude: 0.002 }),
    ];
    const d = calculateTotalDistance(points);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(250);
  });

  it('returns 0 for single point', () => {
    expect(calculateTotalDistance([makePoint()])).toBe(0);
  });

  it('respects segment boundaries', () => {
    const points: GpsPoint[] = [
      makePoint({ latitude: 0, longitude: 0, segment: 0 }),
      makePoint({ latitude: 0, longitude: 0.001, segment: 0 }),
      makePoint({ latitude: 0, longitude: 0.010, segment: 1 }), // gap
      makePoint({ latitude: 0, longitude: 0.011, segment: 1 }),
    ];
    const d = calculateTotalDistance(points);
    // Should only count within segments, not across the gap
    expect(d).toBeLessThan(250);
  });
});

describe('calculatePace', () => {
  it('calculates 5:00/km for 5000m in 1500s', () => {
    const pace = calculatePace(5000, 1500);
    expect(pace).toBe(300); // 300 sec/km = 5:00
  });

  it('returns null for zero distance', () => {
    expect(calculatePace(0, 1000)).toBeNull();
  });
});

describe('calculateSpeed', () => {
  it('calculates 20 km/h for 10000m in 1800s', () => {
    const speed = calculateSpeed(10000, 1800);
    expect(speed).toBeCloseTo(20, 1);
  });

  it('returns null for zero duration', () => {
    expect(calculateSpeed(1000, 0)).toBeNull();
  });
});

describe('calculateElevationGain', () => {
  it('only counts positive altitude differences', () => {
    // Use enough points to survive the 5-point moving average smoothing
    const points: GpsPoint[] = [
      makePoint({ altitudeMeters: 10 }),
      makePoint({ altitudeMeters: 15 }),
      makePoint({ altitudeMeters: 20 }),
      makePoint({ altitudeMeters: 30 }),
      makePoint({ altitudeMeters: 40 }),
      makePoint({ altitudeMeters: 35 }),
      makePoint({ altitudeMeters: 25 }),
      makePoint({ altitudeMeters: 20 }),
      makePoint({ altitudeMeters: 30 }),
      makePoint({ altitudeMeters: 40 }),
    ];
    const { gain, loss } = calculateElevationGain(points);
    expect(gain).toBeGreaterThan(0);
    expect(loss).toBeGreaterThan(0);
  });

  it('handles null altitudes', () => {
    const points: GpsPoint[] = [
      makePoint({ altitudeMeters: null }),
      makePoint({ altitudeMeters: 10 }),
      makePoint({ altitudeMeters: null }),
    ];
    const { gain } = calculateElevationGain(points);
    expect(gain).toBe(0); // only 1 altitude point after filtering
  });
});

describe('filterByAccuracy', () => {
  it('removes points with accuracy > threshold', () => {
    const points: GpsPoint[] = [
      makePoint({ accuracyMeters: 5 }),
      makePoint({ accuracyMeters: 150 }),
      makePoint({ accuracyMeters: 10 }),
    ];
    const filtered = filterByAccuracy(points, 100);
    expect(filtered.length).toBe(2);
  });

  it('keeps points with null accuracy', () => {
    const points = [makePoint({ accuracyMeters: null })];
    expect(filterByAccuracy(points, 100).length).toBe(1);
  });
});

describe('filterNoise', () => {
  it('removes points <3m from previous', () => {
    const points: GpsPoint[] = [
      makePoint({ latitude: 0, longitude: 0 }),
      makePoint({ latitude: 0, longitude: 0.000001 }), // ~0.1m - noise
      makePoint({ latitude: 0, longitude: 0.001 }),     // ~111m - real movement
    ];
    const filtered = filterNoise(points, 3);
    expect(filtered.length).toBe(2);
  });
});

describe('estimateCalories', () => {
  it('estimates running calories for 5km in 25 min', () => {
    // MET 10 * 70 kg * (1500/3600) hours = ~291.67
    const cal = estimateCalories('run', 1500, 70);
    expect(cal).toBeCloseTo(292, 0);
  });
});

describe('downsampleRoute', () => {
  it('does not downsample if under max', () => {
    const points = Array.from({ length: 100 }, (_, i) => makePoint({ id: i }));
    expect(downsampleRoute(points, 500).length).toBe(100);
  });

  it('reduces 1000 points to ~500', () => {
    const points = Array.from({ length: 1000 }, (_, i) => makePoint({ id: i }));
    const result = downsampleRoute(points, 500);
    expect(result.length).toBeLessThanOrEqual(501);
    expect(result.length).toBeGreaterThanOrEqual(500);
  });
});

describe('formatPace', () => {
  it('formats 300 sec/km as 5:00', () => {
    expect(formatPace(300)).toBe('5:00');
  });

  it('formats 330 sec/km as 5:30', () => {
    expect(formatPace(330)).toBe('5:30');
  });
});
