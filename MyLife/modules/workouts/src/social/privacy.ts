/**
 * Privacy filter engine for workout social posts.
 * Strips sensitive data from WorkoutSummaryCard based on user privacy settings.
 */

import type { WorkoutSummaryCard, SocialPrivacySettings } from '../types';
import { DEFAULT_SOCIAL_PRIVACY } from '../types';

/**
 * Apply privacy settings to a workout summary card.
 * Returns a filtered copy with sensitive fields zeroed or removed.
 */
export function applyPrivacyFilter(
  card: WorkoutSummaryCard,
  settings: Partial<SocialPrivacySettings>,
): WorkoutSummaryCard {
  const merged: SocialPrivacySettings = { ...DEFAULT_SOCIAL_PRIVACY, ...settings };

  return {
    sessionId: card.sessionId,
    title: merged.shareTitle ? card.title : 'Workout',
    date: card.date,
    durationMinutes: merged.shareDuration ? card.durationMinutes : 0,
    exerciseCount: merged.shareExercises ? card.exerciseCount : 0,
    totalSets: merged.shareWeightDetails ? card.totalSets : 0,
    totalReps: merged.shareWeightDetails ? card.totalReps : 0,
    totalVolume: merged.shareWeightDetails ? card.totalVolume : 0,
    prsHit: merged.sharePrs ? card.prsHit : [],
    muscleGroups: merged.shareExercises ? card.muscleGroups : [],
  };
}

/**
 * Validate privacy settings, filling in defaults for missing fields.
 */
export function normalizePrivacySettings(
  settings: Partial<SocialPrivacySettings>,
): SocialPrivacySettings {
  return { ...DEFAULT_SOCIAL_PRIVACY, ...settings };
}
