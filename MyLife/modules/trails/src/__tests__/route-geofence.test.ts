import { describe, it, expect } from 'vitest';
import { buildRouteGeofence, SpatialRouteIndex } from '../engine/route-geofence';
import type { GeoPoint } from '../types';

describe('buildRouteGeofence', () => {
  it('returns empty array for empty input', () => {
    expect(buildRouteGeofence([])).toEqual([]);
  });

  it('returns single point unchanged', () => {
    const points: GeoPoint[] = [{ lat: 37.77, lng: -122.42 }];
    expect(buildRouteGeofence(points)).toEqual(points);
  });

  it('preserves dense waypoints without modification', () => {
    // Two points ~11m apart (well under 100m threshold)
    const points: GeoPoint[] = [
      { lat: 37.7700, lng: -122.4200 },
      { lat: 37.7701, lng: -122.4200 },
    ];
    const result = buildRouteGeofence(points);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(points[0]);
    expect(result[1]).toEqual(points[1]);
  });

  it('interpolates sparse waypoints (>100m apart)', () => {
    // Two points ~555m apart (0.005 degrees latitude)
    const points: GeoPoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.775, lng: -122.420 },
    ];
    const result = buildRouteGeofence(points);
    // Should have original 2 points + interpolated points
    expect(result.length).toBeGreaterThan(2);
    // First and last should be the originals
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[1]);
    // All intermediate points should be between the originals
    for (const p of result) {
      expect(p.lat).toBeGreaterThanOrEqual(37.770);
      expect(p.lat).toBeLessThanOrEqual(37.775);
    }
  });

  it('preserves order and all original points', () => {
    const points: GeoPoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.775, lng: -122.420 }, // sparse, will be interpolated
      { lat: 37.776, lng: -122.420 }, // dense, no interpolation
    ];
    const result = buildRouteGeofence(points);
    // All original points should appear in order
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[2]);
    // Should include the middle original point
    const hasMiddle = result.some(
      (p) => p.lat === 37.775 && p.lng === -122.420,
    );
    expect(hasMiddle).toBe(true);
  });
});

describe('SpatialRouteIndex', () => {
  it('returns nearby indices for a point on the route', () => {
    const polyline: GeoPoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.771, lng: -122.419 },
      { lat: 37.772, lng: -122.418 },
    ];
    const index = new SpatialRouteIndex(polyline);
    const nearby = index.getNearbyIndices({ lat: 37.771, lng: -122.419 });
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby).toContain(1); // The matching point
  });

  it('returns nearby segments for a point near the route', () => {
    const polyline: GeoPoint[] = [
      { lat: 37.770, lng: -122.420 },
      { lat: 37.771, lng: -122.419 },
      { lat: 37.772, lng: -122.418 },
      { lat: 37.773, lng: -122.417 },
    ];
    const index = new SpatialRouteIndex(polyline);
    const segments = index.getNearbySegments({ lat: 37.7715, lng: -122.4185 });
    expect(segments.length).toBeGreaterThan(0);
    // Each segment should be a pair of consecutive points
    for (const [a, b] of segments) {
      expect(a).toBeDefined();
      expect(b).toBeDefined();
    }
  });

  it('handles large polylines efficiently', () => {
    // 2000-point polyline going north
    const polyline: GeoPoint[] = [];
    for (let i = 0; i < 2000; i++) {
      polyline.push({ lat: 37.0 + i * 0.0001, lng: -122.0 });
    }

    const start = performance.now();
    const index = new SpatialRouteIndex(polyline);
    const buildTime = performance.now() - start;

    const queryStart = performance.now();
    const segments = index.getNearbySegments({ lat: 37.1, lng: -122.0 });
    const queryTime = performance.now() - queryStart;

    expect(buildTime).toBeLessThan(200);
    expect(queryTime).toBeLessThan(50);
    // Should return fewer segments than the full polyline
    expect(segments.length).toBeLessThan(2000);
    expect(segments.length).toBeGreaterThan(0);
  });

  it('returns empty for a point far from the route', () => {
    const polyline: GeoPoint[] = [
      { lat: 37.77, lng: -122.42 },
      { lat: 37.78, lng: -122.41 },
    ];
    const index = new SpatialRouteIndex(polyline);
    // Point very far away (different continent)
    const segments = index.getNearbySegments({ lat: 51.5, lng: 0.0 });
    expect(segments).toHaveLength(0);
  });
});
