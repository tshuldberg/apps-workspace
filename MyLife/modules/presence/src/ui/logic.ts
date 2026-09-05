import { getLevelForXP, getXPProgress, xpForLevel } from '../engines/xp';

export interface DailyTimeCardDeltaState {
  direction: 'under' | 'over' | 'neutral';
  icon: 'arrow_downward' | 'arrow_upward';
  label: string;
}

export function getDailyTimeCardDeltaState(deltaMinutes: number): DailyTimeCardDeltaState {
  if (deltaMinutes > 0) {
    return {
      direction: 'over',
      icon: 'arrow_upward',
      label: 'above average',
    };
  }

  if (deltaMinutes < 0) {
    return {
      direction: 'under',
      icon: 'arrow_downward',
      label: 'below average',
    };
  }

  return {
    direction: 'neutral',
    icon: 'arrow_downward',
    label: 'right on average',
  };
}

export interface XPLevelProgressInput {
  totalXP: number;
  level?: number;
  currentLevelXP?: number;
  nextLevelXP?: number;
}

export function getXPLevelBarProgress({
  totalXP,
  level,
  currentLevelXP,
  nextLevelXP,
}: XPLevelProgressInput): number {
  const resolvedLevel = level ?? getLevelForXP(totalXP);
  const resolvedCurrentXP = currentLevelXP ?? xpForLevel(resolvedLevel);
  const resolvedNextXP = nextLevelXP ?? xpForLevel(resolvedLevel + 1);
  const derivedProgress = getXPProgress(totalXP).progress;
  const span = resolvedNextXP - resolvedCurrentXP;

  if (span <= 0) {
    return Math.max(0, Math.min(1, derivedProgress));
  }

  const progress = (totalXP - resolvedCurrentXP) / span;
  return Math.max(0, Math.min(1, progress));
}

export function formatDeltaPercent(deltaPercent: number | null): string {
  if (deltaPercent == null || deltaPercent === 0) {
    return 'Stable';
  }

  return `${deltaPercent > 0 ? '+' : ''}${deltaPercent}% vs yest.`;
}
