// ---------------------------------------------------------------------------
// Multi-region zone seed data
// Each zone groups surf spots into a geographic region with its own timezone,
// bounding box, and NOAA data sources.
// ---------------------------------------------------------------------------

export interface SeedZone {
  id: string;
  name: string;
  slug: string;
  country: string;
  sortOrder: number;
  timezone: string;
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export const SEED_ZONES: SeedZone[] = [
  {
    id: 'zone-california',
    name: 'California',
    slug: 'california',
    country: 'US',
    sortOrder: 0,
    timezone: 'America/Los_Angeles',
    boundingBox: { minLat: 32.53, maxLat: 41.99, minLng: -124.41, maxLng: -117.12 },
  },
  {
    id: 'zone-hawaii',
    name: 'Hawaii',
    slug: 'hawaii',
    country: 'US',
    sortOrder: 1,
    timezone: 'Pacific/Honolulu',
    boundingBox: { minLat: 18.91, maxLat: 22.24, minLng: -160.25, maxLng: -154.80 },
  },
  {
    id: 'zone-east-coast-north',
    name: 'East Coast North',
    slug: 'east-coast-north',
    country: 'US',
    sortOrder: 2,
    timezone: 'America/New_York',
    boundingBox: { minLat: 38.93, maxLat: 43.80, minLng: -74.05, maxLng: -69.88 },
  },
  {
    id: 'zone-east-coast-south',
    name: 'East Coast South',
    slug: 'east-coast-south',
    country: 'US',
    sortOrder: 3,
    timezone: 'America/New_York',
    boundingBox: { minLat: 25.67, maxLat: 36.55, minLng: -81.80, maxLng: -75.46 },
  },
  {
    id: 'zone-portugal',
    name: 'Portugal',
    slug: 'portugal',
    country: 'PT',
    sortOrder: 4,
    timezone: 'Europe/Lisbon',
    boundingBox: { minLat: 36.96, maxLat: 41.18, minLng: -9.50, maxLng: -7.39 },
  },
];
