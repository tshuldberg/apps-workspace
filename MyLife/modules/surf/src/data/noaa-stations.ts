// ---------------------------------------------------------------------------
// NOAA buoy and tide station mappings per zone
// Buoy IDs are from the NDBC (National Data Buoy Center).
// Tide station IDs are from NOAA CO-OPS (Center for Operational Oceanographic
// Products and Services).
// ---------------------------------------------------------------------------

export interface BuoyStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  source: 'ndbc';
}

export interface TideStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  source: 'noaa-coops';
}

export interface ZoneStations {
  zoneId: string;
  buoys: BuoyStation[];
  tideStations: TideStation[];
}

export const ZONE_STATIONS: ZoneStations[] = [
  // -- California --
  {
    zoneId: 'zone-california',
    buoys: [
      { id: '46012', name: 'Half Moon Bay', latitude: 37.363, longitude: -122.881, source: 'ndbc' },
      { id: '46026', name: 'San Francisco', latitude: 37.759, longitude: -122.833, source: 'ndbc' },
      { id: '46042', name: 'Monterey', latitude: 36.789, longitude: -122.398, source: 'ndbc' },
      { id: '46054', name: 'Santa Barbara W', latitude: 34.274, longitude: -120.459, source: 'ndbc' },
      { id: '46025', name: 'Santa Monica Basin', latitude: 33.749, longitude: -119.053, source: 'ndbc' },
      { id: '46047', name: 'Tanner Banks', latitude: 32.433, longitude: -119.533, source: 'ndbc' },
      { id: '46086', name: 'San Clemente Basin', latitude: 32.491, longitude: -118.034, source: 'ndbc' },
    ],
    tideStations: [
      { id: '9414290', name: 'San Francisco', latitude: 37.8063, longitude: -122.4659, source: 'noaa-coops' },
      { id: '9413450', name: 'Monterey', latitude: 36.6050, longitude: -121.8879, source: 'noaa-coops' },
      { id: '9411340', name: 'Santa Barbara', latitude: 34.4083, longitude: -119.6932, source: 'noaa-coops' },
      { id: '9410170', name: 'San Diego', latitude: 32.7142, longitude: -117.1736, source: 'noaa-coops' },
    ],
  },

  // -- Hawaii --
  {
    zoneId: 'zone-hawaii',
    buoys: [
      { id: '51201', name: 'Waimea Bay', latitude: 21.6736, longitude: -158.1164, source: 'ndbc' },
      { id: '51202', name: 'Mokapu Point', latitude: 21.4170, longitude: -157.6790, source: 'ndbc' },
      { id: '51003', name: 'W Hawaii', latitude: 19.228, longitude: -160.822, source: 'ndbc' },
      { id: '51004', name: 'SE Hawaii', latitude: 17.525, longitude: -152.382, source: 'ndbc' },
      { id: '51101', name: 'NW Hawaii', latitude: 24.361, longitude: -162.075, source: 'ndbc' },
    ],
    tideStations: [
      { id: '1612340', name: 'Honolulu', latitude: 21.3067, longitude: -157.8670, source: 'noaa-coops' },
      { id: '1615680', name: 'Kahului', latitude: 20.8950, longitude: -156.4767, source: 'noaa-coops' },
      { id: '1612480', name: 'Mokuoloe', latitude: 21.4331, longitude: -157.7900, source: 'noaa-coops' },
    ],
  },

  // -- East Coast North --
  {
    zoneId: 'zone-east-coast-north',
    buoys: [
      { id: '44025', name: 'Long Island', latitude: 40.251, longitude: -73.164, source: 'ndbc' },
      { id: '44017', name: 'Montauk Point', latitude: 40.694, longitude: -72.048, source: 'ndbc' },
      { id: '44097', name: 'Block Island', latitude: 40.969, longitude: -71.127, source: 'ndbc' },
      { id: '44008', name: 'Nantucket', latitude: 40.502, longitude: -69.248, source: 'ndbc' },
      { id: '44065', name: 'New York Harbor', latitude: 40.369, longitude: -73.703, source: 'ndbc' },
    ],
    tideStations: [
      { id: '8510560', name: 'Montauk', latitude: 41.0483, longitude: -71.9600, source: 'noaa-coops' },
      { id: '8461490', name: 'New London CT', latitude: 41.3550, longitude: -72.0900, source: 'noaa-coops' },
      { id: '8534720', name: 'Atlantic City NJ', latitude: 39.3567, longitude: -74.4183, source: 'noaa-coops' },
      { id: '8518750', name: 'The Battery NY', latitude: 40.7006, longitude: -74.0142, source: 'noaa-coops' },
    ],
  },

  // -- East Coast South --
  {
    zoneId: 'zone-east-coast-south',
    buoys: [
      { id: '41002', name: 'South Hatteras', latitude: 32.309, longitude: -75.483, source: 'ndbc' },
      { id: '41025', name: 'Diamond Shoals', latitude: 35.006, longitude: -75.402, source: 'ndbc' },
      { id: '41009', name: 'Canaveral', latitude: 28.519, longitude: -80.166, source: 'ndbc' },
      { id: '41004', name: 'Edisto', latitude: 32.501, longitude: -79.099, source: 'ndbc' },
      { id: '41114', name: 'Fort Pierce', latitude: 27.551, longitude: -80.217, source: 'ndbc' },
    ],
    tideStations: [
      { id: '8651370', name: 'Duck NC', latitude: 36.1833, longitude: -75.7467, source: 'noaa-coops' },
      { id: '8658120', name: 'Wilmington NC', latitude: 34.2267, longitude: -77.9533, source: 'noaa-coops' },
      { id: '8665530', name: 'Charleston SC', latitude: 32.7817, longitude: -79.9250, source: 'noaa-coops' },
      { id: '8721604', name: 'Trident Pier FL', latitude: 28.4158, longitude: -80.5928, source: 'noaa-coops' },
    ],
  },

  // -- Portugal (IPMA + Copernicus buoys, using generic IDs) --
  {
    zoneId: 'zone-portugal',
    buoys: [
      { id: 'pt-monican', name: 'Nazare Canyon (MonicaN)', latitude: 39.567, longitude: -9.217, source: 'ndbc' },
      { id: 'pt-sines', name: 'Sines Directional', latitude: 37.923, longitude: -8.933, source: 'ndbc' },
      { id: 'pt-leixoes', name: 'Leixoes', latitude: 41.193, longitude: -8.983, source: 'ndbc' },
    ],
    tideStations: [
      { id: 'pt-cascais', name: 'Cascais', latitude: 38.6917, longitude: -9.4183, source: 'noaa-coops' },
      { id: 'pt-peniche', name: 'Peniche', latitude: 39.3478, longitude: -9.3722, source: 'noaa-coops' },
      { id: 'pt-lagos', name: 'Lagos', latitude: 37.1000, longitude: -8.6700, source: 'noaa-coops' },
    ],
  },
];

