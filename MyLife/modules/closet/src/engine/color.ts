import type { ClothingCategory, ClothingItem, ColorCategory, ColorDistributionEntry } from '../types';

const COLOR_MAP: Record<string, ColorCategory> = {
  black: 'black', noir: 'black', onyx: 'black', jet: 'black', ebony: 'black',
  white: 'white', cream: 'white', ivory: 'white', 'off-white': 'white', snow: 'white', pearl: 'white',
  gray: 'gray', grey: 'gray', charcoal: 'gray', silver: 'gray', slate: 'gray', ash: 'gray', heather: 'gray',
  navy: 'blue', blue: 'blue', cobalt: 'blue', indigo: 'blue', teal: 'blue', azure: 'blue',
  'royal blue': 'blue', 'light blue': 'blue', 'dark blue': 'blue', 'sky blue': 'blue', cerulean: 'blue', denim: 'blue',
  red: 'red', burgundy: 'red', maroon: 'red', crimson: 'red', wine: 'red', scarlet: 'red',
  'dark red': 'red', ruby: 'red', cherry: 'red', cranberry: 'red',
  green: 'green', olive: 'green', sage: 'green', emerald: 'green', forest: 'green', khaki: 'green',
  mint: 'green', lime: 'green', 'dark green': 'green', 'light green': 'green', jade: 'green', hunter: 'green',
  pink: 'pink', rose: 'pink', blush: 'pink', coral: 'pink', salmon: 'pink', magenta: 'pink',
  fuchsia: 'pink', hot_pink: 'pink', 'hot pink': 'pink', 'dusty pink': 'pink', mauve: 'pink',
  yellow: 'yellow', gold: 'yellow', mustard: 'yellow', lemon: 'yellow', canary: 'yellow', amber: 'yellow',
  orange: 'orange', rust: 'orange', terracotta: 'orange', copper: 'orange', tangerine: 'orange',
  peach: 'orange', apricot: 'orange', burnt_orange: 'orange', 'burnt orange': 'orange',
  purple: 'purple', lavender: 'purple', plum: 'purple', violet: 'purple', lilac: 'purple',
  eggplant: 'purple', amethyst: 'purple', 'dark purple': 'purple', grape: 'purple',
  brown: 'brown', tan: 'brown', beige: 'brown', camel: 'brown', chocolate: 'brown', cognac: 'brown',
  espresso: 'brown', mocha: 'brown', chestnut: 'brown', walnut: 'brown', taupe: 'brown', sienna: 'brown',
  multi: 'multi', pattern: 'multi', print: 'multi', stripe: 'multi', plaid: 'multi',
  floral: 'multi', check: 'multi', 'tie-dye': 'multi', camo: 'multi', leopard: 'multi',
};

export function normalizeColor(input: string | null | undefined): ColorCategory {
  if (!input || !input.trim()) return 'unknown';
  const normalized = input.trim().toLowerCase();

  if (COLOR_MAP[normalized]) return COLOR_MAP[normalized]!;

  for (const [key, value] of Object.entries(COLOR_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return 'unknown';
}

export function getColorDistribution(items: ClothingItem[]): ColorDistributionEntry[] {
  const activeItems = items.filter((i) => i.status === 'active');
  if (activeItems.length === 0) return [];

  const counts = new Map<ColorCategory, number>();
  for (const item of activeItems) {
    const color = normalizeColor(item.color);
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  const total = activeItems.length;
  const entries: ColorDistributionEntry[] = [];
  for (const [color, count] of counts) {
    entries.push({
      color,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    });
  }

  return entries.sort((a, b) => b.count - a.count);
}

export function getColorDistributionByCategory(
  items: ClothingItem[],
): Record<string, ColorDistributionEntry[]> {
  const activeItems = items.filter((i) => i.status === 'active');
  const groups = new Map<ClothingCategory, ClothingItem[]>();

  for (const item of activeItems) {
    const arr = groups.get(item.category) ?? [];
    arr.push(item);
    groups.set(item.category, arr);
  }

  const result: Record<string, ColorDistributionEntry[]> = {};
  for (const [category, categoryItems] of groups) {
    result[category] = getColorDistribution(categoryItems);
  }

  return result;
}

const NEUTRAL_CATEGORIES: ColorCategory[] = ['black', 'white', 'gray', 'brown'];

export function generateColorInsights(distribution: ColorDistributionEntry[]): string[] {
  const insights: string[] = [];
  if (distribution.length === 0) return ['Add colors to your items for palette analysis.'];

  const totalItems = distribution.reduce((sum, e) => sum + e.count, 0);
  const neutralCount = distribution
    .filter((e) => NEUTRAL_CATEGORIES.includes(e.color))
    .reduce((sum, e) => sum + e.count, 0);
  const neutralPct = Math.round((neutralCount / totalItems) * 100);

  if (neutralPct >= 70) {
    insights.push(`Your wardrobe is ${neutralPct}% neutrals -- great for mix-and-match, but consider adding a pop of color.`);
  } else if (neutralPct >= 50) {
    insights.push(`Your wardrobe is ${neutralPct}% neutrals -- a solid, versatile foundation.`);
  } else {
    insights.push(`Your wardrobe is ${neutralPct}% neutrals and ${100 - neutralPct}% colors -- nice variety!`);
  }

  const allColorCategories: ColorCategory[] = [
    'black', 'white', 'gray', 'blue', 'red', 'green', 'pink',
    'yellow', 'orange', 'purple', 'brown',
  ];
  const present = new Set(distribution.map((e) => e.color));
  const missing = allColorCategories.filter((c) => !present.has(c));
  if (missing.length > 0) {
    insights.push(`Consider adding ${missing.slice(0, 3).join(', ')} for more variety.`);
  }

  const unknownEntry = distribution.find((e) => e.color === 'unknown');
  if (unknownEntry && unknownEntry.count > 0) {
    insights.push(`${unknownEntry.count} item${unknownEntry.count > 1 ? 's' : ''} ${unknownEntry.count > 1 ? 'don\'t' : 'doesn\'t'} have a color set.`);
  }

  if (distribution.length === 1 && distribution[0]!.color !== 'unknown') {
    insights.push('Your wardrobe is monochromatic -- consider adding variety.');
  }

  return insights;
}

export function getColorHarmonyPairs(
  distribution: ColorDistributionEntry[],
): Array<[ColorCategory, ColorCategory]> {
  const complementary: Array<[ColorCategory, ColorCategory]> = [
    ['blue', 'orange'], ['red', 'green'], ['yellow', 'purple'], ['pink', 'green'],
  ];

  const present = new Set(distribution.filter((e) => e.count > 0).map((e) => e.color));
  return complementary.filter(([a, b]) => present.has(a) && present.has(b));
}
