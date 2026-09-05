import type { RegionCatalogEntry } from '../types';

/**
 * Predefined downloadable regions for California.
 * Each entry defines a bounding box, estimated tile count at z1-15,
 * and estimated download size.
 */
export const REGION_CATALOG: RegionCatalogEntry[] = [
  // National Parks
  {
    regionKey: 'yosemite-np',
    name: 'Yosemite National Park',
    area: 'National Parks',
    minLat: 37.495,
    maxLat: 38.185,
    minLng: -119.886,
    maxLng: -119.195,
    estimatedTiles: 42000,
    estimatedSizeMb: 210,
  },
  {
    regionKey: 'joshua-tree-np',
    name: 'Joshua Tree National Park',
    area: 'National Parks',
    minLat: 33.660,
    maxLat: 34.130,
    minLng: -116.320,
    maxLng: -115.420,
    estimatedTiles: 38000,
    estimatedSizeMb: 190,
  },
  {
    regionKey: 'death-valley-np',
    name: 'Death Valley National Park',
    area: 'National Parks',
    minLat: 35.500,
    maxLat: 37.400,
    minLng: -117.680,
    maxLng: -116.000,
    estimatedTiles: 48000,
    estimatedSizeMb: 240,
  },
  {
    regionKey: 'sequoia-kings-np',
    name: 'Sequoia & Kings Canyon',
    area: 'National Parks',
    minLat: 36.340,
    maxLat: 37.040,
    minLng: -118.880,
    maxLng: -118.280,
    estimatedTiles: 35000,
    estimatedSizeMb: 175,
  },
  {
    regionKey: 'redwood-np',
    name: 'Redwood National Park',
    area: 'National Parks',
    minLat: 41.100,
    maxLat: 41.850,
    minLng: -124.200,
    maxLng: -123.800,
    estimatedTiles: 22000,
    estimatedSizeMb: 110,
  },
  {
    regionKey: 'pinnacles-np',
    name: 'Pinnacles National Park',
    area: 'National Parks',
    minLat: 36.450,
    maxLat: 36.560,
    minLng: -121.240,
    maxLng: -121.100,
    estimatedTiles: 8000,
    estimatedSizeMb: 40,
  },
  // Coastal
  {
    regionKey: 'big-sur',
    name: 'Big Sur',
    area: 'Coastal',
    minLat: 35.800,
    maxLat: 36.500,
    minLng: -121.950,
    maxLng: -121.400,
    estimatedTiles: 28000,
    estimatedSizeMb: 140,
  },
  {
    regionKey: 'point-reyes',
    name: 'Point Reyes National Seashore',
    area: 'Coastal',
    minLat: 37.930,
    maxLat: 38.200,
    minLng: -123.050,
    maxLng: -122.740,
    estimatedTiles: 15000,
    estimatedSizeMb: 75,
  },
  // Bay Area
  {
    regionKey: 'muir-woods',
    name: 'Muir Woods & Mt Tamalpais',
    area: 'Bay Area',
    minLat: 37.840,
    maxLat: 37.940,
    minLng: -122.620,
    maxLng: -122.500,
    estimatedTiles: 9000,
    estimatedSizeMb: 45,
  },
  {
    regionKey: 'east-bay-hills',
    name: 'East Bay Hills & Tilden',
    area: 'Bay Area',
    minLat: 37.820,
    maxLat: 37.940,
    minLng: -122.280,
    maxLng: -122.150,
    estimatedTiles: 10000,
    estimatedSizeMb: 50,
  },
  // Sierra Nevada
  {
    regionKey: 'tahoe-rim',
    name: 'Lake Tahoe Rim Trail',
    area: 'Sierra Nevada',
    minLat: 38.800,
    maxLat: 39.350,
    minLng: -120.250,
    maxLng: -119.800,
    estimatedTiles: 25000,
    estimatedSizeMb: 125,
  },
  {
    regionKey: 'mammoth-lakes',
    name: 'Mammoth Lakes & Inyo',
    area: 'Sierra Nevada',
    minLat: 37.450,
    maxLat: 37.750,
    minLng: -119.200,
    maxLng: -118.750,
    estimatedTiles: 20000,
    estimatedSizeMb: 100,
  },
];

export function getCatalogByArea(): Map<string, RegionCatalogEntry[]> {
  const grouped = new Map<string, RegionCatalogEntry[]>();
  for (const entry of REGION_CATALOG) {
    const existing = grouped.get(entry.area) ?? [];
    existing.push(entry);
    grouped.set(entry.area, existing);
  }
  return grouped;
}

export function getCatalogEntry(regionKey: string): RegionCatalogEntry | undefined {
  return REGION_CATALOG.find((e) => e.regionKey === regionKey);
}
