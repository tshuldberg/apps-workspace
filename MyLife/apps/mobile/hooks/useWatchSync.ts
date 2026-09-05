import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { ActiveFast, WaterIntake, StreakCache } from '@mylife/fast';
import {
  buildWatchState,
  sendFastStateToWatch,
  sendNutritionStateToWatch,
  onWatchAction,
  type WatchAction,
  type WatchNutritionState,
} from '../native/WatchBridge';

interface UseWatchSyncOptions {
  /** Current active fast (null when idle) */
  activeFast: ActiveFast | null;
  /** Today's water intake record */
  water: WaterIntake | null;
  /** Cached streak data */
  streakCache: StreakCache | null;
  /** Nutrition state for watch (null if nutrition module not enabled) */
  nutritionState?: WatchNutritionState | null;
  /** Called when the watch sends a startFast action */
  onStartFast: (protocol: string, targetHours: number) => void;
  /** Called when the watch sends a stopFast action */
  onStopFast: () => void;
  /** Called when the watch sends a logWater action */
  onLogWater: () => void;
  /** Called when the watch sends a logFood action */
  onLogFood?: (foodId: string, servingCount: number) => void;
  /** Called when the watch sends a searchAndLogFood action (voice input) */
  onSearchAndLogFood?: (query: string) => void;
}

/**
 * Hook that keeps the Apple Watch in sync with the phone's fast + nutrition state.
 *
 * - Sends state updates to watch whenever activeFast, water, streak, or nutrition changes
 * - Listens for watch actions (start/stop fast, log water, log food) and dispatches callbacks
 * - iOS only; no-ops on Android
 */
export function useWatchSync({
  activeFast,
  water,
  streakCache,
  nutritionState,
  onStartFast,
  onStopFast,
  onLogWater,
  onLogFood,
  onSearchAndLogFood,
}: UseWatchSyncOptions): void {
  // Stable refs for callbacks to avoid re-subscribing on every render
  const onStartFastRef = useRef(onStartFast);
  const onStopFastRef = useRef(onStopFast);
  const onLogWaterRef = useRef(onLogWater);
  const onLogFoodRef = useRef(onLogFood);
  const onSearchAndLogFoodRef = useRef(onSearchAndLogFood);

  useEffect(() => { onStartFastRef.current = onStartFast; }, [onStartFast]);
  useEffect(() => { onStopFastRef.current = onStopFast; }, [onStopFast]);
  useEffect(() => { onLogWaterRef.current = onLogWater; }, [onLogWater]);
  useEffect(() => { onLogFoodRef.current = onLogFood; }, [onLogFood]);
  useEffect(() => { onSearchAndLogFoodRef.current = onSearchAndLogFood; }, [onSearchAndLogFood]);

  // Send fast state to watch on changes
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const state = buildWatchState(activeFast, water, streakCache);
    sendFastStateToWatch(state);
  }, [
    activeFast?.id,
    activeFast?.startedAt,
    activeFast?.targetHours,
    activeFast?.protocol,
    water?.count,
    water?.target,
    streakCache?.currentStreak,
  ]);

  // Send nutrition state to watch on changes
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!nutritionState) return;

    sendNutritionStateToWatch(nutritionState);
  }, [
    nutritionState?.nutritionEnabled,
    nutritionState?.todayCalories,
    nutritionState?.calorieGoal,
    nutritionState?.recentFoods,
  ]);

  // Listen for watch actions
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const handleAction = (action: WatchAction) => {
      switch (action.action) {
        case 'startFast':
          onStartFastRef.current(action.protocol, action.targetHours);
          break;
        case 'stopFast':
          onStopFastRef.current();
          break;
        case 'logWater':
          onLogWaterRef.current();
          break;
        case 'logFood':
          onLogFoodRef.current?.(action.foodId, action.servingCount);
          break;
        case 'searchAndLogFood':
          onSearchAndLogFoodRef.current?.(action.query);
          break;
      }
    };

    const unsubscribe = onWatchAction(handleAction);
    return unsubscribe;
  }, []);
}
