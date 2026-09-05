import type { ClothingCategory, ClothingItem, WeatherCondition, WeatherRecommendation } from '../types';

type TempRange = { min: number; max: number; categories: ClothingCategory[]; layerLabel: string };

const TEMP_RANGES: TempRange[] = [
  { min: -Infinity, max: 32, categories: ['outerwear', 'accessories'], layerLabel: 'Heavy layers' },
  { min: 32, max: 50, categories: ['outerwear', 'tops', 'shoes'], layerLabel: 'Medium layers' },
  { min: 50, max: 65, categories: ['outerwear', 'tops', 'shoes'], layerLabel: 'Light layers' },
  { min: 65, max: 80, categories: ['tops', 'bottoms', 'shoes', 'dresses'], layerLabel: 'Single layer' },
  { min: 80, max: Infinity, categories: ['tops', 'bottoms', 'shoes', 'swimwear', 'dresses'], layerLabel: 'Light, breathable' },
];

function getRecommendedCategories(tempF: number): ClothingCategory[] {
  const matching = TEMP_RANGES.find((r) => tempF >= r.min && tempF < r.max);
  return matching?.categories ?? ['tops', 'bottoms', 'shoes'];
}

function getLayerLabel(tempF: number): string {
  const matching = TEMP_RANGES.find((r) => tempF >= r.min && tempF < r.max);
  return matching?.layerLabel ?? 'Dress for the weather';
}

function matchesSeason(item: ClothingItem, currentMonth: number): boolean {
  if (item.seasons.length === 0 || item.seasons.includes('all-season')) return true;
  const monthToSeason: Record<number, string> = {
    1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring',
    6: 'summer', 7: 'summer', 8: 'summer', 9: 'fall', 10: 'fall',
    11: 'fall', 12: 'winter',
  };
  return item.seasons.includes(monthToSeason[currentMonth] ?? 'spring');
}

function buildReason(tempF: number, condition: string, category: ClothingCategory): string {
  const tempLabel = tempF <= 32 ? 'cold' : tempF <= 50 ? 'cool' : tempF <= 65 ? 'mild' : tempF <= 80 ? 'warm' : 'hot';
  return `Great for ${Math.round(tempF)}F and ${condition} (${tempLabel}, ${category})`;
}

export function scoreItemForWeather(
  item: ClothingItem,
  weather: WeatherCondition,
  currentMonth: number,
): number {
  let score = 0;
  const recommended = getRecommendedCategories(weather.temperatureF);

  if (recommended.includes(item.category)) score += 50;
  if (matchesSeason(item, currentMonth)) score += 30;
  if (item.laundryStatus === 'clean') score += 25;
  if (item.status === 'active') score += 10;
  if (item.lastWornDate) {
    const daysSinceWorn = Math.floor(
      (Date.now() - new Date(item.lastWornDate).getTime()) / 86_400_000,
    );
    if (daysSinceWorn >= 7) score += 15;
    else if (daysSinceWorn <= 1) score -= 10;
  } else {
    score += 5;
  }

  return score;
}

export function recommendForWeather(
  items: ClothingItem[],
  weather: WeatherCondition,
  limit: number = 5,
): WeatherRecommendation[] {
  const currentMonth = new Date().getUTCMonth() + 1;
  const candidates = items.filter(
    (item) => item.status === 'active' && item.laundryStatus !== 'dirty',
  );

  const scored = candidates.map((item) => ({
    item,
    score: scoreItemForWeather(item, weather, currentMonth),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ item, score }) => ({
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    score,
    reason: buildReason(weather.temperatureF, weather.condition, item.category),
  }));
}

export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9 / 5 + 32) * 10) / 10;
}

export function fahrenheitToCelsius(f: number): number {
  return Math.round((f - 32) * 5 / 9 * 10) / 10;
}

export { getLayerLabel, getRecommendedCategories };
