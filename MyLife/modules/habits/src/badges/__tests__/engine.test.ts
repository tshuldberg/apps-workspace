import { describe, expect, it } from 'vitest';
import { BADGE_CATALOG, getBadgeProgress } from '../engine';

describe('badges engine progress', () => {
  it('tracks streak badge progress from longest streak', () => {
    const badge = BADGE_CATALOG.find((entry) => entry.key === 'streak_30');
    expect(badge).toBeTruthy();

    const progress = getBadgeProgress(badge!, {
      longestStreak: 12,
      totalCompletions: 40,
      sobrietyDays: 0,
      habitCount: 4,
      perfectDays: 0,
      perfectWeekDays: 0,
      focusSessions: 0,
      daysSinceLastCompletion: 0,
      pledgeStreak: 0,
    });

    expect(progress.current).toBe(12);
    expect(progress.target).toBe(30);
    expect(progress.progress).toBeCloseTo(0.4);
  });

  it('returns full progress for unlocked badges', () => {
    const badge = BADGE_CATALOG.find((entry) => entry.key === 'special_focus_master');
    expect(badge).toBeTruthy();

    const progress = getBadgeProgress(badge!, {
      longestStreak: 4,
      totalCompletions: 40,
      sobrietyDays: 0,
      habitCount: 4,
      perfectDays: 0,
      perfectWeekDays: 0,
      focusSessions: 12,
      daysSinceLastCompletion: 0,
      pledgeStreak: 0,
    }, true);

    expect(progress.progress).toBe(1);
    expect(progress.remaining).toBe(0);
  });
});
