import type { ClothingCategory, ClothingItem, OutfitSuggestion, SuggestionFeedback } from '../types';

const NEUTRAL_COLORS = new Set([
  'black', 'white', 'gray', 'grey', 'navy', 'cream', 'beige', 'tan', 'khaki', 'charcoal', 'ivory',
]);

const COLOR_FAMILIES: Record<string, string> = {
  black: 'neutral', white: 'neutral', gray: 'neutral', grey: 'neutral',
  navy: 'cool', blue: 'cool', cobalt: 'cool', indigo: 'cool', teal: 'cool',
  red: 'warm', burgundy: 'warm', maroon: 'warm', crimson: 'warm',
  green: 'cool', olive: 'neutral', sage: 'cool', emerald: 'cool',
  pink: 'warm', rose: 'warm', coral: 'warm', salmon: 'warm',
  yellow: 'warm', gold: 'warm', mustard: 'warm',
  orange: 'warm', rust: 'warm', terracotta: 'warm',
  purple: 'cool', lavender: 'cool', plum: 'cool', violet: 'cool',
  brown: 'neutral', tan: 'neutral', beige: 'neutral', camel: 'neutral',
  cream: 'neutral', ivory: 'neutral', khaki: 'neutral', charcoal: 'neutral',
};

function getColorFamily(color: string | null): string {
  if (!color) return 'neutral';
  return COLOR_FAMILIES[color.trim().toLowerCase()] ?? 'neutral';
}

function colorsHarmonize(colorA: string | null, colorB: string | null): boolean {
  const aLower = (colorA ?? '').trim().toLowerCase();
  const bLower = (colorB ?? '').trim().toLowerCase();
  if (NEUTRAL_COLORS.has(aLower) || NEUTRAL_COLORS.has(bLower)) return true;
  if (aLower === bLower) return true;
  const familyA = getColorFamily(colorA);
  const familyB = getColorFamily(colorB);
  return familyA === familyB || familyA === 'neutral' || familyB === 'neutral';
}

function scoreOutfitItems(
  outfitItems: ClothingItem[],
  occasion: string | null,
  feedbackMap: Map<string, number>,
): number {
  let score = 0;

  for (const item of outfitItems) {
    if (item.laundryStatus === 'clean') score += 20;
    if (item.lastWornDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(item.lastWornDate).getTime()) / 86_400_000,
      );
      if (daysSince >= 7) score += 10;
      else if (daysSince <= 2) score -= 15;
    } else {
      score += 5;
    }
    if (occasion && item.occasions.some((o) => o.toLowerCase() === occasion.toLowerCase())) {
      score += 15;
    }
  }

  for (let i = 0; i < outfitItems.length; i++) {
    for (let j = i + 1; j < outfitItems.length; j++) {
      if (colorsHarmonize(outfitItems[i]!.color, outfitItems[j]!.color)) {
        score += 5;
      }
    }
  }

  const hash = hashOutfitItems(outfitItems.map((i) => i.id));
  score += feedbackMap.get(hash) ?? 0;

  return score;
}

export function hashOutfitItems(itemIds: string[]): string {
  const sorted = [...itemIds].sort();
  let hash = 0;
  const str = sorted.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `oh_${Math.abs(hash).toString(36)}`;
}

function buildFeedbackMap(feedbackEntries: SuggestionFeedback[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of feedbackEntries) {
    const current = map.get(entry.suggestionHash) ?? 0;
    map.set(entry.suggestionHash, current + (entry.feedback === 'up' ? 20 : -30));
  }
  return map;
}

export function generateOutfitSuggestions(
  items: ClothingItem[],
  feedbackEntries: SuggestionFeedback[],
  options?: { occasion?: string; limit?: number; excludeHashes?: string[] },
): OutfitSuggestion[] {
  const limit = options?.limit ?? 3;
  const occasion = options?.occasion ?? null;
  const excludeSet = new Set(options?.excludeHashes ?? []);
  const feedbackMap = buildFeedbackMap(feedbackEntries);

  const available = items.filter(
    (item) => item.status === 'active' && item.laundryStatus !== 'dirty',
  );

  if (available.length < 2) return [];

  const byCategory = new Map<ClothingCategory, ClothingItem[]>();
  for (const item of available) {
    const arr = byCategory.get(item.category) ?? [];
    arr.push(item);
    byCategory.set(item.category, arr);
  }

  const dresses = byCategory.get('dresses') ?? [];
  const tops = byCategory.get('tops') ?? [];
  const bottoms = byCategory.get('bottoms') ?? [];
  const shoes = byCategory.get('shoes') ?? [];
  const outerwear = byCategory.get('outerwear') ?? [];

  const candidates: OutfitSuggestion[] = [];

  for (let ti = 0; ti < Math.min(tops.length, 10); ti++) {
    for (let bi = 0; bi < Math.min(bottoms.length, 8); bi++) {
      const outfitItems = [tops[ti]!, bottoms[bi]!];
      if (shoes.length > 0) outfitItems.push(shoes[0]!);
      if (outerwear.length > 0 && (ti + bi) % 2 === 0) outfitItems.push(outerwear[0]!);

      const ids = outfitItems.map((i) => i.id);
      const hash = hashOutfitItems(ids);
      if (excludeSet.has(hash)) continue;

      const score = scoreOutfitItems(outfitItems, occasion, feedbackMap);
      candidates.push({
        itemIds: ids,
        score,
        context: occasion ? `For ${occasion}` : 'Based on your style',
        hash,
      });
    }
  }

  for (const dress of dresses.slice(0, 5)) {
    const outfitItems: ClothingItem[] = [dress];
    if (shoes.length > 0) outfitItems.push(shoes[Math.min(1, shoes.length - 1)]!);

    const ids = outfitItems.map((i) => i.id);
    const hash = hashOutfitItems(ids);
    if (excludeSet.has(hash)) continue;

    const score = scoreOutfitItems(outfitItems, occasion, feedbackMap);
    candidates.push({
      itemIds: ids,
      score,
      context: occasion ? `For ${occasion}` : 'Based on your style',
      hash,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected: OutfitSuggestion[] = [];
  const usedHashes = new Set<string>();
  for (const candidate of candidates) {
    if (usedHashes.has(candidate.hash)) continue;
    usedHashes.add(candidate.hash);
    selected.push(candidate);
    if (selected.length >= limit) break;
  }

  return selected;
}
