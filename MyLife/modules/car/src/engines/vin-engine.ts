// ── VIN validation and decoding engine ────────────────────────────────────────
// Pure functions for VIN format validation, check digit calculation, year
// decoding, and NHTSA vPIC API response parsing.

export interface VinDecodeResult {
  make: string | null;
  model: string | null;
  year: number | null;
  bodyClass: string | null;
  engineType: string | null;
  fuelType: string | null;
  driveType: string | null;
  transmission: string | null;
  doors: number | null;
  displacement: string | null;
}

// ── VIN character transliteration values ──────────────────────────────────────
const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

// ── Positional weights for check digit ────────────────────────────────────────
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

// ── VIN year codes (position 10) ──────────────────────────────────────────────
// The VIN year code repeats every 30 years. We map each character to its base
// year offset within a 30-year cycle: A=0, B=1, ..., Y=19, 1=21, ..., 9=29.
const YEAR_CODE_MAP: Record<string, number> = {
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7,
  J: 8, K: 9, L: 10, M: 11, N: 12, P: 13, R: 14,
  S: 15, T: 16, V: 17, W: 18, X: 19, Y: 20,
  '1': 21, '2': 22, '3': 23, '4': 24, '5': 25,
  '6': 26, '7': 27, '8': 28, '9': 29,
};

/**
 * Validate that a VIN has the correct format.
 * Must be exactly 17 alphanumeric characters, excluding I, O, and Q.
 * Does NOT validate the check digit -- use isValidCheckDigit for that.
 */
export function validateVin(vin: string): boolean {
  if (vin.length !== 17) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

/**
 * Calculate the VIN check digit (position 9, 0-indexed position 8).
 * Uses the standard NHTSA algorithm: transliterate each character, multiply
 * by its positional weight, sum, then mod 11 (10 maps to 'X').
 */
export function calculateCheckDigit(vin: string): string {
  const upper = vin.toUpperCase();
  let sum = 0;

  for (let i = 0; i < 17; i++) {
    const char = upper[i];
    const value = TRANSLITERATION[char];
    if (value === undefined) return '?';
    sum += value * WEIGHTS[i];
  }

  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/**
 * Check if the VIN's check digit (position 9) is valid.
 */
export function isValidCheckDigit(vin: string): boolean {
  const upper = vin.toUpperCase();
  const expected = calculateCheckDigit(upper);
  return upper[8] === expected;
}

/**
 * Decode the model year from VIN position 10 (0-indexed position 9).
 * VIN year codes cycle every 30 years starting from 1980.
 * Handles 1980-2039 range. Returns null for invalid characters.
 */
export function getModelYear(vin: string): number | null {
  const upper = vin.toUpperCase();
  const yearChar = upper[9];
  const offset = YEAR_CODE_MAP[yearChar];
  if (offset === undefined) return null;

  // The 30-year cycle: 1980-2009 is the first cycle, 2010-2039 is the second.
  // For a standalone decode we return the second cycle (2010+) since most
  // current vehicles fall there. The caller can check the 7th character
  // (vehicle descriptor) to disambiguate if needed.
  return 2010 + offset;
}

/**
 * Parse the NHTSA vPIC API response into a VinDecodeResult.
 * The API returns { Results: [{ Variable: string, Value: string | null }] }.
 */
export function parseNhtsaResponse(data: unknown): VinDecodeResult {
  const result: VinDecodeResult = {
    make: null,
    model: null,
    year: null,
    bodyClass: null,
    engineType: null,
    fuelType: null,
    driveType: null,
    transmission: null,
    doors: null,
    displacement: null,
  };

  if (
    data === null ||
    data === undefined ||
    typeof data !== 'object' ||
    !('Results' in data) ||
    !Array.isArray((data as Record<string, unknown>).Results)
  ) {
    return result;
  }

  const results = (data as { Results: Array<{ Variable: string; Value: string | null }> }).Results;

  let cylinders: string | null = null;
  let displacementL: string | null = null;

  for (const entry of results) {
    const value = entry.Value && entry.Value.trim() !== '' ? entry.Value.trim() : null;

    switch (entry.Variable) {
      case 'Make':
        result.make = value;
        break;
      case 'Model':
        result.model = value;
        break;
      case 'Model Year':
        result.year = value !== null ? parseInt(value, 10) : null;
        if (result.year !== null && isNaN(result.year)) result.year = null;
        break;
      case 'Body Class':
        result.bodyClass = value;
        break;
      case 'Engine Number of Cylinders':
        cylinders = value;
        break;
      case 'Displacement (L)':
        displacementL = value;
        result.displacement = value;
        break;
      case 'Fuel Type - Primary':
        result.fuelType = mapNhtsaFuelType(value);
        break;
      case 'Drive Type':
        result.driveType = value;
        break;
      case 'Transmission Style':
        result.transmission = value;
        break;
      case 'Doors':
        result.doors = value !== null ? parseInt(value, 10) : null;
        if (result.doors !== null && isNaN(result.doors)) result.doors = null;
        break;
    }
  }

  // Combine cylinders and displacement into engineType
  if (cylinders && displacementL) {
    result.engineType = `${cylinders}-cyl ${displacementL}L`;
  } else if (cylinders) {
    result.engineType = `${cylinders}-cyl`;
  } else if (displacementL) {
    result.engineType = `${displacementL}L`;
  }

  return result;
}

/**
 * Map NHTSA fuel type strings to our FuelType enum values.
 * "Gasoline" -> "gas", "Diesel" -> "diesel", "Electric" -> "electric",
 * contains "Hybrid" -> "hybrid", default "gas".
 */
export function mapNhtsaFuelType(nhtsaFuelType: string | null): string {
  if (nhtsaFuelType === null) return 'gas';

  const normalized = nhtsaFuelType.trim();
  if (normalized === 'Gasoline') return 'gas';
  if (normalized === 'Diesel') return 'diesel';
  if (normalized === 'Electric') return 'electric';
  if (normalized.includes('Hybrid')) return 'hybrid';
  return 'gas';
}
