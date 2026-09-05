import type { DatabaseAdapter } from '@mylife/db';
import {
  WeatherForecastSchema,
  getAverageRating,
  getCachedWeather,
  getRecordings,
  getReviewCount,
  getTrail,
  getTrails,
  haversineDistance,
  type Trail,
  type TrailDifficulty,
  type TrailRecording,
  type WeatherForecast,
} from '@mylife/trails';

export type RecordingPeriod = 'week' | 'month' | 'year';
export type TrailSortMode = 'recommended' | 'distance' | 'elevation' | 'rating';
export type TrailTypeFilter = 'all' | 'loop' | 'out_and_back' | 'point_to_point';
export type InferredTrailType = Exclude<TrailTypeFilter, 'all'>;

export interface TrailCardModel extends Trail {
  trailType: InferredTrailType;
  rating: number | null;
  reviewCount: number;
  distanceFromAnchorMeters: number;
  completedCount: number;
  recommendedScore: number;
}

export interface RecordingCardModel extends TrailRecording {
  trail: Trail | null;
  difficulty: TrailDifficulty | null;
}

export interface HomeTabData {
  anchor: { lat: number; lng: number };
  heroTrail: TrailCardModel | null;
  heroRecording: RecordingCardModel | null;
  liveGpsActive: boolean;
  nearbyTrails: TrailCardModel[];
  recentRecordings: RecordingCardModel[];
  weather: WeatherForecast | null;
  monthSummary: {
    totalDistanceMeters: number;
    totalElevationGainMeters: number;
    trailsCompleted: number;
    activeDays: number;
  };
}

export interface RecordingSummary {
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  totalDurationSeconds: number;
  trailCount: number;
  deltaDistancePct: number | null;
  deltaElevationPct: number | null;
  deltaDurationPct: number | null;
}

export interface RecordingTrendPoint {
  label: string;
  distanceKm: number;
  elevationGainMeters: number;
}

export interface GroupedRecordings {
  label: string;
  items: RecordingCardModel[];
}

const DEFAULT_CENTER = { lat: 37.8651, lng: -119.5383 };

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clampPercent(value: number): number {
  return Math.max(-100, Math.min(1000, value));
}

function toCalendarDay(iso: string): string {
  return iso.slice(0, 10);
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getWeekBucketLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getMonthBucketLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
  }).format(date);
}

function isWithinRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function getRangeForPeriod(period: RecordingPeriod, baseDate = new Date()) {
  const end = new Date(baseDate);

  if (period === 'week') {
    const start = new Date(baseDate);
    start.setUTCDate(baseDate.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);

    const previousEnd = new Date(start);
    previousEnd.setUTCDate(start.getUTCDate() - 1);
    previousEnd.setUTCHours(23, 59, 59, 999);

    const previousStart = new Date(previousEnd);
    previousStart.setUTCDate(previousEnd.getUTCDate() - 6);
    previousStart.setUTCHours(0, 0, 0, 0);

    return { start, end, previousStart, previousEnd };
  }

  if (period === 'month') {
    const start = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));
    const previousStart = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() - 1, 1));
    const previousEnd = new Date(start.getTime() - 1);
    return { start, end, previousStart, previousEnd };
  }

  const start = new Date(Date.UTC(baseDate.getUTCFullYear(), 0, 1));
  const previousStart = new Date(Date.UTC(baseDate.getUTCFullYear() - 1, 0, 1));
  const previousEnd = new Date(start.getTime() - 1);
  return { start, end, previousStart, previousEnd };
}

function percentageChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : null;
  }

  return clampPercent(((current - previous) / previous) * 100);
}

export function getRecordingModels(
  db: DatabaseAdapter,
  limit = 200,
): RecordingCardModel[] {
  return getRecordings(db, { limit }).map((recording) => {
    const trail = recording.trailId ? getTrail(db, recording.trailId) : null;
    return {
      ...recording,
      trail,
      difficulty: trail?.difficulty ?? null,
    };
  });
}

function getAnchorFromRecordings(recordings: RecordingCardModel[]): { lat: number; lng: number } | null {
  const recordingWithTrail = recordings.find((recording) => recording.trail);
  if (recordingWithTrail?.trail) {
    return {
      lat: recordingWithTrail.trail.lat,
      lng: recordingWithTrail.trail.lng,
    };
  }

  return null;
}

export function inferTrailType(trail: Trail): InferredTrailType {
  const seed = hashString(`${trail.id}:${trail.name}`);

  if (trail.distanceMeters < 4500) {
    return 'loop';
  }

  if (seed % 3 === 0) {
    return 'point_to_point';
  }

  return seed % 2 === 0 ? 'out_and_back' : 'loop';
}

export function getTrailAnchor(
  trails: Trail[],
  recordings: RecordingCardModel[],
): { lat: number; lng: number } {
  const fromRecordings = getAnchorFromRecordings(recordings);
  if (fromRecordings) {
    return fromRecordings;
  }

  const preferredTrail = trails.find((trail) => trail.isSaved) ?? trails[0];
  if (preferredTrail) {
    return { lat: preferredTrail.lat, lng: preferredTrail.lng };
  }

  return DEFAULT_CENTER;
}

