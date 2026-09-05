// Pure segment matching engine for detecting when a user enters/exits a trail segment.

import type { GeoPoint, Segment } from '../types';
import { haversineDistance } from './geo';

const DEFAULT_RADIUS_METERS = 30;

/**
 * Check if a point is within a given radius of a target point.
 */
export function isWithinRadius(
  point: GeoPoint,
  target: GeoPoint,
  radiusMeters: number,
): boolean {
  const dist = haversineDistance(point.lat, point.lng, target.lat, target.lng);
  return dist <= radiusMeters;
}

/**
 * Check if the current position is near the start of any segment.
 * Returns the matched segment or null.
 */
export function matchSegmentEntry(
  position: GeoPoint,
  segments: Segment[],
): Segment | null {
  for (const segment of segments) {
    const start: GeoPoint = { lat: segment.startLat, lng: segment.startLng };
    if (isWithinRadius(position, start, DEFAULT_RADIUS_METERS)) {
      return segment;
    }
  }
  return null;
}

/**
 * Check if the current position is near the end of a specific segment.
 */
export function matchSegmentExit(
  position: GeoPoint,
  segment: Segment,
): boolean {
  const end: GeoPoint = { lat: segment.endLat, lng: segment.endLng };
  return isWithinRadius(position, end, DEFAULT_RADIUS_METERS);
}
