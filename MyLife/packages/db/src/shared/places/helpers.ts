/**
 * Geohash encoder (vendored, dependency-free).
 *
 * Encodes a (lat, lng) pair into a base-32 geohash string of the given
 * precision. Uses the standard algorithm from https://en.wikipedia.org/wiki/Geohash:
 * repeatedly bisect the lat/lng ranges, interleaving lng/lat bits, and emit
 * a base-32 character every 5 bits.
 *
 * Precision quick reference (approximate cell size):
 *   1 -> ~5000 km,  2 -> ~1250 km,  3 -> ~156 km,  4 -> ~39 km,
 *   5 -> ~4.9 km,   6 -> ~1.2 km,   7 -> ~152 m,   8 -> ~38 m,   9 -> ~4.8 m
 *
 * Pure function. No side effects. Testable in isolation.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a (lat, lng) coordinate to a base-32 geohash.
 *
 * @param lat Latitude in [-90, 90].
 * @param lng Longitude in [-180, 180].
 * @param precision Number of base-32 characters to emit. Defaults to 9.
 * @returns Geohash string of length `precision`.
 * @throws If lat/lng are out of range or precision is not a positive integer.
 */
export function encodeGeohash(
  lat: number,
  lng: number,
  precision: number = 9,
): string {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`encodeGeohash: lat out of range: ${lat}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`encodeGeohash: lng out of range: ${lng}`);
  }
  if (!Number.isInteger(precision) || precision < 1) {
    throw new Error(`encodeGeohash: precision must be a positive integer: ${precision}`);
  }

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  let hash = '';
  let bits = 0;
  let bit = 0;
  let evenBit = true; // even bits encode lng, odd bits encode lat

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        bits = (bits << 1) | 1;
        lngMin = mid;
      } else {
        bits = bits << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        bits = (bits << 1) | 1;
        latMin = mid;
      } else {
        bits = bits << 1;
        latMax = mid;
      }
    }

    evenBit = !evenBit;
    bit++;

    if (bit === 5) {
      hash += BASE32[bits]!;
      bits = 0;
      bit = 0;
    }
  }

  return hash;
}
