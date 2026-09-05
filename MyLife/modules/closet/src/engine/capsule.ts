import type { ClothingCategory, ClothingItem, Outfit } from '../types';

export type VersatilityScore = {
  itemId: string;
  itemName: string;
  category: ClothingCategory;
  score: number;
};

export type WardrobeGap = {
  category: ClothingCategory;
  current: number;
  target: number;
  deficit: number;
};

const DEFAULT_CATEGORY_DISTRIBUTION: Partial<Record<ClothingCategory, number>> = {
  tops: 0.27,
  bottoms: 0.15,
  dresses: 0.09,
  outerwear: 0.09,
  shoes: 0.12,
  accessories: 0.15,
  activewear: 0.06,
  sleepwear: 0.06,
};

const NEUTRAL_COLORS = new Set([
  'black', 'white', 'gray', 'grey', 'navy', 'cream', 'beige', 'tan',
  'khaki', 'charcoal', 'ivory', 'brown',
]);

function getOccasionVarietyScore(item: ClothingItem): number {
  const count = item.occasions.length;
  if (count >= 4) return 25;
  if (count >= 3) return 20;
  if (count >= 2) return 15;
  if (count >= 1) return 10;
  return 5;
}

function getColorNeutralityScore(item: ClothingItem): number {
  if (!item.color) return 10;
  return NEUTRAL_COLORS.has(item.color.trim().toLowerCase()) ? 20 : 5;
}

function getSeasonBreadthScore(item: ClothingItem): number {
  if (item.seasons.length === 0 || item.seasons.includes('all-season')) return 15;
  if (item.seasons.length >= 3) return 12;
  if (item.seasons.length >= 2) return 8;
  return 3;
}

function getOutfitInclusionScore(item: ClothingItem, outfits: Outfit[]): number {
  const count = outfits.filter((o) => o.itemIds.includes(item.id)).length;
  if (count >= 5) return 20;
  if (count >= 3) return 15;
  if (count >= 1) return 10;
  return 0;
}

function getWearFrequencyScore(item: ClothingItem): number {
  if (item.timesWorn >= 20) return 10;
  if (item.timesWorn >= 10) return 7;
  if (item.timesWorn >= 5) return 5;
  if (item.timesWorn >= 1) return 2;
  return 0;
}

const CATEGORY_VERSATILITY: Partial<Record<ClothingCategory, number>> = {
  tops: 10, bottoms: 9, shoes: 8, outerwear: 7, dresses: 6,
  accessories: 5, activewear: 3, swimwear: 2, sleepwear: 1,
};

function getCategoryWeightScore(item: ClothingItem): number {
  return CATEGORY_VERSATILITY[item.category] ?? 5;
}

export function calculateVersatilityScore(
  item: ClothingItem,
  outfits: Outfit[],
): VersatilityScore {
  const score =
    getOccasionVarietyScore(item) +
    getColorNeutralityScore(item) +
    getSeasonBreadthScore(item) +
    getOutfitInclusionScore(item, outfits) +
    getWearFrequencyScore(item) +
    getCategoryWeightScore(item);

  return {
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    score: Math.min(100, score),
  };
}

export function suggestCapsuleItems(
  items: ClothingItem[],
  outfits: Outfit[],
  targetCount: number,
  season: string = 'all-season',
): VersatilityScore[] {
  const candidates = items.filter((item) => {
    if (item.status !== 'active') return false;
    if (season === 'all-season') return true;
    return item.seasons.length === 0
      || item.seasons.includes('all-season')
      || item.seasons.includes(season);
  });

  const scored = candidates.map((item) => calculateVersatilityScore(item, outfits));
  scored.sort((a, b) => b.score - a.score);

  const selected: VersatilityScore[] = [];
  const categoryCounts = new Map<ClothingCategory, number>();

  for (const entry of scored) {
    if (selected.length >= targetCount) break;
    const currentCount = categoryCounts.get(entry.category) ?? 0;
    const targetPct = DEFAULT_CATEGORY_DISTRIBUTION[entry.category] ?? 0.05;
    const categoryTarget = Math.max(1, Math.ceil(targetCount * targetPct));
    if (currentCount >= categoryTarget) continue;
    selected.push(entry);
    categoryCounts.set(entry.category, currentCount + 1);
  }

  if (selected.length < targetCount) {
    for (const entry of scored) {
      if (selected.length >= targetCount) break;
      if (selected.some((s) => s.itemId === entry.itemId)) continue;
      selected.push(entry);
    }
  }

  return selected;
}

export function analyzeCapsuleGaps(
  capsuleItemCategories: ClothingCategory[],
  targetCount: number,
): WardrobeGap[] {
  const categoryCounts = new Map<ClothingCategory, number>();
  for (const category of capsuleItemCategories) {
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  const gaps: WardrobeGap[] = [];
  for (const [category, pct] of Object.entries(DEFAULT_CATEGORY_DISTRIBUTION) as Array<[ClothingCategory, number]>) {
    const target = Math.max(1, Math.ceil(targetCount * pct));
    const current = categoryCounts.get(category) ?? 0;
    if (current < target) {
      gaps.push({ category, current, target, deficit: target - current });
    }
  }

  return gaps.sort((a, b) => b.deficit - a.deficit);
}

export function estimateOutfitCombinations(
  capsuleItemCategories: ClothingCategory[],
): number {
  const counts = new Map<ClothingCategory, number>();
  for (const cat of capsuleItemCategories) {
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  const tops = (counts.get('tops') ?? 0) + (counts.get('dresses') ?? 0);
  const bottoms = Math.max(1, counts.get('bottoms') ?? 0);
  const shoes = Math.max(1, counts.get('shoes') ?? 0);
  const outerwear = Math.max(1, counts.get('outerwear') ?? 0);

  if (tops === 0) return 0;
  return tops * bottoms * shoes * outerwear;
}
