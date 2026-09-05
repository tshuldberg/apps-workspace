// Pure geo-computation functions for trail recording and analysis.

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two points using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate total elevation gain from a series of elevation samples.
 * Only counts positive deltas that exceed a 3-meter noise filter.
 */
export function calculateElevationGain(elevations: number[]): number {
  if (elevations.length < 2) return 0;

  let gain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const delta = elevations[i] - elevations[i - 1];
    if (delta > 3) {
      gain += delta;
    }
  }
  return gain;
}

/**
 * Calculate pace in minutes per kilometer.
 * Returns Infinity if distance is zero.
 */
export function calculatePace(
  distanceMeters: number,
  durationSeconds: number,
): number {
  if (distanceMeters <= 0) return Infinity;
  const durationMinutes = durationSeconds / 60;
  const distanceKm = distanceMeters / 1000;
  return durationMinutes / distanceKm;
}

/**
 * Format a duration in seconds into a human-readable string.
 * Returns formats like "0m", "45m", "1h 23m", "2h 0m".
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Estimate calories burned during a trail activity.
 *
 * Formula: ~0.05 * weightKg * distanceKm + 0.1 * weightKg * elevationGainKm
 *
 * This is a simplified metabolic estimate. Actual calorie burn depends on
 * terrain, fitness level, pack weight, and other factors.
 */
export function estimateCalories(
  distanceMeters: number,
  elevationGainMeters: number,
  weightKg: number,
): number {
  const distanceKm = distanceMeters / 1000;
  const elevationGainKm = elevationGainMeters / 1000;
  return Math.round(
    0.05 * weightKg * distanceKm + 0.1 * weightKg * elevationGainKm,
  );
}
