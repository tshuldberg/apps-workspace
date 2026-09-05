/**
 * Deviation detection engine for wrong-turn alerts.
 *
 * Core algorithms:
 * - Point-to-polyline distance (perpendicular to segments, not just vertices)
 * - Effective threshold adjustment for GPS accuracy
 * - State machine for alert lifecycle: NORMAL -> DEVIATED -> RETURNING -> NORMAL
 */

import type { GeoPoint, DeviationResult, DeviationState } from '../types';
import { haversineDistance } from './geo';

/**
 * Calculate the minimum distance from a point to a polyline.
 * Checks perpendicular distance to each segment, not just vertex distance.
 * Returns the distance and the nearest point on the polyline.
 */
export function deviationDistance(
  point: GeoPoint,
  polyline: GeoPoint[],
): DeviationResult {
  if (polyline.length === 0) {
    return { distance: Infinity, nearestPoint: point };
  }
  if (polyline.length === 1) {
    const d = haversineDistance(point.lat, point.lng, polyline[0].lat, polyline[0].lng);
    return { distance: d, nearestPoint: polyline[0] };
  }

  let minDist = Infinity;
  let nearest: GeoPoint = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const { distance, closest } = pointToSegmentDistance(point, polyline[i], polyline[i + 1]);
    if (distance < minDist) {
      minDist = distance;
      nearest = closest;
    }
  }

  return { distance: minDist, nearestPoint: nearest };
}

/**
 * Calculate the perpendicular distance from a point to a line segment (A-B).
 * Projects the point onto the segment and returns the closest point.
 *
 * Uses a flat-earth approximation for the projection (valid for short segments <100m)
 * then haversine for the final distance calculation.
 */
function pointToSegmentDistance(
  p: GeoPoint,
  a: GeoPoint,
  b: GeoPoint,
): { distance: number; closest: GeoPoint } {
  // Use equirectangular projection for the projection calculation
  const cosLat = Math.cos((a.lat * Math.PI) / 180);

  const ax = a.lng * cosLat;
  const ay = a.lat;
  const bx = b.lng * cosLat;
  const by = b.lat;
  const px = p.lng * cosLat;
  const py = p.lat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t: number;
  if (lenSq === 0) {
    // Segment is a single point
    t = 0;
  } else {
    t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }

  const closest: GeoPoint = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };

  const distance = haversineDistance(p.lat, p.lng, closest.lat, closest.lng);
  return { distance, closest };
}

/**
 * Calculate the effective deviation threshold, accounting for GPS accuracy.
 * If GPS accuracy exceeds 50% of the base threshold, the effective threshold
 * is increased to reduce false positives.
 */
export function effectiveThreshold(
  baseThresholdMeters: number,
  gpsAccuracyMeters: number,
): number {
  if (gpsAccuracyMeters > baseThresholdMeters * 0.5) {
    return baseThresholdMeters + (gpsAccuracyMeters - baseThresholdMeters * 0.5);
  }
  return baseThresholdMeters;
}

/**
 * State machine for managing deviation alert lifecycle.
 *
 * Transitions:
 *   NORMAL   -> DEVIATED   (distance > threshold, fires alert)
 *   DEVIATED -> NORMAL     (distance < threshold, dismisses alert)
 *   NORMAL   -> MUTED      (user mutes)
 *   DEVIATED -> MUTED      (user mutes)
 *
 * The cooldown prevents rapid re-alerting when the user oscillates
 * near the threshold boundary.
 */
export class DeviationStateMachine {
  private _state: DeviationState = 'normal';
  private lastAlertTime = 0;
  private cooldownMs: number;
  private threshold: number;

  constructor(thresholdMeters: number, cooldownSeconds: number) {
    this.threshold = thresholdMeters;
    this.cooldownMs = cooldownSeconds * 1000;
  }

  get state(): DeviationState {
    return this._state;
  }

  /**
   * Update the state machine with a new distance reading.
   * Returns true if an alert should be fired (transition to DEVIATED).
   */
  update(distanceMeters: number, gpsAccuracyMeters: number = 0): boolean {
    if (this._state === 'muted') return false;

    const effectiveThresh = effectiveThreshold(this.threshold, gpsAccuracyMeters);

    if (distanceMeters > effectiveThresh) {
      if (this._state === 'normal') {
        const now = Date.now();
        if (now - this.lastAlertTime >= this.cooldownMs) {
          this._state = 'deviated';
          this.lastAlertTime = now;
          return true; // Fire alert
        }
      }
      // Already deviated, stay deviated (no new alert)
      return false;
    }

    // Within threshold
    if (this._state === 'deviated' || this._state === 'returning') {
      this._state = 'normal';
    }
    return false;
  }

  /**
   * Mute alerts for the remainder of the current recording.
   */
  mute(): void {
    this._state = 'muted';
  }

  /**
   * Reset the state machine (for a new recording).
   */
  reset(): void {
    this._state = 'normal';
    this.lastAlertTime = 0;
  }
}
