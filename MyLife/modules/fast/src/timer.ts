import type { ActiveFast, LastCompletedFast, TimerState } from './types';

/**
 * Compute the current timer state from an active fast and the current time.
 * Timer is derived from startedAt timestamp — NOT a foreground counter.
 * App can be killed and timer stays accurate.
 *
 * When no active fast exists, checks if the user is still within the eating
 * window of their last completed fast. For protocols with eating hours > 0
 * (e.g., 16:8 has 8 eating hours), the timer transitions to 'eating_window'
 * instead of 'idle', showing time remaining in the eating window.
 *
 * State machine:
 *   idle ──[start fast]──▶ fasting ──[end fast]──▶ eating_window ──[window closes]──▶ idle
 *                                                         │
 *                                              (only if eatingHours > 0)
 */
export function computeTimerState(
  activeFast: ActiveFast | null,
  now: Date,
  lastCompletedFast?: LastCompletedFast | null,
): TimerState {
  if (!activeFast) {
    // Check if we're in an eating window from a recently completed fast
    if (lastCompletedFast?.endedAt && lastCompletedFast.eatingHours > 0) {
      const endedAt = new Date(lastCompletedFast.endedAt);
      const eatingWindowMs = lastCompletedFast.eatingHours * 3600 * 1000;
      const eatingWindowEnd = new Date(endedAt.getTime() + eatingWindowMs);

      if (now >= endedAt && now < eatingWindowEnd) {
        const elapsed = Math.floor((now.getTime() - endedAt.getTime()) / 1000);
        const totalEatingSeconds = lastCompletedFast.eatingHours * 3600;
        const remaining = Math.max(0, totalEatingSeconds - elapsed);

        return {
          state: 'eating_window',
          activeFast: null,
          elapsed,
          remaining,
          progress: Math.min(elapsed / totalEatingSeconds, 1),
          targetReached: remaining === 0,
        };
      }
    }

    return {
      state: 'idle',
      activeFast: null,
      elapsed: 0,
      remaining: 0,
      progress: 0,
      targetReached: false,
    };
  }

  const elapsed = Math.floor((now.getTime() - new Date(activeFast.startedAt).getTime()) / 1000);
  const targetSeconds = activeFast.targetHours * 3600;
  const remaining = Math.max(0, targetSeconds - elapsed);
  const progress = targetSeconds > 0 ? elapsed / targetSeconds : 0;
  const targetReached = elapsed >= targetSeconds;

  return {
    state: 'fasting',
    activeFast,
    elapsed,
    remaining,
    progress: Math.min(progress, 1), // Cap at 1.0 for ring display
    targetReached,
  };
}

/** Format seconds as HH:MM:SS */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
