/**
 * @mylife/social -- Activity Emitter for modules.
 *
 * Each module uses the ActivityEmitter to publish activities to the social feed.
 * The emitter checks privacy settings before posting and handles the full
 * lifecycle: privacy check -> create activity -> update challenge progress.
 *
 * Usage from a module:
 *
 *   import { emitActivity } from '@mylife/social';
 *
 *   await emitActivity({
 *     moduleId: 'workouts',
 *     type: 'workouts_completed',
 *     title: 'Completed Push/Pull/Legs',
 *     metadata: { duration: 65, exercises: 12, volume: 24500 },
 *   });
 */

import type { ModuleId } from '@mylife/module-registry';
import { getSocialClient } from './client-store';
import type {
  ActivityType,
  ActivityMetadata,
  Visibility,
  CreateActivityInput,
  Activity,
  PrivacySettings,
} from './types';

// ── Emitter Input ─────────────────────────────────────────────────────

export interface EmitActivityInput {
  /** Which module is emitting this activity. */
  moduleId: ModuleId;
  /** Activity type (must match a valid ActivityType). */
  type: ActivityType;
  /** Human-readable title (e.g., "Finished Dune by Frank Herbert"). */
  title: string;
  /** Optional description with more detail. */
  description?: string;
  /** Module-specific structured data. */
  metadata?: ActivityMetadata;
  /** Override the default visibility for this activity. */
  visibility?: Visibility;
}

export type EmitResult =
  | { emitted: true; activity: Activity }
  | { emitted: false; reason: 'no_profile' | 'no_client' | 'auto_post_disabled' | 'error'; error?: string };

// ── Emitter Hooks ─────────────────────────────────────────────────────

/** Listeners notified after a successful activity emission. */
type EmitListener = (activity: Activity) => void;
const _emitListeners = new Set<EmitListener>();

/** Subscribe to activity emissions (useful for challenge progress tracking). */
export function onActivityEmitted(listener: EmitListener): () => void {
  _emitListeners.add(listener);
  return () => { _emitListeners.delete(listener); };
}

// ── Core Emitter ──────────────────────────────────────────────────────

/**
 * Emit an activity from a module to the social feed.
 *
 * This is the primary integration point for modules. It:
 * 1. Checks if the user has a social profile (if not, silently skips)
 * 2. Checks if auto-post is enabled for this module (respects privacy settings)
 * 3. Creates the activity with the appropriate visibility
 * 4. Notifies challenge progress listeners
 *
 * Returns an EmitResult indicating whether the activity was posted and why (if not).
 */
export async function emitActivity(input: EmitActivityInput): Promise<EmitResult> {
  const client = getSocialClient();
  if (!client) {
    return { emitted: false, reason: 'no_client' };
  }

  // Check if user has a profile
  const profileResult = await client.getMyProfile();
  if (!profileResult.ok) {
    return { emitted: false, reason: 'error', error: profileResult.error };
  }
  if (!profileResult.data) {
    return { emitted: false, reason: 'no_profile' };
  }

  const profile = profileResult.data;
  const privacySettings = profile.privacySettings as PrivacySettings;

  // Check module-level privacy settings
  const moduleSetting = privacySettings.moduleSettings.find(
    (s) => s.moduleId === input.moduleId,
  );

  // Auto-posting is explicit opt-in. No module setting means disabled.
  if (!moduleSetting?.autoPost) {
    return { emitted: false, reason: 'auto_post_disabled' };
  }

  // Determine visibility (input override > module default > 'followers')
  const visibility: Visibility =
    input.visibility ??
    moduleSetting.defaultVisibility ??
    'followers';

  const activityInput: CreateActivityInput = {
    moduleId: input.moduleId,
    type: input.type,
    title: input.title,
    description: input.description,
    metadata: input.metadata,
    visibility,
  };

  const result = await client.postActivity(activityInput);
  if (!result.ok) {
    return { emitted: false, reason: 'error', error: result.error };
  }

  // Notify listeners (e.g., challenge progress tracker)
  for (const listener of _emitListeners) {
    try {
      listener(result.data);
    } catch {
      // Don't let listener errors break the emission flow
    }
  }

  return { emitted: true, activity: result.data };
}

// ── Module-Specific Helpers ───────────────────────────────────────────

/** Emit a workout completion activity. */
export function emitWorkoutCompleted(title: string, metadata: {
  duration?: number;
  exercises?: number;
  volume?: number;
  type?: string;
}) {
  return emitActivity({
    moduleId: 'workouts',
    type: 'workouts_completed',
    title,
    metadata,
  });
}

