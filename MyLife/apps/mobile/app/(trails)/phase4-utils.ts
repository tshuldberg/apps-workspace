import {
  calculateElevationGain,
  calculatePace,
  estimateCalories,
  haversineDistance,
  type Waypoint,
} from '@mylife/trails';

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export type TrackLikePoint = Pick<
  Waypoint,
  'lat' | 'lng' | 'elevation' | 'timestamp' | 'accuracy'
>;

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ProjectedTrackPoint extends TrackLikePoint {
  x: number;
  y: number;
  cumulativeDistanceMeters: number;
}

export interface ElevationSample extends ProjectedTrackPoint {
  elevationMeters: number;
  gradePercent: number;
  cumulativeGainMeters: number;
  cumulativeLossMeters: number;
}

export interface TrackSummary {
  distanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  startElevationMeters: number;
  maxElevationMeters: number;
  endElevationMeters: number;
  calories: number;
  paceMinPerKm: number | null;
  maxGradePercent: number;
}

export interface TerrainBucket {
  label: string;
  hint: string;
  distanceMeters: number;
  share: number;
  color: string;
  icon: 'terrain' | 'trending_up' | 'landscape';
}

const DEFAULT_WEIGHT_KG = 78;
const DEFAULT_ROUTE_SHAPE = [
  { east: -160, north: 260, elevation: 1180 },
  { east: -120, north: 200, elevation: 1210 },
  { east: -64, north: 154, elevation: 1265 },
  { east: -34, north: 86, elevation: 1320 },
  { east: 26, north: 18, elevation: 1385 },
  { east: 52, north: -52, elevation: 1450 },
  { east: 18, north: -124, elevation: 1510 },
  { east: 66, north: -196, elevation: 1570 },
  { east: 28, north: -268, elevation: 1640 },
  { east: -44, north: -318, elevation: 1700 },
  { east: -10, north: -388, elevation: 1760 },
  { east: 34, north: -452, elevation: 1810 },
  { east: 62, north: -520, elevation: 1880 },
] as const;

function metersToLatitudeDelta(meters: number): number {
  return meters / 111_111;
}

