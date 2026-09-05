import type { GpsPoint } from '../types';

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return EARTH_RADIUS_M * c;
}

/**
 * Calculate total distance from an array of GPS points.
 * Respects segment boundaries (doesn't measure across pause gaps).
 */
export function calculateTotalDistance(points: GpsPoint[]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    // Don't measure distance across segment boundaries
    if (curr.segment !== prev.segment) continue;
    total += haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  }
  return total;
}

/**
 * Calculate pace in seconds per kilometer.
 * Returns null if distance is 0.
 */
export function calculatePace(distanceMeters: number, durationSeconds: number): number | null {
  if (distanceMeters <= 0) return null;
  const km = distanceMeters / 1000;
  return durationSeconds / km;
}

/**
 * Calculate speed in km/h.
 * Returns null if duration is 0.
 */
export function calculateSpeed(distanceMeters: number, durationSeconds: number): number | null {
  if (durationSeconds <= 0) return null;
  return (distanceMeters / 1000) / (durationSeconds / 3600);
}

/**
 * Calculate elevation gain from GPS points.
 * Only counts positive altitude differences.
 * Applies 5-point moving average to smooth GPS altitude noise.
 */
export function calculateElevationGain(points: GpsPoint[]): { gain: number; loss: number } {
  const altitudes = points
    .filter((p) => p.altitudeMeters != null)
    .map((p) => p.altitudeMeters!);

  if (altitudes.length < 2) return { gain: 0, loss: 0 };

  // Smooth with 5-point moving average
  const smoothed: number[] = [];
  const windowSize = Math.min(5, altitudes.length);
  for (let i = 0; i < altitudes.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(altitudes.length, start + windowSize);
    const window = altitudes.slice(start, end);
    smoothed.push(window.reduce((s, v) => s + v, 0) / window.length);
  }

  let gain = 0;
  let loss = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const diff = smoothed[i] - smoothed[i - 1];
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);
  }

  return { gain: Math.round(gain * 10) / 10, loss: Math.round(loss * 10) / 10 };
}

/**
 * Filter GPS points by accuracy threshold.
 * Removes points with accuracy worse than the threshold.
 */
export function filterByAccuracy(points: GpsPoint[], maxAccuracyMeters = 100): GpsPoint[] {
  return points.filter((p) => p.accuracyMeters == null || p.accuracyMeters <= maxAccuracyMeters);
}

/**
 * Filter out noise: remove points that are less than minDistanceMeters from the previous point.
 */
export function filterNoise(points: GpsPoint[], minDistanceMeters = 3): GpsPoint[] {
  if (points.length === 0) return [];

  const result: GpsPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    // Always keep points at segment boundaries
    if (curr.segment !== prev.segment) {
      result.push(curr);
      continue;
    }
    const dist = haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    if (dist >= minDistanceMeters) {
      result.push(curr);
    }
  }
  return result;
}

/** MET values for calorie estimation by activity type. */
const MET_VALUES: Record<string, number> = {
  run: 10,
  cycle: 8,
  hike: 6,
  walk: 3.5,
  other: 5,
};

/**
 * Estimate calories burned using MET formula.
 * calories = MET * weight_kg * duration_hours
 */
export function estimateCalories(
  activityType: string,
  durationSeconds: number,
  weightKg = 70,
): number {
  const met = MET_VALUES[activityType] ?? MET_VALUES.other;
  const hours = durationSeconds / 3600;
  return Math.round(met * weightKg * hours);
}

/**
 * Downsample a route to approximately maxPoints using Douglas-Peucker-style thinning.
 * Simple implementation: keeps every Nth point to hit the target.
 */
export function downsampleRoute(points: GpsPoint[], maxPoints = 500): GpsPoint[] {
  if (points.length <= maxPoints) return points;

  const step = points.length / maxPoints;
  const result: GpsPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.min(Math.floor(i * step), points.length - 1);
    result.push(points[index]);
  }
  // Always include the last point
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
}

/**
 * Format pace as MM:SS string.
 */
export function formatPace(secPerKm: number): string {
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
