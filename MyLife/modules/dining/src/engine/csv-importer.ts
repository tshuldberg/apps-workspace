/**
 * CSV and Google Maps import parsers.
 * Pure functions -- no DB access. Parse text into structured rows.
 */

export interface CsvRow {
  name: string;
  address?: string;
  city?: string;
  neighborhood?: string;
  cuisines?: string;
  priceTier?: number;
  rating?: number;
  notes?: string;
  websiteUrl?: string;
  isWishlist?: boolean;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

export interface GoogleMapsPlace {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  url?: string;
}

// Column name aliases (lowercase key -> canonical field)
const COLUMN_MAP: Record<string, keyof CsvRow> = {
  name: 'name',
  restaurant: 'name',
  place: 'name',
  address: 'address',
  street: 'address',
  city: 'city',
  neighborhood: 'neighborhood',
  area: 'neighborhood',
  cuisines: 'cuisines',
  cuisine: 'cuisines',
  type: 'cuisines',
  category: 'cuisines',
  price: 'priceTier',
  price_tier: 'priceTier',
  '$$': 'priceTier',
  rating: 'rating',
  stars: 'rating',
  notes: 'notes',
  comments: 'notes',
  website: 'websiteUrl',
  url: 'websiteUrl',
  wishlist: 'isWishlist',
};

/**
 * Parse a single CSV line respecting quoted values.
 * Handles commas inside double-quoted fields and escaped quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += ch;
      i++;
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ',') {
        fields.push(current.trim());
        current = '';
        i++;
        continue;
      }
      current += ch;
      i++;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse price tier from $ symbols or numeric value.
 * "$" -> 1, "$$" -> 2, "$$$" -> 3, "$$$$" -> 4
 * "1"-"4" -> that number
 */
function parsePriceTier(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Dollar sign format
  if (/^\$+$/.test(trimmed)) {
    const tier = Math.min(trimmed.length, 4);
    return tier;
  }

  // Numeric format
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= 4) return num;

  return undefined;
}

/**
 * Parse a boolean-ish value (yes/true/1/y -> true).
 */
function parseBool(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return ['yes', 'true', '1', 'y'].includes(lower);
}

/**
 * Parse CSV text into structured rows.
 * First line is the header. Supports flexible column name matching.
 */
export function parseCsvText(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];

  const headerFields = parseCsvLine(lines[0]);
  const columnMapping: Array<keyof CsvRow | null> = headerFields.map((h) => {
    const key = h.toLowerCase().trim();
    return COLUMN_MAP[key] ?? null;
  });

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const row: Partial<CsvRow> = {};

    for (let j = 0; j < columnMapping.length; j++) {
      const field = columnMapping[j];
      if (!field) continue;
      const value = fields[j];
      if (value === undefined || value === '') continue;

      switch (field) {
        case 'priceTier':
          row.priceTier = parsePriceTier(value);
          break;
        case 'rating': {
          const num = parseFloat(value);
          if (!isNaN(num)) row.rating = num;
          break;
        }
        case 'isWishlist':
          row.isWishlist = parseBool(value);
          break;
        default:
          (row as Record<string, unknown>)[field] = value;
      }
    }

    // Skip rows without a name
    if (!row.name) continue;

    rows.push(row as CsvRow);
  }

  return rows;
}

/**
 * Parse Google Maps "Saved Places" GeoJSON export.
 * Expects a GeoJSON FeatureCollection with features containing
 * geometry.coordinates and properties (Title, Address/Location, Google Maps URL).
 */
export function parseGoogleMapsExport(jsonText: string): GoogleMapsPlace[] {
  try {
    const data = JSON.parse(jsonText);
    if (!data || !Array.isArray(data.features)) return [];

    const places: GoogleMapsPlace[] = [];

    for (const feature of data.features) {
      const props = feature.properties ?? {};
      const name = props.Title ?? props.title ?? props.name ?? '';
      if (!name) continue;

      const address =
        props.Address ?? props.address ?? props.Location ?? props.location ?? '';

      let lat: number | undefined;
      let lng: number | undefined;

      if (
        feature.geometry?.type === 'Point' &&
        Array.isArray(feature.geometry.coordinates) &&
        feature.geometry.coordinates.length >= 2
      ) {
        // GeoJSON coordinates are [lng, lat]
        lng = feature.geometry.coordinates[0];
        lat = feature.geometry.coordinates[1];
      }

      const url =
        props['Google Maps URL'] ??
        props.google_maps_url ??
        props.url ??
        undefined;

      places.push({ name, address, lat, lng, url });
    }

    return places;
  } catch {
    return [];
  }
}
