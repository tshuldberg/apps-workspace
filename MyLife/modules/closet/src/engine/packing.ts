import type {
  ClothingCategory,
  ClothingItem,
  CreatePackingListInput,
  PackingListSeason,
} from '../types';

export type PackingSuggestion = {
  categoryGroup: string;
  clothingItemId: string | null;
  customName: string | null;
  quantity: number;
  sortOrder: number;
};

function titleCaseCategory(category: ClothingCategory | 'essentials'): string {
  if (category === 'essentials') {
    return 'Essentials';
  }
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function matchesSeason(item: ClothingItem, season: PackingListSeason): boolean {
  return item.seasons.length === 0 || item.seasons.includes('all-season') || item.seasons.includes(season);
}

function matchScore(item: ClothingItem, season: PackingListSeason, occasions: string[]): number {
  let score = item.timesWorn;
  if (matchesSeason(item, season)) {
    score += 1000;
  }
  if (occasions.length > 0 && item.occasions.some((occasion) => occasions.includes(occasion))) {
    score += 100;
  }
  if (item.laundryStatus === 'clean') {
    score += 25;
  }
  return score;
}

function getTripDurationDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

function getSuggestedCategoryCounts(durationDays: number, occasions: string[]): Partial<Record<ClothingCategory, number>> {
  const lowerOccasions = occasions.map((occasion) => occasion.toLowerCase());
  const hasActiveOccasion = lowerOccasions.some((occasion) =>
    ['active', 'gym', 'run', 'workout', 'hike', 'training'].some((keyword) => occasion.includes(keyword)),
  );

  return {
    tops: Math.min(durationDays, 7),
    bottoms: Math.min(Math.ceil(durationDays / 2), 5),
    underwear: Math.min(durationDays + 1, 10),
    sleepwear: Math.min(Math.ceil(durationDays / 3), 3),
    shoes: lowerOccasions.length > 1 ? 3 : 2,
    outerwear: durationDays >= 3 ? 1 : 0,
    accessories: Math.min(Math.max(lowerOccasions.length + 1, 2), 5),
    activewear: hasActiveOccasion ? 2 : 0,
  };
}

export function inferPackingSeason(startDate: string): PackingListSeason {
  const month = new Date(`${startDate}T00:00:00Z`).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) {
    return 'spring';
  }
  if (month >= 6 && month <= 8) {
    return 'summer';
  }
  if (month >= 9 && month <= 11) {
    return 'fall';
  }
  return 'winter';
}

export function generatePackingSuggestions(
  items: ClothingItem[],
  input: CreatePackingListInput,
): PackingSuggestion[] {
  const occasions = input.occasions ?? [];
  const season = inferPackingSeason(input.startDate);
  const durationDays = getTripDurationDays(input.startDate, input.endDate);
  const categoryCounts = getSuggestedCategoryCounts(durationDays, occasions);
  const suggestions: PackingSuggestion[] = [];
  let sortOrder = 0;

  for (const [category, count] of Object.entries(categoryCounts) as Array<[ClothingCategory, number]>) {
    if (!count || count <= 0) {
      continue;
    }

    const candidates = items
      .filter((item) => item.status === 'active' && item.category === category)
      .sort((left, right) => matchScore(right, season, occasions) - matchScore(left, season, occasions));

    const cleanFirst = candidates.filter((item) => item.laundryStatus === 'clean');
    const fallback = candidates.filter((item) => item.laundryStatus !== 'clean');
    const selected = [...cleanFirst, ...fallback].slice(0, count);

    for (const item of selected) {
      suggestions.push({
        categoryGroup: titleCaseCategory(category),
        clothingItemId: item.id,
        customName: null,
        quantity: 1,
        sortOrder: sortOrder++,
      });
    }
  }

  for (const customName of ['Toiletries', 'Chargers', 'Travel Documents']) {
    suggestions.push({
      categoryGroup: titleCaseCategory('essentials'),
      clothingItemId: null,
      customName,
      quantity: 1,
      sortOrder: sortOrder++,
    });
  }

  return suggestions;
}
