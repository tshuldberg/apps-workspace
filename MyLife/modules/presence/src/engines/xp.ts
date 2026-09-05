import type { XPSource } from '../types';

/** XP awards by source type */
const XP_AMOUNTS: Record<XPSource, number> = {
  goal: 100,
  session: 50,
  intention: 25,
  streak: 10,
};

/**
 * Calculate XP for an action.
 * Sessions scale by duration: 50 XP per 30 minutes.
 */
export function calculateXP(source: XPSource, durationMinutes?: number): number {
  if (source === 'session' && durationMinutes != null) {
    return Math.round((durationMinutes / 30) * XP_AMOUNTS.session);
  }
  return XP_AMOUNTS[source];
}

/**
 * Calculate bonus XP for maintaining a streak.
 * Every 7 consecutive days adds a 10 XP streak bonus.
 */
export function calculateStreakBonus(streakDays: number): number {
  if (streakDays < 7) return 0;
  const milestones = Math.floor(streakDays / 7);
  return milestones * XP_AMOUNTS.streak;
}

/** Get level from total XP. Each level requires 1.2x more XP than the previous. */
export function getLevelForXP(totalXP: number): number {
  if (totalXP <= 0) return 1;
  let level = 1;
  let threshold = 100;
  let accumulated = 0;
  while (accumulated + threshold <= totalXP) {
    accumulated += threshold;
    level++;
    threshold = Math.round(threshold * 1.2);
  }
  return level;
}

/** Get XP required for a specific level. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let threshold = 100;
  let accumulated = 0;
  for (let i = 1; i < level; i++) {
    accumulated += threshold;
    threshold = Math.round(threshold * 1.2);
  }
  return accumulated;
}

/** Get progress toward next level as 0-1 fraction. */
export function getXPProgress(totalXP: number): { level: number; progress: number; xpToNext: number } {
  const level = getLevelForXP(totalXP);
  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  const needed = nextLevelXP - currentLevelXP;
  const earned = totalXP - currentLevelXP;
  return {
    level,
    progress: needed > 0 ? earned / needed : 1,
    xpToNext: needed - earned,
  };
}
