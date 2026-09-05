import { calculateCostPerWear } from './analytics';
import type { ClothingItem, ClothingCategory } from '../types';

export type CPWLeaderboardEntry = {
  itemId: string;
  itemName: string;
  category: ClothingCategory;
  costPerWearCents: number;
  timesWorn: number;
  purchasePriceCents: number;
};

export type CPWCategoryAverage = {
  category: ClothingCategory;
  averageCPWCents: number;
  itemCount: number;
};

export type CPWSummary = {
  totalValueCents: number;
  averageCPWCents: number | null;
  medianCPWCents: number | null;
  itemsWithCPW: number;
  itemsWithoutPrice: number;
};

function getActiveItemsWithCPW(items: ClothingItem[]): Array<{ item: ClothingItem; cpw: number }> {
  const results: Array<{ item: ClothingItem; cpw: number }> = [];
  for (const item of items) {
    if (item.status !== 'active') continue;
    const cpw = calculateCostPerWear(item);
    if (cpw != null) {
      results.push({ item, cpw });
    }
  }
  return results;
}

export function getCPWLeaderboard(
  items: ClothingItem[],
  order: 'asc' | 'desc',
  limit: number = 10,
): CPWLeaderboardEntry[] {
  const withCPW = getActiveItemsWithCPW(items);
  withCPW.sort((a, b) => order === 'asc' ? a.cpw - b.cpw : b.cpw - a.cpw);
  return withCPW.slice(0, limit).map(({ item, cpw }) => ({
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    costPerWearCents: cpw,
    timesWorn: item.timesWorn,
    purchasePriceCents: item.purchasePriceCents!,
  }));
}

export function getCPWByCategory(items: ClothingItem[]): CPWCategoryAverage[] {
  const groups = new Map<ClothingCategory, number[]>();
  for (const { item, cpw } of getActiveItemsWithCPW(items)) {
    const arr = groups.get(item.category) ?? [];
    arr.push(cpw);
    groups.set(item.category, arr);
  }

  const results: CPWCategoryAverage[] = [];
  for (const [category, values] of groups) {
    const sum = values.reduce((a, b) => a + b, 0);
    results.push({
      category,
      averageCPWCents: Math.round(sum / values.length),
      itemCount: values.length,
    });
  }
  return results.sort((a, b) => a.averageCPWCents - b.averageCPWCents);
}

export function getCPWSummary(items: ClothingItem[]): CPWSummary {
  const activeItems = items.filter((i) => i.status === 'active');
  const withCPW = getActiveItemsWithCPW(items);
  const cpwValues = withCPW.map((e) => e.cpw).sort((a, b) => a - b);

  const totalValueCents = activeItems.reduce(
    (sum, item) => sum + (item.purchasePriceCents ?? 0),
    0,
  );

  let averageCPWCents: number | null = null;
  let medianCPWCents: number | null = null;

  if (cpwValues.length > 0) {
    averageCPWCents = Math.round(
      cpwValues.reduce((a, b) => a + b, 0) / cpwValues.length,
    );
    const mid = Math.floor(cpwValues.length / 2);
    medianCPWCents = cpwValues.length % 2 === 0
      ? Math.round((cpwValues[mid - 1]! + cpwValues[mid]!) / 2)
      : cpwValues[mid]!;
  }

  return {
    totalValueCents,
    averageCPWCents,
    medianCPWCents,
    itemsWithCPW: cpwValues.length,
    itemsWithoutPrice: activeItems.filter((i) => i.purchasePriceCents == null).length,
  };
}
