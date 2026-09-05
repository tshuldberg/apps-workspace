import type { StreakMilestone, CelebrationEvent, BadgeColor, BadgeState } from './types';

export const MILESTONES: StreakMilestone[] = [
  { days: 3, enhanced: false, message: '3-day streak! Great start!' },
  { days: 7, enhanced: true, message: '1 week streak! You\'re building a habit!' },
  { days: 14, enhanced: false, message: '2-week streak! Consistency pays off!' },
  { days: 30, enhanced: true, message: '30-day streak! One month strong!' },
  { days: 50, enhanced: false, message: '50-day streak! Halfway to 100!' },
  { days: 100, enhanced: true, message: '100-day streak! Triple digits!' },
  { days: 150, enhanced: false, message: '150-day streak! Incredible dedication!' },
  { days: 200, enhanced: false, message: '200-day streak! Unstoppable!' },
  { days: 250, enhanced: false, message: '250-day streak! Nearly a year!' },
  { days: 365, enhanced: true, message: '365-day streak! A full year!' },
  { days: 500, enhanced: false, message: '500-day streak! Legendary!' },
  { days: 1000, enhanced: true, message: '1000-day streak! You are a master!' },
];

export function checkMilestone(
  currentStreak: number,
  lastCelebratedStreak: number,
  longestStreak: number,
): CelebrationEvent | null {
  if (currentStreak <= lastCelebratedStreak) return null;

  // Find the highest milestone at or below currentStreak that hasn't been celebrated
  let highestMilestone: StreakMilestone | null = null;
  for (const m of MILESTONES) {
    if (m.days <= currentStreak && m.days > lastCelebratedStreak) {
      highestMilestone = m;
    }
  }

  const isNewRecord = currentStreak > longestStreak && longestStreak > 0;

  if (!highestMilestone && !isNewRecord) return null;

  if (!highestMilestone) {
    // New record but no milestone
    return {
      milestone: { days: currentStreak, enhanced: false, message: `${currentStreak}-day streak! New personal record!` },
      isNewRecord: true,
      currentStreak,
      longestStreak,
    };
  }

  return {
    milestone: highestMilestone,
    isNewRecord,
    currentStreak,
    longestStreak,
  };
}

export function getBadgeColor(streak: number): BadgeColor {
  if (streak <= 0) return 'gray';
  if (streak < 7) return 'orange';
  if (streak < 30) return 'amber';
  return 'red';
}

export function getAtRiskState(
  currentStreak: number,
  studiedToday: boolean,
): boolean {
  return currentStreak >= 1 && !studiedToday;
}

export function getBadgeState(
  currentStreak: number,
  longestStreak: number,
  studiedToday: boolean,
): BadgeState {
  return {
    color: getBadgeColor(currentStreak),
    atRisk: getAtRiskState(currentStreak, studiedToday),
    currentStreak,
    longestStreak,
    encouragingMessage: currentStreak === 0
      ? 'Every great streak starts with Day 1. Let\'s go!'
      : null,
  };
}

export function getEncouragingMessage(): string {
  return 'Every great streak starts with Day 1. Let\'s go!';
}
