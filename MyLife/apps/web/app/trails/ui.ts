import {
  TR_ACCENT,
  TR_ACCENT_GLOW,
  TR_ACCENT_LIGHT,
  TR_DIFFICULTY,
  TR_ON_ACCENT,
  TR_RECORDING_STATE,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_WEATHER,
  formatBytes,
  withAlpha,
} from '@mylife/trails';

export { withAlpha };

export const ACCENT = TR_ACCENT;
export const ACCENT_LIGHT = TR_ACCENT_LIGHT;
export const ACCENT_GLOW = TR_ACCENT_GLOW;
export const ACCENT_DIM = withAlpha(TR_ACCENT, 0.15);
export const ACCENT_BORDER = withAlpha(TR_ACCENT, 0.25);
export const ON_ACCENT = TR_ON_ACCENT;
export const TEXT = TR_TEXT;
export const TEXT_SEC = TR_TEXT_SECONDARY;
export const TEXT_TER = TR_TEXT_TERTIARY;
export const BG = TR_SURFACES.lowest;
export const SURFACE = TR_SURFACES.base;
export const SURFACE_LOW = TR_SURFACES.low;
export const SURFACE_MID = TR_SURFACES.mid;
export const SURFACE_HIGH = TR_SURFACES.high;
export const SURFACE_HIGHEST = TR_SURFACES.highest;
export const GLASS = 'rgba(255,255,255,0.04)';
export const GLASS_STRONG = 'rgba(255,255,255,0.08)';
export const GLASS_BORDER = 'rgba(255,255,255,0.10)';
export const BORDER = GLASS_BORDER;
export const DANGER = '#FFB4AB';
export const SUCCESS = '#30D158';
export const WARNING = '#FFB877';
export const INFO = '#8BCFF0';

export const SIDEBAR_WIDTH = 280;
export const CONTENT_MAX_WIDTH = 1440;
export const DETAIL_MAX_WIDTH = 1280;

export type BasicTrail = {
  id: string;
  name: string;
  difficulty: string;
  distanceMeters: number;
  elevationGainMeters: number;
  estimatedMinutes: number | null;
  lat: number;
  lng: number;
  region: string | null;
  description: string | null;
  isSaved?: boolean;
};

export type BasicRecording = {
  id: string;
  trailId: string | null;
  name: string;
  activityType: string;
  startedAt: string;
  endedAt: string | null;
  distanceMeters: number;
  elevationGainMeters: number;
  durationSeconds: number;
  notes?: string | null;
};

export type BasicSegment = {
  id: string;
  trailId: string;
  name: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  distanceMeters: number;
  elevationGainMeters: number;
};

export type BasicTrip = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  packingTemplateId?: string | null;
};

export type BasicPhoto = {
  id: string;
  recordingId: string | null;
  trailId: string | null;
  lat: number;
  lng: number;
  uri: string;
  caption: string | null;
  takenAt: string;
};

export type BasicPackingItem = {
  id: string;
  templateId: string;
  name: string;
  category: string;
  isChecked: boolean;
  sortOrder: number;
};

export type GroupedPackingItem = {
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

const PACKING_CATEGORY_ORDER = [
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

export function difficultyColor(difficulty: string): string {
  return TR_DIFFICULTY[difficulty as keyof typeof TR_DIFFICULTY] ?? TR_TEXT_TERTIARY;
}

export function activityIcon(type: string): string {
  switch (type) {
    case 'hike':
      return '🥾';
    case 'run':
      return '🏃';
    case 'bike':
      return '🚴';
    case 'walk':
      return '🚶';
    default:
      return '🥾';
  }
}

export function tripActivityIcon(type: string): string {
  switch (type) {
    case 'hike':
      return '🥾';
    case 'drive':
      return '🚙';
    case 'camp':
      return '🏕️';
    case 'rest':
      return '☕';
    default:
      return '📍';
  }
}

export function weatherTone(condition: string): string {
  const normalized = condition.toLowerCase();

  if (normalized.includes('storm') || normalized.includes('thunder')) {
    return TR_WEATHER.storm;
  }
  if (normalized.includes('snow') || normalized.includes('sleet')) {
    return TR_WEATHER.snow;
  }
  if (normalized.includes('rain') || normalized.includes('shower')) {
    return TR_WEATHER.rain;
  }
  if (normalized.includes('cloud') || normalized.includes('overcast')) {
    return TR_WEATHER.cloudy;
  }
  return TR_WEATHER.sunny;
}

export function recordingStateColor(state: string): string {
  return TR_RECORDING_STATE[state as keyof typeof TR_RECORDING_STATE] ?? TR_RECORDING_STATE.idle;
}

export function difficultyPillStyle(level: string) {
  const color = difficultyColor(level);
  return {
    background: withAlpha(color, 0.16),
    color,
  };
}

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDistanceMiles(meters: number): string {
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}

export function formatPace(minPerKm: number | null): string {
  if (minPerKm === null || !Number.isFinite(minPerKm)) {
    return '--';
  }

  const minutes = Math.floor(minPerKm);
  const seconds = Math.round((minPerKm - minutes) * 60);
  return `${minutes}:${`${seconds}`.padStart(2, '0')} /km`;
}

export function formatDurationDisplay(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function formatCompactDate(value: string | null | undefined): string {
  if (!value) {
    return 'No date';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatFullDate(value: string | null | undefined): string {
  if (!value) {
    return 'No date';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRangeLabel(start: string | null, end: string | null): string {
  if (!start && !end) {
    return 'Draft';
  }
  if (start && end) {
    return `${formatCompactDate(start)} to ${formatCompactDate(end)}`;
  }
  return formatCompactDate(start ?? end);
}

export function formatStorage(bytes: number): string {
  return formatBytes(bytes);
}

export function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatPackingCategory(category: string): string {
  return PACKING_CATEGORY_LABELS[category] ?? toTitleCase(category);
}

export function estimateItemWeightGrams(name: string, category: string): number {
  const keywordMatch = KEYWORD_WEIGHTS.find((entry) => entry.pattern.test(name));
  if (keywordMatch) {
    return keywordMatch.grams;
  }

  return CATEGORY_BASE_WEIGHTS[category] ?? CATEGORY_BASE_WEIGHTS.misc;
}

export function groupPackingItems(items: BasicPackingItem[]): GroupedPackingItem[] {
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
      const leftIndex = PACKING_CATEGORY_ORDER.indexOf(
        left.category as (typeof PACKING_CATEGORY_ORDER)[number],
      );
      const rightIndex = PACKING_CATEGORY_ORDER.indexOf(
        right.category as (typeof PACKING_CATEGORY_ORDER)[number],
      );

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

export function isConsumableCategory(category: string): boolean {
  return category === 'food_water' || category === 'kitchen';
}

export function computePackingTotals(groups: GroupedPackingItem[]) {
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

export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)} kg`;
  }
  return `${Math.round(grams)} g`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