export function buildTrailModels(db: DatabaseAdapter): TrailCardModel[] {
  const trails = getTrails(db, { limit: 200 });
  const recordings = getRecordingModels(db, 240);
  const anchor = getTrailAnchor(trails, recordings);

  const completionsByTrail = recordings.reduce<Map<string, number>>((accumulator, recording) => {
    if (recording.trailId && recording.endedAt) {
      accumulator.set(
        recording.trailId,
        (accumulator.get(recording.trailId) ?? 0) + 1,
      );
    }
    return accumulator;
  }, new Map<string, number>());

  return trails
    .map((trail) => {
      const rating = getAverageRating(db, trail.id);
      const reviewCount = getReviewCount(db, trail.id);
      const completedCount = completionsByTrail.get(trail.id) ?? 0;
      const distanceFromAnchorMeters = haversineDistance(
        anchor.lat,
        anchor.lng,
        trail.lat,
        trail.lng,
      );
      const recommendedScore =
        (trail.isSaved ? 200 : 0) +
        completedCount * 35 +
        (rating ?? 0) * 18 +
        reviewCount * 2 +
        Math.max(0, 120 - distanceFromAnchorMeters / 600) +
        Math.max(0, 80 - trail.distanceMeters / 150);

      return {
        ...trail,
        trailType: inferTrailType(trail),
        rating,
        reviewCount,
        completedCount,
        distanceFromAnchorMeters,
        recommendedScore,
      };
    })
    .sort((left, right) => right.recommendedScore - left.recommendedScore);
}

