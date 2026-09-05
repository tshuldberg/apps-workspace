/**
 * Smart alarm scheduling and trigger logic.
 * Calculates wake windows, determines optimal trigger times,
 * and tracks alarm effectiveness.
 * Pure functions, no side effects.
 */

import type { WakeWindow, AlarmSuccessRate, TriggerReason } from '../types';

/**
 * Calculate the wake window given a target time and window duration.
 * Wake window = [target_time - wake_window_minutes, target_time]
 */
export function calculateWakeWindow(
  targetTime: Date,
  wakeWindowMinutes: number,
): WakeWindow {
  const end = new Date(targetTime);
  const start = new Date(end.getTime() - wakeWindowMinutes * 60 * 1000);
  return { start, end };
}

/**
 * Parse an HH:MM time string into a Date for today (or tomorrow if the time has passed).
 */
export function parseTargetTime(timeStr: string, referenceDate?: Date): Date {
  const ref = referenceDate ?? new Date();
  const [hours, minutes] = timeStr.split(':').map(Number);
  const target = new Date(ref);
  target.setHours(hours, minutes, 0, 0);

  if (target.getTime() <= ref.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/**
 * Determine if the alarm should trigger based on current sleep stage
 * and position within the wake window.
 */
export function shouldTriggerAlarm(
  currentTime: Date,
  wakeWindow: WakeWindow,
  currentSleepStage: string | null,
): { shouldTrigger: boolean; reason: TriggerReason } {
  const now = currentTime.getTime();
  const windowStart = wakeWindow.start.getTime();
  const windowEnd = wakeWindow.end.getTime();

  // Not in window yet
  if (now < windowStart) {
    return { shouldTrigger: false, reason: 'window_end' };
  }

  // Past window end: must trigger
  if (now >= windowEnd) {
    return { shouldTrigger: true, reason: 'window_end' };
  }

  // Within window: trigger if light sleep or awake
  if (currentSleepStage === 'light' || currentSleepStage === 'awake') {
    return { shouldTrigger: true, reason: 'light_sleep' };
  }

  // In window but in deep/REM sleep: don't trigger yet
  return { shouldTrigger: false, reason: 'window_end' };
}

/**
 * Calculate the success rate of smart alarms.
 * Success = triggered during light sleep vs total alarms.
 */
export function calculateSuccessRate(
  historyEntries: Array<{ trigger_reason: string }>,
): AlarmSuccessRate {
  const total = historyEntries.length;
  if (total === 0) return { total: 0, lightSleepWakes: 0, rate: 0 };

  const lightSleepWakes = historyEntries.filter(
    (e) => e.trigger_reason === 'light_sleep',
  ).length;

  return {
    total,
    lightSleepWakes,
    rate: Math.round((lightSleepWakes / total) * 100),
  };
}

/**
 * Get the next alarm time for a given alarm configuration.
 * Considers days_of_week (1=Mon...7=Sun, comma-separated).
 */
export function getNextAlarmTime(
  targetTimeStr: string,
  daysOfWeek: string,
  referenceDate?: Date,
): Date | null {
  const ref = referenceDate ?? new Date();
  const days = daysOfWeek.split(',').map(Number).filter((d) => d >= 1 && d <= 7);
  if (days.length === 0) return null;

  const [hours, minutes] = targetTimeStr.split(':').map(Number);

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(ref);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);

    // JS getDay(): 0=Sun...6=Sat. Convert to 1=Mon...7=Sun.
    const jsDay = candidate.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    if (!days.includes(isoDay)) continue;

    // If today, must be in the future
    if (offset === 0 && candidate.getTime() <= ref.getTime()) continue;

    return candidate;
  }

  return null;
}

/**
 * Parse days_of_week string to readable labels.
 */
export function formatDaysOfWeek(daysOfWeek: string): string {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = daysOfWeek.split(',').map(Number).filter((d) => d >= 1 && d <= 7);

  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && [6, 7].every((d) => days.includes(d))) return 'Weekends';

  return days.map((d) => dayLabels[d - 1]).join(', ');
}
