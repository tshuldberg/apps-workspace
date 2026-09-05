import type { PackingItem, PackingTemplateType, Trail, Trip } from '@mylife/trails';

export type PackingFilterValue = 'all' | PackingTemplateType;

export interface PackingItemGroup {
  key: string;
  name: string;
  category: string;
  itemIds: string[];
  quantity: number;
  checkedCount: number;
  allChecked: boolean;
  partiallyChecked: boolean;
  estimatedWeightGrams: number;
  sortOrder: number;
}

export interface TripWeatherDay {
  key: string;
  label: string;
  condition: string;
  temperature: number;
}

export interface RegionChoice {
  name: string;
  count: number;
  lat: number;
  lng: number;
}

export const PACKING_FILTERS: ReadonlyArray<{
  label: string;
  value: PackingFilterValue;
}> = [
  { label: 'All', value: 'all' },
  { label: 'Day Hike', value: 'day_hike' },
  { label: 'Backpacking', value: 'backpacking' },
  { label: 'Winter', value: 'winter' },
  { label: 'Custom', value: 'custom' },
];

export const PACKING_CATEGORY_ORDER = [
  'shelter',
  'sleep',
  'kitchen',
  'clothing',
  'safety',
  'navigation',
  'essentials',
  'food_water',
  'misc',
] as const;

const PACKING_TYPE_LABELS: Record<PackingTemplateType, string> = {
  day_hike: 'Day Hike',
  overnight: 'Overnight',
  backpacking: 'Backpacking',
  winter: 'Winter',
  trail_run: 'Trail Run',
  custom: 'Custom',
};

const PACKING_CATEGORY_LABELS: Record<string, string> = {
  shelter: 'Shelter',
  sleep: 'Sleep',
  kitchen: 'Kitchen',
  clothing: 'Clothing',
  safety: 'Safety',
  navigation: 'Navigation',
  essentials: 'Essentials',
  food_water: 'Food + Water',
  misc: 'Misc',
};

const CATEGORY_BASE_WEIGHTS: Record<string, number> = {
  shelter: 1200,
  sleep: 780,
  kitchen: 360,
  clothing: 240,
  safety: 180,
  navigation: 120,
  essentials: 320,
  food_water: 520,
  misc: 180,
};

const KEYWORD_WEIGHTS: ReadonlyArray<{ pattern: RegExp; grams: number }> = [
  { pattern: /water|hydration|thermos/i, grams: 1000 },
  { pattern: /meal|ration|snack|gel|electrolyte|lunch/i, grams: 340 },
  { pattern: /stove|fuel|pot|utensil|cook/i, grams: 280 },
  { pattern: /tent|tarp/i, grams: 1450 },
  { pattern: /sleeping bag|quilt/i, grams: 980 },
  { pattern: /sleeping pad|pad/i, grams: 440 },
  { pattern: /backpack|vest|belt/i, grams: 980 },
  { pattern: /boot|shoe|microspike|crampon/i, grams: 940 },
  { pattern: /sock|glove|hat|balaclava/i, grams: 90 },
  { pattern: /jacket|shell|fleece|base layer|shirt|short/i, grams: 260 },
  { pattern: /filter|compass|map|gps|watch/i, grams: 110 },
  { pattern: /headlamp|battery|phone|bank/i, grams: 190 },
  { pattern: /first aid|blanket|beacon|whistle|knife/i, grams: 180 },
  { pattern: /permit|pass|id/i, grams: 20 },
];

const WEATHER_CONDITIONS = [
  'Clear sky',
  'Partly cloudy',
  'Overcast',
  'Moderate rain',
  'Snow showers',
] as const;

const FALLBACK_REGIONS = [
  { name: 'Alpine Lakes', count: 0, lat: 47.54, lng: -121.36 },
  { name: 'Yosemite', count: 0, lat: 37.7459, lng: -119.5332 },
  { name: 'Sierra Crest', count: 0, lat: 36.5786, lng: -118.2923 },
  { name: 'Cascade Range', count: 0, lat: 46.8523, lng: -121.7603 },
] as const;

