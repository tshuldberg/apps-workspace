export interface StreakMilestone {
  days: number;
  enhanced: boolean;
  message: string;
}

export interface CelebrationEvent {
  milestone: StreakMilestone;
  isNewRecord: boolean;
  currentStreak: number;
  longestStreak: number;
}

export type BadgeColor = 'gray' | 'orange' | 'amber' | 'red';

export interface BadgeState {
  color: BadgeColor;
  atRisk: boolean;
  currentStreak: number;
  longestStreak: number;
  encouragingMessage: string | null;
}
