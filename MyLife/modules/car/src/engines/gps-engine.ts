/**
 * GPS distance calculation engine for MyCar module.
 * Pure functions, no platform dependencies.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface GpsPoint {
  lat: number;
  lng: number;
}

export interface TimestampedGpsPoint extends GpsPoint {
  timestamp: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_MILE = 1_609.344;

// ── Distance ───────────────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two GPS points using
 * the Haversine formula. Returns distance in meters.
 */
export function haversineDistance(p1: GpsPoint, p2: GpsPoint): number {
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Sum the haversine distances between consecutive points.
 * Returns total route distance in meters.
 * Returns 0 for 0 or 1 points.
 */
export function calculateRouteDistance(points: GpsPoint[]): number {
  if (points.length <= 1) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
}

// ── Unit conversion ────────────────────────────────────────────────────────

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

// ── Polyline encoding (Google Encoded Polyline Algorithm) ──────────────────

/**
 * Encode an array of GpsPoints into a Google encoded polyline string.
 * Default precision is 5 (1e5).
 */
export function encodePolyline(points: GpsPoint[], precision = 5): string {
  const factor = Math.pow(10, precision);
  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * factor);
    const lng = Math.round(point.lng * factor);
    result += encodeValue(lat - prevLat);
    result += encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }

  return result;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let result = '';
  while (v >= 0x20) {
    result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  result += String.fromCharCode(v + 63);
  return result;
}

/**
 * Decode a Google encoded polyline string back to an array of GpsPoints.
 * Default precision is 5 (1e5).
 */
export function decodePolyline(encoded: string, precision = 5): GpsPoint[] {
  const factor = Math.pow(10, precision);
  const points: GpsPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}

// ── Route simplification (Ramer-Douglas-Peucker) ──────────────────────────

/**
 * Perpendicular distance from a point to the line segment defined by
 * lineStart and lineEnd. Uses Haversine-based cross-track distance
 * approximation in degrees for small distances.
 */
function perpendicularDistance(
  point: GpsPoint,
  lineStart: GpsPoint,
  lineEnd: GpsPoint,
): number {
  const dxTotal = lineEnd.lng - lineStart.lng;
  const dyTotal = lineEnd.lat - lineStart.lat;

  if (dxTotal === 0 && dyTotal === 0) {
    // lineStart and lineEnd are the same point
    const dx = point.lng - lineStart.lng;
    const dy = point.lat - lineStart.lat;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.lng - lineStart.lng) * dxTotal + (point.lat - lineStart.lat) * dyTotal) /
        (dxTotal * dxTotal + dyTotal * dyTotal),
    ),
  );

  const projLng = lineStart.lng + t * dxTotal;
  const projLat = lineStart.lat + t * dyTotal;
  const dx = point.lng - projLng;
  const dy = point.lat - projLat;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Simplify a route using the Ramer-Douglas-Peucker algorithm.
 * Default tolerance is 0.00005 (about 5 meters).
 * Reduces point count while preserving route shape.
 */
export function simplifyRoute(points: GpsPoint[], tolerance = 0.00005): GpsPoint[] {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyRoute(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyRoute(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
}

// ── Drift filtering ────────────────────────────────────────────────────────

/**
 * Remove GPS points that imply impossible travel speeds.
 * Default max speed is 90 m/s (about 200 mph).
 * Compares consecutive points and removes any that exceed the speed limit.
 */
export function filterDriftPoints(
  points: TimestampedGpsPoint[],
  maxSpeedMps = 90,
): TimestampedGpsPoint[] {
  if (points.length <= 1) return [...points];

  const result: TimestampedGpsPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const dt = Math.abs(curr.timestamp - prev.timestamp) / 1000; // seconds
    if (dt <= 0) continue; // skip duplicate timestamps
    const dist = haversineDistance(prev, curr);
    const speed = dist / dt;
    if (speed <= maxSpeedMps) {
      result.push(curr);
    }
  }

  return result;
}
