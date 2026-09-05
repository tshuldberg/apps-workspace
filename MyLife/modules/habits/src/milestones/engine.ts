/**
 * Milestone detection and seeding engine.
 * Detects when users cross milestone thresholds and manages milestone records.
 */

import type { Milestone, MilestoneType } from '../types';

// ── Milestone schedules ──────────────────────────────────────────────────

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 60, 90, 100, 180, 365, 500, 1000];

export const COMPLETION_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

export const SOBRIETY_DAY_MILESTONES = [1, 3, 7, 14, 30, 60, 90, 100, 180, 365, 500, 730, 1095];

export const SOBRIETY_MONEY_MILESTONES = [10000, 50000, 100000, 250000, 500000, 1000000]; // in cents

/** Get milestone label and emoji for a given type and threshold. */
export function getMilestoneLabel(type: MilestoneType, threshold: number): { label: string; emoji: string } {
  switch (type) {
    case 'streak': {
      if (threshold >= 365) return { label: `${Math.floor(threshold / 365)}-Year Streak!`, emoji: '🏆' };
      return { label: `${threshold}-Day Streak!`, emoji: '🔥' };
    }
    case 'total_completions':
      return { label: `${threshold} Completions!`, emoji: '🎯' };
    case 'sobriety_days': {
      if (threshold >= 365) return { label: `${Math.floor(threshold / 365)} Year${threshold >= 730 ? 's' : ''} Sober!`, emoji: '🌟' };
      return { label: `${threshold} Days Sober!`, emoji: '💪' };
    }
    case 'sobriety_money':
      return { label: `$${(threshold / 100).toLocaleString()} Saved!`, emoji: '💰' };
    case 'custom':
      return { label: `Milestone: ${threshold}`, emoji: '⭐' };
  }
}

/** Generate all standard milestones for a habit. */
export function generateStandardMilestones(
  habitType: 'standard' | 'timed' | 'negative' | 'measurable',
  hasSobrietyProfile: boolean,
  dailyCostCents: number,
): Array<{ type: MilestoneType; threshold: number; label: string; emoji: string }> {
  const milestones: Array<{ type: MilestoneType; threshold: number; label: string; emoji: string }> = [];

  // Streak milestones for all types
  for (const t of STREAK_MILESTONES) {
    const { label, emoji } = getMilestoneLabel('streak', t);
    milestones.push({ type: 'streak', threshold: t, label, emoji });
  }

  // Completion milestones for standard, timed, and measurable
  if (habitType !== 'negative') {
    for (const t of COMPLETION_MILESTONES) {
      const { label, emoji } = getMilestoneLabel('total_completions', t);
      milestones.push({ type: 'total_completions', threshold: t, label, emoji });
    }
  }

  // Sobriety milestones for negative habits with sobriety profile
  if (habitType === 'negative' && hasSobrietyProfile) {
    for (const t of SOBRIETY_DAY_MILESTONES) {
      const { label, emoji } = getMilestoneLabel('sobriety_days', t);
      milestones.push({ type: 'sobriety_days', threshold: t, label, emoji });
    }

    if (dailyCostCents > 0) {
      for (const t of SOBRIETY_MONEY_MILESTONES) {
        const { label, emoji } = getMilestoneLabel('sobriety_money', t);
        milestones.push({ type: 'sobriety_money', threshold: t, label, emoji });
      }
    }
  }

  return milestones;
}

/**
 * Detect newly achieved milestones.
 * Compares current values against unachieved milestones and returns newly crossed thresholds.
 */
export function detectNewMilestones(
  milestones: Milestone[],
  currentValues: {
    streak?: number;
    totalCompletions?: number;
    sobrietyDays?: number;
    moneySavedCents?: number;
  },
): Milestone[] {
  const newlyAchieved: Milestone[] = [];

  for (const m of milestones) {
    // Skip already achieved
    if (m.achievedAt) continue;

    let currentValue: number | undefined;
    switch (m.milestoneType) {
      case 'streak': currentValue = currentValues.streak; break;
      case 'total_completions': currentValue = currentValues.totalCompletions; break;
      case 'sobriety_days': currentValue = currentValues.sobrietyDays; break;
      case 'sobriety_money': currentValue = currentValues.moneySavedCents; break;
      default: continue;
    }

    if (currentValue !== undefined && currentValue >= m.threshold) {
      newlyAchieved.push(m);
    }
  }

  return newlyAchieved;
}

/**
 * Get the next unachieved milestone with progress percentage.
 */
export function getNextMilestone(
  milestones: Milestone[],
  currentValue: number,
  milestoneType: MilestoneType,
): { milestone: Milestone; percentage: number } | null {
  const unachieved = milestones
    .filter((m) => m.milestoneType === milestoneType && !m.achievedAt)
    .sort((a, b) => a.threshold - b.threshold);

  if (unachieved.length === 0) return null;

  const next = unachieved[0];
  const percentage = Math.min(100, Math.round((currentValue / next.threshold) * 100));

  return { milestone: next, percentage };
}
