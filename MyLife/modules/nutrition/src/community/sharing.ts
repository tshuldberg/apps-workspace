import type { CommunityProfile, ActivityType } from './types';
import { ACTIVITY_SHARING_MAP } from './types';

/**
 * Check whether a feed item of the given activity type should be visible
 * based on the poster's current sharing preferences.
 *
 * Privacy enforcement happens at read time so that toggling preferences
 * immediately changes what connections can see.
 */
export function isActivityVisible(
  profile: CommunityProfile,
  activityType: ActivityType,
): boolean {
  const sharingKey = ACTIVITY_SHARING_MAP[activityType];
  if (sharingKey === null) return true; // Always visible types
  return profile[sharingKey];
}

/**
 * Filter a list of activity types to only those the profile allows sharing.
 */
export function getVisibleActivityTypes(
  profile: CommunityProfile,
): ActivityType[] {
  const allTypes: ActivityType[] = ['streak', 'goal_hit', 'challenge_joined', 'challenge_complete', 'milestone', 'custom'];
  return allTypes.filter((type) => isActivityVisible(profile, type));
}
