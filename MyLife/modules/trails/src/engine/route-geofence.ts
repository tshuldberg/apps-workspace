/**
 * Route corridor builder for deviation detection.
 *
 * Takes a set of waypoints (from a previous recording or imported GPX)
 * and builds a dense polyline suitable for accurate distance checks.
 * Uses spatial bucketing for O(1) lookups on long routes.
 */

import type { GeoPoint } from '../types';
import { haversineDistance } from './geo';

const MAX_SEGMENT_METERS = 100;
const BUCKET_SIZE_DEGREES = 0.01; // ~1.1km buckets

/**
 * Build a route geofence from waypoints.
 * Interpolates segments longer than 100m to ensure accurate
 * perpendicular distance calculations.
 */
export function buildRouteGeofence(waypoints: GeoPoint[]): GeoPoint[] {
  if (waypoints.length < 2) return [...waypoints];

  const result: GeoPoint[] = [waypoints[0]];

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const dist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);

    if (dist > MAX_SEGMENT_METERS) {
      // Interpolate intermediate points
      const numSegments = Math.ceil(dist / MAX_SEGMENT_METERS);
      for (let j = 1; j < numSegments; j++) {
        const t = j / numSegments;
        result.push({
          lat: prev.lat + t * (curr.lat - prev.lat),
          lng: prev.lng + t * (curr.lng - prev.lng),
        });
      }
    }
    result.push(curr);
  }

  return result;
}

/**
 * Spatial index for fast nearest-segment queries on long routes.
 * Divides the route into grid buckets so that deviation checks
 * only need to test nearby segments instead of the entire polyline.
 */
export class SpatialRouteIndex {
  private buckets = new Map<string, number[]>();
  private points: GeoPoint[];

  constructor(polyline: GeoPoint[]) {
    this.points = polyline;
    for (let i = 0; i < polyline.length; i++) {
      const key = this.bucketKey(polyline[i]);
      const existing = this.buckets.get(key) ?? [];
      existing.push(i);
      this.buckets.set(key, existing);
    }
  }

  /**
   * Get the indices of points near a given location.
   * Checks the target bucket and all 8 surrounding buckets.
   */
  getNearbyIndices(point: GeoPoint): number[] {
    const latBucket = Math.floor(point.lat / BUCKET_SIZE_DEGREES);
    const lngBucket = Math.floor(point.lng / BUCKET_SIZE_DEGREES);

    const indices = new Set<number>();
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        const key = `${latBucket + dLat}:${lngBucket + dLng}`;
        const bucket = this.buckets.get(key);
        if (bucket) {
          for (const idx of bucket) {
            indices.add(idx);
          }
        }
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Get the polyline points for the nearby segment indices.
   * Returns pairs of consecutive points forming segments.
   */
  getNearbySegments(point: GeoPoint): Array<[GeoPoint, GeoPoint]> {
    const indices = this.getNearbyIndices(point);
    const segments: Array<[GeoPoint, GeoPoint]> = [];
    const seen = new Set<number>();

    for (const idx of indices) {
      // Add segment ending at this point
      if (idx > 0 && !seen.has(idx - 1)) {
        segments.push([this.points[idx - 1], this.points[idx]]);
        seen.add(idx - 1);
      }
      // Add segment starting at this point
      if (idx < this.points.length - 1 && !seen.has(idx)) {
        segments.push([this.points[idx], this.points[idx + 1]]);
        seen.add(idx);
      }
    }

    return segments;
  }

  private bucketKey(point: GeoPoint): string {
    const latBucket = Math.floor(point.lat / BUCKET_SIZE_DEGREES);
    const lngBucket = Math.floor(point.lng / BUCKET_SIZE_DEGREES);
    return `${latBucket}:${lngBucket}`;
  }
}