function normalizeDateOnly(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function formatTemplateType(type: PackingTemplateType): string {
  return PACKING_TYPE_LABELS[type];
}

export function formatPackingCategory(category: string): string {
  return PACKING_CATEGORY_LABELS[category] ?? toTitleCase(category.replace(/_/g, ' '));
}

export function isConsumableCategory(category: string): boolean {
  return category === 'food_water' || category === 'kitchen';
}

export function estimateItemWeightGrams(name: string, category: string): number {
  const keywordMatch = KEYWORD_WEIGHTS.find((entry) => entry.pattern.test(name));
  if (keywordMatch) {
    return keywordMatch.grams;
  }

  return CATEGORY_BASE_WEIGHTS[category] ?? CATEGORY_BASE_WEIGHTS.misc;
}

export function groupPackingItems(items: PackingItem[]): PackingItemGroup[] {
  const byKey = new Map<
    string,
    {
      name: string;
      category: string;
      itemIds: string[];
      checkedCount: number;
      sortOrder: number;
    }
  >();

  for (const item of items) {
    const key = `${item.category}::${item.name.trim().toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.itemIds.push(item.id);
      existing.sortOrder = Math.min(existing.sortOrder, item.sortOrder);
      if (item.isChecked) {
        existing.checkedCount += 1;
      }
      continue;
    }

    byKey.set(key, {
      name: item.name,
      category: item.category,
      itemIds: [item.id],
      checkedCount: item.isChecked ? 1 : 0,
      sortOrder: item.sortOrder,
    });
  }

  return Array.from(byKey.entries())
    .map(([key, entry]) => {
      const quantity = entry.itemIds.length;
      const estimatedWeightGrams = estimateItemWeightGrams(entry.name, entry.category);
      return {
        key,
        name: entry.name,
        category: entry.category,
        itemIds: entry.itemIds,
        quantity,
        checkedCount: entry.checkedCount,
        allChecked: entry.checkedCount === quantity,
        partiallyChecked: entry.checkedCount > 0 && entry.checkedCount < quantity,
        estimatedWeightGrams,
        sortOrder: entry.sortOrder,
      };
    })
    .sort((left, right) => {
      const leftIndex = PACKING_CATEGORY_ORDER.indexOf(left.category as (typeof PACKING_CATEGORY_ORDER)[number]);
      const rightIndex = PACKING_CATEGORY_ORDER.indexOf(right.category as (typeof PACKING_CATEGORY_ORDER)[number]);
      if (leftIndex !== rightIndex) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
          - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.name.localeCompare(right.name);
    });
}

export function computePackingTotals(groups: PackingItemGroup[]) {
  return groups.reduce(
    (totals, group) => {
      const itemWeight = group.estimatedWeightGrams * group.quantity;
      if (isConsumableCategory(group.category)) {
        totals.consumablesGrams += itemWeight;
      } else {
        totals.baseWeightGrams += itemWeight;
      }
      totals.totalWeightGrams += itemWeight;
      totals.checkedCount += group.checkedCount;
      totals.totalCount += group.quantity;
      return totals;
    },
    {
      baseWeightGrams: 0,
      consumablesGrams: 0,
      totalWeightGrams: 0,
      checkedCount: 0,
      totalCount: 0,
    },
  );
}

export function formatWeight(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} kg`;
  }
  return `${Math.round(value)} g`;
}

export function deriveTripStatus(trip: Trip, todayDate = new Date()): 'upcoming' | 'past' | 'draft' {
  if (!trip.startDate) {
    return 'draft';
  }

  const today = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const endDate = normalizeDateOnly(trip.endDate ?? trip.startDate);
  if (endDate && endDate < today) {
    return 'past';
  }

  return 'upcoming';
}

export function getTripDurationDays(trip: Pick<Trip, 'startDate' | 'endDate'>): number {
  const startDate = normalizeDateOnly(trip.startDate);
  const endDate = normalizeDateOnly(trip.endDate ?? trip.startDate);
  if (!startDate || !endDate) {
    return 1;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

export function buildTripWeather(seed: string, startDate: string | null, totalDays: number): TripWeatherDay[] {
  const dayCount = Math.min(Math.max(totalDays, 3), 5);
  const baseHash = hashString(seed);
  const start = normalizeDateOnly(startDate) ?? new Date();

  return Array.from({ length: dayCount }, (_, index) => {
    const currentDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const weatherIndex = (baseHash + index) % WEATHER_CONDITIONS.length;
    const temperature = 5 + ((baseHash >> (index % 8)) % 17) + index;
    return {
      key: `${seed}-${index}`,
      label: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
      condition: WEATHER_CONDITIONS[weatherIndex],
      temperature,
    };
  });
}

export function formatTripDateRange(trip: Pick<Trip, 'startDate' | 'endDate'>): string {
  const startDate = normalizeDateOnly(trip.startDate);
  if (!startDate) {
    return 'Flexible dates';
  }

  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const startLabel = formatter.format(startDate);
  const endDate = normalizeDateOnly(trip.endDate);
  if (!endDate) {
    return startLabel;
  }

  return `${startLabel} - ${formatter.format(endDate)}`;
}

export function buildRegionChoices(trails: Trail[]): RegionChoice[] {
  const byRegion = new Map<string, RegionChoice>();
  trails.forEach((trail) => {
    if (!trail.region) {
      return;
    }

    const existing = byRegion.get(trail.region);
    if (existing) {
      existing.count += 1;
      return;
    }

    byRegion.set(trail.region, {
      name: trail.region,
      count: 1,
      lat: trail.lat,
      lng: trail.lng,
    });
  });

  if (byRegion.size === 0) {
    return [...FALLBACK_REGIONS];
  }

  return Array.from(byRegion.values()).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export function extractTripRegion(notes: string | null | undefined): string | null {
  if (!notes) {
    return null;
  }

  const regionLine = notes
    .split('\n')
    .find((line) => line.toLowerCase().startsWith('region:'));

  if (!regionLine) {
    return null;
  }

  return regionLine.slice(regionLine.indexOf(':') + 1).trim() || null;
}

export function stripTripMetadata(notes: string | null | undefined): string | null {
  if (!notes) {
    return null;
  }

  const cleaned = notes
    .split('\n')
    .filter((line) => !line.toLowerCase().startsWith('region:'))
    .join('\n')
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

export function composeTripNotes(region: string | null, notes: string): string | null {
  const parts = [region ? `Region: ${region}` : null, notes.trim() || null].filter(Boolean);
  return parts.length > 0 ? parts.join('\n') : null;
}

export function buildTripMetrics(
  linkedTrails: Trail[],
  totalDays: number,
): {
  totalDays: number;
  trailCount: number;
  distanceMeters: number;
  elevationMeters: number;
} {
  return linkedTrails.reduce(
    (totals, trail) => ({
      ...totals,
      distanceMeters: totals.distanceMeters + trail.distanceMeters,
      elevationMeters: totals.elevationMeters + trail.elevationGainMeters,
    }),
    {
      totalDays,
      trailCount: linkedTrails.length,
      distanceMeters: 0,
      elevationMeters: 0,
    },
  );
}

export function getDayDate(startDate: string | null, index: number): string | null {
  const start = normalizeDateOnly(startDate);
  if (!start) {
    return null;
  }

  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
  return formatDateOnly(next);
}

export function formatDisplayDate(value: string | null | undefined): string {
  const parsed = normalizeDateOnly(value);
  if (!parsed) {
    return 'Date TBD';
  }

  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
