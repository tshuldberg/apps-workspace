import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import { parseCsvText, parseGoogleMapsExport } from '../engine/csv-importer';
import { importCsvRows } from '../db/crud/import-restaurants';
import { listRestaurants } from '../db/crud/restaurants';

// -- Pure parser tests --

describe('parseCsvText', () => {
  it('parses basic CSV with name,address,city columns', () => {
    const csv = `name,address,city
Bestia,2121 E 7th Pl,Los Angeles
Noma,Refshalevej 96,Copenhagen`;

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Bestia');
    expect(rows[0].address).toBe('2121 E 7th Pl');
    expect(rows[0].city).toBe('Los Angeles');
    expect(rows[1].name).toBe('Noma');
    expect(rows[1].city).toBe('Copenhagen');
  });

  it('handles quoted values with commas', () => {
    const csv = `name,address,city
"Joe's Pizza, Original","7 Carmine St, Floor 1","New York"
Tartine,600 Guerrero St,San Francisco`;

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Joe's Pizza, Original");
    expect(rows[0].address).toBe('7 Carmine St, Floor 1');
    expect(rows[1].name).toBe('Tartine');
  });

  it('supports flexible column name matching (Restaurant vs name)', () => {
    const csv = `Restaurant,Street,Area,Category,$$
Republique,624 S La Brea Ave,Mid-City,French,$$
Gjusta,320 Sunset Ave,Venice,Bakery,$`;

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Republique');
    expect(rows[0].address).toBe('624 S La Brea Ave');
    expect(rows[0].neighborhood).toBe('Mid-City');
    expect(rows[0].cuisines).toBe('French');
    expect(rows[0].priceTier).toBe(2);
    expect(rows[1].priceTier).toBe(1);
  });

  it('skips rows without name', () => {
    const csv = `name,city
Bestia,Los Angeles
,Copenhagen
Noma,Copenhagen`;

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Bestia');
    expect(rows[1].name).toBe('Noma');
  });

  it('parses price tier from $ symbols', () => {
    const csv = `name,price
Cheap Eats,$
Mid Range,$$
Fancy,$$$
Ultra,$$$$`;

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(4);
    expect(rows[0].priceTier).toBe(1);
    expect(rows[1].priceTier).toBe(2);
    expect(rows[2].priceTier).toBe(3);
    expect(rows[3].priceTier).toBe(4);
  });

  it('parses numeric price tier', () => {
    const csv = `name,price_tier
Place A,1
Place B,3`;

    const rows = parseCsvText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].priceTier).toBe(1);
    expect(rows[1].priceTier).toBe(3);
  });

  it('handles empty file gracefully', () => {
    expect(parseCsvText('')).toEqual([]);
    expect(parseCsvText('name,city')).toEqual([]);
    expect(parseCsvText('\n')).toEqual([]);
  });
});

// -- DB-dependent tests --

let db: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('dining', DINING_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('importCsvRows', () => {
  it('imports valid rows', () => {
    const rows = parseCsvText(`name,city,cuisines
Bestia,Los Angeles,Italian
Gjusta,Los Angeles,Bakery`);

    const result = importCsvRows(db, rows);
    expect(result.total).toBe(2);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const restaurants = listRestaurants(db);
    expect(restaurants).toHaveLength(2);
  });

  it('skips duplicates by name+city', () => {
    const rows1 = parseCsvText(`name,city
Bestia,Los Angeles`);
    importCsvRows(db, rows1);

    const rows2 = parseCsvText(`name,city
Bestia,Los Angeles
Noma,Copenhagen`);
    const result = importCsvRows(db, rows2);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);

    const restaurants = listRestaurants(db);
    expect(restaurants).toHaveLength(2);
  });

  it('reports errors for invalid rows', () => {
    // Force an error by passing a row with empty name (already filtered by parseCsvText,
    // so we test by passing rows directly)
    const rows = [
      { name: '' },
      { name: 'Valid Place', city: 'LA' },
    ];

    const result = importCsvRows(db, rows);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('Missing restaurant name');
    expect(result.imported).toBe(1);
  });

  it('handles 100 rows efficiently', () => {
    const lines = ['name,city,rating'];
    for (let i = 0; i < 100; i++) {
      lines.push(`Restaurant ${i},City ${i % 10},${(i % 5) + 1}`);
    }
    const rows = parseCsvText(lines.join('\n'));
    expect(rows).toHaveLength(100);

    const start = Date.now();
    const result = importCsvRows(db, rows);
    const elapsed = Date.now() - start;

    expect(result.imported).toBe(100);
    expect(result.errors).toHaveLength(0);
    // Should complete in under 5 seconds even on slow CI
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('parseGoogleMapsExport', () => {
  it('parses valid GeoJSON FeatureCollection', () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-118.2437, 34.0522],
          },
          properties: {
            Title: 'Bestia',
            Address: '2121 E 7th Pl, Los Angeles, CA',
            'Google Maps URL': 'https://maps.google.com/?cid=123',
          },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [12.6101, 55.6833],
          },
          properties: {
            Title: 'Noma',
            Address: 'Refshalevej 96, Copenhagen',
          },
        },
      ],
    });

    const places = parseGoogleMapsExport(geojson);
    expect(places).toHaveLength(2);

    expect(places[0].name).toBe('Bestia');
    expect(places[0].address).toBe('2121 E 7th Pl, Los Angeles, CA');
    expect(places[0].lat).toBeCloseTo(34.0522);
    expect(places[0].lng).toBeCloseTo(-118.2437);
    expect(places[0].url).toBe('https://maps.google.com/?cid=123');

    expect(places[1].name).toBe('Noma');
    expect(places[1].lat).toBeCloseTo(55.6833);
  });

  it('handles empty/malformed input', () => {
    expect(parseGoogleMapsExport('')).toEqual([]);
    expect(parseGoogleMapsExport('not json')).toEqual([]);
    expect(parseGoogleMapsExport('{}')).toEqual([]);
    expect(parseGoogleMapsExport('{"features": "not array"}')).toEqual([]);
    expect(parseGoogleMapsExport('null')).toEqual([]);
  });
});
