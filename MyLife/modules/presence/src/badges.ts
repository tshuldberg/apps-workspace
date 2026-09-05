import type { PresenceMaterialSymbolName } from './ui/components/MaterialSymbol';

export interface PresenceBadgeContext {
  totalXP: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  completedSessions: number;
  totalDays: number;
  activeIntentions: number;
}

export interface PresenceBadgeDefinition {
  id: string;
  label: string;
  description: string;
  icon: PresenceMaterialSymbolName;
  glow?: boolean;
  isEarned: (context: PresenceBadgeContext) => boolean;
}

export interface PresenceBadgeState extends PresenceBadgeDefinition {
  earned: boolean;
}

export const PRESENCE_BADGE_DEFS: PresenceBadgeDefinition[] = [
  {
    id: 'first-day',
    label: 'First Day',
    description: 'Track a full day of screen time.',
    icon: 'diamond',
    isEarned: (context) => context.totalDays >= 1,
  },
  {
    id: 'seven-day-streak',
    label: '7 Days',
    description: 'Hold a seven day streak.',
    icon: 'local_fire_department',
    glow: true,
    isEarned: (context) => context.longestStreak >= 7,
  },
  {
    id: 'focus-five',
    label: 'Focus',
    description: 'Complete five focus sessions.',
    icon: 'psychology',
    isEarned: (context) => context.completedSessions >= 5,
  },
  {
    id: 'intentions-three',
    label: 'Intentions',
    description: 'Set three active app intentions.',
    icon: 'lightbulb',
    isEarned: (context) => context.activeIntentions >= 3,
  },
  {
    id: 'level-ten',
    label: 'Level 10',
    description: 'Reach level ten.',
    icon: 'bolt',
    glow: true,
    isEarned: (context) => context.level >= 10,
  },
  {
    id: 'thirty-day-streak',
    label: '30 Days',
    description: 'Maintain a thirty day streak.',
    icon: 'local_fire_department',
    glow: true,
    isEarned: (context) => context.longestStreak >= 30,
  },
  {
    id: 'steady-nights',
    label: 'Night Guard',
    description: 'Keep a three day current streak going.',
    icon: 'bedtime',
    isEarned: (context) => context.currentStreak >= 3,
  },
  {
    id: 'zen-master',
    label: 'Zen',
    description: 'Reach level twenty five.',
    icon: 'diamond',
    glow: true,
    isEarned: (context) => context.level >= 25,
  },
];

export function getPresenceLevelTitle(level: number): string {
  if (level <= 5) return 'Beginner';
  if (level <= 15) return 'Apprentice';
  if (level <= 25) return 'Focused';
  if (level <= 35) return 'Disciplined';
  if (level <= 45) return 'Master';
  return 'Zen Master';
}

export function getPresenceBadgeStates(
  context: PresenceBadgeContext,
): PresenceBadgeState[] {
  return PRESENCE_BADGE_DEFS.map((badge) => ({
    ...badge,
    earned: badge.isEarned(context),
  }));
}

export function getPresenceBadgePreview(
  context: PresenceBadgeContext,
  limit = 6,
): PresenceBadgeState[] {
  const states = getPresenceBadgeStates(context);
  const earned = states.filter((badge) => badge.earned);
  const upcoming = states.filter((badge) => !badge.earned);
  const earnedTail = earned.slice(-Math.min(earned.length, Math.ceil(limit / 2)));
  return [...earnedTail, ...upcoming].slice(0, limit);
}
