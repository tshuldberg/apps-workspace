import type { UnlockableItem, XPSource, XPTransaction } from '../types';

// ── XP Award Table ───────────────────────────────────────────────────────

const XP_AMOUNTS: Record<XPSource, number> = {
  completion: 10,
  timed_completion: 15,
  measurable_completion: 12,
  streak_bonus: 0, // calculated dynamically
  milestone: 0, // varies by milestone
  craving_resist: 20,
  daily_pledge: 5,
  all_complete: 25,
};

const MILESTONE_XP: Record<number, number> = {
  7: 50,
  30: 150,
  90: 500,
  365: 2000,
};

export function calculateXPForAction(source: XPSource, context?: { streakLength?: number; milestoneThreshold?: number }): number {
  if (source === 'streak_bonus') {
    const streak = context?.streakLength ?? 0;
    return Math.min(streak, 50);
  }
  if (source === 'milestone') {
    const threshold = context?.milestoneThreshold ?? 0;
    return MILESTONE_XP[threshold] ?? 50;
  }
  return XP_AMOUNTS[source];
}

// ── Leveling Curve ───────────────────────────────────────────────────────

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

export function cumulativeXPForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

export function getLevelForXP(totalXP: number): number {
  let level = 1;
  let cumulative = 0;
  while (true) {
    const nextLevelXP = xpForLevel(level + 1);
    if (cumulative + nextLevelXP > totalXP) break;
    cumulative += nextLevelXP;
    level++;
  }
  return level;
}

export function getXPProgress(totalXP: number): { level: number; currentXP: number; neededXP: number } {
  const level = getLevelForXP(totalXP);
  const cumulative = cumulativeXPForLevel(level);
  const currentXP = totalXP - cumulative;
  const neededXP = xpForLevel(level + 1);
  return { level, currentXP, neededXP };
}

export function calculateStreakBonus(streakLength: number): number {
  return Math.min(streakLength, 50);
}

// ── Unlockable Items ─────────────────────────────────────────────────────

export const UNLOCKABLE_ITEMS: UnlockableItem[] = [
  { level: 1, name: 'Default Avatar', type: 'background' },
  { level: 2, name: 'Blue Background', type: 'background' },
  { level: 3, name: 'Green Hat', type: 'hat' },
  { level: 4, name: 'Red Scarf', type: 'accessory' },
  { level: 5, name: 'Gold Border', type: 'effect' },
  { level: 6, name: 'Purple Aura', type: 'effect' },
  { level: 7, name: 'Silver Crown', type: 'hat' },
  { level: 8, name: 'Rainbow Trail', type: 'effect' },
  { level: 9, name: 'Star Badge', type: 'accessory' },
  { level: 10, name: 'Habit Master', type: 'title' },
  { level: 15, name: 'Habit Legend', type: 'title' },
  { level: 20, name: 'Habit Grandmaster', type: 'title' },
];

export function getUnlockableForLevel(level: number): UnlockableItem | null {
  return UNLOCKABLE_ITEMS.find(item => item.level === level) ?? null;
}

export function getUnlockedItems(level: number): UnlockableItem[] {
  return UNLOCKABLE_ITEMS.filter(item => item.level <= level);
}

export interface LevelHistoryEntry {
  level: number;
  totalXP: number;
  earnedAt: string;
  source: string;
}

export function buildLevelHistory(transactions: XPTransaction[]): LevelHistoryEntry[] {
  const ordered = [...transactions].sort((left, right) =>
    left.earnedAt.localeCompare(right.earnedAt) || left.createdAt.localeCompare(right.createdAt),
  );

  const entries: LevelHistoryEntry[] = [];
  let totalXP = 0;
  let currentLevel = 1;

  for (const transaction of ordered) {
    totalXP += transaction.amount;
    const nextLevel = getLevelForXP(totalXP);

    while (currentLevel < nextLevel) {
      currentLevel += 1;
      entries.push({
        level: currentLevel,
        totalXP,
        earnedAt: transaction.earnedAt,
        source: transaction.source,
      });
    }
  }

  return entries.reverse();
}
