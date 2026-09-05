import type { DatabaseAdapter } from '@mylife/db';
import type {
  Trail,
  TrailDatabaseEntry,
  TrailDifficulty,
  TrailType,
} from './types';
import { getDatabaseEntries, getTrails, searchDatabaseTrails } from './db/crud';

export interface TrailFeaturedRegion {
  id: string;
  name: string;
  trailCount: number;
  centerLat: number;
  centerLng: number;
  averageDistanceMeters: number | null;
  dominantDifficulty: TrailDifficulty | null;
  sampleTrail: TrailDatabaseEntry;
  trailTypes: TrailType[];
}

export interface TrailDiscoveryCollection {
  id: string;
  title: string;
  description: string;
  entries: TrailDatabaseEntry[];
}

export interface TrailRecommendation {
  trail: TrailDatabaseEntry;
  reason: string;
  score: number;
  matchedTrailName: string | null;
}

interface CollectionPreset {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  fallback: (entry: TrailDatabaseEntry) => boolean;
}

const COLLECTION_PRESETS: CollectionPreset[] = [
  {
    id: 'wildflower-hikes',
    title: 'Best Wildflower Hikes',
    description: 'Bloom-heavy routes with color, meadows, and spring payoff.',
    keywords: ['wildflower', 'flower', 'bloom', 'meadow', 'garden'],
    fallback: (entry) =>
      (entry.difficulty === 'easy' || entry.difficulty === 'moderate' || entry.difficulty === null) &&
      (entry.distanceMeters ?? 0) <= 12_000,
  },
  {
    id: 'epic-waterfalls',
    title: 'Epic Waterfalls',
    description: 'Waterfall, creek, and cascade routes that reward the climb.',
    keywords: ['waterfall', 'falls', 'cascade', 'river', 'creek'],
    fallback: (entry) =>
      (entry.elevationGainMeters ?? 0) >= 250 &&
      (entry.distanceMeters ?? 0) <= 16_000,
  },
  {
    id: 'alpine-lakes',
    title: 'Alpine Lakes',
    description: 'High-country lines that end in lakes, tarns, or alpine bowls.',
    keywords: ['alpine', 'lake', 'tarn', 'basin', 'summit'],
    fallback: (entry) =>
      (entry.elevationGainMeters ?? 0) >= 500 ||
      /alps|rockies|sierra|cascade/i.test(entry.region ?? ''),
  },
  {
    id: 'family-friendly',
    title: 'Family Friendly',
    description: 'Shorter, lower-gain trails that stay approachable for mixed groups.',
    keywords: ['family', 'accessible', 'picnic', 'lake loop'],
    fallback: (entry) =>
      (entry.difficulty === 'easy' || entry.difficulty === null) &&
      (entry.distanceMeters ?? 0) <= 7_000 &&
      (entry.elevationGainMeters ?? 0) <= 220,
  },
];

