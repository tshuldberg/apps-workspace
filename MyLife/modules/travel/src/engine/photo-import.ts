// Photo EXIF metadata import engine.
// Pure functions. No I/O, no persistence.

export interface PhotoLocation {
  takenAtIso?: string;
  lat?: number;
  lng?: number;
}

export interface PhotoDayCluster {
  dateIso: string;
  count: number;
  centroidLat?: number;
  centroidLng?: number;
}

type RawExif = {
  DateTimeOriginal?: unknown;
  GPSLatitude?: unknown;
  GPSLongitude?: unknown;
  GPSLatitudeRef?: unknown;
  GPSLongitudeRef?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Convert GPS coordinate (number or [deg, min, sec]) to decimal degrees. */
function coordinateToDecimal(raw: unknown): number | undefined {
  if (typeof raw === 'number' && isFinite(raw)) return raw;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return undefined;
    const [deg, min, sec] = raw;
    const d = typeof deg === 'number' ? deg : 0;
    const m = typeof min === 'number' ? min : 0;
    const s = typeof sec === 'number' ? sec : 0;
    return d + m / 60 + s / 3600;
  }
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (isFinite(n)) return n;
  }
  return undefined;
}

const EXIF_DT_PATTERN = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(Z?)$/;

function normalizeDateTime(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const m = EXIF_DT_PATTERN.exec(raw);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    return y + '-' + mo + '-' + d + 'T' + h + ':' + mi + ':' + s + 'Z';
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return undefined;
}

export function parsePhotoExifJson(exifJson: unknown): PhotoLocation | null {
  if (!isRecord(exifJson)) return null;
  const exif = exifJson as RawExif;

  const takenAtIso = normalizeDateTime(exif.DateTimeOriginal);

  let lat = coordinateToDecimal(exif.GPSLatitude);
  let lng = coordinateToDecimal(exif.GPSLongitude);

  if (typeof lat === 'number') {
    const ref = typeof exif.GPSLatitudeRef === 'string' ? exif.GPSLatitudeRef.trim().toUpperCase() : '';
    if (ref === 'S' && lat > 0) lat = -lat;
  }
  if (typeof lng === 'number') {
    const ref = typeof exif.GPSLongitudeRef === 'string' ? exif.GPSLongitudeRef.trim().toUpperCase() : '';
    if (ref === 'W' && lng > 0) lng = -lng;
  }

  const hasAnything = takenAtIso !== undefined || typeof lat === 'number' || typeof lng === 'number';
  if (!hasAnything) return null;

  const out: PhotoLocation = {};
  if (takenAtIso) out.takenAtIso = takenAtIso;
  if (typeof lat === 'number') out.lat = lat;
  if (typeof lng === 'number') out.lng = lng;
  return out;
}

function utcDateKey(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function clusterPhotosByDay(photos: PhotoLocation[]): PhotoDayCluster[] {
  const buckets = new Map<string, { count: number; latSum: number; lngSum: number; geoCount: number }>();

  for (const p of photos) {
    if (!p.takenAtIso) continue;
    const key = utcDateKey(p.takenAtIso);
    if (!key) continue;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      if (typeof p.lat === 'number' && typeof p.lng === 'number') {
        existing.latSum += p.lat;
        existing.lngSum += p.lng;
        existing.geoCount += 1;
      }
    } else {
      const entry = { count: 1, latSum: 0, lngSum: 0, geoCount: 0 };
      if (typeof p.lat === 'number' && typeof p.lng === 'number') {
        entry.latSum = p.lat;
        entry.lngSum = p.lng;
        entry.geoCount = 1;
      }
      buckets.set(key, entry);
    }
  }

  const entries = Array.from(buckets.entries());
  const clusters: PhotoDayCluster[] = entries.map(([dateIso, v]) => {
    const cluster: PhotoDayCluster = { dateIso, count: v.count };
    if (v.geoCount > 0) {
      cluster.centroidLat = v.latSum / v.geoCount;
      cluster.centroidLng = v.lngSum / v.geoCount;
    }
    return cluster;
  });

  clusters.sort((a, b) => (a.dateIso < b.dateIso ? -1 : a.dateIso > b.dateIso ? 1 : 0));
  return clusters;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in kilometers. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const NEW_DESTINATION_THRESHOLD_KM = 50;

export function suggestDestinationsFromPhotos(
  clusters: PhotoDayCluster[],
  existingDestinations: { lat: number; lng: number }[],
): PhotoDayCluster[] {
  const out: PhotoDayCluster[] = [];
  for (const c of clusters) {
    if (typeof c.centroidLat !== 'number' || typeof c.centroidLng !== 'number') continue;
    let tooClose = false;
    for (const d of existingDestinations) {
      const km = haversineKm(c.centroidLat, c.centroidLng, d.lat, d.lng);
      if (km <= NEW_DESTINATION_THRESHOLD_KM) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) out.push(c);
  }
  return out;
}