export function filterTrailModels(
  models: TrailCardModel[],
  filters: {
    search?: string;
    difficulty?: TrailDifficulty | 'all';
    trailType?: TrailTypeFilter;
    maxDistanceMiles?: number;
    sort?: TrailSortMode;
  },
): TrailCardModel[] {
  const search = filters.search?.trim().toLowerCase() ?? '';
  const difficulty = filters.difficulty ?? 'all';
  const trailType = filters.trailType ?? 'all';
  const maxDistanceMiles = filters.maxDistanceMiles ?? 50;

  const filtered = models.filter((trail) => {
    if (difficulty !== 'all' && trail.difficulty !== difficulty) {
      return false;
    }

    if (trailType !== 'all' && trail.trailType !== trailType) {
      return false;
    }

    if (search) {
      const haystack = `${trail.name} ${trail.region ?? ''} ${trail.description ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (maxDistanceMiles < 50) {
      const milesFromAnchor = trail.distanceFromAnchorMeters / 1609.34;
      if (milesFromAnchor > maxDistanceMiles) {
        return false;
      }
    }

    return true;
  });

  const sort = filters.sort ?? 'recommended';

  return filtered.sort((left, right) => {
    if (sort === 'distance') {
      return left.distanceMeters - right.distanceMeters;
    }
    if (sort === 'elevation') {
      return right.elevationGainMeters - left.elevationGainMeters;
    }
    if (sort === 'rating') {
      return (right.rating ?? 0) - (left.rating ?? 0);
    }
    return right.recommendedScore - left.recommendedScore;
  });
}

export function parseWeatherForecast(raw: string | null | undefined): WeatherForecast | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const result = WeatherForecastSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function getHomeTabData(db: DatabaseAdapter): HomeTabData {
  const trailModels = buildTrailModels(db);
  const recordings = getRecordingModels(db, 24);
  const anchor = getTrailAnchor(trailModels, recordings);
  const { start, end } = getRangeForPeriod('month');

  const monthRecordings = recordings.filter((recording) =>
    isWithinRange(new Date(recording.startedAt), start, end),
  );

  const weather = parseWeatherForecast(
    getCachedWeather(db, anchor.lat, anchor.lng)?.conditionsJson,
  );

  return {
    anchor,
    heroTrail: trailModels[0] ?? null,
    heroRecording: recordings[0] ?? null,
    liveGpsActive: recordings.some((recording) => recording.endedAt === null),
    nearbyTrails: trailModels
      .slice()
      .sort((left, right) => left.distanceFromAnchorMeters - right.distanceFromAnchorMeters)
      .slice(0, 6),
    recentRecordings: recordings.slice(0, 6),
    weather,
    monthSummary: {
      totalDistanceMeters: monthRecordings.reduce(
        (sum, recording) => sum + recording.distanceMeters,
        0,
      ),
      totalElevationGainMeters: monthRecordings.reduce(
        (sum, recording) => sum + recording.elevationGainMeters,
        0,
      ),
      trailsCompleted: new Set(
        monthRecordings
          .filter((recording) => recording.trailId && recording.endedAt)
          .map((recording) => recording.trailId),
      ).size,
      activeDays: new Set(monthRecordings.map((recording) => toCalendarDay(recording.startedAt))).size,
    },
  };
}

export function getSavedTrailModels(models: TrailCardModel[], limit = 6): TrailCardModel[] {
  return models.filter((trail) => trail.isSaved).slice(0, limit);
}

export function getRecentlyCompletedTrailModels(
  models: TrailCardModel[],
  limit = 6,
): TrailCardModel[] {
  return models.filter((trail) => trail.completedCount > 0).slice(0, limit);
}

export function getRecordingSummary(
  recordings: RecordingCardModel[],
  period: RecordingPeriod,
): RecordingSummary {
  const { start, end, previousStart, previousEnd } = getRangeForPeriod(period);
  const current = recordings.filter((recording) =>
    isWithinRange(new Date(recording.startedAt), start, end),
  );
  const previous = recordings.filter((recording) =>
    isWithinRange(new Date(recording.startedAt), previousStart, previousEnd),
  );

  const totalDistanceMeters = current.reduce((sum, recording) => sum + recording.distanceMeters, 0);
  const totalElevationGainMeters = current.reduce(
    (sum, recording) => sum + recording.elevationGainMeters,
    0,
  );
  const totalDurationSeconds = current.reduce((sum, recording) => sum + recording.durationSeconds, 0);

  const previousDistanceMeters = previous.reduce((sum, recording) => sum + recording.distanceMeters, 0);
  const previousElevationGainMeters = previous.reduce(
    (sum, recording) => sum + recording.elevationGainMeters,
    0,
  );
  const previousDurationSeconds = previous.reduce((sum, recording) => sum + recording.durationSeconds, 0);

  return {
    totalDistanceMeters,
    totalElevationGainMeters,
    totalDurationSeconds,
    trailCount: new Set(current.map((recording) => recording.trailId ?? recording.id)).size,
    deltaDistancePct: percentageChange(totalDistanceMeters, previousDistanceMeters),
    deltaElevationPct: percentageChange(totalElevationGainMeters, previousElevationGainMeters),
    deltaDurationPct: percentageChange(totalDurationSeconds, previousDurationSeconds),
  };
}

export function getRecordingTrend(
  recordings: RecordingCardModel[],
  period: RecordingPeriod,
): RecordingTrendPoint[] {
  const { start, end } = getRangeForPeriod(period);
  const source = recordings.filter((recording) =>
    isWithinRange(new Date(recording.startedAt), start, end),
  );

  if (period === 'week') {
    const buckets = new Map<string, RecordingTrendPoint>();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(end);
      date.setUTCDate(end.getUTCDate() - offset);
      const label = getWeekBucketLabel(date);
      buckets.set(label, { label, distanceKm: 0, elevationGainMeters: 0 });
    }

    for (const recording of source) {
      const label = getWeekBucketLabel(new Date(recording.startedAt));
      const bucket = buckets.get(label);
      if (!bucket) continue;
      bucket.distanceKm += recording.distanceMeters / 1000;
      bucket.elevationGainMeters += recording.elevationGainMeters;
    }

    return [...buckets.values()];
  }

  if (period === 'month') {
    const buckets = new Map<number, RecordingTrendPoint>();

    for (let weekIndex = 0; weekIndex < 5; weekIndex += 1) {
      buckets.set(weekIndex, {
        label: `W${weekIndex + 1}`,
        distanceKm: 0,
        elevationGainMeters: 0,
      });
    }

    for (const recording of source) {
      const day = new Date(recording.startedAt).getUTCDate();
      const bucketIndex = Math.min(4, Math.floor((day - 1) / 7));
      const bucket = buckets.get(bucketIndex);
      if (!bucket) continue;
      bucket.distanceKm += recording.distanceMeters / 1000;
      bucket.elevationGainMeters += recording.elevationGainMeters;
    }

    return [...buckets.values()];
  }

  const buckets = new Map<string, RecordingTrendPoint>();

  for (let monthOffset = 5; monthOffset >= 0; monthOffset -= 1) {
    const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - monthOffset, 1));
    const label = getMonthBucketLabel(date);
    buckets.set(getMonthKey(date), {
      label,
      distanceKm: 0,
      elevationGainMeters: 0,
    });
  }

  for (const recording of source) {
    const key = getMonthKey(new Date(recording.startedAt));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.distanceKm += recording.distanceMeters / 1000;
    bucket.elevationGainMeters += recording.elevationGainMeters;
  }

  return [...buckets.values()];
}

export function groupRecordingsByMonth(
  recordings: RecordingCardModel[],
): GroupedRecordings[] {
  const grouped = new Map<string, RecordingCardModel[]>();

  for (const recording of recordings) {
    const monthLabel = new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
    }).format(new Date(recording.startedAt));
    const items = grouped.get(monthLabel) ?? [];
    items.push(recording);
    grouped.set(monthLabel, items);
  }

  return [...grouped.entries()].map(([label, items]) => ({ label, items }));
}