const DIFFICULTY_ORDER: TrailDifficulty[] = ['easy', 'moderate', 'hard', 'expert'];

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function dominantDifficulty(entries: TrailDatabaseEntry[]): TrailDifficulty | null {
  const counts = new Map<TrailDifficulty, number>();

  for (const entry of entries) {
    if (!entry.difficulty) {
      continue;
    }

    counts.set(entry.difficulty, (counts.get(entry.difficulty) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return DIFFICULTY_ORDER.indexOf(left[0]) - DIFFICULTY_ORDER.indexOf(right[0]);
  });

  return ranked[0]?.[0] ?? null;
}

function difficultyScore(level: TrailDifficulty | null): number {
  switch (level) {
    case 'easy':
      return 6;
    case 'moderate':
      return 8;
    case 'hard':
      return 9;
    case 'expert':
      return 10;
    default:
      return 4;
  }
}

function recencyScore(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  const ageDays = Math.max(0, (Date.now() - parsed) / 86_400_000);
  return Math.max(0, 40 - ageDays);
}

function metadataScore(entry: TrailDatabaseEntry): number {
  return [
    entry.description ? 10 : 0,
    entry.distanceMeters != null ? 6 : 0,
    entry.elevationGainMeters != null ? 6 : 0,
    entry.region ? 4 : 0,
    entry.routeGeometry ? 4 : 0,
  ].reduce((total, score) => total + score, 0);
}

function nameKeywordScore(entry: TrailDatabaseEntry): number {
  const haystack = `${entry.name} ${entry.description ?? ''} ${entry.region ?? ''}`.toLowerCase();
  const keywords = ['summit', 'falls', 'ridge', 'pass', 'alpine', 'overlook', 'lake'];
  return keywords.reduce((score, keyword) => (haystack.includes(keyword) ? score + 2 : score), 0);
}

function toEntryKey(entry: TrailDatabaseEntry): string {
  return `${normalizeText(entry.name)}::${normalizeText(entry.region)}`;
}

function toTrailKey(trail: Trail): string {
  return `${normalizeText(trail.name)}::${normalizeText(trail.region)}`;
}

function matchesCollection(entry: TrailDatabaseEntry, preset: CollectionPreset): boolean {
  const haystack = `${entry.name} ${entry.description ?? ''} ${entry.region ?? ''} ${entry.surface ?? ''}`.toLowerCase();

  if (preset.keywords.some((keyword) => haystack.includes(keyword))) {
    return true;
  }

  return preset.fallback(entry);
}

export function searchTrailDatabase(
  db: DatabaseAdapter,
  query: string,
  limit = 50,
): TrailDatabaseEntry[] {
  return searchDatabaseTrails(db, query, limit);
}

export function getFeaturedRegions(
  db: DatabaseAdapter,
  options?: { limit?: number },
): TrailFeaturedRegion[] {
  const entries = getDatabaseEntries(db, { limit: 400 });
  const grouped = new Map<string, TrailDatabaseEntry[]>();

  for (const entry of entries) {
    if (!entry.region) {
      continue;
    }

    const existing = grouped.get(entry.region) ?? [];
    existing.push(entry);
    grouped.set(entry.region, existing);
  }

  return Array.from(grouped.entries())
    .map(([name, regionEntries]) => {
      const distances = regionEntries
        .map((entry) => entry.distanceMeters)
        .filter((value): value is number => value != null);
      const trailTypes = Array.from(new Set(regionEntries.map((entry) => entry.trailType)));
      const sampleTrail = [...regionEntries].sort((left, right) => {
        const leftScore = metadataScore(left) + difficultyScore(left.difficulty);
        const rightScore = metadataScore(right) + difficultyScore(right.difficulty);
        return rightScore - leftScore;
      })[0];

      return {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        trailCount: regionEntries.length,
        centerLat: regionEntries.reduce((total, entry) => total + entry.lat, 0) / regionEntries.length,
        centerLng: regionEntries.reduce((total, entry) => total + entry.lng, 0) / regionEntries.length,
        averageDistanceMeters: average(distances),
        dominantDifficulty: dominantDifficulty(regionEntries),
        sampleTrail,
        trailTypes,
      } satisfies TrailFeaturedRegion;
    })
    .sort((left, right) => {
      if (right.trailCount !== left.trailCount) {
        return right.trailCount - left.trailCount;
      }

      return (right.averageDistanceMeters ?? 0) - (left.averageDistanceMeters ?? 0);
    })
    .slice(0, options?.limit ?? 6);
}

export function getTrendingTrails(
  db: DatabaseAdapter,
  options?: { limit?: number },
): TrailDatabaseEntry[] {
  return getDatabaseEntries(db, { limit: 200 })
    .map((entry) => ({
      entry,
      score:
        recencyScore(entry.fetchedAt) * 2.5 +
        metadataScore(entry) +
        difficultyScore(entry.difficulty) +
        nameKeywordScore(entry),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, options?.limit ?? 6)
    .map(({ entry }) => entry);
}

export function getCollections(
  db: DatabaseAdapter,
  options?: { limit?: number; entriesPerCollection?: number },
): TrailDiscoveryCollection[] {
  const entries = getDatabaseEntries(db, { limit: 300 });
  const entriesPerCollection = options?.entriesPerCollection ?? 4;

  return COLLECTION_PRESETS.map((preset) => {
    const matchingEntries = entries
      .filter((entry) => matchesCollection(entry, preset))
      .sort((left, right) => {
        const leftScore = metadataScore(left) + difficultyScore(left.difficulty);
        const rightScore = metadataScore(right) + difficultyScore(right.difficulty);
        return rightScore - leftScore;
      })
      .slice(0, entriesPerCollection);

    return {
      id: preset.id,
      title: preset.title,
      description: preset.description,
      entries: matchingEntries,
    } satisfies TrailDiscoveryCollection;
  })
    .filter((collection) => collection.entries.length > 0)
    .slice(0, options?.limit ?? COLLECTION_PRESETS.length);
}

export function getRecommendedTrails(
  db: DatabaseAdapter,
  options?: { difficulty?: TrailDifficulty; limit?: number },
): TrailRecommendation[] {
  const entries = getDatabaseEntries(db, { limit: 300 });
  const history = getTrails(db, { limit: 120 });
  const seenTrailKeys = new Set(history.map(toTrailKey));
  const preferredDifficulty = options?.difficulty ?? dominantDifficulty(
    history.map((trail) => ({
      id: trail.id,
      osmId: null,
      name: trail.name,
      description: trail.description,
      difficulty: trail.difficulty,
      distanceMeters: trail.distanceMeters,
      elevationGainMeters: trail.elevationGainMeters,
      lat: trail.lat,
      lng: trail.lng,
      region: trail.region,
      trailType: 'hiking',
      surface: null,
      routeGeometry: null,
      source: 'history',
      fetchedAt: trail.createdAt,
      createdAt: trail.createdAt,
    })),
  );

  const recentHistory = history.slice(0, 8);

  const recommendations = entries
    .filter((entry) => !seenTrailKeys.has(toEntryKey(entry)))
    .map((entry) => {
      let score = metadataScore(entry) + recencyScore(entry.fetchedAt);
      let reason = 'Fresh route details with strong discovery metadata.';
      let matchedTrailName: string | null = null;

      if (preferredDifficulty && entry.difficulty === preferredDifficulty) {
        score += 16;
        reason = `${preferredDifficulty[0].toUpperCase()}${preferredDifficulty.slice(1)} difficulty based on your recent hikes.`;
      }

      const matchedTrail = recentHistory.find((trail) => {
        const sameRegion =
          trail.region != null &&
          entry.region != null &&
          normalizeText(trail.region) === normalizeText(entry.region);
        const sameDifficulty = trail.difficulty === entry.difficulty;
        return sameRegion || sameDifficulty;
      });

      if (matchedTrail) {
        matchedTrailName = matchedTrail.name;
        score += 24;
        if (
          matchedTrail.region != null &&
          entry.region != null &&
          normalizeText(matchedTrail.region) === normalizeText(entry.region)
        ) {
          reason = `Because you explored ${matchedTrail.region} on ${matchedTrail.name}.`;
        } else {
          reason = `Because you hiked ${matchedTrail.name}.`;
        }
      }

      return {
        trail: entry,
        reason,
        score: score + difficultyScore(entry.difficulty),
        matchedTrailName,
      } satisfies TrailRecommendation;
    })
    .sort((left, right) => right.score - left.score);

  if (recommendations.length === 0) {
    return getTrendingTrails(db, { limit: options?.limit ?? 4 }).map((trail) => ({
      trail,
      reason: 'A strong place to start building your trail library.',
      score: metadataScore(trail) + difficultyScore(trail.difficulty),
      matchedTrailName: null,
    }));
  }

  return recommendations.slice(0, options?.limit ?? 4);
}
