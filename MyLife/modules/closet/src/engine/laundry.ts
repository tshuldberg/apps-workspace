import type { CareInstruction, ClothingItem, LaundryEvent } from '../types';

export function calculateAverageWearsBetweenWashes(events: LaundryEvent[]): number | null {
  if (events.length === 0) {
    return null;
  }

  const total = events.reduce((sum, event) => sum + event.wearsBeforeWash, 0);
  return Math.round((total / events.length) * 10) / 10;
}

export function groupDirtyItemsByCare(items: ClothingItem[]): Record<CareInstruction, ClothingItem[]> {
  const groups: Record<CareInstruction, ClothingItem[]> = {
    machine_wash: [],
    hand_wash: [],
    dry_clean: [],
    delicate: [],
  };

  for (const item of items) {
    if (item.laundryStatus !== 'dirty') {
      continue;
    }
    groups[item.careInstructions].push(item);
  }

  for (const value of Object.values(groups)) {
    value.sort((left, right) => {
      if (right.wearsSinceWash !== left.wearsSinceWash) {
        return right.wearsSinceWash - left.wearsSinceWash;
      }
      return right.timesWorn - left.timesWorn;
    });
  }

  return groups;
}