/** Emit a book finished activity. */
export function emitBookFinished(title: string, metadata: {
  bookTitle: string;
  author: string;
  rating?: number;
  pages?: number;
}) {
  return emitActivity({
    moduleId: 'books',
    type: 'books_finished',
    title,
    metadata,
  });
}

/** Emit a fast completion activity. */
export function emitFastCompleted(title: string, metadata: {
  duration: number;
  type: string;
}) {
  return emitActivity({
    moduleId: 'fast',
    type: 'fast_completed',
    title,
    metadata,
  });
}

/** Emit a habit streak activity. */
export function emitHabitStreak(title: string, metadata: {
  habitName: string;
  streakDays: number;
}) {
  return emitActivity({
    moduleId: 'habits',
    type: 'habits_streak',
    title,
    metadata,
  });
}

/** Emit a surf session activity. */
export function emitSurfSession(title: string, metadata: {
  spotName: string;
  duration?: number;
  waveCount?: number;
  conditions?: string;
}) {
  return emitActivity({
    moduleId: 'surf',
    type: 'surf_session_logged',
    title,
    metadata,
  });
}

/** Emit a recipe cooked activity. */
export function emitRecipeCooked(title: string, metadata: {
  recipeName: string;
  cuisine?: string;
}) {
  return emitActivity({
    moduleId: 'recipes',
    type: 'recipes_cooked',
    title,
    metadata,
  });
}

/** Emit a words milestone activity. */
export function emitWordsMilestone(title: string, metadata: {
  wordsLearned: number;
  language?: string;
}) {
  return emitActivity({
    moduleId: 'words',
    type: 'words_milestone',
    title,
    metadata,
  });
}

/** Emit a medication adherence streak activity. */
export function emitMedsStreak(title: string, metadata: {
  streakDays: number;
}) {
  return emitActivity({
    moduleId: 'meds',
    type: 'meds_adherence_streak',
    title,
    metadata,
  });
}

/** Emit a forum thread creation activity. */
export function emitForumThreadCreated(title: string, metadata: {
  communityName: string;
  threadTitle: string;
}) {
  return emitActivity({
    moduleId: 'forums',
    type: 'forums_thread_created',
    title,
    metadata,
  });
}

/** Emit a forum reply activity. */
export function emitForumReplyPosted(title: string, metadata: {
  communityName: string;
  threadTitle: string;
  replyPreview: string;
}) {
  return emitActivity({
    moduleId: 'forums',
    type: 'forums_reply_posted',
    title,
    metadata,
  });
}

/** Emit a forum community creation activity. */
export function emitForumCommunityCreated(title: string, metadata: {
  communityName: string;
  description?: string;
}) {
  return emitActivity({
    moduleId: 'forums',
    type: 'forums_community_created',
    title,
    metadata,
  });
}

/** Emit a forum karma milestone activity. */
export function emitForumKarmaMilestone(title: string, metadata: {
  karma: number;
  communitiesJoined: number;
}) {
  return emitActivity({
    moduleId: 'forums',
    type: 'forums_karma_milestone',
    title,
    metadata,
  });
}

/** Emit a marketplace listing creation activity. */
export function emitMarketListingCreated(title: string, metadata: {
  listingTitle: string;
  category?: string;
  priceCents?: number;
}) {
  return emitActivity({
    moduleId: 'market',
    type: 'market_listing_created',
    title,
    metadata,
  });
}

/** Emit a marketplace sale completion activity. */
export function emitMarketListingSold(title: string, metadata: {
  listingTitle: string;
  priceCents?: number;
}) {
  return emitActivity({
    moduleId: 'market',
    type: 'market_listing_sold',
    title,
    metadata,
  });
}

/** Emit a Manhattan event saved activity. */
export function emitManhattanEventSaved(title: string, metadata: {
  eventTitle: string;
  location?: string;
}) {
  return emitActivity({
    moduleId: 'manhattan',
    type: 'manhattan_event_saved',
    title,
    metadata,
  });
}

/** Emit a Manhattan plan shared activity. */
export function emitManhattanPlanShared(title: string, metadata: {
  planTitle: string;
  location?: string;
  eventCount?: number;
}) {
  return emitActivity({
    moduleId: 'manhattan',
    type: 'manhattan_plan_shared',
    title,
    metadata,
  });
}
