import {
  sendMessage,
  updateApplicationContext,
  watchEvents,
  getReachability,
} from 'react-native-watch-connectivity';
import type { ActiveFast, WaterIntake, StreakCache } from '@mylife/fast';

/**
 * Payload sent to the Apple Watch via WatchConnectivity.
 * Kept flat for WCSession serialization compatibility.
 */
export interface WatchFastState {
  isActive: boolean;
  /** Unix timestamp (seconds since epoch), or 0 if no active fast */
  startedAt: number;
  targetHours: number;
  protocol: string;
  waterCount: number;
  waterGoal: number;
  streak: number;
}

/**
 * Nutrition state payload sent alongside fast state.
 */
export interface WatchNutritionState {
  nutritionEnabled: boolean;
  todayCalories: number;
  calorieGoal: number;
  recentFoods: Array<{
    id: string;
    name: string;
    calories: number;
    servingUnit: string;
  }>;
}

/**
 * Actions the watch can send back to the phone.
 */
export type WatchAction =
  | { action: 'startFast'; protocol: string; targetHours: number }
  | { action: 'stopFast' }
  | { action: 'logWater' }
  | { action: 'logFood'; foodId: string; servingCount: number }
  | { action: 'searchAndLogFood'; query: string };

/**
 * Build the flat state payload from app state pieces.
 */
export function buildWatchState(
  activeFast: ActiveFast | null,
  water: WaterIntake | null,
  streakCache: StreakCache | null,
): WatchFastState {
  return {
    isActive: activeFast != null,
    startedAt: activeFast ? Math.floor(new Date(activeFast.startedAt).getTime() / 1000) : 0,
    targetHours: activeFast?.targetHours ?? 16,
    protocol: activeFast?.protocol ?? '16:8',
    waterCount: water?.count ?? 0,
    waterGoal: water?.target ?? 8,
    streak: streakCache?.currentStreak ?? 0,
  };
}

/**
 * Send the current fast state to the Apple Watch.
 * Uses sendMessage when reachable (immediate), falls back to
 * updateApplicationContext (queued for next wake).
 */
export async function sendFastStateToWatch(state: WatchFastState): Promise<void> {
  const payload = state as unknown as Record<string, unknown>;

  try {
    const reachable = await getReachability();
    if (reachable) {
      await sendMessage(payload);
    } else {
      await updateApplicationContext(payload);
    }
  } catch {
    // If sendMessage fails, fall back to application context
    try {
      await updateApplicationContext(payload);
    } catch {
      // Watch may not be paired; silently ignore
    }
  }
}

/**
 * Send nutrition state to the Apple Watch.
 * Merged into application context alongside fast state.
 */
export async function sendNutritionStateToWatch(state: WatchNutritionState): Promise<void> {
  const payload = state as unknown as Record<string, unknown>;

  try {
    const reachable = await getReachability();
    if (reachable) {
      await sendMessage(payload);
    } else {
      await updateApplicationContext(payload);
    }
  } catch {
    try {
      await updateApplicationContext(payload);
    } catch {
      // Watch may not be paired; silently ignore
    }
  }
}

/**
 * Subscribe to actions sent from the Apple Watch.
 * Returns an unsubscribe function.
 */
export function onWatchAction(callback: (action: WatchAction) => void): () => void {
  const unsubMessage = watchEvents.on('message', (message) => {
    if (message && typeof message === 'object' && 'action' in message) {
      callback(message as unknown as WatchAction);
    }
  });

  const unsubUserInfo = watchEvents.on('user-info', (userInfos) => {
    for (const userInfo of userInfos) {
      if (userInfo && typeof userInfo === 'object' && 'action' in userInfo) {
        callback(userInfo as unknown as WatchAction);
      }
    }
  });

  return () => {
    unsubMessage();
    unsubUserInfo();
  };
}
