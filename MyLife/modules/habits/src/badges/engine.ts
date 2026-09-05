import type { BadgeCategory, BadgeDefinition } from '../types';

// ── Badge Catalog ────────────────────────────────────────────────────────

const streakBadges: BadgeDefinition[] = [
  { key: 'streak_3', name: 'First Streak', description: 'Maintain a 3-day streak', emoji: '🔥', category: 'streak', threshold: 3, hint: 'Keep a short streak going' },
  { key: 'streak_7', name: 'Week Warrior', description: 'Maintain a 7-day streak', emoji: '💪', category: 'streak', threshold: 7, hint: 'One full week' },
  { key: 'streak_14', name: 'Fortnight Fighter', description: 'Maintain a 14-day streak', emoji: '⚔️', category: 'streak', threshold: 14, hint: 'Two weeks straight' },
  { key: 'streak_30', name: 'Month Master', description: 'Maintain a 30-day streak', emoji: '🏆', category: 'streak', threshold: 30, hint: 'A whole month' },
  { key: 'streak_90', name: 'Quarter Champion', description: 'Maintain a 90-day streak', emoji: '👑', category: 'streak', threshold: 90, hint: 'Three solid months' },
  { key: 'streak_180', name: 'Half-Year Hero', description: 'Maintain a 180-day streak', emoji: '🦸', category: 'streak', threshold: 180, hint: 'Half a year' },
  { key: 'streak_365', name: 'Year Legend', description: 'Maintain a 365-day streak', emoji: '🌟', category: 'streak', threshold: 365, hint: 'An entire year' },
  { key: 'streak_500', name: 'Unbreakable', description: 'Maintain a 500-day streak', emoji: '💎', category: 'streak', threshold: 500, hint: 'Beyond a year' },
  { key: 'streak_1000', name: 'Eternal', description: 'Maintain a 1000-day streak', emoji: '♾️', category: 'streak', threshold: 1000, hint: 'Nearly three years' },
];

const completionBadges: BadgeDefinition[] = [
  { key: 'completion_1', name: 'First Step', description: 'Complete a habit 1 time', emoji: '⭐', category: 'completion', threshold: 1, hint: 'Just start' },
  { key: 'completion_10', name: 'Getting Started', description: 'Complete a habit 10 times', emoji: '🎯', category: 'completion', threshold: 10, hint: 'Keep going' },
  { key: 'completion_50', name: 'Committed', description: 'Complete a habit 50 times', emoji: '🎖️', category: 'completion', threshold: 50, hint: 'Showing commitment' },
  { key: 'completion_100', name: 'Century', description: 'Complete a habit 100 times', emoji: '💯', category: 'completion', threshold: 100, hint: 'Triple digits' },
  { key: 'completion_250', name: 'Dedicated', description: 'Complete a habit 250 times', emoji: '🏅', category: 'completion', threshold: 250, hint: 'Truly dedicated' },
  { key: 'completion_500', name: 'Powerhouse', description: 'Complete a habit 500 times', emoji: '⚡', category: 'completion', threshold: 500, hint: 'Unstoppable' },
  { key: 'completion_1000', name: 'Thousand Club', description: 'Complete a habit 1000 times', emoji: '🏛️', category: 'completion', threshold: 1000, hint: 'Elite status' },
  { key: 'completion_5000', name: 'Five Thousand', description: 'Complete a habit 5000 times', emoji: '🗻', category: 'completion', threshold: 5000, hint: 'Mountain of effort' },
  { key: 'completion_10000', name: 'Ten Thousand', description: 'Complete a habit 10000 times', emoji: '🌌', category: 'completion', threshold: 10000, hint: 'Legendary' },
];

const sobrietyBadges: BadgeDefinition[] = [
  { key: 'sobriety_1', name: 'One Day Clean', description: '1 day sober', emoji: '🌱', category: 'sobriety', threshold: 1, hint: 'Day one' },
  { key: 'sobriety_7', name: 'One Week Clean', description: '7 days sober', emoji: '🌿', category: 'sobriety', threshold: 7, hint: 'A full week' },
  { key: 'sobriety_30', name: 'One Month Clean', description: '30 days sober', emoji: '🌳', category: 'sobriety', threshold: 30, hint: 'A full month' },
  { key: 'sobriety_90', name: '90 Days Clean', description: '90 days sober', emoji: '🏔️', category: 'sobriety', threshold: 90, hint: 'Three months' },
  { key: 'sobriety_180', name: 'Six Months Clean', description: '180 days sober', emoji: '🌄', category: 'sobriety', threshold: 180, hint: 'Half a year' },
  { key: 'sobriety_365', name: 'One Year Clean', description: '365 days sober', emoji: '🎆', category: 'sobriety', threshold: 365, hint: 'A full year' },
  { key: 'sobriety_730', name: 'Two Years Clean', description: '730 days sober', emoji: '🏆', category: 'sobriety', threshold: 730, hint: 'Two years' },
  { key: 'sobriety_1825', name: 'Five Years Clean', description: '1825 days sober', emoji: '👑', category: 'sobriety', threshold: 1825, hint: 'Five years' },
];

