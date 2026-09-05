// ── Parking analytics engine ──────────────────────────────────────────────────
// Pure functions for parking location status, meter tracking, and distance utils.

export type MeterStatus = 'active' | 'expiring_soon' | 'expired' | 'no_meter';

/**
 * Determine the current meter status based on expiration time.
 * Returns 'no_meter' if no expiration set, 'expired' if past,
 * 'expiring_soon' if within 10 minutes, 'active' otherwise.
 */
export function getMeterStatus(meterExpiresAt: string | null, currentTime: string): MeterStatus {
  if (meterExpiresAt === null) return 'no_meter';

  const expiresMs = new Date(meterExpiresAt).getTime();
  const currentMs = new Date(currentTime).getTime();
  const diffMs = expiresMs - currentMs;

  if (diffMs <= 0) return 'expired';
  if (diffMs <= 10 * 60 * 1000) return 'expiring_soon';
  return 'active';
}

/**
 * Calculate minutes remaining until meter expiration.
 * Returns negative values if already expired. Rounds to nearest integer.
 */
export function getMinutesRemaining(meterExpiresAt: string, currentTime: string): number {
  const expiresMs = new Date(meterExpiresAt).getTime();
  const currentMs = new Date(currentTime).getTime();
  const diffMinutes = (expiresMs - currentMs) / (60 * 1000);
  return Math.round(diffMinutes);
}

/**
 * Format a duration in minutes to a human-readable string.
 * Returns "Xh Ym" for >= 60 min, "Xm" for < 60, "Expired" for negative.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 0) return 'Expired';
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
}

/**
 * Check if a parking location is stale (saved more than maxHours ago).
 * Default threshold is 24 hours.
 */
export function isStaleParking(savedAt: string, currentTime: string, maxHours: number = 24): boolean {
  const savedMs = new Date(savedAt).getTime();
  const currentMs = new Date(currentTime).getTime();
  const diffHours = (currentMs - savedMs) / (3600 * 1000);
  return diffHours > maxHours;
}

/**
 * Calculate estimated walking time to reach a parked car.
 * Default walking speed is 1.4 m/s (average human walking speed).
 * Returns minutes, rounded up.
 */
export function calculateWalkingTime(distanceMeters: number, speedMps: number = 1.4): number {
  const seconds = distanceMeters / speedMps;
  const minutes = seconds / 60;
  return Math.ceil(minutes);
}

/**
 * Validate that latitude and longitude are within valid ranges.
 * Latitude: [-90, 90], Longitude: [-180, 180].
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
