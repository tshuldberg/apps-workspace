import { describe, it, expect } from 'vitest';
import {
  validateVin,
  calculateCheckDigit,
  isValidCheckDigit,
  getModelYear,
  parseNhtsaResponse,
  mapNhtsaFuelType,
} from '../engines/vin-engine';

describe('validateVin', () => {
  it('accepts a valid 17-character VIN', () => {
    expect(validateVin('1HGBH41JXMN109186')).toBe(true);
  });

  it('rejects a VIN that is too short', () => {
    expect(validateVin('1HGBH41JXM')).toBe(false);
  });

  it('rejects a VIN that is too long', () => {
    expect(validateVin('1HGBH41JXMN1091860')).toBe(false);
  });

  it('rejects a VIN containing I', () => {
    expect(validateVin('1HGBH41IXMN109186')).toBe(false);
  });

  it('rejects a VIN containing O', () => {
    expect(validateVin('1HGBH41OXMN109186')).toBe(false);
  });

  it('rejects a VIN containing Q', () => {
    expect(validateVin('1HGBH41QXMN109186')).toBe(false);
  });

  it('rejects a VIN with non-alphanumeric characters', () => {
    expect(validateVin('1HGBH41J-MN109186')).toBe(false);
  });

  it('accepts lowercase input', () => {
    expect(validateVin('1hgbh41jxmn109186')).toBe(true);
  });
});

describe('calculateCheckDigit', () => {
  it('calculates X for 1HGBH41JXMN109186', () => {
    expect(calculateCheckDigit('1HGBH41JXMN109186')).toBe('X');
  });

  it('calculates 1 for 11111111111111111', () => {
    expect(calculateCheckDigit('11111111111111111')).toBe('1');
  });

  it('handles lowercase input', () => {
    expect(calculateCheckDigit('1hgbh41jxmn109186')).toBe('X');
  });
});

describe('isValidCheckDigit', () => {
  it('returns true for a VIN with a valid check digit', () => {
    expect(isValidCheckDigit('1HGBH41JXMN109186')).toBe(true);
  });

  it('returns false for a VIN with an invalid check digit', () => {
    // Change check digit from X to 5
    expect(isValidCheckDigit('1HGBH41J5MN109186')).toBe(false);
  });

  it('validates all-1 VIN', () => {
    expect(isValidCheckDigit('11111111111111111')).toBe(true);
  });
});

describe('getModelYear', () => {
  it('decodes A to 2010', () => {
    // Create a minimal VIN with A at position 10 (index 9)
    const vin = '123456789A1234567';
    expect(getModelYear(vin)).toBe(2010);
  });

  it('decodes B to 2011', () => {
    const vin = '123456789B1234567';
    expect(getModelYear(vin)).toBe(2011);
  });

  it('decodes 1 to 2031', () => {
    const vin = '123456789112345678'.slice(0, 17);
    expect(getModelYear(vin)).toBe(2031);
  });

  it('decodes Y to 2030', () => {
    const vin = '123456789Y1234567';
    expect(getModelYear(vin)).toBe(2030);
  });

  it('returns null for invalid year character (I)', () => {
    // I is not valid in VIN but test the year decode path
    const vin = '123456789I1234567';
    expect(getModelYear(vin)).toBeNull();
  });

  it('decodes 9 to 2039', () => {
    const vin = '123456789912345678'.slice(0, 17);
    expect(getModelYear(vin)).toBe(2039);
  });
});

describe('parseNhtsaResponse', () => {
  it('parses a full NHTSA response with all fields', () => {
    const data = {
      Results: [
        { Variable: 'Make', Value: 'HONDA' },
        { Variable: 'Model', Value: 'CIVIC' },
        { Variable: 'Model Year', Value: '2021' },
        { Variable: 'Body Class', Value: 'Sedan/Saloon' },
        { Variable: 'Engine Number of Cylinders', Value: '4' },
        { Variable: 'Displacement (L)', Value: '2.0' },
        { Variable: 'Fuel Type - Primary', Value: 'Gasoline' },
        { Variable: 'Drive Type', Value: 'FWD' },
        { Variable: 'Transmission Style', Value: 'CVT' },
        { Variable: 'Doors', Value: '4' },
      ],
    };

    const result = parseNhtsaResponse(data);
    expect(result.make).toBe('HONDA');
    expect(result.model).toBe('CIVIC');
    expect(result.year).toBe(2021);
    expect(result.bodyClass).toBe('Sedan/Saloon');
    expect(result.engineType).toBe('4-cyl 2.0L');
    expect(result.fuelType).toBe('gas');
    expect(result.driveType).toBe('FWD');
    expect(result.transmission).toBe('CVT');
    expect(result.doors).toBe(4);
    expect(result.displacement).toBe('2.0');
  });

  it('handles partial response with missing fields', () => {
    const data = {
      Results: [
        { Variable: 'Make', Value: 'TESLA' },
        { Variable: 'Model', Value: 'Model 3' },
        { Variable: 'Fuel Type - Primary', Value: 'Electric' },
      ],
    };

    const result = parseNhtsaResponse(data);
    expect(result.make).toBe('TESLA');
    expect(result.model).toBe('Model 3');
    expect(result.year).toBeNull();
    expect(result.bodyClass).toBeNull();
    expect(result.engineType).toBeNull();
    expect(result.fuelType).toBe('electric');
    expect(result.driveType).toBeNull();
    expect(result.doors).toBeNull();
  });

  it('returns all nulls for empty Results array', () => {
    const result = parseNhtsaResponse({ Results: [] });
    expect(result.make).toBeNull();
    expect(result.model).toBeNull();
    expect(result.year).toBeNull();
    expect(result.engineType).toBeNull();
  });

  it('returns all nulls for null/undefined input', () => {
    expect(parseNhtsaResponse(null).make).toBeNull();
    expect(parseNhtsaResponse(undefined).make).toBeNull();
  });

  it('treats empty string values as null', () => {
    const data = {
      Results: [
        { Variable: 'Make', Value: '' },
        { Variable: 'Model', Value: '   ' },
      ],
    };

    const result = parseNhtsaResponse(data);
    expect(result.make).toBeNull();
    expect(result.model).toBeNull();
  });
});

describe('mapNhtsaFuelType', () => {
  it('maps Gasoline to gas', () => {
    expect(mapNhtsaFuelType('Gasoline')).toBe('gas');
  });

  it('maps Diesel to diesel', () => {
    expect(mapNhtsaFuelType('Diesel')).toBe('diesel');
  });

  it('maps Electric to electric', () => {
    expect(mapNhtsaFuelType('Electric')).toBe('electric');
  });

  it('maps Plug-in Hybrid to hybrid', () => {
    expect(mapNhtsaFuelType('Plug-in Hybrid')).toBe('hybrid');
  });

  it('maps any string containing Hybrid to hybrid', () => {
    expect(mapNhtsaFuelType('Gasoline/Mild Electric Hybrid')).toBe('hybrid');
  });

  it('defaults to gas for null', () => {
    expect(mapNhtsaFuelType(null)).toBe('gas');
  });

  it('defaults to gas for unknown fuel types', () => {
    expect(mapNhtsaFuelType('Hydrogen')).toBe('gas');
  });
});
