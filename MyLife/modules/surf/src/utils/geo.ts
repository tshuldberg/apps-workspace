/**
 * Geospatial utility functions.
 */

const EARTH_RADIUS_KM = 6371

/**
 * Haversine distance between two lat/lng points in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Convert feet to meters.
 */
export function feetToMeters(ft: number): number {
  return ft * 0.3048
}

/**
 * Convert meters to feet.
 */
export function metersToFeet(m: number): number {
  return m / 0.3048
}
