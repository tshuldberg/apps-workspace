import type { ClosetDashboard, ClothingItem } from '../types';

export function calculateWardrobeValue(items: ClothingItem[]): number {
  return items.reduce((total, item) => {
    if (item.status !== 'active' || item.purchasePriceCents == null) {
      return total;
    }
    return total + item.purchasePriceCents;
  }, 0);
}

export function calculateCostPerWear(item: ClothingItem): number | null {
  if (item.purchasePriceCents == null || item.timesWorn <= 0) {
    return null;
  }
  return Math.round(item.purchasePriceCents / item.timesWorn);
}

export function summarizeClosetDashboard(
  items: ClothingItem[],
  outfitCount: number,
  itemsWorn30Days: number,
  donationCandidateCount: number,
): ClosetDashboard {
  return {
    totalItems: items.filter((item) => item.status === 'active').length,
    totalOutfits: outfitCount,
    wardrobeValueCents: calculateWardrobeValue(items),
    itemsWorn30Days,
    donationCandidateCount,
  };
}