const collectionBadges: BadgeDefinition[] = [
  { key: 'collection_1', name: 'Beginner', description: 'Create 1 habit', emoji: '📝', category: 'collection', threshold: 1, hint: 'Create a habit' },
  { key: 'collection_3', name: 'Builder', description: 'Create 3 habits', emoji: '🔨', category: 'collection', threshold: 3, hint: 'A few habits' },
  { key: 'collection_5', name: 'Collector', description: 'Create 5 habits', emoji: '📋', category: 'collection', threshold: 5, hint: 'Growing collection' },
  { key: 'collection_10', name: 'Organizer', description: 'Create 10 habits', emoji: '📊', category: 'collection', threshold: 10, hint: 'Double digits' },
  { key: 'collection_15', name: 'Life Manager', description: 'Create 15 habits', emoji: '🧭', category: 'collection', threshold: 15, hint: 'Full life tracking' },
  { key: 'collection_20', name: 'Master Planner', description: 'Create 20 habits', emoji: '🗺️', category: 'collection', threshold: 20, hint: 'Everything tracked' },
];

const specialBadges: BadgeDefinition[] = [
  { key: 'special_perfect_day', name: 'Perfect Day', description: '100% completion in a single day', emoji: '✨', category: 'special', threshold: 1, hint: 'Complete every habit in one day' },
  { key: 'special_perfect_week', name: 'Perfect Week', description: '7 consecutive perfect days', emoji: '🌈', category: 'special', threshold: 7, hint: 'A full perfect week' },
  { key: 'special_focus_master', name: 'Focus Master', description: 'Complete 10 Pomodoro sessions', emoji: '🎯', category: 'special', threshold: 10, hint: 'Many focus sessions' },
  { key: 'special_comeback', name: 'Comeback Kid', description: 'Resume after 7+ day gap', emoji: '🔄', category: 'special', threshold: 7, hint: 'Come back after a break' },
  { key: 'special_pledge_keeper', name: 'Pledge Keeper', description: '30 consecutive daily pledges', emoji: '🤝', category: 'special', threshold: 30, hint: 'Daily pledge streak' },
];

export const BADGE_CATALOG: BadgeDefinition[] = [
  ...streakBadges,
  ...completionBadges,
  ...sobrietyBadges,
  ...collectionBadges,
  ...specialBadges,
];

export function getBadgesByCategory(category: BadgeCategory): BadgeDefinition[] {
  return BADGE_CATALOG.filter(b => b.category === category);
}

export function getBadgeByKey(key: string): BadgeDefinition | undefined {
  return BADGE_CATALOG.find(b => b.key === key);
}

export interface UserBadgeStats {
  longestStreak: number;
  totalCompletions: number;
  sobrietyDays: number;
  habitCount: number;
  perfectDays: number;
  perfectWeekDays: number;
  focusSessions: number;
  daysSinceLastCompletion: number;
  pledgeStreak: number;
}

export interface BadgeProgress {
  current: number;
  target: number;
  remaining: number;
  progress: number;
}

export function getBadgeProgress(
  badge: BadgeDefinition,
  stats: UserBadgeStats,
  isUnlocked: boolean = false,
): BadgeProgress {
  const target = Math.max(1, badge.threshold);

  let current = 0;

  switch (badge.category) {
    case 'streak':
      current = stats.longestStreak;
      break;
    case 'completion':
      current = stats.totalCompletions;
      break;
    case 'sobriety':
      current = stats.sobrietyDays;
      break;
    case 'collection':
      current = stats.habitCount;
      break;
    case 'special':
      switch (badge.key) {
        case 'special_perfect_day':
          current = stats.perfectDays;
          break;
        case 'special_perfect_week':
          current = stats.perfectWeekDays;
          break;
        case 'special_focus_master':
          current = stats.focusSessions;
          break;
        case 'special_comeback':
          current = stats.daysSinceLastCompletion;
          break;
        case 'special_pledge_keeper':
          current = stats.pledgeStreak;
          break;
        default:
          current = 0;
      }
      break;
  }

  if (isUnlocked) {
    return {
      current: target,
      target,
      remaining: 0,
      progress: 1,
    };
  }

  const normalizedCurrent = Math.max(0, current);

  return {
    current: normalizedCurrent,
    target,
    remaining: Math.max(0, target - normalizedCurrent),
    progress: Math.min(1, normalizedCurrent / target),
  };
}

export function detectNewBadges(
  stats: UserBadgeStats,
  alreadyUnlocked: Set<string>,
): string[] {
  const newBadges: string[] = [];

  for (const badge of streakBadges) {
    if (!alreadyUnlocked.has(badge.key) && stats.longestStreak >= badge.threshold) {
      newBadges.push(badge.key);
    }
  }
  for (const badge of completionBadges) {
    if (!alreadyUnlocked.has(badge.key) && stats.totalCompletions >= badge.threshold) {
      newBadges.push(badge.key);
    }
  }
  for (const badge of sobrietyBadges) {
    if (!alreadyUnlocked.has(badge.key) && stats.sobrietyDays >= badge.threshold) {
      newBadges.push(badge.key);
    }
  }
  for (const badge of collectionBadges) {
    if (!alreadyUnlocked.has(badge.key) && stats.habitCount >= badge.threshold) {
      newBadges.push(badge.key);
    }
  }
  if (!alreadyUnlocked.has('special_perfect_day') && stats.perfectDays >= 1) {
    newBadges.push('special_perfect_day');
  }
  if (!alreadyUnlocked.has('special_perfect_week') && stats.perfectWeekDays >= 7) {
    newBadges.push('special_perfect_week');
  }
  if (!alreadyUnlocked.has('special_focus_master') && stats.focusSessions >= 10) {
    newBadges.push('special_focus_master');
  }
  if (!alreadyUnlocked.has('special_comeback') && stats.daysSinceLastCompletion >= 7) {
    newBadges.push('special_comeback');
  }
  if (!alreadyUnlocked.has('special_pledge_keeper') && stats.pledgeStreak >= 30) {
    newBadges.push('special_pledge_keeper');
  }

  return newBadges;
}
