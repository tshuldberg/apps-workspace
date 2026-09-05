import { checkCompatibility } from './companion';

interface PlacedItem {
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
  label: string;
}

/**
 * Check if two placed items overlap.
 */
export function checkOverlap(a: PlacedItem, b: PlacedItem): boolean {
  return !(
    a.x + a.widthCells <= b.x ||
    b.x + b.widthCells <= a.x ||
    a.y + a.heightCells <= b.y ||
    b.y + b.heightCells <= a.y
  );
}

/**
 * Check if a position is within grid bounds.
 */
export function isWithinBounds(
  x: number, y: number, w: number, h: number,
  gridWidth: number, gridHeight: number,
): boolean {
  return x >= 0 && y >= 0 && x + w <= gridWidth && y + h <= gridHeight;
}

/**
 * Get companion planting indicators for items adjacent to a placed plant.
 * Returns a map of item labels to relationship type.
 */
export function getCompanionOverlay(
  targetLabel: string,
  allItems: PlacedItem[],
): Array<{ label: string; relationship: 'companion' | 'antagonist' | 'neutral' }> {
  const results: Array<{ label: string; relationship: 'companion' | 'antagonist' | 'neutral' }> = [];
  for (const item of allItems) {
    if (item.label === targetLabel) continue;
    const result = checkCompatibility(targetLabel, item.label);
    results.push({ label: item.label, relationship: result.relationship });
  }
  return results;
}