function metersToLongitudeDelta(meters: number, latitude: number): number {
  const divisor = 111_111 * Math.cos((latitude * Math.PI) / 180);
  return divisor === 0 ? 0 : meters / divisor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatDurationClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

export function formatDistanceLabel(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatCompactDistance(meters: number): string {
  return (meters / 1000).toFixed(2);
}

export function formatElevationLabel(meters: number): string {
  return `${Math.round(meters)} m`;
}

export function formatPaceLabel(paceMinPerKm: number | null): string {
  if (paceMinPerKm == null || !Number.isFinite(paceMinPerKm)) {
    return '--';
  }

  const wholeMinutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - wholeMinutes) * 60);
  return `${wholeMinutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatGradeLabel(gradePercent: number): string {
  const prefix = gradePercent > 0 ? '+' : '';
  return `${prefix}${gradePercent.toFixed(1)}%`;
}

export function gradeColor(gradePercent: number): string {
  const absoluteGrade = Math.abs(gradePercent);
  if (absoluteGrade < 5) return '#65A30D';
  if (absoluteGrade < 10) return '#EAB308';
  if (absoluteGrade < 15) return '#F97316';
  return '#FF6B5A';
}

export function getGeoBounds(points: GeoCoordinate[]): GeoBounds {
  if (points.length === 0) {
    return {
      minLat: 37.7749,
      maxLat: 37.7759,
      minLng: -122.4194,
      maxLng: -122.4184,
    };
  }

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

export function expandBounds(bounds: GeoBounds, paddingFactor = 0.18): GeoBounds {
  const latPad = Math.max((bounds.maxLat - bounds.minLat) * paddingFactor, 0.0004);
  const lngPad = Math.max((bounds.maxLng - bounds.minLng) * paddingFactor, 0.0004);

  return {
    minLat: bounds.minLat - latPad,
    maxLat: bounds.maxLat + latPad,
    minLng: bounds.minLng - lngPad,
    maxLng: bounds.maxLng + lngPad,
  };
}

export function projectCoordinate(
  point: GeoCoordinate,
  bounds: GeoBounds,
  width: number,
  height: number,
  padding = 24,
): { x: number; y: number } {
  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.0001);
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.0001);

  const x = padding + ((point.lng - bounds.minLng) / lngRange) * usableWidth;
  const y = padding + (1 - (point.lat - bounds.minLat) / latRange) * usableHeight;

  return { x, y };
}

export function projectTrackPoints(
  points: TrackLikePoint[],
  width: number,
  height: number,
  padding = 24,
  explicitBounds?: GeoBounds,
): ProjectedTrackPoint[] {
  const bounds = expandBounds(explicitBounds ?? getGeoBounds(points));
  let cumulativeDistanceMeters = 0;

  return points.map((point, index) => {
    if (index > 0) {
      const previous = points[index - 1];
      cumulativeDistanceMeters += haversineDistance(
        previous.lat,
        previous.lng,
        point.lat,
        point.lng,
      );
    }

    return {
      ...point,
      ...projectCoordinate(point, bounds, width, height, padding),
      cumulativeDistanceMeters,
    };
  });
}

export function buildElevationSamples(points: TrackLikePoint[]): ElevationSample[] {
  if (points.length === 0) {
    return [];
  }

  const projected = projectTrackPoints(points, 1000, 320, 0);
  let cumulativeGainMeters = 0;
  let cumulativeLossMeters = 0;

  return projected.map((point, index) => {
    const previous = projected[index - 1];
    const elevationMeters = point.elevation ?? previous?.elevation ?? 0;
    const previousElevation = previous?.elevation ?? elevationMeters;
    const deltaElevation = elevationMeters - previousElevation;
    const deltaDistanceMeters = index > 0
      ? Math.max(point.cumulativeDistanceMeters - previous.cumulativeDistanceMeters, 1)
      : 1;

    if (deltaElevation > 0) {
      cumulativeGainMeters += deltaElevation;
    } else {
      cumulativeLossMeters += Math.abs(deltaElevation);
    }

    return {
      ...point,
      elevationMeters,
      gradePercent: index === 0 ? 0 : (deltaElevation / deltaDistanceMeters) * 100,
      cumulativeGainMeters,
      cumulativeLossMeters,
    };
  });
}

export function createTrackSummary(
  points: TrackLikePoint[],
  durationSeconds: number,
  weightKg = DEFAULT_WEIGHT_KG,
): TrackSummary {
  const elevationSamples = buildElevationSamples(points);
  const elevations = elevationSamples.map((sample) => sample.elevationMeters);
  const distanceMeters = elevationSamples.at(-1)?.cumulativeDistanceMeters ?? 0;
  const elevationGainMeters = calculateElevationGain(elevations);
  const elevationLossMeters = elevationSamples.at(-1)?.cumulativeLossMeters ?? 0;
  const paceMinPerKm = distanceMeters > 0 ? calculatePace(distanceMeters, durationSeconds) : null;
  const maxGradePercent = elevationSamples.reduce((largest, sample) => (
    Math.max(largest, Math.abs(sample.gradePercent))
  ), 0);

  if (elevations.length === 0) {
    return {
      distanceMeters,
      elevationGainMeters: 0,
      elevationLossMeters: 0,
      startElevationMeters: 0,
      maxElevationMeters: 0,
      endElevationMeters: 0,
      calories: estimateCalories(distanceMeters, 0, weightKg),
      paceMinPerKm,
      maxGradePercent,
    };
  }

  return {
    distanceMeters,
    elevationGainMeters,
    elevationLossMeters,
    startElevationMeters: elevations[0],
    maxElevationMeters: Math.max(...elevations),
    endElevationMeters: elevations[elevations.length - 1],
    calories: estimateCalories(distanceMeters, elevationGainMeters, weightKg),
    paceMinPerKm,
    maxGradePercent,
  };
}

export function summarizeTerrain(samples: ElevationSample[]): TerrainBucket[] {
  const totalDistanceMeters = samples.at(-1)?.cumulativeDistanceMeters ?? 0;
  const buckets = [
    { key: 'steep', label: 'Steep Climbs', hint: 'Above 15% grade', color: '#65A30D', icon: 'landscape' as const, distanceMeters: 0 },
    { key: 'moderate', label: 'Moderate Slope', hint: '5% to 15% grade', color: '#EAB308', icon: 'trending_up' as const, distanceMeters: 0 },
    { key: 'flat', label: 'Flat Terrain', hint: 'Below 5% grade', color: '#3B82F6', icon: 'terrain' as const, distanceMeters: 0 },
  ];

  for (let index = 1; index < samples.length; index += 1) {
    const current = samples[index];
    const previous = samples[index - 1];
    const distanceMeters = current.cumulativeDistanceMeters - previous.cumulativeDistanceMeters;
    const absoluteGrade = Math.abs(current.gradePercent);

    if (absoluteGrade >= 15) {
      buckets[0].distanceMeters += distanceMeters;
    } else if (absoluteGrade >= 5) {
      buckets[1].distanceMeters += distanceMeters;
    } else {
      buckets[2].distanceMeters += distanceMeters;
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    hint: bucket.hint,
    distanceMeters: bucket.distanceMeters,
    share: totalDistanceMeters > 0 ? bucket.distanceMeters / totalDistanceMeters : 0,
    color: bucket.color,
    icon: bucket.icon,
  }));
}

export function createSyntheticRoute(origin: GeoCoordinate): TrackLikePoint[] {
  return DEFAULT_ROUTE_SHAPE.map((point, index) => {
    const lat = origin.lat + metersToLatitudeDelta(point.north);
    const lng = origin.lng + metersToLongitudeDelta(point.east, origin.lat);
    return {
      lat,
      lng,
      elevation: point.elevation,
      timestamp: new Date(Date.now() + index * 45_000).toISOString(),
      accuracy: 6,
    };
  });
}

export function sampleSyntheticRouteAtProgress(
  route: TrackLikePoint[],
  progress: number,
  deviationOffsetMeters?: { east: number; north: number },
): TrackLikePoint {
  if (route.length === 0) {
    return {
      lat: 37.7749,
      lng: -122.4194,
      elevation: 0,
      timestamp: new Date().toISOString(),
      accuracy: 6,
    };
  }

  const clampedProgress = clamp(progress, 0, Math.max(route.length - 1.001, 0));
  const lowerIndex = Math.floor(clampedProgress);
  const upperIndex = Math.min(route.length - 1, lowerIndex + 1);
  const blend = clampedProgress - lowerIndex;
  const lower = route[lowerIndex];
  const upper = route[upperIndex];
  const lat = lower.lat + (upper.lat - lower.lat) * blend;
  const lng = lower.lng + (upper.lng - lower.lng) * blend;
  const elevation = (lower.elevation ?? 0) + ((upper.elevation ?? 0) - (lower.elevation ?? 0)) * blend;

  const northOffset = deviationOffsetMeters?.north ?? 0;
  const eastOffset = deviationOffsetMeters?.east ?? 0;

  return {
    lat: lat + metersToLatitudeDelta(northOffset),
    lng: lng + metersToLongitudeDelta(eastOffset, lat),
    elevation,
    timestamp: new Date().toISOString(),
    accuracy: Math.abs(northOffset) + Math.abs(eastOffset) > 0 ? 9 : 6,
  };
}
