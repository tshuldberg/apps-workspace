import type { LocationData } from './types';

/**
 * Validate that coordinates are within valid ranges.
 */
export function validateCoordinates(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Build a LocationData object from raw coordinate and geocoding data.
 * This is a pure helper; actual platform location capture is done in the host apps.
 */
export function buildLocationData(
  latitude: number,
  longitude: number,
  placeName: string | null,
  timezone: string | null,
): LocationData | null {
  if (!validateCoordinates(latitude, longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    placeName,
    timezone,
  };
}

/**
 * Format a place name from reverse geocoding components.
 * Expected input: city, region, country (any may be null).
 */
export function formatPlaceName(
  city: string | null,
  region: string | null,
  country: string | null,
): string | null {
  const parts = [city, region, country].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  // If we have city and region, show "City, Region"
  // If we have city, region, and country, show "City, Region, Country"
  return parts.join(', ');
}

/** Location capture timeout in milliseconds. */
export const LOCATION_TIMEOUT_MS = 5_000;
