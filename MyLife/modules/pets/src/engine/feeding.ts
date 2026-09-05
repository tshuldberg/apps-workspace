import type { FeedingStatus } from '../types';

// ── Daily Feeding Status ─────────────────────────────────────────────

export interface ScheduleStatus {
  scheduleId: string;
  feedAt: string;
  status: FeedingStatus;
  fedAt: string | null;
}

export interface DailyFeedingResult {
  schedules: ScheduleStatus[];
  allComplete: boolean;
  fedCount: number;
  totalCount: number;
}

/**
 * Compute daily feeding status for a set of schedules and logs.
 * - "fed" if a log exists for this schedule+date
 * - "missed" if the meal time has passed and no log exists
 * - "pending" if the meal time has not yet passed
 *
 * When no schedules exist, allComplete is true (vacuous truth).
 * If multiple logs exist for the same schedule+date, the first one wins.
 */
export function getDailyFeedingStatus(
  schedules: Array<{ id: string; feedAt: string }>,
  logs: Array<{ scheduleId: string; date: string; fedAt: string }>,
  currentTime: string,
  date: string,
): DailyFeedingResult {
  if (schedules.length === 0) {
    return { schedules: [], allComplete: true, fedCount: 0, totalCount: 0 };
  }

  const logsBySchedule = new Map<string, string>();
  for (const log of logs) {
    if (log.date === date && !logsBySchedule.has(log.scheduleId)) {
      logsBySchedule.set(log.scheduleId, log.fedAt);
    }
  }

  const result: ScheduleStatus[] = schedules.map((schedule) => {
    const fedAt = logsBySchedule.get(schedule.id) ?? null;
    if (fedAt) {
      return { scheduleId: schedule.id, feedAt: schedule.feedAt, status: 'fed' as const, fedAt };
    }

    // Compare HH:MM format against current time HH:MM
    const mealTime = schedule.feedAt;
    const nowTime = currentTime.length > 5 ? currentTime.slice(0, 5) : currentTime;
    const isPast = nowTime > mealTime;

    return {
      scheduleId: schedule.id,
      feedAt: schedule.feedAt,
      status: isPast ? ('missed' as const) : ('pending' as const),
      fedAt: null,
    };
  });

  const fedCount = result.filter((s) => s.status === 'fed').length;

  return {
    schedules: result,
    allComplete: fedCount === schedules.length,
    fedCount,
    totalCount: schedules.length,
  };
}

// ── Food Transition Ratio Calculator ─────────────────────────────────

export interface TransitionRatio {
  phase: string;
  oldPercent: number;
  newPercent: number;
  dayNumber: number;
  totalDays: number;
  progressPct: number;
  isComplete: boolean;
}

/**
 * Phase boundaries for food transitions.
 * Each duration has explicit day ranges mapping to old/new percentages.
 * Uses lookup tables per the spec (not continuous formulas).
 */
const TRANSITION_PHASES: Record<number, Array<{ upTo: number; old: number; new: number; phase: string }>> = {
  7: [
    { upTo: 1, old: 75, new: 25, phase: 'Days 1-2: Mostly old food' },
    { upTo: 3, old: 50, new: 50, phase: 'Days 3-4: Half and half' },
    { upTo: 5, old: 25, new: 75, phase: 'Days 5-6: Mostly new food' },
    { upTo: 7, old: 0, new: 100, phase: 'Day 7: All new food' },
  ],
  10: [
    { upTo: 2, old: 75, new: 25, phase: 'Days 1-3: Mostly old food' },
    { upTo: 5, old: 50, new: 50, phase: 'Days 4-6: Half and half' },
    { upTo: 8, old: 25, new: 75, phase: 'Days 7-9: Mostly new food' },
    { upTo: 10, old: 0, new: 100, phase: 'Day 10: All new food' },
  ],
  14: [
    { upTo: 3, old: 75, new: 25, phase: 'Days 1-4: Mostly old food' },
    { upTo: 7, old: 50, new: 50, phase: 'Days 5-8: Half and half' },
    { upTo: 11, old: 25, new: 75, phase: 'Days 9-12: Mostly new food' },
    { upTo: 14, old: 0, new: 100, phase: 'Days 13-14: All new food' },
  ],
};

/**
 * Calculate the food transition ratio for a given day.
 *
 * @param startDate - YYYY-MM-DD when the transition began
 * @param durationDays - 7, 10, or 14
 * @param currentDate - YYYY-MM-DD to calculate for
 * @returns TransitionRatio with phase info, percentages, and completion status
 */
export function calculateTransitionRatio(
  startDate: string,
  durationDays: number,
  currentDate: string,
): TransitionRatio {
  const start = new Date(startDate + 'T00:00:00Z');
  const current = new Date(currentDate + 'T00:00:00Z');
  const elapsedMs = current.getTime() - start.getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

  if (elapsedDays < 0) {
    return {
      phase: 'Not started yet',
      oldPercent: 100,
      newPercent: 0,
      dayNumber: 0,
      totalDays: durationDays,
      progressPct: 0,
      isComplete: false,
    };
  }

  const phases = TRANSITION_PHASES[durationDays];
  if (!phases) {
    return {
      phase: 'Unknown duration',
      oldPercent: 50,
      newPercent: 50,
      dayNumber: elapsedDays + 1,
      totalDays: durationDays,
      progressPct: Math.min(100, Math.round(((elapsedDays + 1) / durationDays) * 100)),
      isComplete: elapsedDays >= durationDays,
    };
  }

  // Day number is 1-indexed
  const dayNumber = elapsedDays + 1;

  if (dayNumber > durationDays) {
    return {
      phase: 'Transition complete',
      oldPercent: 0,
      newPercent: 100,
      dayNumber,
      totalDays: durationDays,
      progressPct: 100,
      isComplete: true,
    };
  }

  // Find the matching phase using elapsed days (0-indexed)
  const matchedPhase = phases.find((p) => elapsedDays <= p.upTo);
  const phase = matchedPhase ?? phases[phases.length - 1];

  return {
    phase: phase.phase,
    oldPercent: phase.old,
    newPercent: phase.new,
    dayNumber,
    totalDays: durationDays,
    progressPct: Math.round((dayNumber / durationDays) * 100),
    isComplete: phase.old === 0 && phase.new === 100,
  };
}