/** Look up stations for a given zone ID */
export function getStationsForZone(zoneId: string): ZoneStations | undefined {
  return ZONE_STATIONS.find((zs) => zs.zoneId === zoneId);
}

/** Get the closest buoy to a given lat/lng within a zone */
export function getClosestBuoy(
  zoneId: string,
  lat: number,
  lng: number,
): BuoyStation | undefined {
  const zs = getStationsForZone(zoneId);
  if (!zs || zs.buoys.length === 0) return undefined;

  let closest = zs.buoys[0]!;
  let minDist = distSq(lat, lng, closest.latitude, closest.longitude);

  for (let i = 1; i < zs.buoys.length; i++) {
    const b = zs.buoys[i]!;
    const d = distSq(lat, lng, b.latitude, b.longitude);
    if (d < minDist) {
      closest = b;
      minDist = d;
    }
  }
  return closest;
}

/** Get the closest tide station to a given lat/lng within a zone */
export function getClosestTideStation(
  zoneId: string,
  lat: number,
  lng: number,
): TideStation | undefined {
  const zs = getStationsForZone(zoneId);
  if (!zs || zs.tideStations.length === 0) return undefined;

  let closest = zs.tideStations[0]!;
  let minDist = distSq(lat, lng, closest.latitude, closest.longitude);

  for (let i = 1; i < zs.tideStations.length; i++) {
    const t = zs.tideStations[i]!;
    const d = distSq(lat, lng, t.latitude, t.longitude);
    if (d < minDist) {
      closest = t;
      minDist = d;
    }
  }
  return closest;
}

function distSq(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = lat1 - lat2;
  const dlng = (lng1 - lng2) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return dlat * dlat + dlng * dlng;
}
