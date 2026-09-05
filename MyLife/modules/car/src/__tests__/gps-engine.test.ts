import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  calculateRouteDistance,
  metersToMiles,
  milesToMeters,
  encodePolyline,
  decodePolyline,
  simplifyRoute,
  filterDriftPoints,
} from '../engines/gps-engine';
import type { GpsPoint, TimestampedGpsPoint } from '../engines/gps-engine';

// ---------------------------------------------------------------------------
// haversineDistance
// ---------------------------------------------------------------------------

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    const p: GpsPoint = { lat: 37.7749, lng: -122.4194 };
    expect(haversineDistance(p, p)).toBe(0);
  });

  it('calculates SF to LA distance (~559 km)', () => {
    const sf: GpsPoint = { lat: 37.7749, lng: -122.4194 };
    const la: GpsPoint = { lat: 34.0522, lng: -118.2437 };
    const distKm = haversineDistance(sf, la) / 1000;
    // Should be approximately 559 km
    expect(distKm).toBeGreaterThan(540);
    expect(distKm).toBeLessThan(580);
  });

  it('calculates a short distance accurately', () => {
    // Two points about 1 km apart
    const p1: GpsPoint = { lat: 37.7749, lng: -122.4194 };
    const p2: GpsPoint = { lat: 37.7849, lng: -122.4194 }; // ~1.1 km north
    const dist = haversineDistance(p1, p2);
    expect(dist).toBeGreaterThan(1000);
    expect(dist).toBeLessThan(1200);
  });
});

// ---------------------------------------------------------------------------
// calculateRouteDistance
// ---------------------------------------------------------------------------

describe('calculateRouteDistance', () => {
  it('returns 0 for empty array', () => {
    expect(calculateRouteDistance([])).toBe(0);
  });

  it('returns 0 for single point', () => {
    expect(calculateRouteDistance([{ lat: 37.7749, lng: -122.4194 }])).toBe(0);
  });

  it('sums distances for multiple points', () => {
    const points: GpsPoint[] = [
      { lat: 37.7749, lng: -122.4194 },
      { lat: 37.7849, lng: -122.4194 },
      { lat: 37.7949, lng: -122.4194 },
    ];
    const totalDist = calculateRouteDistance(points);
    const segDist = haversineDistance(points[0], points[1]);
    // Two equal segments, so total should be about 2x one segment
    expect(totalDist).toBeCloseTo(segDist * 2, 0);
  });
});

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------

describe('metersToMiles / milesToMeters', () => {
  it('converts meters to miles', () => {
    // 1 mile = 1609.344 meters
    expect(metersToMiles(1609.344)).toBeCloseTo(1, 5);
  });

  it('converts miles to meters', () => {
    expect(milesToMeters(1)).toBeCloseTo(1609.344, 3);
  });

  it('round-trips correctly', () => {
    const original = 42_195; // marathon in meters
    expect(milesToMeters(metersToMiles(original))).toBeCloseTo(original, 3);
  });
});

// ---------------------------------------------------------------------------
// Polyline encode/decode
// ---------------------------------------------------------------------------

describe('encodePolyline / decodePolyline', () => {
  it('round-trips a single point', () => {
    const points: GpsPoint[] = [{ lat: 38.5, lng: -120.2 }];
    const encoded = encodePolyline(points);
    const decoded = decodePolyline(encoded);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].lat).toBeCloseTo(38.5, 4);
    expect(decoded[0].lng).toBeCloseTo(-120.2, 4);
  });

  it('round-trips multiple points', () => {
    const points: GpsPoint[] = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    const encoded = encodePolyline(points);
    const decoded = decodePolyline(encoded);
    expect(decoded).toHaveLength(3);
    for (let i = 0; i < points.length; i++) {
      expect(decoded[i].lat).toBeCloseTo(points[i].lat, 4);
      expect(decoded[i].lng).toBeCloseTo(points[i].lng, 4);
    }
  });

  it('produces the known Google encoding for a standard test case', () => {
    // Google's example: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
    const points: GpsPoint[] = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    const encoded = encodePolyline(points);
    // The well-known encoded polyline for these points
    expect(encoded).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });
});

// ---------------------------------------------------------------------------
// simplifyRoute
// ---------------------------------------------------------------------------

describe('simplifyRoute', () => {
  it('returns same points for 2 or fewer points', () => {
    const points: GpsPoint[] = [
      { lat: 37.0, lng: -122.0 },
      { lat: 38.0, lng: -122.0 },
    ];
    const simplified = simplifyRoute(points);
    expect(simplified).toHaveLength(2);
  });

  it('preserves endpoints', () => {
    const points: GpsPoint[] = [
      { lat: 37.0, lng: -122.0 },
      { lat: 37.5, lng: -122.0 },
      { lat: 38.0, lng: -122.0 },
    ];
    const simplified = simplifyRoute(points, 1.0); // Very high tolerance
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
  });

  it('reduces collinear points', () => {
    // 10 points in a straight line should reduce to just endpoints
    const points: GpsPoint[] = [];
    for (let i = 0; i < 10; i++) {
      points.push({ lat: 37.0 + i * 0.01, lng: -122.0 });
    }
    const simplified = simplifyRoute(points, 0.0001);
    expect(simplified.length).toBeLessThan(points.length);
    expect(simplified.length).toBe(2); // straight line => only endpoints
  });

  it('keeps points that deviate from the line', () => {
    const points: GpsPoint[] = [
      { lat: 37.0, lng: -122.0 },
      { lat: 37.05, lng: -121.5 }, // Significant deviation
      { lat: 37.1, lng: -122.0 },
    ];
    const simplified = simplifyRoute(points, 0.00005);
    expect(simplified).toHaveLength(3); // deviation too large to remove
  });
});

// ---------------------------------------------------------------------------
// filterDriftPoints
// ---------------------------------------------------------------------------

describe('filterDriftPoints', () => {
  it('returns empty array for empty input', () => {
    expect(filterDriftPoints([])).toEqual([]);
  });

  it('returns single point unchanged', () => {
    const points: TimestampedGpsPoint[] = [
      { lat: 37.0, lng: -122.0, timestamp: 1000 },
    ];
    expect(filterDriftPoints(points)).toHaveLength(1);
  });

  it('keeps points with reasonable speed', () => {
    const now = Date.now();
    const points: TimestampedGpsPoint[] = [
      { lat: 37.7749, lng: -122.4194, timestamp: now },
      // ~1.1 km north, 60 seconds later => ~18 m/s (about 40 mph)
      { lat: 37.7849, lng: -122.4194, timestamp: now + 60_000 },
    ];
    const filtered = filterDriftPoints(points);
    expect(filtered).toHaveLength(2);
  });

  it('removes points that imply impossible speeds', () => {
    const now = Date.now();
    const points: TimestampedGpsPoint[] = [
      { lat: 37.7749, lng: -122.4194, timestamp: now },
      // SF to LA (~559 km) in 1 second => absurdly fast
      { lat: 34.0522, lng: -118.2437, timestamp: now + 1_000 },
      // Back to near SF, 60 seconds later => reasonable
      { lat: 37.7849, lng: -122.4194, timestamp: now + 61_000 },
    ];
    const filtered = filterDriftPoints(points);
    // First point kept, second removed (impossible speed), third kept
    // (distance from first to third over 60s is reasonable)
    expect(filtered).toHaveLength(2);
    expect(filtered[0].lat).toBeCloseTo(37.7749, 4);
    expect(filtered[1].lat).toBeCloseTo(37.7849, 4);
  });
});
